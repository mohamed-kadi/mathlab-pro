import { useState } from 'react';
import { Play, RefreshCw, Plus, HelpCircle } from 'lucide-react';
import Latex from './Latex';

interface SymbolicAlgebraProps {
  onAddGraphEquation: (expr: string) => void;
  onAddHistory: (item: any) => void;
  token?: string | null;
}

export default function SymbolicAlgebra({ onAddGraphEquation, onAddHistory, token }: SymbolicAlgebraProps) {
  const [expression, setExpression] = useState("(x - 2)^2 * (x + 3)");
  const [variable, setVariable] = useState("x");
  const [subValue, setSubValue] = useState("5");
  const [operation, setOperation] = useState<'simplify' | 'expand' | 'factor' | 'substitute'>('expand');
  
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
      const response = await fetch('/api/math/algebra', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          expression,
          operation,
          variable,
          subValue
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed algebraic transformation on server");
      }

      setResult({
        output: data.output,
        latexOutput: data.latexOutput,
        steps: data.steps
      });

      // Saving to history
      const histRes = await fetch('/api/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          type: 'algebra',
          input: `${operation} of ${expression} ${operation === 'substitute' ? 'for ' + variable + '=' + subValue : ''}`,
          output: data.output,
          latexInput: `\\text{${operation}}\\left(${expression}\\right)`,
          latexOutput: data.latexOutput,
          steps: data.steps,
          explanation: `Algebra symbolic solve: ${operation}`
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
          {(['simplify', 'expand', 'factor', 'substitute'] as const).map(op => (
            <button
              key={op}
              onClick={() => setOperation(op)}
              className={`p-1.5 px-3 text-xs rounded-lg transition capitalize font-medium ${operation === op ? 'bg-indigo-600 border border-indigo-500 text-zinc-100' : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'}`}
            >
              {op}
            </button>
          ))}
        </div>

        {/* INPUTS AREA */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-8 flex flex-col space-y-1">
            <label className="text-xs text-zinc-400 font-medium">Algebraic Expression</label>
            <input
              type="text"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm font-mono text-indigo-400 focus:outline-none focus:border-indigo-500 transition shadow-inner"
              placeholder="e.g. (x - 2)^2 * (x + 3)"
            />
          </div>

          {operation === 'substitute' ? (
            <>
              <div className="md:col-span-2 flex flex-col space-y-1">
                <label className="text-xs text-zinc-400 font-medium">Target Var</label>
                <input
                  type="text"
                  value={variable}
                  onChange={(e) => setVariable(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm text-center font-mono text-zinc-200"
                  placeholder="x"
                />
              </div>
              <div className="md:col-span-2 flex flex-col space-y-1">
                <label className="text-xs text-zinc-400 font-medium">Val</label>
                <input
                  type="text"
                  value={subValue}
                  onChange={(e) => setSubValue(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm text-center font-mono text-amber-500 font-medium"
                  placeholder="e.g. 5"
                />
              </div>
            </>
          ) : (
            <div className="md:col-span-4 flex items-end">
              <span className="text-[11px] text-zinc-500 leading-relaxed font-sans pr-2">
                CAS engine resolves expressions instantly with infinite-precision.
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between border-t border-zinc-800 overscroll-contain pt-3">
          <div className="flex items-center space-x-2 text-xs text-zinc-500">
            <span>Templates:</span>
            <button onClick={() => handleInsertTemplate("x^2 + 2*x*y + y^2")} className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 p-1 px-2 rounded font-mono transition">Double Poly</button>
            <button onClick={() => handleInsertTemplate("x^2 - y^2")} className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 p-1 px-2 rounded font-mono transition">Diff Squares</button>
            <button onClick={() => handleInsertTemplate("x*x + 4*x - 12")} className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 p-1 px-2 rounded font-mono transition">Standard Exp</button>
          </div>

          <button
            onClick={handleCalculate}
            disabled={loading || !expression}
            className="bg-indigo-600 hover:bg-indigo-500 text-zinc-100 p-2 px-6 rounded-lg text-xs font-semibold tracking-wider uppercase transition disabled:bg-indigo-700/50 flex items-center space-x-1.5 cursor-pointer shadow-md mt-2 md:mt-0"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Apply CAS</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-400 p-3 rounded-xl text-xs font-mono">
          [Error] {error}
        </div>
      )}

      {result && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
          <div className="bg-zinc-950 border-b border-zinc-800 p-3.5 flex justify-between items-center px-4">
            <span className="text-xs text-zinc-400 font-mono">Algebra Transformation Output</span>
            <button
              onClick={() => onAddGraphEquation(expression)}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Plot Algebra</span>
            </button>
          </div>

          <div className="p-5 flex flex-col space-y-4">
            <div className="bg-zinc-950 border border-zinc-850 p-4 pt-5 pb-5 rounded-xl flex flex-col items-center justify-center space-y-3 relative shadow-inner">
              <span className="text-[10px] absolute top-2 left-3 font-mono text-zinc-500 uppercase">Output Result</span>
              <div className="w-full overflow-x-auto py-1 text-center">
                <Latex expression={result.latexOutput || result.output} displayMode={true} />
              </div>
              <span className="text-xs font-mono text-zinc-500">Code String: `{result.output}`</span>
            </div>

            {result.steps && result.steps.length > 0 && (
              <div className="flex flex-col space-y-2 pt-2">
                <span className="text-xs font-bold font-mono text-zinc-400 uppercase">Calculation logical flows:</span>
                <div className="flex flex-col space-y-2 bg-zinc-950/50 p-4 border border-zinc-800 rounded-xl">
                  {result.steps.map((st, idx) => (
                    <div key={idx} className="text-xs text-zinc-300 flex items-start space-x-2 pb-1 border-b border-zinc-900 last:border-0 last:pb-0">
                      <span className="text-indigo-500 font-bold font-mono text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded">{idx+1}</span>
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
