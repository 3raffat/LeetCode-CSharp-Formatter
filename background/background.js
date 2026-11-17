/**
 * LeetCode C# Formatter - Background Service Worker (Manifest V3)
 * 
 * Handles Chrome command shortcuts and default setting initialization.
 */

chrome.runtime.onInstalled.addListener((details) => {
  // Initialize default options in sync storage
  chrome.storage.sync.get(['lc_csharp_settings'], (result) => {
    if (!result.lc_csharp_settings) {
      chrome.storage.sync.set({
        lc_csharp_settings: {
          indentSize: 4,
          indentStyle: 'space',
          braceStyle: 'Allman',
          maxConsecutiveBlankLines: 1,
          spaceAroundOperators: true
        }
      });
    }
  });

  if (details.reason === 'install') {
    console.log('[LeetCode C# Formatter] Extension installed successfully.');
  }
});

// Handle global keyboard command (Ctrl+Shift+I)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'format-csharp') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'FORMAT_CSHARP' }, (response) => {
          if (chrome.runtime.lastError) {
            // Tab might not be a leetcode page or content script is not loaded
            console.debug('[LeetCode C# Formatter]', chrome.runtime.lastError.message);
          }
        });
      }
    });
  }
});
