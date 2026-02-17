import { parseExpression, numericalDerivative, evaluateAt } from './math-engine.js';
import { initGraph, updateGraph, setTooltipCallback, updateTooltipDisplay, handleResize } from './graph-renderer.js';

const DEBOUNCE_DELAY = 300;

const state = {
    expression: '',
    fn: null,
    derivativeFn: null,
    showDerivative: false,
    showTangent: false,
    cursorX: null,
    error: null,
    isValid: false
};

let chart = null;
let debounceTimer = null;

function debounce(func, delay) {
    return function(...args) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(this, args), delay);
    };
}

function initialize() {
    const functionInput = document.getElementById('function-input');
    const showDerivativeCheckbox = document.getElementById('show-derivative');
    const showTangentCheckbox = document.getElementById('show-tangent');
    const errorDisplay = document.getElementById('error-display');
    
    chart = initGraph('graph-canvas');
    
    if (!chart) {
        console.error('Failed to initialize chart');
        return;
    }
    
    setTooltipCallback(handleCursorMove);
    
    functionInput.addEventListener('input', debounce(handleInputChange, DEBOUNCE_DELAY));
    functionInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(debounceTimer);
            handleInputChange();
        }
    });
    
    showDerivativeCheckbox.addEventListener('change', (e) => {
        state.showDerivative = e.target.checked;
        renderGraph();
    });
    
    showTangentCheckbox.addEventListener('change', (e) => {
        state.showTangent = e.target.checked;
        renderGraph();
    });
    
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const expr = btn.getAttribute('data-expr');
            functionInput.value = expr;
            clearTimeout(debounceTimer);
            handleInputChange();
        });
    });
    
    window.addEventListener('resize', debounce(() => {
        handleResize(chart);
    }, 100));
    
    functionInput.value = 'sin(x)';
    handleInputChange();
}

function handleInputChange() {
    const functionInput = document.getElementById('function-input');
    const errorDisplay = document.getElementById('error-display');
    const expr = functionInput.value.trim();
    
    state.expression = expr;
    
    if (!expr) {
        state.error = '数式を入力してください';
        state.isValid = false;
        state.fn = null;
        state.derivativeFn = null;
        showError(state.error);
        clearGraph();
        return;
    }
    
    const result = parseExpression(expr);
    
    if (result.valid) {
        state.fn = result.fn;
        state.derivativeFn = (x) => numericalDerivative(state.fn, x);
        state.error = null;
        state.isValid = true;
        hideError();
        renderGraph();
    } else {
        state.fn = null;
        state.derivativeFn = null;
        state.error = result.error;
        state.isValid = false;
        showError(result.error);
        clearGraph();
    }
}

function renderGraph() {
    if (!chart) return;
    
    updateGraph(chart, {
        fn: state.fn,
        derivativeFn: state.derivativeFn,
        showDerivative: state.showDerivative && state.isValid,
        showTangent: state.showTangent && state.isValid,
        cursorX: state.cursorX
    });
}

function clearGraph() {
    if (!chart) return;
    
    chart.data.datasets = [];
    chart.update('none');
    
    updateTooltipDisplay(0, NaN, NaN);
}

function showError(message) {
    const errorDisplay = document.getElementById('error-display');
    errorDisplay.textContent = message;
    errorDisplay.classList.add('visible');
}

function hideError() {
    const errorDisplay = document.getElementById('error-display');
    errorDisplay.textContent = '';
    errorDisplay.classList.remove('visible');
}

function handleCursorMove(x) {
    state.cursorX = x;
    
    if (state.fn && state.isValid) {
        const fx = evaluateAt(state.fn, x);
        const dfx = state.derivativeFn ? state.derivativeFn(x) : NaN;
        updateTooltipDisplay(x, fx, dfx);
        
        if (state.showTangent) {
            renderGraph();
        }
    }
}

document.addEventListener('DOMContentLoaded', initialize);
