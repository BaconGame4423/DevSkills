export class PresetButtons {
  constructor(containerSelector, inputHandler) {
    this.container = document.querySelector(containerSelector);
    this.inputHandler = inputHandler;
    
    if (this.container) {
      this.setupListeners();
    }
  }

  setupListeners() {
    const buttons = this.container.querySelectorAll('.preset-btn');
    
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const func = btn.getAttribute('data-func');
        if (func && this.inputHandler) {
          this.inputHandler.setValue(func);
          this.inputHandler.focus();
        }
      });
    });
  }

  addPreset(name, expression) {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.setAttribute('data-func', expression);
    btn.textContent = name;
    
    btn.addEventListener('click', () => {
      if (this.inputHandler) {
        this.inputHandler.setValue(expression);
        this.inputHandler.focus();
      }
    });
    
    this.container.appendChild(btn);
  }
}
