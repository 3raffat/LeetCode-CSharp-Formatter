/**
 * LeetCode C# Formatter - Page Bridge (Runs in MAIN World)
 * 
 * Has direct access to window.monaco, active editors, and text models.
 * Uses Monaco Editor's native APIs for atomic edits, undo/redo preservation,
 * and cursor retention.
 */

(function () {
  'use strict';

  const BRIDGE_SOURCE = 'LC_CSHARP_BRIDGE';
  const CONTENT_SOURCE = 'LC_CSHARP_CONTENT';

  let activeMonacoEditor = null;

  /**
   * Finds the active or primary code editor instance on LeetCode.
   */
  function findMonacoEditor() {
    if (!window.monaco || !window.monaco.editor) {
      return null;
    }

    const editors = window.monaco.editor.getEditors();
    if (!editors || editors.length === 0) {
      return null;
    }

    // 1. Look for editor that currently has focus
    for (const ed of editors) {
      if (typeof ed.hasTextFocus === 'function' && ed.hasTextFocus()) {
        activeMonacoEditor = ed;
        return ed;
      }
    }

    // 2. Look for editor that belongs to the main problem solving pane
    for (const ed of editors) {
      const domNode = ed.getDomNode && ed.getDomNode();
      if (domNode) {
        // Exclude console/testcase inputs if distinguishable
        const isInConsole = domNode.closest('.testcase-panel, .console-area, [data-track-load="console"]');
        if (!isInConsole) {
          activeMonacoEditor = ed;
          return ed;
        }
      }
    }

    // 3. Fallback to first available editor
    activeMonacoEditor = editors[0];
    return activeMonacoEditor;
  }

  /**
   * Retrieves editor state: language, current code, cursor position.
   */
  function getEditorState() {
    const editor = findMonacoEditor();
    if (!editor) {
      // Check if models exist even if editor instance is detached/virtualized
      const models = window.monaco?.editor?.getModels();
      if (models && models.length > 0) {
        const model = models[0];
        return {
          available: true,
          hasInstance: false,
          language: model.getLanguageId ? model.getLanguageId() : 'unknown',
          code: model.getValue()
        };
      }
      return { available: false };
    }

    const model = editor.getModel();
    if (!model) {
      return { available: false };
    }

    const language = model.getLanguageId ? model.getLanguageId() : 'unknown';
    const code = model.getValue();
    const position = editor.getPosition ? editor.getPosition() : null;

    return {
      available: true,
      hasInstance: true,
      language,
      code,
      position
    };
  }

  /**
   * Applies formatted code using Monaco's native edit API.
   * This retains the full undo history (Ctrl+Z) and cursor position.
   */
  function applyFormattedCode(newCode) {
    const editor = findMonacoEditor();
    if (!editor) {
      // Fallback: try direct model update
      const models = window.monaco?.editor?.getModels();
      if (models && models.length > 0) {
        models[0].setValue(newCode);
        return { success: true, method: 'model.setValue' };
      }
      return { success: false, error: 'Monaco editor instance not found' };
    }

    const model = editor.getModel();
    if (!model) {
      return { success: false, error: 'Editor model not found' };
    }

    const previousPosition = editor.getPosition ? editor.getPosition() : null;
    const fullRange = model.getFullModelRange();

    try {
      // Native Monaco undo stop before edit
      if (typeof editor.pushUndoStop === 'function') {
        editor.pushUndoStop();
      }

      // Execute edits atomically
      editor.executeEdits('leetcode-csharp-formatter', [
        {
          range: fullRange,
          text: newCode,
          forceMoveMarkers: true
        }
      ]);

      // Native Monaco undo stop after edit
      if (typeof editor.pushUndoStop === 'function') {
        editor.pushUndoStop();
      }

      // Restore and maintain cursor position
      if (previousPosition && typeof editor.setPosition === 'function') {
        editor.setPosition(previousPosition);
        if (typeof editor.revealPositionInCenterIfOutsideViewport === 'function') {
          editor.revealPositionInCenterIfOutsideViewport(previousPosition);
        }
      }

      // Maintain focus in the editor
      if (typeof editor.focus === 'function') {
        editor.focus();
      }

      return { success: true, method: 'executeEdits' };
    } catch (err) {
      // Fallback: setValue if executeEdits throws
      model.setValue(newCode);
      return { success: true, method: 'fallback.setValue', warning: err.message };
    }
  }

  // Listen for messages from content.js (Isolated World)
  window.addEventListener('message', function (event) {
    if (event.source !== window || !event.data || event.data.source !== CONTENT_SOURCE) {
      return;
    }

    const { type, requestId, payload } = event.data;

    switch (type) {
      case 'PING_MONACO': {
        const state = getEditorState();
        window.postMessage({
          source: BRIDGE_SOURCE,
          type: 'PONG_MONACO',
          requestId,
          state
        }, '*');
        break;
      }

      case 'GET_CODE': {
        const state = getEditorState();
        window.postMessage({
          source: BRIDGE_SOURCE,
          type: 'GET_CODE_RESPONSE',
          requestId,
          state
        }, '*');
        break;
      }

      case 'APPLY_CODE': {
        const result = applyFormattedCode(payload.code);
        window.postMessage({
          source: BRIDGE_SOURCE,
          type: 'APPLY_CODE_RESPONSE',
          requestId,
          result
        }, '*');
        break;
      }
    }
  });

  // Announce readiness when Monaco is detected
  let checkAttempts = 0;
  const pollMonaco = setInterval(() => {
    checkAttempts++;
    if (window.monaco && window.monaco.editor) {
      clearInterval(pollMonaco);
      window.postMessage({
        source: BRIDGE_SOURCE,
        type: 'MONACO_INITIALIZED',
        state: getEditorState()
      }, '*');
    } else if (checkAttempts >= 60) {
      clearInterval(pollMonaco);
    }
  }, 250);

})();
