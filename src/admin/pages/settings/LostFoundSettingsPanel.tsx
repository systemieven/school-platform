/**
 * LostFoundSettingsPanel
 *
 * Painel da aba "Achados e Perdidos" em /admin/configuracoes.
 * 3 seções: Categorias de Objetos, Locais, Regras de Descarte.
 *
 * Gerencia 5 chaves em system_settings (category='general'):
 *   lost_found_types               — JSON array de strings
 *   lost_found_found_locations     — JSON array de strings
 *   lost_found_storage_locations   — JSON array de strings
 *   lost_found_discard_days        — número (dias até elegível para descarte)
 *   lost_found_show_photo_on_portal — boolean
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { SettingsCard } from '../../components/SettingsCard';
import {
  PackageSearch,
  Tag,
  MapPin,
  Trash2,
  Plus,
  Loader2,
  Check,
} from 'lucide-react';

// ── Slider style (mesma abordagem do AcademicoSettingsPanel) ─────────────────

const THUMB_CLS = `absolute inset-x-0 w-full h-full appearance-none bg-transparent cursor-pointer
  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
  [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_#003876,0_2px_6px_rgba(0,0,0,0.25)]
  [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing
  [&::-webkit-slider-thumb]:active:scale-110 [&::-webkit-slider-thumb]:transition-transform
  [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
  [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0
  [&::-moz-range-thumb]:shadow-[0_0_0_3px_#003876,0_2px_6px_rgba(0,0,0,0.25)]`;

// ── Sub-components ───────────────────────────────────────────────────────────

/**
 * Slider de dias reutilizável para a seção de descarte.
 * MIN=7, MAX=180 conforme especificado.
 */
function DaysSlider({
  value,
  onChange,
  label,
  min = 7,
  max = 180,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  min?: number;
  max?: number;
}) {
  const clamped = Math.max(min, Math.min(max, value));
  const pct = ((clamped - min) / (max - min)) * 100;
  const midLabel = Math.round((min + max) / 2);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </span>
        <span className="font-display text-xl font-bold tabular-nums text-brand-primary dark:text-brand-secondary">
          {clamped}
          <span className="text-xs font-normal text-gray-400 ml-0.5">dias</span>
        </span>
      </div>
      <div className="relative h-6 flex items-center">
        <div className="absolute inset-x-0 h-2 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div
          className="absolute h-2 rounded-full bg-gradient-to-r from-brand-primary to-blue-500 pointer-events-none"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={clamped}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className={THUMB_CLS}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1.5 px-0.5">
        <span>{min} dias</span>
        <span>{midLabel} dias</span>
        <span>{max} dias</span>
      </div>
    </div>
  );
}

/**
 * Lista de tags editável: exibe pills existentes com botão X e um input
 * inline para adicionar novos itens.
 */
function TagList({
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (idx: number) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setDraft('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div className="space-y-3">
      {/* Pills */}
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary/10 text-brand-primary text-sm font-medium border border-brand-primary/20"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="text-brand-primary/60 hover:text-brand-primary transition-colors rounded-full p-0.5 hover:bg-brand-primary/10"
                aria-label={`Remover ${item}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">Nenhum item cadastrado.</p>
      )}

      {/* Input de adição */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'Novo item…'}
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!draft.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-brand-primary bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adicionar
        </button>
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LostFoundSettingsPanel() {
  const [loading, setLoading] = useState(true);

  // ── State ──────────────────────────────────────────────────────────────────
  const [types, setTypes]                       = useState<string[]>([]);
  const [foundLocations, setFoundLocations]     = useState<string[]>([]);
  const [storageLocations, setStorageLocations] = useState<string[]>([]);
  const [discardDays, setDiscardDays]           = useState(30);
  const [showPhoto, setShowPhoto]               = useState(false);

  // Originals — para detectar isDirty
  const [original, setOriginal] = useState({
    types:            '[]',
    foundLocations:   '[]',
    storageLocations: '[]',
    discardDays:      30,
    showPhoto:        false,
  });

  // ── Save state ─────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const isDirty =
    JSON.stringify(types) !== original.types ||
    JSON.stringify(foundLocations) !== original.foundLocations ||
    JSON.stringify(storageLocations) !== original.storageLocations ||
    discardDays !== original.discardDays ||
    showPhoto !== original.showPhoto;

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('category', 'general')
      .in('key', [
        'lost_found_types',
        'lost_found_found_locations',
        'lost_found_storage_locations',
        'lost_found_discard_days',
        'lost_found_show_photo_on_portal',
      ]);

    const ss = (data ?? []) as { key: string; value: string }[];

    function getJson<T>(key: string, fallback: T): T {
      const raw = ss.find((s) => s.key === key)?.value;
      if (!raw) return fallback;
      try { return JSON.parse(raw) as T; } catch { return fallback; }
    }

    const t  = getJson<string[]>('lost_found_types', []);
    const fl = getJson<string[]>('lost_found_found_locations', []);
    const sl = getJson<string[]>('lost_found_storage_locations', []);
    const dd = Number(ss.find((s) => s.key === 'lost_found_discard_days')?.value ?? '30');
    const sp = ss.find((s) => s.key === 'lost_found_show_photo_on_portal')?.value === 'true';

    setTypes(t);
    setFoundLocations(fl);
    setStorageLocations(sl);
    setDiscardDays(dd);
    setShowPhoto(sp);

    setOriginal({
      types:            JSON.stringify(t),
      foundLocations:   JSON.stringify(fl),
      storageLocations: JSON.stringify(sl),
      discardDays:      dd,
      showPhoto:        sp,
    });

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Tag helpers ────────────────────────────────────────────────────────────

  function addType(v: string) { setTypes((p) => [...p, v]); }
  function removeType(idx: number) { setTypes((p) => p.filter((_, i) => i !== idx)); }

  function addFoundLocation(v: string) { setFoundLocations((p) => [...p, v]); }
  function removeFoundLocation(idx: number) { setFoundLocations((p) => p.filter((_, i) => i !== idx)); }

  function addStorageLocation(v: string) { setStorageLocations((p) => [...p, v]); }
  function removeStorageLocation(idx: number) { setStorageLocations((p) => p.filter((_, i) => i !== idx)); }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    const now = new Date().toISOString();

    await Promise.all([
      supabase.from('system_settings').upsert(
        { category: 'general', key: 'lost_found_types', value: JSON.stringify(types), updated_at: now },
        { onConflict: 'category,key' },
      ),
      supabase.from('system_settings').upsert(
        { category: 'general', key: 'lost_found_found_locations', value: JSON.stringify(foundLocations), updated_at: now },
        { onConflict: 'category,key' },
      ),
      supabase.from('system_settings').upsert(
        { category: 'general', key: 'lost_found_storage_locations', value: JSON.stringify(storageLocations), updated_at: now },
        { onConflict: 'category,key' },
      ),
      supabase.from('system_settings').upsert(
        { category: 'general', key: 'lost_found_discard_days', value: String(discardDays), updated_at: now },
        { onConflict: 'category,key' },
      ),
      supabase.from('system_settings').upsert(
        { category: 'general', key: 'lost_found_show_photo_on_portal', value: String(showPhoto), updated_at: now },
        { onConflict: 'category,key' },
      ),
    ]);

    logAudit({ action: 'update', module: 'settings', description: 'Configurações de Achados e Perdidos atualizadas' });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 900);

    setOriginal({
      types:            JSON.stringify(types),
      foundLocations:   JSON.stringify(foundLocations),
      storageLocations: JSON.stringify(storageLocations),
      discardDays,
      showPhoto,
    });
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">

      {/* ── Card 1: Categorias de Objetos ── */}
      <SettingsCard
        title="Categorias de Objetos"
        description="Tipos de objetos que podem ser registrados como achados ou perdidos"
        icon={Tag}
        collapseId="lost-found-types"
      >
        <TagList
          items={types}
          onAdd={addType}
          onRemove={removeType}
          placeholder="Ex: eletrônico, vestuário, documento…"
        />
      </SettingsCard>

      {/* ── Card 2: Locais ── */}
      <SettingsCard
        title="Locais"
        description="Locais de descoberta e de armazenamento de objetos"
        icon={MapPin}
        collapseId="lost-found-locations"
      >
        <div className="space-y-6">

          {/* Locais de Descoberta */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Locais de Descoberta
            </p>
            <TagList
              items={foundLocations}
              onAdd={addFoundLocation}
              onRemove={removeFoundLocation}
              placeholder="Ex: quadra, refeitório, corredor…"
            />
          </div>

          <hr className="border-gray-100 dark:border-gray-700" />

          {/* Locais de Armazenamento */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Locais de Armazenamento
            </p>
            <TagList
              items={storageLocations}
              onAdd={addStorageLocation}
              onRemove={removeStorageLocation}
              placeholder="Ex: secretaria, sala da coordenação…"
            />
          </div>
        </div>
      </SettingsCard>

      {/* ── Card 3: Regras de Descarte ── */}
      <SettingsCard
        title="Regras de Descarte"
        description="Defina quando um objeto fica elegível para descarte e visibilidade no portal"
        icon={PackageSearch}
        collapseId="lost-found-discard"
      >
        <div className="space-y-5">

          {/* Slider de dias */}
          <DaysSlider
            value={discardDays}
            onChange={setDiscardDays}
            label="Dias sem reivindicação até elegível para descarte"
            min={7}
            max={180}
          />

          {/* Toggle de foto no portal */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowPhoto((v) => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                showPhoto ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-700'
              }`}
              aria-checked={showPhoto}
              role="switch"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  showPhoto ? 'translate-x-5' : ''
                }`}
              />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Exibir foto do objeto nos portais do aluno e responsável
            </span>
          </div>
        </div>
      </SettingsCard>

      {/* ── Floating save button — visível apenas quando isDirty ── */}
      <div
        className={`fixed bottom-6 right-8 z-30 transition-all duration-300 ${
          isDirty || saving || saved
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl transition-all duration-300 ${
            saved
              ? 'bg-emerald-500 text-white shadow-emerald-500/25'
              : 'bg-brand-primary text-white hover:bg-brand-primary-dark shadow-brand-primary/25 disabled:opacity-50'
          }`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <PackageSearch className="w-4 h-4" />
          )}
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar Configurações'}
        </button>
      </div>

    </div>
  );
}
