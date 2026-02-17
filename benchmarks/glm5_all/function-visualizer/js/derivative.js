class DerivativeCalculator {
    constructor(options = {}) {
        this.h = options.h || 1e-5;
        this.xRange = options.xRange || [-10, 10];
        this.step = options.step || 0.1;
    }

    computeDerivative(evaluateFn, xRange = this.xRange, step = this.step) {
        if (typeof evaluateFn !== 'function') {
            return null;
        }

        const derivativePoints = [];
        const [xMin, xMax] = xRange;

        for (let x = xMin; x <= xMax; x += step) {
            const dy = this.centralDifference(evaluateFn, x);
            if (typeof dy === 'number' && isFinite(dy)) {
                derivativePoints.push({ x, y: dy });
            }
        }

        return derivativePoints;
    }

    centralDifference(f, x) {
        const h = this.h;
        const fxPlusH = f(x + h);
        const fxMinusH = f(x - h);

        if (typeof fxPlusH !== 'number' || !isFinite(fxPlusH) ||
            typeof fxMinusH !== 'number' || !isFinite(fxMinusH)) {
            return NaN;
        }

        return (fxPlusH - fxMinusH) / (2 * h);
    }

    setStepSize(h) {
        if (typeof h === 'number' && h > 0) {
            this.h = h;
        }
    }

    setRange(xRange) {
        if (Array.isArray(xRange) && xRange.length === 2) {
            this.xRange = xRange;
        }
    }

    setStep(step) {
        if (typeof step === 'number' && step > 0) {
            this.step = step;
        }
    }
}

const derivativeCalculator = new DerivativeCalculator();
