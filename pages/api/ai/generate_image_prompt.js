import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'
import { callGroqChat, generateGeminiImage, generatePollinationsImage } from '../../../lib/ai';

export default async function handler(req, res) {
  logAPI(req)
  const decoded = await verifyToken(req, res);
  if (!decoded) return;

  try {
    const { recipeName } = req.query;

    if (!recipeName) {
      return res.status(400).json({ message: "Missing recipe name" });
    }

    const messages = [
      {
        role: "system",
        content: `You are an expert at crafting prompts for AI image generation.
Your goal: a CLEAN, REALISTIC food photo of the dish: '${recipeName}'.

Rules:
1. Output ONE short sentence (15 words or fewer) describing the finished dish, plated simply.
2. Style must be photorealistic food photography. NEVER describe illustrations, watercolour, sketches or paper textures.
3. Keep the composition simple: plain background, natural light. No props, no people, no text.
4. Only mention ingredients that would actually be visible in the finished dish.
5. Output ONLY the prompt string.
Example: "A steaming bowl of lemon butter chicken on a plain grey table, natural light, photorealistic."`
      },
      {
        role: "user",
        content: `Create a realistic food photo prompt for: ${recipeName}`
      }
    ];

    const prompt = await callGroqChat(messages, false);
    const cleanedPrompt = prompt.trim().replace(/^"|"$/g, '');

    // Generate the image using Pollinations (anonymous tier), Gemini as fallback
    let imageData = null;
    try {
        imageData = await generatePollinationsImage(cleanedPrompt);
    } catch (imageError) {
        console.error("Pollinations image generation failed, trying Gemini fallback:", imageError);
        try {
            imageData = await generateGeminiImage(cleanedPrompt);
        } catch (fallbackError) {
            console.error("Gemini image generation failed:", fallbackError);
        }
    }

    return res.status(200).json({ 
        success: true, 
        prompt: cleanedPrompt,
        image: imageData 
    })
  } catch (error) {
    console.error("Error generating recipe art:", error);
    return res.status(500).json({ success: false, message: "Error generating recipe art" })
  }
}
