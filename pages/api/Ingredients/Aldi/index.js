
import { secret } from "../../../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../../../lib/dbConnect'
import User from '../../../../models/User'
import AldiIngredient from '../../../../models/AldiIngredient'
import Ingredients from '../../../../models/Ingredients'
import axios from 'axios';
import JSSoup from 'jssoup';
import { convertMetricReading } from '../../../../lib/conversion'


// Function to calculate Levenshtein distance between two strings
function calculateLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
  
    const matrix = [];
  
    // Initialize the matrix
    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }
  
    // Fill in the matrix
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // Deletion
          matrix[i][j - 1] + 1, // Insertion
          matrix[i - 1][j - 1] + cost // Substitution
        );
      }
    }
  
    return matrix[a.length][b.length];
  }
// Function to find matches from the list of dictionaries and filter down to the top 5
function findMatches(inputIngredient, products, maxNameLength) {
    const threshold = 5; // Default threshold
    const boostThreshold = 2; // Lower threshold for boosted matches
    const matches = [];
  
    for (const product of products) {
      const productName = product.name;
      const productNameLower = productName.toLowerCase();
      const inputIngredientLower = inputIngredient.toLowerCase();
  
      if (productNameLower.includes(inputIngredientLower)) {
        // Input term found in product name - apply a boost
        matches.push({ ...product, distance: -1 });
      } else {
        const distance = calculateLevenshteinDistance(
          inputIngredientLower,
          productNameLower
        );
  
        if (distance <= threshold) {
          matches.push({ ...product, distance });
        }
      }
    }
  
    if (matches.length > 0) {
      // Filter out long product names
      matches.sort((a, b) => (a.distance < b.distance ? -1 : 1));
      return matches;
      // Return the top 5 matches or fewer if there are fewer than 5 matches
      
    } else {
      return [];
    }
  }
// This one is different, its a extract and then we can query it later...
/**
 * @swagger
 * /api/Ingredients/WW/Aldi:
 *   get:
 *     description: Returns Token from Login
 *     responses:
 *       200:
 *         description: hello world
 */

function removeSpecialChars(text) {
    text = text.replace(/<[^>]*>/g, '');

    // Replace special characters with spaces
    text = text.replace(/[^\w\s]/g, ' ');

    // Remove extra spaces and trim
    text = text.replace(/\s+/g, ' ').trim();
    return text
}

async function extractFromAldi(endpoint, formattedDateTime) {
    let ingredList = []
    try {

        // Make an HTTP GET request to the URL
        console.log(endpoint)
        const response = await axios.get(endpoint);
        // console.log(response.data)
        // Parse the HTML content using JSSoup
        const soup = new JSSoup(response.data, true);

        // Extract the data you need from the parsed HTML
        const targetDivs = soup.findAll('div', 'ratio-container');

        let source = "Aldi"
        if (targetDivs.length > 0) {
            // Loop through the found div elements and process them as needed
            targetDivs.forEach((parentDiv) => {
                try {
                    const priceDiv = parentDiv.find('div', 'box--price');
                    let quantity_unit
                    let price;
                    let quantity;
                    let quantity_type;

                    if (priceDiv) {
                        let dollars = parseFloat((priceDiv.find("span", "box--value").text).replace("$", ""))
                        let cents = parseFloat((priceDiv.find("span", "box--decimal").text).replace("$", ""))
                        price = Number((dollars + cents / 100).toFixed(2))

                        // console.log(priceDiv.prettify()); // Output the prettified HTML of each matching sub div
                    } else {
                        console.log('No matching sub div with class "box--price" found in the parent div.');
                    }

                    let internal_id = formattedDateTime

                    let name = removeSpecialChars(parentDiv.find("div", "box--description--header").text)


                    // If quantity type is not defined or null then extract from the name
                    if (!(quantity_unit)) {

                        let metricConversion = convertMetricReading(name)
                        // console.log(metricConversion)
                        quantity = metricConversion.quantity
                        quantity_unit = metricConversion.quantity_unit
                        quantity_type = metricConversion.quantity_type
                    } else {
                        // If we get a quantity_unit, we need it converted to our format
                        let metricConversion = convertMetricReading(quantity_unit)
                        quantity_unit = metricConversion.quantity_unit
                        quantity_type = metricConversion.quantity_type
                        // console.log(metricConversion)
                        // If the quantity returned is not 1, then multiply it by the quantity
                        if (metricConversion.quantity !== 1) {
                            quantity = quantity * metricConversion.quantity
                        }
                    }
                    let unit_price = parseFloat((price / quantity).toFixed(3))
                    let ingredDict = {
                        "id": source + "-" + name + "-" + internal_id,
                        "name": name,
                        "price": price,
                        "unit_price": unit_price,
                        "quantity_unit": quantity_unit,
                        "quantity_type": quantity_type,
                        "quantity": quantity,
                        "endpoint": endpoint
                    }
                    AldiIngredient.create(ingredDict)
                    ingredList.push(ingredDict)

                } catch (error) {
                    console.log(error)
                }


                // console.log(div.prettify()); // Output the prettified HTML of each matching div
            });

        } else {
            console.log('No matching div elements found.');
        }
    } catch (error) {
        console.error('An error occurred:', error);
    }
    return ingredList
}

function formatCurrentDateTime() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Zero-padding the month
    const day = String(currentDate.getDate()).padStart(2, '0'); // Zero-padding the day
    const hour = String(currentDate.getHours()).padStart(2, '0'); // Zero-padding the hour
    const minute = String(currentDate.getMinutes()).padStart(2, '0'); // Zero-padding the minute

    return `${year}-${month}-${day}-${hour}-${minute}`;
}


export default async function handler(req, res) {
    const formattedDateTime = formatCurrentDateTime();
    console.log(formattedDateTime);



    console.log(req.query)
    var ingredient_name = req.query.name

    verify(req.query.EDGEtoken, secret, async function (err, decoded) {

        try {
            var search_term = req.query.name
            if (err) {
                return res.status(400).json({ res: "error: " + String(err) })
            } else {
                if (req.method === "POST") {
                    let jsonData
                    let ingredList = []
                    let endpointList = [
                        "https://www.aldi.com.au/en/groceries/super-savers/",
                        "https://www.aldi.com.au/en/groceries/limited-time-only/",
                        "https://www.aldi.com.au/en/groceries/price-reductions/",
                        "https://www.aldi.com.au/en/groceries/fresh-produce/dairy-eggs/",
                        "https://www.aldi.com.au/en/groceries/baby/nappies-and-wipes/",
                        "https://www.aldi.com.au/en/groceries/baby/baby-food/",
                        "https://www.aldi.com.au/en/groceries/beauty/",
                        "https://www.aldi.com.au/en/groceries/freezer/",
                        "https://www.aldi.com.au/en/groceries/health/",
                        "https://www.aldi.com.au/en/groceries/laundry-household/laundry/",
                        "https://www.aldi.com.au/en/groceries/laundry-household/household/",
                        "https://www.aldi.com.au/en/groceries/liquor/wine/",
                        "https://www.aldi.com.au/en/groceries/liquor/beer-cider/",
                        "https://www.aldi.com.au/en/groceries/liquor/champagne-sparkling/",
                        "https://www.aldi.com.au/en/groceries/liquor/spirits/",
                        "https://www.aldi.com.au/en/special-buys/special-buys-liquor/",
                        "https://www.aldi.com.au/en/groceries/pantry/olive-oil/",
                        "https://www.aldi.com.au/en/groceries/pantry/chocolate/",
                        "https://www.aldi.com.au/en/groceries/pantry/coffee/"
                    ]
                    endpointList.forEach(async function (endpoint) {
                        ingredList.concat(extractFromAldi(endpoint, formattedDateTime))
                    })



                    return res.status(200).send({ res: ingredList, success: true })





                } else if (req.method === "DELETE") {
                    await dbConnect()

                    console.log(decoded)
                    var db_id = decoded.id
                    var userData = await User.findOne({ id: db_id });
                    if (userData == {}) {
                        return res.status(400).json({ res: "user not found, please relog" })
                    } else {

                        var RecipeData = await AldiIngredient.deleteMany({})
                        return res.status(200).json({ success: true, data: RecipeData, message: "Success" })
                    }
                    return res.status(400).json({ success: false, data: [], message: "Not supported request" })
                } else if (req.method === "GET") {
                    if (ingredient_name !== undefined && ingredient_name !== null) {
                        // Get out of the ALdi DB
                        let allIngreds = await AldiIngredient.find({}).lean().exec()
                        console.log(allIngreds)
                        console.log("SEARCH TERM =")
                        console.log(search_term)
                        let matchedProducts = findMatches(search_term, allIngreds);
                        console.log("Matches:", matchedProducts);
                        var filteredDataArray = []
                        let source = "Aldi"
                        console.log(matchedProducts)
                        // filteredDataArray = newIngredData
                        for (let ingredData in matchedProducts) {


                            let filteredData = matchedProducts[ingredData]
                            let name = filteredData.name
                            let internal_id = filteredData.id
                            let quantity_unit = filteredData.quantity_unit
                            let quantity_type = filteredData.quantity_type
                            let unit_price = filteredData.unit_price
                            let price = filteredData.price
                            let quantity = filteredData.quantity

                            var filteredObj = {
                                "id": source + "-" + name + "-" + internal_id,
                                "name": name,
                                "price": price,
                                "unit_price": unit_price,
                                "quantity_unit": quantity_unit,
                                "quantity_type": quantity_type,
                                "quantity": quantity,
                                "search_term": search_term,
                                "source": source,
                                // "extraData": filteredData

                            }
                            console.log(filteredObj)
                            const response = Ingredients.create({
                                "id": source + "-" + name + "-" + internal_id,
                                "name": name,
                                "price": price,
                                "unit_price": unit_price,
                                "quantity_unit": quantity_unit,
                                "quantity_type": quantity_type,
                                "quantity": quantity,
                                "search_term": search_term,
                                "source": source,
                            });
                            console.log("BEORE CREATE")
                            console.log(await response);


                            filteredDataArray.push(filteredObj)
                        }
                        console.log(filteredDataArray)
                        return res.status(200).send({ res: filteredDataArray, success: true })


                    } else {
                        let IngredData = await AldiIngredient.find({}).lean().exec()
                        return res.status(200).send({ success: true, res: IngredData, message: "" })
                    }


                    // return res.status(400).json({ success: false, data: [], message: "Not supported request" })
                }
                else {
                    return res.status(400).json({ success: false, data: [], message: "Not supported request" })
                }
            }
        } catch (e) {


            res
                .status(200).
                json({ success: false, res: [], message: `ERROR: ${e}` })
        }
    });






}
