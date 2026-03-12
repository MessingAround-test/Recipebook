import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'
import { callGroqChat } from '../../../lib/ai';

export default async function handler(req, res) {
  logAPI(req)
  const decoded = await verifyToken(req, res);
  if (!decoded) return;

  try {
    if (!req.body) {
      return res.status(400).json({ message: "No body data passed" });
    }
    const search_term = req.query.search_term
    let returned_terms = req.body.returned_terms;

    if (!returned_terms || !search_term) {
      return res.status(400).json({ message: "Missing search term or list of entries" });
    }

    const messages = [
      {
        role: "system",
        content: `You are a professional grocery ingredient matcher. Your task is to filter a list of ingredient names based on a search term.
        
Guidelines:
1. Return a JSON array of strings containing ONLY the names that are highly relevant to the search term.
2. Semantic Identity: The item MUST match the core identity of the search term. For example, if the search term is 'Kombucha', DO NOT include 'Iced Tea' or 'Soda', even if they are in the same overall category (Beverages). If it doesn't say it IS the search term or a variant of it, exclude it.
3. If the search term is a raw/unprocessed ingredient (e.g., 'potato'), EXCLUDE processed, mixed, or branded products (e.g., 'Heinz Babyfood Pumpkin and Corn').
4. If the search term is a specific product or processed good (e.g., 'potato chips'), include only those specific items and exclude the raw ingredient if it's too generic (e.g., exclude 'Potato' if 'Potato Chips' was searched).
5. Strictly NO conversational filler or markdown. Provide ONLY the JSON array. Output format: ["name1", "name2"]`
      },
      {
        role: "user",
        content: `Search Term: '${search_term}'
Returned Terms: ${JSON.stringify(returned_terms)}`
      }
    ];

    const responseText = await callGroqChat(messages, true);
    let parsedData;

    try {
      const data = JSON.parse(responseText);
      // Groq JSON mode might return an object with an array field or just the array if handled specifically.
      // Usually, it follows the prompt's structural request. 
      // If it returns {"ingredients": [...]}, we extract it.
      parsedData = Array.isArray(data) ? data : (data.ingredients || data.matches || Object.values(data)[0]);
    } catch (e) {
      console.error("Failed to parse Groq response:", responseText);
      throw new Error("Invalid JSON response from AI");
    }

    if (!Array.isArray(parsedData)) {
      console.warn("AI did not return an array, fallback to all terms");
      parsedData = returned_terms;
    }

    return res.status(200).json({ success: true, data: parsedData })
  } catch (error) {
    console.error("Error calling Groq API, falling back to all entries:", error);
    try {
      const fallbackTerms = req.body.returned_terms;
      if (fallbackTerms && Array.isArray(fallbackTerms)) {
        return res.status(200).json({ success: true, data: fallbackTerms, fallback: true });
      }
    } catch (fallbackError) {
      console.error("Fallback also failed:", fallbackError);
    }
    return res.status(500).json({ success: false, data: [], message: "Error processing request" })
  }
}
