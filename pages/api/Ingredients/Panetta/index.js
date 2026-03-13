import { verifyToken } from "../../../../lib/auth.ts";
import { logAPI } from '../../../../lib/logger.ts';
import dbConnect from '../../../../lib/dbConnect'
import User from '../../../../models/User'
import Ingredients from '../../../../models/Ingredients'
import axios from 'axios';
import { filterValidEntries } from '../../../../lib/commonAPIs'
import { convertMetricReading } from '../../../../lib/conversion'

export default async function handler(req, res) {
    function getIndicesOf(searchStr, str, caseSensitive) {
        const regexp = new RegExp(str, "g");
        const array = [...searchStr.matchAll(regexp)];
        return array
    }
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
                const source = "Panetta";
                const existingIngredients = await Ingredients.find({
                    search_term: search_term.toLowerCase(),
                    source: source
                }).lean().exec();

                if (existingIngredients.length > 0) {
                    return res.status(200).json({ res: existingIngredients, success: true, from_db: true });
                }

                const response = await axios({
                    method: 'get',
                    url: `https://panettamercato.com.au/?s=${search_term}&post_type=product`,
                    headers: {
                        'User-Agent': 'PostmanRuntime/7.28.4',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': 'https://panettamercato.com.au'
                    }
                })

                let filteredDataArray = []

                let matchedIngredData = getIndicesOf(String(response.data), "pysOptions =.*", true)
                if (matchedIngredData.length > 0) {
                    let json_text = String(matchedIngredData[0]).replace("pysOptions =", "").replace(";", "")
                    let json_data = JSON.parse(json_text)
                    json_data = json_data?.staticEvents?.ga?.woo_view_item_list_search

                    if (json_data && json_data.length > 0) {
                        let item_list = json_data[0]?.params?.items || []
                        for (let ingredData in item_list) {
                            try {
                                let filteredData = item_list[ingredData]
                                if (!filteredData) continue;

                                let internal_id = filteredData.id
                                let name = filteredData.name
                                let price = filteredData.price
                                let quantity = 1
                                let quantity_unit = undefined
                                let quantity_type;

                                let metricConversion = convertMetricReading(name)
                                quantity = metricConversion.quantity
                                quantity_unit = metricConversion.quantity_unit
                                quantity_type = metricConversion.quantity_type

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
                                console.error("Error processing Panetta item:", innerError.message);
                            }
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

                return res.status(200).send({ res: validatedEntries, success: true, count: validatedEntries.length })
            }
        } else {
            return res.status(405).json({ success: false, message: "Method Not Allowed" })
        }
    } catch (error) {
        console.error("Panetta API Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error in Panetta API: " + error.message });
    }
}
