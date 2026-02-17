import type { GraphState } from '@/models'

export class GraphService {
  private instance: any = null
  private container: HTMLElement | null = null

  setContainer(container: HTMLElement): void {
    this.container = container
  }

  initialize(_state: GraphState): void {
    if (!this.container) {
      console.error('Graph container not set')
      return
    }

    this.container.innerHTML = ''
  }

  updateDomain(_domain: GraphState['domain']): void {
    if (this.instance) {
      this.instance = null
    }
  }

  renderFunction(expression: string, color: string = '#2563eb'): void {
    console.log(`Rendering function: ${expression} with color ${color}`)
  }

  renderDerivative(expression: string, color: string = '#7c3aed'): void {
    console.log(`Rendering derivative: ${expression} with color ${color}`)
  }

  clearGraph(): void {
    if (this.container) {
      this.container.innerHTML = ''
    }
    this.instance = null
  }

  setGridVisibility(visible: boolean): void {
    console.log(`Grid visibility: ${visible}`)
  }

  setAxisLabelsVisibility(visible: boolean): void {
    console.log(`Axis labels visibility: ${visible}`)
  }

  destroy(): void {
    this.clearGraph()
    this.container = null
  }
}
