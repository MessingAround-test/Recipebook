import dbConnect from '../../lib/dbConnect'
import User from '../../models/User'
import { hashSync } from 'bcryptjs';

export default async function handler(req, res) {
    if (req.method === "POST") {
        try {
            await dbConnect()
            const usersRes = await createUser(req.body)
            res.status(usersRes.success ? 200 : 400).json(usersRes)
        } catch (error) {
            console.error("Signup handler error:", error);
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    } else {
        res.status(405).json({ success: false, data: [], message: "Method Not Allowed" })
    }
}

async function createUser(body) {
    const username = body.username;
    const password = body.password;
    const email = body.email;
    const role = "user";
    const approved = false;

    try {
        let hashval = hashSync(password, 10)
        const res = await User.create({
            username: username,
            email: email,
            passwordHash: hashval,
            approved: approved,
            role: role,
        });
        return { success: true, data: res, message: "Success" }
    } catch (error) {
        console.error("User creation error:", error)
        return { success: false, data: error.message, message: "Incorrect data input or username/email already exists" }
    }
}
