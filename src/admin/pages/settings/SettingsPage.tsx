import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { SystemSetting } from '../../types/admin.types';
import { Settings, Save, Loader2, Check, Building2, MessageCircle } from 'lucide-react';

const CATEGORY_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  general: { label: 'Dados Institucionais', icon: Building2 },
  uazapi: { label: 'WhatsApp (Uazapi)', icon: MessageCircle },
};

const KEY_LABELS: Record<string, string> = {
  school_name: 'Nome da Escola',
  cnpj: 'CNPJ',
  phone: 'Telefone',
  whatsapp: 'WhatsApp',
  address: 'Endereço',
  email: 'E-mail',
  uazapi_base_url: 'URL Base da API',
  uazapi_instance_token: 'Token da Instância',
  uazapi_admin_token: 'Token Admin',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .order('category')
      .order('key');

    if (!error && data) {
      const s = data as SystemSetting[];
      setSettings(s);
      const values: Record<string, string> = {};
      s.forEach((item) => {
        // jsonb values: strings come as-is, objects/arrays need stringify
        values[item.id] = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
      });
      setEditValues(values);
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    const updates = settings
      .filter((s) => editValues[s.id] !== toStr(s.value))
      .map((s) =>
        supabase
          .from('system_settings')
          .update({ value: editValues[s.id] })
          .eq('id', s.id),
      );

    if (updates.length > 0) {
      await Promise.all(updates);
      await fetchSettings();
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const toStr = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));
  const hasChanges = settings.some((s) => editValues[s.id] !== toStr(s.value));

  // Group by category
  const categories = Array.from(new Set(settings.map((s) => s.category)));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#003876] animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#003876] flex items-center gap-3">
            <Settings className="w-8 h-8" />
            Configurações
          </h1>
          <p className="text-gray-500 mt-1">Gerencie as configurações do sistema.</p>
        </div>

        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 ${
            saved
              ? 'bg-emerald-500 text-white'
              : hasChanges
                ? 'bg-[#003876] text-white hover:bg-[#002855]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar Alterações'}
        </button>
      </div>

      {/* Settings by category */}
      <div className="space-y-8">
        {categories.map((cat) => {
          const meta = CATEGORY_META[cat] || { label: cat, icon: Settings };
          const items = settings.filter((s) => s.category === cat);
          const CatIcon = meta.icon;

          return (
            <div key={cat} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                <CatIcon className="w-5 h-5 text-[#003876]" />
                <h2 className="font-display text-lg font-bold text-[#003876]">{meta.label}</h2>
              </div>
              <div className="p-6 space-y-5">
                {items.map((item) => {
                  const isSecret = item.key.includes('token');
                  return (
                    <div key={item.id}>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {KEY_LABELS[item.key] || item.key}
                      </label>
                      {item.description && (
                        <p className="text-xs text-gray-400 mb-1.5">{item.description}</p>
                      )}
                      <input
                        type={isSecret ? 'password' : 'text'}
                        value={editValues[item.id] || ''}
                        onChange={(e) =>
                          setEditValues((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20 outline-none transition-all text-sm"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
