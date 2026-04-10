import { Phone, MapPin, Clock } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';

function formatAddress(raw: unknown): string {
  if (!raw) return '';
  if (typeof raw === 'object' && raw !== null) {
    const a = raw as Record<string, string>;
    return [
      a.rua,
      a.numero  && `, ${a.numero}`,
      a.bairro  && ` - ${a.bairro}`,
      a.cidade  && `, ${a.cidade}`,
      a.estado  && `/${a.estado}`,
    ].filter(Boolean).join('');
  }
  return String(raw);
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

interface BHInterval { start: string; end: string }
interface BHDay { open?: boolean; intervals?: BHInterval[]; start?: string; end?: string }

function normalizeDay(d: BHDay | undefined): BHInterval[] {
  if (!d?.open) return [];
  if (Array.isArray(d.intervals) && d.intervals.length > 0) {
    return d.intervals
      .filter((i) => typeof i?.start === 'string' && typeof i?.end === 'string')
      .map((i) => ({ start: i.start, end: i.end }))
      .sort((a, b) => a.start.localeCompare(b.start));
  }
  if (typeof d.start === 'string' && typeof d.end === 'string') {
    return [{ start: d.start, end: d.end }];
  }
  return [{ start: '07:00', end: '17:00' }];
}

function formatIntervals(intervals: BHInterval[]): string {
  return intervals.map((i) => `${fmtTime(i.start)} às ${fmtTime(i.end)}`).join(' e ');
}

function formatBusinessHours(raw: unknown): string {
  if (!raw) return '';
  let bh: Record<string, BHDay> = {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === 'object') bh = parsed as typeof bh;
    else return '';
  } catch { return ''; }

  const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const openDays: { idx: number; name: string; intervals: BHInterval[]; signature: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const intervals = normalizeDay(bh[String(i)]);
    if (intervals.length === 0) continue;
    openDays.push({
      idx: i,
      name: DAYS[i],
      intervals,
      signature: intervals.map((it) => `${it.start}-${it.end}`).join('|'),
    });
  }
  if (openDays.length === 0) return '';

  // Agrupa dias consecutivos com o mesmo conjunto de intervalos.
  const groups: { names: string[]; lastIdx: number; intervals: BHInterval[]; signature: string }[] = [];
  for (const day of openDays) {
    const last = groups[groups.length - 1];
    if (last && last.signature === day.signature && last.lastIdx + 1 === day.idx) {
      last.names.push(day.name);
      last.lastIdx = day.idx;
    } else {
      groups.push({ names: [day.name], lastIdx: day.idx, intervals: day.intervals, signature: day.signature });
    }
  }

  return groups.map((g) => {
    const label = g.names.length === 1 ? g.names[0] : `${g.names[0]} - ${g.names[g.names.length - 1]}`;
    return `${label}: ${formatIntervals(g.intervals)}`;
  }).join(', ');
}

export default function Header() {
  const { settings } = useSettings('general');

  const phone   = (settings.phone as string) || '(81) 3721-4787';
  const address = formatAddress(settings.address) || 'Rua Marcílio Dias, 99 - São Francisco, Caruaru/PE';
  const hours   = formatBusinessHours(settings.business_hours);

  return (
    <header className="bg-[#003876] text-white">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-2 text-sm">
          <div className="hidden md:flex items-center space-x-6">
            <div className="flex items-center">
              <Phone size={16} className="mr-2" />
              <span>{phone}</span>
            </div>
            <div className="flex items-center">
              <MapPin size={16} className="mr-2" />
              <span>{address}</span>
            </div>
            {hours && (
              <div className="flex items-center">
                <Clock size={16} className="mr-2" />
                <span>{hours}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
