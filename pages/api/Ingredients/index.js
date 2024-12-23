import Ingredients from '../../../models/Ingredients'
import axios from 'axios';
import { filter } from '../../../lib/filtering'
import { convertMetricReading } from '../../../lib/conversion'
import dbConnect from '../../../lib/dbConnect'
import { verify } from "jsonwebtoken";
import { secret } from "../../../lib/dbsecret"
import User from '../../../models/User'


export default async function handler(req, res) {
    let search_term = req.query.name
    if (search_term !== undefined) {
        search_term = search_term.toLowerCase()
    }
    if (req.method === "GET") {

        let qType = req.query.qType

        if (qType !== undefined && qType !== "any") {
            qType = convertMetricReading(qType).quantity_unit
        } else {
            qType = undefined
        }

        let supplier = req.query.supplier

        // If we want multiple supplier filters then we pass in the body.
        // Body takes priority


        let filterDetails = {
            "search_term": search_term,
            "supplier": supplier,
            "optionSort": req.query.sort,
            "returnN": req.query.returnN,
            "quantity_unit": qType,
            "quantity": req.query.quantity
        }
        

        if (search_term === "" || search_term === undefined) {
            let IngredData = await Ingredients.find({}).exec()
            return res.status(200).send({ res: IngredData })
        } else {
            // let IngredData = []
            let search_query = { search_term: search_term }
            //  disabled for now... 
            let companies = ["WW", "IGA", "Panetta", "Aldi", "Coles"]
            const supplierParam = req.query.supplier;

            if (supplierParam === undefined) {

            } else if (supplierParam.includes(',')) {
                // Split the comma-separated values into an array
                companies = supplierParam.split(',');

                // Now, 'companies' will be an array of supplier names
                //console.log(companies);

                // You can use 'companies' as an array in your server logic
            } else if (supplierParam == []) {
                // Do nuttin
            } else {
                // Handle the case when 'supplier' does not contain a comma
                //console.log('Supplier parameter does not contain a comma:', supplierParam);
                companies = [supplierParam]
            }

            search_query["source"] = { "$in": companies }


            let IngredData = await Ingredients.find(search_query).exec()
            //console.log(IngredData)
            if (IngredData.length == 0) {
                let allIngredData = []
                // Reset companies so we get from all"Aldi",
                // companies = ["WW", "IGA", "Panetta", "Aldi"]
                companies = ["WW", "IGA", "Panetta", "Aldi", "Coles"]


                for (let supplierIndex in companies) {
                    try {
                        let supplier = companies[supplierIndex]
                        let newIngredData = await axios({
                            method: 'get',
                            url: `http://localhost:8080/api/Ingredients/${supplier}/?name=${search_term}&EDGEtoken=${req.query.EDGEtoken}`,
                        })

                        if (newIngredData.data.success === true && newIngredData.data.res.length > 0) {
                            allIngredData = [...allIngredData.concat(newIngredData.data.res)]
                        }
                    } catch (error) {
                        //console.log("API FAILED")
                        //console.log(error)
                    }
                }
                // Re-search at the end and get results
                // allIngredData = await Ingredients.find(search_query).exec()
                // qType, quantity
                let IngredData = filter(allIngredData, filterDetails)
                return res.status(200).send({ success: true, res: IngredData, "loadedSource": true })
            } else {
                let filteredIngredData = filter(IngredData, filterDetails)
                // IngredData 
                return res.status(200).send({ success: true, res: filteredIngredData, "loadedSource": false })
            }
        }
    } else if (req.method === "DELETE") {
        verify(req.query.EDGEtoken, secret, async function (err, decoded) {

            let id = req.query.id
            let IngredData;
            await dbConnect()

            let db_id = decoded.id
            let userData = await User.findOne({ id: db_id });


            if (id !== undefined && id !== "") {
                IngredData = await Ingredients.deleteOne({ _id: id }).exec()
            } else if (search_term !== undefined && search_term !== "") {
                IngredData = await Ingredients.deleteMany({ search_term: search_term }).exec()
            } else {
                if (userData.role !== "admin") {
                    IngredData = {message: "Insufficient Privileges"}
                    
                } else {
                    IngredData = await Ingredients.deleteMany({}).exec()
                }
                // throw new Error("Please provide either a search term or id")
            }

            // let IngredData = await Ingredients.deleteMany({}).exec()
            res.status(200).json({ success: true, data: IngredData, message: "Success" })


        }
        )
    } else {
        res.status(400).json({ success: false, data: [], message: "Not supported request" })
    }

}







