import { useCallback, useEffect, useState } from 'react';
import { Loader2, Check, Trash2, FolderOpen } from 'lucide-react';
import { Drawer, DrawerCard } from '../../../components/Drawer';
import { Toggle } from '../../../components/Toggle';
import { supabase } from '../../../../lib/supabase';
import type { StoreCategory } from '../../../types/admin.types';

interface Props {
  open: boolean;
  category: StoreCategory | null;
  categories: StoreCategory[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  description: string;
  parent_id: string;
  slug: string;
  position: number;
  is_active: boolean;
}

const EMPTY: FormState = { name: '', description: '', parent_id: '', slug: '', position: 0, is_active: true };

function toSlug(text: string) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-');
}

export default function CategoriaDrawer({ open, category, categories, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (category) {
      setForm({
        name: category.name,
        description: category.description ?? '',
        parent_id: category.parent_id ?? '',
        slug: category.slug ?? '',
        position: category.position,
        is_active: category.is_active,
      });
    } else {
      setForm(EMPTY);
    }
    setSaved(false);
  }, [category, open]);

  const set = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        parent_id: form.parent_id || null,
        slug: form.slug.trim() || toSlug(form.name) || null,
        position: form.position,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };
      if (category) {
        await supabase.from('store_categories').update(payload).eq('id', category.id);
      } else {
        await supabase.from('store_categories').insert({ ...payload, created_at: new Date().toISOString() });
      }
      setSaved(true);
      setTimeout(() => { onSaved(); onClose(); setSaved(false); }, 900);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!category) return;
    if (!confirm('Excluir esta categoria? As subcategorias ficarão sem pai.')) return;
    await supabase.from('store_categories').delete().eq('id', category.id);
    onSaved(); onClose();
  };

  const canSave = form.name.trim().length > 0;
  const otherCategories = categories.filter((c) => c.id !== category?.id);

  const footer = category ? (
    <div className="flex items-center gap-2">
      <button onClick={handleDelete} disabled={saving}
        className="px-4 py-2 text-sm font-medium rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 flex items-center gap-1.5">
        <Trash2 className="w-3.5 h-3.5" /> Excluir
      </button>
      <div className="flex-1" />
      <button onClick={onClose} disabled={saving}
        className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        Cancelar
      </button>
      <button onClick={handleSave} disabled={saving || !canSave}
        className={`px-4 py-2 text-sm font-medium rounded-xl transition-all flex items-center gap-2 ${
          saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
        }`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}
        {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
      </button>
    </div>
  ) : (
    <div className="flex gap-3">
      <button onClick={onClose} disabled={saving}
        className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
        Cancelar
      </button>
      <button onClick={handleSave} disabled={saving || !canSave}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
          saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
        }`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}
        {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Criar Categoria'}
      </button>
    </div>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={category ? 'Editar Categoria' : 'Nova Categoria'}
      icon={FolderOpen}
      footer={footer}
      headerExtra={
        <div className="flex items-center gap-3">
          <Toggle checked={form.is_active} onChange={(v: boolean) => set('is_active', v)} onColor="bg-emerald-500" />
        </div>
      }
    >
      <DrawerCard title="Informações" icon={FolderOpen}>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nome *</label>
            <input value={form.name} onChange={(e) => { set('name', e.target.value); if (!category) set('slug', toSlug(e.target.value)); }}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white"
              placeholder="Ex: Uniformes" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Descrição</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Slug (URL)</label>
            <input value={form.slug} onChange={(e) => set('slug', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white font-mono"
              placeholder="ex: uniformes" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Categoria Pai</label>
            <select value={form.parent_id} onChange={(e) => set('parent_id', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white">
              <option value="">Nenhuma (raiz)</option>
              {otherCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Posição</label>
            <input type="number" value={form.position} onChange={(e) => set('position', Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white"
              min={0} />
          </div>
        </div>
      </DrawerCard>
    </Drawer>
  );
}
