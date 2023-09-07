
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
                        url: `https://www.woolworths.com.au/apis/ui/v2/Search/products?searchTerm=${ingredient_name}`
                    })
                    var filteredDataArray = []


                    for (var ingredData in newIngredData.data.Products) {
                        var filteredData = newIngredData.data.Products[ingredData].Products[0]


                        var filteredObj = {
                            "id": "WW-" + filteredData.Name,
                            "name": filteredData.Name,
                            "price": filteredData.CupPrice,
                            "quantity_type": filteredData.measure || filteredData.CupMeasure,
                            "quantity": filteredData.measure || filteredData.CupMeasure,
                            "search_Name": ingredient_name,
                            // "SmallImageFile": filteredData.SmallImageFile,
                            "source": "WW",
                            // "extraData": filteredData

                        }
                        const response = Ingredients.create({
                            "id": "WW-" + filteredData.Name,
                            "name": filteredData.Name,
                            "price": filteredData.CupPrice,
                            "quantity_type": filteredData.measure || filteredData.CupMeasure,
                            // "quantity": filteredData.measure || filteredData.CupMeasure,
                            "search_term": ingredient_name,
                            "source": "WW",
                        });
                        console.log(await response);

                        filteredDataArray.push(filteredObj)
                        // console.log(filteredData)
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
                res.status(400).json({ success: false, res: [], message: "Not supported request" })
            } else {
                res.status(400).json({ success: false, res: [], message: "Not supported request" })
            }
        }
    });





}
