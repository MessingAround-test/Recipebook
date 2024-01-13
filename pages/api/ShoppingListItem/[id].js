
import { secret } from "../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import ShoppingListItem from '../../../models/ShoppingListItem'





export default async function handler(req, res) {
  let id = req.query.id

  verify(req.query.EDGEtoken, secret, async function (err, decoded) {
    if (err) {
      res.status(400).json({ res: "error: " + String(err) })
    } else {
      if (req.method === "GET") {

        await dbConnect()

        console.log(decoded)
        let db_id = decoded.id
        let userData = await User.findOne({ id: db_id });
        if (userData === undefined) {
          res.status(400).json({ res: "user not found, please relog" })
        } else {

          let DbData = await ShoppingListItem.findOne({ _id: id })
          res.status(200).json({ res: DbData })
        }


      } else if (req.method === "DELETE") {
        await dbConnect()

        console.log(decoded)
        let db_id = decoded.id
        let userData = await User.findOne({ id: db_id });
        if (userData === undefined) {
          res.status(400).json({ res: "user not found, please relog" })
        } else {

          let DbData = await ShoppingListItem.deleteOne({ _id: id })
          res.status(200).json({ success: true, data: DbData, message: "Success" })
        }

      } else if (req.method === "PUT") {
        console.log("CALLED")
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
        res.status(400).json({ success: false, data: [], message: "Not supported request" })
      }
    }
  });





}
