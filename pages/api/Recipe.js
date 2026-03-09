import dbConnect from '../../lib/dbConnect'
import User from '../../models/User'
import Recipe from '../../models/Recipe'
import { verifyToken } from "../../lib/auth";
import { logAPI } from '../../lib/logger';

export default async function handler(req, res) {
  logAPI(req)
  const decoded = await verifyToken(req, res);
  if (!decoded) return;

  try {
    await dbConnect()
    let db_id = decoded.id
    let userData = await User.findOne({ id: db_id });
    if (!userData) {
      return res.status(404).json({ res: "user not found, please relog" })
    }

    if (req.method === "GET") {
      let RecipeData = await Recipe.find({})
      return res.status(200).json({ res: RecipeData })
    } else if (req.method === "POST") {
      try {
        const response = await Recipe.create({
          creator_username: userData.username,
          creator_email: userData.email,
          ingredients: req.body.ingreds,
          instructions: req.body.instructions,
          image: req.body.image,
          name: req.body.name
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
