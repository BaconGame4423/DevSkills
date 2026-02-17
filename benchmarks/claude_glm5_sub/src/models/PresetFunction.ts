export interface PresetFunction {
  id: string
  label: string
  expression: string
  category: 'trig' | 'poly' | 'exp' | 'other'
}

export const presets: PresetFunction[] = [
  { id: 'sin', label: 'sin(x)', expression: 'sin(x)', category: 'trig' },
  { id: 'cos', label: 'cos(x)', expression: 'cos(x)', category: 'trig' },
  { id: 'tan', label: 'tan(x)', expression: 'tan(x)', category: 'trig' },
  { id: 'x2', label: 'x²', expression: 'x^2', category: 'poly' },
  { id: 'x3', label: 'x³', expression: 'x^3', category: 'poly' },
  { id: 'log', label: 'log(x)', expression: 'log(x)', category: 'exp' },
  { id: 'exp', label: 'eˣ', expression: 'exp(x)', category: 'exp' },
  { id: 'sqrt', label: '√x', expression: 'sqrt(x)', category: 'other' },
  { id: 'abs', label: '|x|', expression: 'abs(x)', category: 'other' },
]
