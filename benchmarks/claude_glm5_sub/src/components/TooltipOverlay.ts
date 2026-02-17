import type { TooltipData } from '@/models'

export class TooltipOverlay {
  private container: HTMLElement
  private tooltipElement: HTMLElement | null = null
  private animationFrameId: number | null = null

  constructor(containerId: string) {
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`)
    }
    this.container = container

    this.createTooltip()
    this.setupEventListeners()
  }

  private createTooltip(): void {
    this.tooltipElement = document.createElement('div')
    this.tooltipElement.className = 'tooltip-overlay'
    this.tooltipElement.style.cssText = `
      position: absolute;
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 0.5rem;
      border-radius: 4px;
      font-size: 0.875rem;
      pointer-events: none;
      z-index: 1000;
      white-space: nowrap;
      display: none;
    `
    this.container.appendChild(this.tooltipElement)
  }

  private setupEventListeners(): void {
    this.container.addEventListener('mousemove', (e) => {
      this.handleMouseMove(e)
    })

    this.container.addEventListener('mouseleave', () => {
      this.hide()
    })
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }

    this.animationFrameId = requestAnimationFrame(() => {
      this.updatePosition(e.clientX, e.clientY)
    })
  }

  private updatePosition(clientX: number, clientY: number): void {
    if (!this.tooltipElement) return

    const rect = this.container.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top

    this.tooltipElement.style.left = `${x + 10}px`
    this.tooltipElement.style.top = `${y + 10}px`
  }

  update(data: TooltipData): void {
    if (!this.tooltipElement) return

    if (!data.visible) {
      this.hide()
      return
    }

    let content = `x: ${data.x.toFixed(2)}<br>f(x): ${data.fx.toFixed(2)}`
    if (data.fpx !== null) {
      content += `<br>f'(x): ${data.fpx.toFixed(2)}`
    }

    this.tooltipElement.innerHTML = content
    this.tooltipElement.style.display = 'block'
  }

  hide(): void {
    if (this.tooltipElement) {
      this.tooltipElement.style.display = 'none'
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  destroy(): void {
    this.hide()
    if (this.tooltipElement) {
      this.tooltipElement.remove()
      this.tooltipElement = null
    }
  }
}
