import axios from 'axios';
import { secret } from "../../../lib/dbsecret"
import { verify } from "jsonwebtoken";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export default async function handler(req, res) {
  verify(req.query.EDGEtoken, secret, async function (err, decoded) {
    // Extract search term from query string
    if (!req.body) {
      return res.status(400).json({ message: "No body data passed" });
    }
    const search_term = req.query.search_term
    let returned_terms = req.body.returned_terms;

    // Validate search term presence
    if (!returned_terms || !search_term) {
      return res.status(400).json({ message: "Missing search term or list of entries" });
    }

    if (returned_terms.length > 15) {
      returned_terms = returned_terms.slice(0, 15)
    }

    // Define Gemini API endpoint and prompt
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    const promptText = `Given the search term '${search_term}', return a JSON array of ingredient names that match the search term as closely as possible. Only include terms that are directly related to the search term and exclude anything irrelevant. If the search term refers to an unprocessed ingredient (e.g., 'potato'), **assume that processed or mixed products (e.g., 'Heinz Babyfood Pumpkin and Corn') should not be included**. In the case of the search term 'potato', and the returned terms ['Smith's Original Crinkle Cut Potato Chips', 'Smith's Crinkle Cut Salt & Vinegar Potato Chips', 'Smith's Double Crunch Potato Chips Original', 'Smith's Crinkle Cut Potato Chips'], the correct response should be ['potato']. For your case, with the returned terms ${returned_terms.map(term => `'${term}'`).toString()}, provide only the filtered list of relevant ingredient names in a valid JSON array format that can be parsed using JSON.parse without errors.`

    const prompt = {
      "contents": [
        {
          "parts": [
            {
              "text": `Given the search term '${search_term}', return a JSON array of ingredient names that match the search term as closely as possible.`
            },
            {
              "text": `Only include terms that are directly related to the search term and exclude anything irrelevant. If the search term refers to an unprocessed ingredient (e.g., 'potato'), **assume that processed or mixed products (e.g., 'Heinz Babyfood Pumpkin and Corn') should not be included**.`
            },
            {
              "text": `In the case of a processed good ie. 'potato chips', and the returned terms ['Smith's Crinkle Cut Potato Chips', 'Potato', 'Smith's Double Crunch Potato Chips Original', 'Onion'], the correct response should be ['Smith's Crinkle Cut Potato Chips', 'Smith's Double Crunch Potato Chips Original'].`
            },
            {
              "text": `For your case, with the returned terms ${returned_terms.map(term => `'${term}'`).toString()}, provide only the filtered list of relevant ingredient names in a valid JSON array format that can be parsed using JSON.parse without errors.`
            }
          ]
        }
      ]
    };
    

    try {
      // Send request to Gemini API
      const response = await axios.post(geminiEndpoint, prompt);
      const response_data = response.data.candidates[0].content.parts[0].text;
      console.log(promptText)
      console.log(response_data)

      // Remove ```json ``` and then remove non-ascii characters to prevent parsing issues AND newlines and multiple whitespaces into one
      let cleanedresponse = response_data
        .replace(/^```json\s*|```$/g, '')  // Remove ```json prefix and trailing ```
        .replace(/`/g, '')              // Remove all backticks
        .replace(/[\x00-\x1F\x7F]/g, '')    // Remove control characters (non-printable ASCII characters)
        .replace(/\s+/g, ' ')               // Collapse multiple spaces into one
        .trim();
      console.log(cleanedresponse)

      let responseList = JSON.parse(cleanedresponse);


      // Extract relevant information from response (assuming response format)


      // Return response with extracted answer
      return res.status(200).json({ success: true, data: responseList })
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return res.status(500).json({ success: false, data: [], message: "Error processing request" })
    }
  })
}