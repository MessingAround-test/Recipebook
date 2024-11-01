import axios from 'axios';
import { secret } from "../../../lib/dbsecret"
import { verify } from "jsonwebtoken";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export default async function handler(req, res) {
  verify(req.query.EDGEtoken, secret, async function (err, decoded) {
    // Extract search term from query string
    const searchTerm = req.query.search_term;

    // Validate search term presence
    if (!searchTerm) {
      return res.status(400).json({ message: "Missing search term" });
    }

    if (searchTerm.length > 30) {
      return res.status(400).json({ message: "Search term too long" });
    }

    // Define Gemini API endpoint and prompt
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    const prompt = {
      "contents": [
        {
          "parts": [
            {
              "text": `Given the following categories, what category does "${searchTerm}" belong to? Reply with just the category\n
            "Fresh Produce"\n
            "Dairy and Eggs"\n
            "Bakery"\n
            "Meat and Seafood"\n
            "Canned Goods"\n
            "Pasta and Grains"\n
            "Condiments and Sauces"\n
            "Snacks"\n
            "Beverages"\n
            "Frozen Foods"\n
            "Cereal and Breakfast Foods"\n
            "Baking Supplies"\n
            "Household and Cleaning"\n
            "Personal Care"\n
            "Health and Wellness"\n
            "International Foods"\n
            "Deli and Prepared Foods"\n
            "Home and Garden"`
            }
          ]
        }
      ]
    };

    try {
      // Send request to Gemini API
      const response = await axios.post(geminiEndpoint, prompt);
      const category = response.data.candidates[0].content.parts[0].text.trim();

      console.log(category)

      // Extract relevant information from response (assuming response format)


      // Return response with extracted answer
      return res.status(200).json({ success: true, data: category })
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return res.status(500).json({ success: false, data: [], message: "Error processing request" })
    }
  })
}