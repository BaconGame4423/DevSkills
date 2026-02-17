const AppOrchestrator = {
    inputController: null,
    graphRenderer: null,
    resizeObserver: null,

    init() {
        this.graphRenderer = Object.create(GraphRenderer);
        this.graphRenderer.init({ containerId: 'graph-container' });

        this.inputController = Object.create(InputController);
        this.inputController.init({
            onExpressionChange: (data) => this.handleExpressionChange(data)
        });

        this.setupResizeObserver();
        
        const input = document.getElementById('function-input');
        if (input) {
            input.value = 'x^2';
            this.inputController.handleInput('x^2');
        }
    },

    handleExpressionChange(data) {
        this.updateErrorDisplay(data.error);

        if (data.isValid && data.evaluateFn) {
            this.graphRenderer.render(data.expression, data.evaluateFn);
        } else if (!data.expression) {
            this.graphRenderer.clear();
        }
    },

    updateErrorDisplay(error) {
        const errorDisplay = document.getElementById('error-display');
        if (errorDisplay) {
            if (error) {
                errorDisplay.textContent = error;
                errorDisplay.style.display = 'block';
            } else {
                errorDisplay.textContent = '';
                errorDisplay.style.display = 'none';
            }
        }
    },

    setupResizeObserver() {
        const graphContainer = document.getElementById('graph-container');
        if (!graphContainer) return;

        this.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                    this.graphRenderer.resize();
                }
            }
        });

        this.resizeObserver.observe(graphContainer);
    },

    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AppOrchestrator.init();
});
