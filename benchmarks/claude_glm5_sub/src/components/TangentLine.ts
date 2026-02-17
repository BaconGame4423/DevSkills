import { appState } from '@/services/AppState'
import type { TangentLine } from '@/models'

export class TangentLineComponent {
  private container: HTMLElement
  private enabled: boolean = false
  private x: number = 0

  constructor(containerId: string) {
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`)
    }
    this.container = container

    this.createToggle()
    this.subscribeToState()
  }

  private createToggle(): void {
    const wrapper = document.createElement('div')
    wrapper.style.cssText = `
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
    `

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.id = 'tangent-toggle'
    checkbox.style.cssText = `
      width: 1.25rem;
      height: 1.25rem;
      cursor: pointer;
    `

    const label = document.createElement('label')
    label.htmlFor = 'tangent-toggle'
    label.textContent = '接線を表示'
    label.style.cssText = `
      font-size: 1rem;
      cursor: pointer;
      user-select: none;
    `

    checkbox.addEventListener('change', () => {
      this.enabled = checkbox.checked
      this.updateState()
    })

    wrapper.appendChild(checkbox)
    wrapper.appendChild(label)
    this.container.appendChild(wrapper)
  }

  private subscribeToState(): void {
    appState.onGraphStateChange.subscribe((state) => {
      if (state.tangentLine) {
        this.enabled = state.tangentLine.enabled
        this.x = state.tangentLine.x
      } else {
        this.enabled = false
      }
    })
  }

  private updateState(): void {
    const tangentLine: TangentLine | null = this.enabled
      ? { enabled: this.enabled, x: this.x }
      : null

    appState.setGraphState({ tangentLine })
  }

  setPoint(x: number): void {
    this.x = x
    if (this.enabled) {
      this.updateState()
    }
  }

  destroy(): void {
    this.container.innerHTML = ''
  }
}
