import { verifyToken } from "../../../../lib/auth.ts";
import { logAPI } from '../../../../lib/logger.ts';
import dbConnect from '../../../../lib/dbConnect'
import User from '../../../../models/User'
import AldiIngredient from '../../../../models/AldiIngredient'
import Ingredients from '../../../../models/Ingredients'
import axios from 'axios';
import JSSoup from 'jssoup';
import { convertMetricReading } from '../../../../lib/conversion'

function calculateLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= a.length; i++) matrix[i] = [i];
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return matrix[a.length][b.length];
}

function findMatches(inputIngredient, products) {
    const threshold = 5;
    const matches = [];
    for (const product of products) {
        const productNameLower = product.name.toLowerCase();
        const inputIngredientLower = inputIngredient.toLowerCase();
        if (productNameLower.includes(inputIngredientLower)) {
            matches.push({ ...product, distance: -1 });
        } else {
            const distance = calculateLevenshteinDistance(inputIngredientLower, productNameLower);
            if (distance <= threshold) matches.push({ ...product, distance });
        }
    }
    return matches.sort((a, b) => a.distance - b.distance);
}

function removeSpecialChars(text) {
    return text.replace(/<[^>]*>/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function mapAldiProduct(product, search_term, source, formattedDateTime) {
    const name = product.name;
    const price = product.price.amount / 100;
    const sku = product.sku;

    // Use the sellingSize if available, otherwise default to 1 each
    const sellingSize = product.sellingSize || "1 each";
    const metricConversion = convertMetricReading(sellingSize);

    // If name doesn't have metric info, try to use sellingSize for quantity
    let quantity = metricConversion.quantity;
    let quantity_unit = metricConversion.quantity_unit;
    let quantity_type = metricConversion.quantity_type;

    // Calculate unit price
    const unit_price = parseFloat((price / quantity).toFixed(3));

    return {
        "id": `${source}-${name}-${sku}`,
        "name": name,
        "price": price,
        "unit_price": unit_price,
        "quantity_unit": quantity_unit,
        "quantity_type": quantity_type,
        "quantity": quantity,
        "search_term": search_term,
        "source": source,
    };
}

async function extractFromAldi(endpoint, formattedDateTime) {
    // Legacy scraping function - might still be used by POST if we keep it
    let ingredList = []
    try {
        const response = await axios.get(endpoint, {
            headers: {
                'User-Agent': 'PostmanRuntime/7.28.4',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.aldi.com.au'
            }
        });
        const soup = new JSSoup(response.data, true);
        const targetDivs = soup.findAll('div', 'ratio-container');
        let source = "Aldi"
        targetDivs.forEach((parentDiv) => {
            try {
                const priceDiv = parentDiv.find('div', 'box--price');
                if (!priceDiv) return;
                let dollars = parseFloat((priceDiv.find("span", "box--value").text).replace("$", ""))
                let cents = parseFloat((priceDiv.find("span", "box--decimal").text).replace("$", ""))
                let price = Number((dollars + cents / 100).toFixed(2))
                let name = removeSpecialChars(parentDiv.find("div", "box--description--header").text)
                let metricConversion = convertMetricReading(name)
                let quantity = metricConversion.quantity
                let quantity_unit = metricConversion.quantity_unit
                let quantity_type = metricConversion.quantity_type
                let unit_price = parseFloat((price / quantity).toFixed(3))
                let ingredDict = {
                    "id": source + "-" + name + "-" + formattedDateTime,
                    "name": name,
                    "price": price,
                    "unit_price": unit_price,
                    "quantity_unit": quantity_unit,
                    "quantity_type": quantity_type,
                    "quantity": quantity,
                    "endpoint": endpoint
                }
                AldiIngredient.findOneAndUpdate({ id: ingredDict.id }, ingredDict, { upsert: true }).exec();
                ingredList.push(ingredDict)
            } catch (error) {
                console.error("Error extracting item from Aldi:", error.message);
            }
        });
    } catch (error) {
        console.error('Aldi extraction failed for endpoint:', endpoint, error.message);
    }
    return ingredList
}

function formatCurrentDateTime() {
    const currentDate = new Date();
    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}-${String(currentDate.getHours()).padStart(2, '0')}-${String(currentDate.getMinutes()).padStart(2, '0')}`;
}

export default async function handler(req, res) {
    const formattedDateTime = formatCurrentDateTime();
    let search_term = req.query.name

    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        await dbConnect();
        if (req.method === "POST") {
            let endpointList = [
                "https://www.aldi.com.au/en/groceries/super-savers/",
                "https://www.aldi.com.au/en/groceries/limited-time-only/",
                "https://www.aldi.com.au/en/groceries/price-reductions/",
                "https://www.aldi.com.au/en/groceries/fresh-produce/dairy-eggs/",
                "https://www.aldi.com.au/en/groceries/baby/nappies-and-wipes/",
                "https://www.aldi.com.au/en/groceries/baby/baby-food/",
                "https://www.aldi.com.au/en/groceries/beauty/",
                "https://www.aldi.com.au/en/groceries/freezer/",
                "https://www.aldi.com.au/en/groceries/health/",
                "https://www.aldi.com.au/en/groceries/laundry-household/laundry/",
                "https://www.aldi.com.au/en/groceries/laundry-household/household/",
                "https://www.aldi.com.au/en/groceries/liquor/wine/",
                "https://www.aldi.com.au/en/groceries/liquor/beer-cider/",
                "https://www.aldi.com.au/en/groceries/liquor/champagne-sparkling/",
                "https://www.aldi.com.au/en/groceries/liquor/spirits/",
                "https://www.aldi.com.au/en/special-buys/special-buys-liquor/",
                "https://www.aldi.com.au/en/groceries/pantry/olive-oil/",
                "https://www.aldi.com.au/en/groceries/pantry/chocolate/",
                "https://www.aldi.com.au/en/groceries/pantry/coffee/"
            ]
            let allResults = []
            for (let endpoint of endpointList) {
                let list = await extractFromAldi(endpoint, formattedDateTime)
                allResults = allResults.concat(list)
            }
            return res.status(200).send({ res: allResults, success: true })
        } else if (req.method === "DELETE") {
            let db_id = decoded.id
            let userData = await User.findOne({ id: db_id });
            if (!userData) {
                return res.status(404).json({ success: false, message: "User not found" });
            }
            if (userData.role !== "admin") {
                return res.status(403).json({ success: false, message: "Insufficient Privileges" });
            }
            let RecipeData = await AldiIngredient.deleteMany({})
            return res.status(200).json({ success: true, data: RecipeData, message: "Success" })
        } else if (req.method === "GET") {
            if (search_term) {
                const source = "Aldi";

                // Check database first to reduce API calls
                const existingIngredients = await Ingredients.find({
                    search_term: search_term.toLowerCase(),
                    source: source
                }).lean().exec();

                if (existingIngredients.length > 0) {
                    return res.status(200).json({ res: existingIngredients, success: true, from_db: true });
                }

                const aldiApiUrl = `https://api.aldi.com.au/v3/product-search?currency=AUD&serviceType=walk-in&q=${encodeURIComponent(search_term)}&limit=30&offset=0&sort=relevance&servicePoint=G452`;

                const response = await axios.get(aldiApiUrl, {
                    headers: {
                        'User-Agent': 'PostmanRuntime/7.28.4',
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': 'https://www.aldi.com.au'
                    }
                });

                let filteredDataArray = [];
                if (response.data && response.data.data) {
                    const products = response.data.data;
                    for (const product of products) {
                        try {
                            const filteredObj = mapAldiProduct(product, search_term, source, formattedDateTime);

                            await Ingredients.findOneAndUpdate(
                                { id: filteredObj.id },
                                filteredObj,
                                { upsert: true }
                            );
                            filteredDataArray.push(filteredObj);
                        } catch (innerError) {
                            console.error("Error processing Aldi item:", innerError.message);
                        }
                    }
                }
                return res.status(200).send({ res: filteredDataArray, success: true })
            } else {
                let IngredData = await AldiIngredient.find({}).lean().exec()
                return res.status(200).send({ success: true, res: IngredData })
            }
        } else {
            return res.status(405).json({ success: false, message: "Method Not Allowed" })
        }
    } catch (error) {
        console.error("Aldi API Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error in Aldi API: " + error.message });
    }
}
