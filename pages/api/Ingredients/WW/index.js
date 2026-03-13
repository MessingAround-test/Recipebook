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
                    url: `https://www.woolworths.com.au/apis/ui/v2/Search/products?searchTerm=${search_term}`,
                    headers: {
                        'User-Agent': 'PostmanRuntime/7.28.4',
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': 'https://www.woolworths.com.au'
                    }
                })
            } catch (searchError) {
                throw searchError;
            }

            let filteredDataArray = []

            if (response.data && response.data.Products) {
                for (let productGroup of response.data.Products) {
                    if (!productGroup.Products || productGroup.Products.length === 0) continue;

                    let filteredData = productGroup.Products[0]
                    let internal_id = filteredData.Stockcode || ""
                    let name = filteredData.Name

                    // Woolworths API: price is typically the package price, CupPrice is comparison price
                    let price = filteredData.Price || filteredData.price
                    let quantity_unit = filteredData.PackageSize || filteredData.measure || filteredData.CupMeasure
                    let quantity = 1
                    let quantity_type = "each"

                    if (price !== undefined && price !== null) {
                        // We have a package price. Try to find the package size.
                        // 1. Try name first as it often contains the most explicit "2kg" etc.
                        let nameConversion = convertMetricReading(name)
                        if (nameConversion.quantity !== 1 || nameConversion.quantity_unit !== 'each') {
                            quantity = nameConversion.quantity
                            quantity_unit = nameConversion.quantity_unit
                            quantity_type = nameConversion.quantity_type
                        } else if (quantity_unit) {
                            // 2. Fallback to package size field
                            let unitConversion = convertMetricReading(quantity_unit)
                            quantity = unitConversion.quantity
                            quantity_unit = unitConversion.quantity_unit
                            quantity_type = unitConversion.quantity_type
                        }
                    } else if (filteredData.CupPrice !== undefined) {
                        // Fallback to unit/comparison price if package price is missing
                        price = filteredData.CupPrice
                        quantity_unit = filteredData.CupMeasure || "1 each"
                        let unitConversion = convertMetricReading(quantity_unit)
                        quantity = unitConversion.quantity
                        quantity_unit = unitConversion.quantity_unit
                        quantity_type = unitConversion.quantity_type
                    }

                    // Safety check to avoid division by zero
                    let unit_price = quantity > 0 ? parseFloat((price / quantity).toFixed(3)) : price

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

            // Log successful search and get conversion

            return res.status(200).send({ "res": validatedEntries, success: true })

        } else {
            return res.status(405).json({ success: false, message: "Method Not Allowed" })
        }
    } catch (error) {
        console.error("WW API Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error in WW API: " + error.message });
    }
}
