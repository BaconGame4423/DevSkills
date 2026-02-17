# Quickstart: 関数ビジュアライザー（微分機能付き）

**Date**: 2026-02-17
**Feature**: 002-fr001-fr002-fr003-fr004

## Prerequisites

- Node.js 18+
- npm 9+
- Modern browser (Chrome, Firefox, Safari, Edge)

## Initial Setup

```bash
# Create project
npm create vite@latest function-visualizer -- --template vanilla-ts
cd function-visualizer

# Install dependencies
npm install function-plot@1.25.3 mathjs@15.1.1 d3@7.9.0 lodash.debounce@4.17.21

# Install dev dependencies
npm install -D vitest @vitest/ui playwright @playwright/test
```

## Project Structure

```
function-visualizer/
├── src/
│   ├── index.html
│   ├── main.ts
│   ├── components/
│   ├── services/
│   ├── models/
│   └── styles/
├── tests/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── playwright.config.ts
```

## Development Commands

```bash
# Start dev server
npm run dev

# Run unit tests
npm run test

# Run tests with UI
npm run test:ui

# Run e2e tests
npm run test:e2e

# Build for production
npm run build

# Type check
npm run typecheck
```

## package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit"
  }
}
```

## Testing Strategy

### Unit Tests (Vitest)

**Location**: `tests/unit/`

```typescript
// tests/unit/DerivativeService.test.ts
import { describe, it, expect } from 'vitest';
import { DerivativeService } from '@/services/DerivativeService';

describe('DerivativeService', () => {
  it('should calculate derivative of x^2', () => {
    const service = new DerivativeService();
    const result = service.calculate({ raw: 'x^2', normalized: 'x ^ 2' });
    expect(result.expression).toBe('2 * x');
  });

  it('should handle invalid expressions', () => {
    const service = new DerivativeService();
    const result = service.calculate({ raw: 'invalid(', normalized: 'invalid(' });
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

### Integration Tests

**Location**: `tests/integration/`

```typescript
// tests/integration/graph-rendering.test.ts
import { describe, it, expect } from 'vitest';

describe('Graph Rendering', () => {
  it('should render x^2 as parabola', async () => {
    // Setup DOM, render graph, verify SVG elements
  });
});
```

### E2E Tests (Playwright)

**Location**: `tests/e2e/`

```typescript
// tests/e2e/user-scenarios.test.ts
import { test, expect } from '@playwright/test';

test.describe('User Story 1 - Basic Function Visualization', () => {
  test('should display parabola for x^2', async ({ page }) => {
    await page.goto('/');
    await page.fill('#function-input', 'x^2');
    await expect(page.locator('#graph svg')).toBeVisible();
  });

  test('should update graph in real-time', async ({ page }) => {
    await page.goto('/');
    await page.fill('#function-input', 'x^');
    await page.fill('#function-input', 'x^2');
    // Verify debounce behavior
  });
});

test.describe('User Story 2 - Derivative Understanding', () => {
  test('should show derivative and original function', async ({ page }) => {
    await page.goto('/');
    await page.fill('#function-input', 'x^2');
    await page.check('#show-derivative');
    await expect(page.locator('.derivative-line')).toBeVisible();
  });
});
```

## Running Tests

```bash
# Run all unit tests
npm run test

# Run specific test file
npm run test tests/unit/DerivativeService.test.ts

# Run tests in watch mode
npm run test -- --watch

# Run e2e tests
npm run test:e2e

# Run e2e tests in UI mode
npm run test:e2e -- --ui
```

## Development Workflow

1. **Start dev server**: `npm run dev`
2. **Write failing test**: Create test for new feature
3. **Run test**: `npm run test` (should fail)
4. **Implement**: Write minimum code to pass
5. **Run test again**: Should pass
6. **Refactor**: Improve code quality
7. **Type check**: `npm run typecheck`
8. **Repeat**: Continue for next feature

## Manual Testing Checklist

### P1 Stories (MVP)

- [ ] Input "x^2" shows parabola
- [ ] Change to "sin(x)" updates to sine wave
- [ ] Axis labels and grid visible
- [ ] Derivative toggle shows/hides derivative graph
- [ ] Hover shows tooltip with x, f(x), f'(x)

### P2 Stories

- [ ] Tangent line mode draws tangent
- [ ] Multiple functions display simultaneously
- [ ] Each function has distinct color

### P3 Stories

- [ ] Mobile viewport responsive
- [ ] Touch zoom works

## Common Issues

### Issue: function-plot not rendering

**Solution**: Ensure container has explicit height in CSS

```css
#graph {
  width: 100%;
  height: 400px;
}
```

### Issue: math.js derivative fails

**Solution**: Check expression format. Use `^` for power, ensure valid syntax

```javascript
// Correct
math.derivative('x^2', 'x');
// Incorrect
math.derivative('x**2', 'x');
```

### Issue: Tooltip not updating at 30fps

**Solution**: Use requestAnimationFrame pattern

```javascript
let rafId = null;
canvas.addEventListener('mousemove', (e) => {
  if (!rafId) {
    rafId = requestAnimationFrame(() => {
      updateTooltip(e.offsetX);
      rafId = null;
    });
  }
});
```

## Success Metrics

| Metric | Target | How to Verify |
|--------|--------|---------------|
| Initial render | <1s | Lighthouse, manual stopwatch |
| Graph update | <100ms | DevTools Performance tab |
| Derivative calc | <500ms | Console.time() |
| Tooltip fps | 30fps | DevTools Performance, frame rate |
| Viewport support | 320-1920px | Chrome DevTools responsive mode |
| Error handling | 100% | Test invalid inputs, no crashes |
