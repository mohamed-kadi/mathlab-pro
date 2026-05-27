import { useState } from 'react';
import { Play, RefreshCw, Plus, Trash, HelpCircle, Activity } from 'lucide-react';

interface NumericalMethodsProps {
  onAddGraphEquation: (expr: string) => void;
  onSetPoints: (pts: { x: number; y: number }[]) => void;
  onAddHistory: (item: any) => void;
  token?: string | null;
}

export default function NumericalMethods({ onAddGraphEquation, onSetPoints, onAddHistory, token }: NumericalMethodsProps) {
  const [method, setMethod] = useState<'newton' | 'bisection' | 'integrate' | 'curvefit'>('newton');
  
  // Newton & Bisection configs
  const [expression, setExpression] = useState("x^2 - 5");
  const [initialGuess, setInitialGuess] = useState("2.0");
  const [a, setA] = useState("1.0");
  const [b, setB] = useState("3.0");

  // Curve fitting configs (degree coordinate points)
  const [points, setPoints] = useState<{ x: number; y: number }[]>([
    { x: 0, y: 1.1 },
    { x: 1, y: 2.8 },
    { x: 2, y: 5.2 },
    { x: 3, y: 9.1 },
    { x: 4, y: 14.3 }
  ]);
  const [degree, setDegree] = useState(2);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [result, setResult] = useState<{
    output: string;
    steps: string[];
    resultData: any;
  } | null>(null);

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/math/numerical', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          method,
          expression,
          initialGuess,
          a,
          b,
          points: method === 'curvefit' ? points : undefined,
          degree: method === 'curvefit' ? degree : undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed numerical computation on server");
      }

      setResult({
        output: data.output,
        steps: data.steps,
        resultData: data.result
      });

      if (method === 'curvefit' && data.result.equation) {
        // Feed coordinates and regression curves to the parent layout
        onSetPoints(points);
        onAddGraphEquation(data.result.equation);
      }

      // Record to history
      const histRes = await fetch('/api/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          type: 'numerical',
          input: `Numerical method: ${method} solver`,
          output: data.output,
          latexInput: `\\text{${method}}\\left( ${expression || 'points'} \\right)`,
          latexOutput: `\\text{Solve} \\approx ${data.output}`,
          steps: data.steps,
          explanation: `System numerical calculation analysis.`
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

  const addPoint = () => {
    setPoints([...points, { x: points.length, y: points.length * 2.5 }]);
  };

  const removePoint = (idx: number) => {
    setPoints(points.filter((_, i) => i !== idx));
  };

  const updatePoint = (idx: number, key: 'x' | 'y', val: string) => {
    const nextPoints = points.map((p, i) =>
      i === idx ? { ...p, [key]: val === '' ? 0 : parseFloat(val) || 0 } : p
    );
    setPoints(nextPoints);
  };

  return (
    <div className="flex flex-col space-y-5 p-1">
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-3">
          {(['newton', 'bisection', 'integrate', 'curvefit'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMethod(m); setResult(null); }}
              className={`p-1.5 px-3 text-xs rounded-lg transition uppercase font-semibold ${method === m ? 'bg-indigo-600 border border-indigo-500 text-zinc-100' : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'}`}
            >
              {m === 'newton' ? 'Newton-Raphson' : m === 'integrate' ? 'Simpson Integral' : m === 'curvefit' ? 'Curve Fitting' : m}
            </button>
          ))}
        </div>

        {/* CONTROLS FIELDS */}
        {method !== 'curvefit' ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6 flex flex-col space-y-1">
              <label className="text-xs text-zinc-400 font-medium">Single-variable equation f(x) = 0</label>
              <input
                type="text"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm font-mono text-indigo-400 focus:outline-none focus:border-indigo-500 transition shadow-inner"
                placeholder="e.g. x^2 - 5"
              />
            </div>

            {method === 'newton' && (
              <div className="md:col-span-3 flex flex-col space-y-1">
                <label className="text-xs text-zinc-400 font-medium font-mono">Initial Guess (x₀)</label>
                <input
                  type="text"
                  value={initialGuess}
                  onChange={(e) => setInitialGuess(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm text-center font-mono text-zinc-200"
                  placeholder="2.0"
                />
              </div>
            )}

            {(method === 'bisection' || method === 'integrate') && (
              <>
                <div className="md:col-span-2 flex flex-col space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">Bound (a)</label>
                  <input
                    type="text"
                    value={a}
                    onChange={(e) => setA(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm text-center font-mono text-zinc-200"
                    placeholder="1.0"
                  />
                </div>
                <div className="md:col-span-2 flex flex-col space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">Bound (b)</label>
                  <input
                    type="text"
                    value={b}
                    onChange={(e) => setB(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm text-center font-mono text-zinc-200"
                    placeholder="3.0"
                  />
                </div>
              </>
            )}

            <div className={`md:col-span-3 flex items-end ${method === 'newton' ? 'md:col-span-3' : 'md:col-span-2'}`}>
              <button
                onClick={handleCalculate}
                disabled={loading || !expression}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-zinc-100 p-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition disabled:bg-indigo-700/50 flex items-center justify-center space-x-1.5 cursor-pointer shadow-lg active:scale-95"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>Evaluate</span>
              </button>
            </div>
          </div>
        ) : (
          /* CURVE FITTING SPREADSHEET AREA */
          <div className="flex flex-col space-y-3 pt-2">
            <div className="flex justify-between items-center px-1">
              <span className="text-xs text-zinc-400 font-mono">Least-Squares Polynomial Regression Points Coordinates</span>
              <button
                onClick={addPoint}
                className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 hover:border-emerald-900 border border-zinc-800 bg-zinc-950 p-1 px-2.5 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Point Coordinate</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-950 p-4 border border-zinc-800 rounded-xl overflow-x-auto max-h-[180px] overflow-y-auto">
              {points.map((pt, idx) => (
                <div key={idx} className="flex items-center space-x-2 bg-zinc-900 border border-zinc-850 p-2 rounded-lg justify-between">
                  <span className="text-xs text-zinc-500 font-mono pr-2">#{idx+1}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-zinc-400 font-mono">X:</span>
                    <input
                      type="number"
                      step="any"
                      value={pt.x}
                      onChange={(e) => updatePoint(idx, 'x', e.target.value)}
                      className="w-16 bg-zinc-950 border border-zinc-800 text-center rounded text-sm p-1 font-mono text-zinc-100"
                    />
                    <span className="text-xs text-zinc-400 font-mono">Y:</span>
                    <input
                      type="number"
                      step="any"
                      value={pt.y}
                      onChange={(e) => updatePoint(idx, 'y', e.target.value)}
                      className="w-16 bg-zinc-950 border border-zinc-800 text-center rounded text-sm p-1 font-mono text-zinc-100"
                    />
                  </div>
                  <button
                    onClick={() => removePoint(idx)}
                    disabled={points.length <= 2}
                    className="text-zinc-500 hover:text-red-400 transition p-1 rounded hover:bg-zinc-950 disabled:opacity-20 flex cursor-pointer"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-zinc-850 pt-3 flex-wrap gap-2">
              <div className="flex items-center space-x-2.5">
                <span className="text-xs text-zinc-400 font-semibold font-mono">Polynomial Degree (D):</span>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={degree}
                  onChange={(e) => setDegree(Math.max(1, Math.min(4, parseInt(e.target.value) || 1)))}
                  className="w-12 bg-zinc-950 border border-zinc-800 text-center rounded text-sm p-1 font-mono text-indigo-400"
                />
                <span className="text-[10px] text-zinc-500 font-sans leading-relaxed pl-1 max-w-[220px]">
                  Finds continuous formula y = f(x) fitting discrete coordinates least-squares.
                </span>
              </div>

              <button
                onClick={handleCalculate}
                disabled={loading || points.length < degree + 1}
                className="bg-emerald-600 hover:bg-emerald-500 text-zinc-100 p-2 px-6 rounded-lg text-xs font-semibold tracking-wider uppercase transition flex items-center space-x-1 cursor-pointer"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                <span>Fit Least-Squares Curve</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-400 p-3 rounded-xl text-xs font-mono">
          [Error] {error}
        </div>
      )}

      {/* RENDER STEPS & VALUES */}
      {result && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
          <div className="bg-zinc-950 border-b border-zinc-800 p-3.5 font-mono text-xs text-zinc-400">
            Numerical Analysis Platform Output
          </div>

          <div className="p-5 flex flex-col space-y-4">
            <div className="bg-zinc-950 border border-zinc-850 p-4 pt-5 pb-5 rounded-xl flex flex-col items-center justify-center space-y-2 relative shadow-inner text-center">
              <span className="text-[10px] absolute top-2 left-3 font-mono text-zinc-500 uppercase">Solved Value</span>
              <span className="text-md font-bold font-mono text-indigo-400 leading-relaxed max-w-full overflow-x-auto py-1">
                {result.output}
              </span>
              {method === 'curvefit' && result.resultData.equation && (
                <span className="text-xs text-zinc-500 font-mono">
                  Discrete points and regression graph successfully registered on active canvas workspace!
                </span>
              )}
            </div>

            {result.steps && result.steps.length > 0 && (
              <div className="flex flex-col space-y-3 pt-2">
                <span className="text-xs font-bold font-mono text-zinc-400 uppercase">Numerical Convergence Tracking steps:</span>
                <div className="flex flex-col space-y-2 bg-zinc-950/50 p-4 border border-zinc-800 rounded-xl">
                  {result.steps.map((st, i) => (
                    <div key={i} className="text-xs text-zinc-300 flex items-start space-x-2.5 pb-2 border-b border-zinc-850 last:border-0 last:pb-0 font-mono">
                      <span className="text-zinc-500 text-[10px] bg-zinc-850 px-1.5 py-0.5 rounded mt-0.5">{i+1}</span>
                      <span className="flex-1 leading-relaxed text-zinc-350">{st}</span>
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
