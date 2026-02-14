export class TangentLine {
  constructor() {
    this.enabled = false;
    this.currentX = null;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  setX(x) {
    this.currentX = x;
  }

  calculate(fn, dfn, x0) {
    if (!fn || !dfn || x0 === null) {
      return null;
    }
    
    const math = window.math;
    
    try {
      const fNode = math.parse(fn).compile();
      const dfNode = math.parse(dfn).compile();
      
      const y0 = fNode.evaluate({ x: x0 });
      const slope = dfNode.evaluate({ x: x0 });
      
      if (isNaN(y0) || isNaN(slope) || !isFinite(y0) || !isFinite(slope)) {
        return null;
      }
      
      // y = f'(x0) * (x - x0) + f(x0)
      return {
        expression: `${slope} * (x - ${x0}) + ${y0}`,
        point: { x: x0, y: y0 },
        slope: slope
      };
    } catch (e) {
      return null;
    }
  }

  getTangentExpression(fn, dfn) {
    if (!this.enabled || this.currentX === null) {
      return null;
    }
    return this.calculate(fn, dfn, this.currentX);
  }
}
