import type { FunctionExpression } from '@/models'

export class ColorService {
  private static readonly COLORS = [
    '#2563eb', // blue
    '#7c3aed', // purple
    '#059669', // green
    '#dc2626', // red
    '#d97706', // amber
    '#0891b2', // cyan
    '#c026d3', // fuchsia
    '#ea580c', // orange
    '#4f46e5', // indigo
    '#0d9488', // teal
  ]

  private static colorMap: Map<string, string> = new Map()
  private static nextColorIndex: number = 0

  static getColor(expression: FunctionExpression): string {
    if (this.colorMap.has(expression.id)) {
      return this.colorMap.get(expression.id)!
    }

    const color = this.COLORS[this.nextColorIndex % this.COLORS.length]
    this.colorMap.set(expression.id, color)
    this.nextColorIndex++

    return color
  }

  static clearColor(id: string): void {
    this.colorMap.delete(id)
  }

  static reset(): void {
    this.colorMap.clear()
    this.nextColorIndex = 0
  }
}
