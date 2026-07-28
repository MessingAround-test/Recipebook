import dbConnect from '../../../lib/dbConnect';
import SymptomLog from '../../../models/SymptomLog';
import UserSymptom from '../../../models/UserSymptom';
import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger';

export default async function handler(req, res) {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    logAPI(req);

    await dbConnect();
    const userId = decoded.id;
    const { method } = req;

    switch (method) {
        case 'GET':
            const { date } = req.query;
            if (!date) return res.status(400).json({ success: false, message: "Date is required" });

            try {
                let log = await SymptomLog.findOne({ user_id: userId, date });
                if (!log) {
                    log = await SymptomLog.create({ user_id: userId, date, symptoms: [] });
                }
                return res.status(200).json({ success: true, log });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

        case 'POST':
            const { date: postDate, mood, symptoms, notes } = req.body;
            if (!postDate) return res.status(400).json({ success: false, message: "Date is required" });

            try {
                const log = await SymptomLog.findOneAndUpdate(
                    { user_id: userId, date: postDate },
                    { $set: { mood: mood || null, symptoms: symptoms || [], notes: notes || '' } },
                    { upsert: true, new: true }
                );

                // Collect symptoms into user vocabulary for autocomplete
                if (symptoms && symptoms.length > 0) {
                    const bulkOps = symptoms.map(s => ({
                        updateOne: {
                            filter: { user_id: userId, name: s.name.toLowerCase().trim() },
                            update: { $inc: { usage_count: 1 } },
                            upsert: true
                        }
                    }));
                    await UserSymptom.bulkWrite(bulkOps);
                }

                return res.status(200).json({ success: true, log });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

        default:
            res.setHeader('Allow', ['GET', 'POST']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}
