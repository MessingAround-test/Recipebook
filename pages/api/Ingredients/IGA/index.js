
import { secret } from "../../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../../lib/dbConnect'
import User from '../../../../models/User'
import Ingredients from '../../../../models/Ingredients'
import axios from 'axios';
import { convertMetricReading } from '../../../../lib/conversion'

import {filterValidEntries} from '../../../../lib/commonAPIs'


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
                    } else {
                        let newIngredData = await axios({
                            method: 'get',
                            url: `https://www.igashop.com.au/api/storefront/stores/52511/search?misspelling=true&q=${search_term}&skip=0&sort=&take=20`
                        })
                        let filteredDataArray = []
                        let source = "IGA"
                        // console.log(newIngredData)
                        // filteredDataArray = newIngredData
                        for (let ingredData in newIngredData.data.items) {
                            try {
                                if (ingredData === undefined) {
                                    continue
                                }
                                let filteredData = newIngredData.data.items[ingredData]
                                // console.log(filteredData)

                                let internal_id = filteredData.sku
                                let quantity_unit = filteredData.unitOfPrice.type.size
                                let quantity_type;
                                let name = filteredData.name
                                let price = filteredData.price.replace("$", "").replace("avg/ea", "")
                                let quantity = filteredData.unitOfPrice.size
                                
                                // If quantity type is not defined or null then extract from the name
                                if (!(quantity_unit)) {

                                    let metricConversion = convertMetricReading(name)
                                   
                                    quantity = metricConversion.quantity
                                    quantity_unit = metricConversion.quantity_unit
                                    quantity_type = metricConversion.quantity_type
                                } else {
                                    // If we get a quantity_unit, we need it converted to our format
                                    let metricConversion = convertMetricReading(quantity_unit)
                                    quantity_unit = metricConversion.quantity_unit
                                    quantity_type = metricConversion.quantity_type
                                   
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
                                // console.log(filteredObj)
                                // const response = Ingredients.create({
                                //     "id": source + "-" + name + "-" + internal_id,
                                //     "name": name,
                                //     "price": price,
                                //     "unit_price": unit_price,
                                //     "quantity_unit": quantity_unit,
                                //     "quantity_type": quantity_type,
                                //     "quantity": quantity,
                                //     "search_term": search_term,
                                //     "source": source,
                                // });
                                // console.log(await response);

                                filteredDataArray.push(filteredObj)
                            } catch (e) {
                                console.log(e)
                            }

                        }
                        
                        
                        let validatedEntries = await filterValidEntries(filteredDataArray, search_term, req.query.EDGEtoken)
                        for (let ingredient of validatedEntries){
                            let response = await Ingredients.create({
                                "id": ingredient.id,
                                "name": ingredient.name,
                                "price": ingredient.price,
                                "unit_price": ingredient.unit_price,
                                "quantity_unit": ingredient.quantity_unit,
                                "quantity_type": ingredient.quantity_type,
                                "quantity": ingredient.quantity,
                                "search_term": ingredient.search_term,
                                "source": ingredient.source,
                            });
                        }


                        return res.status(200).send({ res: validatedEntries, success: true })


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
