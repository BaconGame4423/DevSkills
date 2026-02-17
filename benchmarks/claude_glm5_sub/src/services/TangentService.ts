import { parse, derivative } from 'mathjs'

export interface TangentResult {
  slope: number
  intercept: number
  x: number
  y: number
}

export class TangentService {
  static calculateTangent(expression: string, x: number): TangentResult | null {
    try {
      const node = parse(expression)
      const compiled = node.compile()
      const y = compiled.evaluate({ x })

      const derivativeNode = derivative(node, 'x')
      const derivativeCompiled = derivativeNode.compile()
      const slope = derivativeCompiled.evaluate({ x })

      const intercept = y - slope * x

      return {
        slope,
        intercept,
        x,
        y,
      }
    } catch (error) {
      console.error('Failed to calculate tangent:', error)
      return null
    }
  }

  static getTangentLineEquation(result: TangentResult): string {
    const { slope, intercept } = result
    if (Math.abs(intercept) < 0.0001) {
      return `y = ${slope.toFixed(2)}x`
    } else if (intercept > 0) {
      return `y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)}`
    } else {
      return `y = ${slope.toFixed(2)}x - ${Math.abs(intercept).toFixed(2)}`
    }
  }
}
