export interface Domain {
  x: [number, number]
  y: [number, number]
}

export interface TangentLine {
  enabled: boolean
  x: number
}

export interface GraphState {
  domain: Domain
  showGrid: boolean
  showAxisLabels: boolean
  showDerivative: boolean
  tangentLine: TangentLine | null
  zoomLevel: number
}

export const defaultGraphState: GraphState = {
  domain: { x: [-10, 10], y: [-10, 10] },
  showGrid: true,
  showAxisLabels: true,
  showDerivative: false,
  tangentLine: null,
  zoomLevel: 1,
}
