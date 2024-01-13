
import { secret } from "../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import Transactions from '../../../models/Transactions'





export default async function handler(req, res) {
    console.log(req.query)
   let transaction_id= req.query.id
    
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
          let TransactionData = await Transactions.find({user_id: userData._id}) //_id: transaction_id, 
          res.status(200).json({ res: TransactionData})
        }
      
      
      } else if (req.method === "POST"){
        let transactionDetails = req.body
        await dbConnect()

        console.log(decoded)
        let db_id = decoded.id
        let userData = await User.findOne({ id: db_id });
        if (userData === undefined) {
          res.status(400).json({ res: "user not found, please relog" })
        } else {
            transactionDetails.user_id = userData._id
            let createResponse = createTransaction(transactionDetails)
            res.status(200).json({ res: createResponse})
        }
        
      }else {
        res.status(400).json({ success: false, data: [], message: "Not supported request"})
      }
    }
  });





}




async function createTransaction(body) {
    // userModel.
    
    
    try {
        const res = Transactions.create(body);
        console.log(await res);
        return { success: true, data: await res, message: "Success" }
    } catch (error)  {
        console.log(error)
        return { success: false, data: error, message: "Incorrect data input" }
    }
}
