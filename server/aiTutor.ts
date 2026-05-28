interface AiProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function getAiProviderConfig(): AiProviderConfig | null {
  const apiKey = process.env.AI_PROVIDER_API_KEY?.trim();
  const baseUrl = process.env.AI_PROVIDER_BASE_URL?.trim().replace(/\/+$/, "");
  const model = process.env.AI_PROVIDER_MODEL?.trim();

  if (!apiKey || !baseUrl || !model) {
    return null;
  }

  return { apiKey, baseUrl, model };
}

function offlineExplanation(query: string) {
  return {
    explanation: `**[Local Offline Mode]** This explanation is generated offline because the backend AI provider is not currently configured.

To solve **${query}**, you want to:
1. Parse the terms of the equation carefully.
2. Separate variables and apply standard symbolic calculus or algebraic steps.
3. For calculus operations, use the corresponding formulas such as the power rule, product rule, chain rule, or integration identities.

Configure AI_PROVIDER_BASE_URL, AI_PROVIDER_API_KEY, and AI_PROVIDER_MODEL to enable live AI tutoring.`,
    steps: [
      "Check expression terms.",
      "Perform elementary factorization or simplification.",
      "Solve numerical boundary criteria."
    ],
    latex: "f(x) = \\int g(x) dx"
  };
}

function extractProviderText(payload: unknown): string {
  const data = payload as {
    choices?: Array<{ message?: { content?: unknown } }>;
    output_text?: unknown;
    text?: unknown;
  };

  const content = data.choices?.[0]?.message?.content ?? data.output_text ?? data.text;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map(item => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) {
          return String((item as { text: unknown }).text || "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

/**
 * Requests a configured AI provider to explain a mathematical formula or solve a step-by-step problem in LaTeX.
 */
export async function generateMathExplanation(query: string, category = "general math") {
  const provider = getAiProviderConfig();
  if (!provider) {
    return offlineExplanation(query);
  }

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
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "mathlab-pro"
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Solve and provide pedagogical analysis for category: "${category}". Query: "${query}"`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI provider request failed with ${response.status}: ${errorText.slice(0, 500)}`);
    }

    const payload = await response.json();
    const resultText = extractProviderText(payload);
    try {
      const parsed = JSON.parse(resultText.trim());
      return {
        explanation: parsed.explanation || "No explanation provided.",
        steps: parsed.steps || [],
        latex: parsed.latex || ""
      };
    } catch (parseError) {
      console.error("Failed to parse AI provider JSON, raw text:", resultText, parseError);
      return {
        explanation: resultText,
        steps: ["Could not format step-by-step JSON automatically.", "Consult the text above."],
        latex: ""
      };
    }
  } catch (error) {
    console.error("AI math generation failed:", error);
    return {
      explanation: `Failed to contact the AI math service: ${(error as Error).message}`,
      steps: ["Check system telemetry logs on the server."],
      latex: ""
    };
  }
}
