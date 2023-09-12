
import { secret } from "../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import Ingredients from '../../../models/Ingredients'
import axios from 'axios';

export default async function handler(req, res) {
    if (req.method === "GET") {
        var ingredient_name = req.query.name
        console.log('WE CAME HERE')
        console.log(ingredient_name)
        

        let IngredData = await Ingredients.find({}).exec()
        res.status(200).send({ res: IngredData })
    } else if (req.method === "DELETE") {
        let IngredData = await Ingredients.deleteMany({}).exec()
        res.status(200).json({ success: true, data: IngredData, message: "Success" })
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
        // res.status(400).json({ success: false, data: [], message: "Not supported request" })
    } else {
        res.status(400).json({ success: false, data: [], message: "Not supported request" })
        
    }
}







