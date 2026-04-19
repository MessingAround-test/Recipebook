
import { verifyToken } from "../../../lib/auth.ts";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import Recipe from '../../../models/Recipe'
import ShoppingListItem from '../../../models/ShoppingListItem'
import IngredientConversion from '../../../models/IngredientConversion'
import { getShorthandForMeasure, addCalculatedFields } from '../../../lib/conversion'
import { logAPI } from "../../../lib/logger.ts";
import { safeToObject } from "../../../lib/utils";
import { determineCategory } from '../../../lib/categoryDetermination';
import { callGroqChat } from '../../../lib/ai';


async function convertIngredients(originalObject) {
  const ingredients = await Promise.all(originalObject.map(async (item) => {
    const category = await determineCategory(item.Name, { IngredientConversion, ShoppingListItem }, callGroqChat);

    return {
      "_id": item._id,
      "name": item.Name,
      "quantity": item.Amount,
      "quantity_type": item.AmountType,
      "quantity_type_shorthand": getShorthandForMeasure(item.AmountType),
      "category": category
    };
  }));

  return addCalculatedFields(ingredients);
}


export default async function handler(req, res) {
  logAPI(req)
  let recipe_id = req.query.id

  const decoded = await verifyToken(req, res);
  if (!decoded) return;

  if (req.method === "GET") {

    await dbConnect()

    let db_id = decoded.id
    let userData = await User.findById(db_id);
    if (userData === undefined) {
      return res.status(400).json({ res: "user not found, please relog" })
    } else {

      let RecipeData = await Recipe.findOne({ _id: recipe_id })
      if (!RecipeData) {
        return res.status(404).json({ res: "Recipe not found" })
      }

      if (decoded.role !== "admin" && RecipeData.creator_email !== userData.email) {
        return res.status(403).json({ res: "Forbidden: You do not own this recipe" })
      }

      const responseData = {
        ...safeToObject(RecipeData),
        ingredients: await convertIngredients(RecipeData.ingredients)
      }
      return res.status(200).json({ res: responseData })
    }


  } else if (req.method === "PUT") {
    try {
      await dbConnect()

      let db_id = decoded.id
      let userData = await User.findById(db_id);

      if (userData === undefined) {
        return res.status(400).json({ res: "user not found, please relog" })
      } else {
        let RecipeData = await Recipe.findOne({ _id: recipe_id })
        if (!RecipeData) {
          return res.status(404).json({ res: "Recipe not found" })
        }

        if (decoded.role !== "admin" && RecipeData.creator_email !== userData.email) {
          return res.status(403).json({ res: "Forbidden: You do not own this recipe" })
        }

        let updateData = {};
        if (req.body.image !== undefined) updateData.image = req.body.image;
        if (req.body.name !== undefined) updateData.name = req.body.name;
        if (req.body.ingreds !== undefined) updateData.ingredients = req.body.ingreds;
        if (req.body.instructions !== undefined) updateData.instructions = req.body.instructions;
        if (req.body.approxCost !== undefined) updateData.approxCost = req.body.approxCost;
        if (req.body.time !== undefined) updateData.time = req.body.time;
        if (req.body.genre !== undefined) updateData.genre = req.body.genre;
        if (req.body.mealTypes !== undefined) updateData.mealTypes = req.body.mealTypes;
        if (req.body.priceCategory !== undefined) updateData.priceCategory = req.body.priceCategory;
        if (req.body.timesCooked !== undefined) updateData.timesCooked = req.body.timesCooked;
        if (req.body.feedback !== undefined) updateData.feedback = req.body.feedback;

        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ res: "No data provided to update" })
        }

        await Recipe.findOneAndUpdate({ _id: recipe_id }, { $set: updateData });
        return res.status(200).json({ success: true, message: "Recipe updated successfully" })
      }
    } catch (e) {
      console.log(e)
      return res.status(400).json({ res: "Failed request: " + e.message })
    }
  } else if (req.method === "DELETE") {
    await dbConnect()

    let db_id = decoded.id
    let userData = await User.findById(db_id);
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
