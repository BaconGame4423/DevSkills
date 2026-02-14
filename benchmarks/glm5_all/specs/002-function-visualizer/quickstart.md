# Quick Start: Function Visualizer Development

**Feature**: 002-function-visualizer | **Date**: 2026-02-14

## Prerequisites

- Node.js 18+ 
- npm 9+
- Modern browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

## Setup

```bash
# Create project directory
mkdir function-visualizer && cd function-visualizer

# Initialize npm project
npm init -y

# Install dependencies
npm install mathjs function-plot d3

# Install dev dependencies
npm install -D vitest playwright esbuild
```

## Project Structure

```
function-visualizer/
├── index.html
├── styles/
│   └── main.css
├── src/
│   ├── main.js
│   ├── input/
│   ├── graph/
│   ├── calculus/
│   ├── ui/
│   └── utils/
├── tests/
│   ├── unit/
│   └── e2e/
├── package.json
└── specs/
    └── 002-function-visualizer/
```

## Quick Implementation Guide

### Step 1: HTML Skeleton

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Function Visualizer</title>
  <link rel="stylesheet" href="styles/main.css">
</head>
<body>
  <main class="container">
    <header>
      <h1>Function Visualizer</h1>
    </header>
    
    <section class="input-section">
      <input type="text" id="expression-input" 
             placeholder="f(x) = x^2" 
             autocomplete="off">
      <div class="preset-buttons" id="presets"></div>
      <div class="toggles">
        <label><input type="checkbox" id="show-derivative"> 導関数を表示</label>
        <label><input type="checkbox" id="show-tangent"> 接線を表示</label>
      </div>
    </section>
    
    <section class="graph-section">
      <div id="graph-container"></div>
      <div id="tooltip" class="tooltip hidden"></div>
    </section>
    
    <section class="error-section">
      <div id="error-message" class="error hidden"></div>
    </section>
  </main>
  
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

### Step 2: Expression Parser

```javascript
// src/calculus/ExpressionParser.js
import { parse, compile } from 'mathjs';

export class ExpressionParser {
  parse(expressionString) {
    try {
      const ast = parse(expressionString);
      const fn = compile(ast);
      return {
        raw: expressionString,
        ast,
        fn: (x) => fn.evaluate({ x }),
        isValid: true
      };
    } catch (error) {
      return {
        raw: expressionString,
        isValid: false,
        error: this.formatError(error)
      };
    }
  }
  
  formatError(error) {
    return {
      type: 'syntax',
      message: error.message,
      userMessage: '数式の形式が正しくありません',
      suggestion: 'カッコの対応や演算子を確認してください'
    };
  }
}
```

### Step 3: Derivative Calculator

```javascript
// src/calculus/DerivativeCalculator.js
import { derivative, compile } from 'mathjs';

export class DerivativeCalculator {
  calculate(expression) {
    if (!expression.isValid) return null;
    
    try {
      const derivAst = derivative(expression.ast, 'x');
      const derivFn = compile(derivAst);
      
      return {
        sourceExpression: expression,
        ast: derivAst,
        fn: (x) => derivFn.evaluate({ x }),
        expressionString: derivAst.toString(),
        isValid: true
      };
    } catch (error) {
      return {
        sourceExpression: expression,
        isValid: false,
        error: { message: error.message }
      };
    }
  }
}
```

### Step 4: Graph Renderer

```javascript
// src/graph/GraphRenderer.js
import functionPlot from 'function-plot';

export class GraphRenderer {
  constructor(containerId) {
    this.container = `#${containerId}`;
    this.instance = null;
  }
  
  render(expression, derivative, options = {}) {
    const data = [{
      fn: expression.raw,
      color: '#2563eb'
    }];
    
    if (options.showDerivative && derivative?.isValid) {
      data.push({
        fn: derivative.expressionString,
        color: '#dc2626',
        fnType: 'linear'
      });
    }
    
    this.instance = functionPlot({
      target: this.container,
      data,
      width: this.getWidth(),
      height: 500,
      xAxis: { domain: [-10, 10] },
      yAxis: { domain: [-10, 10] },
      tip: {
        xLine: true,
        yLine: true
      }
    });
    
    return this.instance;
  }
  
  getWidth() {
    return Math.min(window.innerWidth - 40, 800);
  }
}
```

### Step 5: Main Application

```javascript
// src/main.js
import { ExpressionParser } from './calculus/ExpressionParser.js';
import { DerivativeCalculator } from './calculus/DerivativeCalculator.js';
import { GraphRenderer } from './graph/GraphRenderer.js';
import { debounce } from './utils/debounce.js';

const parser = new ExpressionParser();
const derivativeCalc = new DerivativeCalculator();
const renderer = new GraphRenderer('graph-container');

const input = document.getElementById('expression-input');
const showDerivative = document.getElementById('show-derivative');
const showTangent = document.getElementById('show-tangent');

const updateGraph = debounce(() => {
  const expr = parser.parse(input.value);
  
  if (!expr.isValid) {
    showError(expr.error);
    return;
  }
  
  const deriv = derivativeCalc.calculate(expr);
  renderer.render(expr, deriv, {
    showDerivative: showDerivative.checked
  });
  
  hideError();
}, 300);

input.addEventListener('input', updateGraph);
showDerivative.addEventListener('change', updateGraph);

// Initial render
input.value = 'x^2';
updateGraph();
```

## Testing

```bash
# Run unit tests
npm run test

# Run e2e tests
npx playwright test

# Run in development
npx esbuild src/main.js --bundle --outfile=dist/bundle.js --watch
```

## Key Files to Implement

| File | Priority | Description |
|------|----------|-------------|
| `src/main.js` | P1-1 | Application entry point |
| `src/calculus/ExpressionParser.js` | P1-2 | math.js expression parsing |
| `src/input/InputHandler.js` | P1-3 | Debounced input handling |
| `src/graph/GraphRenderer.js` | P1-4 | function-plot wrapper |
| `src/input/PresetButtons.js` | P1-6 | Preset function buttons |
| `src/ui/ErrorHandler.js` | P1-8 | Error display |
| `src/calculus/DerivativeCalculator.js` | P2-1 | Derivative computation |
| `src/ui/TooltipManager.js` | P3-1 | Cursor tooltip |

## Common Issues

| Issue | Solution |
|-------|----------|
| `math.derivative()` fails on implicit functions | Only explicit functions f(x) supported |
| Graph blank at x=0 for 1/x | function-plot handles discontinuities |
| Complex results (sqrt(-1)) | Catch and show domain error |
| Slow on complex expressions | Cache compiled functions |
