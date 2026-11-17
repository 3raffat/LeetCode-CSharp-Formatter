/**
 * LeetCode C# Formatter - Content Script Orchestrator
 * 
 * Coordinates editor detection, toolbar UI injection, keyboard shortcuts,
 * background communication, and the C# formatting engine.
 */

(function () {
  'use strict';

  const BRIDGE_SOURCE = 'LC_CSHARP_BRIDGE';
  const CONTENT_SOURCE = 'LC_CSHARP_CONTENT';

  const editorDetector = new window.LeetCodeEditorDetector.EditorDetector();
  const uiManager = new window.LeetCodeUIManager.UIManager();
  let pendingRequests = new Map();
  let requestIdCounter = 0;
  let userSettings = {
    indentSize: 4,
    indentStyle: 'space',
    braceStyle: 'Allman',
    maxConsecutiveBlankLines: 1,
    spaceAroundOperators: true
  };

  /**
   * Load user settings from chrome.storage
   */
  function loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['lc_csharp_settings'], (data) => {
        if (data && data.lc_csharp_settings) {
          userSettings = Object.assign(userSettings, data.lc_csharp_settings);
        }
      });
    }
  }

  /**
   * Sends a typed message to pageBridge.js (running in the MAIN world)
   * and returns a Promise resolving with the response.
   */
  function sendBridgeRequest(type, payload = {}) {
    return new Promise((resolve, reject) => {
      const requestId = `req_${++requestIdCounter}_${Date.now()}`;
      const timeout = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error(`Bridge request '${type}' timed out`));
      }, 3000);

      pendingRequests.set(requestId, { resolve, reject, timeout });

      window.postMessage({
        source: CONTENT_SOURCE,
        type,
        requestId,
        payload
      }, '*');
    });
  }

  // Listen for responses from pageBridge.js
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== BRIDGE_SOURCE) {
      return;
    }

    const { type, requestId, state, result } = event.data;

    if (type === 'MONACO_INITIALIZED') {
      tryInjectUI();
      return;
    }

    if (requestId && pendingRequests.has(requestId)) {
      const { resolve, timeout } = pendingRequests.get(requestId);
      clearTimeout(timeout);
      pendingRequests.delete(requestId);

      if (type === 'GET_CODE_RESPONSE' || type === 'PONG_MONACO') {
        resolve(state);
      } else if (type === 'APPLY_CODE_RESPONSE') {
        resolve(result);
      } else {
        resolve(event.data);
      }
    }
  });

  /**
   * Attempts to inject the Format C# button into the LeetCode toolbar.
   */
  function tryInjectUI() {
    const toolbar = editorDetector.findToolbarContainer();
    if (!toolbar) return false;

    return uiManager.injectButton(toolbar, editorDetector.isCSharp);
  }

  /**
   * Main formatting action.
   */
  async function performFormatting() {
    // 1. Language check
    if (!editorDetector.isCSharp) {
      uiManager.showToast('info', 'LeetCode C# Formatter only formats C# code.');
      return;
    }

    uiManager.setLoading(true);

    try {
      // 2. Fetch current code from Monaco via pageBridge
      const state = await sendBridgeRequest('GET_CODE');
      if (!state || !state.available || typeof state.code !== 'string') {
        throw new Error('Could not access LeetCode code editor.');
      }

      const originalCode = state.code;
      if (!originalCode.trim()) {
        uiManager.showToast('info', 'Editor is empty.');
        uiManager.setLoading(false);
        return;
      }

      // 3. Run Formatting Engine locally
      const result = window.LeetCodeCSharpFormatter.formatCSharpCode(originalCode, userSettings);

      if (!result.success) {
        throw new Error(result.error || 'Formatting failed validation.');
      }

      // 4. Apply formatted code back to Monaco editor
      const applyResult = await sendBridgeRequest('APPLY_CODE', { code: result.formattedCode });
      if (!applyResult.success) {
        throw new Error(applyResult.error || 'Failed to apply code to Monaco editor.');
      }

      // 5. Success Notification
      const duration = result.durationMs ? ` in ${result.durationMs}ms` : '';
      uiManager.showToast('success', `C# Code formatted successfully${duration}!`);
    } catch (err) {
      console.error('[LeetCode C# Formatter]', err);
      uiManager.showToast('error', `Formatting failed: ${err.message}`);
    } finally {
      uiManager.setLoading(false);
    }
  }

  /**
   * Keyboard shortcut handler: Ctrl + Shift + I (or Cmd + Shift + I on Mac)
   */
  function handleKeyboardShortcut(e) {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const isKeyI = e.key === 'I' || e.key === 'i' || e.code === 'KeyI';

    if (isCtrlOrCmd && isShift && isKeyI) {
      // Check if user is on LeetCode problem page
      e.preventDefault();
      e.stopPropagation();
      performFormatting();
    }
  }

  /**
   * Listen for messages from background.js (Chrome commands) or popup.js
   */
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'FORMAT_CSHARP') {
        performFormatting();
        sendResponse({ status: 'started' });
      } else if (request.action === 'GET_STATUS') {
        sendResponse({
          isCSharp: editorDetector.isCSharp,
          language: editorDetector.currentLanguage,
          hasEditor: !!editorDetector.editorContainer
        });
      } else if (request.action === 'UPDATE_SETTINGS') {
        userSettings = Object.assign(userSettings, request.settings || {});
        sendResponse({ status: 'ok' });
      }
      return true;
    });
  }

  // Initialize
  function init() {
    loadSettings();

    // Setup UI Manager callback
    uiManager.onFormatClick(() => {
      performFormatting();
    });

    // Setup Editor Detector callbacks
    editorDetector.onLanguageChange(({ isCSharp, language }) => {
      uiManager.setLanguageState(isCSharp);
    });

    editorDetector.onEditorFound(() => {
      tryInjectUI();
    });

    // Start watching DOM
    editorDetector.start();

    // Register Keyboard Shortcut
    window.addEventListener('keydown', handleKeyboardShortcut, true);

    // Initial injection attempt
    setTimeout(tryInjectUI, 500);
    setTimeout(tryInjectUI, 1500);
    setTimeout(tryInjectUI, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
