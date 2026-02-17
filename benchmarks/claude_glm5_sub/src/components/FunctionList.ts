import type { FunctionExpression } from '@/models'
import { appState } from '@/services/AppState'

export class FunctionList {
  private container: HTMLElement
  private listElement: HTMLElement

  constructor(containerId: string) {
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`)
    }
    this.container = container

    this.listElement = document.createElement('div')
    this.listElement.className = 'function-list'
    this.listElement.style.cssText = `
      margin-top: 1rem;
    `

    this.container.appendChild(this.listElement)
    this.subscribeToState()
  }

  private subscribeToState(): void {
    appState.onExpressionChange.subscribe((expression) => {
      this.render([expression])
    })
  }

  private render(expressions: FunctionExpression[]): void {
    this.listElement.innerHTML = ''

    if (expressions.length === 0) {
      const emptyMessage = document.createElement('p')
      emptyMessage.textContent = '関数を入力してください'
      emptyMessage.style.cssText = `
        color: #6b7280;
        font-size: 0.875rem;
      `
      this.listElement.appendChild(emptyMessage)
      return
    }

    expressions.forEach((expr) => {
      const item = this.createListItem(expr)
      this.listElement.appendChild(item)
    })

    const addButton = document.createElement('button')
    addButton.textContent = '+ 関数を追加'
    addButton.style.cssText = `
      margin-top: 0.5rem;
      padding: 0.5rem 1rem;
      background-color: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      min-height: 44px;
      width: 100%;
      font-size: 1rem;
    `

    addButton.addEventListener('click', () => {
      console.log('Add new function')
    })

    this.listElement.appendChild(addButton)
  }

  private createListItem(expr: FunctionExpression): HTMLElement {
    const item = document.createElement('div')
    item.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem;
      background-color: #f3f4f6;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    `

    const label = document.createElement('span')
    label.textContent = expr.raw
    label.style.cssText = `
      font-family: monospace;
      font-size: 0.875rem;
    `

    const removeButton = document.createElement('button')
    removeButton.textContent = '×'
    removeButton.style.cssText = `
      background: none;
      border: none;
      color: #dc2626;
      font-size: 1.25rem;
      cursor: pointer;
      padding: 0 0.5rem;
      min-width: 44px;
      min-height: 44px;
    `

    removeButton.addEventListener('click', () => {
      appState.removeExpression(expr.id)
    })

    item.appendChild(label)
    item.appendChild(removeButton)

    return item
  }

  destroy(): void {
    this.listElement.innerHTML = ''
  }
}
