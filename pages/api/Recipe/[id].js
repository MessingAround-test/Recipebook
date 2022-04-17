
import { secret } from "../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import Recipe from '../../../models/Recipe'





export default async function handler(req, res) {
    console.log(req.query)
   var recipe_id= req.query.id
    
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

          var RecipeData = await Recipe.findOne({_id: recipe_id})
          res.status(200).json({ res: RecipeData})
        }
      
      
      } else if (req.method === "DELETE") {
        await dbConnect()

        console.log(decoded)
        var db_id = decoded.id
        var userData = await User.findOne({ id: db_id });
        if (userData === {}) {
          res.status(400).json({ res: "user not found, please relog" })
        } else {

          var RecipeData = await Recipe.deleteOne({_id: recipe_id})
          res.status(200).json({ success: true, data: RecipeData, message: "Success"})
        }
      }else {
        res.status(400).json({ success: false, data: [], message: "Not supported request"})
      }
    }
  });





}
