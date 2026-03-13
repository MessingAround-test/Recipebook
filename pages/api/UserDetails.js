import dbConnect from '../../lib/dbConnect'
import User from '../../models/User'
import { verifyToken } from "../../lib/auth.ts";
import { logAPI } from '../../lib/logger.ts';

export default async function handler(req, res) {
  logAPI(req)
  const decoded = await verifyToken(req, res);
  if (!decoded) return;

  try {
    if (req.method === "GET") {
      await dbConnect()

      let db_id = decoded.id
      let userData = await User.findById(db_id).select('-passwordHash -__v');
      if (!userData) {
        return res.status(404).json({ res: "user not found, please relog" })
      } else {
        return res.status(200).json({ res: userData })
      }
    } else if (req.method === "PUT") {
      try {
        await dbConnect()
        let db_id = decoded.id
        
        // Security check: Only allow users to update their own profile unless they are an admin
        if (decoded.role !== 'admin' && String(db_id) !== String(req.body._id)) {
            return res.status(403).json({ success: false, message: "Forbidden: You can only update your own profile" })
        }

        // Prevent non-admins from changing their role or approval status
        if (decoded.role !== 'admin') {
            delete req.body.role;
            delete req.body.approved;
        }

        // Prevent overwriting sensitive fields from the profile form
        delete req.body.passwordHash;
        delete req.body.password; // Just in case
        delete req.body.__v;

        let updateRes = await User.findOneAndUpdate({ _id: req.body._id }, { "$set": req.body })
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
