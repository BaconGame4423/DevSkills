import type { FunctionExpression, Derivative, GraphState, TooltipData } from '@/models'
import { defaultGraphState } from '@/models'

type EventCallback<T> = (data: T) => void

class EventEmitter<T> {
  private listeners: Set<EventCallback<T>> = new Set()

  subscribe(callback: EventCallback<T>): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  emit(data: T): void {
    this.listeners.forEach((callback) => callback(data))
  }
}

export class AppState {
  private expressions: FunctionExpression[] = []
  private derivative: Derivative | null = null
  private graphState: GraphState = defaultGraphState
  private tooltipData: TooltipData | null = null

  public onExpressionChange = new EventEmitter<FunctionExpression>()
  public onDerivativeChange = new EventEmitter<Derivative | null>()
  public onGraphStateChange = new EventEmitter<GraphState>()
  public onTooltipChange = new EventEmitter<TooltipData | null>()

  getExpressions(): FunctionExpression[] {
    return [...this.expressions]
  }

  setExpressions(expressions: FunctionExpression[]): void {
    this.expressions = expressions
    if (expressions.length > 0) {
      this.onExpressionChange.emit(expressions[0])
    }
  }

  addExpression(expression: FunctionExpression): void {
    this.expressions.push(expression)
    this.onExpressionChange.emit(expression)
  }

  removeExpression(id: string): void {
    this.expressions = this.expressions.filter((e) => e.id !== id)
    if (this.expressions.length > 0) {
      this.onExpressionChange.emit(this.expressions[0])
    }
  }

  updateExpression(id: string, updates: Partial<FunctionExpression>): void {
    const index = this.expressions.findIndex((e) => e.id === id)
    if (index !== -1) {
      this.expressions[index] = { ...this.expressions[index], ...updates }
      this.onExpressionChange.emit(this.expressions[index])
    }
  }

  getDerivative(): Derivative | null {
    return this.derivative
  }

  setDerivative(derivative: Derivative | null): void {
    this.derivative = derivative
    this.onDerivativeChange.emit(derivative)
  }

  getGraphState(): GraphState {
    return { ...this.graphState }
  }

  setGraphState(state: Partial<GraphState>): void {
    this.graphState = { ...this.graphState, ...state }
    this.onGraphStateChange.emit(this.graphState)
  }

  getTooltipData(): TooltipData | null {
    return this.tooltipData ? { ...this.tooltipData } : null
  }

  setTooltipData(data: TooltipData | null): void {
    this.tooltipData = data
    this.onTooltipChange.emit(data)
  }
}

export const appState = new AppState()
