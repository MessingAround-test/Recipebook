
import { secret } from "../../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../../lib/dbConnect'
import User from '../../../../models/User'
import Ingredients from '../../../../models/Ingredients'
import axios from 'axios';
import { convertMetricReading } from '../../../../lib/conversion'


export default async function handler(req, res) {



    console.log(req.query)
    let search_term = req.query.name

    verify(req.query.EDGEtoken, secret, async function (err, decoded) {
        try {
            if (err) {
                return res.status(400).json({ res: "error: " + String(err) })
            } else {
                if (req.method === "GET") {

                    await dbConnect()

                    console.log(decoded)
                    let db_id = decoded.id
                    let userData = await User.findOne({ id: db_id });
                    if (userData.id === undefined) {
                        return res.status(400).json({ res: "user not found, please relog" })
                    } else if (search_term === "" || search_term === undefined){
                        return res.status(400).json({ res: "Search term cannot be empty" })
                    } else {
                        
                        let newIngredData = await axios({
                            method: 'get',
                            url: `https://www.coles.com.au/_next/data/20240119.01_v3.64.0/en/search.json?q=${search_term}`
                        })
                        let filteredDataArray = []
                        let source = "Coles"
                        // console.log(newIngredData.data)
                        // filteredDataArray = newIngredData
                        for (let ingredData in newIngredData.data.pageProps.searchResults.results) {
                            try {
                                if (ingredData === undefined){
                                    continue
                                }
                                
                                // only include the first 10 coles results... they get wacky after that
                                if (ingredData > 10){
                                    break
                                }
                                let filteredData = newIngredData.data.pageProps.searchResults.results[ingredData]
                                
    
                                if (ingredData === undefined) {
                                    continue
                                }
                                // console.log(filteredData)

                                let internal_id = filteredData.id
                                let quantity_unit = filteredData.pricing.unit.ofMeasureUnits
                                let quantity_type;
                                let name = filteredData.name
                                let price = filteredData.pricing.now
                                let quantity = filteredData.pricing.unit.quantity
                                
                                // If quantity type is not defined or null then extract from the name
                                if (!(quantity_unit)) {

                                    let metricConversion = convertMetricReading(name)
                                    console.log(metricConversion)
                                    quantity = metricConversion.quantity
                                    quantity_unit = metricConversion.quantity_unit
                                    quantity_type = metricConversion.quantity_type
                                } else {
                                    // If we get a quantity_unit, we need it converted to our format
                                    let metricConversion = convertMetricReading(quantity_unit)
                                    quantity_unit = metricConversion.quantity_unit
                                    quantity_type = metricConversion.quantity_type
                                    console.log(metricConversion)
                                    // If the quantity returned is not 1, then multiply it by the quantity
                                    if (metricConversion.quantity !== 1) {
                                        quantity = quantity * metricConversion.quantity
                                    }
                                }
                                let unit_price =  parseFloat((price/quantity).toFixed(3))
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
                                    // "extraData": filteredData

                                }
                                console.log(filteredObj)
                                const response = Ingredients.create({
                                    "id": source + "-" + name + "-" + internal_id,
                                    "name": name,
                                    "price": price,
                                    "unit_price": unit_price,
                                    "quantity_unit": quantity_unit,
                                    "quantity_type": quantity_type,
                                    "quantity": quantity,
                                    "search_term": search_term,
                                    "source": source,
                                });
                                // console.log(await response);

                                filteredDataArray.push(filteredObj)
                            } catch (e) {
                                console.log(e)
                            }

                        }



                        return res.status(200).send({ res: filteredDataArray, success: true })


                    }


                } else if (req.method === "DELETE") {
                    // await dbConnect()

                    // console.log(decoded)
                    // let db_id = decoded.id
                    // let userData = await User.findOne({ id: db_id });
                    // if (userData === {}) {
                    //     return res.status(400).json({ res: "user not found, please relog" })
                    // } else {

                    //     let RecipeData = await Recipe.deleteOne({ _id: recipe_id })
                    //     return res.status(200).json({ success: true, data: RecipeData, message: "Success" })
                    // }
                    return res.status(400).json({ success: false, data: [], message: "Not supported request" })
                } else {
                    return res.status(400).json({ success: false, data: [], message: "Not supported request" })
                }
            }
        } catch (e) {


            res
                .status(200).
                json({ success: false, res: [], message: `ERROR: ${e}` })
        }
    });






}
