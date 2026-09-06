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

      if (req.body.expectedComplete !== undefined && req.body.complete !== undefined) {
        if (dbData.complete !== req.body.expectedComplete) {
          if (dbData.complete === req.body.complete) {
            return res.status(200).json({ alreadyInState: true, ...dbData.toObject() });
          }
          return res.status(409).json({ error: 'conflict', currentComplete: dbData.complete, message: 'This item was modified by someone else' });
        }
      }

      const allowedFields = ['complete', 'name', 'quantity', 'quantity_type', 'category', 'note'];
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          dbData[field] = req.body[field];
        }
      });

      await dbData.save();

      if (req.body.category && req.body.name) {
        try {
          await IngredientConversion.findOneAndUpdate(
            { ingredient_name: req.body.name.toLowerCase() },
            {
              $set: {
                category: req.body.category,
                last_updated: new Date()
              }
            },
            { upsert: true }
          );
        } catch (e) {
          console.error('Failed to update IngredientConversion from ShoppingListItem PUT:', e);
        }
      }

      return res.json(dbData);

    } else {
      return res.status(405).json({ success: false, data: [], message: "Not supported request" })
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
  }
}
