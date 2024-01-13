import Ingredients from '../../../models/Ingredients'



export default async function handler(req, res) {
    let search_term = req.query.search_term
    if (search_term !== undefined) {
        search_term = search_term.toLowerCase()
    }
    if (req.method === "GET") {
        if (search_term === "" || search_term === undefined) {
            let IngredData = await Ingredients.distinct("search_term").exec()
            return res.status(200).send({success: true, data: IngredData , message: ""})
        } 
    }  else {
        res.status(400).json({ success: false, data: [], message: "Not supported request" })
    }
}







