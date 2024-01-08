
import { secret } from "../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import ShoppingListItem from '../../../models/ShoppingListItem'

import ShoppingList from '../../../models/ShoppingList'
import Ingredient from '../../../models/Ingredients'

export default async function handler(req, res) {
    verify(req.query.EDGEtoken, secret, async function (err, decoded) {
        if (err) {
            res.status(400).json({ res: "error: " + String(err) })
        } else {
            if (req.method === "GET") {
                try {
                    await dbConnect()

                    console.log(decoded)
                    var db_id = decoded.id
                    var userData = await User.findOne({ id: db_id });
                    if (userData._id === undefined) {
                        res.status(400).json({ res: "user not found, please relog" })
                    } else {
                        if (req.query.shoppingListId === undefined) {
                            throw "shoppingListId is required"
                        }

                        var ShoppingListItemData = await ShoppingListItem.find({shoppingListId: req.query.shoppingListId })
                        res.status(200).json({ res: ShoppingListItemData })
                    }
                } catch (error) {
                    console.log(error.line)
                    console.log(error)
                    res.status(400).json({ success: false, data: [], message: String(error) })
                }

            } else if (req.method === "POST") {
                // console.log(req.body)
                try {
                    await dbConnect()
                    var db_id = decoded.id
                    console.log("HERE")


                    var userData = await User.findOne({ id: db_id });
                    console.log(req.query)
                    console.log(req.body)
                    // if (req.body.ingredientId === undefined){
                    //     throw "ingredientId is required"
                    // }

                    if (req.body.shoppingListId === undefined) {
                        throw "shoppingListId is required"
                    }

                    // var ingredient = await Ingredient.findOne({id: req.body.ingredientId})

                    // if (ingredient === null ||ingredient.id === undefined){
                    //     throw "Ingredient does not exist"
                    // }


                    var shoppingList = await ShoppingList.findOne({ _id: req.body.shoppingListId })
                    console.log(shoppingList)
                    console.log(req.body.shoppingListId)
                    if (shoppingList === null || shoppingList._id === undefined) {
                        throw "ShoppingList does not exist"
                    }

                    const response = ShoppingListItem.create({
                        name: req.body.name,
                        createdBy: userData._id,
                        deleted: false,
                        note: req.body.note,
                        complete: false,
                        quantity_type: req.body.quantity_type,
                        quantity: req.body.quantity,
                        shoppingListId: req.body.shoppingListId,
                        ingredientId: req.body.ingredientId,
                        category: req.body.category,
                    });
                    console.log(await response);

                    res.status(200).json({ success: true, data: [], message: "Allgood" })
                } catch (error) {
                    console.log(error.line)
                    console.log(error)
                    res.status(400).json({ success: false, data: [], message: String(error) })
                }
            } else {
                res.status(400).json({ success: false, data: [], message: "Not supported request" })
            }
        }
    });





}
