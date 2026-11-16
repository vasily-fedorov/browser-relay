export type Lang = 'en' | 'ru';

const LANG_STORAGE_KEY = 'uiLanguage';

const messages = {
  en: {
    statusConnected: 'Connected',
    statusDisconnected: 'Not connected',
    statusConnecting: 'Connecting…',
    statusAuthenticating: 'Authenticating…',
    statusReconnecting: 'Reconnecting…',
    statusError: 'Connection error',
    relayUrlLabel: 'Relay URL',
    relayUrlPlaceholder: 'browser.example.com',
    tokenLabel: 'Token',
    tokenPlaceholder: 'Paste the token from your agent',
    connect: 'Connect',
    disconnect: 'Disconnect',
    sessionLabel: 'Session',
    toolsCount: 'Tools: {0}',
    lastErrorLabel: 'Last error',
    invalidUrl: 'Enter a relay URL',
    tokenRequired: 'Enter a token',
    showToken: 'Show token',
    hideToken: 'Hide token',
    languageLabel: 'Language',
  },
  ru: {
    statusConnected: 'Подключено',
    statusDisconnected: 'Не подключено',
    statusConnecting: 'Подключение…',
    statusAuthenticating: 'Аутентификация…',
    statusReconnecting: 'Переподключение…',
    statusError: 'Ошибка подключения',
    relayUrlLabel: 'URL relay',
    relayUrlPlaceholder: 'browser.example.com',
    tokenLabel: 'Токен',
    tokenPlaceholder: 'Вставьте токен от агента',
    connect: 'Подключиться',
    disconnect: 'Отключиться',
    sessionLabel: 'Сессия',
    toolsCount: 'Инструментов: {0}',
    lastErrorLabel: 'Последняя ошибка',
    invalidUrl: 'Укажите URL relay',
    tokenRequired: 'Укажите токен',
    showToken: 'Показать токен',
    hideToken: 'Скрыть токен',
    languageLabel: 'Язык',
  },
} as const;

export type MessageKey = keyof (typeof messages)['en'];

export const messageKeys = Object.keys(messages.en) as MessageKey[];

export function detectLang(uiLanguage: string | undefined): Lang {
  return uiLanguage && uiLanguage.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function translate(lang: Lang, key: MessageKey, substitutions?: string[]): string {
  let text: string = messages[lang][key] ?? messages.en[key] ?? key;
  if (substitutions) {
    substitutions.forEach((value, index) => {
      text = text.replace(`{${index}}`, value);
    });
  }
  return text;
}

export async function loadLang(): Promise<Lang> {
  const stored = await chrome.storage.local.get(LANG_STORAGE_KEY);
  const value = stored[LANG_STORAGE_KEY];
  if (value === 'en' || value === 'ru') return value;
  return detectLang(chrome.i18n?.getUILanguage?.());
}

export async function saveLang(lang: Lang): Promise<void> {
  await chrome.storage.local.set({ [LANG_STORAGE_KEY]: lang });
}
