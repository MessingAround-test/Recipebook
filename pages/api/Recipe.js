import dbConnect from '../../lib/dbConnect'
import User from '../../models/User'
import Recipe from '../../models/Recipe'
import { saveRecipeImages, recipeImageUrl } from '../../lib/recipeImageServer'
import { verifyToken } from "../../lib/auth.ts";
import { logAPI } from '../../lib/logger.ts';

export default async function handler(req, res) {
  logAPI(req)
  const decoded = await verifyToken(req, res);
  if (!decoded) return;

  try {
    await dbConnect()
    let db_id = decoded.id
    let userData = await User.findById(db_id);
    if (!userData) {
      return res.status(404).json({ res: "user not found, please relog" })
    }

    if (req.method === "GET") {
      let query = {}
      if (decoded.role !== 'admin') {
        query.creator_email = userData.email
      }
      let RecipeData = await Recipe.find(query)
        .lean()
      RecipeData.forEach(r => {
        r.image = r.hasImage ? recipeImageUrl(r._id, 'thumb') : undefined
      })
      return res.status(200).json({ res: RecipeData })
    } else if (req.method === "POST") {
      try {
        const response = await Recipe.create({
          creator_username: userData.username,
          creator_email: userData.email,
          ingredients: req.body.ingreds,
          instructions: req.body.instructions,
          name: req.body.name,
          time: req.body.time,
          genre: req.body.genre,
          mealTypes: req.body.mealTypes,
          carbType: req.body.carbType,
          servings: req.body.servings,
          hidden: req.body.hidden,
          sourceUrl: req.body.sourceUrl,
          sourceNotes: req.body.sourceNotes,
          carbSide: sanitizeCarbSideInput(req.body.carbSide)
        });
        if (req.body.image) {
          await saveRecipeImages(response._id, req.body.image)
        }
        return res.status(200).json({ success: true, data: response, message: "Success" })
      } catch (error) {
        return res.status(400).json({ success: false, message: String(error) })
      }
    } else {
      return res.status(405).json({ success: false, message: "Method Not Allowed" })
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
  }
}

/** Normalises the client-supplied carbSide block on create. Analysis happens
 *  separately (auto on view / bulk op), so a create only carries the marks
 *  the user made in the editor. */
function sanitizeCarbSideInput(carbSide) {
  if (carbSide === null) return undefined
  const src = carbSide && typeof carbSide === 'object' ? carbSide : {}
  const needs = src.needs === true
  if (!needs) return undefined
  return {
    needs: true,
    state: 'pending',
    type: typeof src.type === 'string' ? src.type.trim() : '',
    customName: typeof src.customName === 'string' && src.customName.trim() ? src.customName.trim() : undefined
  }
}
