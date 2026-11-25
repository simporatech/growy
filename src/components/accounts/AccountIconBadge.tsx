import { getAccountIconById } from '../../data/accountIcons';
import { AccountType } from '../../types/finance';

interface AccountIconBadgeProps {
  iconId: string;
  color: string;
  accountType?: AccountType;
  size?: 'sm' | 'md' | 'lg';
}

export function AccountIconBadge({
  iconId,
  color,
  accountType,
  size = 'md',
}: AccountIconBadgeProps) {
  const entry = getAccountIconById(iconId, accountType);
  const Icon = entry.icon;

  const boxSize =
    size === 'sm' ? 'h-9 w-9 rounded-xl' : size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-11 w-11 rounded-2xl';
  const iconSize = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';

  return (
    <div
      className={`${boxSize} relative flex shrink-0 items-center justify-center border select-none overflow-hidden`}
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
