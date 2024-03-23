import axios from 'axios';
import { filter } from '../../../lib/filtering'
import { convertMetricReading } from '../../../lib/conversion'

function removeHtmlTags(input) {
    return input.replace(/<[^>]*>/g, "");
}

export default async function handler(req, res) {
    if (req.method === "GET") {
        let url = req.query.url
        
        



        let response = await axios({
            method: 'get',
            url: url,
        })
        const htmlContent = response.data; // HTML content of the response

        const ingredientsDiv = htmlContent.match(/<div id="ingredients".*?>([\s\S]*?)<\/div>/)[1];

        // Apply regex to extract <li> elements within the extracted content
        const regexPattern = /<li>(.*?)<\/li>/g;
        // Apply the regex pattern to extract ingredient descriptions
        const matches = [...ingredientsDiv.matchAll(regexPattern)];
        let ingredients = []
        // Loop through the matches and access the captured groups
        matches.forEach((match, index) => {
            const rawIngredient = match[1].trim().replace(/<[^>]*>?/gm, '');
            let converted;
            try {
                converted = convertMetricReading(rawIngredient)
            } catch (error) {
                console.log(error)
            }
            ingredients.push({ "ingredient": rawIngredient, "converted": converted })

        });



        // Regex pattern to extract step numbers
        // const stepNumberPattern = /<a class="recipe-method-step-number">(.*?)<\/a>/g;

        // Regex pattern to extract instructions
        const instructionPattern = /<div class="mb-5 lg:mb-10[^>]*?">(.*?)<\/div>/gs;

        const namePattern = /<h1[^>]*>\s*([^<]+)\s*<\/h1>/gs;

        // Find all step numbers and instructions using regex
        // const stepNumbers = Array.from(htmlContent.matchAll(stepNumberPattern), match => match[1].trim());
        const instructions = Array.from(htmlContent.matchAll(instructionPattern), match => match[1].trim());
        const nameList = Array.from(htmlContent.matchAll(namePattern), match => match[1].trim());
        let name = ""
        if (nameList.length > 0) {
            name = nameList[0]
        }
        // Clean up the extracted data (remove extra spaces and newlines)
        const cleanedInstructions = instructions.map(instruction => instruction.replace(/\s+/g, ' '));


        let instructionsAsJson = []
        // Print the results
        let alreadUsedSteps = []

        // We accidentally extract the steps twice, so added here to help not do that
        for (let i = 0; i < cleanedInstructions.length; i++) {
            let cleaned = removeHtmlTags(cleanedInstructions[i])
            let stepRegex =  /Step (\d+)/;
            const match = stepRegex.exec(cleaned);
            if (match) {
                const stepNumber = match[1];
                if (alreadUsedSteps.includes(stepNumber)){
                    continue
                }
                alreadUsedSteps.push(stepNumber)
            }
            // console.log(`Step ${stepNumbers[i]}: ${cleanedInstructions[i]}\n`);
            instructionsAsJson.push({ "stepNumber": i, "instruction": removeHtmlTags(cleanedInstructions[i]) })
        }


        let responseObject = {
            "name": name,
            "ingredients": ingredients,
            "instructions": instructionsAsJson
        }

        res.status(400).json({ success: true, data: responseObject, message: "" })

    } else {
        res.status(400).json({ success: false, data: [], message: "Not supported request" })
    }
}







