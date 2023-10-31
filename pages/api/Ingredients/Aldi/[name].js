
import { secret } from "../../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../../lib/dbConnect'
import User from '../../../../models/User'
import Ingredients from '../../../../models/Ingredients'
import axios from 'axios';
import HTMLParser from 'html-to-json-parser'; 

// This one is different, its a extract and then we can query it later...
/**
 * @swagger
 * /api/Ingredients/WW/Aldi:
 *   get:
 *     description: Returns Token from Login
 *     responses:
 *       200:
 *         description: hello world
 */

export default async function handler(req, res) {



    console.log(req.query)
    var ingredient_name = req.query.name

    verify(req.query.EDGEtoken, secret, async function (err, decoded) {
        try {
            if (err) {
                return res.status(400).json({ res: "error: " + String(err) })
            } else {
                if (req.method === "GET") {
                        
                        let newIngredData = await axios({
                            method: 'get',
                            url: `https://www.aldi.com.au/en/groceries/freezer/`
                        })
                        
                        return res.status(200).send({ res: newIngredData, success: true})


                    


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
