
import { secret } from "../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import NutritionalInfo from '../../../models/NutritionalInfo'
import { promises as fs } from 'fs';
import { parse } from 'csv-parse';
import { convertMetricReading, convertKitchenMetrics, extractProduct } from '../../../lib/conversion'

function convertCSVToJson(csv) {
    let jsonList = []
    let headers = []
    let recordIndex = 0

    for (const record of csv) {
        // We are on the header row... 
        if (recordIndex === 0) {
            headers = record
            recordIndex += 1
            continue
        }
        recordIndex += 1
        let keyIndex = 0
        let json = {
        }

        for (const col of record) {
            json[headers[keyIndex]] = col
            keyIndex += 1
        }
        jsonList.push(json)
    }
}

function convertNumbersToFloat(obj, ratio) {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (!isNaN(parseFloat(obj[key])) && isFinite(obj[key])) {
                // Convert the value to a floating-point number
                obj[key] = parseFloat(obj[key]) * ratio;
            }
        }
    }
    return obj
}

export default async function handler(req, res) {


    let search_term = req.query.search_term
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
                    let NutritionalInfoData
                    let search_term = req.query.search_term
                    let qType = req.query.qType
                    let quantity = req.query.quantity

                    if (search_term !== undefined && qType !== undefined && quantity !== undefined) {
                        qType = convertMetricReading(qType).quantity_unit

                        // Convert the quantity type if it is not in grams, the current nutrient information is majorly in grams... 
                        if (qType !== "gram") {
                            let conversion = convertKitchenMetrics(qType, quantity)
                            qType = "gram"
                            quantity = conversion.gram
                        }
                        console.log(search_term)

                        if (quantity === null || quantity === undefined) {
                            res.status(400).json({ success: false, data: [], message: String("Bad quantity passed") })
                        } else {


                            NutritionalInfoData = await NutritionalInfo.find({ name: search_term.toLowerCase() })
                            if (NutritionalInfoData.length === 0) {
                                // Try simplifying the search
                                let new_term = extractProduct(search_term)
                                NutritionalInfoData = await NutritionalInfo.find({ name: new_term.toLowerCase() })
                            }

                            if (NutritionalInfoData.length > 0) {
                                let nutrition_quantity = NutritionalInfoData[0].quantity
                                let nutrition_quantity_type = convertMetricReading(NutritionalInfoData[0].quantity_unit).quantity_unit

                                let quantity_ratio = quantity / nutrition_quantity
                                NutritionalInfoData = NutritionalInfoData[0]
                                NutritionalInfoData.quantity = quantity

                                NutritionalInfoData.nutrition_info = convertNumbersToFloat(NutritionalInfoData.nutrition_info, quantity_ratio);
                            }


                            res.status(200).json({ success: true, data: [NutritionalInfoData], conversion: { qType: qType, quantity: quantity } })
                        }
                    } else {
                        res.status(400).json({ success: false, data: [], message: String("Missing query parameters: search_term, qType and quantity are required") })

                        // NutritionalInfoData= await NutritionalInfo.find({})
                    }




                }
            } else if (req.method === "POST") {
                // console.log(req.body)
                try {
                    await dbConnect()
                    let db_id = decoded.id
                    let userData = await User.findOne({ id: db_id });

                    // console.log(req.query)
                    // console.log(req.body)
                    const file = await fs.readFile(process.cwd() + '/public/foodNutrientCSV.csv', 'utf8');
                    // console.log(file)
                    let result = parse(file, {
                    })
                    let records = []
                    for await (const record of result) {
                        // Work with each record
                        records.push(record);
                    }

                    let jsonList = []
                    let headers = []
                    let recordIndex = 0

                    for await (const record of records) {
                        // We are on the header row... 
                        if (recordIndex === 0) {
                            headers = record
                            recordIndex += 1
                            continue
                        }
                        recordIndex += 1
                        let keyIndex = 0
                        let json = {
                        }

                        for (const col of record) {
                            json[headers[keyIndex]] = col
                            keyIndex += 1
                        }
                        jsonList.push(json)
                    }

                    for (const record of jsonList) {
                        let response = NutritionalInfo.create({
                            name: record["Food Name"].split(",")[0].toLowerCase(),
                            extra_info: record["Food Name"].split(",").slice(1).toString(),
                            source: "Aus Gov",
                            quantity: 100,
                            quantity_type: "weight",
                            quantity_unit: "g",
                            nutrition_info: record
                        });
                    }
                    // console.log(records)
                    // let response = NutritionalInfo.create({
                    //     name: req.body.name,
                    //     createdBy:  userData._id,
                    //     deleted: false,
                    //     note: req.body.note,
                    //     complete: false,
                    // });
                    // console.log(await response);

                    res.status(200).json({ success: true, data: jsonList, message: "Allgood" })
                } catch (error) {
                    console.log(error)
                    res.status(400).json({ success: false, data: [], message: String(error) })
                }
            } else if (req.method === "DELETE") {
                // console.log(req.body)
                await dbConnect()

                console.log(decoded)
                let db_id = decoded.id
                let userData = await User.findOne({ id: db_id });
                if (userData._id === undefined) {
                    res.status(400).json({ res: "user not found, please relog" })
                } else {

                    let NutritionalInfoData = await NutritionalInfo.deleteMany({})
                    res.status(200).json({ res: NutritionalInfoData })
                }
            } else {
                res.status(400).json({ success: false, data: [], message: "Not supported request" })
            }
        }
    });





}
