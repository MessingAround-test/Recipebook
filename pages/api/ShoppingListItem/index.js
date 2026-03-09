import { verifyToken } from "../../../lib/auth";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import ShoppingListItem from '../../../models/ShoppingListItem'

import ShoppingList from '../../../models/ShoppingList'
import Ingredient from '../../../models/Ingredients'
import { getShorthandForMeasure, addCalculatedFields } from '../../../lib/conversion'
import { logAPI } from "../../../lib/logger";
import { safeToObject } from "../../../lib/utils";


function addShorthandToIngredients(ingredients) {
    return ingredients.map((ingredient) => {
        const quantityType = ingredient.quantity_type;
        const shorthand = getShorthandForMeasure(quantityType);

        if (shorthand !== undefined) {
            return { ...safeToObject(ingredient), "quantity_type_shorthand": shorthand };
        } else {
            // console.log(`No shorthand found for ${quantityType}`);
            return safeToObject(ingredient)
        }
    });
}


export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    if (req.method === "GET") {
        try {
            await dbConnect()

            let db_id = decoded.id
            let userData = await User.findOne({ id: db_id });
            if (userData._id === undefined) {
                return res.status(400).json({ res: "user not found, please relog" })
            } else {
                if (req.query.search_term !== undefined && req.query.field !== undefined) {
                    // Provide the search term and search for occurances of that item in the lists
                    let ShoppingListItemData = await ShoppingListItem.find({ name: req.query.search_term })
                    let response = ShoppingListItemData.map((item) => item[req.query.field]).filter((value) => value !== null && value !== undefined);
                    let shorthandRes = await addShorthandToIngredients(response)
                    let dataRes = addCalculatedFields(shorthandRes)
                    dataRes.sort((a, b) => {
                        const nameA = a.name.toLowerCase();
                        const nameB = b.name.toLowerCase();
                        return nameA.localeCompare(nameB);
                    });
                    // let completeRes = addShorthandToIngredients(response)
                    return res.status(200).json({ success: true, data: dataRes })
                } else {
                    // Provide the shopping list id and return the shopping list
                    if (req.query.shoppingListId === undefined) {
                        throw "shoppingListId is required"
                    }

                    let ShoppingListItemData = await ShoppingListItem.find({ shoppingListId: req.query.shoppingListId })
                    let shorthandRes = await addShorthandToIngredients(ShoppingListItemData)
                    let dataRes = addCalculatedFields(shorthandRes)
                    dataRes.sort((a, b) => {
                        const nameA = a.name.toLowerCase();
                        const nameB = b.name.toLowerCase();
                        return nameA.localeCompare(nameB);
                    });
                    return res.status(200).json({ res: dataRes })
                }
            }
        } catch (error) {
            console.log(error)
            return res.status(400).json({ success: false, data: [], message: String(error) })
        }

    } else if (req.method === "POST") {
        // console.log(req.body)
        try {
            await dbConnect()
            let db_id = decoded.id

            let userData = await User.findOne({ id: db_id });

            if (req.body.shoppingListId === undefined) {
                throw "shoppingListId is required"
            }

            let shoppingList = await ShoppingList.findOne({ _id: req.body.shoppingListId })
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

            return res.status(200).json({ success: true, data: [], message: "Allgood" })
        } catch (error) {
            console.log(error)
            return res.status(400).json({ success: false, data: [], message: String(error) })
        }
    } else {
        return res.status(400).json({ success: false, data: [], message: "Not supported request" })
    }
}
