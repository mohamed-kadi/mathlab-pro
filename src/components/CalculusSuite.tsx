import { useState, useTransition } from 'react';
import { Play, RefreshCw, ZoomIn, Plus, HelpCircle, Activity } from 'lucide-react';
import Latex from './Latex';

interface CalculusSuiteProps {
  onAddGraphEquation: (expr: string) => void;
  onSetPoints: (pts: { x: number; y: number }[]) => void;
  onAddHistory: (item: any) => void;
  token?: string | null;
}

export default function CalculusSuite({ onAddGraphEquation, onSetPoints, onAddHistory, token }: CalculusSuiteProps) {
  const [operation, setOperation] = useState<'limit' | 'taylor' | 'ode'>('limit');
  
  // States
  const [expression, setExpression] = useState("sin(x) / x");
  const [center, setCenter] = useState("0");
  const [degree, setDegree] = useState("4");

  // ODE states: dy/dx = f(x, y)
  const [odeExpression, setOdeExpression] = useState("x * y");
  const [x0, setX0] = useState("0");
  const [y0, setY0] = useState("1");
  const [xEnd, setXEnd] = useState("2");
  const [stepsCount, setStepsCount] = useState("50");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [result, setResult] = useState<{
    output: string;
    latexOutput: string;
    steps: string[];
    resultData: any;
  } | null>(null);

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const isOde = operation === 'ode';
      const response = await fetch('/api/math/calculus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          expression: isOde ? odeExpression : expression,
          operation,
          center: operation === 'limit' || operation === 'taylor' ? Number(center) : undefined,
          degree: operation === 'taylor' ? Number(degree) : undefined,
          x0: isOde ? Number(x0) : undefined,
          y0: isOde ? Number(y0) : undefined,
          xEnd: isOde ? Number(xEnd) : undefined,
          stepsCount: isOde ? Number(stepsCount) : undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed calculus evaluations on server");
      }

      setResult({
        output: data.output,
        latexOutput: data.latexOutput,
        steps: data.steps,
        resultData: data.result
      });

      if (operation === 'taylor' && data.result.polynomial) {
        onAddGraphEquation(data.result.polynomial);
      }

      // If ODE solver completes, map results to coordinates data in Grapher
      if (operation === 'ode' && data.result.results) {
        onSetPoints(data.result.results);
      }

      // Record to history
      const histRes = await fetch('/api/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          type: 'calculus',
          input: `${operation} calculus operation`,
          output: data.output,
          latexInput: `\\frac{d}{dx}\\left( f \\right) \\text{ or limits}`,
          latexOutput: data.latexOutput,
          steps: data.steps,
          explanation: `Numerical and symbolic calculus workspace processes.`
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

  const loadPreset = (preset: string) => {
    setResult(null);
    if (preset === 'sinc') {
      setExpression("sin(x) / x");
      setCenter("0");
    } else if (preset === 'taylor-cos') {
      setExpression("cos(x)");
      setCenter("0");
      setDegree("6");
    } else if (preset === 'taylor-ln') {
      setExpression("log(x + 1)");
      setCenter("0");
      setDegree("4");
    } else if (preset === 'harmonic-ode') {
      setOdeExpression("-y");
      setX0("0");
      setY0("1");
      setXEnd("3.1415");
      setStepsCount("50");
    }
  };

  return (
    <div className="flex flex-col space-y-5 p-1">
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-3">
          {(['limit', 'taylor', 'ode'] as const).map(op => (
            <button
              key={op}
              onClick={() => { setOperation(op); setResult(null); }}
              className={`p-1.5 px-3 text-xs rounded-lg transition uppercase font-semibold ${operation === op ? 'bg-indigo-600 border border-indigo-500 text-zinc-100' : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'}`}
            >
              {op === 'ode' ? 'RK4 ODE Integrator' : op === 'taylor' ? 'Taylor Expansion' : 'Numerical Limits'}
            </button>
          ))}
        </div>

        {/* CONDITION INTEGRATION FOR ODE VS LIMIT/TAYLOR */}
        {operation !== 'ode' ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6 flex flex-col space-y-1">
              <label className="text-xs text-zinc-400 font-medium">Function f(x)</label>
              <input
                type="text"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm font-mono text-indigo-400"
                placeholder="e.g. sin(x) / x"
              />
            </div>

            <div className="md:col-span-3 flex flex-col space-y-1">
              <label className="text-xs text-zinc-400 font-medium font-mono">Center x → (c)</label>
              <input
                type="text"
                value={center}
                onChange={(e) => setCenter(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm text-center font-mono text-zinc-200"
                placeholder="0"
              />
            </div>

            {operation === 'taylor' ? (
              <div className="md:col-span-3 flex flex-col space-y-1">
                <label className="text-xs text-zinc-400 font-medium">Degree (N)</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm text-center font-mono text-amber-500"
                />
              </div>
            ) : (
              <div className="md:col-span-3 flex items-end">
                <span className="text-[10px] text-zinc-500 font-sans leading-relaxed pl-1 pb-1">Approaches target from left ($c - 10^{-8}$) and right ($c + 10^{-8}$) checking convergence values.</span>
              </div>
            )}
          </div>
        ) : (
          /* RK4 ODE SOLVER FIELDS */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4 flex flex-col space-y-1">
              <label className="text-xs text-zinc-400 font-medium">ODE dy/dx = f(x, y)</label>
              <input
                type="text"
                value={odeExpression}
                onChange={(e) => setOdeExpression(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm font-mono text-indigo-400"
                placeholder="e.g. x * y"
              />
            </div>

            <div className="md:col-span-2 flex flex-col space-y-1">
              <label className="text-xs text-zinc-400 font-medium">Initial x₀</label>
              <input
                type="number"
                step="any"
                value={x0}
                onChange={(e) => setX0(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm text-center font-mono text-zinc-200"
              />
            </div>

            <div className="md:col-span-2 flex flex-col space-y-1">
              <label className="text-xs text-zinc-400 font-medium">Initial y₀</label>
              <input
                type="number"
                step="any"
                value={y0}
                onChange={(e) => setY0(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm text-center font-mono text-zinc-200"
              />
            </div>

            <div className="md:col-span-2 flex flex-col space-y-1">
              <label className="text-xs text-zinc-400 font-medium">End Integration</label>
              <input
                type="number"
                step="any"
                value={xEnd}
                onChange={(e) => setXEnd(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm text-center font-mono text-zinc-200"
              />
            </div>

            <div className="md:col-span-2 flex flex-col space-y-1">
              <label className="text-xs text-zinc-400 font-medium">Interval nodes</label>
              <input
                type="number"
                value={stepsCount}
                onChange={(e) => setStepsCount(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm text-center font-mono text-amber-500"
              />
            </div>
          </div>
        )}

        {/* ACTION BUTTON COMPONENT */}
        <div className="flex flex-wrap items-center justify-between border-t border-zinc-800 pt-3 gap-2">
          <div className="flex items-center space-x-2 text-xs text-zinc-500">
            <span>Presets:</span>
            {operation === 'ode' ? (
              <button onClick={() => loadPreset('harmonic-ode')} className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 p-1 px-2 rounded font-mono transition">Harmonic Oscillator</button>
            ) : (
              <>
                <button onClick={() => loadPreset('sinc')} className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 p-1 px-2 rounded font-mono transition">Sinc Limit (x→0)</button>
                <button onClick={() => loadPreset('taylor-cos')} className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 p-1 px-2 rounded font-mono transition">Taylor Cos(x)</button>
                <button onClick={() => loadPreset('taylor-ln')} className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 p-1 px-2 rounded font-mono transition">Taylor Ln(x+1)</button>
              </>
            )}
          </div>

          <button
            onClick={handleCalculate}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-zinc-100 p-2 px-6 rounded-lg text-xs font-semibold tracking-wider uppercase transition flex items-center space-x-1"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Evaluate Suite</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-400 p-3 rounded-xl text-xs font-mono">
          [Error] {error}
        </div>
      )}

      {/* CALCULUS SOLUTION DISPLAY */}
      {result && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
          <div className="bg-zinc-950 border-b border-zinc-800 p-3.5 flex justify-between items-center px-4 font-mono text-xs text-zinc-400">
            <span>Calculus Solver Output Analysis</span>
            {operation === 'taylor' && (
              <button
                onClick={() => onAddGraphEquation(expression)}
                className="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Plot Original `f(x)`</span>
              </button>
            )}
          </div>

          <div className="p-5 flex flex-col space-y-4">
            <div className="bg-zinc-950 border border-zinc-850 p-4 pt-5 pb-5 rounded-xl flex flex-col items-center justify-center space-y-2 relative shadow-inner text-center">
              <span className="text-[10px] absolute top-2 left-3 font-mono text-zinc-500 uppercase">Solved Value</span>
              <div className="w-full overflow-x-auto py-1 text-center">
                <Latex expression={result.latexOutput} displayMode={true} />
              </div>
              <span className="text-xs font-mono text-zinc-500">{result.output}</span>
              {operation === 'ode' && (
                <span className="text-[10px] text-zinc-500 font-sans pt-1">
                  Integrated ODE path sequence registered and plotted under coordinate dots layout!
                </span>
              )}
            </div>

            {result.steps && result.steps.length > 0 && (
              <div className="flex flex-col space-y-3 pt-2">
                <span className="text-xs font-bold font-mono text-zinc-400 uppercase">Convergence iterations & derivations layers:</span>
                <div className="flex flex-col space-y-2 bg-zinc-950/50 p-4 border border-zinc-800 rounded-xl max-h-[220px] overflow-y-auto">
                  {result.steps.map((st, i) => (
                    <div key={i} className="text-xs text-zinc-355 flex items-start space-x-2.5 pb-2 border-b border-zinc-850 last:border-0 last:pb-0 font-mono">
                      <span className="text-indigo-400 text-[10px] bg-zinc-855 px-1.5 py-0.5 rounded mt-0.5">{i+1}</span>
                      <span className="flex-1 leading-relaxed text-zinc-300 font-mono">{st}</span>
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
