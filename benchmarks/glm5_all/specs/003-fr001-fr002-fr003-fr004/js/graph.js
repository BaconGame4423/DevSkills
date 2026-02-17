const GraphRenderer = {
    containerId: 'graph-container',
    instance: null,
    currentExpression: '',
    evaluateFn: null,
    defaultDomain: [-10, 10],
    defaultRange: [-10, 10],

    init(options = {}) {
        if (options.containerId) {
            this.containerId = options.containerId;
        }
    },

    render(expression, evaluateFn) {
        this.currentExpression = expression;
        this.evaluateFn = evaluateFn;

        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error('Graph container not found');
            return;
        }

        try {
            const config = {
                target: `#${this.containerId}`,
                width: container.clientWidth,
                height: container.clientHeight || 500,
                xAxis: {
                    domain: this.defaultDomain,
                    label: 'x'
                },
                yAxis: {
                    domain: this.defaultRange,
                    label: 'y'
                },
                grid: true,
                data: [{
                    fn: (scope) => evaluateFn(scope.x),
                    color: '#2563eb',
                    graphType: 'polyline'
                }]
            };

            if (this.instance) {
                container.innerHTML = '';
            }

            this.instance = functionPlot(config);
        } catch (e) {
            console.error('Graph render error:', e);
        }
    },

    update(evaluateFn) {
        this.evaluateFn = evaluateFn;
        if (this.instance) {
            this.render(this.currentExpression, evaluateFn);
        }
    },

    clear() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.innerHTML = '';
        }
        this.instance = null;
        this.currentExpression = '';
        this.evaluateFn = null;
    },

    resize() {
        if (this.evaluateFn && this.currentExpression) {
            this.render(this.currentExpression, this.evaluateFn);
        }
    },

    getGraphInstance() {
        return this.instance;
    },

    setDomain(xMin, xMax) {
        this.defaultDomain = [xMin, xMax];
    },

    setRange(yMin, yMax) {
        this.defaultRange = [yMin, yMax];
    }
};
