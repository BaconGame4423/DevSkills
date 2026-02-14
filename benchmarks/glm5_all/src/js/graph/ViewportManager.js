export class ViewportManager {
  constructor(graphRenderer) {
    this.renderer = graphRenderer;
    this.defaultXDomain = [-10, 10];
    this.defaultYDomain = [-10, 10];
  }

  autoScale(fn, derivativeFn = null) {
    const xMin = this.defaultXDomain[0];
    const xMax = this.defaultXDomain[1];
    const sampleCount = 200;
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
        if (isFinite(y) && !isNaN(y) && Math.abs(y) < 1000) {
          yMin = Math.min(yMin, y);
          yMax = Math.max(yMax, y);
        }
      } catch (e) {
        // Skip
      }
    }
    
    if (derivativeFn) {
      let compiledDf;
      try {
        compiledDf = math.parse(derivativeFn).compile();
      } catch (e) {
        // Skip derivative
      }
      
      if (compiledDf) {
        for (let x = xMin; x <= xMax; x += step) {
          try {
            const y = compiledDf.evaluate({ x });
            if (isFinite(y) && !isNaN(y) && Math.abs(y) < 1000) {
              yMin = Math.min(yMin, y);
              yMax = Math.max(yMax, y);
            }
          } catch (e) {
            // Skip
          }
        }
      }
    }
    
    if (yMin !== Infinity && yMax !== -Infinity) {
      const padding = (yMax - yMin) * 0.15 || 1;
      yMin = yMin - padding;
      yMax = yMax + padding;
      
      // Clamp to reasonable bounds
      yMin = Math.max(yMin, -100);
      yMax = Math.min(yMax, 100);
      
      this.renderer.setViewport(this.defaultXDomain, [yMin, yMax]);
    }
  }

  reset() {
    this.renderer.setViewport(this.defaultXDomain, this.defaultYDomain);
  }

  setXDomain(domain) {
    this.defaultXDomain = domain;
  }

  setYDomain(domain) {
    this.defaultYDomain = domain;
  }
}
