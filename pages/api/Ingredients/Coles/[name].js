
import { secret } from "../../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../../lib/dbConnect'
import User from '../../../../models/User'
import Ingredients from '../../../../models/Ingredients'
import axios from 'axios';




export default async function handler(req, res) {



    console.log(req.query)
    var ingredient_name = req.query.name

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
                            url: `https://www.coles.com.au/_next/data/20230825.01_v3.48.0/en/search.json?q=${ingredient_name}`
                        })
                        var filteredDataArray = []
                        let source = "COLES"
                        console.log(newIngredData)
                        // filteredDataArray = newIngredData
                        for (var ingredData in newIngredData.data.pageProps.searchResults.results) {
                            if (ingredData === undefined){
                                continue
                            }
                            let filteredData = newIngredData.data.pageProps.searchResults.results[ingredData]
                            

                            var filteredObj = {
                                "id": source + "-" + filteredData.name + "-" + filteredData.id,
                                "name": filteredData.name,
                                "price": filteredData.pricing.now,
                                "quantity_type": filteredData.pricing.unit.ofMeasureUnits,
                                "quantity": filteredData.pricing.unit.quantity,
                                "search_Name": ingredient_name,
                                "source": source,
                                // "extraData": filteredData

                            }
                            const response = Ingredients.create({
                                "id": source + "-" + filteredData.name + "-" + filteredData.id,
                                "name": filteredData.name,
                                "price": filteredData.pricing.now,
                                "quantity_type": filteredData.pricing.unit.ofMeasureUnits,
                                "quantity": filteredData.pricing.unit.quantity,
                                "search_term": ingredient_name,
                                "source": source,
                            });
                            console.log(await response);

                            filteredDataArray.push(filteredObj)
                        }


                        // for (var ingredData in newIngredData.searchResults) {
                        //     var filteredData = ingredData


                        //     var filteredObj = {
                        //         "id": "COLES-" + filteredData.Name,
                        //         "name": filteredData.Name,
                        //         "price": filteredData.CupPrice,
                        //         "quantity_type": filteredData.measure || filteredData.CupMeasure,
                        //         "quantity": filteredData.measure || filteredData.CupMeasure,
                        //         "search_Name": ingredient_name,
                        //         // "SmallImageFile": filteredData.SmallImageFile,
                        //         "source": "COLES",
                        //         // "extraData": filteredData

                        //     }
                        //     const response = Ingredients.create({
                        //         "id": "COLES-" + filteredData.Name,
                        //         "name": filteredData.Name,
                        //         "price": filteredData.CupPrice,
                        //         "quantity_type": filteredData.measure || filteredData.CupMeasure,
                        //         // "quantity": filteredData.measure || filteredData.CupMeasure,
                        //         "search_Name": ingredient_name,
                        //         "source": "COLES",
                        //     });
                        //     console.log(await response);

                        //     filteredDataArray.push(filteredObj)
                        //     // console.log(filteredData)
                        // }
                        return res.status(200).send({ res: filteredDataArray, success: true})


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
