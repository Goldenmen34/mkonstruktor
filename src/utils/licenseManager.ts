import { LicenseTier, IssuedLicenseKey, LicenseStatus } from '../types';

const SECRET_SALT = 'BPL2026_MASTER_SECRET_SALT_SAAS_AUTH';
const REGISTRY_STORAGE_KEY = 'biplaner_issued_keys';

/**
 * Криптографический расчет 4-символьной контрольной подписи
 */
function computeSignature(payload: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  const str = payload + SECRET_SALT;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const combined = Math.abs(h1 ^ h2);
  const code = combined.toString(36).toUpperCase().padStart(4, '9');
  return code.slice(-4);
}

/**
 * Генерация случайного 4-значного токена энтропии
 */
function generateRandomToken(len: number = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // исключены неоднозначные I, O, 0, 1
  let res = '';
  for (let i = 0; i < len; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

export interface GenerateKeyOptions {
  clientName: string;
  tier: LicenseTier;
  durationDays: number; // 30, 90, 180, 365, 9999 (бессрочно)
  notes?: string;
}

/**
 * Генератор криптографических лицензионных ключей МКонструктор
 */
export function generateLicenseKey(opts: GenerateKeyOptions): IssuedLicenseKey {
  let tierChar = 'A';
  if (opts.tier === 'kitchen_pro') tierChar = 'K';
  else if (opts.tier === 'wardrobe_pro') tierChar = 'W';
  else if (opts.tier === 'all_inclusive') tierChar = opts.durationDays >= 9999 ? 'V' : 'A';

  let durationCode = '365';
  if (opts.durationDays <= 30) durationCode = '030';
  else if (opts.durationDays <= 90) durationCode = '090';
  else if (opts.durationDays <= 180) durationCode = '180';
  else if (opts.durationDays <= 365) durationCode = '365';
  else durationCode = 'INF';

  const block1 = `${tierChar}${durationCode}`;
  const block2 = generateRandomToken(4);
  const block3 = computeSignature(block1 + block2);

  // Формат: MK-A365-7M2K-9X4F
  const keyString = `MK-${block1}-${block2}-${block3}`;

  const now = new Date();
  let expiresAt: string | null = null;
  if (opts.durationDays < 9999) {
    const exp = new Date(now.getTime() + opts.durationDays * 24 * 60 * 60 * 1000);
    expiresAt = exp.toISOString();
  }

  const issuedKey: IssuedLicenseKey = {
    id: 'lic_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    key: keyString,
    clientName: opts.clientName.trim() || 'Уважаемый пользователь',
    tier: opts.tier,
    durationDays: opts.durationDays,
    maxModules: 9999,
    issuedAt: now.toISOString(),
    expiresAt,
    status: 'active',
    notes: opts.notes,
  };

  saveIssuedKeyToStorage(issuedKey);
  return issuedKey;
}

export interface VerifyKeyResult {
  isValid: boolean;
  tier: LicenseTier;
  durationDays: number;
  expiresAt: string | null;
  clientName: string;
  message: string;
}

/**
 * Проверка и расшифровка лицензионного ключа
 */
export function verifyAndDecodeLicenseKey(rawKey: string): VerifyKeyResult {
  const trimmed = rawKey.trim().toUpperCase();

  // 1. Проверка предустановленных мастер-ключей разработчика
  if (
    trimmed === 'MK-VIP-2026' ||
    trimmed === 'MK-ALL-PRO' ||
    trimmed === 'MK-PRO-LIFETIME' ||
    trimmed === 'BPL-VIP-2026' ||
    trimmed === 'BPL-ALL-PRO' ||
    trimmed === 'BPL-PRO-LIFETIME'
  ) {
    const isLifetime = trimmed === 'MK-PRO-LIFETIME' || trimmed === 'BPL-PRO-LIFETIME';
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + (isLifetime ? 9999 : 365));
    return {
      isValid: true,
      tier: 'all_inclusive',
      durationDays: isLifetime ? 9999 : 365,
      expiresAt: isLifetime ? null : expDate.toISOString(),
      clientName: isLifetime ? 'VIP Разработчик (Пожизненный)' : 'Премиум Клиент (Кухни + Шкафы)',
      message: isLifetime
        ? 'Пожизненный VIP доступ успешно активирован! Все модули открыты навсегда.'
        : 'Лицензия успешно активирована на 1 год! Доступ ко всем модулям открыт.',
    };
  }

  if (trimmed === 'MK-KITCHEN-PRO' || trimmed === 'BPL-KITCHEN-PRO') {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + 90);
    return {
      isValid: true,
      tier: 'kitchen_pro',
      durationDays: 90,
      expiresAt: expDate.toISOString(),
      clientName: 'Кухонная фабрика (Тариф Кухни)',
      message: 'Лицензия активирована на 90 дней (Модуль: Кухни).',
    };
  }

  if (trimmed === 'MK-WARDROBE-PRO' || trimmed === 'BPL-WARDROBE-PRO') {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + 90);
    return {
      isValid: true,
      tier: 'wardrobe_pro',
      durationDays: 90,
      expiresAt: expDate.toISOString(),
      clientName: 'Шкафы и Гардеробные (Тариф Шкафы)',
      message: 'Лицензия активирована на 90 дней (Модуль: Шкафы).',
    };
  }

  // 2. Проверка ключей генератора МКонструктор криптографического стандарта:
  // Формат: MK-{T}{DAYS}-{TOKEN}-{SIG} (или BPL-)
  const match = trimmed.match(/^(?:MK|BPL)-([KWAV])(030|090|180|365|INF)-([A-Z0-9]{4})-([A-Z0-9]{4})$/);
  if (match) {
    const tierChar = match[1];
    const durationCode = match[2];
    const block2 = match[3];
    const block3 = match[4];

    const block1 = `${tierChar}${durationCode}`;
    const expectedSig = computeSignature(block1 + block2);

    if (block3 === expectedSig) {
      let tier: LicenseTier = 'all_inclusive';
      if (tierChar === 'K') tier = 'kitchen_pro';
      else if (tierChar === 'W') tier = 'wardrobe_pro';
      else if (tierChar === 'V') tier = 'all_inclusive';

      let durationDays = 365;
      if (durationCode === '030') durationDays = 30;
      else if (durationCode === '090') durationDays = 90;
      else if (durationCode === '180') durationDays = 180;
      else if (durationCode === '365') durationDays = 365;
      else if (durationCode === 'INF') durationDays = 9999;

      const registered = getIssuedKeysFromStorage().find((k) => k.key === trimmed);
      const clientName = registered?.clientName || (durationDays >= 9999 ? 'VIP Лицензия (Бессрочная)' : `Лицензия МКонструктор (${durationDays} дней)`);

      const now = new Date();
      let expiresAt: string | null = null;
      if (durationDays < 9999) {
        const exp = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
        expiresAt = exp.toISOString();
      }

      return {
        isValid: true,
        tier,
        durationDays,
        expiresAt,
        clientName,
        message: durationDays >= 9999
          ? `Бессрочная VIP лицензия принята! Демо-режим полностью отключен.`
          : `Лицензия успешно активирована на ${durationDays} дней! Лимит секций снят.`,
      };
    }
  }

  // 3. Фолбэк для стандартных 16-значных ключей BPL-XXXX-YYYY-ZZZZ
  if (/^BPL-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(trimmed)) {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + 30);
    return {
      isValid: true,
      tier: 'all_inclusive',
      durationDays: 30,
      expiresAt: expDate.toISOString(),
      clientName: 'Клиент подписки (Стандарт)',
      message: 'Лицензия BPL принята! Подписка активна 30 дней.',
    };
  }

  return {
    isValid: false,
    tier: 'demo',
    durationDays: 0,
    expiresAt: null,
    clientName: 'Демо доступ',
    message: 'Неверный лицензионный ключ. Проверьте правильность ввода.',
  };
}

/**
 * Получение реестра всех выданных ключей из localStorage
 */
export function getIssuedKeysFromStorage(): IssuedLicenseKey[] {
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load issued keys from storage:', e);
    return [];
  }
}

/**
 * Сохранение выданного ключа в реестр
 */
export function saveIssuedKeyToStorage(keyObj: IssuedLicenseKey): void {
  try {
    const current = getIssuedKeysFromStorage();
    const updated = [keyObj, ...current.filter((k) => k.id !== keyObj.id)];
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save issued key:', e);
  }
}

/**
 * Удаление ключа из реестра
 */
export function deleteIssuedKeyFromStorage(id: string): void {
  try {
    const current = getIssuedKeysFromStorage();
    const updated = current.filter((k) => k.id !== id);
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to delete issued key:', e);
  }
}

/**
 * Форматирование коммерческой карточки лицензии для отправки клиенту
 */
export function formatLicenseTextCard(lic: IssuedLicenseKey): string {
  const tierName =
    lic.tier === 'kitchen_pro'
      ? 'Кухни PRO'
      : lic.tier === 'wardrobe_pro'
      ? 'Шкафы PRO'
      : 'Всё включено (Кухни + Шкафы PRO VIP)';

  const expString = lic.expiresAt
    ? new Date(lic.expiresAt).toLocaleDateString('ru-RU')
    : 'Пожизненная (Бессрочный доступ)';

  return `═══════════════════════════════════════
  ЛИЦЕНЗИОННЫЙ СЕРТИФИКАТ МКонструктор 3D
═══════════════════════════════════════
Клиент: ${lic.clientName}
Тариф: ${tierName}
Срок действия: ${lic.durationDays >= 9999 ? 'Бессрочно' : `${lic.durationDays} дней`} (до ${expString})
Лимит секций: Не ограничен (PRO Режим)
Дата выпуска: ${new Date(lic.issuedAt).toLocaleDateString('ru-RU')}

ВАШ КЛЮЧ АКТИВАЦИИ:
👉  ${lic.key}  👈

Инструкция по активации:
1. Откройте 3D-конструктор МКонструктор.
2. В верхнем правом углу нажмите «Демо-доступ» или иконку ключа.
3. Вставьте данный ключ и нажмите «Активировать».
═══════════════════════════════════════`;
}
