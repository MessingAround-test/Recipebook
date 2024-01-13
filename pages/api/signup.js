import dbConnect from '../../lib/dbConnect'
import User from '../../models/User'
import { hash } from 'bcrypt';


export default async function handler(req, res) {
    if (req.method === "POST") {
        await dbConnect()
        const usersRes = await (createUser(req.body))
        res.status(200).json(usersRes)
    } else {
        res.status(400).json({ success: false, data: [], message: "Only support POST" })
    }

}


async function createUser(body) {
    // userModel.
    const username = body.username;
    const password = body.password;
    const email = body.email;
    const role = "user";
    const approved = false;
    console.log(username + ": " + password + ": " + email);
    let hashval = hash(password, 10)
    
    try {
        const res = User.create({
            username: username,
            email: email,
            password: password,
            passwordHash: await hashval,
            approved: approved,
            role: role,
        });
        console.log(await res);
        return { success: true, data: await res, message: "Success" }
    } catch (error)  {
        console.log(error)
        return { success: false, data: error, message: "Incorrect data input" }
    }
    
    

    // let response = hash(password, 10, async function (err, hash) {
    //     try {
    //         const res = User.create({
    //             username: username,
    //             email: email,
    //             password: password,
    //             passwordHash: hash,
    //             approved: approved,
    //             role: role,
    //         });
    //         console.log(await res);
    //         return res;
    //     } catch (error) {
    //         console.log(error)
    //         return error
    //     }

    // })

    // return await response
}
