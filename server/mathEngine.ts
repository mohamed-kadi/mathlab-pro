import { create, all } from 'mathjs';

const math = create(all);

// --- Eigenvalues and Eigenvectors (QR Algorithm) ---
/**
 * Calculates eigenvalues and optionally eigenvectors of a square, real matrix using QR iteration
 */
export function calculateEigenvaluesAndVectors(matrix: number[][], maxIterations = 150, tolerance = 1e-10) {
  const n = matrix.length;
  // Initialize matrix scale/clone
  let A = matrix.map(row => [...row]);
  let Q_accum: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

  for (let iter = 0; iter < maxIterations; iter++) {
    // Perform QR Decomposition locally
    const { q, r } = qrDecomposition(A);
    
    // Check for convergence (sub-diagonal zeros)
    let subDiagSum = 0;
    for (let i = 0; i < n - 1; i++) {
      subDiagSum += Math.abs(A[i + 1][i]);
    }
    
    // Multiply A_next = R * Q
    A = matrixMultiply(r, q);
    Q_accum = matrixMultiply(Q_accum, q);

    if (subDiagSum < tolerance) {
      break;
    }
  }

  // Eigenvalues are on the diagonal of A
  const eigenvalues = A.map((row, i) => parseFloat(row[i].toFixed(6)));
  
  // Columns of Q_accum are eigenvectors approximate
  const eigenvectors: number[][] = [];
  for (let col = 0; col < n; col++) {
    const vec: number[] = [];
    for (let row = 0; row < n; row++) {
      vec.push(parseFloat(Q_accum[row][col].toFixed(6)));
    }
    eigenvectors.push(vec);
  }

  return { eigenvalues, eigenvectors };
}

// Local QR Decomposition using Gram-Schmidt
function qrDecomposition(matrix: number[][]) {
  const m = matrix.length;
  const n = matrix[0].length;
  const q = Array.from({ length: m }, () => Array(n).fill(0));
  const r = Array.from({ length: n }, () => Array(n).fill(0));
  
  for (let j = 0; j < n; j++) {
    const v = matrix.map(row => row[j]);
    for (let i = 0; i < j; i++) {
      r[i][j] = q.reduce((sum, qRow, rowIdx) => sum + qRow[i] * matrix[rowIdx][j], 0);
      for (let rowIdx = 0; rowIdx < m; rowIdx++) {
        v[rowIdx] -= r[i][j] * q[rowIdx][i];
      }
    }
    const norm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
    r[j][j] = norm;
    
    for (let rowIdx = 0; rowIdx < m; rowIdx++) {
      q[rowIdx][j] = norm > 1e-12 ? v[rowIdx] / norm : 0;
    }
  }
  return { q, r };
}

// Matrix multiplication
function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const rowsA = A.length;
  const colsA = A[0].length;
  const colsB = B[0].length;
  const result = Array.from({ length: rowsA }, () => Array(colsB).fill(0));
  
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      let sum = 0;
      for (let k = 0; k < colsA; k++) {
        sum += A[i][k] * B[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

// --- Numerical Solvers ---

/**
 * Solve a single-variable function root using Newton-Raphson method
 */
export function solveNewtonRaphson(expression: string, initialGuess: number, maxIterations = 50, tolerance = 1e-8) {
  const steps: string[] = [];
  let x = initialGuess;
  
  // For safety, pre-compile code
  const node = math.parse(expression);
  const code = node.compile();
  
  const h = 1e-5; // Central difference for numerical derivative if needed, or math.js symbolic derivative
  let derivativeExpr: any;
  let hasSymbolicDeriv = true;
  try {
    derivativeExpr = math.derivative(expression, 'x').compile();
  } catch {
    hasSymbolicDeriv = false;
  }

  const f = (val: number): number => {
    return code.evaluate({ x: val });
  };

  const df = (val: number): number => {
    if (hasSymbolicDeriv) {
      return derivativeExpr.evaluate({ x: val });
    }
    // Fallback numerical derivative (central difference)
    return (f(val + h) - f(val - h)) / (2 * h);
  };

  steps.push(`Newton-Raphson starting point: x₀ = ${initialGuess}`);
  
  for (let i = 0; i < maxIterations; i++) {
    const fx = f(x);
    const dfx = df(x);
    
    if (Math.abs(dfx) < 1e-12) {
      steps.push(`Iteration ${i + 1}: Derivative near zero (df(x) = ${dfx}). Aborting to prevent division by zero.`);
      break;
    }

    const nextX = x - fx / dfx;
    steps.push(`Iteration ${i + 1}: x_{${i + 1}} = ${x.toFixed(6)} - (${fx.toFixed(6)} / ${dfx.toFixed(6)}) = ${nextX.toFixed(6)}`);
    
    if (Math.abs(nextX - x) < tolerance || Math.abs(fx) < tolerance) {
      x = nextX;
      steps.push(`Convergence achieved at root x ≈ ${x.toFixed(7)}`);
      return { root: x, steps, success: true };
    }
    
    x = nextX;
  }
  
  return { root: x, steps, success: false };
}

/**
 * Solve a single-variable function root using Bisection Method
 */
export function solveBisection(expression: string, a: number, b: number, maxIterations = 50, tolerance = 1e-8) {
  const steps: string[] = [];
  const code = math.parse(expression).compile();
  
  const f = (val: number): number => code.evaluate({ x: val });
  
  const fa = f(a);
  const fb = f(b);
  
  steps.push(`Bisection intervals: [a, b] = [${a}, ${b}], f(a) = ${fa.toFixed(4)}, f(b) = ${fb.toFixed(4)}`);
  
  if (fa * fb > 0) {
    steps.push(`Error: f(a) and f(b) must have opposite signs (f(a)*f(b) > 0). The Intermediate Value Theorem is not guaranteed.`);
    return { root: 0, steps, success: false };
  }
  
  let mid = (a + b) / 2;
  
  for (let i = 0; i < maxIterations; i++) {
    mid = (a + b) / 2;
    const fmid = f(mid);
    
    steps.push(`Iteration ${i + 1}: c = ${mid.toFixed(6)}, f(c) = ${fmid.toExponential(4)}, range width = ${Math.abs(b - a).toExponential(4)}`);
    
    if (Math.abs(fmid) < tolerance || Math.abs(b - a) / 2 < tolerance) {
      steps.push(`Convergence achieved at root x ≈ ${mid.toFixed(7)}`);
      return { root: mid, steps, success: true };
    }
    
    if (fa * fmid < 0) {
      b = mid;
    } else {
      a = mid;
    }
  }
  
  return { root: mid, steps, success: true };
}

/**
 * Approximate definite integration numerical method (Simpson's 1/3 Rule)
 */
export function numericalIntegration(expression: string, a: number, b: number, intervals = 100) {
  const steps: string[] = [];
  const code = math.parse(expression).compile();
  const f = (val: number): number => code.evaluate({ x: val });
  
  // Ensure intervals is even for Simpson's 1/3 rule
  const n = intervals % 2 === 0 ? intervals : intervals + 1;
  const h = (b - a) / n;
  
  steps.push(`Definite Numerical Integration from a = ${a} to b = ${b} using Simpson's 1/3 Rule with ${n} intervals (h = ${h.toFixed(6)}).`);
  
  let sum = f(a) + f(b);
  
  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    if (i % 2 === 0) {
      sum += 2 * f(x);
    } else {
      sum += 4 * f(x);
    }
  }
  
  const result = (h / 3) * sum;
  steps.push(`Simpson's Formula: I ≈ (h/3) * [f(a) + f(b) + 4*Σ(odd nodes) + 2*Σ(even nodes)]`);
  steps.push(`Result ≈ ${result.toFixed(8)}`);
  
  return { result, steps };
}

// --- Calculus Suite Solvers ---

/**
 * Evaluates the numerical limit of f(x) as x approaches c from both directions
 */
export function evaluateNumericalLimit(expression: string, c: number) {
  const node = math.parse(expression).compile();
  const f = (val: number) => {
    try {
      const r = node.evaluate({ x: val });
      return isNaN(r) || !isFinite(r) ? null : r;
    } catch {
      return null;
    }
  };

  const steps: string[] = [];
  steps.push(`Evaluating limit of f(x) as x → ${c}`);

  // Test from left
  const leftDeltas = [1e-2, 1e-4, 1e-6, 1e-8];
  const rightDeltas = [1e-2, 1e-4, 1e-6, 1e-8];

  let leftVal = null;
  for (const delta of leftDeltas) {
    const val = f(c - delta);
    if (val !== null) {
      leftVal = val;
      steps.push(`  From Left (c - ${delta}): x = ${(c - delta).toFixed(8)} => f(x) ≈ ${val.toFixed(8)}`);
    }
  }

  let rightVal = null;
  for (const delta of rightDeltas) {
    const val = f(c + delta);
    if (val !== null) {
      rightVal = val;
      steps.push(`  From Right (c + ${delta}): x = ${(c + delta).toFixed(8)} => f(x) ≈ ${val.toFixed(8)}`);
    }
  }

  if (leftVal !== null && rightVal !== null) {
    const diff = Math.abs(leftVal - rightVal);
    if (diff < 1e-3) {
      const avg = (leftVal + rightVal) / 2;
      steps.push(`Left limit (${leftVal.toFixed(6)}) and Right limit (${rightVal.toFixed(6)}) converge.`);
      return { limit: avg, steps, exists: true };
    } else {
      steps.push(`Left limit (${leftVal.toFixed(6)}) and Right limit (${rightVal.toFixed(6)}) do not match.`);
      return { limit: null, steps, exists: false, reason: "Left and Right limits do not match." };
    }
  }

  return { limit: null, steps, exists: false, reason: "Function is undefined around the target limit point." };
}

/**
 * Computes Taylor expansion polynomials for f(x) centered around x = a up to degree-N
 */
export function computeTaylorSeries(expression: string, center: number, degree: number) {
  const steps: string[] = [];
  steps.push(`Computing Taylor Series for f(x) = ${expression} centered at a = ${center} up to order n = ${degree}`);

  let currentExpr = expression;
  const terms: string[] = [];
  const latexParts: string[] = [];

  const centerValue = math.evaluate(expression, { x: center });
  terms.push(`${parseFloat(centerValue.toFixed(4))}`);
  latexParts.push(`${centerValue >= 0 ? '' : '-'}${Math.abs(parseFloat(centerValue.toFixed(4)))}`);

  let currentDerivativeNode = math.parse(expression);

  for (let d = 1; d <= degree; d++) {
    try {
      // Differentiate
      const derivSymbolic = math.derivative(currentDerivativeNode, 'x');
      currentDerivativeNode = derivSymbolic;
      
      const compiled = derivSymbolic.compile();
      const coefValue = compiled.evaluate({ x: center });
      
      const factorial = math.factorial(d);
      const finalCoef = coefValue / factorial;
      
      if (Math.abs(finalCoef) > 1e-9) {
        const coefStr = parseFloat(finalCoef.toFixed(5)).toString();
        const sign = finalCoef >= 0 ? '+' : '';
        const exponentStr = d === 1 ? '' : `^${d}`;
        const centerTerm = center === 0 ? 'x' : `(x - ${center})`;
        
        terms.push(`${sign} ${coefStr} * ${centerTerm}${exponentStr}`);
        
        const latexCoefStr = parseFloat(finalCoef.toFixed(4)).toString();
        const latexSign = finalCoef >= 0 ? '+' : '';
        const latexCenterTerm = center === 0 ? 'x' : `(x - ${center})`;
        latexParts.push(`${latexSign} ${latexCoefStr}${latexCenterTerm}${exponentStr}`);
        
        steps.push(`f^(${d})(${center}) = ${coefValue.toFixed(4)} / ${d}! = ${finalCoef.toFixed(5)}`);
      }
    } catch (e) {
      steps.push(`Error deriving at order ${d}: ${(e as Error).message}`);
      break;
    }
  }

  const polynomial = terms.join(' ').replace(/^\+\s*/, '');
  const latex = latexParts.join(' ').replace(/^\+\s*/, '');
  
  return { polynomial, latex, steps };
}

/**
 * High-performance Runge-Kutta 4th Order (RK4) ODE solver for dy/dx = f(x, y)
 */
export function solveRK4(expression: string, x0: number, y0: number, xEnd: number, stepsCount = 100) {
  const steps: string[] = [];
  const code = math.parse(expression).compile();
  const f = (xVal: number, yVal: number): number => {
    return code.evaluate({ x: xVal, y: yVal });
  };

  const h = (xEnd - x0) / stepsCount;
  let x = x0;
  let y = y0;
  
  const results: { x: number; y: number }[] = [{ x, y }];
  
  steps.push(`RK4 ODE integration for dy/dx = ${expression} from x₀ = ${x0}, y₀ = ${y0} to x_end = ${xEnd} in ${stepsCount} intervals.`);
  steps.push(`Step size h = ${h.toFixed(6)}`);

  for (let i = 0; i < stepsCount; i++) {
    const k1 = f(x, y);
    const k2 = f(x + h / 2, y + (h * k1) / 2);
    const k3 = f(x + h / 2, y + (h * k2) / 2);
    const k4 = f(x + h, y + h * k3);
    
    // Weighted RK4 step formula
    const nextY = y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    const nextX = x + h;

    if (i < 5 || i === stepsCount - 1) { // Log first few steps and last step
      steps.push(`Step ${i + 1}: x = ${nextX.toFixed(4)}, y = ${nextY.toFixed(6)} (k₁:${k1.toFixed(3)}, k₂:${k2.toFixed(3)}, k₃:${k3.toFixed(3)}, k₄:${k4.toFixed(3)})`);
    } else if (i === 5) {
      steps.push('... [additional intermediate steps calculated] ...');
    }

    x = nextX;
    y = nextY;
    results.push({ x, y });
  }

  steps.push(`Final integrated value y(${x.toFixed(4)}) ≈ ${y.toFixed(8)}`);
  return { results, finalY: y, steps };
}

// --- Statistics Suite ---

/**
 * Compiles mathematical statistics parameters and linear regression summary
 */
export function computeStatistics(numbers: number[]) {
  if (numbers.length === 0) return null;

  const n = numbers.length;
  const mean = math.mean(numbers) as number;
  const median = math.median(numbers) as number;
  
  // Custom mode helper
  const freq: Record<number, number> = {};
  let maxFreq = 0;
  numbers.forEach(v => {
    freq[v] = (freq[v] || 0) + 1;
    if (freq[v] > maxFreq) maxFreq = freq[v];
  });
  const mode = Object.keys(freq)
    .filter(k => freq[Number(k)] === maxFreq)
    .map(Number);

  const variance = (math.variance(numbers) as unknown) as number;
  const stdDev = (math.std(numbers) as unknown) as number;
  const min = (math.min(numbers) as unknown) as number;
  const max = (math.max(numbers) as unknown) as number;

  // Confidence Interval for the mean (95%)
  const marginError = 1.96 * (stdDev / Math.sqrt(n));
  const confidenceInterval = [mean - marginError, mean + marginError];

  return {
    n,
    mean,
    median,
    mode: mode.length === n ? [] : mode, // No mode if all occurs once
    variance,
    stdDev,
    min,
    max,
    confidenceInterval95: confidenceInterval,
  };
}

/**
 * Calculates a curve fit (linear or polynomial regression of degree D)
 */
export function fitCurve(points: { x: number; y: number }[], degree = 1) {
  const steps: string[] = [];
  const X = points.map(p => p.x);
  const Y = points.map(p => p.y);
  
  steps.push(`Fitting polynomial of degree D = ${degree} to ${points.length} coordinate points.`);

  // Custom least squares solver for polynomials: X * beta = Y
  // Matrix form: (M_transpose * M) * beta = (M_transpose * Y)
  const n = points.length;
  const mMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    const rowList: number[] = [];
    for (let d = 0; d <= degree; d++) {
      rowList.push(Math.pow(X[i], d));
    }
    mMatrix.push(rowList);
  }

  try {
    const M = math.matrix(mMatrix);
    const Mt = math.transpose(M);
    const MtM = math.multiply(Mt, M);
    const MtY = math.multiply(Mt, Y);
    const beta = math.lusolve(MtM, MtY) as any;
    
    // Extract coefficients [a_0, a_1, a_2, ...]
    const coefs: number[] = (beta.toArray ? beta.toArray() : beta).map((val: any) => {
      const v = Array.isArray(val) ? val[0] : val;
      return parseFloat(v.toFixed(6));
    });

    const terms: string[] = [];
    const latexParts: string[] = [];
    for (let d = degree; d >= 0; d--) {
      const c = coefs[d];
      if (Math.abs(c) > 1e-9) {
        const sign = c >= 0 ? '+' : '-';
        const absolute = Math.abs(c);
        const termX = d === 0 ? '' : d === 1 ? 'x' : `x^${d}`;
        terms.push(`${c >= 0 ? '+' : '-'} ${absolute}${termX ? '*' + termX : ''}`);
        latexParts.push(`${c >= 0 ? '+' : '-'} ${absolute}${termX}`);
      }
    }

    const fittedEquation = terms.join(' ').replace(/^\+\s*/, '').replace(/\s\*\s/g, '');
    const latexEquation = latexParts.join(' ').replace(/^\+\s*/, '');
    steps.push(`Solved Regression Vector successfully.`);
    steps.push(`Fit: y = ${fittedEquation}`);

    // Compute R²
    const yMean = math.mean(Y);
    const totalSS = Y.reduce((sum, yVal) => sum + Math.pow(yVal - yMean, 2), 0);
    
    // Predicted values
    let residualSS = 0;
    for (let i = 0; i < n; i++) {
      let yPred = 0;
      for (let d = 0; d <= degree; d++) {
        yPred += coefs[d] * Math.pow(X[i], d);
      }
      residualSS += Math.pow(Y[i] - yPred, 2);
    }
    
    const r2 = 1 - residualSS / totalSS;
    steps.push(`Coefficient of Determination R² = ${r2.toFixed(5)}`);

    return { coefficients: coefs, equation: fittedEquation, latex: latexEquation, r2, steps };
  } catch (err) {
    steps.push(`Matrix least square solution failed: ${(err as Error).message}`);
    return { coefficients: [], equation: "", r2: 0, steps };
  }
}
