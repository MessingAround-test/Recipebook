import Ingredients from '../../../models/Ingredients'
import axios from 'axios';
import { filter } from '../../../lib/filtering'
import { convertMetricReading } from '../../../lib/conversion'


export default async function handler(req, res) {
    if (req.method === "GET") {
        var search_term = req.query.name
        if (search_term !== undefined){
            search_term = search_term.toLowerCase()
        }
        let qType = req.query.qType

        if (qType !== undefined){
            qType = convertMetricReading(qType).quantity_unit
        }

        let supplier = req.query.supplier
        let filterDetails = {
            "search_term": search_term,
            "supplier": supplier,
            "optionSort": req.query.sort,
            "returnN": req.query.returnN,
            "quantity_unit": qType,
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
            
            let IngredData = await Ingredients.find(search_query).exec()
            console.log(IngredData)
            if (IngredData.length == 0) {
                let allIngredData = []
                let companies = ["WW", "IGA", "PanettaGG"]
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
                let IngredData = filter(allIngredData, filterDetails)
                return res.status(200).send({ success: true, res: IngredData, "loadedSource": true })
            } else {
                let filteredIngredData =  filter(IngredData, filterDetails) 
                // IngredData 
                return res.status(200).send({ success: true, res: filteredIngredData, "loadedSource": false })
            }
        }
    } else if (req.method === "DELETE") {
        let IngredData = await Ingredients.deleteMany({}).exec()
        res.status(200).json({ success: true, data: IngredData, message: "Success" })
    } else {
        res.status(400).json({ success: false, data: [], message: "Not supported request" })
    }
}







