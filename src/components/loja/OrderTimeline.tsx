import { Check } from 'lucide-react';
import type { StoreOrderStatus } from '../../admin/types/admin.types';
import { ORDER_STATUS_LABELS } from '../../admin/types/admin.types';

const STATUS_SEQUENCE: StoreOrderStatus[] = [
  'pending_payment',
  'payment_confirmed',
  'picking',
  'ready_for_pickup',
  'picked_up',
  'completed',
];

interface Props {
  status: StoreOrderStatus;
  createdAt: string;
  updatedAt: string;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function OrderTimeline({ status, createdAt, updatedAt }: Props) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <span className="text-red-500 text-lg font-bold">×</span>
        </div>
        <div>
          <p className="text-sm font-medium text-red-600">Pedido Cancelado</p>
          <p className="text-xs text-gray-400">{formatDateTime(updatedAt)}</p>
        </div>
      </div>
    );
  }

  const currentIdx = STATUS_SEQUENCE.indexOf(status);

  return (
    <ol className="relative border-l border-gray-200 ml-4 space-y-4">
      {STATUS_SEQUENCE.map((st, idx) => {
        const completed = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const pending   = idx > currentIdx;

        return (
          <li key={st} className="ml-4">
            {/* dot */}
            <span
              className={`absolute -left-2 flex items-center justify-center w-4 h-4 rounded-full ring-2 ring-white
                ${completed ? 'bg-emerald-500' : isCurrent ? 'bg-brand-primary' : 'bg-gray-200'}`}
            >
              {completed && <Check className="w-2.5 h-2.5 text-white" />}
            </span>

            <p className={`text-sm font-medium ${pending ? 'text-gray-400' : isCurrent ? 'text-brand-primary' : 'text-gray-700'}`}>
              {ORDER_STATUS_LABELS[st]}
            </p>
            {isCurrent && (
              <p className="text-xs text-gray-400">{formatDateTime(idx === 0 ? createdAt : updatedAt)}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
