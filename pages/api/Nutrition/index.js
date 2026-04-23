import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import { promises as fs } from 'fs';
import { parse } from 'csv-parse';
import { convertMetricReading, convertKitchenMetrics, extractProduct } from '../../../lib/conversion'
import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'

function joinRecords(sourceData, joinedData, sourceKeyToMatch, joinedKeyToMatch, storeKey, multiJoin) {
    let joinedRecordList = [];
    let joinedDataMap = new Map();

    for (let joinableRecord of joinedData) {
        let joinKeyValue = joinableRecord[joinedKeyToMatch];
        if (!joinedDataMap.has(joinKeyValue)) {
            joinedDataMap.set(joinKeyValue, []);
        }
        joinedDataMap.get(joinKeyValue).push(joinableRecord);
    }

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
    let result = parse(file, {})
    let records = []
    for await (const record of result) {
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
                obj[key] = parseFloat(obj[key]) * ratio;
            }
        }
    }
    return obj
}

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        await dbConnect()
        let db_id = decoded.id
        let userData = await User.findOne({ id: db_id });
        if (!userData) {
            return res.status(404).json({ res: "user not found, please relog" })
        }

        if (req.method === "GET") {
            let search_term = req.query.search_term
            let qType = req.query.qType
            let quantity = req.query.quantity

            if (search_term !== undefined && qType !== undefined && quantity !== undefined) {
                qType = convertMetricReading(qType).quantity_unit

                if (qType !== "gram") {
                    let conversion = convertKitchenMetrics(qType, quantity)
                    if (conversion !== null) {
                        qType = "gram"
                        quantity = conversion.gram
                    }
                }

                if (quantity === null || quantity === undefined) {
                    return res.status(400).json({ success: false, message: "Bad quantity passed" })
                } else {
                if (quantity === null || quantity === undefined) {
                    return res.status(400).json({ success: false, message: "Bad quantity passed" })
                } else {
                    const { logSearchAndGetConversion } = require('../../../lib/searchLogger');
                    const conversion = await logSearchAndGetConversion(search_term, "NutritionAPI", true, "", req.headers.edgetoken || "");

                    if (!conversion) {
                        return res.status(200).json({ success: true, data: [], conversion: { qType: qType, quantity: quantity } });
                    }

                    // Scale nutrients
                    // All nutrients in IngredientConversion are per 100g
                    const { normalizeToGrams } = require('../../../lib/conversion');
                    const { value: grams } = normalizeToGrams(qType, Number(quantity), conversion.grams_per_each);
                    const ratio = (grams ?? 0) / 100;

                    const scaledNutrients = {
                        protein: (conversion.protein_g || 0) * ratio,
                        fat: (conversion.fat_g || 0) * ratio,
                        carbohydrates: (conversion.carbohydrates_g || 0) * ratio,
                        fiber: (conversion.fiber_g || 0) * ratio,
                        energy: (conversion.energy_kcal || 0) * ratio,
                        // Compatibility for older UI expectations
                        iron: (conversion.iron_mg || 0) * ratio
                    };

                    const result = {
                        name: conversion.ingredient_name,
                        quantity: quantity,
                        quantity_unit: qType,
                        nutrition_info: scaledNutrients,
                    };

                    // Scale all other keys from IngredientConversion
                    const raw = conversion.toObject();
                    Object.keys(raw).forEach(key => {
                        if (typeof raw[key] === 'number' && key !== 'nutrients_version' && key !== 'grams_per_each') {
                            result[key] = raw[key] * ratio;
                        } else if (!result[key]) {
                            result[key] = raw[key];
                        }
                    });

                    return res.status(200).json({ success: true, data: [result], conversion: { qType: qType, quantity: quantity } })
                }
                }
            } else {
                return res.status(400).json({ success: false, message: "Missing query parameters: search_term, qType and quantity are required" })
            }
        } else if (req.method === "POST") {
            try {
                const file = await fs.readFile(process.cwd() + '/public/foodNutrientCSV.csv', 'utf8');
                let result = parse(file, {})
                let records = []
                for await (const record of result) {
                    records.push(record);
                }

                let jsonList = await convertCSVToJson(records)
                for (const record of jsonList) {
                    let nutrition_info = {
                        protein: parseFloat(record["Protein (g)"]),
                        fat: parseFloat(record["Fat, total (g)"]),
                        carbohydrates: parseFloat(record["Available carbohydrate, with sugar alcohols (g)"]),
                        fiber: parseFloat(record["Total dietary fibre (g)"]),
                        iron: parseFloat(record["Iron (Fe) (mg)"])
                    }

                    await NutritionalInfo.create({
                        name: record["Food Name"].split(",")[0].toLowerCase(),
                        extra_info: record["Food Name"].split(",").map(item => item.trim().toLowerCase()),
                        source: "Aus Gov",
                        quantity: 100,
                        quantity_type: "weight",
                        quantity_unit: "g",
                        nutrition_info: nutrition_info
                    });
                }
                return res.status(200).json({ success: true, data: jsonList, message: "Success" })
            } catch (error) {
                return res.status(400).json({ success: false, message: String(error) })
            }
        } else if (req.method === "DELETE") {
            if (userData.role !== "admin") {
                return res.status(403).json({ message: "Insufficient Privileges" })
            } else {
                let NutritionalInfoData = await NutritionalInfo.deleteMany({})
                return res.status(200).json({ res: NutritionalInfoData, success: true })
            }
        } else if (req.method === "PATCH") {
            try {
                const food_groups = await fileToJson('/public/nutrients/USDA-SR26/FD_GROUP.csv')
                const food_des = await fileToJson('/public/nutrients/USDA-SR26/FOOD_DES.csv')
                const food_nutrients = await fileToJson('/public/nutrients/USDA-SR26/NUT_DATA.csv')
                const food_nutrients_names = await fileToJson('/public/nutrients/USDA-SR26/NUTR_DEF.csv')
                const food_weight = await fileToJson('/public/nutrients/USDA-SR26/WEIGHT.csv')

                let joinedInCategories = joinRecords(food_des, food_groups, "FdGrp_Cd", "FdGrp_CD", "cateogryInfo", true)
                let joinedInNutrientNames = joinRecords(food_nutrients, food_nutrients_names, "Nutr_No", "Nutr_No", "record", false)
                let joinedInNutrients = joinRecords(joinedInCategories, joinedInNutrientNames, "NDB_No", "NDB_No", "nutrients", true)
                let joinedWeight = joinRecords(joinedInNutrients, food_weight, "NDB_No", "NDB_No", "weight", true)

                for (const record of joinedWeight) {
                    const getNtr = (name) => {
                        let filter = record.nutrients.filter(instance => instance.record && instance.record.NutrDesc === name);
                        return filter.length > 0 ? parseFloat(filter[0].Nutr_Val) : undefined;
                    }

                    await NutritionalInfo.create({
                        name: record["Long_Desc"].split(",")[0].toLowerCase(),
                        extra_info: record["Long_Desc"].split(",").map(item => item.trim().toLowerCase()),
                        source: "US Gov",
                        quantity: 100,
                        quantity_type: "weight",
                        quantity_unit: "g",
                        nutrition_info: {
                            protein: getNtr("Protein"),
                            fat: getNtr("Total lipid (fat)"),
                            carbohydrates: getNtr("Carbohydrate, by difference"),
                            fiber: getNtr("Fiber, total dietary"),
                            iron: getNtr("Iron, Fe")
                        }
                    });
                }
                return res.status(200).json({ success: true, data: { "inserted": joinedWeight.length }, message: "Success" })
            } catch (error) {
                return res.status(400).json({ success: false, message: String(error) })
            }
        } else {
            return res.status(405).json({ success: false, message: "Method Not Allowed" })
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}
