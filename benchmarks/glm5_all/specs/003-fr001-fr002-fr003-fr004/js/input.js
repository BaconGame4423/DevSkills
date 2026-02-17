const InputController = {
    DEBOUNCE_MS: 150,
    
    currentExpression: '',
    isValid: false,
    error: null,
    compiledExpr: null,
    onExpressionChange: null,
    debounceTimer: null,

    init(options) {
        if (options.onExpressionChange) {
            this.onExpressionChange = options.onExpressionChange;
        }
        this.bindEvents();
    },

    bindEvents() {
        const input = document.getElementById('function-input');
        if (input) {
            input.addEventListener('input', (e) => this.handleInput(e.target.value));
        }
    },

    handleInput(expression) {
        this.currentExpression = expression.trim();
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.validateAndNotify();
        }, this.DEBOUNCE_MS);
    },

    validateAndNotify() {
        const result = this.validate(this.currentExpression);
        this.isValid = result.isValid;
        this.error = result.error;
        this.compiledExpr = result.compiledExpr;

        if (this.onExpressionChange) {
            this.onExpressionChange({
                expression: this.currentExpression,
                isValid: this.isValid,
                error: this.error,
                evaluateFn: result.evaluateFn
            });
        }
    },

    validate(expression) {
        if (!expression || expression.length === 0) {
            return { isValid: false, error: null, compiledExpr: null, evaluateFn: null };
        }

        try {
            const node = math.parse(expression);
            const compiled = node.compile();
            
            const evaluateFn = (x) => {
                const scope = { x: x };
                const result = compiled.evaluate(scope);
                if (typeof result !== 'number' || !isFinite(result)) {
                    return NaN;
                }
                return result;
            };

            evaluateFn(0);
            evaluateFn(1);
            evaluateFn(-1);

            return { 
                isValid: true, 
                error: null, 
                compiledExpr: compiled, 
                evaluateFn: evaluateFn 
            };
        } catch (e) {
            const error = this.classifyError(e);
            return { isValid: false, error: error, compiledExpr: null, evaluateFn: null };
        }
    },

    classifyError(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('syntax') || message.includes('unexpected') || message.includes('parse')) {
            return '構文エラー: 数式の書き方が正しくありません';
        }
        
        if (message.includes('undefined') || message.includes('not defined') || message.includes('unknown')) {
            return '未定義の関数または変数が含まれています';
        }
        
        if (message.includes('domain') || message.includes('invalid')) {
            return '定義域エラー: この値では計算できません';
        }

        return `エラー: ${error.message}`;
    },

    setError(error) {
        this.error = error;
        this.isValid = false;
    },

    clearError() {
        this.error = null;
    },

    getEvaluateFn() {
        if (this.isValid && this.compiledExpr) {
            return (x) => {
                try {
                    const result = this.compiledExpr.evaluate({ x: x });
                    if (typeof result !== 'number' || !isFinite(result)) {
                        return NaN;
                    }
                    return result;
                } catch {
                    return NaN;
                }
            };
        }
        return null;
    },

    testSupportedFunctions() {
        const testCases = [
            { expr: 'sin(x)', testValues: [0, Math.PI/2, Math.PI] },
            { expr: 'cos(x)', testValues: [0, Math.PI/2, Math.PI] },
            { expr: 'tan(x)', testValues: [0, Math.PI/4] },
            { expr: 'log(x)', testValues: [1, 10, Math.E] },
            { expr: 'exp(x)', testValues: [0, 1, -1] },
            { expr: 'sqrt(x)', testValues: [0, 1, 4, 9] },
            { expr: 'abs(x)', testValues: [-5, 0, 5] }
        ];

        const results = [];
        
        for (const testCase of testCases) {
            const result = this.validate(testCase.expr);
            if (result.isValid && result.evaluateFn) {
                const evaluations = testCase.testValues.map(x => ({
                    x: x,
                    fx: result.evaluateFn(x)
                }));
                results.push({
                    expression: testCase.expr,
                    success: true,
                    evaluations: evaluations
                });
            } else {
                results.push({
                    expression: testCase.expr,
                    success: false,
                    error: result.error
                });
            }
        }

        return results;
    }
};
