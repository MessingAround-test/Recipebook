import dbConnect from '../../../lib/dbConnect';
import DailyLog from '../../../models/DailyLog';
import { verifyToken } from "../../../lib/auth.ts";
import { logAPI } from '../../../lib/logger.ts';

export default async function handler(req, res) {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    logAPI(req)

    await dbConnect();

    const { method } = req;
    const userId = decoded.id;

    if (method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }

    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: "startDate and endDate are required" });
    }

    try {
        const logs = await DailyLog.find({
            user_id: userId,
            date: {
                $gte: startDate,
                $lte: endDate
            }
        }).sort({ date: 1 }); // Sort chronologically

        return res.status(200).json({ success: true, logs });
    } catch (err) {
        console.error("Error fetching daily logs range:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
