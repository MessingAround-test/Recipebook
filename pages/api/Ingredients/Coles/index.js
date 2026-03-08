import { secret } from "../../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../../lib/dbConnect'
import User from '../../../../models/User'
import Ingredients from '../../../../models/Ingredients'
import axios from 'axios';
import { convertMetricReading } from '../../../../lib/conversion'

export default async function handler(req, res) {
    let search_term = req.query.name

    return new Promise((resolve, reject) => {
        verify(req.query.EDGEtoken, secret, async function (err, decoded) {
            try {
                if (err) {
                    res.status(401).json({ success: false, message: "Unauthorized: " + err.message });
                    return resolve();
                }

                if (req.method === "GET") {
                    await dbConnect()

                    let db_id = decoded.id
                    let userData = await User.findOne({ id: db_id });
                    if (!userData || userData.id === undefined) {
                        res.status(400).json({ success: false, message: "User not found, please relog" })
                        return resolve();
                    } else if (!search_term) {
                        res.status(400).json({ success: false, message: "Search term cannot be empty" })
                        return resolve();
                    } else {
                        const response = await axios({
                            method: 'get',
                            url: `https://www.coles.com.au/_next/data/20240119.01_v3.64.0/en/search.json?q=${search_term}`,
                            headers: {
                                'User-Agent': 'PostmanRuntime/7.28.4',
                                'Accept': 'application/json, text/plain, */*',
                                'Accept-Language': 'en-US,en;q=0.9',
                                'Referer': 'https://www.coles.com.au'
                            }
                        })

                        let filteredDataArray = []
                        let source = "Coles"

                        if (response.data && response.data.pageProps && response.data.pageProps.searchResults && response.data.pageProps.searchResults.results) {
                            let results = response.data.pageProps.searchResults.results
                            // Limit to first 10 results for Coles
                            for (let i = 0; i < Math.min(results.length, 10); i++) {
                                try {
                                    let filteredData = results[i]
                                    if (!filteredData) continue;

                                    let internal_id = filteredData.id
                                    let quantity_unit = filteredData.pricing?.unit?.ofMeasureUnits
                                    let quantity_type;
                                    let name = filteredData.name
                                    let price = filteredData.pricing?.now
                                    let quantity = filteredData.pricing?.unit?.ofMeasureQuantity || 1

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

                                    await Ingredients.findOneAndUpdate(
                                        { id: filteredObj.id },
                                        filteredObj,
                                        { upsert: true }
                                    );
                                    filteredDataArray.push(filteredObj)
                                } catch (innerError) {
                                    console.error("Error processing Coles item:", innerError.message);
                                }
                            }
                        }
                        res.status(200).send({ res: filteredDataArray, success: true })
                        resolve();
                    }
                } else {
                    res.status(405).json({ success: false, message: "Method Not Allowed" })
                    resolve();
                }
            } catch (error) {
                console.error("Coles API Error:", error);
                res.status(500).json({ success: false, message: "Internal Server Error in Coles API: " + error.message });
                resolve();
            }
        });
    });
}
