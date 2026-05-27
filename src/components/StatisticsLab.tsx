import { useState } from 'react';
import { Play, RefreshCw, BarChart4, Sigma } from 'lucide-react';
import Latex from './Latex';

interface StatisticsLabProps {
  onAddHistory: (item: any) => void;
  token?: string | null;
}

export default function StatisticsLab({ onAddHistory, token }: StatisticsLabProps) {
  const [rawData, setRawData] = useState("10, 12.5, 9.8, 14.2, 11, 13.5, 10.5, 12, 11.2, 13");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [result, setResult] = useState<{
    output: string;
    latexResult: string;
    resultData: any;
    steps: string[];
  } | null>(null);

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const numbers = rawData
        .split(',')
        .map(s => s.trim())
        .filter(s => s !== '')
        .map(Number)
        .filter(n => !isNaN(n));

      if (numbers.length === 0) {
        throw new Error("Numeric array elements cannot be empty.");
      }

      const response = await fetch('/api/math/statistics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ series: numbers })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed statistics calculations on server");
      }

      setResult({
        output: data.output,
        latexResult: data.latexResult,
        resultData: data.result,
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
          type: 'statistics',
          input: `Statistics summary on series size ${numbers.length}`,
          output: data.output,
          latexInput: `\\text{Statistics}\\left( X_1, \\ldots, X_{${numbers.length}} \\right)`,
          latexOutput: data.latexResult,
          steps: data.steps,
          explanation: `Descriptive parameters calculation.`
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

  const loadPresetData = (type: string) => {
    if (type === 'test-scores') {
      setRawData("78, 85, 92, 69, 88, 74, 95, 81, 90, 87");
    } else if (type === 'sensor-noise') {
      setRawData("1.02, 0.98, 1.05, 0.95, 1.01, 1.03, 0.99, 0.97, 1.02, 1.00");
    } else if (type === 'fibonacci') {
      setRawData("1, 1, 2, 3, 5, 8, 13, 21, 34, 55");
    }
  };

  return (
    <div className="flex flex-col space-y-5 p-1">
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col space-y-4 shadow-xl">
        <span className="text-xs text-zinc-300 font-bold uppercase tracking-wide flex items-center space-x-1.5 font-mono">
          <BarChart4 className="w-4 h-4 text-indigo-500" />
          <span>Descriptive Statistics Lab Module</span>
        </span>

        <div className="flex flex-col space-y-1">
          <label className="text-xs text-zinc-400 font-medium font-mono">Input numeric series elements (Comma-separated values)</label>
          <textarea
            rows={3}
            value={rawData}
            onChange={(e) => setRawData(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg text-sm font-mono text-zinc-200 focus:outline-none focus:border-indigo-500 transition resize-none shadow-inner"
            placeholder="e.g. 10, 12.5, 9.8, 14.2, 11, 13.5"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between border-t border-zinc-800 pt-3 gap-2">
          <div className="flex items-center space-x-2 text-xs text-zinc-500">
            <span>Presets:</span>
            <button onClick={() => loadPresetData('test-scores')} className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 p-1 px-2 rounded font-mono transition">Test Scores</button>
            <button onClick={() => loadPresetData('sensor-noise')} className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 p-1 px-2 rounded font-mono transition">Sensor Noise</button>
            <button onClick={() => loadPresetData('fibonacci')} className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 p-1 px-2 rounded font-mono transition">Fibonacci First 10</button>
          </div>

          <button
            onClick={handleCalculate}
            disabled={loading || !rawData}
            className="bg-indigo-600 hover:bg-indigo-500 text-zinc-100 p-2 px-6 rounded-lg text-xs font-semibold tracking-wider uppercase transition flex items-center space-x-1"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sigma className="w-3.5 h-3.5" />}
            <span>Calculate Parameters</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-400 p-3 rounded-xl text-xs font-mono">
          [Error] {error}
        </div>
      )}

      {/* RENDER STATISTICS PROFILE SHEET */}
      {result && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
          <div className="bg-zinc-950 border-b border-zinc-800 p-3.5 flex justify-between items-center px-4 font-mono text-xs text-zinc-400">
            <span>Descriptive Statistics Profile Outcomes</span>
          </div>

          <div className="p-5 flex flex-col space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-2">
              <div className="bg-zinc-955 border border-zinc-850 p-3 rounded-xl flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-mono text-zinc-500">Sample Size N</span>
                <span className="text-lg font-bold font-mono text-indigo-400">{result.resultData.n}</span>
              </div>
              <div className="bg-zinc-955 border border-zinc-850 p-3 rounded-xl flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-mono text-zinc-500">Sample Mean μ</span>
                <span className="text-lg font-bold font-mono text-indigo-400">{result.resultData.mean.toFixed(4)}</span>
              </div>
              <div className="bg-zinc-955 border border-zinc-850 p-3 rounded-xl flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-mono text-zinc-500">Median</span>
                <span className="text-lg font-bold font-mono text-indigo-400">{result.resultData.median}</span>
              </div>
              <div className="bg-zinc-955 border border-zinc-850 p-3 rounded-xl flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-mono text-zinc-500">Std Deviation (s)</span>
                <span className="text-lg font-bold font-mono text-indigo-400">{result.resultData.stdDev.toFixed(4)}</span>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl flex justify-between items-center px-5 font-mono text-xs">
              <span className="text-zinc-500 font-sans font-medium uppercase tracking-wider text-[10px]">95% CI for the Mean:</span>
              <span className="text-amber-500 font-bold font-mono">
                [ {result.resultData.confidenceInterval95.map((v: number) => v.toFixed(5)).join(" , ")} ]
              </span>
            </div>

            {result.steps && result.steps.length > 0 && (
              <div className="flex flex-col space-y-3 pt-2">
                <span className="text-xs font-bold font-mono text-zinc-400 uppercase">Statistical mathematical calculations breakdown:</span>
                <div className="flex flex-col space-y-2 bg-zinc-950/50 p-4 border border-zinc-800 rounded-xl">
                  {result.steps.map((st, i) => (
                    <div key={i} className="text-xs text-zinc-350 flex items-start space-x-2.5 pb-2 border-b border-zinc-850 last:border-0 last:pb-0">
                      <span className="text-indigo-400 font-bold text-[10px] bg-zinc-850 px-1.5 py-0.5 rounded mt-0.5">{i+1}</span>
                      <span className="flex-1 font-sans font-mono leading-relaxed">{st}</span>
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
