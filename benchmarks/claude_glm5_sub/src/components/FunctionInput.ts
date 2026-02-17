import debounce from 'lodash.debounce'
import { appState } from '@/services/AppState'
import { ExpressionParser } from '@/services/ExpressionParser'
import { ExpressionValidator } from '@/services/ExpressionValidator'

export class FunctionInput {
  private inputElement: HTMLInputElement
  private container: HTMLElement
  private debouncedOnChange: (value: string) => void

  constructor(containerId: string) {
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`)
    }
    this.container = container

    this.inputElement = document.createElement('input')
    this.inputElement.type = 'text'
    this.inputElement.placeholder = '例: x^2, sin(x), 2*x+1'
    this.inputElement.className = 'function-input'
    this.inputElement.style.cssText = `
      width: 100%;
      padding: 0.75rem;
      font-size: 1rem;
      border: 2px solid #d1d5db;
      border-radius: 8px;
      transition: border-color 150ms ease;
    `

    this.debouncedOnChange = debounce(this.handleInputChange.bind(this), 300)

    this.inputElement.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement
      this.debouncedOnChange(target.value)
    })

    this.container.appendChild(this.inputElement)
  }

  private handleInputChange(value: string): void {
    const validation = ExpressionValidator.validate(value)

    if (!validation.isValid) {
      this.inputElement.style.borderColor = '#dc2626'
      if (validation.error) {
        this.showError(validation.error)
      }
      return
    }

    const parsed = ExpressionParser.parse(value)

    if (!parsed.isValid) {
      this.inputElement.style.borderColor = '#dc2626'
      if (parsed.error) {
        this.showError(parsed.error)
      }
      return
    }

    this.inputElement.style.borderColor = '#059669'
    this.hideError()

    appState.addExpression(parsed)
  }

  private showError(message: string): void {
    let errorElement = this.container.querySelector('.error-message') as HTMLElement
    if (!errorElement) {
      errorElement = document.createElement('div')
      errorElement.className = 'error-message'
      errorElement.style.cssText = `
        color: #dc2626;
        font-size: 0.875rem;
        margin-top: 0.5rem;
      `
      this.container.appendChild(errorElement)
    }
    errorElement.textContent = message
  }

  private hideError(): void {
    const errorElement = this.container.querySelector('.error-message')
    if (errorElement) {
      errorElement.remove()
    }
  }

  getValue(): string {
    return this.inputElement.value
  }

  setValue(value: string): void {
    this.inputElement.value = value
    this.debouncedOnChange(value)
  }

  destroy(): void {
    this.inputElement.remove()
    const errorElement = this.container.querySelector('.error-message')
    if (errorElement) {
      errorElement.remove()
    }
  }
}
