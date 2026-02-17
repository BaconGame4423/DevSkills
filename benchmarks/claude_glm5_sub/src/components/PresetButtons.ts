import { presets } from '@/models'
import { appState } from '@/services/AppState'
import { ExpressionParser } from '@/services/ExpressionParser'

export class PresetButtons {
  private container: HTMLElement

  constructor(containerId: string) {
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`)
    }
    this.container = container

    this.render()
  }

  private render(): void {
    const gridContainer = document.createElement('div')
    gridContainer.className = 'preset-buttons-grid'
    gridContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      margin-top: 1rem;
    `

    presets.forEach((preset) => {
      const button = document.createElement('button')
      button.textContent = preset.label
      button.className = 'preset-button'
      button.style.cssText = `
        padding: 0.75rem;
        font-size: 1rem;
        background-color: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        cursor: pointer;
        min-height: 44px;
        min-width: 44px;
        transition: all 150ms ease;
      `

      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = '#e5e7eb'
      })

      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = '#f3f4f6'
      })

      button.addEventListener('click', () => {
        this.handlePresetClick(preset.expression)
      })

      gridContainer.appendChild(button)
    })

    this.container.appendChild(gridContainer)
  }

  private handlePresetClick(expression: string): void {
    const parsed = ExpressionParser.parse(expression)

    if (parsed.isValid) {
      appState.addExpression(parsed)

      const inputElement = document.querySelector('.function-input') as HTMLInputElement
      if (inputElement) {
        inputElement.value = expression
        inputElement.style.borderColor = '#059669'
      }
    }
  }

  destroy(): void {
    this.container.innerHTML = ''
  }
}
