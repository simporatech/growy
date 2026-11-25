import {
  BadgeDollarSign,
  Banknote,
  Briefcase,
  Building2,
  CircleDollarSign,
  Cloud,
  Coins,
  CreditCard,
  Crown,
  DollarSign,
  Euro,
  FolderKanban,
  Gem,
  Globe,
  Landmark,
  Layers,
  Lock,
  LucideIcon,
  PiggyBank,
  PoundSterling,
  QrCode,
  Receipt,
  Scale,
  Send,
  ShieldCheck,
  Smartphone,
  Star,
  Vault,
  Wallet,
  Wifi,
  JapaneseYen,
  Zap,
} from 'lucide-react';
import { Locale } from '../context/AuthContext';
import { AccountType } from '../types/finance';

export type AccountIconCategory = 'banking' | 'cards' | 'cash' | 'digital' | 'reserves';

export interface AccountIconEntry {
  id: string;
  icon: LucideIcon;
  category: AccountIconCategory;
  label: { en: string; es: string };
  keywords: string[];
}

export const ACCOUNT_ICONS: AccountIconEntry[] = [
  // Institutional & Banking
  { id: 'landmark', icon: Landmark, category: 'banking', label: { en: 'Bank', es: 'Banco' }, keywords: ['bank', 'banco', 'institution'] },
  { id: 'building2', icon: Building2, category: 'banking', label: { en: 'Institution', es: 'Institución' }, keywords: ['institution', 'corporate', 'institucion'] },
  { id: 'vault', icon: Vault, category: 'banking', label: { en: 'Vault', es: 'Bóveda' }, keywords: ['vault', 'safe', 'boveda', 'seguro'] },
  { id: 'shield-check', icon: ShieldCheck, category: 'banking', label: { en: 'Protected', es: 'Protegida' }, keywords: ['shield', 'security', 'seguridad', 'protegida'] },
  { id: 'briefcase', icon: Briefcase, category: 'banking', label: { en: 'Business', es: 'Negocios' }, keywords: ['business', 'work', 'negocios', 'empresa'] },
  { id: 'scale', icon: Scale, category: 'banking', label: { en: 'Treasury', es: 'Tesorería' }, keywords: ['treasury', 'balance', 'tesoreria'] },

  // Cards & Payments
  { id: 'creditcard', icon: CreditCard, category: 'cards', label: { en: 'Debit Card', es: 'Tarjeta de Débito' }, keywords: ['card', 'debit', 'tarjeta', 'debito'] },
  { id: 'wifi', icon: Wifi, category: 'cards', label: { en: 'Contactless', es: 'Sin Contacto' }, keywords: ['contactless', 'nfc', 'tap', 'sin contacto'] },
  { id: 'badge-dollar', icon: BadgeDollarSign, category: 'cards', label: { en: 'Checking', es: 'Cuenta Corriente' }, keywords: ['checking', 'corriente', 'cheques'] },
  { id: 'receipt', icon: Receipt, category: 'cards', label: { en: 'Billing', es: 'Facturación' }, keywords: ['billing', 'receipt', 'facturacion', 'recibo'] },
  { id: 'qr-code', icon: QrCode, category: 'cards', label: { en: 'QR Pay', es: 'Pago QR' }, keywords: ['qr', 'pay', 'scan', 'pago'] },

  // Cash & Savings
  { id: 'banknote', icon: Banknote, category: 'cash', label: { en: 'Cash', es: 'Efectivo' }, keywords: ['cash', 'bill', 'efectivo', 'billete'] },
  { id: 'wallet', icon: Wallet, category: 'cash', label: { en: 'Wallet', es: 'Billetera' }, keywords: ['wallet', 'pocket', 'billetera', 'cartera'] },
  { id: 'piggybank', icon: PiggyBank, category: 'cash', label: { en: 'Savings', es: 'Ahorros' }, keywords: ['savings', 'piggy', 'ahorros', 'alcancia'] },
  { id: 'coins', icon: Coins, category: 'cash', label: { en: 'Coins', es: 'Monedas' }, keywords: ['coins', 'change', 'monedas', 'cambio'] },
  { id: 'circledollar', icon: CircleDollarSign, category: 'cash', label: { en: 'Currency', es: 'Divisa' }, keywords: ['currency', 'dollar', 'divisa'] },
  { id: 'dollar-sign', icon: DollarSign, category: 'cash', label: { en: 'Dollar (USD)', es: 'Dólar (USD)' }, keywords: ['usd', 'dollar', 'dolar'] },
  { id: 'euro', icon: Euro, category: 'cash', label: { en: 'Euro (EUR)', es: 'Euro (EUR)' }, keywords: ['eur', 'euro'] },
  { id: 'pound', icon: PoundSterling, category: 'cash', label: { en: 'Pound (GBP)', es: 'Libra (GBP)' }, keywords: ['gbp', 'pound', 'libra'] },
  { id: 'yen', icon: JapaneseYen, category: 'cash', label: { en: 'Yen (JPY)', es: 'Yen (JPY)' }, keywords: ['jpy', 'yen'] },

  // Digital & Global
  { id: 'smartphone', icon: Smartphone, category: 'digital', label: { en: 'Mobile Wallet', es: 'Cartera Móvil' }, keywords: ['mobile', 'phone', 'wallet', 'movil', 'digital'] },
  { id: 'globe', icon: Globe, category: 'digital', label: { en: 'International', es: 'Internacional' }, keywords: ['global', 'international', 'internacional'] },
  { id: 'cloud', icon: Cloud, category: 'digital', label: { en: 'Digital Account', es: 'Cuenta Digital' }, keywords: ['cloud', 'digital', 'online', 'nube'] },
  { id: 'zap', icon: Zap, category: 'digital', label: { en: 'Instant', es: 'Instantánea' }, keywords: ['instant', 'fast', 'instantanea', 'rapida'] },
  { id: 'send', icon: Send, category: 'digital', label: { en: 'Transfers', es: 'Transferencias' }, keywords: ['transfer', 'send', 'transferencias', 'enviar'] },

  // Goals & Reserves
  { id: 'gem', icon: Gem, category: 'reserves', label: { en: 'Reserve', es: 'Reserva' }, keywords: ['reserve', 'wealth', 'reserva', 'patrimonio'] },
  { id: 'crown', icon: Crown, category: 'reserves', label: { en: 'Primary', es: 'Principal' }, keywords: ['primary', 'premium', 'principal'] },
  { id: 'star', icon: Star, category: 'reserves', label: { en: 'Favorite', es: 'Favorita' }, keywords: ['favorite', 'star', 'favorita', 'estrella'] },
  { id: 'lock', icon: Lock, category: 'reserves', label: { en: 'Fixed Savings', es: 'Ahorro Fijo' }, keywords: ['locked', 'fixed', 'plazo', 'fijo'] },
  { id: 'layers', icon: Layers, category: 'reserves', label: { en: 'Multi-Fund', es: 'Multifondo' }, keywords: ['multi', 'fund', 'multifondo'] },
  { id: 'folder-kanban', icon: FolderKanban, category: 'reserves', label: { en: 'Other Account', es: 'Otra Cuenta' }, keywords: ['other', 'custom', 'otra', 'general'] },
];

const ICON_MAP = new Map(ACCOUNT_ICONS.map((icon) => [icon.id, icon]));

const TYPE_FALLBACK_ICON: Record<AccountType, string> = {
  bank: 'landmark',
  debit_card: 'creditcard',
  cash: 'banknote',
  digital_wallet: 'smartphone',
  other: 'folder-kanban',
};

export function getAccountIconById(id: string, fallbackType?: AccountType): AccountIconEntry {
  const exact = ICON_MAP.get(id);
  if (exact) return exact;
  const fallbackId = fallbackType ? TYPE_FALLBACK_ICON[fallbackType] : 'landmark';
  return ICON_MAP.get(fallbackId) ?? ICON_MAP.get('landmark')!;
}

export function getAccountIconLabel(entry: AccountIconEntry, language: Locale): string {
  return entry.label[language] ?? entry.label.en;
}
