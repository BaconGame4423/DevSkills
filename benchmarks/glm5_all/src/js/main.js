import { create, all } from 'mathjs';
import { InputHandler } from './input/InputHandler.js';
import { PresetButtons } from './input/PresetButtons.js';
import { GraphRenderer } from './graph/GraphRenderer.js';
import { ViewportManager } from './graph/ViewportManager.js';
import { ExpressionParser } from './calculus/ExpressionParser.js';
import { DerivativeCalculator } from './calculus/DerivativeCalculator.js';
import { TangentLine } from './calculus/TangentLine.js';
import { TooltipManager } from './ui/TooltipManager.js';
import { ErrorHandler } from './ui/ErrorHandler.js';

window.math = create(all);

class FunctionVisualizerApp {
  constructor() {
    this.expressionParser = new ExpressionParser();
    this.derivativeCalculator = new DerivativeCalculator();
    this.tangentLine = new TangentLine();
    this.errorHandler = new ErrorHandler(document.getElementById('error-display'));
    
    this.graphRenderer = new GraphRenderer('graph-container');
    this.viewportManager = new ViewportManager(this.graphRenderer);
    
    this.tooltipManager = new TooltipManager(
      document.getElementById('tooltip'),
      { container: document.querySelector('.graph-section') }
    );
    
    this.inputHandler = new InputHandler(
      document.getElementById('function-input'),
      { debounceDelay: 300 }
    );
    
    this.presetButtons = new PresetButtons('.preset-buttons', this.inputHandler);
    
    this.currentExpression = null;
    this.currentDerivative = null;
    this.showDerivative = false;
    this.showTangent = false;
    
    this.setupEventListeners();
    this.setupControls();
    this.setDefaultExpression();
  }

  setupEventListeners() {
    this.inputHandler.onChange((value) => {
      this.handleExpressionChange(value);
    });

    const graphContainer = document.getElementById('graph-container');
    if (graphContainer) {
      graphContainer.addEventListener('mousemove', (e) => {
        if (this.currentExpression) {
          this.handleGraphHover(e);
        }
      });
      
      graphContainer.addEventListener('mouseleave', () => {
        this.tooltipManager.hide();
      });
    }

    window.addEventListener('resize', () => {
      this.graphRenderer.resize();
      if (this.currentExpression) {
        this.renderGraph();
      }
    });
  }

  setupControls() {
    const derivativeCheckbox = document.getElementById('show-derivative');
    const tangentCheckbox = document.getElementById('show-tangent');

    if (derivativeCheckbox) {
      derivativeCheckbox.addEventListener('change', (e) => {
        this.showDerivative = e.target.checked;
        this.graphRenderer.setDerivativeVisible(this.showDerivative);
        this.tooltipManager.setDerivativeVisible(this.showDerivative);
        if (this.currentExpression) {
          this.renderGraph();
        }
      });
    }

    if (tangentCheckbox) {
      tangentCheckbox.addEventListener('change', (e) => {
        this.showTangent = e.target.checked;
        this.graphRenderer.setTangentVisible(this.showTangent);
        this.tangentLine.setEnabled(this.showTangent);
        if (this.currentExpression) {
          this.renderGraph();
        }
      });
    }
  }

  setDefaultExpression() {
    const defaultExpr = 'sin(x)';
    const input = document.getElementById('function-input');
    if (input) {
      input.value = defaultExpr;
      this.handleExpressionChange(defaultExpr);
    }
  }

  handleExpressionChange(value) {
    this.errorHandler.clear();

    if (!value) {
      this.currentExpression = null;
      this.currentDerivative = null;
      return;
    }

    try {
      const parsed = this.expressionParser.parse(value);
      this.currentExpression = value;

      this.currentDerivative = this.derivativeCalculator.calculate(value);
      
      this.viewportManager.autoScale(
        this.currentExpression,
        this.currentDerivative?.expression
      );

      this.tooltipManager.setFunctions(
        parsed.fn,
        this.currentDerivative?.fn
      );

      this.renderGraph();
    } catch (error) {
      this.errorHandler.show(error.message);
      this.currentExpression = null;
      this.currentDerivative = null;
    }
  }

  handleGraphHover(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 20 - 10; // Map to [-10, 10]
    
    this.tooltipManager.update(x, e.clientX, e.clientY);
    
    if (this.showTangent) {
      this.tangentLine.setX(x);
      this.graphRenderer.setTangentX(x);
    }
  }

  renderGraph() {
    if (!this.currentExpression) {
      return;
    }

    const derivativeExpr = this.showDerivative && this.currentDerivative 
      ? this.currentDerivative.expression 
      : null;

    this.graphRenderer.setDerivativeVisible(this.showDerivative);
    this.graphRenderer.setTangentVisible(this.showTangent);
    
    this.graphRenderer.render(
      this.currentExpression,
      derivativeExpr
    );
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new FunctionVisualizerApp();
});
