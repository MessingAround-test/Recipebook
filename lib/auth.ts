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
