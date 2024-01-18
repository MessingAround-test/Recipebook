
import { secret } from "../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import ShoppingList from '../../../models/ShoppingList'



export default async function handler(req, res) {


    verify(req.query.EDGEtoken, secret, async function (err, decoded) {
        if (err) {
            res.status(400).json({ res: "error: " + String(err) })
        } else {
            if (req.method === "GET") {

                await dbConnect()

                console.log(decoded)
                let db_id = decoded.id
                let userData = await User.findOne({ id: db_id });
                if (userData._id === undefined) {
                    res.status(400).json({ res: "user not found, please relog" })
                } else {

                    let ShoppingListData = await ShoppingList.find({})
                    res.status(200).json({ res: ShoppingListData })
                }
            } else if (req.method === "POST") {
                // console.log(req.body)
                try {
                    await dbConnect()
                    let db_id = decoded.id
                    let userData = await User.findOne({ id: db_id });
                    console.log(req.query)
                    console.log(req.body)
                    
                    const response = ShoppingList.create({
                        name: req.body.name,
                        createdBy:  userData._id,
                        deleted: false,
                        note: req.body.note,
                        complete: false,
                        image: req.body.image
                    });
                    console.log(await response);

                    res.status(200).json({ success: true, data: [], message: "Allgood" })
                } catch (error) {
                    console.log(error)
                    res.status(400).json({ success: false, data: [], message: String(error) })
                }
            } else {
                res.status(400).json({ success: false, data: [], message: "Not supported request" })
            }
        }
    });





}
