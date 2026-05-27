import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. MathLab Pro AI features will fall back to local explanations.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY",
      httpOptions: {
        headers: {
          'User-Agent': 'mathlab-pro',
        }
      }
    });
  }
  return aiClient;
}

/**
 * Requests the Gemini model to explain a mathematical formula or solve a step-by-step problem in LaTeX.
 */
export async function generateMathExplanation(query: string, category = "general math") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      explanation: `**[Local Offline Mode]** This explanation is generated offline because the backend API key is not currently configured. 

To solve **${query}**, you want to:
1. Parse the terms of the equation carefully.
2. Separate variables and apply standard symbolic calculus or algebraic steps.
3. For calculus operations (differentiation and integration), find the corresponding formulas (e.g., power rule, chain rule).

*Please configure the GEMINI_API_KEY in Settings > Secrets to enable the live, high-fidelity AI solver agent.*`,
      steps: [
        "Check expression terms.",
        "Perform elementary factorization or simplification.",
        "Solve numerical boundary criteria."
      ],
      latex: "f(x) = \\int g(x) dx"
    };
  }

  const ai = getAiClient();
  const systemPrompt = `You are "MathLab Pro AI", an elite symbolic mathematics specialist, CAS engine, and pedagogical mathematics tutor.
Your goal is to parse mathematical equations, solve them symbolically, and provide beautiful, high-fidelity LaTeX step-by-step explanations.
Always render equations enclosed in standard LaTeX layout notation:
- Block equations should be enclosed in double dollar signs: $$...$$
- Inline math or variables should be enclosed in single dollar signs: $...$

In your response, return a JSON object with this exact structure:
{
  "explanation": "Markdown description summarizing the concept, formula origins, physical relevance, and algebraic theory.",
  "steps": [
    "Step 1: Description of step 1 containing LaTeX math.",
    "Step 2: Description of step 2 containing LaTeX math.",
    "..."
  ],
  "latex": "Full LaTeX string representing the final solution or core equations"
}

Do not include any extra text, code fences, markdown blocks, HTML, or labels outside the JSON block. Ensure the JSON is strictly parsable. Avoid control characters or unescaped backslashes in your JSON strings. Escaped backslashes are required for LaTeX notation, so represent a LaTeX command \\frac as \\\\frac inside the JSON string.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Solve and provide pedagogical analysis for category: "${category}". Query: "${query}"`,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });

    const resultText = response.text || "";
    try {
      const parsed = JSON.parse(resultText.trim());
      return {
        explanation: parsed.explanation || "No explanation provided.",
        steps: parsed.steps || [],
        latex: parsed.latex || ""
      };
    } catch (parseError) {
      console.error("Failed to parse Gemini JSON, raw text:", resultText, parseError);
      return {
        explanation: resultText,
        steps: ["Could not format step-by-step JSON automatically.", "Consult the text above."],
        latex: ""
      };
    }
  } catch (error) {
    console.error("Gemini math generation failed:", error);
    return {
      explanation: `Failed to contact the AI math service: ${(error as Error).message}`,
      steps: ["Check system telemetry logs on the server."],
      latex: ""
    };
  }
}
