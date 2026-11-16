export type PickerLang = 'en' | 'ru';

const LANG_STORAGE_KEY = 'uiLanguage';

const strings = {
  en: {
    title: 'Element Picker',
    subtitle: 'Click on the requested elements',
    hint: 'Click on each element the AI needs. Press Esc to cancel.',
    progress: '{0}/{1} selected',
    cancel: 'Cancel',
    confirm: 'Confirm',
    pending: 'Pending',
    picking: 'Picking…',
    selected: 'Selected',
    pick: 'Pick',
    clear: 'Clear',
  },
  ru: {
    title: 'Выбор элементов',
    subtitle: 'Нажмите на нужные элементы',
    hint: 'Нажмите на каждый элемент, который нужен ассистенту. Esc — отмена.',
    progress: 'Выбрано {0}/{1}',
    cancel: 'Отмена',
    confirm: 'Подтвердить',
    pending: 'Ожидает',
    picking: 'Выбор…',
    selected: 'Выбрано',
    pick: 'Выбрать',
    clear: 'Сбросить',
  },
} as const;

export type PickerStringKey = keyof (typeof strings)['en'];

export function pickerText(
  lang: PickerLang,
  key: PickerStringKey,
  substitutions?: string[],
): string {
  let text: string = strings[lang]?.[key] ?? strings.en[key];
  if (substitutions) {
    substitutions.forEach((value, index) => {
      text = text.replace(`{${index}}`, value);
    });
  }
  return text;
}

export function detectPickerLang(uiLanguage: string | undefined): PickerLang {
  return uiLanguage && uiLanguage.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export async function loadPickerLang(): Promise<PickerLang> {
  try {
    const stored = await chrome.storage.local.get(LANG_STORAGE_KEY);
    const value = stored[LANG_STORAGE_KEY];
    if (value === 'en' || value === 'ru') return value;
  } catch {
    // Fall through to the browser UI language.
  }
  return detectPickerLang(chrome.i18n?.getUILanguage?.());
}
