import { verify } from "jsonwebtoken";
import { secret } from "./dbsecret";
import dbConnect from "./dbConnect";
import User from "../models/User";
import { hasFeature } from "./features";

/**
 * Verifies the EDGEtoken from headers and handles error responses.
 * Returns decoded data if successful, otherwise sends response and returns null.
 */
export async function verifyToken(req: any, res: any): Promise<any> {
    const token = req.headers.edgetoken; // Strictly use headers for EDGEtoken

    if (!token) {
        res.status(401).json({ success: false, message: "Unauthorized: Token missing" });
        return null;
    }

    return new Promise((resolve) => {
        verify(token, secret, (err: any, decoded: any) => {
            if (err) {
                res.status(401).json({ success: false, message: "Unauthorized: " + err.message });
                resolve(null);
            } else {
                resolve(decoded);
            }
        });
    });
}
/**
 * Verifies the EDGEtoken and ensures the user has an 'admin' role.
 */
export async function verifyAdmin(req: any, res: any): Promise<any> {
    const decoded = await verifyToken(req, res);
    if (!decoded) return null;

    if (decoded.role !== 'admin') {
        res.status(403).json({ success: false, message: "Forbidden: Admin access only" });
        return null;
    }

    return decoded;
}

/**
 * Verifies the token AND that the user has the given feature enabled.
 * Admins bypass the feature check. Sends the error response and returns null on
 * failure, otherwise returns the decoded token.
 */
export async function requireFeature(req: any, res: any, decoded: any, key: string): Promise<any> {
    return requireFeatures(req, res, decoded, [key]);
}

/**
 * Like requireFeature but requires EVERY listed key to be enabled. Useful for
 * cross-feature routes (e.g. adding a recipe to a shopping list needs both).
 */
export async function requireFeatures(req: any, res: any, decoded: any, keys: string[]): Promise<any> {
    if (!decoded) return null;

    // Admins manage the whole system, so they always have access.
    if (decoded.role === 'admin') return decoded;

    try {
        await dbConnect();
        const user = await User.findById(decoded.id).select('features features_onboarded_at');
        if (!user) {
            res.status(404).json({ success: false, message: "User not found, please relog" });
            return null;
        }
        const missing = keys.find(key => !hasFeature(user, key));
        if (missing) {
            res.status(403).json({ success: false, message: `Forbidden: '${missing}' is not enabled for this account` });
            return null;
        }
        return decoded;
    } catch (error: any) {
        res.status(500).json({ success: false, message: "Feature check failed: " + error.message });
        return null;
    }
}
