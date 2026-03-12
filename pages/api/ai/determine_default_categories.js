import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'
import { callGroqChat } from '../../../lib/ai';

export default async function handler(req, res) {
  logAPI(req)
  const decoded = await verifyToken(req, res);
  if (!decoded) return;

  try {
    const searchTerm = req.query.search_term;

    if (!searchTerm) {
      return res.status(400).json({ message: "Missing search term" });
    }

    if (searchTerm.length > 50) {
      return res.status(400).json({ message: "Search term too long" });
    }

    const messages = [
      {
        role: "system",
        content: `You are a grocery organization assistant.
        
Task: Given an item name, respond with a JSON object containing:
- 'category': The most appropriate category from the valid list.
- 'quantity': A standard purchase quantity (number).
- 'unit': The standard unit for that item.

Valid Categories:
"Fresh Produce", "Dairy and Eggs", "Bakery", "Meat and Seafood", "Canned Goods", "Pasta and Grains", "Condiments and Sauces", "Snacks", "Beverages", "Frozen Foods", "Cereal and Breakfast Foods", "Baking Supplies", "Household and Cleaning", "Personal Care", "Health and Wellness", "International Foods", "Deli and Prepared Foods", "Home and Garden"

Valid Units:
"each", "gram", "kilogram", "cup", "tablespoon", "teaspoon", "milliliter", "liter"

Prioritize metric units (gram, kilogram, milliliter, liter) for weight/volume.
Output MUST be a single JSON object.`
      },
      {
        role: "user",
        content: `Item: "${searchTerm}"`
      }
    ];

    const responseText = await callGroqChat(messages, true);
    const data = JSON.parse(responseText);

    return res.status(200).json({ success: true, data: data })
  } catch (error) {
    console.error("Error calling Groq API:", error);
    return res.status(500).json({ success: false, message: "Error processing request" })
  }
}
