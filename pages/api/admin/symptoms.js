import dbConnect from '../../../lib/dbConnect';
import UserSymptom from '../../../models/UserSymptom';
import SymptomLog from '../../../models/SymptomLog';
import SymptomClassification from '../../../models/SymptomClassification';
import { verifyAdmin } from "../../../lib/auth.ts";
import { logAPI } from '../../../lib/logger';

const PRESET_SYMPTOMS = [
    'Persistent fatigue', 'Brain fog', 'Poor physical performance', 'Feeling cold', 'Irritability',
    'Headache', 'Migraine', 'Dizziness', 'Nausea', 'Bloating',
    'Dehydrated', 'Low energy', 'Muscle aches', 'Joint pain', 'Back pain',
    'Poor sleep', 'Overslept', 'Woke up tired', 'Insomnia', 'Night sweats',
    'Anxiety', 'Mood swings', 'Feeling down', 'Stress', 'Brain fog',
    'Productive day', 'Good sleep', 'High energy', 'Focused', 'Motivated',
    'Socialised', 'Ate well', 'Exercised', 'Rest day', 'Fresh air',
    'Caffeine', 'Alcohol', 'Sugary food', 'Junk food', 'Skipped meals',
    'Allergies', 'Sore throat', 'Cough', 'Runny nose', 'Congestion',
];

export default async function handler(req, res) {
    const decoded = await verifyAdmin(req, res);
    if (!decoded) return;
    logAPI(req);

    await dbConnect();

    switch (req.method) {
        case 'GET': {
            try {
                const distinctNames = new Set();
                PRESET_SYMPTOMS.forEach(s => distinctNames.add(s.toLowerCase().trim()));

                const userSymptoms = await UserSymptom.find().select('name').lean();
                userSymptoms.forEach(s => distinctNames.add(String(s.name || '').toLowerCase().trim()));

                const symptomLogs = await SymptomLog.find({ 'symptoms.0': { $exists: true } }).select('symptoms').lean();
                symptomLogs.forEach(log => {
                    (log.symptoms || []).forEach(s => distinctNames.add(String(s.name || '').toLowerCase().trim()));
                });
                distinctNames.delete('');

                const classifications = await SymptomClassification.find().select('name category').lean();
                const classMap = new Map(classifications.map(c => [c.name, c.category]));

                const symptoms = Array.from(distinctNames)
                    .sort()
                    .map(name => ({
                        name,
                        category: classMap.get(name) || 'none'
                    }));

                return res.status(200).json({ success: true, symptoms });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
        }

        case 'POST':
        case 'PUT': {
            const { symptoms } = req.body;
            if (!Array.isArray(symptoms) || symptoms.length === 0) {
                return res.status(400).json({ success: false, message: "symptoms array is required" });
            }

            const validCategories = ['positive', 'negative', 'neutral', 'none'];
            const bulkOps = symptoms
                .filter(s => s && s.name && validCategories.includes(s.category))
                .map(s => ({
                    updateOne: {
                        filter: { name: String(s.name).toLowerCase().trim() },
                        update: {
                            $set: { category: s.category, updatedBy: decoded.id },
                            $setOnInsert: { name: String(s.name).toLowerCase().trim() }
                        },
                        upsert: true
                    }
                }));

            if (bulkOps.length === 0) {
                return res.status(400).json({ success: false, message: "No valid symptom classifications provided" });
            }

            try {
                const result = await SymptomClassification.bulkWrite(bulkOps);
                return res.status(200).json({ success: true, modifiedCount: result.modifiedCount, upsertedCount: result.upsertedCount });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
        }

        default:
            res.setHeader('Allow', ['GET', 'POST', 'PUT']);
            return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
