
import { secret } from "../../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../../lib/dbConnect'
import User from '../../../../models/User'
import Ingredients from '../../../../models/Ingredients'
import axios from 'axios';

import {filterValidEntries} from '../../../../lib/commonAPIs'

import { convertMetricReading } from '../../../../lib/conversion'


export default async function handler(req, res) {
    function getIndicesOf(searchStr, str, caseSensitive) {
        const regexp = new RegExp(str, "g");
        const array = [...searchStr.matchAll(regexp)];
        return array
    }
    let search_term = req.query.name
    verify(req.query.EDGEtoken, secret, async function (err, decoded) {
        try {
            if (err) {
                return res.status(400).json({ res: "error: " + String(err) })
            } else {
                if (req.method === "GET") {

                    await dbConnect()


                    let db_id = decoded.id
                    let userData = await User.findOne({ id: db_id });
                    if (userData.id === undefined) {
                        return res.status(400).json({ res: "user not found, please relog" })
                    } else {
                        let newIngredData = await axios({
                            method: 'get',
                            url: `https://panettamercato.com.au/?s=${search_term}&post_type=product`
                        })
                        let filteredDataArray = []
                        let source = "Panetta"
                        // let finishIndex = newIngredData.data.indexOf("/* ]]> */")
                        
                        let matchedIngredData = getIndicesOf(String(newIngredData.data), "pysOptions =.*", true)
                        let json_data = JSON.parse(String(matchedIngredData).replace("pysOptions =", "").replace(";", ""))

                        json_data = json_data.staticEvents.ga.woo_view_item_list_search

                        if (json_data.length > 0) {
                            let item_list = json_data[0].params.items
                            for (let ingredData in item_list) {
                                try {
                                    if (ingredData === undefined) {
                                        continue
                                    }
                                    let filteredData = item_list[ingredData]
                                    

                                    let internal_id = filteredData.id

                                    // Previous def of quantity_unit
                                    // filteredData.measure || filteredData.CupMeasure

                                    let name = filteredData.name
                                    let price = filteredData.price
                                    
                                    // Always extract out of name.. 
                                    let quantity = 1
                                    let quantity_unit = undefined

                                    // With woolies they put the quantity type in here for some weird reason
                                    //console.log(quantity)
                                    //console.log(quantity_unit)
                                    // If quantity type is not defined or null then extract from the name
                                    let quantity_type;
                                    if (!(quantity_unit)) {
                                        let metricConversion = convertMetricReading(name)
                                        //console.log(metricConversion)
                                        quantity = metricConversion.quantity
                                        quantity_unit = metricConversion.quantity_unit
                                        quantity_type = metricConversion.quantity_type
                                    } else {
                                        // If we get a quantity_unit, we need it converted to our format
                                        let metricConversion = convertMetricReading(quantity_unit)
                                        quantity_unit = metricConversion.quantity_unit
                                        quantity_type = metricConversion.quantity_type
                                        //console.log(metricConversion)
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

                                    // Have a look at .MaxSupplyLimitMessage pretty weird
                                    //console.log(filteredObj)
                                    // let response = Ingredients.create({
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

                                    
                                    filteredDataArray.push(filteredObj)
                                } catch (e) {
                                    console.log(e)
                                }

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



                        // newIngredData = newIngredData.data.substring(startIndex, finishIndex);

                        // filteredDataArray = newIngredData




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
