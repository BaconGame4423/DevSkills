import { create, all } from 'mathjs';

const math = create(all);

export class DerivativeCalculator {
  constructor() {
    this.derivativeExpr = null;
    this.compiledDerivative = null;
  }

  calculate(expression) {
    if (!expression || expression.trim() === '') {
      return null;
    }

    try {
      const derivativeNode = math.derivative(expression, 'x');
      this.derivativeExpr = derivativeNode.toString();
      this.compiledDerivative = derivativeNode.compile();
      
      return {
        expression: this.derivativeExpr,
        fn: (x) => {
          try {
            return this.compiledDerivative.evaluate({ x });
          } catch (e) {
            return NaN;
          }
        }
      };
    } catch (e) {
      return null;
    }
  }

  evaluate(x) {
    if (!this.compiledDerivative) {
      return NaN;
    }
    try {
      return this.compiledDerivative.evaluate({ x });
    } catch (e) {
      return NaN;
    }
  }

  getExpression() {
    return this.derivativeExpr;
  }
}

export const derivativeCalculator = new DerivativeCalculator();
