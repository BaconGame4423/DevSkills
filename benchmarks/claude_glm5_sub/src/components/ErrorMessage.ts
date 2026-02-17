import type { FunctionExpression } from '@/models'

export class ErrorMessage {
  private container: HTMLElement
  private messageElement: HTMLElement | null = null

  constructor(containerId: string) {
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`)
    }
    this.container = container
  }

  show(expression: FunctionExpression): void {
    if (!expression.error) {
      this.hide()
      return
    }

    if (!this.messageElement) {
      this.messageElement = document.createElement('div')
      this.messageElement.className = 'error-message'
      this.messageElement.style.cssText = `
        padding: 0.75rem;
        background-color: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
        color: #dc2626;
        font-size: 0.875rem;
        margin-top: 0.5rem;
      `
      this.container.appendChild(this.messageElement)
    }

    this.messageElement.textContent = expression.error
    this.messageElement.style.display = 'block'
  }

  hide(): void {
    if (this.messageElement) {
      this.messageElement.style.display = 'none'
    }
  }

  destroy(): void {
    if (this.messageElement) {
      this.messageElement.remove()
      this.messageElement = null
    }
  }
}
