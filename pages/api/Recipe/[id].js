
import { verifyToken } from "../../../lib/auth.ts";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import mongoose from 'mongoose'
import Recipe from '../../../models/Recipe'
import { saveRecipeImages, deleteRecipeImages, recipeImageUrl } from '../../../lib/recipeImageServer'
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
      "category": category,
      "note": item.note
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
        image: RecipeData.hasImage || RecipeData.image ? recipeImageUrl(recipe_id, 'full') : undefined,
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
        if (req.body.name !== undefined) updateData.name = req.body.name;
        if (req.body.ingreds !== undefined) updateData.ingredients = req.body.ingreds;
        if (req.body.instructions !== undefined) updateData.instructions = req.body.instructions;
        if (req.body.prepWork !== undefined) updateData.prepWork = req.body.prepWork;
        if (req.body.prepWorkChecked !== undefined) updateData.prepWorkChecked = req.body.prepWorkChecked;
        if (req.body.prepWorkNotesHash !== undefined) updateData.prepWorkNotesHash = req.body.prepWorkNotesHash;
        if (req.body.cookingTimers !== undefined) updateData.cookingTimers = req.body.cookingTimers;
        if (req.body.timersChecked !== undefined) updateData.timersChecked = req.body.timersChecked;
        if (req.body.approxCost !== undefined) updateData.approxCost = req.body.approxCost;
        if (req.body.unitCost !== undefined) updateData.unitCost = req.body.unitCost;
        if (req.body.time !== undefined) updateData.time = req.body.time;
        if (req.body.genre !== undefined) updateData.genre = req.body.genre;
        if (req.body.mealTypes !== undefined) updateData.mealTypes = req.body.mealTypes;
        if (req.body.priceCategory !== undefined) updateData.priceCategory = req.body.priceCategory;
        if (req.body.timesCooked !== undefined) updateData.timesCooked = req.body.timesCooked;
        if (req.body.hidden !== undefined) updateData.hidden = req.body.hidden;
        if (req.body.feedback !== undefined) updateData.feedback = req.body.feedback;
        if (req.body.carbType !== undefined) updateData.carbType = req.body.carbType;
        if (req.body.servings !== undefined) updateData.servings = req.body.servings;
        if (req.body.sourceUrl !== undefined) updateData.sourceUrl = req.body.sourceUrl;

        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ res: "No data provided to update" })
        }

        await Recipe.findOneAndUpdate({ _id: recipe_id }, { $set: updateData });

        if (req.body.image !== undefined) {
          if (req.body.image === null || req.body.image === '') {
            await deleteRecipeImages(recipe_id);
            await Recipe.updateOne({ _id: recipe_id }, { $set: { hasImage: false } });
            // Raw collection: mongoose ignores $unset on schema-less fields
            await Recipe.collection.updateOne({ _id: new mongoose.Types.ObjectId(recipe_id) }, { $unset: { image: '' } });
          } else {
            await saveRecipeImages(recipe_id, req.body.image);
          }
        }
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
      await deleteRecipeImages(recipe_id)
      return res.status(200).json({ success: true, data: RecipeData, message: "Success" })
    }
  } else {
    return res.status(400).json({ success: false, data: [], message: "Not supported request" })
  }
}
