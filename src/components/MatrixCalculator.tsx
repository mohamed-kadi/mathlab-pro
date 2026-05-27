import { useState } from 'react';
import { Play, RefreshCw, Grid3X3, ArrowRight, CornerDownRight } from 'lucide-react';
import Latex from './Latex';

interface MatrixCalculatorProps {
  onAddHistory: (item: any) => void;
  token?: string | null;
}

export default function MatrixCalculator({ onAddHistory, token }: MatrixCalculatorProps) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  
  // Matrix A state
  const [matrixA, setMatrixA] = useState<number[][]>([
    [2, -1, 0],
    [-1, 2, -1],
    [0, -1, 2]
  ]);

  // Matrix B state
  const [matrixB, setMatrixB] = useState<number[][]>([
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ]);

  // Vector b (for Ax = b)
  const [vectorB, setVectorB] = useState<number[]>([1, 2, 3]);

  const [operation, setOperation] = useState<'add' | 'multiply' | 'determinant' | 'inverse' | 'lu' | 'qr' | 'eigen' | 'solveLinear'>('lu');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    output: string;
    latexResult: string;
    resultData: any;
    steps: string[];
  } | null>(null);

  // Resize Matrix A helper
  const handleDimensionChange = (newRows: number, newCols: number) => {
    setRows(newRows);
    setCols(newCols);
    
    const nextA = Array.from({ length: newRows }, (_, r) =>
      Array.from({ length: newCols }, (_, c) => (matrixA[r]?.[c] !== undefined ? matrixA[r][c] : r === c ? 1 : 0))
    );
    setMatrixA(nextA);

    const nextB = Array.from({ length: newRows }, (_, r) =>
      Array.from({ length: newCols }, (_, c) => (matrixB[r]?.[c] !== undefined ? matrixB[r][c] : r === c ? 1 : 0))
    );
    setMatrixB(nextB);

    const nextVec = Array.from({ length: newRows }, (_, r) => (vectorB[r] !== undefined ? vectorB[r] : 0));
    setVectorB(nextVec);
  };

  const updateCellA = (rIdx: number, cIdx: number, val: string) => {
    const nextA = matrixA.map((row, r) =>
      row.map((cell, c) => (r === rIdx && c === cIdx ? (val === '' ? 0 : parseFloat(val) || 0) : cell))
    );
    setMatrixA(nextA);
  };

  const updateCellB = (rIdx: number, cIdx: number, val: string) => {
    const nextB = matrixB.map((row, r) =>
      row.map((cell, c) => (r === rIdx && c === cIdx ? (val === '' ? 0 : parseFloat(val) || 0) : cell))
    );
    setMatrixB(nextB);
  };

  const updateVectorCell = (idx: number, val: string) => {
    const nextVec = vectorB.map((cell, r) => (r === idx ? (val === '' ? 0 : parseFloat(val) || 0) : cell));
    setVectorB(nextVec);
  };

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/math/matrix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          matrixA,
          matrixB: (operation === 'add' || operation === 'multiply') ? matrixB : undefined,
          vectorB: (operation === 'solveLinear') ? vectorB : undefined,
          operation
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed matrix calculations under server");
      }

      setResult({
        output: data.output,
        latexResult: data.latexResult,
        resultData: data.result,
        steps: data.steps
      });

      // Saved history
      const histRes = await fetch('/api/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          type: 'matrix',
          input: `Matrix operation: ${operation} on Matrix A (${rows}x${cols})`,
          output: data.output,
          latexInput: `\\text{${operation}}\\left( \\mathbf{A} \\right)`,
          latexOutput: data.latexResult,
          steps: data.steps,
          explanation: `System matrix linear algebra calculations.`
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

  const loadPresettedMatrix = (preset: string) => {
    setError(null);
    if (preset === 'identity') {
      handleDimensionChange(3, 3);
      setMatrixA([
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
      ]);
    } else if (preset === 'hilbert') {
      handleDimensionChange(3, 3);
      setMatrixA([
        [1, 1/2, 1/3],
        [1/2, 1/3, 1/4],
        [1/3, 1/4, 1/5]
      ]);
    } else if (preset === 'magic') {
      handleDimensionChange(3, 3);
      setMatrixA([
        [8, 1, 6],
        [3, 5, 7],
        [4, 9, 2]
      ]);
    }
  };

  return (
    <div className="flex flex-col space-y-5 p-1">
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 pb-3 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(['lu', 'qr', 'eigen', 'determinant', 'inverse', 'solveLinear', 'multiply', 'add'] as const).map(op => (
              <button
                key={op}
                onClick={() => setOperation(op)}
                className={`p-1.5 px-3 text-xs rounded-lg font-medium transition uppercase ${operation === op ? 'bg-indigo-600 border border-indigo-500 text-zinc-100' : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'}`}
              >
                {op === 'solveLinear' ? 'Solve Ax=b' : op}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-800 text-xs text-zinc-400 font-mono">
            <span className="font-sans pr-1">Size:</span>
            <button onClick={() => handleDimensionChange(2, 2)} className={`px-1.5 py-0.5 rounded hover:bg-zinc-800 ${rows === 2 && cols === 2 ? 'text-indigo-400 font-semibold' : ''}`}>2x2</button>
            <span>|</span>
            <button onClick={() => handleDimensionChange(3, 3)} className={`px-1.5 py-0.5 rounded hover:bg-zinc-800 ${rows === 3 && cols === 3 ? 'text-indigo-400 font-semibold' : ''}`}>3x3</button>
            <span>|</span>
            <button onClick={() => handleDimensionChange(4, 4)} className={`px-1.5 py-0.5 rounded hover:bg-zinc-800 ${rows === 4 && cols === 4 ? 'text-indigo-400 font-semibold' : ''}`}>4x4</button>
          </div>
        </div>

        {/* INPUTS AREA */}
        <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-4 justify-around py-3">
          {/* MATRIX A COLUMN */}
          <div className="flex flex-col space-y-2">
            <div className="flex justify-between items-center px-1">
              <span className="text-xs text-zinc-300 font-bold uppercase tracking-wide flex items-center space-x-1.5 font-mono">
                <Grid3X3 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Matrix A ({rows}x{cols})</span>
              </span>
            </div>
            <div 
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              className="grid gap-2 bg-zinc-950 p-3.5 border border-zinc-800 rounded-xl"
            >
              {matrixA.map((rowArr, r) =>
                rowArr.map((cell, c) => (
                  <input
                    key={`A-${r}-${c}`}
                    type="number"
                    step="any"
                    value={cell}
                    onChange={(e) => updateCellA(r, c, e.target.value)}
                    className="w-16 bg-zinc-900 border border-zinc-850 p-2 text-center text-sm font-mono text-indigo-400 hover:border-zinc-700 focus:outline-none focus:border-indigo-500 rounded transition"
                  />
                ))
              )}
            </div>
          </div>

          {/* TRANSITIONAL OPERATOR ICON */}
          <div className="flex flex-col justify-center self-center h-full">
            {(operation === 'add' || operation === 'multiply' || operation === 'solveLinear') ? (
              <div className="flex flex-col items-center bg-zinc-950/40 p-2 rounded-xl border border-dashed border-zinc-800">
                <ArrowRight className="w-5 h-5 text-zinc-500" />
                <span className="text-[10px] uppercase font-mono text-zinc-500 mt-1">
                  {operation === 'add' ? 'plus' : operation === 'multiply' ? 'dot' : 'solves'}
                </span>
              </div>
            ) : <span className="text-zinc-500 font-bold">⇒</span>}
          </div>

          {/* SECONDARY INPUT (MATRIX B or VECTOR b) */}
          {(operation === 'add' || operation === 'multiply') && (
            <div className="flex flex-col space-y-2 animate-fadeIn">
              <span className="text-xs text-zinc-300 font-bold uppercase tracking-wide flex items-center space-x-1.5 font-mono">
                <Grid3X3 className="w-3.5 h-3.5 text-amber-500" />
                <span>Matrix B ({rows}x{cols})</span>
              </span>
              <div 
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                className="grid gap-2 bg-zinc-950 p-3.5 border border-zinc-800 rounded-xl animate-fadeIn"
              >
                {matrixB.map((rowArr, r) =>
                  rowArr.map((cell, c) => (
                    <input
                      key={`B-${r}-${c}`}
                      type="number"
                      step="any"
                      value={cell}
                      onChange={(e) => updateCellB(r, c, e.target.value)}
                      className="w-16 bg-zinc-900 border border-zinc-850 p-2 text-center text-sm font-mono text-amber-500 hover:border-zinc-700 focus:outline-none focus:border-indigo-500 rounded transition"
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {operation === 'solveLinear' && (
            <div className="flex flex-col space-y-2 animate-fadeIn">
              <span className="text-xs text-zinc-300 font-bold uppercase tracking-wide font-mono">Vector b ({rows}x1)</span>
              <div className="flex flex-col space-y-2 bg-zinc-950 p-3.5 border border-zinc-800 rounded-xl">
                {vectorB.map((cell, r) => (
                  <input
                    key={`vec-${r}`}
                    type="number"
                    step="any"
                    value={cell}
                    onChange={(e) => updateVectorCell(r, e.target.value)}
                    className="w-16 bg-zinc-900 border border-zinc-850 p-2 text-center text-sm font-mono text-amber-500 focus:outline-none focus:border-indigo-500 rounded transition"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CONTROLS FOOTER */}
        <div className="flex flex-wrap items-center justify-between border-t border-zinc-800 pt-3 gap-2">
          <div className="flex items-center space-x-2 text-xs text-zinc-500">
            <span>Presets:</span>
            <button onClick={() => loadPresettedMatrix('identity')} className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 p-1 px-2 rounded font-mono transition">Identity</button>
            <button onClick={() => loadPresettedMatrix('hilbert')} className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 p-1 px-2 rounded font-mono transition">Hilbert</button>
            <button onClick={() => loadPresettedMatrix('magic')} className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 p-1 px-2 rounded font-mono transition">Magic 3x3</button>
          </div>

          <button
            onClick={handleCalculate}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-zinc-100 p-2 px-6 rounded-lg text-xs font-semibold tracking-wider uppercase transition flex items-center space-x-1 px-2 py-2 rounded-lg"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Calculate Linear Algebra</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-400 p-3 rounded-xl text-xs font-mono">
          [Error] {error}
        </div>
      )}

      {/* MATRIX RESULTS */}
      {result && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
          <div className="bg-zinc-950 border-b border-zinc-800 p-3.5 flex justify-between items-center px-4">
            <span className="text-xs text-zinc-400 font-mono">Linear Matrix Solver Output</span>
          </div>

          <div className="p-5 flex flex-col space-y-4">
            <div className="bg-zinc-950 border border-zinc-855 p-5 pt-6 pb-6 rounded-xl flex flex-col items-center justify-center space-y-3 relative shadow-inner">
              <span className="text-[10px] absolute top-2 left-3 font-mono text-zinc-500 uppercase">Calculated Matrix Results</span>
              <div className="w-full overflow-x-auto py-1 text-center">
                <Latex expression={result.latexResult} displayMode={true} />
              </div>
              <span className="text-xs font-mono text-zinc-500">{result.output}</span>
            </div>

            {/* Matrix result metrics based on decomposition */}
            {operation === 'eigen' && result.resultData.eigenvalues && (
              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex flex-col space-y-3 font-mono text-xs">
                <span className="font-semibold text-zinc-400 uppercase tracking-wider font-sans border-b border-zinc-850 pb-1.5">Eigen Space Decomposition:</span>
                {result.resultData.eigenvalues.map((val: number, idx: number) => (
                  <div key={idx} className="flex flex-col space-y-1.5 bg-zinc-900 border border-zinc-850 p-2.5 rounded-lg">
                    <div className="flex items-center text-zinc-200">
                      <CornerDownRight className="w-3.5 h-3.5 text-indigo-500 mr-1.5" />
                      <span>Eigenvalue λ_{idx+1} = <strong className="text-indigo-400">{val}</strong></span>
                    </div>
                    {result.resultData.eigenvectors?.[idx] && (
                      <div className="pl-5 text-zinc-400 flex items-center">
                        <span>Associated Eigenvector v_{idx+1} ≈ [ {result.resultData.eigenvectors[idx].join(", ")} ]^T</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {result.steps && result.steps.length > 0 && (
              <div className="flex flex-col space-y-3 pt-2">
                <span className="text-xs font-bold font-mono text-zinc-400 uppercase">System Gaussian Matrix pivots logic:</span>
                <div className="flex flex-col space-y-2 bg-zinc-950/50 p-4 border border-zinc-800 rounded-xl">
                  {result.steps.map((st, i) => (
                    <div key={i} className="text-xs text-zinc-350 flex items-start space-x-2.5 pb-2 border-b border-zinc-850 last:border-0 last:pb-0">
                      <span className="text-zinc-500 font-bold font-mono text-[10.5px] bg-zinc-850 px-1.5 py-0.5 rounded mt-0.5">{i+1}</span>
                      <span className="flex-1 font-sans leading-relaxed">{st}</span>
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
