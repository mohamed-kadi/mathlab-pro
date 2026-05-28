import { create, all } from 'mathjs';

const math = create(all);

const EXPRESSION_MAX_LENGTH = 1000;
const EXPRESSION_MAX_NODES = 250;
const EPSILON = 1e-10;

const allowedFunctionNames = new Set([
  'abs', 'acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2', 'atanh',
  'ceil', 'cos', 'cosh', 'cot', 'csc', 'cube', 'cbrt', 'exp',
  'floor', 'log', 'log10', 'log2', 'max', 'min', 'pow', 'round',
  'sec', 'sign', 'sin', 'sinh', 'sqrt', 'tan', 'tanh'
]);

const allowedConstantNames = new Set(['e', 'E', 'pi', 'PI', 'tau']);

const blockedNodeTypes = new Set([
  'AccessorNode',
  'ArrayNode',
  'AssignmentNode',
  'BlockNode',
  'FunctionAssignmentNode',
  'IndexNode',
  'ObjectNode',
  'RangeNode'
]);

type Polynomial = Map<number, number>;

export class MathValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MathValidationError';
  }
}

export interface ExpressionSafetyOptions {
  variables?: string[];
  maxLength?: number;
  maxNodes?: number;
}

export function assertSafeExpression(expression: unknown, options: ExpressionSafetyOptions = {}) {
  if (typeof expression !== 'string' || expression.trim().length === 0) {
    throw new MathValidationError('A non-empty math expression is required.');
  }

  const source = expression.trim();
  const maxLength = options.maxLength || EXPRESSION_MAX_LENGTH;
  if (source.length > maxLength) {
    throw new MathValidationError(`Expression is too long. Maximum length is ${maxLength} characters.`);
  }

  const allowedVariables = new Set(options.variables || ['x']);
  const maxNodes = options.maxNodes || EXPRESSION_MAX_NODES;
  const root = math.parse(source);
  let nodeCount = 0;

  (root as any).traverse((node: any, path: string, parent: any) => {
    nodeCount += 1;
    if (nodeCount > maxNodes) {
      throw new MathValidationError(`Expression is too complex. Maximum parse nodes is ${maxNodes}.`);
    }

    if (blockedNodeTypes.has(node.type)) {
      throw new MathValidationError(`Unsupported expression construct: ${node.type}.`);
    }

    if (node.type === 'FunctionNode') {
      const fnName = node.fn?.name || node.name;
      if (!fnName || !allowedFunctionNames.has(fnName)) {
        throw new MathValidationError(`Function "${fnName || 'unknown'}" is not allowed.`);
      }
    }

    if (node.type === 'SymbolNode') {
      const isFunctionReference = parent?.type === 'FunctionNode' && path === 'fn';
      if (
        isFunctionReference ||
        allowedVariables.has(node.name) ||
        allowedConstantNames.has(node.name) ||
        allowedFunctionNames.has(node.name)
      ) {
        return;
      }
      throw new MathValidationError(`Symbol "${node.name}" is not allowed for this operation.`);
    }
  });

  return source;
}

export function normalizeVariableName(variable: unknown, fallback = 'x') {
  const name = typeof variable === 'string' && variable.trim() ? variable.trim() : fallback;
  if (!/^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(name)) {
    throw new MathValidationError('Variable name must start with a letter and contain only letters, numbers, or underscores.');
  }
  return name;
}

export function integratePolynomialExpression(expression: string, variable = 'x') {
  const polynomial = parsePolynomialExpression(expression, variable);
  const integrated = new Map<number, number>();
  for (const [power, coefficient] of polynomial.entries()) {
    integrated.set(power + 1, coefficient / (power + 1));
  }

  const formatted = formatPolynomial(integrated, variable);
  const latex = polynomialLatex(formatted);
  return {
    output: `F(${variable}) = ${formatted} + C`,
    latexOutput: `\\int \\left(${math.parse(expression).toTex()}\\right) d${variable} = ${latex} + C`,
    steps: [
      `Parsed ${expression} as a univariate polynomial in ${variable}.`,
      `Applied the power rule term-by-term: integral of a*${variable}^n is a*${variable}^(n+1)/(n+1).`,
      `Combined integrated terms: ${formatted} + C.`
    ]
  };
}

export function multiplyPolynomialExpressions(expression: string, operand: string, variable = 'x') {
  const product = multiplyPolynomials(
    parsePolynomialExpression(expression, variable),
    parsePolynomialExpression(operand, variable)
  );
  const formatted = formatPolynomial(product, variable);
  return {
    output: formatted,
    latexOutput: `\\left(${math.parse(expression).toTex()}\\right)\\left(${math.parse(operand).toTex()}\\right) = ${polynomialLatex(formatted)}`,
    steps: [
      `Parsed both operands as polynomials in ${variable}.`,
      'Multiplied each term in the first polynomial by each term in the second polynomial.',
      `Combined like powers of ${variable}: ${formatted}.`
    ]
  };
}

export function dividePolynomialExpressions(expression: string, divisorExpression: string, variable = 'x') {
  const dividend = parsePolynomialExpression(expression, variable);
  const divisor = parsePolynomialExpression(divisorExpression, variable);
  const divisorDegree = polynomialDegree(divisor);
  if (divisorDegree < 0) {
    throw new MathValidationError('Polynomial division by zero is not allowed.');
  }

  const quotient = new Map<number, number>();
  let remainder = clonePolynomial(dividend);
  const steps = [
    `Dividend degree: ${polynomialDegree(dividend)}. Divisor degree: ${divisorDegree}.`,
    'Apply polynomial long division using leading terms.'
  ];

  while (polynomialDegree(remainder) >= divisorDegree && polynomialDegree(remainder) >= 0) {
    const remDegree = polynomialDegree(remainder);
    const leadingPower = remDegree - divisorDegree;
    const leadingCoefficient = (remainder.get(remDegree) || 0) / (divisor.get(divisorDegree) || 1);
    const term = new Map([[leadingPower, leadingCoefficient]]);
    quotient.set(leadingPower, (quotient.get(leadingPower) || 0) + leadingCoefficient);
    remainder = subtractPolynomials(remainder, multiplyPolynomials(divisor, term));
    steps.push(`Cancel leading degree ${remDegree} with term ${formatPolynomial(term, variable)}.`);
  }

  const quotientText = formatPolynomial(quotient, variable);
  const remainderText = formatPolynomial(remainder, variable);
  return {
    output: `Quotient: ${quotientText}; Remainder: ${remainderText}`,
    latexOutput: `\\frac{${math.parse(expression).toTex()}}{${math.parse(divisorExpression).toTex()}} = ${polynomialLatex(quotientText)}${polynomialDegree(remainder) >= 0 ? ` + \\frac{${polynomialLatex(remainderText)}}{${math.parse(divisorExpression).toTex()}}` : ''}`,
    steps: [...steps, `Final quotient is ${quotientText}.`, `Final remainder is ${remainderText}.`]
  };
}

export function expandPolynomialExpression(expression: string, variable = 'x') {
  const polynomial = parsePolynomialExpression(expression, variable);
  const formatted = formatPolynomial(polynomial, variable);
  return {
    output: formatted,
    latexOutput: polynomialLatex(formatted),
    steps: [
      `Parsed expression as a polynomial in ${variable}.`,
      `Expanded products and powers into coefficients by degree.`,
      `Combined equivalent powers: ${formatted}.`
    ]
  };
}

export function factorPolynomialExpression(expression: string, variable = 'x') {
  const polynomial = parsePolynomialExpression(expression, variable);
  const degree = polynomialDegree(polynomial);
  const formatted = formatPolynomial(polynomial, variable);

  if (degree === 0) {
    return {
      output: formatted,
      latexOutput: polynomialLatex(formatted),
      steps: ['Constant expressions are already factored.']
    };
  }

  if (degree === 1) {
    const a = polynomial.get(1) || 0;
    const b = polynomial.get(0) || 0;
    const root = -b / a;
    const factored = `${formatCoefficient(a)}*${formatRootFactor(variable, root)}`;
    return {
      output: normalizeLeadingOne(factored),
      latexOutput: polynomialLatex(normalizeLeadingOne(factored)),
      steps: [`Solved ${formatPolynomial(polynomial, variable)} = 0 for root ${variable} = ${formatNumber(root)}.`, 'Rewrote the linear polynomial from its root.']
    };
  }

  if (degree === 2) {
    const a = polynomial.get(2) || 0;
    const b = polynomial.get(1) || 0;
    const c = polynomial.get(0) || 0;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < -EPSILON) {
      return {
        output: `${formatted} is irreducible over the real numbers.`,
        latexOutput: polynomialLatex(formatted),
        steps: [`Discriminant Δ = ${formatNumber(discriminant)} < 0, so no real linear factors exist.`]
      };
    }
    const sqrtDisc = Math.sqrt(Math.max(0, discriminant));
    const root1 = (-b + sqrtDisc) / (2 * a);
    const root2 = (-b - sqrtDisc) / (2 * a);
    const leading = Math.abs(a - 1) < EPSILON ? '' : `${formatCoefficient(a)}*`;
    const factored = `${leading}${formatRootFactor(variable, root1)}*${formatRootFactor(variable, root2)}`;
    return {
      output: normalizeLeadingOne(factored),
      latexOutput: polynomialLatex(normalizeLeadingOne(factored)),
      steps: [
        `Quadratic coefficients: a = ${formatNumber(a)}, b = ${formatNumber(b)}, c = ${formatNumber(c)}.`,
        `Discriminant Δ = b^2 - 4ac = ${formatNumber(discriminant)}.`,
        `Roots are ${formatNumber(root1)} and ${formatNumber(root2)}; convert roots into linear factors.`
      ]
    };
  }

  return {
    output: `Expanded form: ${formatted}. Full symbolic factorization currently supports degree 2 or lower.`,
    latexOutput: polynomialLatex(formatted),
    steps: [
      `Parsed polynomial degree ${degree}.`,
      'Exact linear/quadratic factorization is available; higher-degree factorization is intentionally not guessed.'
    ]
  };
}

export function findPolynomialRootsExpression(expression: string, variable = 'x') {
  const polynomial = parsePolynomialExpression(expression, variable);
  const degree = polynomialDegree(polynomial);
  if (degree < 1) {
    return {
      output: 'Constant polynomial has no variable roots.',
      latexOutput: '\\varnothing',
      roots: [] as number[],
      steps: ['Detected a constant polynomial.']
    };
  }

  if (degree === 1) {
    const root = -(polynomial.get(0) || 0) / (polynomial.get(1) || 1);
    return {
      output: `Root: ${variable} = ${formatNumber(root)}`,
      latexOutput: `${variable} = ${formatNumber(root)}`,
      roots: [root],
      steps: ['Solved the linear equation a*x + b = 0.']
    };
  }

  if (degree === 2) {
    const a = polynomial.get(2) || 0;
    const b = polynomial.get(1) || 0;
    const c = polynomial.get(0) || 0;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < -EPSILON) {
      const real = -b / (2 * a);
      const imaginary = Math.sqrt(-discriminant) / (2 * Math.abs(a));
      return {
        output: `Complex roots: ${formatNumber(real)} ± ${formatNumber(imaginary)}i`,
        latexOutput: `${variable} = ${formatNumber(real)} \\pm ${formatNumber(imaginary)}i`,
        roots: [] as number[],
        steps: [`Discriminant Δ = ${formatNumber(discriminant)} < 0, so real roots do not exist.`]
      };
    }
    const sqrtDisc = Math.sqrt(Math.max(0, discriminant));
    const roots = [(-b + sqrtDisc) / (2 * a), (-b - sqrtDisc) / (2 * a)];
    const uniqueRoots = roots.filter((root, index) => roots.findIndex(candidate => Math.abs(candidate - root) < EPSILON) === index);
    return {
      output: `Roots: ${uniqueRoots.map(root => `${variable} = ${formatNumber(root)}`).join(', ')}`,
      latexOutput: `${variable} \\in \\left\\{ ${uniqueRoots.map(formatNumber).join(', ')} \\right\\}`,
      roots: uniqueRoots,
      steps: [
        `Quadratic coefficients: a = ${formatNumber(a)}, b = ${formatNumber(b)}, c = ${formatNumber(c)}.`,
        `Discriminant Δ = ${formatNumber(discriminant)}.`,
        'Applied the quadratic formula.'
      ]
    };
  }

  throw new MathValidationError('Exact polynomial roots currently support degree 2 or lower. Use numerical methods for higher-degree roots.');
}

function parsePolynomialExpression(expression: string, variable: string): Polynomial {
  return normalizePolynomial(polynomialFromNode(math.parse(expression), variable));
}

function polynomialFromNode(node: any, variable: string): Polynomial {
  if (node.type === 'ParenthesisNode') {
    return polynomialFromNode(node.content, variable);
  }

  if (node.type === 'ConstantNode') {
    return new Map([[0, Number(node.value)]]);
  }

  if (node.type === 'SymbolNode') {
    if (node.name === variable) return new Map([[1, 1]]);
    if (allowedConstantNames.has(node.name)) {
      const constantValue = node.name === 'tau' ? 2 * Math.PI : Number(math.evaluate(node.name));
      return new Map([[0, constantValue]]);
    }
    throw new MathValidationError(`"${node.name}" is not a valid polynomial variable here.`);
  }

  if (node.type !== 'OperatorNode') {
    throw new MathValidationError(`Only polynomial arithmetic is supported for this operation. Found ${node.type}.`);
  }

  const args = node.args || [];
  if (node.op === '+' && args.length === 2) {
    return addPolynomials(polynomialFromNode(args[0], variable), polynomialFromNode(args[1], variable));
  }
  if (node.op === '-' && args.length === 2) {
    return subtractPolynomials(polynomialFromNode(args[0], variable), polynomialFromNode(args[1], variable));
  }
  if (node.op === '-' && args.length === 1) {
    return scalePolynomial(polynomialFromNode(args[0], variable), -1);
  }
  if (node.op === '*' && args.length === 2) {
    return multiplyPolynomials(polynomialFromNode(args[0], variable), polynomialFromNode(args[1], variable));
  }
  if (node.op === '/' && args.length === 2) {
    const numerator = polynomialFromNode(args[0], variable);
    const denominator = polynomialFromNode(args[1], variable);
    if (polynomialDegree(denominator) !== 0) {
      throw new MathValidationError('Polynomial terms may only be divided by numeric constants.');
    }
    const constant = denominator.get(0) || 0;
    if (Math.abs(constant) < EPSILON) {
      throw new MathValidationError('Division by zero is not allowed.');
    }
    return scalePolynomial(numerator, 1 / constant);
  }
  if (node.op === '^' && args.length === 2) {
    const exponentPoly = polynomialFromNode(args[1], variable);
    if (polynomialDegree(exponentPoly) !== 0) {
      throw new MathValidationError('Polynomial exponents must be fixed non-negative integers.');
    }
    const exponent = exponentPoly.get(0) || 0;
    if (!Number.isInteger(exponent) || exponent < 0 || exponent > 20) {
      throw new MathValidationError('Polynomial exponents must be integers between 0 and 20.');
    }
    return powPolynomial(polynomialFromNode(args[0], variable), exponent);
  }

  throw new MathValidationError(`Unsupported polynomial operator "${node.op}".`);
}

function clonePolynomial(polynomial: Polynomial): Polynomial {
  return new Map(polynomial.entries());
}

function normalizePolynomial(polynomial: Polynomial): Polynomial {
  const normalized = new Map<number, number>();
  for (const [power, coefficient] of polynomial.entries()) {
    if (Math.abs(coefficient) > EPSILON) {
      normalized.set(power, coefficient);
    }
  }
  return normalized;
}

function polynomialDegree(polynomial: Polynomial) {
  const normalized = normalizePolynomial(polynomial);
  if (normalized.size === 0) return -1;
  return Math.max(...normalized.keys());
}

function addPolynomials(left: Polynomial, right: Polynomial): Polynomial {
  const result = clonePolynomial(left);
  for (const [power, coefficient] of right.entries()) {
    result.set(power, (result.get(power) || 0) + coefficient);
  }
  return normalizePolynomial(result);
}

function subtractPolynomials(left: Polynomial, right: Polynomial): Polynomial {
  return addPolynomials(left, scalePolynomial(right, -1));
}

function scalePolynomial(polynomial: Polynomial, factor: number): Polynomial {
  const result = new Map<number, number>();
  for (const [power, coefficient] of polynomial.entries()) {
    result.set(power, coefficient * factor);
  }
  return normalizePolynomial(result);
}

function multiplyPolynomials(left: Polynomial, right: Polynomial): Polynomial {
  const result = new Map<number, number>();
  for (const [leftPower, leftCoefficient] of left.entries()) {
    for (const [rightPower, rightCoefficient] of right.entries()) {
      const power = leftPower + rightPower;
      result.set(power, (result.get(power) || 0) + leftCoefficient * rightCoefficient);
    }
  }
  return normalizePolynomial(result);
}

function powPolynomial(polynomial: Polynomial, exponent: number): Polynomial {
  let result: Polynomial = new Map([[0, 1]]);
  for (let i = 0; i < exponent; i++) {
    result = multiplyPolynomials(result, polynomial);
  }
  return result;
}

function formatPolynomial(polynomial: Polynomial, variable: string) {
  const normalized = normalizePolynomial(polynomial);
  if (normalized.size === 0) return '0';

  return [...normalized.entries()]
    .sort(([leftPower], [rightPower]) => rightPower - leftPower)
    .map(([power, coefficient], index) => {
      const sign = coefficient < 0 ? '-' : index === 0 ? '' : '+';
      const term = formatTerm(Math.abs(coefficient), power, variable);
      return `${sign}${sign ? ' ' : ''}${term}`;
    })
    .join(' ')
    .trim();
}

function formatTerm(coefficient: number, power: number, variable: string) {
  if (power === 0) return formatNumber(coefficient);
  const variablePart = power === 1 ? variable : `${variable}^${power}`;
  if (Math.abs(coefficient - 1) < EPSILON) return variablePart;
  return `${formatCoefficient(coefficient)}*${variablePart}`;
}

function formatCoefficient(coefficient: number) {
  return formatNumber(coefficient);
}

function formatNumber(value: number) {
  if (Math.abs(value) < EPSILON) return '0';
  if (Number.isInteger(value)) return String(value);

  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  for (let denominator = 2; denominator <= 100; denominator++) {
    const numerator = Math.round(absolute * denominator);
    if (Math.abs(absolute - numerator / denominator) < 1e-8) {
      return `${sign}${numerator}/${denominator}`;
    }
  }

  return String(Number(value.toFixed(8)));
}

function polynomialLatex(formatted: string) {
  try {
    return math.parse(formatted).toTex();
  } catch {
    return formatted;
  }
}

function formatRootFactor(variable: string, root: number) {
  if (Math.abs(root) < EPSILON) return variable;
  return root > 0
    ? `(${variable} - ${formatNumber(root)})`
    : `(${variable} + ${formatNumber(Math.abs(root))})`;
}

function normalizeLeadingOne(expression: string) {
  return expression.replace(/^1\*/, '').replace(/^-1\*/, '-');
}

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
  
  let fa = f(a);
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
      fa = fmid;
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
