/**
 * LeetCode C# Formatter - Editor Detector
 * 
 * Detects Monaco editor instances, toolbar containers, and the active language in LeetCode's UI.
 * Handles dynamic SPA page transitions and DOM re-renders.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LeetCodeEditorDetector = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class EditorDetector {
    constructor() {
      this.currentLanguage = null;
      this.isCSharp = false;
      this.editorContainer = null;
      this.toolbarContainer = null;
      this.mutationObserver = null;
      this.onLanguageChangeCallbacks = [];
      this.onEditorFoundCallbacks = [];
    }

    /**
     * Start watching for LeetCode editor and language changes.
     */
    start() {
      this.detect();

      // Setup MutationObserver to track SPA navigation and React re-renders
      this.mutationObserver = new MutationObserver(() => {
        this.detect();
      });

      this.mutationObserver.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    stop() {
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
        this.mutationObserver = null;
      }
    }

    onLanguageChange(callback) {
      this.onLanguageChangeCallbacks.push(callback);
    }

    onEditorFound(callback) {
      this.onEditorFoundCallbacks.push(callback);
    }

    /**
     * Attempts to find the editor container and active language.
     */
    detect() {
      const editorElement = this.findEditorElement();
      if (editorElement && editorElement !== this.editorContainer) {
        this.editorContainer = editorElement;
        this.onEditorFoundCallbacks.forEach(cb => cb(editorElement));
      }

      this.detectLanguage();
    }

    findEditorElement() {
      // Multiple selector heuristics across LeetCode versions
      const selectors = [
        '.monaco-editor',
        '[data-track-load="code_editor"]',
        '.coding-area',
        '.code-editor-container'
      ];

      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    }

    /**
     * Finds the toolbar area above the code editor where the Format button should be placed.
     */
    findToolbarContainer() {
      // 1. Check for the container containing the language selector dropdown
      const langBtn = this.findLanguageButton();
      if (langBtn) {
        // Find the parent flex container that holds the editor action buttons
        let container = langBtn.closest('.flex.items-center, [class*="toolbar"], [class*="editor-header"]');
        if (container) return container;
        if (langBtn.parentElement) return langBtn.parentElement;
      }

      // 2. Look for editor toolbar by common LeetCode classes
      const toolbarSelectors = [
        '[data-track-load="code_editor"] .flex.items-center',
        '.coding-area .flex.items-center',
        '.code-toolbar',
        '.editor-toolbar'
      ];

      for (const sel of toolbarSelectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }

      // 3. Fallback: find container preceding monaco-editor
      const editorEl = this.findEditorElement();
      if (editorEl && editorEl.parentElement) {
        const prevSibling = editorEl.previousElementSibling;
        if (prevSibling) return prevSibling;
      }

      return null;
    }

    /**
     * Finds LeetCode's language selection button.
     */
    findLanguageButton() {
      const candidates = document.querySelectorAll(
        'button[id^="headlessui-listbox-button"], button[class*="rounded"], button:has(svg)'
      );

      const knownLanguages = [
        'C#', 'C++', 'Java', 'Python', 'Python3', 'C', 'JavaScript',
        'TypeScript', 'PHP', 'Swift', 'Kotlin', 'Dart', 'Go', 'Ruby',
        'Scala', 'Rust', 'Racket', 'Erlang', 'Elixir'
      ];

      for (const btn of candidates) {
        const text = (btn.textContent || '').trim();
        for (const lang of knownLanguages) {
          if (text === lang || text.startsWith(lang + ' ') || text.includes(lang)) {
            return btn;
          }
        }
      }

      return null;
    }

    /**
     * Determines whether the currently active editor language is C#.
     */
    detectLanguage(monacoLanguageId = null) {
      let detected = null;

      // 1. If Monaco language ID is directly supplied via pageBridge
      if (monacoLanguageId) {
        detected = monacoLanguageId;
      } else {
        // 2. Check DOM language button text
        const langBtn = this.findLanguageButton();
        if (langBtn) {
          detected = (langBtn.textContent || '').trim();
        }
      }

      const isC = detected ? (
        detected.toLowerCase() === 'csharp' || 
        detected.toLowerCase() === 'c#' || 
        detected === 'C#'
      ) : false;

      if (detected !== this.currentLanguage || isC !== this.isCSharp) {
        const prevLang = this.currentLanguage;
        this.currentLanguage = detected;
        this.isCSharp = isC;
        this.onLanguageChangeCallbacks.forEach(cb => cb({
          language: detected,
          isCSharp: isC,
          previous: prevLang
        }));
      }

      return { language: detected, isCSharp: isC };
    }
  }

  return {
    EditorDetector
  };
});
