import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import Transactions from '../../../models/Transactions'
import { verifyToken } from "../../../lib/auth.ts";
import { logAPI } from '../../../lib/logger.ts';

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
      let TransactionData = await Transactions.find({ user_id: userData._id })
      return res.status(200).json({ res: TransactionData })
    } else if (req.method === "POST") {
      try {
        let transactionDetails = req.body
        transactionDetails.user_id = userData._id
        const result = await Transactions.create(transactionDetails);
        return res.status(200).json({ success: true, data: result, message: "Success" })
      } catch (error) {
        return res.status(400).json({ success: false, message: "Incorrect data input: " + error.message })
      }
    } else {
      return res.status(405).json({ success: false, message: "Method Not Allowed" })
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
  }
}
