import { derivative, parse } from 'mathjs'
import type { Derivative } from '@/models'

export class DerivativeService {
  private static cache: Map<string, Derivative> = new Map()

  static calculate(sourceId: string, expression: string): Derivative {
    const cacheKey = expression

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!
      return {
        ...cached,
        sourceId,
      }
    }

    try {
      const node = parse(expression)
      const derivativeNode = derivative(node, 'x')
      const derivativeExpr = derivativeNode.toString()

      const result: Derivative = {
        sourceId,
        expression: derivativeExpr,
        isValid: true,
      }

      this.cache.set(cacheKey, result)
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明なエラー'
      return {
        sourceId,
        expression: '',
        isValid: false,
        error: `導関数を計算できません: ${message}`,
      }
    }
  }

  static clearCache(): void {
    this.cache.clear()
  }

  static compile(derivativeExpr: string): ((x: number) => number) | null {
    try {
      const node = parse(derivativeExpr)
      const compiled = node.compile()
      return (x: number) => {
        const result = compiled.evaluate({ x })
        return typeof result === 'number' ? result : NaN
      }
    } catch {
      return null
    }
  }
}
