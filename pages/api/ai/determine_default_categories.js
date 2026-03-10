import axios from 'axios';
import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export default async function handler(req, res) {
  logAPI(req)
  const decoded = await verifyToken(req, res);
  if (!decoded) return;

  try {
    const searchTerm = req.query.search_term;

    if (!searchTerm) {
      return res.status(400).json({ message: "Missing search term" });
    }

    if (searchTerm.length > 30) {
      return res.status(400).json({ message: "Search term too long" });
    }

    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_API_KEY}`;
    const prompt = {
      "contents": [
        {
          "parts": [
            {
              "text": `Given the item "${searchTerm}", respond with a JSON object containing the most likely 'category', a common 'quantity' (number), and the 'unit' you would normally buy it in. Prioritize metric units which can be broken down easily eg. gram, kilogram, milliliter
            
            Valid Categories:
            "Fresh Produce", "Dairy and Eggs", "Bakery", "Meat and Seafood", "Canned Goods", "Pasta and Grains", "Condiments and Sauces", "Snacks", "Beverages", "Frozen Foods", "Cereal and Breakfast Foods", "Baking Supplies", "Household and Cleaning", "Personal Care", "Health and Wellness", "International Foods", "Deli and Prepared Foods", "Home and Garden"

            Valid Units:
            "each", "gram", "kilogram", "cup", "tablespoon", "teaspoon", "milliliter", "liter"

            Respond ONLY with the JSON object. Example:
            {"category": "Fresh Produce", "quantity": 1, "unit": "kilogram"}`
            }
          ]
        }
      ],
      "generationConfig": {
        "response_mime_type": "application/json"
      }
    };

    const response = await axios.post(geminiEndpoint, prompt);
    const responseText = response.data.candidates[0].content.parts[0].text.trim();
    const data = JSON.parse(responseText);

    return res.status(200).json({ success: true, data: data })
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return res.status(500).json({ success: false, message: "Error processing request" })
  }
}
