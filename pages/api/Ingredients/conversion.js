import Ingredients from '../../../models/Ingredients'
import axios from 'axios';
import { filter } from '../../../lib/filtering'
import { convertMetricReading, convertKitchenMetrics, extractProduct } from '../../../lib/conversion'


export default async function handler(req, res) {
    let search_term = req.query.search_term
    let qType = req.query.qType
    let quantity = req.query.quantity
    if (search_term === undefined || qType === undefined || quantity === undefined) {
        
        res.status(400).json({ success: false, data: [], message: "search_term, quantity, qType are required" })
    } else if (req.method === "GET") {
        search_term = search_term.toLowerCase()

        
        if (qType !== undefined) {
            qType = convertMetricReading(qType).quantity_unit
        }

        // We do a basis/basis conversion
        if (qType === "each"){
            
        } 

        let result = convertKitchenMetrics(qType, quantity)


        return res.status(200).send({ success: true, data: result, "loadedSource": true })


        
    } else {
        res.status(400).json({ success: false, data: [], message: "Not supported request" })
    }
}







