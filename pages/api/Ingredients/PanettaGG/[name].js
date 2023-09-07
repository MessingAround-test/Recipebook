
import { secret } from "../../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../../lib/dbConnect'
import User from '../../../../models/User'
import Ingredients from '../../../../models/Ingredients'
import axios from 'axios';




export default async function handler(req, res) {

    function getIndicesOf(searchStr, str, caseSensitive) {
        // console.log(searchStr)
        // let matches =  [searchStr.matchAll(new RegExp("/(.*)/sU", "g"))]
        // console.log(matches)
        // return matches
        const regexp = new RegExp(str, "g");


        const array = [...searchStr.matchAll(regexp)];
        return array
        // .map(a => a.index)
        // 
    }

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
                            url: `https://panettamercato.com.au/?s=${ingredient_name}&post_type=product`
                        })
                        var filteredDataArray = []
                        let source = "Panetta"
                        console.log(newIngredData)
                        let startIndex = newIngredData.data.indexOf("/var pysOptions =/g")
                        // let finishIndex = newIngredData.data.indexOf("/* ]]> */")

                        let matchedIngredData = getIndicesOf(String(newIngredData.data), "var pysOptions =.*", true)
                        let json_data = JSON.parse(String(matchedIngredData).replace("var pysOptions =", "").replace(";", ""))
                        console.log(Object.keys(json_data))
                        json_data = json_data.staticEvents.ga.woo_view_item_list_search

                        if (json_data.length > 0) {
                            let item_list = json_data[0].params.items
                            for (var ingredData in item_list) {
                                try {
                                    if (ingredData === undefined) {
                                        continue
                                    }
                                    let filteredData = item_list[ingredData]
                                    console.log(filteredData)


                                    var filteredObj = {
                                        "id": source + "-" + filteredData.name + "-" + filteredData.id,
                                        "name": filteredData.name,
                                        "price": filteredData.price,
                                        "quantity_type": undefined,
                                        "quantity": undefined,
                                        "search_term": ingredient_name,
                                        "source": source,
                                        // "extraData": filteredData

                                    }
                                    const response = Ingredients.create({
                                        "id": source + "-" + filteredData.name + "-" + filteredData.id,
                                        "name": filteredData.name,
                                        "price": filteredData.price,
                                        "quantity_type": undefined,
                                        "quantity": undefined,
                                        "search_term": ingredient_name,
                                        "source": source,
                                        // "extraData": filteredData
                                    });
                                    console.log(await response);

                                    filteredDataArray.push(filteredObj)
                                } catch (e) {
                                    console.log(e)
                                }

                            }
                        }



                        // newIngredData = newIngredData.data.substring(startIndex, finishIndex);

                        // filteredDataArray = newIngredData




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
