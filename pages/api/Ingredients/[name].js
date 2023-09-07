
import { secret } from "../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import Ingredients from '../../../models/Ingredients'
import axios from 'axios';

export default async function handler(req, res) {
    console.log(req.query)
    var ingredient_name = req.query.name
    var supplier = req.query.supplier
    console.log(ingredient_name)
    if (req.method === "GET") {
        if (ingredient_name === "") {
            let IngredData = await Ingredients.find({}).exec()
            res.status(200).send({ res: IngredData })
        } else {
            // let IngredData = []
            let search_query = { search_term: ingredient_name }
            if (supplier !== undefined){
                search_query["source"] = supplier
            }
            let IngredData = await Ingredients.find(search_query).exec()

            // IngredData.concat(await Ingredients.find({ $text: { $search: ingredient_name } }, { score: { $meta: "textScore" } }).exec())
            // If we havent already extracted it, then we want to extract it from the source systems
            console.log("MADE IT")
            console.log(IngredData)
            if (IngredData.length == 0) {
                let allIngredData = []
                let companies = ["WW", "Coles", "IGA", "PanettaGG"]
                if (supplier !== undefined){
                    companies= [supplier]
                }
                
                for (let supplierIndex in companies) {
                    let supplier = companies[supplierIndex]
                    console.log(`http://localhost:8080/api/Ingredients/${supplier}/${ingredient_name}?EDGEtoken=${req.query.EDGEtoken}`)
                    let newIngredData = await axios({
                        method: 'get',
                        url: `http://localhost:8080/api/Ingredients/${supplier}/${ingredient_name}?EDGEtoken=${req.query.EDGEtoken}`,
                    })
                    // console.log(newIngredData)
                    if (newIngredData.data.success === true) {
                        allIngredData = [...allIngredData, ...newIngredData.data.res]
                    } else {
                        console.log(newIngredData)
                    }

                }

                res.status(200).send({ res: allIngredData })
            } else {
                res.status(200).send({ res: IngredData })
            }
        }
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







