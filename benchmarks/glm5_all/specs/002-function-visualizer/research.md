# Research Summary: Function Visualizer Libraries

**Date**: 2026-02-14 | **Feature**: 002-function-visualizer

## Selected Libraries

### 1. math.js (Expression Parsing + Calculus)

**Purpose**: Parse mathematical expressions and compute derivatives symbolically.

**Key APIs**:
```javascript
import { parse, derivative, compile } from 'mathjs';

// Parse expression
const expr = parse('x^2 + sin(x)');

// Compute derivative
const deriv = derivative(expr, 'x');

// Compile to evaluatable function
const fn = compile(expr);
fn.evaluate({ x: 2 }); // Returns numeric value

const dfn = compile(deriv);
dfn.evaluate({ x: 2 }); // Returns derivative value
```

**Why selected**:
- Native symbolic differentiation via `math.derivative()`
- Supports all required functions: sin, cos, tan, log, exp, sqrt, abs
- Mature library (210k+ weekly downloads)
- TypeScript type definitions included
- No external dependencies

**Limitations**:
- Cannot differentiate implicit functions
- Complex number results need handling (e.g., sqrt(-1))

### 2. function-plot (Graph Rendering)

**Purpose**: Render 2D function graphs with D3.js backend.

**Key APIs**:
```javascript
import functionPlot from 'function-plot';

functionPlot({
  target: '#graph-container',
  data: [{
    fn: 'x^2',
    color: 'blue'
  }, {
    fn: '2*x',  // Derivative
    color: 'red',
    derivative: { fn: '2' }
  }],
  tip: {
    xLine: true,
    yLine: true,
    content: (x, y) => `x: ${x.toFixed(2)}, y: ${y.toFixed(2)}`
  },
  plugins: [
    functionPlot.plugins.definiteIntegral()
  ]
});
```

**Why selected**:
- Built-in tangent line support via `derivative` option
- Cursor-following tooltip via `tip` configuration
- Auto-scale viewport handling
- SVG-based (crisp at any resolution)
- Active maintenance (1k+ GitHub stars)

**Limitations**:
- Requires D3.js as peer dependency (~100KB)
- Limited to 2D plotting (3D not needed for this feature)

### 3. D3.js (Visualization Foundation)

**Purpose**: Required peer dependency for function-plot.

**Notes**:
- function-plot uses D3 internally for rendering
- No direct API usage in our code
- Version 7.x for modern ES module support

## Rejected Alternatives

### JSXGraph

**Reason rejected**:
- More comprehensive but heavier (includes geometry tools we don't need)
- API complexity higher for simple function plotting
- function-plot provides cleaner API for our use case

## Performance Considerations

### Debounced Input Pattern

```javascript
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

const debouncedUpdate = debounce(updateGraph, 300);
input.addEventListener('input', debouncedUpdate);
```

**Rationale**: 300ms debounce balances responsiveness (SC-001: 500ms total) with CPU efficiency.

### Symbolic Derivative + Compiled Function Pattern

```javascript
// One-time symbolic differentiation (slow but accurate)
const derivativeExpr = math.derivative(expression, 'x');

// Compile once, evaluate many times (fast)
const derivativeFn = math.compile(derivativeExpr);

// Cache compiled functions
const functionCache = new Map();
function getCompiled(expr) {
  if (!functionCache.has(expr)) {
    functionCache.set(expr, math.compile(expr));
  }
  return functionCache.get(expr);
}
```

**Rationale**: Symbolic differentiation is accurate and human-readable. Compilation enables fast evaluation at hundreds of points for rendering.

## References

- math.js docs: https://mathjs.org/docs/reference/functions/derivative.html
- function-plot docs: https://mauriciopoppe.github.io/function-plot/
- D3.js docs: https://d3js.org/
- MDN requestAnimationFrame: https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame
