import { verifyAdmin } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger';
import dbConnect from '../../../lib/dbConnect';
import ProviderStatus from '../../../models/ProviderStatus';
import { KNOWN_PROVIDERS, invalidateProviderStatusCache } from '../../../lib/providerStatus';

export default async function handler(req, res) {
    logAPI(req);
    const decoded = await verifyAdmin(req, res);
    if (!decoded) return;

    try {
        await dbConnect();

        const all = await ProviderStatus.find({}).lean().exec();
        const statusMap = {};
        all.forEach(d => { statusMap[d.name] = d; });

        if (req.method === "GET") {
            const providers = KNOWN_PROVIDERS.map(name => ({
                name,
                disabled: statusMap[name] ? statusMap[name].disabled : false,
                reason: statusMap[name] ? (statusMap[name].reason || "") : "",
            }));
            return res.status(200).json({ success: true, data: providers });
        }

        if (req.method === "PUT") {
            const { name, disabled, reason } = req.body || {};
            if (!name || !KNOWN_PROVIDERS.includes(name)) {
                return res.status(400).json({ success: false, message: "Unknown provider: " + name });
            }
            if (typeof disabled !== "boolean") {
                return res.status(400).json({ success: false, message: "disabled must be a boolean" });
            }

            await ProviderStatus.updateOne(
                { name },
                {
                    name,
                    disabled,
                    reason: reason || "",
                    updated_by: decoded.email || String(decoded.id) || "",
                },
                { upsert: true }
            );
            invalidateProviderStatusCache();

            return res.status(200).json({ success: true, data: { name, disabled, reason: reason || "" } });
        }

        return res.status(405).json({ success: false, message: "Method Not Allowed" });
    } catch (error) {
        console.error("API Error in /api/admin/providers:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}
