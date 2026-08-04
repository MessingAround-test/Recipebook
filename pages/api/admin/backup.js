import dbConnect from '../../../lib/dbConnect';
import { verifyAdmin } from "../../../lib/auth";
import mongoose from 'mongoose';
import makeZip from '../../../lib/makeZip';

export default async function handler(req, res) {
    const decoded = await verifyAdmin(req, res);
    if (!decoded) return;

    await dbConnect();
    const db = mongoose.connection.db;

    try {
        const collections = await db.listCollections().toArray();
        const names = collections.map(c => c.name);

        const files = [];
        const metadata = {
            exportedAt: new Date().toISOString(),
            collections: {},
            totalDocuments: 0
        };

        for (const name of names) {
            const docs = await db.collection(name).find({}).toArray();
            metadata.collections[name] = docs.length;
            metadata.totalDocuments += docs.length;
            files.push({ name: `${name}.json`, data: Buffer.from(JSON.stringify(docs, null, 2), 'utf8') });
        }

        files.unshift({ name: 'metadata.json', data: Buffer.from(JSON.stringify(metadata, null, 2), 'utf8') });

        const zip = makeZip(files);
        const date = new Date().toISOString().slice(0, 10);

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="recipebook-backup-${date}.zip"`);
        return res.status(200).send(zip);
    } catch (error) {
        console.error("Backup Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}
