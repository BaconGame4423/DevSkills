import { parse, SymbolNode } from 'mathjs'
import type { FunctionExpression } from '@/models'

export class ExpressionParser {
  static normalize(raw: string): string {
    return raw
      .replace(/\^/g, '^')
      .replace(/\s+/g, '')
      .replace(/(\d)([a-zA-Z])/g, '$1*$2')
      .replace(/([a-zA-Z])(\d)/g, '$1*$2')
      .replace(/\)\(/g, ')*(')
      .replace(/(\d)\(/g, '$1*(')
      .replace(/\)(\d)/g, ')*$1')
  }

  static parse(raw: string): FunctionExpression {
    const id = `expr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    if (!raw || raw.trim() === '') {
      return {
        id,
        raw: '',
        normalized: '',
        isValid: false,
        error: '数式を入力してください',
      }
    }

    try {
      const normalized = this.normalize(raw)
      const node = parse(normalized)

      const variables = new Set<string>()
      node.traverse((n) => {
        if (n.type === 'SymbolNode') {
          const symbolNode = n as SymbolNode
          if (symbolNode.name !== 'x') {
            variables.add(symbolNode.name)
          }
        }
      })

      if (variables.size > 0) {
        return {
          id,
          raw,
          normalized,
          isValid: false,
          error: `変数 ${Array.from(variables).join(', ')} はサポートされていません。変数 x のみ使用できます。`,
        }
      }

      return {
        id,
        raw,
        normalized,
        isValid: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明なエラー'
      return {
        id,
        raw,
        normalized: '',
        isValid: false,
        error: `数式が正しくありません: ${message}`,
      }
    }
  }

  static compile(normalized: string): ((x: number) => number) | null {
    try {
      const node = parse(normalized)
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
