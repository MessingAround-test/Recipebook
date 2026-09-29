import { verifyAdmin } from "../../../lib/auth";
import { logAPI } from "../../../lib/logger";
import dbConnect from "../../../lib/dbConnect";
import User from "../../../models/User";
import { resolveFeatures, sanitizeFeatures } from "../../../lib/features";

/**
 * Admin management of per-user feature access.
 *   GET  -> list users with their resolved feature map
 *   PUT  -> { userId, features } set a user's feature access
 */
export default async function handler(req, res) {
    logAPI(req);
    const decoded = await verifyAdmin(req, res);
    if (!decoded) return;

    try {
        await dbConnect();

        if (req.method === "GET") {
            const users = await User.find({})
                .select("username email role approved features features_onboarded_at created_at")
                .lean();
            const data = users.map(u => ({
                _id: String(u._id),
                username: u.username,
                email: u.email,
                role: u.role,
                approved: u.approved,
                onboarded: u.features_onboarded_at != null,
                features: resolveFeatures(u),
            }));
            return res.status(200).json({ success: true, data });
        }

        if (req.method === "PUT") {
            const { userId, features } = req.body || {};
            if (!userId) {
                return res.status(400).json({ success: false, message: "userId is required" });
            }
            if (features === undefined || typeof features !== "object") {
                return res.status(400).json({ success: false, message: "features must be an object" });
            }

            const updated = await User.findByIdAndUpdate(
                userId,
                { $set: { features: sanitizeFeatures(features) } },
                { new: true }
            ).select("username email role approved features features_onboarded_at created_at");

            if (!updated) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            return res.status(200).json({
                success: true,
                data: {
                    _id: String(updated._id),
                    username: updated.username,
                    email: updated.email,
                    role: updated.role,
                    approved: updated.approved,
                    onboarded: updated.features_onboarded_at != null,
                    features: resolveFeatures(updated),
                },
            });
        }

        return res.status(405).json({ success: false, message: "Method Not Allowed" });
    } catch (error) {
        console.error("API Error in /api/admin/users:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}
