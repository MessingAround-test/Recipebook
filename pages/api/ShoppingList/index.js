import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import ShoppingList from '../../../models/ShoppingList'
import ShoppingListItem from '../../../models/ShoppingListItem'
import { verifyToken, requireFeature } from "../../../lib/auth.ts";
import { logAPI } from '../../../lib/logger.ts';

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    if (!(await requireFeature(req, res, decoded, 'shoppingList'))) return;

    try {
        await dbConnect()

        let db_id = decoded.id
        let userData = await User.findById(db_id);
        if (!userData) {
            return res.status(404).json({ res: "user not found, please relog" })
        }

        if (req.method === "GET") {
            let query = {}
            if (decoded.role !== 'admin') {
                query.createdBy = userData._id
            }
            if (req.query.complete !== undefined) {
                query.complete = req.query.complete === 'true'
            }
            let ShoppingListData = await ShoppingList.find(query)
            // Attach live item counts (bought / unbought) for each list without
            // persisting anything — used by the list-page cards on mobile.
            if (ShoppingListData.length > 0) {
                const listIds = ShoppingListData.map((l) => String(l._id))
                const itemAgg = await ShoppingListItem.aggregate([
                    { $match: { shoppingListId: { $in: listIds }, deleted: { $ne: true } } },
                    { $group: { _id: '$shoppingListId', total: { $sum: 1 }, bought: { $sum: { $cond: ['$complete', 1, 0] } } } }
                ])
                const countsByList = {}
                itemAgg.forEach((row) => {
                    countsByList[row._id] = { total: row.total, bought: row.bought, unbought: row.total - row.bought }
                })
                ShoppingListData = ShoppingListData.map((l) => {
                    const obj = l.toObject ? l.toObject() : l
                    return { ...obj, counts: countsByList[String(obj._id)] || { total: 0, bought: 0, unbought: 0 } }
                })
            }
            return res.status(200).json({ res: ShoppingListData })
        } else if (req.method === "POST") {
            try {

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
