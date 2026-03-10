import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import ShoppingList from '../../../models/ShoppingList'
import { verifyToken } from "../../../lib/auth.ts";
import { logAPI } from '../../../lib/logger.ts';

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        await dbConnect()

        if (req.method === "GET") {
            let db_id = decoded.id
            let userData = await User.findOne({ id: db_id });
            if (!userData) {
                return res.status(404).json({ res: "user not found, please relog" })
            } else {
                let ShoppingListData = await ShoppingList.find({})
                return res.status(200).json({ res: ShoppingListData })
            }
        } else if (req.method === "POST") {
            try {
                let db_id = decoded.id
                let userData = await User.findOne({ id: db_id });

                const response = await ShoppingList.create({
                    name: req.body.name,
                    createdBy: userData._id,
                    deleted: false,
                    note: req.body.note,
                    complete: false,
                    image: req.body.image
                });

                return res.status(200).json({ success: true, data: response, message: "Success" })
            } catch (error) {
                return res.status(400).json({ success: false, message: String(error) })
            }
        } else {
            return res.status(405).json({ success: false, message: "Method Not Allowed" })
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}
