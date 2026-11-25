import {
  Award,
  Baby,
  BadgeDollarSign,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Camera,
  Car,
  Coffee,
  Coins,
  Crown,
  Droplets,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  LineChart,
  Music,
  Package,
  PawPrint,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  Rocket,
  RotateCcw,
  Scale,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Stethoscope,
  Store,
  TrendingUp,
  Tv,
  Users,
  Utensils,
  Vault,
  Wifi,
  Wine,
  Wrench,
  Zap,
} from 'lucide-react';

interface CategoryIconBadgeProps {
  iconId: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}

const ICON_COMPONENTS = {
  utensils: Utensils,
  'shopping-cart': ShoppingCart,
  coffee: Coffee,
  home: Home,
  zap: Zap,
  droplets: Droplets,
  wifi: Wifi,
  smartphone: Smartphone,
  fuel: Fuel,
  bus: Bus,
  car: Car,
  'heart-pulse': HeartPulse,
  stethoscope: Stethoscope,
  baby: Baby,
  dumbbell: Dumbbell,
  'shopping-bag': ShoppingBag,
  shirt: Shirt,
  repeat: Repeat,
  film: Film,
  tv: Tv,
  'gamepad-2': Gamepad2,
  music: Music,
  plane: Plane,
  'graduation-cap': GraduationCap,
  'book-open': BookOpen,
  'paw-print': PawPrint,
  gift: Gift,
  sparkles: Sparkles,
  wine: Wine,
  camera: Camera,
  wrench: Wrench,
  package: Package,
  briefcase: Briefcase,
  laptop: Laptop,
  store: Store,
  'trending-up': TrendingUp,
  'line-chart': LineChart,
  'building-2': Building2,
  award: Award,
  'rotate-ccw': RotateCcw,
  rocket: Rocket,
  crown: Crown,
  'badge-dollar-sign': BadgeDollarSign,
  coins: Coins,
  'piggy-bank': PiggyBank,
  vault: Vault,
  receipt: Receipt,
  'shield-check': ShieldCheck,
  'heart-handshake': HeartHandshake,
  users: Users,
  scale: Scale,
  landmark: Landmark,
} as const;

export function CategoryIconBadge({ iconId, color, size = 'md' }: CategoryIconBadgeProps) {
  const Icon = ICON_COMPONENTS[iconId as keyof typeof ICON_COMPONENTS] ?? Utensils;

  const boxSize =
    size === 'sm' ? 'h-9 w-9 rounded-xl' : size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-11 w-11 rounded-2xl';
  const iconSize = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';

  return (
    <div
      className={`${boxSize} flex shrink-0 items-center justify-center border select-none`}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 16%, rgba(26,26,28,0.5))`,
        borderColor: `color-mix(in srgb, ${color} 38%, transparent)`,
        color,
      }}
    >
      <Icon className={iconSize} />
    </div>
  );
}

