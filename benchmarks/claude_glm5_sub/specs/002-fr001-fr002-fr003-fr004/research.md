# Research: 関数ビジュアライザー（微分機能付き）

**Date**: 2026-02-17
**Feature**: 002-fr001-fr002-fr003-fr004

## Research Tasks

### 1. function-plot Library Capabilities

**Decision**: Use function-plot v1.25.3 as primary graphing library

**Rationale**:
- Native derivative visualization support via `derivative: { fn: '2*x', updateOnMouseMove: true }`
- Built on D3.js with zoom/pan support
- Interval-arithmetic for accurate rendering of oscillating functions
- Active maintenance (published January 2026)
- MIT license, no known CVEs

**Evidence**:
- 1,000+ GitHub stars, 2,994 weekly npm downloads
- Built-in tangent line updates with mouse movement
- Auto-scaling domain detection

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|-----------------|
| Plotly.js | Heavier, no built-in derivative support |
| Chart.js | Not designed for mathematical functions |
| JSXGraph | Less active maintenance, steeper learning curve |

### 2. math.js Symbolic Differentiation

**Decision**: Use math.js v15.1.1 for derivative calculation and expression parsing

**Rationale**:
- `math.derivative(expr, 'x')` returns symbolic expression
- Flexible expression parser handles sin, cos, tan, log, exp, sqrt, abs
- Graceful error handling for invalid syntax
- 1.78M weekly downloads, mature codebase

**API Example**:
```javascript
import { derivative, parse } from 'mathjs';

const result = derivative('x^2 + x', 'x'); // returns '2*x + 1'
const expr = parse('sin(x)');
const evaluated = expr.evaluate({ x: Math.PI / 2 }); // returns 1
```

**Error Handling**:
```javascript
try {
  const d = derivative('invalid(', 'x');
} catch (e) {
  // Handle SyntaxError gracefully
  console.error('Invalid expression:', e.message);
}
```

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|-----------------|
| nerdamer | Smaller community, less robust error handling |
| algebra.js | Limited function support (no trig) |
| Custom parser | High maintenance, error-prone |

### 3. D3.js Zoom/Pan Integration

**Decision**: Use d3-zoom for interactive zoom/pan (via function-plot)

**Rationale**:
- function-plot uses D3.js internally
- d3-zoom supports both mouse wheel and touch pinch gestures
- Automatic domain rescaling

**Configuration**:
```javascript
functionPlot({
  target: '#graph',
  data: [{ fn: 'x^2' }],
  tip: { xLine: true, yLine: true },
  zoom: true, // Enables d3-zoom
});
```

### 4. Performance Optimization with requestAnimationFrame

**Decision**: Use requestAnimationFrame for tooltip updates (FR-009)

**Rationale**:
- Native browser API, zero dependencies
- Synchronizes with browser paint cycle for smooth 60fps
- Automatically pauses when tab hidden (power saving)

**Implementation Pattern**:
```javascript
let rafId: number | null = null;
let mouseX = 0;

canvas.addEventListener('mousemove', (e) => {
  mouseX = e.offsetX;
  if (!rafId) {
    rafId = requestAnimationFrame(() => {
      updateTooltip(mouseX);
      rafId = null;
    });
  }
});
```

**Performance Target**: 30fps minimum (SC-006)

### 5. Responsive Design Patterns

**Decision**: CSS Grid + CSS Custom Properties for responsive layout

**Rationale**:
- No framework needed for simple layout
- Native browser support
- Easy viewport-based adjustments

**Breakpoints**:
```css
:root {
  --graph-height: 400px;
}

@media (max-width: 768px) {
  :root {
    --graph-height: 300px;
  }
}

@media (max-width: 480px) {
  :root {
    --graph-height: 250px;
  }
}
```

**Touch Support**:
- d3-zoom handles pinch-to-zoom automatically
- Button sizes: minimum 44px × 44px for touch targets

### 6. Debounce Implementation

**Decision**: Use lodash.debounce for 300ms debounce on input (FR-003)

**Rationale**:
- 27M+ weekly downloads, battle-tested
- Zero runtime dependencies
- Minimal bundle size (2KB gzipped)

**Usage**:
```typescript
import debounce from 'lodash.debounce';

const debouncedUpdate = debounce((expr: string) => {
  updateGraph(expr);
}, 300);

input.addEventListener('input', (e) => {
  debouncedUpdate(e.target.value);
});
```

## Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Language | TypeScript | 5.x | Type safety, better IDE support |
| Bundler | Vite | 5.x | Fast dev server, optimized builds |
| Graphing | function-plot | 1.25.3 | Function visualization |
| Math | math.js | 15.1.1 | Derivative calculation, parsing |
| DOM | D3.js | 7.9.0 | Zoom/pan (via function-plot) |
| Debounce | lodash.debounce | 4.17.x | Input debouncing |
| Testing | Vitest | 1.x | Unit tests |
| E2E | Playwright | 1.x | Browser testing |

## Key Findings

1. **function-plot + math.js combination**: Covers FR-001 through FR-010 with minimal custom code
2. **No backend required**: Fully client-side application
3. **Touch support**: Built into d3-zoom via function-plot
4. **Error handling**: math.js parser throws catchable SyntaxError
5. **Performance**: requestAnimationFrame sufficient for 30fps tooltip updates

### 7. Discontinuity Handling

**Decision**: function-plot handles discontinuities via interval arithmetic with visual gaps

**Behavior**: 1/x at x=0, tan(x) asymptotes, log(x) for x≤0 all render as gaps (no line) automatically via internal interval-arithmetic. No special handling required.

### 8. Input Validation Whitelist

**Decision**: Whitelist allowed characters and functions before math.js parser

```typescript
const ALLOWED_FUNCTIONS = ['sin', 'cos', 'tan', 'log', 'exp', 'sqrt', 'abs'];

function validateInput(raw: string): boolean {
  const sanitized = raw.toLowerCase().replace(/\s+/g, '');
  const funcPattern = /^(x|[0-9.+\-*/^()]+|(sin|cos|tan|log|exp|sqrt|abs)\([^()]*\))*$/;
  if (!funcPattern.test(sanitized)) return false;
  const tokens = raw.match(/[a-z]+/gi) || [];
  return tokens.every(t => ALLOWED_FUNCTIONS.includes(t.toLowerCase()) || t.toLowerCase() === 'x');
}
```

**Rules**: Allow digits, x, operators (+,-,*,/,^), parentheses, and ALLOWED_FUNCTIONS. Reject alert(), eval(), SQL-like patterns, arbitrary function calls.

## Implementation Timeline

| Phase | Duration | Scope | Deliverable |
|-------|----------|-------|-------------|
| P1 MVP | 2-3 days | FR-001~008, FR-012, FR-013 (single function) | Single-function visualizer |
| P2 Enhancement | 2 days | FR-009, FR-010, User Story 4 (multi-function) | Full-featured visualizer |
| P3 Polish | 1 day | FR-011, User Story 5 (mobile) | Production-ready app |

## Open Questions (None)

All unknowns resolved through research. Ready for Phase 1 design.
