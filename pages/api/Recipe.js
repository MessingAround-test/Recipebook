import dbConnect from '../../lib/dbConnect'
import User from '../../models/User'
import Recipe from '../../models/Recipe'
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
      return res.status(200).json({ res: RecipeData })
    } else if (req.method === "POST") {
      try {
        const response = await Recipe.create({
          creator_username: userData.username,
          creator_email: userData.email,
          ingredients: req.body.ingreds,
          instructions: req.body.instructions,
          image: req.body.image,
          name: req.body.name,
          time: req.body.time,
          genre: req.body.genre,
          mealTypes: req.body.mealTypes,
          servings: req.body.servings
        });
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
