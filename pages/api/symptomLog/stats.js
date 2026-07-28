import dbConnect from '../../../lib/dbConnect';
import SymptomLog from '../../../models/SymptomLog';
import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger';

export default async function handler(req, res) {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    logAPI(req);

    await dbConnect();
    const userId = decoded.id;

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: "startDate and endDate are required" });
    }

    try {
        // Count total days in range
        const start = new Date(startDate);
        const end = new Date(endDate);
        const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);

        // Fetch all symptom logs in range
        const logs = await SymptomLog.find({
            user_id: userId,
            date: { $gte: startDate, $lte: endDate }
        }).select('date symptoms mood').lean();

        // Build date set for quick lookup
        const loggedDates = new Set(logs.map(l => l.date));

        // Aggregate symptoms
        const symptomCounts = new Map();
        logs.forEach(log => {
            const seen = new Set();
            (log.symptoms || []).forEach(s => {
                const name = s.name.toLowerCase().trim();
                if (!name || seen.has(name)) return;
                seen.add(name);
                symptomCounts.set(name, (symptomCounts.get(name) || 0) + 1);
            });
        });

        // Calculate mood distribution
        let moodCounts = { red: 0, orange: 0, green: 0 };
        logs.forEach(log => {
            if (log.mood) {
                if (log.mood <= 3) moodCounts.red++;
                else if (log.mood <= 6) moodCounts.orange++;
                else moodCounts.green++;
            }
        });
        const moodLoggedDays = logs.filter(l => l.mood != null).length;

        // Build response
        const symptoms = Array.from(symptomCounts.entries())
            .map(([name, count]) => ({
                name,
                count,
                totalDays,
                frequency: Math.round((count / totalDays) * 100)
            }))
            .sort((a, b) => b.count - a.count);

        return res.status(200).json({
            success: true,
            totalDays,
            loggedDays: loggedDates.size,
            symptoms,
            mood: {
                avg: logs.filter(l => l.mood != null).reduce((sum, l) => sum + l.mood, 0) / (moodLoggedDays || 1),
                distribution: moodCounts,
                loggedDays: moodLoggedDays
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}
