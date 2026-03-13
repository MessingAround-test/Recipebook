import dbConnect from '../../../lib/dbConnect';
import { verifyAdmin } from "../../../lib/auth";
import mongoose from 'mongoose';

export default async function handler(req, res) {
    const decoded = await verifyAdmin(req, res);
    if (!decoded) return;

    await dbConnect();
    const db = mongoose.connection.db;

    const { action, collection, id, query, data } = req.body;

    try {
        switch (action) {
            case 'listCollections':
                const collections = await db.listCollections().toArray();
                return res.status(200).json({ success: true, collections: collections.map(c => c.name) });

            case 'fetchDocuments':
                if (!collection) throw new Error("Collection name required");
                const filter = query ? JSON.parse(query) : {};
                const docs = await db.collection(collection).find(filter).limit(100).toArray();
                return res.status(200).json({ success: true, documents: docs });

            case 'updateDocument':
                if (!collection || !id || !data) throw new Error("Collection, ID, and data required");
                // Strip _id from data as it's immutable
                const { _id: ignoredId, ...replaceData } = data;
                const replaceRes = await db.collection(collection).replaceOne(
                    { _id: new mongoose.Types.ObjectId(id) },
                    replaceData
                );
                return res.status(200).json({ success: true, result: replaceRes });

            case 'deleteDocument':
                if (!collection || !id) throw new Error("Collection and ID required");
                const deleteRes = await db.collection(collection).deleteOne({ _id: new mongoose.Types.ObjectId(id) });
                return res.status(200).json({ success: true, result: deleteRes });

            case 'createDocument':
                if (!collection || !data) throw new Error("Collection and data required");
                const createRes = await db.collection(collection).insertOne(data);
                return res.status(200).json({ success: true, result: createRes });

            default:
                return res.status(400).json({ success: false, message: "Invalid action" });
        }
    } catch (error) {
        console.error("DB Inspector Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}
