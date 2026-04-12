import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface LightboxImage {
  src: string;
  alt: string;
}

interface LightboxProps {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
}

export default function Lightbox({ images, index, onClose, onNavigate }: LightboxProps) {
  const total = images.length;
  const current = images[index];

  const goPrev = useCallback(() => {
    onNavigate(index > 0 ? index - 1 : total - 1);
  }, [index, total, onNavigate]);

  const goNext = useCallback(() => {
    onNavigate(index < total - 1 ? index + 1 : 0);
  }, [index, total, onNavigate]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    }
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose, goPrev, goNext]);

  if (!current) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador de imagem"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Fechar"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Counter */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium tracking-wide">
        {index + 1} / {total}
      </div>

      {/* Previous */}
      {total > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-3 md:left-6 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Anterior"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Image */}
      <img
        src={current.src}
        alt={current.alt}
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg select-none"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {/* Next */}
      {total > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-3 md:right-6 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Próxima"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>,
    document.body,
  );
}
