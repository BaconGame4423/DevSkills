const COLORS = {
    function: '#3498db',
    derivative: '#27ae60',
    tangent: '#9b59b6',
    grid: 'rgba(0, 0, 0, 0.1)',
    axis: '#666',
};

let chartInstance = null;
let tooltipCallback = null;
let tangentCallback = null;

export function initGraph(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas element "${canvasId}" not found`);
        return null;
    }

    const ctx = canvas.getContext('2d');
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 150
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    enabled: false,
                    external: customTooltipHandler
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'center',
                    min: -10,
                    max: 10,
                    title: {
                        display: true,
                        text: 'x',
                        font: { size: 14, weight: 'bold' }
                    },
                    grid: {
                        color: COLORS.grid,
                        drawTicks: true
                    },
                    ticks: {
                        stepSize: 2
                    }
                },
                y: {
                    type: 'linear',
                    position: 'center',
                    min: -10,
                    max: 10,
                    title: {
                        display: true,
                        text: 'y',
                        font: { size: 14, weight: 'bold' }
                    },
                    grid: {
                        color: COLORS.grid,
                        drawTicks: true
                    },
                    ticks: {
                        stepSize: 2
                    }
                }
            }
        }
    });

    return chartInstance;
}

function generateDataPoints(fn, xMin, xMax, numPoints = 500) {
    const points = [];
    const step = (xMax - xMin) / numPoints;
    
    for (let x = xMin; x <= xMax; x += step) {
        const y = fn(x);
        if (!isNaN(y) && isFinite(y)) {
            const clampedY = Math.max(-1000, Math.min(1000, y));
            points.push({ x: x, y: clampedY });
        } else {
            points.push({ x: x, y: null });
        }
    }
    
    return points;
}

export function updateGraph(chart, config) {
    if (!chart) return;
    
    const { fn, derivativeFn, showDerivative, showTangent, cursorX } = config;
    
    const datasets = [];
    const xMin = -10;
    const xMax = 10;
    
    if (fn) {
        const functionData = generateDataPoints(fn, xMin, xMax);
        datasets.push({
            label: 'f(x)',
            data: functionData,
            borderColor: COLORS.function,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 6,
            tension: 0.1,
            spanGaps: true
        });
    }
    
    if (showDerivative && derivativeFn) {
        const derivativeData = generateDataPoints(derivativeFn, xMin, xMax);
        datasets.push({
            label: "f'(x)",
            data: derivativeData,
            borderColor: COLORS.derivative,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 6,
            borderDash: [5, 5],
            tension: 0.1,
            spanGaps: true
        });
    }
    
    if (showTangent && cursorX !== null && fn && derivativeFn) {
        const tangentData = generateTangentLine(fn, derivativeFn, cursorX, xMin, xMax);
        datasets.push({
            label: '接線',
            data: tangentData,
            borderColor: COLORS.tangent,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0,
            spanGaps: false
        });
    }
    
    chart.data.datasets = datasets;
    chart.update('none');
}

function generateTangentLine(fn, derivativeFn, x0, xMin, xMax) {
    const y0 = fn(x0);
    const slope = derivativeFn(x0);
    
    if (isNaN(y0) || isNaN(slope)) {
        return [];
    }
    
    const tangentLength = 5;
    const x1 = x0 - tangentLength;
    const x2 = x0 + tangentLength;
    
    const points = [];
    for (let x = x1; x <= x2; x += 0.1) {
        const y = slope * (x - x0) + y0;
        if (!isNaN(y) && isFinite(y)) {
            points.push({ x: x, y: Math.max(-1000, Math.min(1000, y)) });
        }
    }
    
    return points;
}

function customTooltipHandler(context) {
    const tooltipModel = context.tooltip;
    
    if (tooltipModel.opacity === 0) {
        return;
    }
    
    if (tooltipCallback && tooltipModel.dataPoints && tooltipModel.dataPoints.length > 0) {
        const x = tooltipModel.dataPoints[0].parsed.x;
        tooltipCallback(x);
    }
}

export function setTooltipCallback(callback) {
    tooltipCallback = callback;
}

export function updateTooltipDisplay(x, fx, dfx) {
    const tooltipXEl = document.getElementById('tooltip-x');
    const tooltipFxEl = document.getElementById('tooltip-fx');
    const tooltipDfxEl = document.getElementById('tooltip-dfx');
    
    if (tooltipXEl) {
        tooltipXEl.textContent = `x: ${x.toFixed(3)}`;
    }
    if (tooltipFxEl) {
        tooltipFxEl.textContent = `f(x): ${isNaN(fx) ? '--' : fx.toFixed(4)}`;
    }
    if (tooltipDfxEl) {
        tooltipDfxEl.textContent = `f'(x): ${isNaN(dfx) ? '--' : dfx.toFixed(4)}`;
    }
}

export function handleResize(chart) {
    if (chart) {
        chart.resize();
    }
}
