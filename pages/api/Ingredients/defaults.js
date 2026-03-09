import Ingredients from '../../../models/Ingredients'
import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger';

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    let search_term = req.query.search_term
    if (search_term !== undefined) {
        search_term = search_term.toLowerCase()
    }

    if (req.method === "GET") {
        try {
            if (search_term === "" || search_term === undefined) {
                let IngredData = await Ingredients.distinct("search_term").exec()
                return res.status(200).json({ success: true, data: IngredData, message: "" })
            }
            return res.status(200).json({ success: true, data: [], message: "No search term provided for defaults" })
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message })
        }
    } else {
        return res.status(405).json({ success: false, message: "Method Not Allowed" })
    }
}







