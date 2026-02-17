class AppOrchestrator {
    constructor() {
        this.inputController = null;
        this.graphRenderer = null;
        this.derivativeCalculator = null;
        this.tooltipManager = null;
        this.tangentRenderer = null;
        this.resizeObserver = null;
        this.state = {
            expression: 'x^2',
            showDerivative: false,
            showTangent: false
        };
    }

    init() {
        this.cacheDOM();
        this.setupResizeObserver();
        this.bindEvents();
    }

    cacheDOM() {
        this.dom = {
            functionInput: document.getElementById('function-input'),
            errorMessage: document.getElementById('error-message'),
            showDerivative: document.getElementById('show-derivative'),
            showTangent: document.getElementById('show-tangent'),
            graphContainer: document.getElementById('graph-container'),
            tooltip: document.getElementById('tooltip'),
            tooltipX: document.getElementById('tooltip-x'),
            tooltipFx: document.getElementById('tooltip-fx'),
            tooltipDfx: document.getElementById('tooltip-dfx'),
            presetButtons: document.querySelectorAll('.preset-btn')
        };
    }

    setupResizeObserver() {
        if (typeof ResizeObserver === 'undefined') {
            return;
        }
        this.resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (this.graphRenderer && typeof this.graphRenderer.resize === 'function') {
                    this.graphRenderer.resize();
                }
            }
        });
        if (this.dom.graphContainer) {
            this.resizeObserver.observe(this.dom.graphContainer);
        }
    }

    bindEvents() {
        if (this.dom.functionInput) {
            this.dom.functionInput.addEventListener('input', (e) => {
                this.handleInputChange(e.target.value);
            });
        }
        if (this.dom.showDerivative) {
            this.dom.showDerivative.addEventListener('change', (e) => {
                this.state.showDerivative = e.target.checked;
                this.handleDerivativeToggle();
            });
        }
        if (this.dom.showTangent) {
            this.dom.showTangent.addEventListener('change', (e) => {
                this.state.showTangent = e.target.checked;
                this.handleTangentToggle();
            });
        }
        this.dom.presetButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const formula = e.target.dataset.formula;
                this.handlePresetClick(formula);
            });
        });
        if (this.dom.graphContainer) {
            this.dom.graphContainer.addEventListener('mousemove', (e) => {
                this.handleMouseMove(e);
            });
            this.dom.graphContainer.addEventListener('mouseleave', () => {
                this.handleMouseLeave();
            });
        }
    }

    handleInputChange(value) {
        this.state.expression = value;
        if (this.inputController) {
            const result = this.inputController.parseAndValidate(value);
            if (result.isValid) {
                this.hideError();
                this.updateGraph();
            } else {
                this.showError(result.error);
            }
        }
    }

    handleDerivativeToggle() {
        this.updateGraph();
    }

    handleTangentToggle() {
        if (!this.state.showTangent && this.tangentRenderer) {
            this.tangentRenderer.clear();
        }
    }

    handlePresetClick(formula) {
        if (this.dom.functionInput) {
            this.dom.functionInput.value = formula;
        }
        this.state.expression = formula;
        this.hideError();
        this.updateGraph();
    }

    handleMouseMove(e) {
        if (this.tooltipManager) {
            this.tooltipManager.update(e);
        }
    }

    handleMouseLeave() {
        if (this.tooltipManager) {
            this.tooltipManager.hide();
        }
        if (this.tangentRenderer) {
            this.tangentRenderer.clear();
        }
    }

    showError(message) {
        if (this.dom.errorMessage) {
            this.dom.errorMessage.textContent = message;
            this.dom.errorMessage.classList.add('visible');
        }
    }

    hideError() {
        if (this.dom.errorMessage) {
            this.dom.errorMessage.textContent = '';
            this.dom.errorMessage.classList.remove('visible');
        }
    }

    updateGraph() {
        if (this.graphRenderer) {
            this.graphRenderer.render(this.state.expression, {
                showDerivative: this.state.showDerivative
            });
        }
        if (this.state.showDerivative && this.derivativeCalculator) {
            this.derivativeCalculator.setRange(
                this.graphRenderer ? this.graphRenderer.options.domain.x : [-10, 10]
            );
        }
    }

    setInputController(controller) {
        this.inputController = controller;
    }

    setGraphRenderer(renderer) {
        this.graphRenderer = renderer;
    }

    setDerivativeCalculator(calculator) {
        this.derivativeCalculator = calculator;
    }

    setTooltipManager(manager) {
        this.tooltipManager = manager;
    }

    setTangentRenderer(renderer) {
        this.tangentRenderer = renderer;
    }
}

const app = new AppOrchestrator();

document.addEventListener('DOMContentLoaded', () => {
    app.init();
    
    app.setGraphRenderer(graphRenderer);
    app.setDerivativeCalculator(derivativeCalculator);
    graphRenderer.setDerivativeCalculator(derivativeCalculator);
    
    if (typeof inputController !== 'undefined') {
        app.setInputController(inputController);
    }
    
    app.updateGraph();
});
