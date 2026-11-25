import type { Locale } from '../context/AuthContext';

export interface DetectedUserEnvironment {
  language: Locale;
  currency: string;
  timezone: string;
}

const SUPPORTED_CURRENCY_CODES = new Set([
  'ARS', 'AUD', 'BBD', 'BOB', 'BRL', 'BSD', 'BZD', 'CAD', 'CHF', 'CLP',
  'CNY', 'COP', 'CRC', 'CUP', 'DOP', 'EUR', 'GBP', 'GTQ', 'GYD', 'HKD',
  'HNL', 'HTG', 'INR', 'JMD', 'JPY', 'MXN', 'NIO', 'PAB', 'PEN', 'PYG',
  'SRD', 'TTD', 'USD', 'UYU', 'VES', 'XCD',
]);

const TIMEZONE_CURRENCY_MAP: Record<string, string> = {
  'America/Tegucigalpa': 'HNL',
  'America/Guatemala': 'GTQ',
  'America/Mexico_City': 'MXN',
  'America/Monterrey': 'MXN',
  'America/Cancun': 'MXN',
  'America/Tijuana': 'MXN',
  'America/Merida': 'MXN',
  'America/Chihuahua': 'MXN',
  'America/Hermosillo': 'MXN',
  'America/Mazatlan': 'MXN',
  'America/Costa_Rica': 'CRC',
  'America/Managua': 'NIO',
  'America/El_Salvador': 'USD',
  'America/Panama': 'USD',
  'America/New_York': 'USD',
  'America/Chicago': 'USD',
  'America/Denver': 'USD',
  'America/Los_Angeles': 'USD',
  'America/Phoenix': 'USD',
  'America/Anchorage': 'USD',
  'Pacific/Honolulu': 'USD',
  'America/Bogota': 'COP',
  'America/Lima': 'PEN',
  'America/Santiago': 'CLP',
  'America/Sao_Paulo': 'BRL',
  'America/Santo_Domingo': 'DOP',
  'America/Caracas': 'VES',
  'America/Montevideo': 'UYU',
  'America/Asuncion': 'PYG',
  'America/La_Paz': 'BOB',
  'America/Havana': 'CUP',
  'America/Port-au-Prince': 'HTG',
  'America/Belize': 'BZD',
  'America/Jamaica': 'JMD',
  'America/Toronto': 'CAD',
  'America/Vancouver': 'CAD',
  'America/Montreal': 'CAD',
  'Europe/London': 'GBP',
  'Europe/Zurich': 'CHF',
  'Europe/Madrid': 'EUR',
  'Europe/Berlin': 'EUR',
  'Europe/Paris': 'EUR',
  'Europe/Rome': 'EUR',
  'Europe/Amsterdam': 'EUR',
  'Europe/Lisbon': 'EUR',
  'Europe/Brussels': 'EUR',
  'Europe/Vienna': 'EUR',
  'Europe/Dublin': 'EUR',
  'Asia/Tokyo': 'JPY',
  'Asia/Shanghai': 'CNY',
  'Asia/Hong_Kong': 'HKD',
  'Asia/Kolkata': 'INR',
  'Australia/Sydney': 'AUD',
  'Australia/Melbourne': 'AUD',
};

const REGION_CURRENCY_MAP: Record<string, string> = {
  HN: 'HNL',
  GT: 'GTQ',
  MX: 'MXN',
  CR: 'CRC',
  NI: 'NIO',
  SV: 'USD',
  PA: 'USD',
  US: 'USD',
  CO: 'COP',
  PE: 'PEN',
  CL: 'CLP',
  AR: 'ARS',
  BR: 'BRL',
  DO: 'DOP',
  VE: 'VES',
  UY: 'UYU',
  PY: 'PYG',
  BO: 'BOB',
  CU: 'CUP',
  HT: 'HTG',
  BZ: 'BZD',
  JM: 'JMD',
  CA: 'CAD',
  GB: 'GBP',
  CH: 'CHF',
  ES: 'EUR',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  PT: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  IE: 'EUR',
  JP: 'JPY',
  CN: 'CNY',
  HK: 'HKD',
  IN: 'INR',
  AU: 'AUD',
};

function resolveCurrencyFromTimezone(timezone: string): string | null {
  if (TIMEZONE_CURRENCY_MAP[timezone]) {
    return TIMEZONE_CURRENCY_MAP[timezone];
  }
  if (timezone.startsWith('America/Argentina/')) {
    return 'ARS';
  }
  if (timezone.startsWith('Europe/')) {
    return 'EUR';
  }
  return null;
}

function resolveCurrencyFromLocale(localeTag: string): string | null {
  const parts = localeTag.replace('_', '-').split('-');
  for (let i = 1; i < parts.length; i++) {
    const subtag = parts[i].toUpperCase();
    if (subtag.length === 2 && REGION_CURRENCY_MAP[subtag]) {
      return REGION_CURRENCY_MAP[subtag];
    }
  }
  return null;
}

/**
 * Pure, deterministic detection of the user's browser language, IANA timezone,
 * and best-matching supported currency.
 */
export function detectUserEnvironment(): DetectedUserEnvironment {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const rawLocale = nav?.languages?.[0] || nav?.language || 'en';
  const primaryLang = rawLocale.replace('_', '-').split('-')[0].toLowerCase();
  const language: Locale = primaryLang === 'es' ? 'es' : 'en';

  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    timezone = 'UTC';
  }

  const candidateCurrency =
    resolveCurrencyFromTimezone(timezone) ?? resolveCurrencyFromLocale(rawLocale) ?? 'USD';

  const currency = SUPPORTED_CURRENCY_CODES.has(candidateCurrency) ? candidateCurrency : 'USD';

  return { language, currency, timezone };
}

export function getActiveTimeZone(preferredTimeZone?: string): string {
  if (preferredTimeZone) return preferredTimeZone;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Formats a Date as 'YYYY-MM-DD' in the specified (or browser-resolved) IANA timezone
 * rather than UTC, avoiding off-by-one evening date shifts.
 */
export function formatDateYYYYMMDD(date: Date, timeZone?: string): string {
  const tz = getActiveTimeZone(timeZone);
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

