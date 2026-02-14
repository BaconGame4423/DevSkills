import { debounce } from '../utils/debounce.js';

export class InputHandler {
  constructor(inputElement, options = {}) {
    this.input = inputElement;
    this.debounceDelay = options.debounceDelay || 300;
    this.callbacks = [];
    
    this.setupListeners();
  }

  setupListeners() {
    const debouncedEmit = debounce((value) => {
      this.emit(value);
    }, this.debounceDelay);

    this.input.addEventListener('input', (e) => {
      debouncedEmit(e.target.value);
    });

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.emit(this.input.value);
      }
    });
  }

  onChange(callback) {
    this.callbacks.push(callback);
  }

  emit(value) {
    const trimmed = value.trim();
    for (const callback of this.callbacks) {
      callback(trimmed);
    }
  }

  setValue(value) {
    this.input.value = value;
    this.emit(value);
  }

  getValue() {
    return this.input.value.trim();
  }

  focus() {
    this.input.focus();
  }
}
