import type { GraphState } from '@/models'
import { GraphService } from '@/services/GraphService'

export class GraphCanvas {
  private container: HTMLElement
  private graphService: GraphService
  private currentState: GraphState

  constructor(containerId: string) {
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`)
    }
    this.container = container
    this.graphService = new GraphService()
    this.currentState = {
      domain: { x: [-10, 10], y: [-10, 10] },
      showGrid: true,
      showAxisLabels: true,
      showDerivative: false,
      tangentLine: null,
      zoomLevel: 1,
    }

    this.initialize()
  }

  private initialize(): void {
    this.container.style.height = '400px'
    this.container.style.width = '100%'
    this.container.style.position = 'relative'
    this.container.style.backgroundColor = '#ffffff'
    this.container.style.border = '1px solid #d1d5db'
    this.container.style.borderRadius = '8px'
    this.container.style.overflow = 'hidden'

    this.graphService.setContainer(this.container)
    this.graphService.initialize(this.currentState)
  }

  renderFunction(expression: string, color?: string): void {
    this.graphService.renderFunction(expression, color)
  }

  renderDerivative(expression: string, color?: string): void {
    if (this.currentState.showDerivative) {
      this.graphService.renderDerivative(expression, color)
    }
  }

  updateState(state: Partial<GraphState>): void {
    this.currentState = { ...this.currentState, ...state }

    if (state.domain) {
      this.graphService.updateDomain(state.domain)
    }
    if (state.showGrid !== undefined) {
      this.graphService.setGridVisibility(state.showGrid)
    }
    if (state.showAxisLabels !== undefined) {
      this.graphService.setAxisLabelsVisibility(state.showAxisLabels)
    }
  }

  clear(): void {
    this.graphService.clearGraph()
  }

  destroy(): void {
    this.graphService.destroy()
  }
}
