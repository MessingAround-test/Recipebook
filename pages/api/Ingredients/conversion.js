import { convertMetricReading, convertKitchenMetrics } from '../../../lib/conversion'
import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger';

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    let search_term = req.query.search_term
    let qType = req.query.qType
    let quantity = req.query.quantity

    if (search_term === undefined || qType === undefined || quantity === undefined) {
        return res.status(400).json({ success: false, data: [], message: "search_term, quantity, qType are required" })
    }

    if (req.method === "GET") {
        try {
            qType = convertMetricReading(qType).quantity_unit
            let result = convertKitchenMetrics(qType, quantity)
            return res.status(200).json({ success: true, data: result, "loadedSource": true })
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message })
        }
    } else {
        return res.status(405).json({ success: false, message: "Method Not Allowed" })
    }
}







