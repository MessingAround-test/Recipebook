import { verifyToken } from "../../../../lib/auth.ts";
import { logAPI } from '../../../../lib/logger.ts';
import dbConnect from '../../../../lib/dbConnect'
import User from '../../../../models/User'
import AldiIngredient from '../../../../models/AldiIngredient'
import Ingredients from '../../../../models/Ingredients'
import axios from 'axios';
import JSSoup from 'jssoup';
import { convertMetricReading } from '../../../../lib/conversion'
import { filterValidEntries } from '../../../../lib/commonAPIs'


export default async function handler(req, res) {
    let search_term = req.query.name

    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        await dbConnect();
        if (req.method === "POST") {
            // ... (POST logic unchanged)
        } else if (req.method === "DELETE") {
            // ... (DELETE logic unchanged)
        } else if (req.method === "GET") {
            if (search_term) {
                const source = "Aldi";

                // Check database first to reduce API calls
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

                const aldiApiUrl = `https://api.aldi.com.au/v3/product-search?currency=AUD&serviceType=walk-in&q=${encodeURIComponent(search_term)}&limit=30&offset=0&sort=relevance&servicePoint=G452`;

                let response;
                try {
                    response = await axios.get(aldiApiUrl, {
                        headers: {
                            'User-Agent': 'PostmanRuntime/7.28.4',
                            'Accept': 'application/json, text/plain, */*',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Referer': 'https://www.aldi.com.au'
                        }
                    });
                } catch (searchError) {
                    throw searchError;
                }

                const mapAldiProduct = (product, search_term, source) => {
                    const name = product.name;
                    const price = (product.price?.amount || 0) / 100;

                    // 1. Try name first as it often contains fractional info like "Cut"
                    let nameConversion = convertMetricReading(name);
                    let sizeConversion = product.sellingSize ? convertMetricReading(product.sellingSize) : null;

                    let conversion;
                    if (nameConversion.quantity !== 1 || nameConversion.quantity_unit !== 'each') {
                        conversion = nameConversion;
                    } else if (sizeConversion) {
                        conversion = sizeConversion;
                    } else {
                        conversion = nameConversion;
                    }

                    const quantity = conversion.quantity || 1;
                    const quantity_unit = conversion.quantity_unit || "each";
                    const quantity_type = conversion.quantity_type || "each";

                    const unit_price = quantity > 0 ? parseFloat((price / quantity).toFixed(3)) : price;

                    return {
                        "id": source + "-" + name + "-" + (product.sku || product.pk || product.id),
                        "name": name,
                        "price": price,
                        "unit_price": unit_price,
                        "quantity_unit": quantity_unit,
                        "quantity_type": quantity_type,
                        "quantity": quantity,
                        "search_term": search_term,
                        "source": source,
                    };
                };

                let filteredDataArray = [];
                if (response.data && response.data.data) {
                    const products = response.data.data;
                    for (const product of products) {
                        try {
                            const filteredObj = mapAldiProduct(product, search_term, source);
                            filteredDataArray.push(filteredObj);
                        } catch (innerError) {
                            console.error("Error processing Aldi item:", innerError.message);
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
