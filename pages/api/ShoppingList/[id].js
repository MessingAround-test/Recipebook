
import { secret } from "../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import ShoppingList from '../../../models/ShoppingList'





export default async function handler(req, res) {
   let id= req.query.id
    
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

          let DbData = await ShoppingList.findOne({_id: id})
          res.status(200).json({ res:DbData})
        }
      
      
      } else if (req.method === "DELETE") {
        await dbConnect()

        console.log(decoded)
        let db_id = decoded.id
        let userData = await User.findOne({ id: db_id });
        if (userData === undefined) {
          res.status(400).json({ res: "user not found, please relog" })
        } else {

          let DbData = await ShoppingList.deleteOne({_id: id})
          res.status(200).json({ success: true, data: DbData, message: "Success"})
        }
      }else {
        res.status(400).json({ success: false, data: [], message: "Not supported request"})
      }
    }
  });





}
