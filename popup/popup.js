/**
 * LeetCode C# Formatter - Popup Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const statusBadge = document.getElementById('status-badge');
  const formatBtn = document.getElementById('format-now-btn');
  const indentSelect = document.getElementById('indent-size');
  const braceSelect = document.getElementById('brace-style');
  const blankLinesSelect = document.getElementById('max-blank-lines');
  const spaceOperatorsCheck = document.getElementById('space-operators');
  const resetBtn = document.getElementById('reset-defaults');
  const shortcutKbd = document.getElementById('shortcut-kbd');

  // Detect Mac platform
  if (navigator.platform && navigator.platform.toUpperCase().includes('MAC')) {
    if (shortcutKbd) shortcutKbd.textContent = 'Cmd';
  }

  const defaultSettings = {
    indentSize: 4,
    indentStyle: 'space',
    braceStyle: 'Allman',
    maxConsecutiveBlankLines: 1,
    spaceAroundOperators: true
  };

  let currentSettings = Object.assign({}, defaultSettings);

  // 1. Load saved settings
  chrome.storage.sync.get(['lc_csharp_settings'], (result) => {
    if (result && result.lc_csharp_settings) {
      currentSettings = Object.assign(currentSettings, result.lc_csharp_settings);
    }
    applySettingsToUI(currentSettings);
  });

  function applySettingsToUI(s) {
    if (s.indentStyle === 'tab') {
      indentSelect.value = 'tab';
    } else {
      indentSelect.value = `${s.indentSize}-space`;
    }
    braceSelect.value = s.braceStyle || 'Allman';
    blankLinesSelect.value = String(s.maxConsecutiveBlankLines || 1);
    spaceOperatorsCheck.checked = s.spaceAroundOperators !== false;
  }

  function saveSettings() {
    const indentVal = indentSelect.value;
    if (indentVal === 'tab') {
      currentSettings.indentStyle = 'tab';
      currentSettings.indentSize = 4;
    } else {
      currentSettings.indentStyle = 'space';
      currentSettings.indentSize = parseInt(indentVal.split('-')[0], 10) || 4;
    }

    currentSettings.braceStyle = braceSelect.value;
    currentSettings.maxConsecutiveBlankLines = parseInt(blankLinesSelect.value, 10) || 1;
    currentSettings.spaceAroundOperators = spaceOperatorsCheck.checked;

    chrome.storage.sync.set({ lc_csharp_settings: currentSettings }, () => {
      // Notify active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'UPDATE_SETTINGS',
            settings: currentSettings
          });
        }
      });
    });
  }

  // Event Listeners for settings
  indentSelect.addEventListener('change', saveSettings);
  braceSelect.addEventListener('change', saveSettings);
  blankLinesSelect.addEventListener('change', saveSettings);
  spaceOperatorsCheck.addEventListener('change', saveSettings);

  resetBtn.addEventListener('click', () => {
    currentSettings = Object.assign({}, defaultSettings);
    applySettingsToUI(currentSettings);
    saveSettings();
  });

  // 2. Check active tab status
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    const tab = tabs[0];
    const url = tab.url || '';

    const isLeetCode = url.includes('leetcode.com') || url.includes('leetcode.cn');

    if (!isLeetCode) {
      statusBadge.textContent = 'Not on LeetCode';
      statusBadge.className = 'badge badge-inactive';
      formatBtn.disabled = true;
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'GET_STATUS' }, (res) => {
      if (chrome.runtime.lastError || !res) {
        statusBadge.textContent = 'Editor Not Ready';
        statusBadge.className = 'badge badge-inactive';
        formatBtn.disabled = true;
        return;
      }

      if (res.isCSharp) {
        statusBadge.textContent = 'C# Active';
        statusBadge.className = 'badge badge-csharp';
        formatBtn.disabled = false;
      } else {
        const lang = res.language ? ` (${res.language})` : '';
        statusBadge.textContent = `Not C#${lang}`;
        statusBadge.className = 'badge badge-inactive';
        formatBtn.disabled = true;
        formatBtn.title = 'Switch language to C# in LeetCode to enable';
      }
    });
  });

  // 3. Format Now button action
  formatBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'FORMAT_CSHARP' });
        window.close(); // Close popup after triggering
      }
    });
  });
});
