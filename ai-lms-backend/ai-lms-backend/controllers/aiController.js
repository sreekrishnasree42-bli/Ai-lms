import anthropic from "../services/claudeService.js";

export const getAIResponse = async (req, res) => {
  try {
    const { prompt } = req.body;

    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 200,
      messages: [
        { role: "user", content: prompt }
      ],
    });

    res.json({ success: true, data: response.content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};