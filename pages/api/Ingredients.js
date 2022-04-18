
import { secret } from "../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../lib/dbConnect'
import User from '../../models/User'
import Ingredients from '../../models/Ingredients'
import axios from 'axios';

export default async function handler(req, res) {


    verify(req.query.EDGEtoken, secret, async function (err, decoded) {
        if (err) {
            res.status(400).json({ res: "error: " + String(err) })
        } else {
            if (req.method === "GET") {
                await dbConnect()
                try {
                    var ingredientName = req.query.ingredient
                    var ingredientMeasure = req.query.measurement
                    
                    var ingredientMeasureMapping = {
                        "x": "EA",
                        "g": "KG",
                        "c": "KG",
                        "ml": "ML"
                    }

                    var ingredientMeasureMapped = ingredientMeasureMapping[ingredientMeasure]

                    var IngredientsData = await Ingredients.find({ name: ingredientName })
                    if (ingredientName !== undefined) {
                        // We want to load the ingredient from woolworths 
                        console.log(ingredientName)
                        
                        var newIngredData= await axios({
                            method: 'get',
                            url: 'https://www.woolworths.com.au/apis/ui/v2/Search/products?searchTerm=' + ingredientName,
                            
                          })
                            
                        
                        // console.log(newIngredData.data)
                        var filteredDataArray = []
                        var backupDataArray = []
                        for (var ingredData in newIngredData.data.Products){
                            var filteredData = newIngredData.data.Products[ingredData].Products[0]
                            var filteredObj = {
                                "WW_Name": filteredData.Name,
                                "price": filteredData.CupPrice,
                                "measure": filteredData.CupMeasure,
                                "search_Name": ingredientName
                            }
                            
                            if (String(filteredData.CupMeasure).includes(String(ingredientMeasureMapped))){
                                filteredDataArray.push(filteredObj)
                            } 
                            if (filteredData.CupPrice !== undefined && filteredData.CupPrice !== ""){
                                backupDataArray.push(filteredObj)
                            }
                            
                            // console.log(filteredData)
                        }
                    }
                    if (filteredDataArray.length > 0) {
                        res.status(200).json({ success: true, data:  filteredDataArray[0], message: "", search: ingredientName})
                    } else {
                        if (backupDataArray.length > 0) {
                            res.status(200).json({ success: true, data:  backupDataArray[0], message: "", search: ingredientName})
                        } else {
                            res.status(200).json({ success: false, data:  {}, message: "None Found", search: ingredientName})
                        }

                        
                    }
                    
                } catch (error) {
                    res.status(400).json({ success: false, data: [], message: String(error) })
                }
        


      } else {
                res.status(400).json({ success: false, data: [], message: "Not supported request" })
            }
        }
    });





}
