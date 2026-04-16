import type { StoreOrderStatus } from '../../admin/types/admin.types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../admin/types/admin.types';

const COLOR_CLASSES: Record<string, string> = {
  amber:  'bg-amber-100 text-amber-800',
  blue:   'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
  cyan:   'bg-cyan-100 text-cyan-800',
  teal:   'bg-teal-100 text-teal-800',
  green:  'bg-green-100 text-green-800',
  red:    'bg-red-100 text-red-800',
};

interface Props {
  status: StoreOrderStatus;
  className?: string;
}

export default function OrderStatusBadge({ status, className = '' }: Props) {
  const color = ORDER_STATUS_COLORS[status] ?? 'gray';
  const classes = COLOR_CLASSES[color] ?? 'bg-gray-100 text-gray-800';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes} ${className}`}>
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}
