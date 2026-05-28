package com.mathlabpro.math;

import com.mathlabpro.common.ApiException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.TimeUnit;
import java.util.function.DoubleUnaryOperator;
import java.util.regex.Pattern;
import org.apache.commons.math3.analysis.UnivariateFunction;
import org.apache.commons.math3.analysis.integration.SimpsonIntegrator;
import org.apache.commons.math3.fitting.PolynomialCurveFitter;
import org.apache.commons.math3.fitting.WeightedObservedPoints;
import org.apache.commons.math3.linear.ArrayRealVector;
import org.apache.commons.math3.linear.DecompositionSolver;
import org.apache.commons.math3.linear.EigenDecomposition;
import org.apache.commons.math3.linear.LUDecomposition;
import org.apache.commons.math3.linear.MatrixUtils;
import org.apache.commons.math3.linear.QRDecomposition;
import org.apache.commons.math3.linear.RealMatrix;
import org.apache.commons.math3.linear.RealVector;
import org.apache.commons.math3.stat.descriptive.moment.Mean;
import org.apache.commons.math3.stat.descriptive.moment.StandardDeviation;
import org.apache.commons.math3.stat.descriptive.moment.Variance;
import org.apache.commons.math3.stat.descriptive.rank.Max;
import org.apache.commons.math3.stat.descriptive.rank.Median;
import org.apache.commons.math3.stat.descriptive.rank.Min;
import org.matheclipse.core.eval.ExprEvaluator;
import org.matheclipse.core.interfaces.IExpr;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class MathEngineService {

    private static final double EPSILON = 1e-10;
    private static final int MAX_EXPRESSION_LENGTH = 1000;
    private static final int MAX_SYMBOLIC_OUTPUT_LENGTH = 8000;
    private static final long SYMBOLIC_TIMEOUT_SECONDS = 2;
    private static final Pattern VARIABLE_PATTERN = Pattern.compile("^[A-Za-z][A-Za-z0-9_]{0,15}$");
    private static final Pattern SYMBOLIC_PATTERN = Pattern.compile("^[A-Za-z0-9_+\\-*/^().,=\\s]+$");

    public Map<String, Object> polynomial(Map<String, Object> request) {
        String operation = requiredString(request, "operation");
        String variable = variableName(request.get("variable"));
        String expression = requiredExpression(request, "expression");
        Polynomial polynomial = parsePolynomial(expression, variable);

        return switch (operation) {
            case "simplify" -> text(polynomial.format(variable), polynomial.format(variable), List.of(
                "Parsed the expression as a bounded univariate polynomial.",
                "Combined equivalent powers of " + variable + "."
            ));
            case "derivative" -> {
                Polynomial derivative = polynomial.derivative();
                String derivativeText = derivative.format(variable);
                String output = equivalentFactoredOutput(derivative, variable);
                yield text(output, derivativeText, List.of(
                    "Target function: f(" + variable + ") = " + expression,
                    "Applied the power rule term-by-term.",
                    "Derivative: " + output
                ));
            }
            case "integrate" -> {
                Polynomial integral = polynomial.integrate();
                yield text("F(" + variable + ") = " + integral.format(variable) + " + C", integral.format(variable) + " + C", List.of(
                    "Parsed the expression as a bounded univariate polynomial.",
                    "Applied the power rule term-by-term.",
                    "Added the integration constant C."
                ));
            }
            case "multiply" -> {
                String operand = requiredExpression(request, "operand2");
                Polynomial product = polynomial.multiply(parsePolynomial(operand, variable));
                yield text(product.format(variable), product.format(variable), List.of(
                    "Parsed both operands as polynomials in " + variable + ".",
                    "Multiplied every term pair.",
                    "Combined like powers: " + product.format(variable)
                ));
            }
            case "divide" -> {
                String operand = requiredExpression(request, "operand2");
                Polynomial.Division division = polynomial.divide(parsePolynomial(operand, variable));
                String output = "Quotient: " + division.quotient().format(variable) + "; Remainder: " + division.remainder().format(variable);
                yield text(output, output, List.of(
                    "Applied polynomial long division using leading terms.",
                    "Computed quotient and remainder.",
                    output
                ));
            }
            case "factor" -> factorResponse(polynomial, variable);
            case "roots" -> rootsResponse(polynomial, variable);
            default -> throw badRequest("Unsupported polynomial operation.");
        };
    }

    public Map<String, Object> algebra(Map<String, Object> request) {
        String operation = requiredString(request, "operation");
        String variable = variableName(request.get("variable"));
        String expression = symbolicExpression(request, "expression");

        return switch (operation) {
            case "simplify" -> symbolicText("Simplify", expression, "Simplified expression with Symja.");
            case "expand" -> symbolicText("Expand", expression, "Expanded expression with Symja.");
            case "factor" -> factorAlgebra(expression, variable);
            case "substitute" -> {
                double value = finiteNumber(request.get("subValue"), "Substitution value");
                double result = ExpressionParser.parse(expression).eval(Map.of(variable, value));
                yield text(formatNumber(result), formatNumber(result), List.of(
                    "Parsed expression: " + expression,
                    "Substituted " + variable + " = " + formatNumber(value) + ".",
                    "Evaluated result: " + formatNumber(result)
                ));
            }
            default -> throw badRequest("Unsupported algebraic operation.");
        };
    }

    public Map<String, Object> matrix(Map<String, Object> request) {
        String operation = requiredString(request, "operation");
        double[][] matrixA = numericMatrix(request.get("matrixA"), "Matrix A");

        return switch (operation) {
            case "add" -> {
                double[][] matrixB = numericMatrix(request.get("matrixB"), "Matrix B");
                sameDimensions(matrixA, matrixB, "Matrix addition requires matching dimensions.");
                double[][] result = new double[matrixA.length][matrixA[0].length];
                for (int row = 0; row < matrixA.length; row++) {
                    for (int col = 0; col < matrixA[row].length; col++) {
                        result[row][col] = matrixA[row][col] + matrixB[row][col];
                    }
                }
                yield data("Matrix Sum successfully calculated.", result, List.of("Added A[i][j] + B[i][j] for each cell."));
            }
            case "multiply" -> {
                double[][] matrixB = numericMatrix(request.get("matrixB"), "Matrix B");
                if (matrixA[0].length != matrixB.length) {
                    throw badRequest("Matrix multiplication requires columns(A) to equal rows(B).");
                }
                RealMatrix product = realMatrix(matrixA).multiply(realMatrix(matrixB));
                yield data("Matrix multiplication computed successfully.", matrixData(product), List.of(
                    "Computed A * B using Apache Commons Math dense matrix multiplication."
                ));
            }
            case "determinant" -> {
                assertSquare(matrixA, "Matrix A");
                double determinant = new LUDecomposition(realMatrix(matrixA)).getDeterminant();
                yield data("Determinant: det(A) = " + formatNumber(determinant), Map.of("determinant", determinant), List.of(
                    "Computed determinant using Apache Commons Math LU decomposition."
                ));
            }
            case "inverse" -> {
                assertSquare(matrixA, "Matrix A");
                DecompositionSolver solver = new LUDecomposition(realMatrix(matrixA)).getSolver();
                if (!solver.isNonSingular()) {
                    throw badRequest("Matrix A must be non-singular for inversion.");
                }
                yield data("Inversion matrix generated.", matrixData(solver.getInverse()), List.of(
                    "Computed inverse using Apache Commons Math LU decomposition."
                ));
            }
            case "lu" -> {
                assertSquare(matrixA, "Matrix A");
                LUDecomposition decomposition = new LUDecomposition(realMatrix(matrixA));
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("L", matrixData(decomposition.getL()));
                result.put("U", matrixData(decomposition.getU()));
                result.put("P", matrixData(decomposition.getP()));
                yield data("LU Triangular decomposition completed.", result, List.of(
                    "Computed PA = LU using Apache Commons Math LUDecomposition."
                ));
            }
            case "qr" -> {
                QRDecomposition decomposition = new QRDecomposition(realMatrix(matrixA));
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("Q", matrixData(decomposition.getQ()));
                result.put("R", matrixData(decomposition.getR()));
                yield data("QR Orthogonal-triangular decomposition computed.", result, List.of(
                    "Computed A = QR using Apache Commons Math QRDecomposition."
                ));
            }
            case "eigen" -> {
                assertSquare(matrixA, "Matrix A");
                EigenDecomposition decomposition = new EigenDecomposition(realMatrix(matrixA));
                Map<String, Object> result = eigenResult(decomposition);
                yield data("Eigenvalues and eigenvectors computed.", result, List.of(
                    "Computed eigen decomposition using Apache Commons Math.",
                    "Sorted eigenvalues by ascending real value for stable output."
                ));
            }
            case "solveLinear" -> {
                assertSquare(matrixA, "Matrix A");
                double[] vector = numericVector(request.get("vectorB"), matrixA.length, "Vector b");
                DecompositionSolver solver = new LUDecomposition(realMatrix(matrixA)).getSolver();
                if (!solver.isNonSingular()) {
                    throw badRequest("Matrix A must be non-singular to solve Ax = b.");
                }
                double[] solution = solver.solve(new ArrayRealVector(vector, false)).toArray();
                yield data("System solutions: x = " + vectorText(solution), solution, List.of(
                    "Solved Ax = b using Apache Commons Math LU decomposition."
                ));
            }
            default -> throw badRequest("Unsupported matrix operation.");
        };
    }

    public Map<String, Object> numerical(Map<String, Object> request) {
        String method = requiredString(request, "method");

        return switch (method) {
            case "integrate" -> {
                String expression = requiredExpression(request, "expression");
                double lower = finiteNumber(request.get("a"), "Lower bound");
                double upper = finiteNumber(request.get("b"), "Upper bound");
                if (Math.abs(lower - upper) < EPSILON) {
                    throw badRequest("Integration bounds must be distinct finite numbers.");
                }
                double area = simpson(expression, lower, upper);
                yield data("Numerical Area approximated: " + formatNumber(area), Map.of("area", area), List.of(
                    "Used Apache Commons Math Simpson integration.",
                    "Integrated from " + formatNumber(lower) + " to " + formatNumber(upper) + "."
                ));
            }
            case "bisection" -> {
                String expression = requiredExpression(request, "expression");
                double lower = finiteNumber(request.get("a"), "Lower bound");
                double upper = finiteNumber(request.get("b"), "Upper bound");
                double root = bisection(expression, lower, upper);
                yield data("Root approximated: x ≈ " + formatNumber(root), Map.of("root", root), List.of("Applied bisection until the interval was below tolerance."));
            }
            case "newton" -> {
                String expression = requiredExpression(request, "expression");
                double initialGuess = finiteNumber(request.get("initialGuess"), "Initial guess");
                double root = newton(expression, initialGuess);
                yield data("Root approximated: x ≈ " + formatNumber(root), Map.of("root", root), List.of("Applied Newton-Raphson with central-difference derivative."));
            }
            case "curvefit" -> {
                int degree = integerValue(request.get("degree"), 1, 1, 6, "Curve fitting degree");
                CurveFitResult fit = curveFit(request.get("points"), degree);
                yield data("Equation Fit: y = " + fit.equation() + " (R^2 = " + formatNumber(fit.r2()) + ")", fit.toMap(), fit.steps());
            }
            default -> throw badRequest("Unsupported numerical method.");
        };
    }

    public Map<String, Object> calculus(Map<String, Object> request) {
        String operation = requiredString(request, "operation");
        return switch (operation) {
            case "limit" -> {
                String expression = requiredExpression(request, "expression");
                double center = finiteNumber(request.get("center"), "Limit center");
                LimitResult limit = limit(expression, center);
                String output = limit.exists()
                    ? "Limit: " + formatNumber(limit.value())
                    : "Limit does not exist. Reason: " + limit.reason();
                yield data(output, limit.toMap(), List.of(
                    "Evaluated the expression from both sides of the center.",
                    limit.exists() ? "Left and right approximations converged." : limit.reason()
                ));
            }
            case "taylor" -> {
                String expression = requiredExpression(request, "expression");
                double center = finiteNumber(request.get("center"), "Taylor center");
                int degree = integerValue(request.get("degree"), 4, 0, 12, "Taylor degree");
                TaylorResult result = taylor(expression, center, degree);
                yield data("Taylor Polynomial: " + result.polynomial(), result.toMap(), result.steps());
            }
            case "ode" -> {
                String expression = requiredExpression(request, "expression");
                double x0 = finiteNumber(request.get("x0"), "ODE x0");
                double y0 = finiteNumber(request.get("y0"), "ODE y0");
                double xEnd = finiteNumber(request.get("xEnd"), "ODE xEnd");
                int stepsCount = integerValue(request.get("stepsCount"), 100, 1, 5000, "ODE step count");
                OdeResult result = rk4(expression, x0, y0, xEnd, stepsCount);
                yield data("Integrated dy/dx at x = " + formatNumber(xEnd) + ": y(" + formatNumber(xEnd) + ") ≈ " + formatNumber(result.finalY()), result.toMap(), result.steps());
            }
            default -> throw badRequest("Unsupported calculus operation.");
        };
    }

    public Map<String, Object> statistics(Map<String, Object> request) {
        List<?> values = listValue(request.get("series"), "Statistics series");
        if (values.isEmpty() || values.size() > 10_000) {
            throw badRequest("Statistics series must contain between 1 and 10,000 values.");
        }

        double[] numbers = values.stream()
            .mapToDouble(value -> finiteNumber(value, "Statistics series"))
            .toArray();
        Map<String, Object> result = statisticsSummary(numbers);
        double mean = (double) result.get("mean");
        double stdDev = (double) result.get("stdDev");
        @SuppressWarnings("unchecked")
        List<Double> interval = (List<Double>) result.get("confidenceInterval95");
        return data(
            "Summary: Mean = " + formatNumber(mean) + ", Standard Deviation = " + formatNumber(stdDev) + ", Conf. Interval = [" + formatNumber(interval.get(0)) + ", " + formatNumber(interval.get(1)) + "]",
            result,
            List.of(
                "Received numeric elements: size N = " + numbers.length,
                "Calculated mean and sample variance.",
                "Computed 95% confidence interval for the mean."
            )
        );
    }

    private Map<String, Object> factorResponse(Polynomial polynomial, String variable) {
        String output = factorPolynomial(polynomial, variable);
        return text(output, output, List.of(
            "Parsed polynomial degree " + polynomial.degree() + ".",
            "Computed real roots where exact linear/quadratic factorization is supported.",
            "Converted roots into factors."
        ));
    }

    private Map<String, Object> factorAlgebra(String expression, String variable) {
        try {
            Polynomial polynomial = parsePolynomial(expression, variable);
            if (polynomial.degree() <= 2) {
                return factorResponse(polynomial, variable);
            }
        } catch (ApiException exception) {
            // Fall through to Symja for non-polynomial and multivariable expressions.
        }
        return symbolicText("Factor", expression, "Factored expression with Symja.");
    }

    private Map<String, Object> rootsResponse(Polynomial polynomial, String variable) {
        List<Double> roots = polynomial.realRoots();
        String output = roots.isEmpty()
            ? "No real roots found for supported polynomial degree."
            : "Roots: " + roots.stream().map(root -> variable + " = " + formatNumber(root)).toList();
        Map<String, Object> body = text(output, output, List.of(
            "Parsed polynomial degree " + polynomial.degree() + ".",
            "Solved for real roots using exact formulas for supported degree."
        ));
        body.put("roots", roots);
        return body;
    }

    private static Map<String, Object> text(String output, String latexOutput, List<String> steps) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("output", output);
        body.put("latexOutput", latexOutput);
        body.put("steps", steps);
        return body;
    }

    private static Map<String, Object> data(String output, Object result, List<String> steps) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("output", output);
        body.put("latexResult", output);
        body.put("steps", steps);
        body.put("result", result);
        return body;
    }

    private static Polynomial parsePolynomial(String expression, String variable) {
        return ExpressionParser.parse(expression).polynomial(variable);
    }

    private static Map<String, Object> symbolicText(String operation, String expression, String step) {
        SymjaResult result = symbolicCommand(operation + "[" + expression + "]", step);
        return text(result.output(), result.output(), result.steps());
    }

    private static SymjaResult symbolicCommand(String command, String step) {
        try {
            ExprEvaluator evaluator = new ExprEvaluator();
            IExpr result = evaluator.evaluateWithTimeout(command, SYMBOLIC_TIMEOUT_SECONDS, TimeUnit.SECONDS, true, null);
            String output = result == null ? "" : result.toString();
            if (output.isBlank()) {
                throw badRequest("Symbolic computation did not return a result.");
            }
            if (output.length() > MAX_SYMBOLIC_OUTPUT_LENGTH) {
                throw badRequest("Symbolic result is too large.");
            }
            if (output.contains("$Aborted") || output.contains("TimeConstrained")) {
                throw badRequest("Symbolic computation exceeded the configured time limit.");
            }
            return new SymjaResult(output, List.of(
                "Validated expression against MathLab Pro input limits.",
                step,
                "Computed symbolic result with Symja."
            ));
        } catch (ApiException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw badRequest("Symbolic computation failed: " + safeMessage(exception));
        }
    }

    private static String factorPolynomial(Polynomial polynomial, String variable) {
        int degree = polynomial.degree();
        if (degree == 0) return polynomial.format(variable);
        if (degree > 2) {
            throw badRequest("Exact polynomial factorization currently supports degree 2 or lower.");
        }
        List<Double> roots = polynomial.realRoots();
        if (roots.isEmpty()) {
            return polynomial.format(variable) + " is irreducible over the real numbers.";
        }
        double leading = polynomial.coefficient(degree);
        StringBuilder builder = new StringBuilder();
        if (Math.abs(leading - 1.0) > EPSILON) {
            builder.append(formatNumber(leading)).append("*");
        }
        for (Double root : roots) {
            builder.append(factorForRoot(variable, root)).append("*");
        }
        builder.setLength(builder.length() - 1);
        return builder.toString();
    }

    private static String equivalentFactoredOutput(Polynomial polynomial, String variable) {
        String expanded = polynomial.format(variable);
        String factored = factorPolynomial(polynomial, variable);
        if (factored.equals(expanded) || factored.contains("irreducible")) return expanded;
        return expanded + " = " + factored;
    }

    private static String factorForRoot(String variable, double root) {
        if (Math.abs(root) < EPSILON) return variable;
        return root > 0
            ? "(" + variable + " - " + formatNumber(root) + ")"
            : "(" + variable + " + " + formatNumber(Math.abs(root)) + ")";
    }

    private static double simpson(String expression, double lower, double upper) {
        Expression parsed = ExpressionParser.parse(expression);
        UnivariateFunction function = x -> parsed.eval(Map.of("x", x));
        return new SimpsonIntegrator().integrate(10_000, function, lower, upper);
    }

    private static double bisection(String expression, double lower, double upper) {
        Expression parsed = ExpressionParser.parse(expression);
        DoubleUnaryOperator function = x -> parsed.eval(Map.of("x", x));
        double fa = function.applyAsDouble(lower);
        double fb = function.applyAsDouble(upper);
        if (fa * fb > 0) {
            throw badRequest("Bisection bounds must have opposite signs.");
        }
        double mid = lower;
        for (int i = 0; i < 80; i++) {
            mid = (lower + upper) / 2.0;
            double fmid = function.applyAsDouble(mid);
            if (Math.abs(fmid) < 1e-8 || Math.abs(upper - lower) < 1e-8) {
                return mid;
            }
            if (fa * fmid < 0) {
                upper = mid;
            } else {
                lower = mid;
                fa = fmid;
            }
        }
        return mid;
    }

    private static double newton(String expression, double initialGuess) {
        Expression parsed = ExpressionParser.parse(expression);
        double x = initialGuess;
        for (int i = 0; i < 50; i++) {
            double fx = parsed.eval(Map.of("x", x));
            double derivative = (parsed.eval(Map.of("x", x + 1e-5)) - parsed.eval(Map.of("x", x - 1e-5))) / 2e-5;
            if (Math.abs(derivative) < EPSILON) {
                throw badRequest("Newton-Raphson derivative is too close to zero.");
            }
            double next = x - fx / derivative;
            if (Math.abs(next - x) < 1e-8) return next;
            x = next;
        }
        return x;
    }

    private static LimitResult limit(String expression, double center) {
        Expression parsed = ExpressionParser.parse(expression);
        double left = Double.NaN;
        double right = Double.NaN;
        for (double delta : List.of(1e-2, 1e-4, 1e-6, 1e-8)) {
            left = safeEval(parsed, center - delta);
            right = safeEval(parsed, center + delta);
        }
        if (Double.isFinite(left) && Double.isFinite(right) && Math.abs(left - right) < 1e-3) {
            return new LimitResult(true, (left + right) / 2.0, null);
        }
        return new LimitResult(false, null, "Left and right limits do not match.");
    }

    private static CurveFitResult curveFit(Object value, int degree) {
        List<?> points = listValue(value, "Curve fitting points");
        if (points.size() <= degree || points.size() > 100) {
            throw badRequest("Curve fitting requires more points than degree and at most 100 points.");
        }

        WeightedObservedPoints observations = new WeightedObservedPoints();
        double[] xs = new double[points.size()];
        double[] ys = new double[points.size()];
        for (int i = 0; i < points.size(); i++) {
            if (!(points.get(i) instanceof Map<?, ?> point)) {
                throw badRequest("Curve fitting points must be objects with x and y values.");
            }
            double x = finiteNumber(point.get("x"), "Curve fitting point x");
            double y = finiteNumber(point.get("y"), "Curve fitting point y");
            xs[i] = x;
            ys[i] = y;
            observations.add(x, y);
        }

        double[] coefficients = PolynomialCurveFitter.create(degree).fit(observations.toList());
        String equation = polynomialFromCoefficients(coefficients);
        double r2 = rSquared(xs, ys, coefficients);
        List<String> steps = List.of(
            "Fitted polynomial degree " + degree + " with Apache Commons Math least squares.",
            "Solved coefficients in ascending powers of x.",
            "Computed coefficient of determination R^2 = " + formatNumber(r2) + "."
        );
        return new CurveFitResult(coefficients, equation, r2, steps);
    }

    private static double rSquared(double[] xs, double[] ys, double[] coefficients) {
        double mean = new Mean().evaluate(ys);
        double total = 0.0;
        double residual = 0.0;
        for (int i = 0; i < xs.length; i++) {
            total += Math.pow(ys[i] - mean, 2);
            residual += Math.pow(ys[i] - evaluatePolynomial(coefficients, xs[i]), 2);
        }
        return Math.abs(total) < EPSILON ? 1.0 : 1.0 - residual / total;
    }

    private static TaylorResult taylor(String expression, double center, int degree) {
        Expression parsed = ExpressionParser.parse(expression);
        double[] coefficients;
        List<String> steps = new ArrayList<>();
        steps.add("Computing Taylor polynomial centered at " + formatNumber(center) + " through degree " + degree + ".");

        try {
            Polynomial polynomial = parsed.polynomial("x");
            coefficients = exactTaylorCoefficients(polynomial, center, degree);
            steps.add("Used exact polynomial coefficient transformation.");
        } catch (ApiException exception) {
            if (degree > 6) {
                throw badRequest("Numerical Taylor expansion currently supports degree 6 or lower for non-polynomial expressions.");
            }
            coefficients = new double[degree + 1];
            for (int order = 0; order <= degree; order++) {
                coefficients[order] = finiteDerivative(parsed, center, order) / factorial(order);
            }
            steps.add("Used bounded central finite differences for non-polynomial derivatives.");
        }

        String polynomial = taylorPolynomialText(coefficients, center);
        steps.add("Taylor polynomial: " + polynomial);
        return new TaylorResult(polynomial, coefficients, steps);
    }

    private static double[] exactTaylorCoefficients(Polynomial polynomial, double center, int degree) {
        double[] coefficients = new double[degree + 1];
        for (int order = 0; order <= degree; order++) {
            double coefficient = 0.0;
            for (int power = order; power <= polynomial.degree(); power++) {
                coefficient += polynomial.coefficient(power) * binomial(power, order) * Math.pow(center, power - order);
            }
            coefficients[order] = coefficient;
        }
        return coefficients;
    }

    private static double finiteDerivative(Expression expression, double center, int order) {
        if (order == 0) return expression.eval(Map.of("x", center));
        double h = 1e-4;
        return (finiteDerivative(expression, center + h, order - 1) - finiteDerivative(expression, center - h, order - 1)) / (2.0 * h);
    }

    private static OdeResult rk4(String expression, double x0, double y0, double xEnd, int stepsCount) {
        Expression parsed = ExpressionParser.parse(expression);
        double h = (xEnd - x0) / stepsCount;
        double x = x0;
        double y = y0;
        List<Map<String, Double>> results = new ArrayList<>();
        List<String> steps = new ArrayList<>();
        results.add(Map.of("x", x, "y", y));
        steps.add("RK4 integration from x0 = " + formatNumber(x0) + " to xEnd = " + formatNumber(xEnd) + " with h = " + formatNumber(h) + ".");

        for (int i = 0; i < stepsCount; i++) {
            double k1 = parsed.eval(Map.of("x", x, "y", y));
            double k2 = parsed.eval(Map.of("x", x + h / 2.0, "y", y + h * k1 / 2.0));
            double k3 = parsed.eval(Map.of("x", x + h / 2.0, "y", y + h * k2 / 2.0));
            double k4 = parsed.eval(Map.of("x", x + h, "y", y + h * k3));
            y += (h / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
            x += h;
            results.add(Map.of("x", x, "y", y));
        }

        steps.add("Final integrated value y(" + formatNumber(x) + ") ≈ " + formatNumber(y) + ".");
        return new OdeResult(results, y, steps);
    }

    private static double safeEval(Expression expression, double x) {
        try {
            double value = expression.eval(Map.of("x", x));
            return Double.isFinite(value) ? value : Double.NaN;
        } catch (RuntimeException exception) {
            return Double.NaN;
        }
    }

    private static Map<String, Object> statisticsSummary(double[] numbers) {
        int n = numbers.length;
        double mean = new Mean().evaluate(numbers);
        double median = new Median().evaluate(numbers);
        double variance = new Variance(true).evaluate(numbers);
        double stdDev = new StandardDeviation(true).evaluate(numbers);
        double min = new Min().evaluate(numbers);
        double max = new Max().evaluate(numbers);
        double margin = 1.96 * (stdDev / Math.sqrt(n));

        Map<Double, Integer> frequencies = new LinkedHashMap<>();
        for (double number : numbers) frequencies.merge(number, 1, Integer::sum);
        int maxFrequency = frequencies.values().stream().max(Integer::compareTo).orElse(1);
        List<Double> mode = maxFrequency <= 1
            ? List.of()
            : frequencies.entrySet().stream().filter(entry -> entry.getValue() == maxFrequency).map(Map.Entry::getKey).toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("n", n);
        result.put("mean", mean);
        result.put("median", median);
        result.put("mode", mode);
        result.put("variance", variance);
        result.put("stdDev", stdDev);
        result.put("min", min);
        result.put("max", max);
        result.put("confidenceInterval95", List.of(mean - margin, mean + margin));
        return result;
    }

    private static RealMatrix realMatrix(double[][] matrix) {
        return MatrixUtils.createRealMatrix(matrix);
    }

    private static double[][] matrixData(RealMatrix matrix) {
        return matrix.getData();
    }

    private static Map<String, Object> eigenResult(EigenDecomposition decomposition) {
        double[] values = decomposition.getRealEigenvalues();
        List<Integer> order = new ArrayList<>();
        for (int i = 0; i < values.length; i++) order.add(i);
        order.sort(Comparator.comparingDouble(index -> values[index]));

        List<Double> eigenvalues = new ArrayList<>();
        List<double[]> eigenvectors = new ArrayList<>();
        for (Integer index : order) {
            eigenvalues.add(values[index]);
            RealVector vector = decomposition.getEigenvector(index);
            eigenvectors.add(vector == null ? new double[0] : vector.toArray());
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("eigenvalues", eigenvalues);
        result.put("eigenvectors", eigenvectors);
        return result;
    }

    private static String requiredString(Map<String, Object> request, String field) {
        Object value = request.get(field);
        if (value instanceof String string && !string.isBlank()) {
            return string.trim();
        }
        throw badRequest(field + " is required.");
    }

    private static String requiredExpression(Map<String, Object> request, String field) {
        String expression = requiredString(request, field);
        if (expression.length() > MAX_EXPRESSION_LENGTH) {
            throw badRequest("Expression is too long. Maximum length is " + MAX_EXPRESSION_LENGTH + " characters.");
        }
        return expression;
    }

    private static String symbolicExpression(Map<String, Object> request, String field) {
        String expression = requiredExpression(request, field);
        if (!SYMBOLIC_PATTERN.matcher(expression).matches()) {
            throw badRequest("Expression contains unsupported symbolic characters.");
        }
        return expression;
    }

    private static String variableName(Object value) {
        String variable = value instanceof String string && !string.isBlank() ? string.trim() : "x";
        if (!VARIABLE_PATTERN.matcher(variable).matches()) {
            throw badRequest("Variable name must start with a letter and contain only letters, numbers, or underscores.");
        }
        return variable;
    }

    private static double finiteNumber(Object value, String label) {
        if (!(value instanceof Number number)) {
            throw badRequest(label + " must be a finite number.");
        }
        double parsed = number.doubleValue();
        if (!Double.isFinite(parsed)) {
            throw badRequest(label + " must be a finite number.");
        }
        return parsed;
    }

    private static int integerValue(Object value, int fallback, int min, int max, String label) {
        int parsed;
        if (value == null) {
            parsed = fallback;
        } else if (value instanceof Number number) {
            parsed = number.intValue();
            if (Math.abs(number.doubleValue() - parsed) > EPSILON) {
                throw badRequest(label + " must be an integer.");
            }
        } else {
            throw badRequest(label + " must be an integer.");
        }
        if (parsed < min || parsed > max) {
            throw badRequest(label + " must be between " + min + " and " + max + ".");
        }
        return parsed;
    }

    private static List<?> listValue(Object value, String label) {
        if (value instanceof List<?> list) return list;
        throw badRequest(label + " must be an array.");
    }

    private static double[][] numericMatrix(Object value, String label) {
        List<?> rows = listValue(value, label);
        if (rows.isEmpty() || rows.size() > 10) {
            throw badRequest(label + " must have between 1 and 10 rows.");
        }
        double[][] matrix = null;
        int expectedColumns = -1;
        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            List<?> row = listValue(rows.get(rowIndex), label + " row");
            if (row.isEmpty() || row.size() > 10) {
                throw badRequest(label + " must have between 1 and 10 columns.");
            }
            if (expectedColumns < 0) {
                expectedColumns = row.size();
                matrix = new double[rows.size()][expectedColumns];
            } else if (row.size() != expectedColumns) {
                throw badRequest(label + " must be rectangular.");
            }
            for (int col = 0; col < row.size(); col++) {
                matrix[rowIndex][col] = finiteNumber(row.get(col), label);
            }
        }
        return matrix;
    }

    private static double[] numericVector(Object value, int expectedLength, String label) {
        List<?> values = listValue(value, label);
        if (values.size() != expectedLength) {
            throw badRequest(label + " must contain exactly " + expectedLength + " values.");
        }
        double[] vector = new double[values.size()];
        for (int i = 0; i < values.size(); i++) {
            vector[i] = finiteNumber(values.get(i), label);
        }
        return vector;
    }

    private static void sameDimensions(double[][] left, double[][] right, String message) {
        if (left.length != right.length || left[0].length != right[0].length) {
            throw badRequest(message);
        }
    }

    private static void assertSquare(double[][] matrix, String label) {
        if (matrix.length != matrix[0].length) {
            throw badRequest(label + " must be square for this operation.");
        }
    }

    private static String vectorText(double[] vector) {
        List<String> values = new ArrayList<>();
        for (double value : vector) values.add(formatNumber(value));
        return values.toString();
    }

    private static String polynomialFromCoefficients(double[] coefficients) {
        List<String> terms = new ArrayList<>();
        for (int power = coefficients.length - 1; power >= 0; power--) {
            double coefficient = coefficients[power];
            if (Math.abs(coefficient) < EPSILON) continue;
            terms.add(signedTerm(coefficient, power, "x", terms.isEmpty()));
        }
        return terms.isEmpty() ? "0" : String.join("", terms).trim();
    }

    private static double evaluatePolynomial(double[] coefficients, double x) {
        double result = 0.0;
        for (int power = 0; power < coefficients.length; power++) {
            result += coefficients[power] * Math.pow(x, power);
        }
        return result;
    }

    private static String taylorPolynomialText(double[] coefficients, double center) {
        List<String> terms = new ArrayList<>();
        for (int power = 0; power < coefficients.length; power++) {
            double coefficient = coefficients[power];
            if (Math.abs(coefficient) < 1e-8) continue;
            terms.add(signedTaylorTerm(coefficient, power, center, terms.isEmpty()));
        }
        return terms.isEmpty() ? "0" : String.join("", terms).trim();
    }

    private static String signedTerm(double coefficient, int power, String variable, boolean first) {
        String sign = coefficient < 0 ? (first ? "-" : " - ") : (first ? "" : " + ");
        double absolute = Math.abs(coefficient);
        if (power == 0) return sign + formatNumber(absolute);
        String variablePart = power == 1 ? variable : variable + "^" + power;
        if (Math.abs(absolute - 1.0) < EPSILON) return sign + variablePart;
        return sign + formatNumber(absolute) + "*" + variablePart;
    }

    private static String signedTaylorTerm(double coefficient, int power, double center, boolean first) {
        String sign = coefficient < 0 ? (first ? "-" : " - ") : (first ? "" : " + ");
        double absolute = Math.abs(coefficient);
        if (power == 0) return sign + formatNumber(absolute);
        String variablePart;
        if (Math.abs(center) < EPSILON) {
            variablePart = power == 1 ? "x" : "x^" + power;
        } else {
            String shifted = center > 0 ? "(x - " + formatNumber(center) + ")" : "(x + " + formatNumber(Math.abs(center)) + ")";
            variablePart = power == 1 ? shifted : shifted + "^" + power;
        }
        if (Math.abs(absolute - 1.0) < EPSILON) return sign + variablePart;
        return sign + formatNumber(absolute) + "*" + variablePart;
    }

    private static long binomial(int n, int k) {
        if (k < 0 || k > n) return 0;
        if (k == 0 || k == n) return 1;
        long result = 1;
        for (int i = 1; i <= k; i++) {
            result = result * (n - i + 1) / i;
        }
        return result;
    }

    private static long factorial(int n) {
        long result = 1;
        for (int i = 2; i <= n; i++) result *= i;
        return result;
    }

    private static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
    }

    private static String safeMessage(RuntimeException exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) return "invalid symbolic expression";
        return message.length() <= 160 ? message : message.substring(0, 160);
    }

    private static String formatNumber(double value) {
        if (Math.abs(value) < EPSILON) return "0";
        if (Math.abs(value - Math.rint(value)) < EPSILON) {
            return Long.toString(Math.round(value));
        }
        double absolute = Math.abs(value);
        String sign = value < 0 ? "-" : "";
        for (int denominator = 2; denominator <= 100; denominator++) {
            long numerator = Math.round(absolute * denominator);
            if (Math.abs(absolute - ((double) numerator / denominator)) < 1e-8) {
                return sign + numerator + "/" + denominator;
            }
        }
        return String.format(Locale.US, "%.8f", value).replaceAll("0+$", "").replaceAll("\\.$", "");
    }

    private record LimitResult(boolean exists, Double value, String reason) {
        Map<String, Object> toMap() {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("exists", exists);
            result.put("limit", value);
            if (reason != null) result.put("reason", reason);
            return result;
        }
    }

    private record CurveFitResult(double[] coefficients, String equation, double r2, List<String> steps) {
        Map<String, Object> toMap() {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("coefficients", coefficients);
            result.put("equation", equation);
            result.put("r2", r2);
            return result;
        }
    }

    private record TaylorResult(String polynomial, double[] coefficients, List<String> steps) {
        Map<String, Object> toMap() {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("polynomial", polynomial);
            result.put("coefficients", coefficients);
            result.put("latex", polynomial);
            return result;
        }
    }

    private record OdeResult(List<Map<String, Double>> results, double finalY, List<String> steps) {
        Map<String, Object> toMap() {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("results", results);
            result.put("finalY", finalY);
            return result;
        }
    }

    private record SymjaResult(String output, List<String> steps) {
    }

    private interface Expression {
        double eval(Map<String, Double> variables);
        Polynomial polynomial(String variable);
    }

    private static final class ExpressionParser {
        private final String source;
        private int position;

        private ExpressionParser(String source) {
            this.source = source;
        }

        static Expression parse(String source) {
            ExpressionParser parser = new ExpressionParser(source);
            Expression expression = parser.parseExpression();
            parser.skipWhitespace();
            if (!parser.isAtEnd()) {
                throw badRequest("Unexpected token at position " + parser.position + ".");
            }
            return expression;
        }

        private Expression parseExpression() {
            Expression expression = parseTerm();
            while (true) {
                skipWhitespace();
                if (match('+')) {
                    expression = new BinaryExpression('+', expression, parseTerm());
                } else if (match('-')) {
                    expression = new BinaryExpression('-', expression, parseTerm());
                } else {
                    return expression;
                }
            }
        }

        private Expression parseTerm() {
            Expression expression = parsePower();
            while (true) {
                skipWhitespace();
                if (match('*')) {
                    expression = new BinaryExpression('*', expression, parsePower());
                } else if (match('/')) {
                    expression = new BinaryExpression('/', expression, parsePower());
                } else {
                    return expression;
                }
            }
        }

        private Expression parsePower() {
            Expression expression = parseUnary();
            skipWhitespace();
            if (match('^')) {
                expression = new BinaryExpression('^', expression, parsePower());
            }
            return expression;
        }

        private Expression parseUnary() {
            skipWhitespace();
            if (match('+')) return parseUnary();
            if (match('-')) return new UnaryExpression(parseUnary());
            return parsePrimary();
        }

        private Expression parsePrimary() {
            skipWhitespace();
            if (match('(')) {
                Expression expression = parseExpression();
                if (!match(')')) throw badRequest("Missing closing parenthesis.");
                return expression;
            }
            if (isAtEnd()) throw badRequest("Unexpected end of expression.");
            char current = source.charAt(position);
            if (Character.isDigit(current) || current == '.') {
                return new ConstantExpression(parseNumber());
            }
            if (Character.isLetter(current)) {
                String identifier = parseIdentifier();
                skipWhitespace();
                if (match('(')) {
                    Expression argument = parseExpression();
                    if (!match(')')) throw badRequest("Missing closing parenthesis after function argument.");
                    return new FunctionExpression(identifier, argument);
                }
                return new VariableExpression(identifier);
            }
            throw badRequest("Unsupported token '" + current + "' at position " + position + ".");
        }

        private double parseNumber() {
            int start = position;
            while (!isAtEnd() && (Character.isDigit(source.charAt(position)) || source.charAt(position) == '.')) position++;
            if (!isAtEnd() && (source.charAt(position) == 'e' || source.charAt(position) == 'E')) {
                position++;
                if (!isAtEnd() && (source.charAt(position) == '+' || source.charAt(position) == '-')) position++;
                while (!isAtEnd() && Character.isDigit(source.charAt(position))) position++;
            }
            try {
                return Double.parseDouble(source.substring(start, position));
            } catch (NumberFormatException exception) {
                throw badRequest("Invalid number at position " + start + ".");
            }
        }

        private String parseIdentifier() {
            int start = position;
            while (!isAtEnd() && (Character.isLetterOrDigit(source.charAt(position)) || source.charAt(position) == '_')) position++;
            return source.substring(start, position);
        }

        private boolean match(char expected) {
            skipWhitespace();
            if (!isAtEnd() && source.charAt(position) == expected) {
                position++;
                return true;
            }
            return false;
        }

        private void skipWhitespace() {
            while (!isAtEnd() && Character.isWhitespace(source.charAt(position))) position++;
        }

        private boolean isAtEnd() {
            return position >= source.length();
        }
    }

    private record ConstantExpression(double value) implements Expression {
        @Override
        public double eval(Map<String, Double> variables) {
            return value;
        }

        @Override
        public Polynomial polynomial(String variable) {
            return Polynomial.constant(value);
        }
    }

    private record VariableExpression(String name) implements Expression {
        @Override
        public double eval(Map<String, Double> variables) {
            if ("pi".equals(name) || "PI".equals(name)) return Math.PI;
            if ("e".equals(name) || "E".equals(name)) return Math.E;
            if ("tau".equals(name)) return 2.0 * Math.PI;
            Double value = variables.get(name);
            if (value == null) throw badRequest("Symbol \"" + name + "\" is not defined.");
            return value;
        }

        @Override
        public Polynomial polynomial(String variable) {
            if (name.equals(variable)) return Polynomial.variable();
            if ("pi".equals(name) || "PI".equals(name)) return Polynomial.constant(Math.PI);
            if ("e".equals(name) || "E".equals(name)) return Polynomial.constant(Math.E);
            if ("tau".equals(name)) return Polynomial.constant(2.0 * Math.PI);
            throw badRequest("Symbol \"" + name + "\" is not allowed for this polynomial operation.");
        }
    }

    private record UnaryExpression(Expression expression) implements Expression {
        @Override
        public double eval(Map<String, Double> variables) {
            return -expression.eval(variables);
        }

        @Override
        public Polynomial polynomial(String variable) {
            return expression.polynomial(variable).scale(-1.0);
        }
    }

    private record BinaryExpression(char operator, Expression left, Expression right) implements Expression {
        @Override
        public double eval(Map<String, Double> variables) {
            double leftValue = left.eval(variables);
            double rightValue = right.eval(variables);
            return switch (operator) {
                case '+' -> leftValue + rightValue;
                case '-' -> leftValue - rightValue;
                case '*' -> leftValue * rightValue;
                case '/' -> leftValue / rightValue;
                case '^' -> Math.pow(leftValue, rightValue);
                default -> throw badRequest("Unsupported operator.");
            };
        }

        @Override
        public Polynomial polynomial(String variable) {
            return switch (operator) {
                case '+' -> left.polynomial(variable).add(right.polynomial(variable));
                case '-' -> left.polynomial(variable).subtract(right.polynomial(variable));
                case '*' -> left.polynomial(variable).multiply(right.polynomial(variable));
                case '/' -> {
                    Polynomial denominator = right.polynomial(variable);
                    if (denominator.degree() != 0) {
                        throw badRequest("Polynomial terms may only be divided by numeric constants.");
                    }
                    double constant = denominator.coefficient(0);
                    if (Math.abs(constant) < EPSILON) throw badRequest("Division by zero is not allowed.");
                    yield left.polynomial(variable).scale(1.0 / constant);
                }
                case '^' -> {
                    Polynomial exponent = right.polynomial(variable);
                    if (exponent.degree() != 0) {
                        throw badRequest("Polynomial exponents must be fixed non-negative integers.");
                    }
                    double value = exponent.coefficient(0);
                    if (Math.abs(value - Math.rint(value)) > EPSILON || value < 0 || value > 20) {
                        throw badRequest("Polynomial exponents must be integers between 0 and 20.");
                    }
                    yield left.polynomial(variable).pow((int) Math.rint(value));
                }
                default -> throw badRequest("Unsupported polynomial operator.");
            };
        }
    }

    private record FunctionExpression(String name, Expression argument) implements Expression {
        @Override
        public double eval(Map<String, Double> variables) {
            double value = argument.eval(variables);
            return switch (name) {
                case "abs" -> Math.abs(value);
                case "acos" -> Math.acos(value);
                case "asin" -> Math.asin(value);
                case "atan" -> Math.atan(value);
                case "ceil" -> Math.ceil(value);
                case "cos" -> Math.cos(value);
                case "cosh" -> Math.cosh(value);
                case "exp" -> Math.exp(value);
                case "floor" -> Math.floor(value);
                case "log" -> Math.log(value);
                case "log10" -> Math.log10(value);
                case "log2" -> Math.log(value) / Math.log(2.0);
                case "round" -> Math.rint(value);
                case "sign" -> Math.signum(value);
                case "sin" -> Math.sin(value);
                case "sinh" -> Math.sinh(value);
                case "sqrt" -> Math.sqrt(value);
                case "tan" -> Math.tan(value);
                case "tanh" -> Math.tanh(value);
                default -> throw badRequest("Function \"" + name + "\" is not supported.");
            };
        }

        @Override
        public Polynomial polynomial(String variable) {
            throw badRequest("Function \"" + name + "\" is not supported for polynomial operations.");
        }
    }

    private static final class Polynomial {
        private final TreeMap<Integer, Double> terms;

        private Polynomial(Map<Integer, Double> terms) {
            this.terms = new TreeMap<>();
            for (Map.Entry<Integer, Double> entry : terms.entrySet()) {
                if (Math.abs(entry.getValue()) > EPSILON) {
                    this.terms.put(entry.getKey(), entry.getValue());
                }
            }
        }

        static Polynomial constant(double value) {
            return new Polynomial(Map.of(0, value));
        }

        static Polynomial variable() {
            return new Polynomial(Map.of(1, 1.0));
        }

        int degree() {
            return terms.isEmpty() ? -1 : terms.lastKey();
        }

        double coefficient(int degree) {
            return terms.getOrDefault(degree, 0.0);
        }

        Polynomial add(Polynomial other) {
            TreeMap<Integer, Double> result = new TreeMap<>(terms);
            for (Map.Entry<Integer, Double> entry : other.terms.entrySet()) {
                result.merge(entry.getKey(), entry.getValue(), Double::sum);
            }
            return new Polynomial(result);
        }

        Polynomial subtract(Polynomial other) {
            return add(other.scale(-1.0));
        }

        Polynomial scale(double factor) {
            TreeMap<Integer, Double> result = new TreeMap<>();
            for (Map.Entry<Integer, Double> entry : terms.entrySet()) {
                result.put(entry.getKey(), entry.getValue() * factor);
            }
            return new Polynomial(result);
        }

        Polynomial multiply(Polynomial other) {
            TreeMap<Integer, Double> result = new TreeMap<>();
            for (Map.Entry<Integer, Double> left : terms.entrySet()) {
                for (Map.Entry<Integer, Double> right : other.terms.entrySet()) {
                    result.merge(left.getKey() + right.getKey(), left.getValue() * right.getValue(), Double::sum);
                }
            }
            return new Polynomial(result);
        }

        Polynomial pow(int exponent) {
            Polynomial result = constant(1.0);
            for (int i = 0; i < exponent; i++) result = result.multiply(this);
            return result;
        }

        Polynomial derivative() {
            TreeMap<Integer, Double> result = new TreeMap<>();
            for (Map.Entry<Integer, Double> entry : terms.entrySet()) {
                if (entry.getKey() > 0) {
                    result.put(entry.getKey() - 1, entry.getKey() * entry.getValue());
                }
            }
            return new Polynomial(result);
        }

        Polynomial integrate() {
            TreeMap<Integer, Double> result = new TreeMap<>();
            for (Map.Entry<Integer, Double> entry : terms.entrySet()) {
                result.put(entry.getKey() + 1, entry.getValue() / (entry.getKey() + 1));
            }
            return new Polynomial(result);
        }

        Division divide(Polynomial divisor) {
            if (divisor.degree() < 0) throw badRequest("Polynomial division by zero is not allowed.");
            Polynomial quotient = constant(0.0);
            Polynomial remainder = this;
            int divisorDegree = divisor.degree();
            double divisorLeading = divisor.coefficient(divisorDegree);
            while (remainder.degree() >= divisorDegree && remainder.degree() >= 0) {
                int degree = remainder.degree() - divisorDegree;
                double coefficient = remainder.coefficient(remainder.degree()) / divisorLeading;
                Polynomial term = new Polynomial(Map.of(degree, coefficient));
                quotient = quotient.add(term);
                remainder = remainder.subtract(divisor.multiply(term));
            }
            return new Division(quotient, remainder);
        }

        List<Double> realRoots() {
            int degree = degree();
            if (degree < 1) return List.of();
            if (degree == 1) {
                return List.of(-coefficient(0) / coefficient(1));
            }
            if (degree == 2) {
                double a = coefficient(2);
                double b = coefficient(1);
                double c = coefficient(0);
                double discriminant = b * b - 4 * a * c;
                if (discriminant < -EPSILON) return List.of();
                double sqrt = Math.sqrt(Math.max(0.0, discriminant));
                List<Double> roots = new ArrayList<>();
                roots.add((-b + sqrt) / (2 * a));
                double second = (-b - sqrt) / (2 * a);
                if (Math.abs(roots.get(0) - second) > EPSILON) roots.add(second);
                roots.sort(Comparator.naturalOrder());
                return roots;
            }
            throw badRequest("Exact polynomial roots currently support degree 2 or lower.");
        }

        String format(String variable) {
            if (terms.isEmpty()) return "0";
            List<Integer> degrees = new ArrayList<>(terms.keySet());
            degrees.sort(Collections.reverseOrder());
            StringBuilder builder = new StringBuilder();
            for (int degree : degrees) {
                double coefficient = terms.get(degree);
                String sign = coefficient < 0 ? " - " : builder.length() == 0 ? "" : " + ";
                builder.append(sign).append(formatTerm(Math.abs(coefficient), degree, variable));
            }
            return builder.toString().trim();
        }

        private static String formatTerm(double coefficient, int degree, String variable) {
            if (degree == 0) return formatNumber(coefficient);
            String variablePart = degree == 1 ? variable : variable + "^" + degree;
            if (Math.abs(coefficient - 1.0) < EPSILON) return variablePart;
            return formatNumber(coefficient) + "*" + variablePart;
        }

        private record Division(Polynomial quotient, Polynomial remainder) {
        }
    }
}
