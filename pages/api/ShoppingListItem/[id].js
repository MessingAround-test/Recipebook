import { verifyToken } from "../../../lib/auth";
import { logAPI } from "../../../lib/logger";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import ShoppingListItem from '../../../models/ShoppingListItem'

export default async function handler(req, res) {
  logAPI(req);
  const decoded = await verifyToken(req, res);
  if (!decoded) return;

  let id = req.query.id;
  try {
    await dbConnect()

    if (req.method === "GET") {
      let db_id = decoded.id
      let userData = await User.findOne({ id: db_id });
      if (!userData) {
        return res.status(404).json({ res: "user not found, please relog" })
      } else {
        let DbData = await ShoppingListItem.findOne({ _id: id })
        return res.status(200).json({ res: DbData })
      }

    } else if (req.method === "DELETE") {
      let db_id = decoded.id
      let userData = await User.findOne({ id: db_id });
      if (!userData) {
        return res.status(404).json({ message: "user not found, please relog" })
      } else if (userData.role !== "admin") {
        return res.status(403).json({ message: "Insufficient Privileges" })
      } else {
        let DbData = await ShoppingListItem.deleteOne({ _id: id })
        return res.status(200).json({ success: true, data: DbData, message: "Success" })
      }

    } else if (req.method === "PUT") {
      const dbData = await ShoppingListItem.findOne({ _id: id });

      if (!dbData) {
        return res.status(404).json({ error: 'ShoppingListItem not found' });
      }

      // Update the Complete property with the value from the request body
      dbData.complete = req.body.complete;

      // Save the updated document
      await dbData.save();

      return res.json(dbData);

    } else {
      return res.status(405).json({ success: false, data: [], message: "Not supported request" })
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
  }
}
