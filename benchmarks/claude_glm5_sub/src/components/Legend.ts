import type { FunctionExpression } from '@/models'
import { ColorService } from '@/services/ColorService'

export class Legend {
  private container: HTMLElement

  constructor(containerId: string) {
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`)
    }
    this.container = container
  }

  render(expressions: FunctionExpression[]): void {
    this.container.innerHTML = ''

    if (expressions.length === 0) {
      return
    }

    const legendTitle = document.createElement('h3')
    legendTitle.textContent = '関数一覧'
    legendTitle.style.cssText = `
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    `
    this.container.appendChild(legendTitle)

    expressions.forEach((expr) => {
      const item = this.createLegendItem(expr)
      this.container.appendChild(item)
    })
  }

  private createLegendItem(expr: FunctionExpression): HTMLElement {
    const item = document.createElement('div')
    item.style.cssText = `
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      margin-bottom: 0.25rem;
    `

    const colorBox = document.createElement('div')
    const color = ColorService.getColor(expr)
    colorBox.style.cssText = `
      width: 16px;
      height: 16px;
      background-color: ${color};
      border-radius: 2px;
    `

    const label = document.createElement('span')
    label.textContent = expr.raw
    label.style.cssText = `
      font-family: monospace;
      font-size: 0.875rem;
    `

    item.appendChild(colorBox)
    item.appendChild(label)

    return item
  }

  destroy(): void {
    this.container.innerHTML = ''
  }
}
