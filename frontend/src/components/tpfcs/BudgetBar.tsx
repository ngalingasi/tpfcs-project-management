interface Props {
  value: number;  // 0-100
  label?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red';
}

const COLORS = {
  blue:   'bg-blue-500',
  green:  'bg-green-500',
  yellow: 'bg-yellow-500',
  red:    'bg-red-500',
};

export default function BudgetBar({ value, label, color = 'blue' }: Props) {
  const pct   = Math.min(Math.max(value, 0), 100);
  const auto  = pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green';
  const bar   = COLORS[color === 'blue' ? auto : color];

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{pct.toFixed(1)}%</span>
        </div>
      )}
      <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
