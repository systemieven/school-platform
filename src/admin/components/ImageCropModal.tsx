/**
 * ImageCropModal
 *
 * WhatsApp-style circular crop UI.
 * - Drag to reposition
 * - Scroll / pinch to zoom
 * - Outputs a 640×640 JPEG base64 string (as required by the WhatsApp API /profile/image endpoint)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, Check } from 'lucide-react';

interface Props {
  src: string;           // data-URL of the selected image
  onSave: (base64: string) => void;
  onClose: () => void;
}

const VIEWPORT = 300;   // px — visible crop square
const OUT_SIZE  = 640;  // output image size required by WhatsApp API

export default function ImageCropModal({ src, onSave, onClose }: Props) {
  const imgRef   = useRef<HTMLImageElement>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);

  // Natural image dimensions once loaded
  const [natW, setNatW] = useState(0);
  const [natH, setNatH] = useState(0);

  // Transform state: offset from center, zoom
  const [ox, setOx] = useState(0);
  const [oy, setOy] = useState(0);
  const [zoom, setZoom] = useState(1);

  // Drag state (stored in ref to avoid stale closure issues in event listeners)
  const dragging = useRef(false);
  const lastPos  = useRef({ x: 0, y: 0 });

  // Pinch state
  const lastDist = useRef<number | null>(null);

  // ── Compute minimum zoom so image always covers the viewport square
  const minZoom = natW && natH ? Math.max(VIEWPORT / natW, VIEWPORT / natH) : 1;

  // ── Clamp offset so the image always covers the viewport
  const clamp = useCallback((ox: number, oy: number, z: number, nw: number, nh: number) => {
    const hw = (nw * z) / 2;
    const hh = (nh * z) / 2;
    const half = VIEWPORT / 2;
    return {
      x: Math.max(half - hw, Math.min(hw - half, ox)),
      y: Math.max(half - hh, Math.min(hh - half, oy)),
    };
  }, []);

  // ── When image loads: set natural size and fit zoom
  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    setNatW(nw);
    setNatH(nh);
    const fit = Math.max(VIEWPORT / nw, VIEWPORT / nh);
    setZoom(fit);
    setOx(0);
    setOy(0);
  };

  // ── Zoom helpers
  const applyZoom = useCallback((delta: number, pivot?: { x: number; y: number }) => {
    setZoom((prevZ) => {
      if (!natW || !natH) return prevZ;
      const min = Math.max(VIEWPORT / natW, VIEWPORT / natH);
      const next = Math.max(min, Math.min(4, prevZ + delta));
      if (pivot) {
        // Zoom toward pivot point (in viewport coords, relative to center)
        const scale = next / prevZ;
        setOx((px) => {
          const ny = (pivot.x - VIEWPORT / 2 - px) * (scale - 1) + px;  // reuse var names below
          void ny; // suppress lint
          return clamp(px + (pivot.x - VIEWPORT / 2 - px) * (scale - 1), 0, next, natW, natH).x;
        });
        setOy((py) => {
          return clamp(0, py + (pivot.y - VIEWPORT / 2 - py) * (scale - 1), next, natW, natH).y;
        });
      } else {
        setOx((px) => clamp(px, 0, next, natW, natH).x);
        setOy((py) => clamp(0, py, next, natW, natH).y);
      }
      return next;
    });
  }, [natW, natH, clamp]);

  // ── Mouse events
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current  = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      setOx((prev) => clamp(prev + dx, 0, zoom, natW, natH).x);
      setOy((prev) => clamp(0, prev + dy, zoom, natW, natH).y);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',  onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',  onUp);
    };
  }, [zoom, natW, natH, clamp]);

  // ── Mouse wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = wrapRef.current?.getBoundingClientRect();
    const pivot = rect
      ? { x: e.clientX - rect.left, y: e.clientY - rect.top }
      : undefined;
    applyZoom(-e.deltaY * 0.002, pivot);
  };

  // ── Touch events
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragging.current = true;
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      dragging.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDist.current = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragging.current) {
      const dx = e.touches[0].clientX - lastPos.current.x;
      const dy = e.touches[0].clientY - lastPos.current.y;
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setOx((prev) => clamp(prev + dx, 0, zoom, natW, natH).x);
      setOy((prev) => clamp(0, prev + dy, zoom, natW, natH).y);
    } else if (e.touches.length === 2 && lastDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      applyZoom((dist - lastDist.current) * 0.005);
      lastDist.current = dist;
    }
  };

  const onTouchEnd = () => {
    dragging.current = false;
    lastDist.current = null;
  };

  // ── Render and export 640×640 JPEG
  const handleSave = () => {
    const img = imgRef.current;
    if (!img || !natW || !natH) return;

    const canvas = document.createElement('canvas');
    canvas.width  = OUT_SIZE;
    canvas.height = OUT_SIZE;
    const ctx = canvas.getContext('2d')!;

    // The image top-left corner in viewport coords:
    // imgLeft = VIEWPORT/2 + ox - natW*zoom/2
    // imgTop  = VIEWPORT/2 + oy - natH*zoom/2
    //
    // Viewport corner (0,0) in image source coords:
    // srcX = (0 - imgLeft) / zoom = (natW*zoom/2 - VIEWPORT/2 - ox) / zoom
    //      = natW/2 - (VIEWPORT/2 + ox)/zoom

    const srcX = natW / 2 - (VIEWPORT / 2 + ox) / zoom;
    const srcY = natH / 2 - (VIEWPORT / 2 + oy) / zoom;
    const srcW = VIEWPORT / zoom;
    const srcH = VIEWPORT / zoom;

    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, OUT_SIZE, OUT_SIZE);
    onSave(canvas.toDataURL('image/jpeg', 0.92));
  };

  // ── Computed image position (absolute, centered + offset)
  const imgW = natW * zoom;
  const imgH = natH * zoom;
  const imgLeft = VIEWPORT / 2 + ox - imgW / 2;
  const imgTop  = VIEWPORT / 2 + oy - imgH / 2;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-display text-base font-bold text-gray-800 dark:text-white">
            Ajustar foto de perfil
          </h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Crop area */}
        <div className="flex flex-col items-center gap-4 p-5">
          <div
            ref={wrapRef}
            className="relative select-none"
            style={{ width: VIEWPORT, height: VIEWPORT, cursor: dragging.current ? 'grabbing' : 'grab', overflow: 'hidden' }}
            onMouseDown={onMouseDown}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Image */}
            <img
              ref={imgRef}
              src={src}
              alt=""
              onLoad={onImgLoad}
              draggable={false}
              style={{
                position: 'absolute',
                width: imgW || 'auto',
                height: imgH || 'auto',
                left: imgLeft,
                top: imgTop,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />

            {/* Overlay with circular cutout */}
            <svg
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              width={VIEWPORT} height={VIEWPORT}
              viewBox={`0 0 ${VIEWPORT} ${VIEWPORT}`}
            >
              <defs>
                <mask id="cropMask">
                  <rect width={VIEWPORT} height={VIEWPORT} fill="white" />
                  <circle cx={VIEWPORT / 2} cy={VIEWPORT / 2} r={VIEWPORT / 2 - 4} fill="black" />
                </mask>
              </defs>
              {/* Dark outside circle */}
              <rect width={VIEWPORT} height={VIEWPORT} fill="rgba(0,0,0,0.55)" mask="url(#cropMask)" />
              {/* Circle border */}
              <circle cx={VIEWPORT / 2} cy={VIEWPORT / 2} r={VIEWPORT / 2 - 4}
                fill="none" stroke="white" strokeWidth="2" opacity="0.8" />
            </svg>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-3 w-full px-2">
            <button
              onClick={() => applyZoom(-0.1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-[#003876] dark:hover:text-[#ffd700] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            {/* Zoom slider */}
            <input
              type="range"
              min={Math.round(minZoom * 100)}
              max={400}
              value={Math.round(zoom * 100)}
              onChange={(e) => {
                const z = Number(e.target.value) / 100;
                setZoom(z);
                setOx((prev) => clamp(prev, 0, z, natW, natH).x);
                setOy((prev) => clamp(0, prev, z, natW, natH).y);
              }}
              className="flex-1 accent-[#003876] dark:accent-[#ffd700]"
            />

            <button
              onClick={() => applyZoom(0.1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-[#003876] dark:hover:text-[#ffd700] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center -mt-1">
            Arraste para reposicionar · role para ampliar
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#003876] text-white hover:bg-[#002855] transition-colors">
            <Check className="w-4 h-4" /> Usar esta foto
          </button>
        </div>
      </div>
    </div>
  );
}
