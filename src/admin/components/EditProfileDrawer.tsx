/**
 * EditProfileDrawer
 *
 * Allows the logged-in admin user to update their profile:
 *   - Avatar photo (file → ImageCropModal → upload to avatars bucket)
 *   - Full name, phone
 *   - Email and role are read-only
 */
import { useEffect, useRef, useState } from 'react';
import { Camera, Mail, Phone, Shield, Trash2, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { ROLE_LABELS } from '../types/admin.types';
import { Drawer, DrawerCard } from './Drawer';
import ImageCropModal from './ImageCropModal';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function EditProfileDrawer({ open, onClose }: Props) {
  const { profile, user, refreshProfile } = useAdminAuth();

  // ── Form state ────────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone,    setPhone]    = useState(profile?.phone    ?? '');

  // ── Avatar state ──────────────────────────────────────────────────────────
  const [cropSrc,      setCropSrc]      = useState<string | null>(null);
  const [pendingB64,   setPendingB64]   = useState<string | null>(null);   // cropped base64 (not yet saved)
  const [removeAvatar, setRemoveAvatar] = useState(false);                  // flag to clear avatar on save
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Save state ────────────────────────────────────────────────────────────
  const [saving, setSaving]   = useState(false);
  const [error,  setError]    = useState<string | null>(null);
  const [saved,  setSaved]    = useState(false);

  // Reset local state whenever the drawer opens
  useEffect(() => {
    if (open) {
      setFullName(profile?.full_name ?? '');
      setPhone(profile?.phone ?? '');
      setPendingB64(null);
      setRemoveAvatar(false);
      setError(null);
      setSaved(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Avatar helpers ────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  function handleCropSave(base64: string) {
    setPendingB64(base64);
    setRemoveAvatar(false);
    setCropSrc(null);
  }

  function handleRemoveAvatar() {
    setPendingB64(null);
    setRemoveAvatar(true);
  }

  // ── Determine preview URL ─────────────────────────────────────────────────
  const previewUrl: string | null = pendingB64
    ? `data:image/jpeg;base64,${pendingB64}`
    : removeAvatar
    ? null
    : (profile?.avatar_url ?? null);

  const initials = (profile?.full_name ?? user?.email ?? 'U').charAt(0).toUpperCase();

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!profile || !user) return;
    setSaving(true);
    setError(null);

    try {
      let newAvatarUrl = profile.avatar_url;

      // 1. Upload / remove avatar
      if (pendingB64) {
        // Convert base64 → Blob
        const byteStr = atob(pendingB64);
        const arr = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
        const blob = new Blob([arr], { type: 'image/jpeg' });

        const path = `${profile.id}/avatar.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(path);

        // Cache-bust so the browser re-fetches the new image
        newAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      } else if (removeAvatar) {
        await supabase.storage
          .from('avatars')
          .remove([`${profile.id}/avatar.jpg`]);
        newAvatarUrl = null;
      }

      // 2. Update profiles row
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          full_name:  fullName.trim() || null,
          phone:      phone.trim()    || null,
          avatar_url: newAvatarUrl,
        })
        .eq('id', profile.id);

      if (updateErr) throw updateErr;

      await refreshProfile();
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  }

  const isDirty =
    fullName.trim() !== (profile?.full_name ?? '').trim() ||
    phone.trim()    !== (profile?.phone    ?? '').trim()  ||
    !!pendingB64 ||
    removeAvatar;

  return (
    <>
      {/* ImageCropModal — outside the Drawer so it sits on top of everything */}
      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          onSave={handleCropSave}
          onClose={() => setCropSrc(null)}
        />
      )}

      <Drawer
        open={open}
        onClose={onClose}
        title="Editar perfil"
        icon={User}
        width="w-[420px]"
        footer={
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isDirty || saved}
              className="flex-1 py-2.5 rounded-xl bg-[#003876] hover:bg-[#002255] text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Salvando…</>
              ) : saved ? (
                'Salvo!'
              ) : (
                'Salvar alterações'
              )}
            </button>
          </div>
        }
      >
        {/* ── Foto de Perfil ── */}
        <DrawerCard title="Foto de Perfil" icon={Camera}>
          <div className="flex flex-col items-center gap-4 py-2">
            {/* Avatar preview */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-[#003876]/10 dark:bg-white/10 flex items-center justify-center border-2 border-white dark:border-gray-700 shadow-md">
                {previewUrl ? (
                  <img src={previewUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-[#003876] dark:text-[#ffd700]">
                    {initials}
                  </span>
                )}
              </div>

              {/* Camera button overlay */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 bg-[#003876] hover:bg-[#002255] text-white rounded-full flex items-center justify-center shadow-md transition-colors"
                title="Alterar foto"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-[#003876] dark:text-[#ffd700] hover:underline font-medium"
              >
                Escolher foto
              </button>
              {(previewUrl || profile?.avatar_url) && !removeAvatar && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">•</span>
                  <button
                    onClick={handleRemoveAvatar}
                    className="text-xs text-red-500 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remover
                  </button>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </DrawerCard>

        {/* ── Dados Pessoais ── */}
        <DrawerCard title="Dados Pessoais" icon={User}>
          <div className="space-y-3">
            {/* Full name */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">
                Nome completo
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003876]/30 focus:border-[#003876] dark:focus:border-[#ffd700] transition-colors"
              />
            </div>

            {/* Email — read-only */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">
                E-mail
              </label>
              <div className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
                <Mail className="w-4 h-4 flex-shrink-0 text-gray-400" />
                <span>{user?.email ?? '—'}</span>
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">
                Telefone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+55 11 99999-9999"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003876]/30 focus:border-[#003876] dark:focus:border-[#ffd700] transition-colors"
                />
              </div>
            </div>
          </div>
        </DrawerCard>

        {/* ── Cargo ── */}
        <DrawerCard title="Cargo" icon={Shield}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <Shield className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {profile ? ROLE_LABELS[profile.role] : '—'}
            </span>
            <span className="ml-auto text-[10px] text-gray-400 italic">somente leitura</span>
          </div>
        </DrawerCard>

        {/* ── Error ── */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
      </Drawer>
    </>
  );
}
