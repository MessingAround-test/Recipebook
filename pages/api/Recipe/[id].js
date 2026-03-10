
import { verifyToken } from "../../../lib/auth.ts";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import Recipe from '../../../models/Recipe'
import { getShorthandForMeasure } from '../../../lib/conversion'
import { logAPI } from "../../../lib/logger.ts";
import { safeToObject } from "../../../lib/utils";


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
  logAPI(req)
  let recipe_id = req.query.id

  const decoded = await verifyToken(req, res);
  if (!decoded) return;

  if (req.method === "GET") {

    await dbConnect()

    let db_id = decoded.id
    let userData = await User.findOne({ id: db_id });
    if (userData === undefined) {
      return res.status(400).json({ res: "user not found, please relog" })
    } else {

      let RecipeData = await Recipe.findOne({ _id: recipe_id })
      const responseData = {
        ...safeToObject(RecipeData),
        ingredients: convertIngredients(RecipeData.ingredients)
      }
      return res.status(200).json({ res: responseData })
    }


  } else if (req.method === "PUT") {
    try {
      // Allows update of image
      await dbConnect()

      let db_id = decoded.id
      let userData = await User.findOne({ id: db_id });

      if (userData === undefined) {
        return res.status(400).json({ res: "user not found, please relog" })
      } else if (req.body.image === undefined || req.body.image === "") {
        return res.status(400).json({ res: "No image attached to update" })
      } else {

        let RecipeData = await Recipe.findOne({ _id: recipe_id })
        let responseData = await Recipe.findOneAndUpdate({ _id: recipe_id }, { $set: { _id: recipe_id, image: req.body.image } });
        return res.status(200).json({ res: "DONE" })
      }
    } catch (e) {
      console.log(e)
      return res.status(400).json({ res: "Failed request" })
    }
  } else if (req.method === "DELETE") {
    await dbConnect()

    let db_id = decoded.id
    let userData = await User.findOne({ id: db_id });
    if (userData === undefined) {
      return res.status(400).json({ message: "user not found, please relog" })
    } else if (userData.role !== "admin") {
      return res.status(400).json({ message: "Insufficient Privileges" })
    } else {

      let RecipeData = await Recipe.deleteOne({ _id: recipe_id })
      return res.status(200).json({ success: true, data: RecipeData, message: "Success" })
    }
  } else {
    return res.status(400).json({ success: false, data: [], message: "Not supported request" })
  }
}
