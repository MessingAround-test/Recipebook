import { verify } from "jsonwebtoken";
import { secret } from "./dbsecret";

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
