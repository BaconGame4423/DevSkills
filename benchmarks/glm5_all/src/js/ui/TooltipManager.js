export class TooltipManager {
  constructor(tooltipElement, options = {}) {
    this.tooltip = tooltipElement;
    this.container = options.container || document.querySelector('.graph-section');
    
    this.xDisplay = document.getElementById('tooltip-x');
    this.fxDisplay = document.getElementById('tooltip-fx');
    this.dfxDisplay = document.getElementById('tooltip-dfx');
    
    this.evaluateFn = null;
    this.evaluateDf = null;
    this.showDerivative = false;
  }

  setFunctions(fn, dfn = null) {
    this.evaluateFn = fn;
    this.evaluateDf = dfn;
  }

  setDerivativeVisible(visible) {
    this.showDerivative = visible;
    if (!visible && this.dfxDisplay) {
      this.dfxDisplay.textContent = '-';
    }
  }

  update(x, clientX, clientY) {
    if (!this.evaluateFn) {
      this.hide();
      return;
    }
    
    const fx = this.evaluateFn(x);
    const dfx = this.evaluateDf && this.showDerivative ? this.evaluateDf(x) : null;
    
    if (isNaN(fx) || !isFinite(fx)) {
      this.hide();
      return;
    }
    
    if (this.xDisplay) {
      this.xDisplay.textContent = x.toFixed(3);
    }
    if (this.fxDisplay) {
      this.fxDisplay.textContent = fx.toFixed(3);
    }
    if (this.dfxDisplay) {
      this.dfxDisplay.textContent = (dfx !== null && !isNaN(dfx) && isFinite(dfx)) 
        ? dfx.toFixed(3) 
        : '-';
    }
    
    this.show(clientX, clientY);
  }

  show(x, y) {
    const rect = this.container.getBoundingClientRect();
    
    let left = x - rect.left + 15;
    let top = y - rect.top - 10;
    
    // Keep tooltip in bounds
    if (left + 120 > rect.width) {
      left = x - rect.left - 130;
    }
    if (top < 10) {
      top = 10;
    }
    
    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
    this.tooltip.classList.add('visible');
  }

  hide() {
    this.tooltip.classList.remove('visible');
  }
}
