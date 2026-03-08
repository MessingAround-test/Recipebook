import Ingredients from '../../../models/Ingredients'
import axios from 'axios';
import { filter } from '../../../lib/filtering'
import { convertMetricReading } from '../../../lib/conversion'
import dbConnect from '../../../lib/dbConnect'
import { verify } from "jsonwebtoken";
import { secret } from "../../../lib/dbsecret"
import User from '../../../models/User'


export default async function handler(req, res) {
    try {
        let search_term = req.query.name
        if (search_term !== undefined) {
            search_term = search_term.toLowerCase()
        }

        if (req.method === "GET") {
            let qType = req.query.qType
            if (qType !== undefined && qType !== "any") {
                qType = convertMetricReading(qType).quantity_unit
            } else {
                qType = undefined
            }

            let supplier = req.query.supplier

            let filterDetails = {
                "search_term": search_term,
                "supplier": supplier,
                "optionSort": req.query.sort,
                "returnN": req.query.returnN,
                "quantity_unit": qType,
                "quantity": req.query.quantity
            }

            if (search_term === "" || search_term === undefined) {
                let IngredData = await Ingredients.find({}).exec()
                return res.status(200).send({ res: IngredData })
            } else {
                let search_query = { search_term: search_term }
                let companies = ["WW", "IGA", "Panetta", "Aldi", "Coles"]
                const supplierParam = req.query.supplier;

                if (supplierParam !== undefined) {
                    if (supplierParam.includes(',')) {
                        companies = supplierParam.split(',');
                    } else if (Array.isArray(supplierParam) && supplierParam.length === 0) {
                        // Do nothing
                    } else {
                        companies = [supplierParam]
                    }
                    search_query["source"] = { "$in": companies }
                }

                let IngredData = await Ingredients.find(search_query).exec()
                if (IngredData.length == 0) {
                    let allIngredData = []
                    companies = ["WW", "IGA", "Panetta", "Aldi", "Coles"]

                    for (let supplierIndex in companies) {
                        try {
                            let supplierName = companies[supplierIndex]
                            let newIngredData = await axios({
                                method: 'get',
                                url: `http://localhost:8080/api/Ingredients/${supplierName}/?name=${search_term}&EDGEtoken=${req.query.EDGEtoken}`,
                            })

                            if (newIngredData.data.success === true && newIngredData.data.res.length > 0) {
                                allIngredData = [...allIngredData.concat(newIngredData.data.res)]
                            }
                        } catch (error) {
                            console.error(`API Call to ${companies[supplierIndex]} failed:`, error.message)
                        }
                    }
                    let filteredIngredData = filter(allIngredData, filterDetails)
                    return res.status(200).send({ success: true, res: filteredIngredData, "loadedSource": true })
                } else {
                    let filteredIngredData = filter(IngredData, filterDetails)
                    return res.status(200).send({ success: true, res: filteredIngredData, "loadedSource": false })
                }
            }
        } else if (req.method === "DELETE") {
            return new Promise((resolve, reject) => {
                verify(req.query.EDGEtoken, secret, async function (err, decoded) {
                    try {
                        if (err) {
                            res.status(401).json({ success: false, message: "Unauthorized: " + err.message });
                            return resolve();
                        }

                        let id = req.query.id
                        let IngredData;
                        await dbConnect()

                        let db_id = decoded.id
                        let userData = await User.findOne({ id: db_id });

                        if (!userData) {
                            res.status(404).json({ success: false, message: "User not found" });
                            return resolve();
                        }

                        if (id !== undefined && id !== "") {
                            IngredData = await Ingredients.deleteOne({ _id: id }).exec()
                        } else if (search_term !== undefined && search_term !== "") {
                            IngredData = await Ingredients.deleteMany({ search_term: search_term }).exec()
                        } else {
                            if (userData.role !== "admin") {
                                return res.status(403).json({ success: false, message: "Insufficient Privileges" });
                            } else {
                                IngredData = await Ingredients.deleteMany({}).exec()
                            }
                        }

                        res.status(200).json({ success: true, data: IngredData, message: "Success" })
                        resolve();
                    } catch (error) {
                        res.status(500).json({ success: false, message: "Internal Server Error in DELETE: " + error.message });
                        resolve();
                    }
                });
            });
        } else {
            res.status(405).json({ success: false, message: "Method Not Allowed" })
        }
    } catch (error) {
        console.error("API Error in /api/Ingredients:", error);
        res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}
