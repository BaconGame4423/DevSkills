import functionPlot from 'function-plot';

export class GraphRenderer {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.options = {
      width: options.width || this.container?.offsetWidth || 800,
      height: options.height || options.height || 500,
      xDomain: options.xDomain || [-10, 10],
      yDomain: options.yDomain || [-10, 10],
      ...options
    };
    
    this.currentPlot = null;
    this.mainFunction = null;
    this.derivativeFunction = null;
    this.showDerivative = false;
    this.showTangent = false;
    this.tangentX = null;
    this.hoverCallbacks = [];
  }

  render(mainExpr, derivativeExpr = null, options = {}) {
    this.mainFunction = mainExpr;
    this.derivativeFunction = derivativeExpr;
    
    const graphs = [];
    
    if (mainExpr) {
      graphs.push({
        fn: mainExpr,
        color: '#2563eb',
        graphType: 'polyline',
        attr: { 'stroke-width': 2 }
      });
    }
    
    if (derivativeExpr && this.showDerivative) {
      graphs.push({
        fn: derivativeExpr,
        color: '#dc2626',
        graphType: 'polyline',
        attr: { 'stroke-width': 2, 'stroke-dasharray': '5,5' }
      });
    }
    
    if (this.showTangent && this.tangentX !== null && mainExpr && derivativeExpr) {
      const tangentLine = this.calculateTangentLine(mainExpr, derivativeExpr, this.tangentX);
      if (tangentLine) {
        graphs.push({
          fn: tangentLine,
          color: '#16a34a',
          graphType: 'polyline',
          attr: { 'stroke-width': 2 },
          range: [this.tangentX - 3, this.tangentX + 3]
        });
      }
    }
    
    try {
      this.currentPlot = functionPlot({
        target: `#${this.containerId}`,
        width: this.options.width,
        height: this.options.height,
        xAxis: { 
          domain: this.options.xDomain,
          label: 'x'
        },
        yAxis: { 
          domain: this.options.yDomain,
          label: 'y'
        },
        grid: true,
        data: graphs,
        plugins: [this.createHoverPlugin()]
      });
    } catch (e) {
      console.error('Graph rendering error:', e);
    }
  }

  createHoverPlugin() {
    const self = this;
    return {
      name: 'hover',
      onMouseMove: (e) => {
        if (self.currentPlot) {
          const x = e?.x;
          if (x !== undefined && !isNaN(x)) {
            self.tangentX = x;
            for (const callback of self.hoverCallbacks) {
              callback(x);
            }
          }
        }
      }
    };
  }

  calculateTangentLine(fExpr, dfExpr, x0) {
    try {
      const math = window.math;
      const fNode = math.parse(fExpr).compile();
      const dfNode = math.parse(dfExpr).compile();
      
      const y0 = fNode.evaluate({ x: x0 });
      const slope = dfNode.evaluate({ x: x0 });
      
      if (isNaN(y0) || isNaN(slope) || !isFinite(y0) || !isFinite(slope)) {
        return null;
      }
      
      return `${slope} * (x - ${x0}) + ${y0}`;
    } catch (e) {
      return null;
    }
  }

  onHover(callback) {
    this.hoverCallbacks.push(callback);
  }

  setDerivativeVisible(visible) {
    this.showDerivative = visible;
  }

  setTangentVisible(visible) {
    this.showTangent = visible;
  }

  setTangentX(x) {
    this.tangentX = x;
  }

  setViewport(xDomain, yDomain) {
    this.options.xDomain = xDomain;
    this.options.yDomain = yDomain;
  }

  autoScale(fn, sampleCount = 100) {
    const xMin = this.options.xDomain[0];
    const xMax = this.options.xDomain[1];
    const step = (xMax - xMin) / sampleCount;
    
    let yMin = Infinity;
    let yMax = -Infinity;
    
    const math = window.math;
    let compiledFn;
    try {
      compiledFn = math.parse(fn).compile();
    } catch (e) {
      return;
    }
    
    for (let x = xMin; x <= xMax; x += step) {
      try {
        const y = compiledFn.evaluate({ x });
        if (isFinite(y) && !isNaN(y)) {
          yMin = Math.min(yMin, y);
          yMax = Math.max(yMax, y);
        }
      } catch (e) {
        // Skip undefined points
      }
    }
    
    if (yMin !== Infinity && yMax !== -Infinity) {
      const padding = (yMax - yMin) * 0.1 || 1;
      this.options.yDomain = [yMin - padding, yMax + padding];
    }
  }

  resize() {
    if (this.container) {
      this.options.width = this.container.offsetWidth;
      this.options.height = this.container.offsetHeight || 500;
    }
  }
}
