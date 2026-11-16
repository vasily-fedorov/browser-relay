import { describe, expect, it } from 'vitest';
import { detectLang, messageKeys, translate } from '@/entrypoints/popup/i18n';
import { detectPickerLang, pickerText } from '@/shared/element-picker/strings';

describe('popup i18n', () => {
  it('ships the same keys for en and ru', () => {
    for (const key of messageKeys) {
      expect(translate('en', key)).not.toBe('');
      expect(translate('ru', key)).not.toBe('');
      expect(translate('ru', key)).not.toBe(key);
    }
  });

  it('keeps Russian and English wording distinct', () => {
    expect(translate('en', 'connect')).toBe('Connect');
    expect(translate('ru', 'connect')).toBe('Подключиться');
  });

  it('substitutes placeholders', () => {
    expect(translate('en', 'toolsCount', ['23'])).toBe('Tools: 23');
    expect(translate('ru', 'toolsCount', ['23'])).toBe('Инструментов: 23');
  });

  it('detects the default language from the browser UI locale', () => {
    expect(detectLang('ru')).toBe('ru');
    expect(detectLang('ru-RU')).toBe('ru');
    expect(detectLang('en-US')).toBe('en');
    expect(detectLang('de-DE')).toBe('en');
    expect(detectLang(undefined)).toBe('en');
  });
});

describe('element picker i18n', () => {
  it('renders both languages', () => {
    expect(pickerText('en', 'title')).toBe('Element Picker');
    expect(pickerText('ru', 'title')).toBe('Выбор элементов');
    expect(pickerText('ru', 'progress', ['1', '3'])).toBe('Выбрано 1/3');
  });

  it('falls back to English for unknown browser locales', () => {
    expect(detectPickerLang('fr-FR')).toBe('en');
    expect(detectPickerLang('ru-RU')).toBe('ru');
  });
});
