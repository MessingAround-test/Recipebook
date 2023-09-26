
import { secret } from "../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import Ingredients from '../../../models/Ingredients'
import axios from 'axios';
import { filter } from '../../../lib/filtering'


export default async function handler(req, res) {
    //console.log(req.query)
    let search_term = req.query.name
    let supplier = req.query.supplier


    let filterDetails = {
        "search_term": search_term,
        "supplier": supplier,
        "optionSort": req.query.sort,
        "returnN": req.query.returnN,
        "quantity_type": req.query.qType,
    }

    //console.log(search_term)
    if (req.method === "GET") {
        if (search_term === "") {
            let IngredData = await Ingredients.find({}).exec()
            return res.status(200).send({ res: IngredData })
        } else {
            // let IngredData = []
            let search_query = { search_term: search_term }
            if (supplier !== undefined) {
                search_query["source"] = supplier
            }
            let IngredData = await Ingredients.find(search_query).exec()
            if (IngredData.length == 0) {
                let allIngredData = []
                let companies = ["WW", "IGA", "PanettaGG"]
                if (supplier !== undefined) {
                    companies = [supplier]
                }

                for (let supplierIndex in companies) {
                    //console.log(`SUPPLEIR INDEX =${supplierIndex}`)
                    let supplier = companies[supplierIndex]
                    //console.log(`http://localhost:8080/api/Ingredients/${supplier}/${search_term}?EDGEtoken=${req.query.EDGEtoken}`)
                    let newIngredData = await axios({
                        method: 'get',
                        url: `http://localhost:8080/api/Ingredients/${supplier}/${search_term}?EDGEtoken=${req.query.EDGEtoken}`,
                    })

                    if (newIngredData.data.success === true && newIngredData.data.res.length > 0) {
                        allIngredData = [...allIngredData.concat(newIngredData.data.res)]
                    } else {
                        //console.log(newIngredData)
                    }
                    //console.log(`SUCCESS WAS: at  ${newIngredData.data.success} at len: ${newIngredData.data.res.length} total len = ${allIngredData.length}`)


                }
                // Re-search at the end and get results
                // allIngredData = await Ingredients.find(search_query).exec()
                return res.status(200).send({ res: allIngredData, "loadedSource": false })
            } else {
                console.log("yes maam we made it")
                IngredData = filter(IngredData, filterDetails)
                return res.status(200).send({ success: true, res: IngredData, "loadedSource": false })
            }
        }
    } else if (req.method === "DELETE") {
        let search_term = req.query.name
        if (search_term === "") {
            let IngredData = await Ingredients.deleteMany({}).exec()
            return res.status(200).json({ success: true, data: IngredData, message: "Success" })
        } else {
            let IngredData = await Ingredients.deleteMany({ "search_term": search_term }).exec()
            return res.status(200).json({ success: true, data: IngredData, message: "Success" })
        }
    } else {
        return res.status(400).json({ success: false, data: [], message: "Not supported request" })
    }
}







