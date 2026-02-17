import './styles/main.css'
import { appState } from '@/services/AppState'
import { GraphCanvas } from '@/components/GraphCanvas'
import { FunctionInput } from '@/components/FunctionInput'
import { PresetButtons } from '@/components/PresetButtons'
import { DerivativeToggle } from '@/components/DerivativeToggle'
import { TooltipOverlay } from '@/components/TooltipOverlay'
import { FunctionList } from '@/components/FunctionList'
import { Legend } from '@/components/Legend'
import { DerivativeService } from '@/services/DerivativeService'

class App {
  private graphCanvas: GraphCanvas
  private functionInput: FunctionInput
  private presetButtons: PresetButtons
  private derivativeToggle: DerivativeToggle
  private tooltipOverlay: TooltipOverlay
  private functionList: FunctionList
  private legend: Legend

  constructor() {
    const appDiv = document.getElementById('app')
    if (!appDiv) {
      throw new Error('App container not found')
    }

    appDiv.innerHTML = `
      <div class="app-container">
        <div class="controls-panel">
          <h2>関数ビジュアライザー</h2>
          <div id="input-container"></div>
          <div id="preset-container"></div>
          <div id="derivative-toggle-container"></div>
          <div id="tangent-container"></div>
          <div id="function-list-container"></div>
          <div id="legend-container"></div>
        </div>
        <div class="graph-container">
          <div id="graph-canvas"></div>
        </div>
      </div>
    `

    this.graphCanvas = new GraphCanvas('graph-canvas')
    this.functionInput = new FunctionInput('input-container')
    this.presetButtons = new PresetButtons('preset-container')
    this.derivativeToggle = new DerivativeToggle('derivative-toggle-container')
    this.tooltipOverlay = new TooltipOverlay('graph-canvas')
    this.functionList = new FunctionList('function-list-container')
    this.legend = new Legend('legend-container')

    this.subscribeToState()
  }

  private subscribeToState(): void {
    appState.onExpressionChange.subscribe((expression) => {
      if (expression.isValid) {
        this.graphCanvas.renderFunction(expression.normalized)

        const derivative = DerivativeService.calculate(expression.id, expression.normalized)
        appState.setDerivative(derivative)

        if (derivative.isValid) {
          this.graphCanvas.renderDerivative(derivative.expression)
        }
      }
    })

    appState.onGraphStateChange.subscribe((state) => {
      this.graphCanvas.updateState(state)
    })
  }

  destroy(): void {
    this.graphCanvas.destroy()
    this.functionInput.destroy()
    this.presetButtons.destroy()
    this.derivativeToggle.destroy()
    this.tooltipOverlay.destroy()
    this.functionList.destroy()
    this.legend.destroy()
  }
}

export const app = new App()

console.log('Function Visualizer initialized')
