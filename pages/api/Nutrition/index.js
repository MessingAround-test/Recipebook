
import { secret } from "../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import NutritionalInfo from '../../../models/NutritionalInfo'
import { promises as fs } from 'fs';
import { parse } from 'csv-parse';
import { convertMetricReading, convertKitchenMetrics, extractProduct } from '../../../lib/conversion'

function joinRecords(sourceData, joinedData, sourceKeyToMatch, joinedKeyToMatch, storeKey, multiJoin) {
    let joinedRecordList = [];
    let joinedDataMap = new Map();

    // Organize joinedData into a map for faster lookups
    for (let joinableRecord of joinedData) {
        let joinKeyValue = joinableRecord[joinedKeyToMatch];
        if (!joinedDataMap.has(joinKeyValue)) {
            joinedDataMap.set(joinKeyValue, []);
        }
        joinedDataMap.get(joinKeyValue).push(joinableRecord);
    }

    // Perform the join
    for (let record of sourceData) {
        let sourceKeyValue = record[sourceKeyToMatch];

        if (multiJoin) {
            record[storeKey] = joinedDataMap.get(sourceKeyValue) || [];
        } else {
            let matchingRecord = joinedDataMap.get(sourceKeyValue);
            record[storeKey] = matchingRecord ? matchingRecord[0] : null;
        }

        joinedRecordList.push(record);
    }

    return joinedRecordList;
}


async function fileToJson(filename) {
    const file = await fs.readFile(process.cwd() + filename, 'utf8');

    let result = parse(file, {
    })
    let records = []
    for await (const record of result) {
        // Work with each record
        records.push(record);
    }
    let json = await convertCSVToJson(records)
    return json
}

async function convertCSVToJson(csv) {
    let jsonList = [];
    let headers = [];
    let recordIndex = 0;

    for await (const record of csv) {
        // We are on the header row... 
        if (recordIndex === 0) {
            headers = record;
            recordIndex += 1;
            continue;
        }
        recordIndex += 1;
        let keyIndex = 0;
        let json = {};

        for (const col of record) {
            json[headers[keyIndex]] = col;
            keyIndex += 1;
        }
        jsonList.push(json);
    }

    return jsonList;
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
                            if (conversion !== null) {
                                qType = "gram"
                                quantity = conversion.gram
                            }

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
                        let protein = parseFloat(record["Protein (g)"])
                        let fat = parseFloat(record["Fat, total (g)"])
                        let carbohydrates = parseFloat(record["Available carbohydrate, with sugar alcohols (g)"])
                        let fiber = parseFloat(record["Total dietary fibre (g)"])
                        let iron = parseFloat(record["Iron (Fe) (mg)"])

                        let nutrition_info = {
                            protein: protein,
                            fat: fat,
                            carbohydrates: carbohydrates,
                            fiber: fiber,
                            iron: iron
                        }

                        let response = NutritionalInfo.create({
                            name: record["Food Name"].split(",")[0].toLowerCase(),
                            extra_info: record["Food Name"].split(",").map(function test(item) {
                                if (item[0] === " ") {
                                    item = item.slice(1);
                                }
                                return item.trim().toLowerCase();
                            }),
                            source: "Aus Gov",
                            quantity: 100,
                            quantity_type: "weight",
                            quantity_unit: "g",
                            nutrition_info: nutrition_info
                        });
                    }

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
                } else if (userData.role !== "admin") {
                    res.status(400).json({ message: "Insufficient Privileges" })
                } else {

                    let NutritionalInfoData = await NutritionalInfo.deleteMany({})
                    res.status(200).json({ res: NutritionalInfoData, success: true })
                }
            } else if (req.method === "PATCH") {
                try {
                    await dbConnect()
                    let db_id = decoded.id
                    let userData = await User.findOne({ id: db_id });


                    const food_groups = await fileToJson('/public/nutrients/USDA-SR26/FD_GROUP.csv')
                    const food_des = await fileToJson('/public/nutrients/USDA-SR26/FOOD_DES.csv')
                    const food_nutrients = await fileToJson('/public/nutrients/USDA-SR26/NUT_DATA.csv')
                    const food_nutrients_names = await fileToJson('/public/nutrients/USDA-SR26/NUTR_DEF.csv')
                    const food_weight = await fileToJson('/public/nutrients/USDA-SR26/WEIGHT.csv')
                    let joinedInCategories = joinRecords(food_des, food_groups, "FdGrp_Cd", "FdGrp_CD", "cateogryInfo", true)

                    let joinedInNutrientNames = joinRecords(food_nutrients, food_nutrients_names, "Nutr_No", "Nutr_No", "record", false)


                    let joinedInNutrients = joinRecords(joinedInCategories, joinedInNutrientNames, "NDB_No", "NDB_No", "nutrients", true)

                    let joinedWeight = joinRecords(joinedInNutrients, food_weight, "NDB_No", "NDB_No", "weight", true)


                    let allInserts = []
                    for (const record of joinedWeight) {
                        // Search the list of nutrients
                        let protein = record.nutrients.filter(instance => instance.record && instance.record.NutrDesc === "Protein");

                        // deal with no match
                        protein = protein.length > 0 ? parseFloat(protein[0].Nutr_Val) : undefined

                        let fat = record.nutrients.filter(instance => instance.record && instance.record.NutrDesc === "Total lipid (fat)");
                        fat = fat.length > 0 ? parseFloat(fat[0].Nutr_Val) : undefined

                        let carbohydrates = record.nutrients.filter(instance => instance.record && instance.record.NutrDesc === "Carbohydrate, by difference");
                        carbohydrates = carbohydrates.length > 0 ? parseFloat(carbohydrates[0].Nutr_Val) : undefined

                        let fiber = record.nutrients.filter(instance => instance.record && instance.record.NutrDesc === "Fiber, total dietary");
                        fiber = fiber.length > 0 ? parseFloat(fiber[0].Nutr_Val) : undefined

                        let iron = record.nutrients.filter(instance => instance.record && instance.record.NutrDesc === "Iron, Fe");
                        iron = iron.length > 0 ? parseFloat(iron[0].Nutr_Val) : undefined

                        let nutrition_info = {
                            protein: protein,
                            fat: fat,
                            carbohydrates: carbohydrates,
                            fiber: fiber,
                            iron: iron
                        }

                        let response = NutritionalInfo.create({
                            name: record["Long_Desc"].split(",")[0].toLowerCase(),
                            extra_info: record["Long_Desc"].split(",").map(function test(item) {
                                if (item[0] === " ") {
                                    item = item.slice(1);
                                }
                                return item.trim().toLowerCase();
                            }),
                            source: "US Gov",
                            quantity: 100,
                            quantity_type: "weight",
                            quantity_unit: "g",
                            nutrition_info: nutrition_info
                        });
                    }

                    // .map(item => item.Long_Desc)
                    res.status(200).json({ success: true, data: { "inserted": joinedWeight.length }, message: "Allgood" })
                } catch (error) {
                    console.log(error)
                    res.status(400).json({ success: false, data: [], message: String(error) })
                }

            } else {
                res.status(400).json({ success: false, data: [], message: "Not supported request" })
            }
        }
    });





}
