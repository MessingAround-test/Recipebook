
import { secret } from "../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import Recipe from '../../../models/Recipe'
import { getShorthandForMeasure } from '../../../lib/conversion'

function convertIngredients(originalObject) {

  return originalObject.map(item => ({
    "_id": item._id,
    "name": item.Name,
    "quantity": item.Amount,
    "quantity_type": item.AmountType,
    "quantity_type_shorthand": getShorthandForMeasure(item.AmountType)
  }));

}


export default async function handler(req, res) {
  console.log(req.query)
  let recipe_id = req.query.id

  verify(req.query.EDGEtoken, secret, async function (err, decoded) {
    if (err) {
      res.status(400).json({ res: "error: " + String(err) })
    } else {
      if (req.method === "GET") {

        await dbConnect()

        console.log(decoded)
        let db_id = decoded.id
        let userData = await User.findOne({ id: db_id });
        if (userData === undefined) {
          res.status(400).json({ res: "user not found, please relog" })
        } else {

          let RecipeData = await Recipe.findOne({ _id: recipe_id })
          const responseData = {
            ...RecipeData.toObject(),
            ingredients: convertIngredients(RecipeData.ingredients)
          }
          res.status(200).json({ res: responseData })
        }


      } else if (req.method === "PUT") {
        try{ 
        // Allows update of image
        await dbConnect()

        console.log(decoded)
        let db_id = decoded.id
        let userData = await User.findOne({ id: db_id });
        
        if (userData === undefined) {
          res.status(400).json({ res: "user not found, please relog" })
        } else if (req.body.image === undefined || req.body.image === ""){
          res.status(400).json({ res: "No image attached to update" })
        } else {

          let RecipeData = await Recipe.findOne({ _id: recipe_id })
          console.log(req.body.image)
          console.log(recipe_id)
          console.log(RecipeData)
          let responseData = await Recipe.findOneAndUpdate({ _id:recipe_id }, { $set: {_id:recipe_id , image:  req.body.image} });
          console.log(responseData)
          res.status(200).json({ res:  "DONE"})
        }
      } catch (e){ 
        console.log(e)
        res.status(400).json({ res: "Failed request" })
      }
      } else if (req.method === "DELETE") {
        await dbConnect()

        console.log(decoded)
        let db_id = decoded.id
        let userData = await User.findOne({ id: db_id });
        if (userData === undefined) {
          res.status(400).json({ message: "user not found, please relog" })
        } else if (userData.role !== "admin") {
          res.status(400).json({ message: "Insufficient Privileges" })
        } else {

          let RecipeData = await Recipe.deleteOne({ _id: recipe_id })
          res.status(200).json({ success: true, data: RecipeData, message: "Success" })
        }
      } else {
        res.status(400).json({ success: false, data: [], message: "Not supported request" })
      }
    }
  });





}
