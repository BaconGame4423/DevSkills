const ERROR_MESSAGES = {
    'Undefined symbol': '未定義の変数または関数です',
    'Unexpected end of expression': '数式が不完全です',
    'Unexpected part': '数式にエラーがあります',
    'Value expected': '値が必要です',
    'Parenthesis ) expected': '閉じ括弧 ) が必要です',
    'Parenthesis ( expected': '開き括弧 ( が必要です',
    'Operator expected': '演算子が必要です',
    'Cannot convert': '変換できません',
    'Invalid number of arguments': '引数の数が正しくありません',
};

function translateError(error) {
    for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
        if (error.includes(key)) {
            return value;
        }
    }
    return `数式エラー: ${error}`;
}

export function parseExpression(expr) {
    if (!expr || expr.trim() === '') {
        return { valid: false, fn: null, error: '数式を入力してください' };
    }

    try {
        const node = math.parse(expr);
        const compiled = node.compile();
        
        const fn = (x) => {
            try {
                const result = compiled.evaluate({ x: x });
                if (typeof result !== 'number' || !isFinite(result)) {
                    return NaN;
                }
                return result;
            } catch (e) {
                return NaN;
            }
        };

        fn(-1);
        fn(0);
        fn(1);
        
        return { valid: true, fn: fn, error: null };
    } catch (e) {
        const errorMessage = e.message || String(e);
        return { valid: false, fn: null, error: translateError(errorMessage) };
    }
}

export function numericalDerivative(fn, x, h = 1e-5) {
    if (typeof fn !== 'function') {
        return NaN;
    }
    
    const fxPlusH = fn(x + h);
    const fxMinusH = fn(x - h);
    
    if (isNaN(fxPlusH) || isNaN(fxMinusH)) {
        return NaN;
    }
    
    return (fxPlusH - fxMinusH) / (2 * h);
}

export function evaluateAt(fn, x) {
    if (typeof fn !== 'function') {
        return NaN;
    }
    return fn(x);
}

export function clampValue(value, min = -100, max = 100) {
    if (isNaN(value) || !isFinite(value)) {
        return NaN;
    }
    return Math.max(min, Math.min(max, value));
}
