import Ingredients from '../../../models/Ingredients'
import axios from 'axios';
import { filter } from '../../../lib/filtering'

export default async function handler(req, res) {
    if (req.method === "GET") {
        var search_term = req.query.name
        if (search_term !== undefined){
            search_term = search_term.toLowerCase()
        }
        let supplier = req.query.supplier
        let filterDetails = {
            "search_term": search_term,
            "supplier": supplier,
            "optionSort": req.query.sort,
            "returnN": req.query.returnN,
            "quantity_type": req.query.qType,
        }

        if (search_term === "" || search_term === undefined) {
            let IngredData = await Ingredients.find({}).exec()
            return res.status(200).send({ res: IngredData })
        } else {
            // let IngredData = []
            let search_query = { search_term: search_term }
            if (supplier !== undefined) {
                search_query["source"] = supplier
            }
            console.log("HERE HERE")
            console.log(search_query)
            let IngredData = await Ingredients.find(search_query).exec()
            console.log(IngredData)
            if (IngredData.length == 0) {
                let allIngredData = []
                let companies = ["WW"]
                if (supplier !== undefined) {
                    companies = [supplier]
                }

                for (let supplierIndex in companies) {
                    let supplier = companies[supplierIndex]
                    let newIngredData = await axios({
                        method: 'get',
                        url: `http://localhost:8080/api/Ingredients/${supplier}/?name=${search_term}&EDGEtoken=${req.query.EDGEtoken}`,
                    })

                    if (newIngredData.data.success === true && newIngredData.data.res.length > 0) {
                        allIngredData = [...allIngredData.concat(newIngredData.data.res)]
                    }
                }
                // Re-search at the end and get results
                // allIngredData = await Ingredients.find(search_query).exec()
                return res.status(200).send({ success: true, res: allIngredData, "loadedSource": true })
            } else {
                console.log("yes maam we made it")
                IngredData = filter(IngredData, filterDetails)
                return res.status(200).send({ success: true, res: IngredData, "loadedSource": false })
            }
        }
    } else if (req.method === "DELETE") {
        let IngredData = await Ingredients.deleteMany({}).exec()
        res.status(200).json({ success: true, data: IngredData, message: "Success" })
    } else {
        res.status(400).json({ success: false, data: [], message: "Not supported request" })
    }
}







