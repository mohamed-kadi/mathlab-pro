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
import java.util.function.DoubleUnaryOperator;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class MathEngineService {

    private static final double EPSILON = 1e-10;
    private static final int MAX_EXPRESSION_LENGTH = 1000;
    private static final Pattern VARIABLE_PATTERN = Pattern.compile("^[A-Za-z][A-Za-z0-9_]{0,15}$");

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
                yield text(derivative.format(variable), derivative.format(variable), List.of(
                    "Target function: f(" + variable + ") = " + expression,
                    "Applied the power rule term-by-term.",
                    "Derivative: " + derivative.format(variable)
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
        String expression = requiredExpression(request, "expression");

        return switch (operation) {
            case "simplify", "expand" -> {
                Polynomial polynomial = parsePolynomial(expression, variable);
                yield text(polynomial.format(variable), polynomial.format(variable), List.of(
                    "Parsed the expression as a supported symbolic polynomial.",
                    "Expanded and combined like powers."
                ));
            }
            case "factor" -> factorResponse(parsePolynomial(expression, variable), variable);
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
                yield data("Matrix multiplication computed successfully.", multiply(matrixA, matrixB), List.of("Computed each cell as a row/column dot product."));
            }
            case "determinant" -> {
                assertSquare(matrixA, "Matrix A");
                double determinant = determinant(matrixA);
                yield data("Determinant: det(A) = " + formatNumber(determinant), Map.of("determinant", determinant), List.of(
                    "Applied Gaussian elimination with partial pivoting.",
                    "Multiplied diagonal pivots with row-swap sign."
                ));
            }
            case "inverse" -> {
                assertSquare(matrixA, "Matrix A");
                yield data("Inversion matrix generated.", inverse(matrixA), List.of("Applied Gauss-Jordan elimination on [A | I]."));
            }
            case "solveLinear" -> {
                assertSquare(matrixA, "Matrix A");
                double[] vector = numericVector(request.get("vectorB"), matrixA.length, "Vector b");
                double[] solution = solveLinear(matrixA, vector);
                yield data("System solutions: x = " + vectorText(solution), solution, List.of(
                    "Solved Ax = b using Gaussian elimination with partial pivoting."
                ));
            }
            case "lu", "qr", "eigen" -> throw badRequest("This matrix operation is planned for the EJML-backed backend phase.");
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
                double area = simpson(expression, lower, upper, 100);
                yield data("Numerical Area approximated: " + formatNumber(area), Map.of("area", area), List.of(
                    "Used Simpson's 1/3 rule with 100 intervals.",
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
            case "curvefit" -> throw badRequest("Curve fitting is planned for the Apache Commons Math backend phase.");
            default -> throw badRequest("Unsupported numerical method.");
        };
    }

    public Map<String, Object> calculus(Map<String, Object> request) {
        String operation = requiredString(request, "operation");
        if (!"limit".equals(operation)) {
            throw badRequest("This calculus operation is planned for the symbolic backend phase.");
        }

        String expression = requiredExpression(request, "expression");
        double center = finiteNumber(request.get("center"), "Limit center");
        LimitResult limit = limit(expression, center);
        String output = limit.exists()
            ? "Limit: " + formatNumber(limit.value())
            : "Limit does not exist. Reason: " + limit.reason();
        return data(output, limit.toMap(), List.of(
            "Evaluated the expression from both sides of the center.",
            limit.exists() ? "Left and right approximations converged." : limit.reason()
        ));
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

    private static String factorForRoot(String variable, double root) {
        if (Math.abs(root) < EPSILON) return variable;
        return root > 0
            ? "(" + variable + " - " + formatNumber(root) + ")"
            : "(" + variable + " + " + formatNumber(Math.abs(root)) + ")";
    }

    private static double simpson(String expression, double lower, double upper, int intervals) {
        Expression parsed = ExpressionParser.parse(expression);
        int n = intervals % 2 == 0 ? intervals : intervals + 1;
        double h = (upper - lower) / n;
        double sum = parsed.eval(Map.of("x", lower)) + parsed.eval(Map.of("x", upper));
        for (int i = 1; i < n; i++) {
            double x = lower + i * h;
            sum += (i % 2 == 0 ? 2 : 4) * parsed.eval(Map.of("x", x));
        }
        return (h / 3.0) * sum;
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
        double sum = 0.0;
        for (double number : numbers) sum += number;
        double mean = sum / n;
        double[] sorted = numbers.clone();
        java.util.Arrays.sort(sorted);
        double median = n % 2 == 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0 : sorted[n / 2];
        double sumSquares = 0.0;
        for (double number : numbers) {
            sumSquares += Math.pow(number - mean, 2);
        }
        double variance = n > 1 ? sumSquares / (n - 1) : 0.0;
        double stdDev = Math.sqrt(variance);
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
        result.put("min", sorted[0]);
        result.put("max", sorted[n - 1]);
        result.put("confidenceInterval95", List.of(mean - margin, mean + margin));
        return result;
    }

    private static double[][] multiply(double[][] left, double[][] right) {
        double[][] result = new double[left.length][right[0].length];
        for (int row = 0; row < left.length; row++) {
            for (int col = 0; col < right[0].length; col++) {
                for (int k = 0; k < left[0].length; k++) {
                    result[row][col] += left[row][k] * right[k][col];
                }
            }
        }
        return result;
    }

    private static double determinant(double[][] matrix) {
        double[][] copy = copy(matrix);
        double determinant = 1.0;
        int sign = 1;
        for (int pivot = 0; pivot < copy.length; pivot++) {
            int pivotRow = pivotRow(copy, pivot);
            if (Math.abs(copy[pivotRow][pivot]) < EPSILON) return 0.0;
            if (pivotRow != pivot) {
                double[] temp = copy[pivot];
                copy[pivot] = copy[pivotRow];
                copy[pivotRow] = temp;
                sign *= -1;
            }
            determinant *= copy[pivot][pivot];
            for (int row = pivot + 1; row < copy.length; row++) {
                double factor = copy[row][pivot] / copy[pivot][pivot];
                for (int col = pivot; col < copy.length; col++) {
                    copy[row][col] -= factor * copy[pivot][col];
                }
            }
        }
        return determinant * sign;
    }

    private static double[][] inverse(double[][] matrix) {
        int n = matrix.length;
        double[][] augmented = new double[n][2 * n];
        for (int row = 0; row < n; row++) {
            System.arraycopy(matrix[row], 0, augmented[row], 0, n);
            augmented[row][n + row] = 1.0;
        }
        gaussJordan(augmented, n);
        double[][] inverse = new double[n][n];
        for (int row = 0; row < n; row++) {
            System.arraycopy(augmented[row], n, inverse[row], 0, n);
        }
        return inverse;
    }

    private static double[] solveLinear(double[][] matrix, double[] vector) {
        int n = matrix.length;
        double[][] augmented = new double[n][n + 1];
        for (int row = 0; row < n; row++) {
            System.arraycopy(matrix[row], 0, augmented[row], 0, n);
            augmented[row][n] = vector[row];
        }
        gaussJordan(augmented, n);
        double[] result = new double[n];
        for (int row = 0; row < n; row++) {
            result[row] = augmented[row][n];
        }
        return result;
    }

    private static void gaussJordan(double[][] augmented, int pivotColumns) {
        for (int pivot = 0; pivot < pivotColumns; pivot++) {
            int pivotRow = pivotRow(augmented, pivot);
            if (Math.abs(augmented[pivotRow][pivot]) < EPSILON) {
                throw badRequest("Matrix is singular.");
            }
            double[] temp = augmented[pivot];
            augmented[pivot] = augmented[pivotRow];
            augmented[pivotRow] = temp;
            double divisor = augmented[pivot][pivot];
            for (int col = 0; col < augmented[pivot].length; col++) {
                augmented[pivot][col] /= divisor;
            }
            for (int row = 0; row < augmented.length; row++) {
                if (row == pivot) continue;
                double factor = augmented[row][pivot];
                for (int col = 0; col < augmented[row].length; col++) {
                    augmented[row][col] -= factor * augmented[pivot][col];
                }
            }
        }
    }

    private static int pivotRow(double[][] matrix, int pivot) {
        int row = pivot;
        for (int candidate = pivot + 1; candidate < matrix.length; candidate++) {
            if (Math.abs(matrix[candidate][pivot]) > Math.abs(matrix[row][pivot])) {
                row = candidate;
            }
        }
        return row;
    }

    private static double[][] copy(double[][] matrix) {
        double[][] copy = new double[matrix.length][matrix[0].length];
        for (int row = 0; row < matrix.length; row++) {
            System.arraycopy(matrix[row], 0, copy[row], 0, matrix[row].length);
        }
        return copy;
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

    private static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
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
