import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'
import { callGroqChat, generateGeminiImage } from '../../../lib/ai';

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
        content: `You are an expert at crafting descriptive prompts for AI image generation. 
Your goal is to describe a recipe dish in a "paper-like" style. 
Think: watercolor illustration, hand-drawn sketch, vintage cookbook art, or charcoal drawing on textured paper.

Instructions:
1. Create a detailed visual description of the dish: '${recipeName}'.
2. Specify a "paper-like" artistic style (e.g., watercolor, pen and ink, lithograph, etc.).
3. Mention textured paper, muted colors, or hand-drawn qualities.
4. Avoid photorealistic terms.
5. KEEP IT CONCISE: Output only the prompt string. 
Example: "A watercolor illustration of a steaming bowl of Lemon Butter Chicken, soft brushstrokes, on textured cream paper, vintage cookbook style."`
      },
      {
        role: "user",
        content: `Create a paper-style image prompt for: ${recipeName}`
      }
    ];

    const prompt = await callGroqChat(messages, false);
    const cleanedPrompt = prompt.trim().replace(/^"|"$/g, '');

    // Now generate the image using Gemini
    let imageData = null;
    try {
        imageData = await generateGeminiImage(cleanedPrompt);
    } catch (imageError) {
        console.error("Gemini image generation failed:", imageError);
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
