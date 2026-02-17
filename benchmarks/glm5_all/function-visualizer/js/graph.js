class GraphRenderer {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.instance = null;
        this.options = {
            width: options.width || 800,
            height: options.height || 400,
            domain: options.domain || { x: [-10, 10], y: [-10, 10] },
            grid: options.grid !== false,
            xAxisLabel: options.xAxisLabel || 'x',
            yAxisLabel: options.yAxisLabel || 'y'
        };
        this.currentExpression = '';
        this.showDerivative = false;
        this.derivativeData = null;
    }

    render(expression, options = {}) {
        if (!this.container) {
            console.error('Graph container not found');
            return;
        }

        this.currentExpression = expression;
        this.showDerivative = options.showDerivative || false;
        this.derivativeData = options.derivativeData || null;

        const series = this.buildSeries(expression);

        const plotOptions = {
            target: '#' + this.containerId,
            width: this.container.offsetWidth || this.options.width,
            height: this.options.height,
            xAxis: {
                domain: this.options.domain.x,
                label: this.options.xAxisLabel
            },
            yAxis: {
                domain: this.options.domain.y,
                label: this.options.yAxisLabel
            },
            grid: this.options.grid,
            data: series
        };

        try {
            if (this.instance) {
                this.container.innerHTML = '';
            }
            this.instance = functionPlot(plotOptions);
        } catch (e) {
            console.error('Graph rendering error:', e);
        }
    }

    buildSeries(expression) {
        const series = [];

        if (expression) {
            series.push({
                fn: (scope) => {
                    try {
                        const compiled = math.compile(expression);
                        const result = compiled.evaluate(scope);
                        return typeof result === 'number' && isFinite(result) ? result : NaN;
                    } catch (e) {
                        return NaN;
                    }
                },
                graphType: 'polyline',
                color: '#2563eb',
                attr: {
                    'stroke-width': 2
                }
            });
        }

        if (this.showDerivative && this.derivativeData) {
            series.push({
                points: this.derivativeData,
                fnType: 'points',
                graphType: 'polyline',
                color: '#7c3aed',
                attr: {
                    'stroke-width': 2
                }
            });
        }

        return series;
    }

    generateEvaluateFn(expression) {
        if (!expression) return null;
        
        try {
            const compiled = math.compile(expression);
            return (x) => {
                try {
                    const result = compiled.evaluate({ x });
                    return typeof result === 'number' && isFinite(result) ? result : NaN;
                } catch (e) {
                    return NaN;
                }
            };
        } catch (e) {
            return null;
        }
    }

    resize() {
        if (!this.container || !this.currentExpression) return;
        
        this.render(this.currentExpression, {
            showDerivative: this.showDerivative,
            derivativeData: this.derivativeData
        });
    }

    setDomain(xDomain, yDomain) {
        if (xDomain) {
            this.options.domain.x = xDomain;
        }
        if (yDomain) {
            this.options.domain.y = yDomain;
        }
        
        if (this.currentExpression) {
            this.render(this.currentExpression, {
                showDerivative: this.showDerivative,
                derivativeData: this.derivativeData
            });
        }
    }

    autoScale(yValues) {
        if (!yValues || yValues.length === 0) return;

        const validValues = yValues.filter(v => typeof v === 'number' && isFinite(v));
        if (validValues.length === 0) return;

        const minY = Math.min(...validValues);
        const maxY = Math.max(...validValues);
        const padding = Math.max(Math.abs(maxY - minY) * 0.1, 1);

        this.options.domain.y = [minY - padding, maxY + padding];
    }

    getInstance() {
        return this.instance;
    }

    getContainer() {
        return this.container;
    }
}

const graphRenderer = new GraphRenderer('graph-container');
