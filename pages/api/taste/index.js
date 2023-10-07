import axios from 'axios';
import { filter } from '../../../lib/filtering'
import { convertMetricReading } from '../../../lib/conversion'

function removeHtmlTags(input) {
    return input.replace(/<[^>]*>/g, "");
}

export default async function handler(req, res) {
    if (req.method === "GET") {
        var url = req.query.url
        const regexPattern = /<div\s+class="ingredient-description"\s+data-raw-ingredient="([^"]+)"\s*>([^<]+)<\/div>/gs;

        let response = await axios({
            method: 'get',
            url: url,
        })
        const htmlContent = response.data; // HTML content of the response
        console.log(htmlContent)

        // Apply the regex pattern to extract ingredient descriptions
        const matches = [...htmlContent.matchAll(regexPattern)];
        let ingredients = []
        // Loop through the matches and access the captured groups
        matches.forEach((match, index) => {
            const rawIngredient = match[1]; // Value of data-raw-ingredient attribute
            const ingredientDescription = match[2]; // Ingredient description text
            let converted;
            try {
                converted = convertMetricReading(rawIngredient)
            } catch (error) {
                console.log(error)
            }
            ingredients.push({ "ingredient": rawIngredient, "converted": converted })
        });



        // Regex pattern to extract step numbers
        const stepNumberPattern = /<a class="recipe-method-step-number">(.*?)<\/a>/g;

        // Regex pattern to extract instructions
        const instructionPattern = /<div class="recipe-method-step-content[^>]*?">(.*?)<\/div>/gs;

        // Find all step numbers and instructions using regex
        const stepNumbers = Array.from(htmlContent.matchAll(stepNumberPattern), match => match[1].trim());
        const instructions = Array.from(htmlContent.matchAll(instructionPattern), match => match[1].trim());

        // Clean up the extracted data (remove extra spaces and newlines)
        const cleanedInstructions = instructions.map(instruction => instruction.replace(/\s+/g, ' '));


        let instructionsAsJson = []
        // Print the results
        for (let i = 0; i < stepNumbers.length; i++) {
            // console.log(`Step ${stepNumbers[i]}: ${cleanedInstructions[i]}\n`);
            instructionsAsJson.push({ "stepNumber": stepNumbers[i], "instruction": removeHtmlTags(cleanedInstructions[i]) })
        }

        let responseObject = {
            "ingredients": ingredients,
            "instructions": instructionsAsJson
        }

        res.status(400).json({ success: true, data: responseObject, message: "" })

    } else {
        res.status(400).json({ success: false, data: [], message: "Not supported request" })
    }
}







