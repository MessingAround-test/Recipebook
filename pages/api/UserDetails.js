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
      res.setHeader('Cache-Control', 'no-store, max-age=0');
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
        let targetId = db_id;
        if (decoded.role === 'admin' && req.body._id) {
          targetId = req.body._id;
        }

        if (decoded.role !== 'admin') {
            delete req.body.role;
            delete req.body.approved;
        }
        delete req.body.passwordHash;
        delete req.body.password;
        delete req.body.__v;
        delete req.body._id;

        const updatedUser = await User.findByIdAndUpdate(
            targetId, 
            { "$set": req.body },
            { new: true, runValidators: true }
        ).select('-passwordHash -__v');

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        console.log(`User ${targetId} updated successfully with:`, req.body);
        return res.status(200).json({ success: true, res: updatedUser })
      } catch (error) {
        console.error("PUT UserDetails error:", error);
        return res.status(500).json({ success: false, message: "ERROR: " + String(error) })
      }
    } else {
      return res.status(405).json({ res: "Method Not Allowed" })
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
  }
}
