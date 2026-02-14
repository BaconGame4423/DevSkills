import { create, all } from 'mathjs';

const math = create(all);

export class ExpressionParser {
  constructor() {
    this.compiledExpr = null;
    this.currentExpression = '';
  }

  parse(expression) {
    if (!expression || expression.trim() === '') {
      throw new Error('数式を入力してください');
    }
    
    this.currentExpression = expression;
    
    try {
      const node = math.parse(expression);
      this.compiledExpr = node.compile();
      
      const testValues = [-1, 0, 1, 2, 10];
      for (const x of testValues) {
        try {
          const scope = { x };
          this.compiledExpr.evaluate(scope);
        } catch (e) {
          // Some values may be undefined (e.g., log(-1)), that's OK
        }
      }
      
      return {
        ast: node,
        fn: (x) => {
          try {
            return this.compiledExpr.evaluate({ x });
          } catch (e) {
            return NaN;
          }
        },
        expression: expression
      };
    } catch (e) {
      throw new Error(this.formatError(e));
    }
  }

  formatError(error) {
    const message = error.message || String(error);
    
    if (message.includes('Undefined symbol')) {
      const symbol = message.match(/Undefined symbol (\w+)/)?.[1] || '不明';
      return `未定義の記号: ${symbol}。変数は 'x' を使用してください`;
    }
    if (message.includes('Unexpected')) {
      return '構文エラー: 数式の形式が正しくありません';
    }
    if (message.includes('parenthesis')) {
      return '括弧の対応が正しくありません';
    }
    
    return `数式エラー: ${message}`;
  }

  evaluate(x) {
    if (!this.compiledExpr) {
      return NaN;
    }
    try {
      return this.compiledExpr.evaluate({ x });
    } catch (e) {
      return NaN;
    }
  }
}

export const expressionParser = new ExpressionParser();
