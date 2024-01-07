
import { secret } from "../../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../../lib/dbConnect'
import User from '../../../../models/User'
import Ingredients from '../../../../models/Ingredients'
import axios from 'axios';

export default async function handler(req, res) {



    //console.log(req.query)
    var search_term = req.query.name

    verify(req.query.EDGEtoken, secret, async function (err, decoded) {
        try {
            if (err) {
                //console.log(err)
                return res.status(400).json({ res: "error: " + String(err) })
            } else {
                if (req.method === "GET") {

                    await dbConnect()

                    //console.log(decoded)
                    var db_id = decoded.id
                    var userData = await User.findOne({ id: db_id });
                    if (userData == {}) {
                        return res.status(400).json({ res: "user not found, please relog" })
                    } else {

                        // Get out of the ALdi DB
                        let allIngreds = await AldiIngredient.find({}).lean().exec()
                        //console.log(allIngreds)
                        //console.log("SEARCH TERM =")
                        //console.log(search_term)
                        let matchedProducts = findMatches(search_term, allIngreds);
                        //console.log("Matches:", matchedProducts);
                        var filteredDataArray = []
                        let source = "Aldi"
                        //console.log(matchedProducts)
                        // filteredDataArray = newIngredData
                        for (let ingredData in matchedProducts) {
                            
                            
                            let filteredData = matchedProducts[ingredData]
                            let name = filteredData.name
                            let internal_id = filteredData.id
                            let quantity_unit = filteredData.quantity_unit
                            let quantity_type = filteredData.quantity_type
                            let unit_price = filteredData.unit_price
                            let price = filteredData.price
                            let quantity = filteredData.quantity

                            var filteredObj = {
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
                            //console.log(filteredObj)
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
                            //console.log("BEORE CREATE")
                            //console.log(await response);


                            filteredDataArray.push(filteredObj)
                        }
                        //console.log(filteredDataArray)
                        return res.status(200).send({ data: filteredDataArray, success: true })


                    }


                } else if (req.method === "DELETE") {
                    // await dbConnect()

                    // //console.log(decoded)
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
