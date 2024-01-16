
import { secret } from "../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import NutritionalInfo from '../../../models/NutritionalInfo'
import { promises as fs } from 'fs';
import { parse } from 'csv-parse';

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
                    if (search_term){
                        NutritionalInfoData= await NutritionalInfo.find({name: search_term})
                    } else {
                        NutritionalInfoData= await NutritionalInfo.find({})
                    }
                     
                    res.status(200).json({ success: true, data: NutritionalInfoData })
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
