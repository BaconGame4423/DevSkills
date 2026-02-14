export class ErrorHandler {
  constructor(errorElement) {
    this.errorDisplay = errorElement;
    this.currentError = null;
  }

  show(message) {
    this.currentError = message;
    this.errorDisplay.textContent = message;
    this.errorDisplay.classList.add('visible');
    
    const input = document.getElementById('function-input');
    if (input) {
      input.classList.add('error');
    }
  }

  clear() {
    this.currentError = null;
    this.errorDisplay.textContent = '';
    this.errorDisplay.classList.remove('visible');
    
    const input = document.getElementById('function-input');
    if (input) {
      input.classList.remove('error');
    }
  }

  hasError() {
    return this.currentError !== null;
  }

  getError() {
    return this.currentError;
  }
}
