
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
          res.status(400).json({ message: "user not found, please relog" })
        } else {

          let DbData = await ShoppingList.findOne({_id: id})
          res.status(200).json({ res:DbData})
        }
      
      }if (req.method === "PUT") {
        
          await dbConnect()
          let db_id = decoded.id
          let userData = await User.findOne({ id: db_id });
          if (userData === undefined) {
            res.status(400).json({ message: "user not found, please relog" })
          } else {
            let complete = req.body.complete === "true"?true:false
            let updateRes = await ShoppingList.updateOne({ _id: req.body._id }, { $set: {"_id": req.body._id ,"complete" : complete} });
            res.status(200).json({ res:updateRes})
          }
      } else if (req.method === "DELETE") {
        await dbConnect()

        console.log(decoded)
        let db_id = decoded.id
        let userData = await User.findOne({ id: db_id });
        if (userData === undefined) {
          res.status(400).json({ res: "user not found, please relog" })
        } else if (userData.role !== "admin"){
          res.status(400).json({ message: "Insufficient Privileges" })
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
