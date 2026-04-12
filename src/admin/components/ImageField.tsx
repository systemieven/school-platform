import { useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { Link2, Upload, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ── Style constants ──────────────────────────────────────────────────────────
const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary bg-white dark:bg-gray-800 dark:border-gray-700';
const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0';

// ── Props ────────────────────────────────────────────────────────────────────
export interface ImageFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  storageKey: string;   // used as filename prefix in the bucket
  hint?: string;
  bucket?: string;      // default: 'site-images'
  previewHeight?: string; // tailwind h-* class, default: 'h-28'
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ImageField({
  label,
  value,
  onChange,
  storageKey,
  hint,
  bucket = 'site-images',
  previewHeight = 'h-28',
}: ImageFieldProps) {
  const [mode, setMode]           = useState<'url' | 'upload'>('url');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [dragOver, setDragOver]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setUploadErr('Formato não suportado. Use JPG, PNG ou WebP.');
      return;
    }
    setUploading(true);
    setUploadErr(null);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 2400,
        useWebWorker: true,
      });
      const ext  = file.name.split('.').pop() ?? 'jpg';
      const path = `${storageKey}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, compressed, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
    } catch {
      setUploadErr('Erro ao enviar a imagem. Verifique sua conexão e tente novamente.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Label + mode toggle */}
      <div className="flex items-center justify-between">
        <label className={labelCls}>{label}</label>
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
          {(['url', 'upload'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setUploadErr(null); }}
              className={[
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200',
                mode === m
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
              ].join(' ')}
            >
              {m === 'url'
                ? <><Link2 className="w-3 h-3" /> Link</>
                : <><Upload className="w-3 h-3" /> Upload</>}
            </button>
          ))}
        </div>
      </div>

      {hint && <p className="text-xs text-gray-400">{hint}</p>}

      {/* URL mode */}
      {mode === 'url' && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          className={inputCls}
        />
      )}

      {/* Upload mode */}
      {mode === 'upload' && (
        <label
          className={[
            'flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 text-center transition-all',
            uploading
              ? 'border-gray-200 bg-gray-50 dark:bg-gray-800/40 cursor-wait opacity-70'
              : dragOver
              ? 'border-brand-primary bg-brand-primary/5 cursor-pointer'
              : 'border-gray-200 dark:border-gray-700 hover:border-brand-primary/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer',
          ].join(' ')}
          onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file && !uploading) handleFile(file);
          }}
        >
          {uploading ? (
            <>
              <Loader2 className="w-7 h-7 text-brand-primary animate-spin" />
              <span className="text-sm text-gray-500">Comprimindo e enviando…</span>
            </>
          ) : (
            <>
              <Upload className="w-7 h-7 text-gray-300" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Clique ou arraste uma imagem
              </span>
              <span className="text-xs text-gray-400">
                JPG, PNG ou WebP · máx. 10 MB
              </span>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
        </label>
      )}

      {/* Upload error */}
      {uploadErr && (
        <p className="text-xs text-red-500 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {uploadErr}
        </p>
      )}

      {/* Preview — always shown when value exists */}
      {value && (
        <div className={`relative rounded-xl overflow-hidden ${previewHeight} bg-gray-100 dark:bg-gray-800 group`}>
          <img
            src={value}
            alt="preview"
            className="w-full h-full object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-2 right-2 bg-black/50 text-white rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Abrir imagem em nova aba"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
