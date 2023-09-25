import Ingredients from '../../../models/Ingredients'


export default async function handler(req, res) {
    if (req.method === "GET") {
        var ingredient_name = req.query.name
        let IngredData = await Ingredients.find({}).exec()
        res.status(200).send({ res: IngredData })
    } else if (req.method === "DELETE") {
        let IngredData = await Ingredients.deleteMany({}).exec()
        res.status(200).json({ success: true, data: IngredData, message: "Success" })
    } else {
        res.status(400).json({ success: false, data: [], message: "Not supported request" })
    }
}







