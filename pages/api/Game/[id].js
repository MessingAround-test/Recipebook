import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import Game from '../../../models/Game'
import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger';

export default async function handler(req, res) {
  logAPI(req)
  const decoded = await verifyToken(req, res);
  if (!decoded) return;

  const game_id = req.query.id
  try {
    await dbConnect()
    let db_id = decoded.id
    let userData = await User.findOne({ id: db_id });
    if (!userData) {
      return res.status(404).json({ res: "user not found, please relog" })
    }

    if (req.method === "GET") {
      let GameData = await Game.findOne({ _id: game_id })
      return res.status(200).json({ res: GameData })
    } else if (req.method === "POST") {
      // Placeholder for game creation/action logic
      return res.status(200).json({ success: true, message: "Action recorded" })
    } else {
      return res.status(405).json({ success: false, message: "Method Not Allowed" })
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
  }
}
