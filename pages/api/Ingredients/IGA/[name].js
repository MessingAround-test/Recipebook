
import { secret } from "../../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../../lib/dbConnect'
import User from '../../../../models/User'
import Ingredients from '../../../../models/Ingredients'
import axios from 'axios';
import {convertMetricReading} from '../../../../lib/conversion'


export default async function handler(req, res) {



    console.log(req.query)
    var search_term = req.query.name

    verify(req.query.EDGEtoken, secret, async function (err, decoded) {
        try {
            if (err) {
                return res.status(400).json({ res: "error: " + String(err) })
            } else {
                if (req.method === "GET") {

                    await dbConnect()

                    console.log(decoded)
                    var db_id = decoded.id
                    var userData = await User.findOne({ id: db_id });
                    if (userData === {}) {
                        return res.status(400).json({ res: "user not found, please relog" })
                    } else {
                        let newIngredData = await axios({
                            method: 'get',
                            url: `https://www.igashop.com.au/api/storefront/stores/52511/search?misspelling=true&q=${search_term}&skip=0&sort=&take=20`
                        })
                        var filteredDataArray = []
                        let source = "IGA"
                        // console.log(newIngredData)
                        // filteredDataArray = newIngredData
                        for (var ingredData in newIngredData.data.items) {
                            try {
                                if (ingredData === undefined) {
                                    continue
                                }
                                let filteredData = newIngredData.data.items[ingredData]
                                // console.log(filteredData)
                                
                                let internal_id = filteredData.sku
                                let quantity_type = filteredData.unitOfPrice.type.size
                                let name = filteredData.name
                                let price = filteredData.price.replace("$", "").replace("avg/ea", "")
                                let quantity = filteredData.unitOfPrice.size
                                // If quantity type is not defined or null then extract from the name
                                if (!(quantity_type)){
                                    
                                    let metricConversion = convertMetricReading(name)
                                    console.log(metricConversion)
                                    quantity = metricConversion.quantity
                                    quantity_type = metricConversion.quantity_type
                                } else {
                                    // If we get a quantity_type, we need it converted to our format
                                    let metricConversion = convertMetricReading(quantity_type)
                                    quantity_type = metricConversion.quantity_type
                                    console.log(metricConversion)
                                    // If the quantity returned is not 1, then multiply it by the quantity
                                    if (metricConversion.quantity !== 1){
                                        quantity = quantity * metricConversion.quantity
                                    }
                                }
                                
                                var filteredObj = {
                                    "id": source + "-" + name + "-" +internal_id ,
                                    "name": name,
                                    "price": price ,
                                    "quantity_type": quantity_type,
                                    "quantity": quantity,
                                    "search_term": search_term,
                                    "source": source,
                                    // "extraData": filteredData

                                }
                                console.log(filteredObj)
                                const response = Ingredients.create({
                                    "id": source + "-" + name + "-" +internal_id ,
                                    "name": name,
                                    "price": price ,
                                    "quantity_type": quantity_type,
                                    "quantity": quantity,
                                    "search_term": search_term,
                                    "source": source,
                                });
                                // console.log(await response);

                                filteredDataArray.push(filteredObj)
                            } catch (e){
                                console.log(e)
                            }
                            
                        }



                        return res.status(200).send({ res: filteredDataArray, success: true })


                    }


                } else if (req.method === "DELETE") {
                    // await dbConnect()

                    // console.log(decoded)
                    // var db_id = decoded.id
                    // var userData = await User.findOne({ id: db_id });
                    // if (userData === {}) {
                    //     return res.status(400).json({ res: "user not found, please relog" })
                    // } else {

                    //     var RecipeData = await Recipe.deleteOne({ _id: recipe_id })
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
