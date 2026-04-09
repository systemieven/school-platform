/**
 * GeolocationField
 *
 * Campo estruturado para capturar / editar a geolocalização usada
 * pelo módulo de Atendimentos (cerca eletrônica do check-in).
 *
 * - Botão "Capturar coordenadas do endereço" → chama a edge function
 *   `geocode-address` (Google Maps Geocoding API proxy). A chave fica
 *   nos secrets do Supabase.
 * - Mini-mapa embed via OpenStreetMap (sem chave) mostra o ponto + raio.
 * - Inputs manuais de lat/lng/raio como fallback.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { MapPin, Crosshair, Loader2, AlertCircle, CheckCircle2, Plus, Minus, RotateCcw, ExternalLink } from 'lucide-react';

interface GeolocationValue {
  latitude: number | null;
  longitude: number | null;
  radius_m: number;
}

interface AddressPartsForGeocode {
  cep?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}

interface Props {
  value: string; // JSON-encoded GeolocationValue
  savedValue: string;
  addressJson: string; // Institutional address (JSON string) used for geocoding
  onChange: (next: string) => void;
}

const DEFAULT_VALUE: GeolocationValue = { latitude: null, longitude: null, radius_m: 150 };

function parse(str: string): GeolocationValue {
  if (!str) return { ...DEFAULT_VALUE };
  try {
    const obj = JSON.parse(str);
    if (obj && typeof obj === 'object') {
      return {
        latitude: typeof obj.latitude === 'number' ? obj.latitude : null,
        longitude: typeof obj.longitude === 'number' ? obj.longitude : null,
        radius_m: typeof obj.radius_m === 'number' ? obj.radius_m : 150,
      };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_VALUE };
}

function parseAddressParts(json: string): AddressPartsForGeocode {
  if (!json) return {};
  try {
    const obj = JSON.parse(json);
    if (obj && typeof obj === 'object') return obj as AddressPartsForGeocode;
  } catch {
    /* ignore */
  }
  return {};
}

export default function GeolocationField({ value, savedValue: _savedValue, addressJson, onChange }: Props) {
  const current = useMemo(() => parse(value), [value]);

  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mapImageUrl, setMapImageUrl] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const mapBlobUrlRef = useRef<string | null>(null);
  // null = zoom auto (calculado a partir do raio na propria edge function)
  const [zoomOverride, setZoomOverride] = useState<number | null>(null);
  const ZOOM_MIN = 12;
  const ZOOM_MAX = 20;

  // Quando o usuario nao definiu zoom manual, derivamos um padrao do raio
  // (mesma formula da edge function) so pra alimentar o estado dos botoes.
  function autoZoom(radiusM: number): number {
    if (radiusM <= 80) return 18;
    if (radiusM <= 160) return 17;
    if (radiusM <= 320) return 16;
    if (radiusM <= 640) return 15;
    return 14;
  }
  const effectiveZoom = zoomOverride ?? autoZoom(current.radius_m);

  function update(patch: Partial<GeolocationValue>) {
    const next = { ...current, ...patch };
    onChange(JSON.stringify(next));
  }

  async function handleGeocode() {
    setGeocoding(true);
    setError(null);
    setSuccess(null);

    try {
      const parts = parseAddressParts(addressJson);
      if (!parts.rua && !parts.cep) {
        setError('Preencha o endereço institucional primeiro.');
        setGeocoding(false);
        return;
      }

      // Garante que o gateway receba o JWT do usuário logado (e não a publishable key
      // como Authorization, que é o default do supabase-js quando o projeto usa o
      // novo formato sb_publishable_*).
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setError('Sessão expirada. Faça login novamente.');
        setGeocoding(false);
        return;
      }

      const { data, error: invokeErr } = await supabase.functions.invoke('geocode-address', {
        body: { address_parts: parts },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      // Quando o status é não-2xx, supabase-js retorna `error` mas o body
      // ainda pode ter detalhes úteis (reason / details). Tentamos extrair.
      if (invokeErr) {
        let detail = invokeErr.message || 'Falha ao chamar a função de geocodificação.';
        const ctx = (invokeErr as { context?: Response }).context;
        if (ctx && typeof ctx.text === 'function') {
          try {
            const txt = await ctx.text();
            const parsed = JSON.parse(txt) as { reason?: string; details?: string; message?: string; error?: string };
            detail = parsed.message || parsed.details || parsed.reason || parsed.error || detail;
          } catch {
            /* keep generic message */
          }
        }
        setError(detail);
        setGeocoding(false);
        return;
      }

      const result = data as { lat?: number; lng?: number; formatted_address?: string; error?: string; message?: string };
      if (result?.error) {
        setError(result.message || result.error);
      } else if (typeof result?.lat === 'number' && typeof result?.lng === 'number') {
        update({ latitude: result.lat, longitude: result.lng });
        setSuccess(result.formatted_address || 'Coordenadas capturadas com sucesso.');
      } else {
        setError('Resposta inesperada da função de geocodificação.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGeocoding(false);
    }
  }

  // Carrega o PNG do Google Static Maps via edge function (mantem a chave no servidor).
  // Debounce de 350ms para que ajustes contínuos no slider de raio nao gerem
  // dezenas de chamadas.
  useEffect(() => {
    if (current.latitude === null || current.longitude === null) {
      if (mapBlobUrlRef.current) {
        URL.revokeObjectURL(mapBlobUrlRef.current);
        mapBlobUrlRef.current = null;
      }
      setMapImageUrl(null);
      return;
    }

    let cancelled = false;
    const lat = current.latitude;
    const lng = current.longitude;
    const radius_m = current.radius_m;
    const zoom = effectiveZoom;

    const timer = setTimeout(async () => {
      setMapLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken || cancelled) return;

        const { data, error: invokeErr } = await supabase.functions.invoke('google-static-map', {
          body: { lat, lng, radius_m, zoom },
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (cancelled || invokeErr || !data) return;

        // A edge function devolve application/octet-stream (workaround do
        // supabase-js, que so retorna Blob para esse content-type). Re-wrappamos
        // como image/png para o <img> renderizar corretamente.
        const sourceBlob =
          data instanceof Blob ? data : new Blob([data as ArrayBuffer]);
        const blob = new Blob([await sourceBlob.arrayBuffer()], { type: 'image/png' });
        const url = URL.createObjectURL(blob);

        if (mapBlobUrlRef.current) URL.revokeObjectURL(mapBlobUrlRef.current);
        mapBlobUrlRef.current = url;
        setMapImageUrl(url);
      } catch {
        /* silencia: o mapa eh apenas preview */
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [current.latitude, current.longitude, current.radius_m, effectiveZoom]);

  // Cleanup do blob ao desmontar
  useEffect(() => {
    return () => {
      if (mapBlobUrlRef.current) {
        URL.revokeObjectURL(mapBlobUrlRef.current);
        mapBlobUrlRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      {/* Action button */}
      <button
        type="button"
        onClick={handleGeocode}
        disabled={geocoding}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#003876] text-white text-xs font-semibold hover:bg-[#002255] disabled:opacity-50 transition-colors"
      >
        {geocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
        {geocoding ? 'Capturando…' : 'Capturar coordenadas do endereço'}
      </button>

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Coordinates inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Latitude</label>
          <input
            type="number"
            step="0.000001"
            value={current.latitude ?? ''}
            onChange={(e) =>
              update({ latitude: e.target.value === '' ? null : parseFloat(e.target.value) })
            }
            placeholder="-8.2831"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Longitude</label>
          <input
            type="number"
            step="0.000001"
            value={current.longitude ?? ''}
            onChange={(e) =>
              update({ longitude: e.target.value === '' ? null : parseFloat(e.target.value) })
            }
            placeholder="-35.9758"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20"
          />
        </div>
      </div>

      {/* Radius slider */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Raio permitido (metros)</label>
          <span className="text-xs font-semibold text-[#003876] dark:text-blue-300">{current.radius_m}m</span>
        </div>
        <input
          type="range"
          min={30}
          max={500}
          step={10}
          value={current.radius_m}
          onChange={(e) => update({ radius_m: parseInt(e.target.value) })}
          className="w-full accent-[#003876]"
        />
      </div>

      {/* Map preview (Google Static Maps via edge function) */}
      {mapImageUrl && (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <img
            src={mapImageUrl}
            alt="Mapa da instituição (Google Maps)"
            className="w-full h-64 object-cover"
          />
          {mapLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            </div>
          )}

          {/* Controles de zoom */}
          <div className="absolute top-2 right-2 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setZoomOverride(Math.min(ZOOM_MAX, effectiveZoom + 1))}
              disabled={effectiveZoom >= ZOOM_MAX || mapLoading}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed border-b border-gray-200 dark:border-gray-700 transition-colors"
              aria-label="Aproximar"
              title="Aproximar"
            >
              <Plus className="w-4 h-4 text-gray-700 dark:text-gray-200" />
            </button>
            <button
              type="button"
              onClick={() => setZoomOverride(Math.max(ZOOM_MIN, effectiveZoom - 1))}
              disabled={effectiveZoom <= ZOOM_MIN || mapLoading}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Afastar"
              title="Afastar"
            >
              <Minus className="w-4 h-4 text-gray-700 dark:text-gray-200" />
            </button>
            {zoomOverride !== null && (
              <button
                type="button"
                onClick={() => setZoomOverride(null)}
                disabled={mapLoading}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 border-t border-gray-200 dark:border-gray-700 transition-colors"
                aria-label="Voltar ao zoom automático"
                title="Voltar ao zoom automático"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gray-700 dark:text-gray-200" />
              </button>
            )}
          </div>

          {/* Indicador de zoom atual */}
          <div className="absolute top-2 left-2 text-[10px] text-white/95 bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
            zoom {effectiveZoom}{zoomOverride === null && ' · auto'}
          </div>

          {/* Link para abrir no Google Maps com zoom interativo completo */}
          {current.latitude !== null && current.longitude !== null && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${current.latitude},${current.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-2 left-2 inline-flex items-center gap-1 text-[11px] text-white/95 bg-black/50 hover:bg-black/70 px-2 py-1 rounded backdrop-blur-sm transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Abrir no Google Maps
            </a>
          )}

          <div className="absolute bottom-1 right-2 text-[10px] text-white/90 bg-black/40 px-1.5 py-0.5 rounded">
            Google Maps
          </div>
        </div>
      )}
      {!mapImageUrl && (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-4 py-6 text-center">
          {mapLoading ? (
            <Loader2 className="w-8 h-8 text-gray-300 mx-auto mb-1 animate-spin" />
          ) : (
            <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-1" />
          )}
          <p className="text-xs text-gray-400">
            {mapLoading
              ? 'Carregando mapa...'
              : 'Capture as coordenadas ou informe manualmente para exibir o mapa.'}
          </p>
        </div>
      )}
    </div>
  );
}
