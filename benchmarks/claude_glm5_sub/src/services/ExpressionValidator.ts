export interface ValidationResult {
  isValid: boolean
  error?: string
}

export class ExpressionValidator {
  private static readonly ALLOWED_FUNCTIONS = [
    'sin',
    'cos',
    'tan',
    'asin',
    'acos',
    'atan',
    'log',
    'ln',
    'exp',
    'sqrt',
    'abs',
    'floor',
    'ceil',
    'round',
  ]

  private static readonly BLOCKED_PATTERNS = [
    /alert\s*\(/i,
    /eval\s*\(/i,
    /function\s*\(/i,
    /=>/,
    /SELECT\s+/i,
    /INSERT\s+/i,
    /UPDATE\s+/i,
    /DELETE\s+/i,
    /DROP\s+/i,
    /CREATE\s+/i,
    /ALTER\s+/i,
  ]

  static validate(input: string): ValidationResult {
    if (!input || input.trim() === '') {
      return {
        isValid: false,
        error: '数式を入力してください',
      }
    }

    for (const pattern of this.BLOCKED_PATTERNS) {
      if (pattern.test(input)) {
        return {
          isValid: false,
          error: '無効な入力が検出されました',
        }
      }
    }

    const hasValidContent = /[a-zA-Z0-9+\-*/^()]/.test(input)
    if (!hasValidContent) {
      return {
        isValid: false,
        error: '有効な数式文字を含んでいません',
      }
    }

    const funcPattern = /([a-zA-Z]+)\s*\(/g
    let match
    while ((match = funcPattern.exec(input)) !== null) {
      const funcName = match[1].toLowerCase()
      if (!this.ALLOWED_FUNCTIONS.includes(funcName) && funcName !== 'x') {
        return {
          isValid: false,
          error: `関数 "${funcName}" はサポートされていません`,
        }
      }
    }

    return {
      isValid: true,
    }
  }
}
