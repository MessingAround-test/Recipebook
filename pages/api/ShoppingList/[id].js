import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import ShoppingList from '../../../models/ShoppingList'
import { verifyToken } from "../../../lib/auth.ts";
import { logAPI } from '../../../lib/logger.ts';

export default async function handler(req, res) {
  logAPI(req)
  const decoded = await verifyToken(req, res);
  if (!decoded) return;

  const id = req.query.id
  try {
    await dbConnect()

    if (req.method === "GET") {
      let db_id = decoded.id
      let userData = await User.findById(db_id);
      if (!userData) {
        return res.status(404).json({ message: "user not found, please relog" })
      } else {
      let DbData = await ShoppingList.findOne({ _id: id })
      if (!DbData) {
        return res.status(404).json({ res: "Shopping list not found" })
      }

      if (decoded.role !== "admin" && String(DbData.createdBy) !== String(userData._id)) {
        return res.status(403).json({ res: "Forbidden: You do not own this shopping list" })
      }

      return res.status(200).json({ res: DbData })
      }
    } else if (req.method === "PUT") {
      let db_id = decoded.id
      let userData = await User.findById(db_id);
      if (!userData) {
        return res.status(404).json({ message: "user not found, please relog" })
      } else {
        let DbData = await ShoppingList.findOne({ _id: id })
        if (!DbData) {
          return res.status(404).json({ res: "Shopping list not found" })
        }

        if (decoded.role !== "admin" && String(DbData.createdBy) !== String(userData._id)) {
          return res.status(403).json({ res: "Forbidden: You do not own this shopping list" })
        }

        let updateData = {};
        if (req.body.complete !== undefined) {
          updateData.complete = req.body.complete === "true" || req.body.complete === true ? true : false;
        }
        if (req.body.cost !== undefined) {
          updateData.cost = Number(req.body.cost);
        }
        let updateRes = await ShoppingList.updateOne({ _id: id }, { $set: updateData });
        return res.status(200).json({ res: updateRes })
      }
    } else if (req.method === "DELETE") {
      let db_id = decoded.id
      let userData = await User.findById(db_id);
      if (!userData) {
        return res.status(404).json({ res: "user not found, please relog" })
      } else if (userData.role !== "admin") {
        return res.status(403).json({ message: "Insufficient Privileges" })
      } else {
        let DbData = await ShoppingList.deleteOne({ _id: id })
        return res.status(200).json({ success: true, data: DbData, message: "Success" })
      }
    } else {
      return res.status(405).json({ success: false, message: "Method Not Allowed" })
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
  }
}
