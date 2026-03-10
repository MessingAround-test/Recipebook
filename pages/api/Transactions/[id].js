import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import Transactions from '../../../models/Transactions'
import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger';

export default async function handler(req, res) {
  logAPI(req)
  const decoded = await verifyToken(req, res);
  if (!decoded) return;

  const transaction_id = req.query.id
  try {
    await dbConnect()
    let db_id = decoded.id
    let userData = await User.findOne({ id: db_id });
    if (!userData) {
      return res.status(404).json({ res: "user not found, please relog" })
    }

    if (req.method === "GET") {
      let TransactionData = await Transactions.findOne({ _id: transaction_id, user_id: userData._id })
      return res.status(200).json({ res: TransactionData })
    } else if (req.method === "DELETE") {
      let result = await Transactions.deleteOne({ _id: transaction_id, user_id: userData._id })
      return res.status(200).json({ success: true, data: result, message: "Success" })
    } else {
      return res.status(405).json({ success: false, message: "Method Not Allowed" })
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
  }
}
