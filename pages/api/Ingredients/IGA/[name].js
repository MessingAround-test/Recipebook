
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
                res.status(400).json({ res: "error: " + String(err) })
            } else {
                if (req.method === "GET") {

                    await dbConnect()

                    console.log(decoded)
                    var db_id = decoded.id
                    var userData = await User.findOne({ id: db_id });
                    if (userData === {}) {
                        res.status(400).json({ res: "user not found, please relog" })
                    } else {
                        let newIngredData = await axios({
                            method: 'get',
                            url: `https://www.igashop.com.au/api/storefront/stores/52511/search?misspelling=true&q=${ingredient_name}&skip=0&sort=&take=20`
                        })
                        var filteredDataArray = []
                        let source = "IGA"
                        console.log(newIngredData)
                        // filteredDataArray = newIngredData
                        for (var ingredData in newIngredData.data.items) {
                            try {
                                if (ingredData === undefined) {
                                    continue
                                }
                                let filteredData = newIngredData.data.items[ingredData]
                                console.log(filteredData)


                                var filteredObj = {
                                    "id": source + "-" + filteredData.name + "-" + filteredData.sku,
                                    "name": filteredData.name,
                                    "price": filteredData.price.replace("$", ""),
                                    "quantity_type": filteredData.unitOfPrice.type.size,
                                    "quantity": filteredData.unitOfPrice.size,
                                    "search_term": ingredient_name,
                                    "source": source,
                                    // "extraData": filteredData

                                }
                                const response = Ingredients.create({
                                    "id": source + "-" + filteredData.name + "-" + filteredData.sku,
                                    "name": filteredData.name,
                                    "price": filteredData.price.replace("$", ""),
                                    "quantity_type": filteredData.unitOfPrice.type.size,
                                    "quantity": filteredData.unitOfPrice.size,
                                    "search_term": ingredient_name,
                                    "source": source,
                                });
                                console.log(await response);

                                filteredDataArray.push(filteredObj)
                            } catch (e){
                                console.log(e)
                            }
                            
                        }



                        res.status(200).send({ res: filteredDataArray, success: true })


                    }


                } else if (req.method === "DELETE") {
                    // await dbConnect()

                    // console.log(decoded)
                    // var db_id = decoded.id
                    // var userData = await User.findOne({ id: db_id });
                    // if (userData === {}) {
                    //     res.status(400).json({ res: "user not found, please relog" })
                    // } else {

                    //     var RecipeData = await Recipe.deleteOne({ _id: recipe_id })
                    //     res.status(200).json({ success: true, data: RecipeData, message: "Success" })
                    // }
                    res.status(400).json({ success: false, data: [], message: "Not supported request" })
                } else {
                    res.status(400).json({ success: false, data: [], message: "Not supported request" })
                }
            }
        } catch (e) {


            res
                .status(200).
                json({ success: false, res: [], message: `ERROR: ${e}` })
        }
    });






}
