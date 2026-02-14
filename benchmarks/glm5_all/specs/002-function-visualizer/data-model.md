# Data Model: Function Visualizer

**Date**: 2026-02-14 | **Feature**: 002-function-visualizer

## Core Entities

### 1. Expression

```typescript
interface Expression {
  raw: string;                    // Original input string: "x^2 + sin(x)"
  ast?: math.MathNode;            // Parsed AST from math.js
  fn?: (x: number) => number;     // Compiled evaluation function
  isValid: boolean;               // Parse success flag
  error?: ParseError;             // Error details if invalid
}
```

### 2. Derivative

```typescript
interface Derivative {
  sourceExpression: Expression;   // Reference to original expression
  ast?: math.MathNode;            // Derivative AST from math.derivative()
  fn?: (x: number) => number;     // Compiled derivative function
  expressionString?: string;      // Human-readable: "2*x + cos(x)"
  isValid: boolean;
  error?: ComputeError;
}
```

### 3. GraphViewport

```typescript
interface GraphViewport {
  xMin: number;   // Default: -10
  xMax: number;   // Default: 10
  yMin: number;   // Auto-calculated
  yMax: number;   // Auto-calculated
  width: number;  // Container width (px)
  height: number; // Container height (px)
}

// Auto-scale algorithm
function autoScale(expression: Expression, viewport: GraphViewport): GraphViewport {
  const samples = 200;
  const xStep = (viewport.xMax - viewport.xMin) / samples;
  let yMin = Infinity, yMax = -Infinity;
  
  for (let i = 0; i <= samples; i++) {
    const x = viewport.xMin + i * xStep;
    try {
      const y = expression.fn(x);
      if (isFinite(y)) {
        yMin = Math.min(yMin, y);
        yMax = Math.max(yMax, y);
      }
    } catch { /* skip undefined points */ }
  }
  
  const padding = (yMax - yMin) * 0.1;
  return { ...viewport, yMin: yMin - padding, yMax: yMax + padding };
}
```

### 4. TooltipData

```typescript
interface TooltipData {
  x: number;          // Current cursor x-coordinate
  fx: number;         // f(x) value
  dfx: number | null; // f'(x) value (null if derivative disabled)
  visible: boolean;   // Tooltip visibility flag
}
```

### 5. TangentLine

```typescript
interface TangentLine {
  x0: number;         // Tangent point x-coordinate
  y0: number;         // f(x0)
  slope: number;      // f'(x0)
  intercept: number;  // y0 - slope * x0
  visible: boolean;   // Tangent line visibility flag
}

// Tangent line equation: y = slope * (x - x0) + y0
// Or: y = slope * x + intercept
```

### 6. ParseError

```typescript
interface ParseError {
  type: 'syntax' | 'undefined_function' | 'domain_error';
  message: string;         // Technical message from math.js
  userMessage: string;     // User-friendly message
  position?: number;       // Character position if available
  suggestion?: string;     // How to fix
}

const ERROR_MESSAGES = {
  syntax: {
    userMessage: '数式の形式が正しくありません',
    suggestion: 'カッコの対応や演算子を確認してください'
  },
  undefined_function: {
    userMessage: '不明な関数が含まれています',
    suggestion: 'sin, cos, tan, log, exp, sqrt, abs が使用可能です'
  },
  domain_error: {
    userMessage: '定義域外の計算が発生しました',
    suggestion: '入力値の範囲を確認してください'
  }
};
```

## Application State

```typescript
interface AppState {
  // Input
  inputExpression: string;
  
  // Parsed data
  currentExpression: Expression | null;
  currentDerivative: Derivative | null;
  
  // UI state
  showDerivative: boolean;
  showTangent: boolean;
  viewport: GraphViewport;
  
  // Cursor interaction
  tooltipData: TooltipData | null;
  tangentLine: TangentLine | null;
  
  // Error state
  error: ParseError | null;
}

const INITIAL_STATE: AppState = {
  inputExpression: 'x^2',
  currentExpression: null,
  currentDerivative: null,
  showDerivative: false,
  showTangent: false,
  viewport: {
    xMin: -10,
    xMax: 10,
    yMin: -10,
    yMax: 10,
    width: 800,
    height: 500
  },
  tooltipData: null,
  tangentLine: null,
  error: null
};
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Input                               │
│  [Text Field] [Preset Buttons] [Toggle: Derivative] [Toggle: Tangent]
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AppState                                    │
│  inputExpression: "sin(x)"                                       │
│  showDerivative: true                                            │
│  showTangent: true                                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│    ExpressionParser        │   │    DerivativeCalculator    │
│    (math.js parse)         │   │    (math.js derivative)    │
│                            │   │                            │
│    Expression {            │   │    Derivative {            │
│      raw: "sin(x)"         │──▶│      sourceExpression      │
│      ast: Node             │   │      ast: Node             │
│      fn: (x) => Math.sin(x)│   │      fn: (x) => Math.cos(x)│
│    }                       │   │    }                       │
└───────────────────────────┘   └───────────────────────────┘
                │                               │
                └───────────────┬───────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      GraphRenderer                               │
│                      (function-plot)                             │
│                                                                  │
│  data: [                                                         │
│    { fn: expression.fn, color: 'blue' },                        │
│    { fn: derivative.fn, color: 'red' }  // if showDerivative    │
│  ]                                                               │
│  tip: { content: (x, y) => tooltip }                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TooltipManager                              │
│                                                                  │
│  TooltipData {                                                   │
│    x: cursor x,                                                  │
│    fx: f(x),                                                     │
│    dfx: f'(x)                                                    │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Preset Configuration

```typescript
interface PresetConfig {
  label: string;           // Button label: "sin"
  expression: string;      // Expression to insert: "sin(x)"
  description?: string;    // Tooltip: "正弦関数"
}

const PRESETS: PresetConfig[] = [
  { label: 'sin', expression: 'sin(x)', description: '正弦関数' },
  { label: 'cos', expression: 'cos(x)', description: '余弦関数' },
  { label: 'tan', expression: 'tan(x)', description: '正接関数' },
  { label: 'log', expression: 'log(x)', description: '自然対数' },
  { label: 'exp', expression: 'exp(x)', description: '指数関数' },
  { label: 'sqrt', expression: 'sqrt(x)', description: '平方根' },
  { label: 'abs', expression: 'abs(x)', description: '絶対値' }
];
```
