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
            } else {
                const source = "IGA";
                const existingIngredients = await Ingredients.find({
                    search_term: search_term.toLowerCase(),
                    source: source
                }).lean().exec();

                if (existingIngredients.length > 0) {
                    return res.status(200).json({ res: existingIngredients, success: true, from_db: true });
                }

                const response = await axios({
                    method: 'get',
                    url: `https://www.igashop.com.au/api/storefront/stores/52511/search?misspelling=true&q=${search_term}&skip=0&sort=&take=20`,
                    headers: {
                        'User-Agent': 'PostmanRuntime/7.28.4',
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': 'https://www.igashop.com.au'
                    }
                })

                let filteredDataArray = []

                if (response.data && response.data.items) {
                    for (let ingredData in response.data.items) {
                        try {
                            let filteredData = response.data.items[ingredData]
                            if (!filteredData) continue;

                            let internal_id = filteredData.sku
                            let quantity_unit = filteredData.unitOfPrice?.type?.size
                            let quantity_type;
                            let name = filteredData.name
                            let priceString = filteredData.price?.replace("$", "").replace("avg/ea", "")
                            let price = parseFloat(priceString)
                            let quantity = filteredData.unitOfPrice?.size || 1

                            if (!(quantity_unit)) {
                                let metricConversion = convertMetricReading(name)
                                quantity = metricConversion.quantity
                                quantity_unit = metricConversion.quantity_unit
                                quantity_type = metricConversion.quantity_type
                            } else {
                                let metricConversion = convertMetricReading(quantity_unit)
                                quantity_unit = metricConversion.quantity_unit
                                quantity_type = metricConversion.quantity_type
                                if (metricConversion.quantity !== 1) {
                                    quantity = quantity * metricConversion.quantity
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
                            console.error("Error processing IGA item:", innerError.message);
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

                return res.status(200).send({ res: validatedEntries, success: true })
            }
        } else {
            return res.status(405).json({ success: false, message: "Method Not Allowed" })
        }
    } catch (error) {
        console.error("IGA API Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error in IGA API: " + error.message });
    }
}
