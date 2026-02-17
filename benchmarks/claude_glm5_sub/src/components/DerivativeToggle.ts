import { appState } from '@/services/AppState'

export class DerivativeToggle {
  private container: HTMLElement
  private checkbox: HTMLInputElement
  private label: HTMLLabelElement

  constructor(containerId: string) {
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`)
    }
    this.container = container

    const wrapper = document.createElement('div')
    wrapper.style.cssText = `
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1rem;
    `

    this.checkbox = document.createElement('input')
    this.checkbox.type = 'checkbox'
    this.checkbox.id = 'derivative-toggle'
    this.checkbox.style.cssText = `
      width: 1.25rem;
      height: 1.25rem;
      cursor: pointer;
    `

    this.label = document.createElement('label')
    this.label.htmlFor = 'derivative-toggle'
    this.label.textContent = '導関数を表示'
    this.label.style.cssText = `
      font-size: 1rem;
      cursor: pointer;
      user-select: none;
    `

    this.checkbox.addEventListener('change', () => {
      appState.setGraphState({
        showDerivative: this.checkbox.checked,
      })
    })

    appState.onGraphStateChange.subscribe((state) => {
      this.checkbox.checked = state.showDerivative
    })

    wrapper.appendChild(this.checkbox)
    wrapper.appendChild(this.label)
    this.container.appendChild(wrapper)
  }

  isChecked(): boolean {
    return this.checkbox.checked
  }

  setChecked(checked: boolean): void {
    this.checkbox.checked = checked
    this.checkbox.dispatchEvent(new Event('change'))
  }

  destroy(): void {
    this.checkbox.remove()
    this.label.remove()
  }
}
