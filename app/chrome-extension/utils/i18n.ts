/**
 * Safe access to chrome.i18n.getMessage with English fallbacks.
 *
 * The extension ships two locales (en, ru) plus this fallback table, so a
 * message still renders when chrome.i18n is unavailable (tests, docs tooling).
 */

const fallbackMessages: Record<string, string> = {
  extensionName: 'Browser Relay',
  extensionDescription: 'Control your own Chrome browser over a remote relay',
  bookmarksBarLabel: 'Bookmarks bar',
  elementPickerHint: 'Click an element (Esc to cancel)',
  elementPickerSelecting: 'Selecting element…',
};

/**
 * Get a localized message.
 * @param key Message key from a `messages.json` locale file
 * @param substitutions Optional substitution values
 */
export function getMessage(key: string, substitutions?: string[]): string {
  try {
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
      const message = chrome.i18n.getMessage(key, substitutions);
      if (message) {
        return message;
      }
    }
  } catch (error) {
    console.warn(`Failed to get i18n message for key "${key}":`, error);
  }

  let fallback = fallbackMessages[key] || key;

  if (substitutions && substitutions.length > 0) {
    substitutions.forEach((value, index) => {
      fallback = fallback.replace(`{${index}}`, value);
    });
  }

  return fallback;
}

/** Whether the chrome.i18n API is available in this context. */
export function isI18nAvailable(): boolean {
  try {
    return (
      typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getMessage === 'function'
    );
  } catch {
    return false;
  }
}
