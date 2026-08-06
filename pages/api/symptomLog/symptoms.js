import dbConnect from '../../../lib/dbConnect';
import UserSymptom from '../../../models/UserSymptom';
import { verifyToken } from "../../../lib/auth";
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
    'Took vitamins', 'Drank water', 'Ate fruit', 'Ate vegetables',
];

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

    const { search } = req.query;
    const searchLower = (search || '').trim().toLowerCase();

    try {
        // Fetch user's previously used symptoms
        const userFilter = { user_id: userId };
        if (searchLower) {
            userFilter.name = { $regex: searchLower, $options: 'i' };
        }

        const userSymptoms = await UserSymptom.find(userFilter)
            .sort({ usage_count: -1 })
            .limit(20)
            .select('name usage_count -_id');

        // Filter preset symptoms by search term
        const filteredPresets = searchLower
            ? PRESET_SYMPTOMS.filter(s => s.toLowerCase().includes(searchLower))
            : PRESET_SYMPTOMS;

        // Merge: user's symptoms first, then presets not already in user's list
        const userNames = new Set(userSymptoms.map(s => s.name.toLowerCase()));
        const merged = [
            ...userSymptoms.map(s => ({ label: s.name, value: s.name })),
            ...filteredPresets
                .filter(s => !userNames.has(s.toLowerCase()))
                .map(s => ({ label: s, value: s }))
        ].slice(0, 20);

        return res.status(200).json({ success: true, symptoms: merged });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}
