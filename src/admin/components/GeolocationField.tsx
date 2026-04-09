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
import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { MapPin, Crosshair, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

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

      const { data, error: invokeErr } = await supabase.functions.invoke('geocode-address', {
        body: { address_parts: parts },
      });

      if (invokeErr) {
        setError(invokeErr.message || 'Falha ao chamar a função de geocodificação.');
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

  // Build OSM static map URL if we have coordinates
  const mapUrl = useMemo(() => {
    if (current.latitude === null || current.longitude === null) return null;
    const { latitude, longitude, radius_m } = current;
    // Rough bbox around the point using degrees (~0.009 deg ≈ 1km)
    const delta = Math.max(0.002, (radius_m / 1000) * 0.012);
    const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join(',');
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;
  }, [current]);

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

      {/* Map preview */}
      {mapUrl && (
        <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <iframe
            title="Mapa da instituição"
            src={mapUrl}
            className="w-full h-64"
            loading="lazy"
          />
        </div>
      )}
      {!mapUrl && (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-4 py-6 text-center">
          <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-1" />
          <p className="text-xs text-gray-400">
            Capture as coordenadas ou informe manualmente para exibir o mapa.
          </p>
        </div>
      )}
    </div>
  );
}
