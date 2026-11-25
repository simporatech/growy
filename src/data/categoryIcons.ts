import { Locale } from '../context/AuthContext';

export type CategoryIconGroup = 'essentials' | 'lifestyle' | 'income' | 'financial';

export interface CategoryIconEntry {
  id: string;
  label: { en: string; es: string };
  group: CategoryIconGroup;
  keywords: string[];
}

export const CATEGORY_ICONS: CategoryIconEntry[] = [
  // Essentials (14)
  { id: 'utensils', label: { en: 'Food & Dining', es: 'Comida y Restaurantes' }, group: 'essentials', keywords: ['food', 'dining', 'restaurant', 'comida', 'restaurante'] },
  { id: 'shopping-cart', label: { en: 'Groceries', es: 'Supermercado' }, group: 'essentials', keywords: ['groceries', 'supermarket', 'supermercado', 'despensa'] },
  { id: 'coffee', label: { en: 'Coffee', es: 'Café' }, group: 'essentials', keywords: ['coffee', 'cafe', 'drink', 'cafeteria'] },
  { id: 'home', label: { en: 'Housing & Rent', es: 'Vivienda y Renta' }, group: 'essentials', keywords: ['rent', 'home', 'house', 'housing', 'vivienda', 'renta', 'casa'] },
  { id: 'zap', label: { en: 'Utilities', es: 'Servicios básicos' }, group: 'essentials', keywords: ['utilities', 'electricity', 'power', 'luz', 'energia', 'servicios'] },
  { id: 'droplets', label: { en: 'Water', es: 'Agua' }, group: 'essentials', keywords: ['water', 'utility', 'agua'] },
  { id: 'wifi', label: { en: 'Internet', es: 'Internet' }, group: 'essentials', keywords: ['internet', 'wifi', 'fiber', 'fibra'] },
  { id: 'smartphone', label: { en: 'Phone', es: 'Telefonía' }, group: 'essentials', keywords: ['phone', 'mobile', 'cell', 'telefono', 'celular'] },
  { id: 'fuel', label: { en: 'Fuel & Gas', es: 'Combustible' }, group: 'essentials', keywords: ['fuel', 'gas', 'transport', 'gasolina', 'combustible'] },
  { id: 'bus', label: { en: 'Transport', es: 'Transporte' }, group: 'essentials', keywords: ['bus', 'transit', 'transport', 'commute', 'transporte'] },
  { id: 'car', label: { en: 'Car & Auto', es: 'Vehículo' }, group: 'essentials', keywords: ['car', 'auto', 'vehicle', 'carro', 'vehiculo'] },
  { id: 'heart-pulse', label: { en: 'Health', es: 'Salud' }, group: 'essentials', keywords: ['health', 'medical', 'doctor', 'salud', 'medico'] },
  { id: 'stethoscope', label: { en: 'Clinic & Pharmacy', es: 'Clínica y Farmacia' }, group: 'essentials', keywords: ['clinic', 'hospital', 'pharmacy', 'clinica', 'farmacia'] },
  { id: 'baby', label: { en: 'Childcare', es: 'Cuidado infantil' }, group: 'essentials', keywords: ['childcare', 'baby', 'kids', 'bebe', 'hijos'] },

  // Lifestyle (18)
  { id: 'dumbbell', label: { en: 'Gym & Fitness', es: 'Gimnasio' }, group: 'lifestyle', keywords: ['gym', 'fitness', 'workout', 'gimnasio', 'deporte'] },
  { id: 'shopping-bag', label: { en: 'Shopping', es: 'Compras' }, group: 'lifestyle', keywords: ['shopping', 'retail', 'compras', 'tienda'] },
  { id: 'shirt', label: { en: 'Clothing', es: 'Ropa' }, group: 'lifestyle', keywords: ['clothing', 'apparel', 'fashion', 'ropa', 'moda'] },
  { id: 'repeat', label: { en: 'Subscriptions', es: 'Suscripciones' }, group: 'lifestyle', keywords: ['subscriptions', 'recurring', 'suscripciones'] },
  { id: 'film', label: { en: 'Entertainment', es: 'Entretenimiento' }, group: 'lifestyle', keywords: ['entertainment', 'movies', 'cine', 'entretenimiento'] },
  { id: 'tv', label: { en: 'Streaming', es: 'Streaming' }, group: 'lifestyle', keywords: ['streaming', 'tv', 'netflix'] },
  { id: 'gamepad-2', label: { en: 'Gaming', es: 'Videojuegos' }, group: 'lifestyle', keywords: ['gaming', 'games', 'videojuegos', 'consola'] },
  { id: 'music', label: { en: 'Music', es: 'Música' }, group: 'lifestyle', keywords: ['music', 'spotify', 'concert', 'musica'] },
  { id: 'plane', label: { en: 'Flights & Travel', es: 'Viajes y Vuelos' }, group: 'lifestyle', keywords: ['travel', 'flights', 'vacation', 'viajes', 'vuelos'] },
  { id: 'graduation-cap', label: { en: 'Education', es: 'Educación' }, group: 'lifestyle', keywords: ['education', 'tuition', 'college', 'educacion', 'universidad'] },
  { id: 'book-open', label: { en: 'Books', es: 'Libros' }, group: 'lifestyle', keywords: ['books', 'reading', 'study', 'libros', 'lectura'] },
  { id: 'paw-print', label: { en: 'Pets', es: 'Mascotas' }, group: 'lifestyle', keywords: ['pets', 'dog', 'cat', 'vet', 'mascotas', 'veterinario'] },
  { id: 'gift', label: { en: 'Gifts', es: 'Regalos' }, group: 'lifestyle', keywords: ['gifts', 'present', 'regalos'] },
  { id: 'sparkles', label: { en: 'Personal Care', es: 'Cuidado personal' }, group: 'lifestyle', keywords: ['beauty', 'personal care', 'belleza', 'cuidado'] },
  { id: 'wine', label: { en: 'Social & Nights', es: 'Salidas sociales' }, group: 'lifestyle', keywords: ['social', 'bar', 'drinks', 'salidas', 'bebidas'] },
  { id: 'camera', label: { en: 'Hobbies', es: 'Pasatiempos' }, group: 'lifestyle', keywords: ['hobby', 'camera', 'photo', 'pasatiempos', 'fotografia'] },
  { id: 'wrench', label: { en: 'Repairs', es: 'Reparaciones' }, group: 'lifestyle', keywords: ['repairs', 'tools', 'reparaciones', 'mantenimiento'] },
  { id: 'package', label: { en: 'Deliveries', es: 'Envíos y Paquetes' }, group: 'lifestyle', keywords: ['delivery', 'package', 'shipping', 'envios', 'paquetes'] },

  // Income (12)
  { id: 'briefcase', label: { en: 'Salary', es: 'Salario' }, group: 'income', keywords: ['salary', 'payroll', 'job', 'salario', 'sueldo', 'nomina'] },
  { id: 'laptop', label: { en: 'Freelance', es: 'Freelance' }, group: 'income', keywords: ['freelance', 'consulting', 'consultoria', 'remoto'] },
  { id: 'store', label: { en: 'Business Sales', es: 'Ventas de negocio' }, group: 'income', keywords: ['business', 'sales', 'revenue', 'ventas', 'negocio'] },
  { id: 'trending-up', label: { en: 'Investments', es: 'Inversiones' }, group: 'income', keywords: ['investments', 'dividends', 'stocks', 'inversiones'] },
  { id: 'line-chart', label: { en: 'Trading & Yield', es: 'Rendimientos' }, group: 'income', keywords: ['trading', 'yield', 'returns', 'rendimientos'] },
  { id: 'building-2', label: { en: 'Rental Income', es: 'Ingresos por renta' }, group: 'income', keywords: ['rental', 'property', 'alquiler', 'renta'] },
  { id: 'award', label: { en: 'Bonus', es: 'Bonos' }, group: 'income', keywords: ['bonus', 'reward', 'bonos', 'aguinaldo'] },
  { id: 'rotate-ccw', label: { en: 'Refunds', es: 'Reembolsos' }, group: 'income', keywords: ['refund', 'cashback', 'reimbursement', 'reembolso'] },
  { id: 'rocket', label: { en: 'Side Hustle', es: 'Proyecto extra' }, group: 'income', keywords: ['side hustle', 'project', 'emprendimiento'] },
  { id: 'crown', label: { en: 'Royalties', es: 'Regalías' }, group: 'income', keywords: ['royalties', 'licensing', 'regalias'] },
  { id: 'badge-dollar-sign', label: { en: 'Commissions', es: 'Comisiones' }, group: 'income', keywords: ['commission', 'payout', 'comisiones'] },
  { id: 'coins', label: { en: 'Dividends', es: 'Dividendos' }, group: 'income', keywords: ['dividends', 'interest', 'dividendos', 'intereses'] },

  // Financial & Goals (8)
  { id: 'piggy-bank', label: { en: 'Savings Goal', es: 'Meta de ahorro' }, group: 'financial', keywords: ['savings', 'goal', 'emergency', 'ahorro', 'emergencia'] },
  { id: 'vault', label: { en: 'Reserve Fund', es: 'Fondo de reserva' }, group: 'financial', keywords: ['reserve', 'safe', 'fund', 'reserva', 'fondo'] },
  { id: 'receipt', label: { en: 'Taxes', es: 'Impuestos' }, group: 'financial', keywords: ['taxes', 'irs', 'impuestos'] },
  { id: 'shield-check', label: { en: 'Insurance', es: 'Seguros' }, group: 'financial', keywords: ['insurance', 'coverage', 'seguros', 'poliza'] },
  { id: 'heart-handshake', label: { en: 'Charity & Giving', es: 'Donaciones' }, group: 'financial', keywords: ['charity', 'donation', 'giving', 'donaciones', 'caridad'] },
  { id: 'users', label: { en: 'Family Support', es: 'Apoyo familiar' }, group: 'financial', keywords: ['family', 'support', 'familia', 'apoyo'] },
  { id: 'scale', label: { en: 'Legal & Fees', es: 'Gastos legales' }, group: 'financial', keywords: ['legal', 'fees', 'accounting', 'contabilidad'] },
  { id: 'landmark', label: { en: 'Bank Fees', es: 'Comisiones bancarias' }, group: 'financial', keywords: ['bank', 'fee', 'loan', 'banco', 'prestamo'] },
];

const CATEGORY_ICON_MAP = new Map(CATEGORY_ICONS.map((item) => [item.id, item]));

export function getCategoryIconById(id: string): CategoryIconEntry {
  return CATEGORY_ICON_MAP.get(id) ?? CATEGORY_ICON_MAP.get('utensils')!;
}

export function getCategoryIconLabel(entry: CategoryIconEntry, language: Locale): string {
  return entry.label[language] ?? entry.label.en;
}
