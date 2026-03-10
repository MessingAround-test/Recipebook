import axios from 'axios';
import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

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

    // Removed limit to allow full validation of expanded results
    // if (returned_terms.length > 15) {
    //   returned_terms = returned_terms.slice(0, 15)
    // }

    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_API_KEY}`;
    const prompt = {
      "contents": [
        {
          "parts": [
            { "text": `Given the search term '${search_term}', return a JSON array of ingredient names that match the search term as closely as possible.` },
            { "text": `Only include terms that are directly related to the search term and exclude anything irrelevant. If the search term refers to an unprocessed ingredient (e.g., 'potato'), **assume that processed or mixed products (e.g., 'Heinz Babyfood Pumpkin and Corn') should not be included**.` },
            { "text": `In the case of a processed good ie. 'potato chips', and the returned terms ['Smith's Crinkle Cut Potato Chips', 'Potato', 'Smith's Double Crunch Potato Chips Original', 'Onion'], the correct response should be ['Smith's Crinkle Cut Potato Chips', 'Smith's Double Crunch Potato Chips Original'].` },
            { "text": `For your case, with the returned terms ${returned_terms.map(term => `'${term}'`).toString()}, provide only the filtered list of relevant ingredient names in a valid JSON array format that can be parsed using JSON.parse without errors.` }
          ]
        }
      ]
    };

    const response = await axios.post(geminiEndpoint, prompt);
    const response_data = response.data.candidates[0].content.parts[0].text;

    let cleanedresponse = response_data
      .replace(/^```json\s*|```$/g, '')
      .replace(/`/g, '')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    let responseList = JSON.parse(cleanedresponse);
    return res.status(200).json({ success: true, data: responseList })
  } catch (error) {
    console.error("Error calling Gemini API, falling back to all entries:", error);
    // FALLBACK: If Gemini fails, return all terms to "insert them all" as requested
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
