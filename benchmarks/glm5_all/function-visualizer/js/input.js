class InputController {
    constructor(options = {}) {
        this.debounceDelay = options.debounceDelay || 150;
        this.debounceTimer = null;
        this.expression = '';
        this.compiledExpr = null;
        this.isValid = false;
        this.error = null;
    }

    parseAndValidate(expression) {
        this.expression = expression.trim();
        
        if (!this.expression) {
            return {
                expression: '',
                isValid: false,
                error: '数式を入力してください'
            };
        }

        try {
            this.compiledExpr = math.compile(this.expression);
            this.testEvaluation();
            this.isValid = true;
            this.error = null;
            
            return {
                expression: this.expression,
                isValid: true,
                evaluateFn: (x) => this.evaluate(x),
                error: null
            };
        } catch (e) {
            this.isValid = false;
            this.error = this.classifyError(e);
            this.compiledExpr = null;
            
            return {
                expression: this.expression,
                isValid: false,
                error: this.error
            };
        }
    }

    testEvaluation() {
        const testValues = [0, 1, -1, 0.5, 2];
        let hasValidResult = false;
        
        for (const x of testValues) {
            try {
                const result = this.compiledExpr.evaluate({ x });
                if (typeof result === 'number' && isFinite(result)) {
                    hasValidResult = true;
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!hasValidResult) {
            throw new Error('DOMAIN_ERROR');
        }
    }

    classifyError(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('syntax') || 
            message.includes('parse') ||
            message.includes('unexpected') ||
            message.includes('expected') ||
            message.includes('invalid')) {
            return '構文エラー: 数式の書き方を確認してください';
        }
        
        if (message.includes('undefined') || 
            message.includes('not defined') ||
            message.includes('unknown function') ||
            message.includes('domain_error')) {
            return '定義されていない関数または変数が含まれています';
        }
        
        if (message.includes('domain') || 
            message.includes('nan') ||
            message.includes('infinity')) {
            return '定義域エラー: 計算可能な範囲外です';
        }
        
        return `エラー: ${error.message}`;
    }

    evaluate(x) {
        if (!this.compiledExpr) {
            return NaN;
        }
        
        try {
            const result = this.compiledExpr.evaluate({ x });
            if (typeof result !== 'number' || !isFinite(result)) {
                return NaN;
            }
            return result;
        } catch (e) {
            return NaN;
        }
    }

    debounce(callback) {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.debounceTimer = setTimeout(() => {
            callback();
            this.debounceTimer = null;
        }, this.debounceDelay);
    }

    cancelDebounce() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }
}

function testSupportedFunctions() {
    const testCases = [
        { expr: 'sin(x)', x: 0, expected: 0 },
        { expr: 'sin(x)', x: Math.PI / 2, expected: 1 },
        { expr: 'cos(x)', x: 0, expected: 1 },
        { expr: 'cos(x)', x: Math.PI, expected: -1 },
        { expr: 'tan(x)', x: 0, expected: 0 },
        { expr: 'tan(x)', x: Math.PI / 4, expected: 1 },
        { expr: 'log(x)', x: 1, expected: 0 },
        { expr: 'log(x)', x: Math.E, expected: 1 },
        { expr: 'exp(x)', x: 0, expected: 1 },
        { expr: 'exp(x)', x: 1, expected: Math.E },
        { expr: 'sqrt(x)', x: 0, expected: 0 },
        { expr: 'sqrt(x)', x: 4, expected: 2 },
        { expr: 'abs(x)', x: -5, expected: 5 },
        { expr: 'abs(x)', x: 3, expected: 3 }
    ];
    
    const results = [];
    
    for (const test of testCases) {
        try {
            const compiled = math.compile(test.expr);
            const result = compiled.evaluate({ x: test.x });
            const passed = Math.abs(result - test.expected) < 1e-10;
            results.push({
                expr: test.expr,
                x: test.x,
                expected: test.expected,
                result: result,
                passed: passed
            });
        } catch (e) {
            results.push({
                expr: test.expr,
                x: test.x,
                expected: test.expected,
                result: 'error',
                passed: false,
                error: e.message
            });
        }
    }
    
    return results;
}

const inputController = new InputController();
