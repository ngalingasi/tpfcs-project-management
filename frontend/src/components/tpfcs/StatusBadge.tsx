
const STATUS_STYLES: Record<string, string> = {
  pending:     'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  on_hold:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  completed:   'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  cancelled:   'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  overdue:     'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  // objective
  pending_obj: 'bg-gray-100 text-gray-700',
  // target
  on_track:    'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  at_risk:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  off_track:   'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  achieved:    'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300',
  missed:      'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  // site
  planned:     'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  active:      'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
};

const STATUS_LABELS: Record<string, string> = {
  pending:     'Pending',
  in_progress: 'In Progress',
  on_hold:     'On Hold',
  completed:   'Completed',
  cancelled:   'Cancelled',
  overdue:     'Overdue',
  on_track:    'On Track',
  at_risk:     'At Risk',
  off_track:   'Off Track',
  achieved:    'Achieved',
  missed:      'Missed',
  planned:     'Planned',
  active:      'Active',
};

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: Props) {
  const cls  = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700';
  const label = STATUS_LABELS[status] ?? status;
  const pad  = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${pad} ${cls}`}>
      {label}
    </span>
  );
}
