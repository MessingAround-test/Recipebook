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
            }

            const source = "WW";
            const existingIngredients = await Ingredients.find({
                search_term: search_term.toLowerCase(),
                source: source
            }).lean().exec();

            if (existingIngredients.length > 0) {
                return res.status(200).json({ res: existingIngredients, success: true, from_db: true });
            }

            const response = await axios({
                method: 'get',
                url: `https://www.woolworths.com.au/apis/ui/v2/Search/products?searchTerm=${search_term}`,
                headers: {
                    'User-Agent': 'PostmanRuntime/7.28.4',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.woolworths.com.au'
                }
            })

            let filteredDataArray = []

            if (response.data && response.data.Products) {
                for (let ingredData in response.data.Products) {
                    let productGroup = response.data.Products[ingredData]
                    if (!productGroup.Products || productGroup.Products.length === 0) continue;

                    let filteredData = productGroup.Products[0]
                    let internal_id = ""
                    let name = filteredData.Name
                    let price = filteredData.price || filteredData.CupPrice
                    let quantity = 1
                    let quantity_unit = filteredData.measure || filteredData.CupMeasure
                    let quantity_type;

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
                }
            }

            let validatedEntries = await filterValidEntries(filteredDataArray, search_term, req.headers.edgetoken || req.query.EDGEtoken)
            for (let ingredient of validatedEntries) {
                await Ingredients.findOneAndUpdate(
                    { id: ingredient.id },
                    {
                        "id": ingredient.id,
                        "name": ingredient.name,
                        "price": ingredient.price,
                        "unit_price": ingredient.unit_price,
                        "quantity_unit": ingredient.quantity_unit,
                        "quantity_type": ingredient.quantity_type,
                        "quantity": ingredient.quantity,
                        "search_term": ingredient.search_term,
                        "source": ingredient.source,
                    },
                    { upsert: true }
                );
            }
            return res.status(200).send({ "res": validatedEntries, success: true })

        } else {
            return res.status(405).json({ success: false, message: "Method Not Allowed" })
        }
    } catch (error) {
        console.error("WW API Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error in WW API: " + error.message });
    }
}
