import { verifyToken } from "../../../../lib/auth.ts";
import { logAPI } from '../../../../lib/logger.ts';
import dbConnect from '../../../../lib/dbConnect'
import User from '../../../../models/User'
import Ingredients from '../../../../models/Ingredients'
import axios from 'axios';
import { convertMetricReading } from '../../../../lib/conversion'
import { filterValidEntries } from '../../../../lib/commonAPIs'

export default async function handler(req, res) {
    let search_term = req.query.name

    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        if (req.method === "GET") {
            await dbConnect()

            let db_id = decoded.id
            let userData = await User.findOne({ id: db_id });
            if (!userData || userData.id === undefined) {
                return res.status(400).json({ success: false, message: "User not found, please relog" })
            } else if (!search_term) {
                return res.status(400).json({ success: false, message: "Search term cannot be empty" })
            } else {
                const source = "Coles";
                const force = req.query.force === 'true';
                if (!force) {
                    const existingIngredients = await Ingredients.find({
                        search_term: search_term.toLowerCase(),
                        source: source
                    }).lean().exec();

                    if (existingIngredients.length > 0) {
                        return res.status(200).json({ res: existingIngredients, success: true, from_db: true });
                    }
                }

                let response;
                try {
                    response = await axios({
                        method: 'get',
                        url: `https://www.coles.com.au/_next/data/20260310.4-d51173fab603623c68e557a054992d8939a1a9e7/en/search/products.json?q=${search_term}`,
                        headers: {
                            'accept': '*/*',
                            'accept-language': 'en-GB,en;q=0.6',
                            'referer': 'https://www.coles.com.au/',
                            'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Brave";v="146"',
                            'sec-ch-ua-mobile': '?1',
                            'sec-ch-ua-platform': '"Android"',
                            'sec-fetch-dest': 'empty',
                            'sec-fetch-mode': 'cors',
                            'sec-fetch-site': 'same-origin',
                            'user-agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36',
                            'x-nextjs-data': '1'
                        }
                    })
                } catch (searchError) {
                    throw searchError;
                }

                let filteredDataArray = []

                if (response.data && response.data.pageProps && response.data.pageProps.searchResults && response.data.pageProps.searchResults.results) {
                    let results = response.data.pageProps.searchResults.results
                    // Limit to first 10 results for Coles
                    for (let i = 0; i < Math.min(results.length, 10); i++) {
                        try {
                            let filteredData = results[i]
                            if (!filteredData) continue;

                            let internal_id = filteredData.id
                            let name = filteredData.name
                            let price = filteredData.pricing?.now

                            // Better unit/quantity extraction
                            let quantity_unit = filteredData.pricing?.comparablePrice?.unitOfMeasure || filteredData.pricing?.unit?.ofMeasureUnits
                            let quantity = filteredData.pricing?.unit?.ofMeasureQuantity || 1
                            let quantity_type;

                            if (filteredData.pricing?.comparablePrice?.per) {
                                // e.g. "per 1kg" or "per 100g"
                                let perMatch = filteredData.pricing.comparablePrice.per.match(/per\s+(\d+)?\s*(.*)/i);
                                if (perMatch) {
                                    let perQty = parseFloat(perMatch[1] || 1);
                                    let perUnit = perMatch[2].trim();

                                    // If price is per kg but item is sold in grams, we can normalize
                                    // Use convertMetricReading to normalize the 'per' unit
                                    let perConversion = convertMetricReading(`${perQty} ${perUnit}`);

                                    // If we have a reliable package size in the name or field, prioritize it
                                    let nameConversion = convertMetricReading(name);
                                    if (nameConversion.quantity !== 1 || nameConversion.quantity_unit !== 'each') {
                                        quantity = nameConversion.quantity;
                                        quantity_unit = nameConversion.quantity_unit;
                                        quantity_type = nameConversion.quantity_type;
                                    } else {
                                        // Fallback to unit/quantity from pricing fields
                                        let unitConversion = convertMetricReading(`${quantity} ${quantity_unit}`);
                                        quantity = unitConversion.quantity;
                                        quantity_unit = unitConversion.quantity_unit;
                                        quantity_type = unitConversion.quantity_type;
                                    }
                                }
                            } else {
                                // Existing logic fallback
                                let nameConversion = convertMetricReading(name)
                                if (!(quantity_unit) || nameConversion.quantity !== 1 || nameConversion.quantity_unit !== 'each') {
                                    quantity = nameConversion.quantity
                                    quantity_unit = nameConversion.quantity_unit
                                    quantity_type = nameConversion.quantity_type
                                } else {
                                    let metricConversion = convertMetricReading(quantity_unit)
                                    quantity_unit = metricConversion.quantity_unit
                                    quantity_type = metricConversion.quantity_type
                                    if (metricConversion.quantity !== 1) {
                                        quantity = quantity * metricConversion.quantity
                                    }
                                }
                            }
                            let unit_price = parseFloat((price / quantity).toFixed(3))
                            let filteredObj = {
                                "id": source + "-" + name + "-" + internal_id,
                                "name": name,
                                "price": price,
                                "unit_price": unit_price,
                                "quantity_unit": quantity_unit,
                                "quantity_type": quantity_type,
                                "quantity": quantity,
                                "search_term": search_term,
                                "source": source,
                            }
                            filteredDataArray.push(filteredObj)
                        } catch (innerError) {
                            console.error("Error processing Coles item:", innerError.message);
                        }
                    }
                }

                let validatedEntries = await filterValidEntries(filteredDataArray, search_term, req.headers.edgetoken || req.query.EDGEtoken)
                for (let ingredient of validatedEntries) {
                    await Ingredients.findOneAndUpdate(
                        { id: ingredient.id },
                        ingredient,
                        { upsert: true }
                    );
                }

                // Log successful search and get conversion

                return res.status(200).send({ res: validatedEntries, success: true, count: validatedEntries.length })
            }
        } else {
            return res.status(405).json({ success: false, message: "Method Not Allowed" })
        }
    } catch (error) {
        console.error("Coles API Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error in Coles API: " + error.message });
    }
}
