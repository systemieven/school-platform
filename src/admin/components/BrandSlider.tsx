import { useRef, useCallback, useMemo, useEffect, useState } from 'react';

interface BrandSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  step?: number;
  label?: string;
  unit?: string;
  formatValue?: (value: number) => string;
  minLabel?: string;
  maxLabel?: string;
  disabled?: boolean;
}

/**
 * Slider customizado no padrao do sistema:
 * - Trilha com gradient brand-primary → brand-secondary
 * - Circulo com preenchimento branco e borda colorida
 * - Valor central em destaque, labels de min/max nas extremidades
 */
export function BrandSlider({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  label,
  unit = '',
  formatValue,
  minLabel,
  maxLabel,
  disabled = false,
}: BrandSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const pct = useMemo(() => {
    if (max === min) return 0;
    return ((clamp(value) - min) / (max - min)) * 100;
  }, [value, min, max]);

  const display = formatValue ? formatValue(value) : `${value}${unit}`;
  const minDisplay = formatValue ? formatValue(min) : `${min}${unit}`;
  const maxDisplay = formatValue ? formatValue(max) : `${max}${unit}`;

  const updateFromClientX = useCallback(
    (clientX: number) => {
      if (disabled) return;
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const raw = ((clientX - rect.left) / rect.width) * (max - min) + min;
      const stepped = Math.round(raw / step) * step;
      onChange(clamp(stepped));
    },
    [max, min, step, onChange, disabled],
  );

  const onMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setDragging(true);
    updateFromClientX(e.clientX);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled || !e.touches[0]) return;
    setDragging(true);
    updateFromClientX(e.touches[0].clientX);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => updateFromClientX(e.clientX);
    const onUp = () => setDragging(false);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) updateFromClientX(e.touches[0].clientX);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, updateFromClientX]);

  return (
    <div className={`w-full select-none ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Label + valor central em destaque */}
      <div className="flex flex-col items-center mb-3">
        {label && (
          <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-1">
            {label}
          </span>
        )}
        <div className="text-2xl font-display font-bold text-brand-primary dark:text-brand-secondary">
          {display}
        </div>
      </div>

      {/* Trilha */}
      <div className="relative px-3 py-4">
        <div
          ref={trackRef}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          className="relative h-2 rounded-full bg-gray-200 dark:bg-gray-700 cursor-pointer"
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault();
              onChange(clamp(value - step));
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault();
              onChange(clamp(value + step));
            }
          }}
        >
          {/* Barra preenchida com gradient */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary transition-[width] duration-75"
            style={{ width: `${pct}%` }}
          />

          {/* Thumb — circulo branco com borda brand */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-[3px] border-brand-primary shadow-md transition-transform ${
              dragging ? 'scale-110' : 'hover:scale-105'
            }`}
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>

      {/* Labels min/max */}
      <div className="flex items-center justify-between px-1 mt-1">
        <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
          {minLabel ?? minDisplay}
        </span>
        <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
          {maxLabel ?? maxDisplay}
        </span>
      </div>
    </div>
  );
}
