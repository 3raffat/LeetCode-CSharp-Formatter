/**
 * LeetCode C# Formatter - UI Manager
 * 
 * Manages the toolbar "Format C#" button, loading state animations,
 * and elegant non-intrusive toast notifications.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LeetCodeUIManager = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const BUTTON_ID = 'lc-csharp-format-btn';
  const TOAST_CONTAINER_ID = 'lc-csharp-toast-container';

  class UIManager {
    constructor() {
      this.button = null;
      this.toastContainer = null;
      this.onFormatClickCallback = null;
      this.isLoading = false;
      this.isCSharpActive = false;
    }

    onFormatClick(callback) {
      this.onFormatClickCallback = callback;
    }

    /**
     * Injects the Format C# button into the target toolbar element.
     */
    injectButton(toolbarElement, isCSharp = true) {
      if (!toolbarElement) return false;

      // If button already exists in the same container, just update its state
      const existing = document.getElementById(BUTTON_ID);
      if (existing) {
        if (existing.parentElement === toolbarElement) {
          this.button = existing;
          this.setLanguageState(isCSharp);
          return true;
        } else {
          existing.remove();
        }
      }

      this.isCSharpActive = isCSharp;

      const btn = document.createElement('button');
      btn.id = BUTTON_ID;
      btn.className = `lc-csharp-btn ${isCSharp ? 'active' : 'disabled'}`;
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Format C# Code (Ctrl+Shift+I)');
      btn.title = isCSharp 
        ? 'Format C# Code (Ctrl+Shift+I)' 
        : 'LeetCode C# Formatter (Switch language to C# to enable)';

      btn.innerHTML = `
        <span class="lc-csharp-icon">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
          </svg>
        </span>
        <span class="lc-csharp-label">Format C#</span>
        <span class="lc-csharp-spinner" style="display: none;">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none">
            <circle cx="12" cy="12" r="10" stroke-width="3" stroke-dasharray="31.4" stroke-dashoffset="10"/>
          </svg>
        </span>
      `;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (this.isLoading) return;

        if (!this.isCSharpActive) {
          this.showToast('info', 'LeetCode C# Formatter only supports C# code.');
          return;
        }

        if (this.onFormatClickCallback) {
          this.onFormatClickCallback();
        }
      });

      // Insert button into toolbar (preferably right next to language selector or action buttons)
      toolbarElement.appendChild(btn);
      this.button = btn;
      return true;
    }

    /**
     * Updates the button enabled/disabled state based on current language.
     */
    setLanguageState(isCSharp) {
      this.isCSharpActive = isCSharp;
      if (!this.button) return;

      if (isCSharp) {
        this.button.classList.remove('disabled');
        this.button.classList.add('active');
        this.button.title = 'Format C# Code (Ctrl+Shift+I)';
      } else {
        this.button.classList.remove('active');
        this.button.classList.add('disabled');
        this.button.title = 'LeetCode C# Formatter (Switch language to C# to enable)';
      }
    }

    /**
     * Toggles the loading spinner on the button.
     */
    setLoading(loading) {
      this.isLoading = loading;
      if (!this.button) return;

      const label = this.button.querySelector('.lc-csharp-label');
      const icon = this.button.querySelector('.lc-csharp-icon');
      const spinner = this.button.querySelector('.lc-csharp-spinner');

      if (loading) {
        this.button.classList.add('loading');
        if (label) label.textContent = 'Formatting...';
        if (icon) icon.style.display = 'none';
        if (spinner) spinner.style.display = 'inline-flex';
      } else {
        this.button.classList.remove('loading');
        if (label) label.textContent = 'Format C#';
        if (icon) icon.style.display = 'inline-flex';
        if (spinner) spinner.style.display = 'none';
      }
    }

    /**
     * Displays a modern toast notification.
     * 
     * @param {'success'|'error'|'info'|'warning'} type 
     * @param {string} message 
     * @param {number} [duration=3000] 
     */
    showToast(type, message, duration = 3000) {
      let container = document.getElementById(TOAST_CONTAINER_ID);
      if (!container) {
        container = document.createElement('div');
        container.id = TOAST_CONTAINER_ID;
        container.className = 'lc-csharp-toast-container';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = `lc-csharp-toast lc-csharp-toast-${type}`;

      let iconSvg = '';
      if (type === 'success') {
        iconSvg = `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
        </svg>`;
      } else if (type === 'error') {
        iconSvg = `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>`;
      } else {
        iconSvg = `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
        </svg>`;
      }

      toast.innerHTML = `
        <span class="lc-toast-icon">${iconSvg}</span>
        <span class="lc-toast-text">${message}</span>
      `;

      container.appendChild(toast);

      // Trigger animation
      requestAnimationFrame(() => {
        toast.classList.add('visible');
      });

      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
  }

  return {
    UIManager
  };
});
