import { useState } from 'react';
import { Play, Copy, RefreshCw, Send, Plus, Trash, HelpCircle } from 'lucide-react';
import Latex from './Latex';
import { GraphEquation } from '../types';

interface PolynomialPanelProps {
  onAddGraphEquation: (expr: string) => void;
  onAddHistory: (item: any) => void;
  token?: string | null;
}

export default function PolynomialPanel({ onAddGraphEquation, onAddHistory, token }: PolynomialPanelProps) {
  const [expression, setExpression] = useState("3*x^2 + 5*x - 2");
  const [operand2, setOperand2] = useState("x - 1");
  const [variable, setVariable] = useState("x");
  const [operation, setOperation] = useState<'simplify' | 'derivative' | 'integrate' | 'divide' | 'multiply' | 'roots'>('simplify');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [result, setResult] = useState<{
    output: string;
    latexOutput: string;
    steps: string[];
  } | null>(null);

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/math/polynomial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          expression,
          operation,
          operand2,
          variable
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to execute calculation on server");
      }

      setResult({
        output: data.output,
        latexOutput: data.latexOutput,
        steps: data.steps
      });

      // Save to server history
      const histRes = await fetch('/api/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          type: 'polynomial',
          input: `${operation} of ${expression} ${operation === 'divide' || operation === 'multiply' ? 'with ' + operand2 : ''}`,
          output: data.output,
          latexInput: `${operation === 'derivative' ? '\\frac{d}{d' + variable + '}' : operation === 'integrate' ? '\\int' : ''} \\left(${expression}\\right)`,
          latexOutput: data.latexOutput,
          steps: data.steps,
          explanation: `Calculated ${operation} for variable: ${variable}`
        })
      });

      const histItem = await histRes.json();
      onAddHistory(histItem);

    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleInsertTemplate = (tmpl: string) => {
    setExpression(tmpl);
  };

  return (
    <div className="flex flex-col space-y-5 p-1">
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-3">
          {(['simplify', 'derivative', 'integrate', 'roots', 'multiply', 'divide'] as const).map(op => (
            <button
              key={op}
              onClick={() => setOperation(op)}
              className={`p-1.5 px-3 text-xs rounded-lg transition capitalize font-medium ${operation === op ? 'bg-indigo-600 border border-indigo-500 text-zinc-100' : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'}`}
            >
              {op}
            </button>
          ))}
        </div>

        {/* INPUT AREA */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-8 flex flex-col space-y-1">
            <label className="text-xs text-zinc-400 font-medium">Polynomial function f({variable})</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm font-mono text-indigo-400 focus:outline-none focus:border-indigo-500 transition shadow-inner"
                placeholder="e.g. 3*x^2 + 5*x - 2"
              />
            </div>
          </div>

          <div className="md:col-span-2 flex flex-col space-y-1">
            <label className="text-xs text-zinc-400 font-medium">Variable</label>
            <input
              type="text"
              value={variable}
              onChange={(e) => setVariable(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm text-center font-mono text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
              placeholder="x"
            />
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              onClick={handleCalculate}
              disabled={loading || !expression}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-zinc-100 p-2.5 rounded-lg text-sm font-medium transition disabled:bg-indigo-700/50 flex items-center justify-center space-x-1.5 cursor-pointer shadow-lg active:scale-95"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>Solve</span>
            </button>
          </div>
        </div>

        {/* SECOND OPERAND AREA */}
        {(operation === 'divide' || operation === 'multiply') && (
          <div className="flex flex-col space-y-1 pt-2 animate-fadeIn">
            <label className="text-xs text-zinc-400 font-medium">Operand 2 g(x)</label>
            <input
              type="text"
              value={operand2}
              onChange={(e) => setOperand2(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm font-mono text-amber-500 focus:outline-none focus:border-indigo-500 transition shadow-inner"
              placeholder="e.g. x - 1"
            />
          </div>
        )}

        {/* TEMPLATE AIDS */}
        <div className="flex items-center space-x-2 text-xs text-zinc-500 flex-wrap gap-2 pt-1 border-t border-zinc-800/60">
          <span>Templates:</span>
          <button onClick={() => handleInsertTemplate("x^3 - 4*x^2 + x + 6")} className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 p-1 px-2 rounded font-mono transition">Cubic</button>
          <button onClick={() => handleInsertTemplate("3*x^2 - x - 2")} className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 p-1 px-2 rounded font-mono transition">Quadratic</button>
          <button onClick={() => handleInsertTemplate("sin(x) / x")} className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 p-1 px-2 rounded font-mono transition">Sinc</button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-400 p-3 rounded-xl text-xs font-mono">
          [Error] {error}
        </div>
      )}

      {/* RESULT AND STEPS LAYOUT */}
      {result && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col shadow-xl">
          <div className="bg-zinc-950 border-b border-zinc-800 p-3.5 flex justify-between items-center px-4">
            <span className="text-xs text-zinc-400 font-mono">Algebraic Evaluation Response</span>
            <button
              onClick={() => onAddGraphEquation(expression)}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center space-x-1.5 transition active:scale-95 cursor-pointer bg-zinc-900 border border-zinc-800 p-1 px-2.5 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Plot Equation</span>
            </button>
          </div>

          <div className="p-5 flex flex-col space-y-4">
            <div className="bg-zinc-950 border border-zinc-850 p-4 pt-5 pb-5 rounded-xl flex flex-col items-center justify-center space-y-3 min-h-[90px] text-center relative shadow-inner">
              <span className="text-[10px] absolute top-2 left-3 font-mono text-zinc-500 uppercase tracking-wider">Solution Output</span>
              <div className="w-full overflow-x-auto py-1">
                <Latex expression={result.latexOutput || result.output} displayMode={true} />
              </div>
              <span className="text-xs font-mono text-zinc-500">Plain code: `{result.output}`</span>
            </div>

            {result.steps && result.steps.length > 0 && (
              <div className="flex flex-col space-y-3 pt-2">
                <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">Derivation Step-by-Step Logic:</span>
                <div className="flex flex-col space-y-2.5 bg-zinc-950/50 p-4 border border-zinc-800 rounded-xl">
                  {result.steps.map((st, i) => (
                    <div key={i} className="text-xs text-zinc-300 flex items-start space-x-2.5 border-b border-zinc-850 pb-2 last:border-0 last:pb-0">
                      <span className="p-0.5 px-1.5 bg-zinc-800 text-[10px] text-zinc-400 rounded font-mono mt-0.5">{i+1}</span>
                      <span className="flex-1 font-sans">{st}</span>
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
