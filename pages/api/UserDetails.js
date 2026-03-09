import dbConnect from '../../lib/dbConnect'
import User from '../../models/User'
import { verifyToken } from "../../lib/auth";
import { logAPI } from '../../lib/logger';

export default async function handler(req, res) {
  logAPI(req)
  const decoded = await verifyToken(req, res);
  if (!decoded) return;

  try {
    if (req.method === "GET") {
      await dbConnect()

      let db_id = decoded.id
      let userData = await User.findOne({ id: db_id });
      if (!userData) {
        return res.status(404).json({ res: "user not found, please relog" })
      } else {
        return res.status(200).json({ res: userData })
      }
    } else if (req.method === "PUT") {
      try {
        await dbConnect()
        let updateRes = await User.findOneAndUpdate({ id: req.body._id }, { "$set": req.body })
        return res.status(200).json({ success: true, res: "allgood" })
      } catch (error) {
        return res.status(500).json({ success: false, message: "ERROR: " + String(error) })
      }
    } else {
      return res.status(405).json({ res: "Method Not Allowed" })
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
  }
}
