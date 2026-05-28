# Math Engine Specification

MathLab Pro's math engine must be deterministic first. AI tutoring can explain a result, but it must not be the source of truth for symbolic, numerical, matrix, calculus, or statistics results.

## Engine Rules

- Inputs are validated before evaluation.
- Expressions are limited to bounded length, bounded parse complexity, known variables, constants, and supported functions.
- Results must be reproducible without network access.
- Error responses must be explicit and must not expose stack traces.
- Numeric algorithms must return finite numbers or a controlled validation error.
- Long-running or high-cost operations must be bounded by operation-specific limits.

## Golden Corpus

The shared correctness corpus lives at `tests/math-engine-golden.json`.

Each case defines:

- `endpoint`: API route to exercise.
- `request`: JSON payload.
- `expected.status`: expected HTTP status.
- `expected.outputIncludes`: substrings that must be present in the output.
- `expected.numeric`: optional numeric assertions using dotted response paths.

Both the current TypeScript API and the Spring Boot backend must pass this corpus for supported deterministic operations.

## Phase 1 Coverage

The deterministic backend slice now covers:

- Polynomial simplification, differentiation, integration, multiplication, division, factorization, and roots for bounded univariate polynomial expressions.
- Algebra simplification, expansion, factorization, and numeric substitution for supported expressions.
- Matrix addition, multiplication, determinant, inverse, linear solve, LU, QR, and real eigenvalue/eigenvector decomposition.
- Simpson numerical integration, Newton-Raphson, bisection, and polynomial curve fitting.
- Numerical limit approximation, Taylor polynomials, and RK4 ODE integration.
- Descriptive statistics.

The Spring Boot backend uses EJML for dense matrix arithmetic and Apache Commons Math for decomposition, integration, curve fitting, and descriptive statistics.

## Later Coverage

- Symbolic integration beyond polynomial power-rule cases.
- Higher-degree factorization and exact algebra through Symja.
- Probability distributions and hypothesis testing.
- Multivariable calculus and partial derivatives.
- WebSocket-backed long-running calculation jobs with cancellation.
- Performance tests for large expressions and matrix sizes.
