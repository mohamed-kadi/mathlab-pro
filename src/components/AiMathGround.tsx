import { useState } from 'react';
import { Send, Sparkles, RefreshCw, HelpCircle, ArrowRight, BookOpen } from 'lucide-react';
import Latex from './Latex';

interface AiMathGroundProps {
  onAddGraphEquation: (expr: string) => void;
  token?: string | null;
}

export default function AiMathGround({ onAddGraphEquation, token }: AiMathGroundProps) {
  const [query, setQuery] = useState("Explain step-by-step mathematical proof of Euler's Identity: e^(i*pi) + 1 = 0");
  const [category, setCategory] = useState("General Math");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [response, setResponse] = useState<{
    explanation: string;
    steps: string[];
    latex: string;
  } | null>(null);

  const handleAskAi = async (customQuery?: string) => {
    const targetQuery = customQuery || query;
    if (!targetQuery) return;

    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/math/ai-explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          query: targetQuery,
          category
        })
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to contact Gemini CAS engine");
      }

      setResponse({
        explanation: data.explanation,
        steps: data.steps,
        latex: data.latex
      });

    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPrompt = (promptText: string, cat: string) => {
    setQuery(promptText);
    setCategory(cat);
    handleAskAi(promptText);
  };

  return (
    <div className="flex flex-col space-y-5 p-1">
      {/* INPUTS AND PROMPTS CONTAINER */}
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col space-y-4 shadow-xl">
        <div className="flex items-center space-x-2 border-b border-zinc-800 pb-3">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">
            MathLab Pro AI-Assisted Symbolic Tutor (Gemini 3.5-Flash)
          </span>
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs text-zinc-400 font-medium font-mono">Ask standard mathematical proofs, formula derivations, or concepts:</label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition shadow-inner"
              placeholder="e.g. Derive Taylor expansion for cos(x) around zero"
            />
            <button
              onClick={() => handleAskAi()}
              disabled={loading || !query}
              className="bg-purple-600 hover:bg-purple-500 text-zinc-100 p-2.5 px-5 rounded-lg text-xs font-semibold uppercase tracking-wider transition flex items-center space-x-1 disabled:bg-purple-800/40 cursor-pointer shadow-md active:scale-95"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Ask AI</span>
            </button>
          </div>
        </div>

        {/* QUICK SYMBOLIC PROMPTS */}
        <div className="flex flex-col space-y-2 pt-1">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-bold flex items-center">
            <BookOpen className="w-3.5 h-3.5 text-zinc-500 mr-1" />
            <span>Interactive Tutor Proofs Library:</span>
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => handleQuickPrompt("Derive Schrödinger Equation Hamiltonian operator standard limits", "Quantum Mechanics")}
              className="text-left bg-zinc-950 hover:bg-zinc-850 hover:border-zinc-700 p-2 rounded-lg border border-zinc-900 text-zinc-400 transition flex items-center justify-between"
            >
              <span>Derive Schrödinger Equation limits</span>
              <ArrowRight className="w-3 h-3 text-zinc-600" />
            </button>
            <button
              onClick={() => handleQuickPrompt("Show step-by-step symbolic integration of gaussian probability distribution density e^(-x^2)", "Calculus proofs")}
              className="text-left bg-zinc-950 hover:bg-zinc-850 hover:border-zinc-700 p-2 rounded-lg border border-zinc-900 text-zinc-400 transition flex items-center justify-between"
            >
              <span>Solve symbolic Gaussian integral ∫e^(-x^2)dx</span>
              <ArrowRight className="w-3 h-3 text-zinc-600" />
            </button>
            <button
              onClick={() => handleQuickPrompt("Find Laplace transform of general exponential decay f(t) = e^(-a*t)", "Laplace Transforms")}
              className="text-left bg-zinc-950 hover:bg-zinc-850 hover:border-zinc-700 p-2 rounded-lg border border-zinc-900 text-zinc-400 transition flex items-center justify-between"
            >
              <span>Laplace transform of Exponential Decay</span>
              <ArrowRight className="w-3 h-3 text-zinc-600" />
            </button>
            <button
              onClick={() => handleQuickPrompt("Explain eigenvalues algebraic multiplicities vs geometric multiplicities with matrices", "Linear Algebra")}
              className="text-left bg-zinc-950 hover:bg-zinc-850 hover:border-zinc-700 p-2 rounded-lg border border-zinc-900 text-zinc-400 transition flex items-center justify-between"
            >
              <span>Eigenvalues multiplicities comparisons</span>
              <ArrowRight className="w-3 h-3 text-zinc-600" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-400 p-3 rounded-xl text-xs font-mono">
          [Error] {error}
        </div>
      )}

      {/* RENDER RESPONSE TABS */}
      {response && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col animate-slideUp">
          <div className="bg-zinc-950 border-b border-zinc-800 p-3.5 flex justify-between items-center px-4 font-mono text-xs text-zinc-400">
            <span>AI Symbolic Tutor Response (LaTeX format)</span>
            {response.latex && (
              <button
                onClick={() => onAddGraphEquation(response.latex)}
                className="text-[10px] font-medium text-purple-400 hover:text-purple-300 flex items-center space-x-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Extract Equation</span>
              </button>
            )}
          </div>

          <div className="p-5 flex flex-col space-y-4">
            {/* OVERALL DESCRIPTION EXPLANATION */}
            <div className="bg-zinc-955 border border-zinc-850 p-4 rounded-xl leading-relaxed text-sm text-zinc-300 max-h-[220px] overflow-y-auto">
              <span className="text-[9px] uppercase font-mono text-zinc-500 font-bold block mb-1">Pedagogical Overview:</span>
              <div className="whitespace-pre-line font-sans prose prose-invert max-w-none text-zinc-350">
                {response.explanation}
              </div>
            </div>

            {/* SYMBOLIC SOLUTION */}
            {response.latex && (
              <div className="bg-zinc-950 border border-zinc-855 p-4 rounded-xl flex flex-col items-center justify-center relative py-5 shadow-inner">
                <span className="text-[10px] absolute top-2 left-3 font-mono text-zinc-500 uppercase">Core Solution Equation</span>
                <div className="w-full overflow-x-auto py-1 text-center">
                  <Latex expression={response.latex} displayMode={true} />
                </div>
              </div>
            )}

            {/* DETAILED TUTORIAL STEPS */}
            {response.steps && response.steps.length > 0 && (
              <div className="flex flex-col space-y-2.5 pt-1">
                <span className="text-xs font-bold font-mono text-zinc-400 uppercase">Formal derivations & proof steps:</span>
                <div className="flex flex-col space-y-2 bg-zinc-950/30 p-4 border border-zinc-800 rounded-xl">
                  {response.steps.map((st, i) => (
                    <div key={i} className="text-xs text-zinc-300 flex items-start space-x-2.5 pb-2.5 last:pb-0 border-b border-zinc-850 last:border-0">
                      <span className="text-purple-400 font-bold text-[10px] bg-zinc-850 px-1.5 py-0.5 rounded mt-0.5">{i+1}</span>
                      <div className="flex-1 font-sans">
                        {/* Render simple LaTeX blocks inside step if any */}
                        {st.includes('$') || st.includes('\\') ? <Latex expression={st} /> : <span>{st}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
