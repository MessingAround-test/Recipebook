import dbConnect from '../../lib/dbConnect'
import User from '../../models/User'
import {compare} from "bcryptjs"
import { sign} from "jsonwebtoken"
import {secret} from "../../lib/dbsecret"


/**
 * @swagger
 * /api/login:
 *   post:
 *     description: Returns Token from Login
 *     responses:
 *       200:
 *         description: hello world
 */

export default async function handler (req, res) {
    if (req.method === "POST"){
        await dbConnect()
        try {
            let status = await loginUser(req.body);
            if (status) {
                // generate a access token
                const accessToken = await sign(
                    { id: status._id, email: status.email, role: status.role },
                    secret
                );
                res.status(200).json({ success: true, data: {token: accessToken}, message: "Success" })
            } else {
                throw "incorrect Email or Password";
            }
        } catch (error) {
            console.log(error);
            res.status(400).json({ success: false, data: {}, message: error })
        }
    } else {
        res.status(400).json({ success: false, data: [], message: "Only support POST" })
    }
    
}

async function loginUser(body) {
  const password = body.password;
  const email = body.email;
  // Email is the primary key
  console.log("Login attempt for: " + email)
  const user = await User.find({ email: email });
  if (user.length > 0) {
    const res = await compare(password, user[0].passwordHash);
    if (res == true) {
      // If the password matches
      return user[0];
    } else {
      return null;
    }
  } else {
    return null;
  }
}
