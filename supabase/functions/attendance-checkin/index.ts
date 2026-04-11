/**
 * attendance-checkin
 *
 * Endpoint publico que o QR Code da recepcao consome. Duas fases:
 *   1. dry=true  → valida elegibilidade sem emitir senha nem exigir localizacao.
 *   2. dry=false → exige lat/lng, valida raio e emite senha (attendance_tickets).
 *
 * Chamado sem JWT pela pagina publica /atendimento.
 * Usa SERVICE_ROLE_KEY internamente para contornar a RLS restritiva.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

/** Haversine distance in meters */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/**
 * Novo formato multi-select. Cada flag habilita um intervalo de datas
 * independentemente; o agendamento é elegível se QUALQUER uma das
 * regras ativas cobri-lo. `any` sobrescreve todas as demais.
 *
 * Valores legados com o campo `mode` sao normalizados em
 * `normalizeEligibilityRules()`.
 */
interface EligibilityRules {
  same_day: boolean;
  future: boolean;
  past_limited: boolean;
  any: boolean;
  past_days_limit: number;
  future_days_limit: number;
}

function normalizeEligibilityRules(raw: unknown): EligibilityRules {
  const r = (raw as Record<string, unknown>) || {};
  const past_days_limit =
    typeof r.past_days_limit === "number" && r.past_days_limit > 0
      ? r.past_days_limit
      : 7;
  const future_days_limit =
    typeof r.future_days_limit === "number" && r.future_days_limit > 0
      ? r.future_days_limit
      : 7;
  const legacyMode = typeof r.mode === "string" ? (r.mode as string) : null;
  if (legacyMode) {
    return {
      same_day: legacyMode === "same_day",
      future: legacyMode === "future",
      past_limited: legacyMode === "past_limited",
      any: legacyMode === "any",
      past_days_limit,
      future_days_limit,
    };
  }
  return {
    same_day: !!r.same_day,
    future: !!r.future,
    past_limited: !!r.past_limited,
    any: !!r.any,
    past_days_limit,
    future_days_limit,
  };
}

interface TicketFormat {
  prefix_mode: "none" | "sector" | "custom";
  custom_prefix: string;
  digits: number;
  per_sector_counter: boolean;
}

interface Geolocation {
  latitude: number | null;
  longitude: number | null;
  radius_m: number;
}

interface VisitAppointmentRow {
  id: string;
  visitor_name: string;
  visitor_phone: string;
  visitor_email: string | null;
  visit_reason: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
}

function isEligible(
  appointment: VisitAppointmentRow,
  rules: EligibilityRules,
  today: string,
): { ok: boolean; reason?: string } {
  // `any` = libera qualquer data
  if (rules.any) return { ok: true };

  const apptDate = appointment.appointment_date;

  // Testa cada regra ativa; basta uma bater.
  if (rules.same_day && apptDate === today) return { ok: true };
  if (rules.future && apptDate > today) {
    const diffDays =
      (new Date(apptDate).getTime() - new Date(today).getTime()) /
      (1000 * 60 * 60 * 24);
    if (diffDays <= rules.future_days_limit) return { ok: true };
    return { ok: false, reason: "future_limit_exceeded" };
  }
  if (rules.past_limited && apptDate < today) {
    const diffDays =
      (new Date(today).getTime() - new Date(apptDate).getTime()) /
      (1000 * 60 * 60 * 24);
    if (diffDays <= rules.past_days_limit) return { ok: true };
  }

  // Nenhuma regra bateu — diagnostica o motivo mais especifico para UX.
  if (apptDate > today) return { ok: false, reason: "future_not_allowed" };
  if (apptDate === today) return { ok: false, reason: "same_day_not_allowed" };
  // apptDate < today
  if (rules.past_limited) return { ok: false, reason: "past_limit_exceeded" };
  return { ok: false, reason: "past_not_allowed" };
}

/**
 * Alguns settings foram gravados pelo admin UI como JSON.stringify em cima
 * de um JSONB — ou seja, a coluna guarda uma string contendo JSON valido
 * (ex: visit.reasons, general.geolocation). Quando for string tentamos
 * desserializar; caso contrario devolvemos o valor como veio.
 */
function normalizeSettingValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

async function loadSettings(supabase: ReturnType<typeof createClient>) {
  // Carregamos todas as linhas das 3 categorias relevantes e filtramos em JS.
  // Evitamos o .or() com and() aninhado do PostgREST porque o parser dele eh
  // frageil e retorna 500 quando o encoding da query nao bate exatamente.
  const { data, error } = await supabase
    .from("system_settings")
    .select("category, key, value")
    .in("category", ["attendance", "general", "visit"]);
  if (error) {
    console.error("[attendance-checkin] loadSettings error", error);
    throw error;
  }
  const map: Record<string, Record<string, unknown>> = {};
  for (const row of data || []) {
    const r = row as { category: string; key: string; value: unknown };
    if (!map[r.category]) map[r.category] = {};
    map[r.category][r.key] = normalizeSettingValue(r.value);
  }
  return map;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const phone = normalizePhone(body.phone || "");
    const dry = !!body.dry;
    const lat = typeof body.lat === "number" ? body.lat : null;
    const lng = typeof body.lng === "number" ? body.lng : null;
    const walkinName: string | null = body.walkin_name || null;
    const walkinSector: string | null = body.walkin_sector || null;

    if (!phone || phone.length < 10) {
      return json({ error: "invalid_phone", message: "Informe um celular válido." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const settings = await loadSettings(supabase);
    const rules = normalizeEligibilityRules(settings.attendance?.eligibility_rules);
    const allowWalkins = !!(
      (settings.attendance?.allow_walkins as { enabled?: boolean })?.enabled
    );
    const format = (settings.attendance?.ticket_format ?? {
      prefix_mode: "custom",
      custom_prefix: "A",
      digits: 3,
      per_sector_counter: false,
    }) as TicketFormat;
    const geo = (settings.general?.geolocation ?? {
      latitude: null,
      longitude: null,
      radius_m: 150,
    }) as Geolocation;
    const rawReasons = settings.visit?.reasons;
    const reasons = (Array.isArray(rawReasons) ? rawReasons : []) as Array<{
      key: string;
      label: string;
    }>;

    const today = new Date().toISOString().slice(0, 10);

    // ── Buscar agendamento do cliente ───────────────────────────────────────
    // Trazer agendamentos recentes (ultimos 60 dias + futuros proximos) pelo telefone.
    // Fazemos duas queries simples e combinamos em JS para evitar .or() do PostgREST,
    // que eh delicado e retornava 500 por conta de encoding.
    const sinceDate = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
    const baseSelect =
      "id, visitor_name, visitor_phone, visitor_email, visit_reason, appointment_date, appointment_time, status";

    const { data: apptExact, error: apptExactErr } = await supabase
      .from("visit_appointments")
      .select(baseSelect)
      .eq("visitor_phone", phone)
      .gte("appointment_date", sinceDate)
      .order("appointment_date", { ascending: true });

    if (apptExactErr) {
      console.error("[attendance-checkin] appointments eq error", apptExactErr);
      return json({ error: "lookup_failed", message: apptExactErr.message }, 500);
    }

    let appts = apptExact ?? [];
    // Fallback: alguns agendamentos podem ter sido salvos com mascara.
    // Busca por padrao contendo o numero so se a exata nao achou nada.
    if (appts.length === 0) {
      const { data: apptFuzzy, error: apptFuzzyErr } = await supabase
        .from("visit_appointments")
        .select(baseSelect)
        .ilike("visitor_phone", `%${phone}%`)
        .gte("appointment_date", sinceDate)
        .order("appointment_date", { ascending: true });
      if (apptFuzzyErr) {
        console.error("[attendance-checkin] appointments ilike error", apptFuzzyErr);
        return json({ error: "lookup_failed", message: apptFuzzyErr.message }, 500);
      }
      appts = apptFuzzy ?? [];
    }

    // Preferencia: mesmo dia → futuro mais proximo → passado mais recente
    let matched: VisitAppointmentRow | null = null;
    if (appts && appts.length > 0) {
      const list = appts as VisitAppointmentRow[];
      matched = list.find((a) => a.appointment_date === today) ?? null;
      if (!matched) matched = list.find((a) => a.appointment_date > today) ?? null;
      if (!matched) {
        const past = list.filter((a) => a.appointment_date < today);
        matched = past[past.length - 1] ?? null;
      }
    }

    // ── Caso sem agendamento ────────────────────────────────────────────────
    if (!matched) {
      if (!allowWalkins) {
        return json({
          eligible: false,
          error_code: "no_appointment",
          message:
            "Nenhum agendamento encontrado para este número. Agende uma visita antes de comparecer à recepção.",
        });
      }

      // Fluxo walk-in requer nome + setor
      if (!walkinName || !walkinSector) {
        return json({
          eligible: false,
          walkin_required: true,
          sectors: reasons.map((r) => ({ key: r.key, label: r.label })),
          message: "Informe seu nome e o setor desejado para gerar a senha.",
        });
      }
    } else {
      const elig = isEligible(matched, rules, today);
      if (!elig.ok) {
        const reasonMap: Record<string, string> = {
          same_day_not_allowed:
            "Atendimento no mesmo dia do agendamento não está habilitado. Contate a recepção.",
          future_not_allowed:
            "Seu agendamento é para uma data futura. Volte no dia marcado.",
          past_not_allowed: "Seu agendamento já passou.",
          past_limit_exceeded: `Seu agendamento passou do limite de ${rules.past_days_limit} dias retroativos.`,
          future_limit_exceeded: `Seu agendamento excede o limite de ${rules.future_days_limit} dias futuros.`,
        };
        return json({
          eligible: false,
          error_code: elig.reason,
          appointment: matched,
          message: reasonMap[elig.reason || ""] || "Agendamento inelegível.",
        });
      }
    }

    // ── Modo dry (fase de validacao antes do passo de localizacao) ──────────
    if (dry) {
      return json({
        eligible: true,
        appointment: matched,
        walkin_required: !matched,
      });
    }

    // ── Validacao de geolocalizacao ─────────────────────────────────────────
    if (lat === null || lng === null) {
      return json(
        { error: "location_required", message: "Permita a localização para continuar." },
        400,
      );
    }
    if (geo.latitude === null || geo.longitude === null) {
      return json(
        {
          error: "institution_coordinates_missing",
          message:
            "Coordenadas da instituição não configuradas. Contate o administrador.",
        },
        500,
      );
    }
    const distance = haversine(lat, lng, geo.latitude, geo.longitude);
    if (distance > geo.radius_m) {
      return json({
        eligible: false,
        error_code: "out_of_range",
        distance_m: distance,
        allowed_radius_m: geo.radius_m,
        message: `Você precisa estar presente na instituição para gerar a senha. Distância atual: ${distance}m.`,
      });
    }

    // ── Garantir que exista um visit_appointments (criar walk-in se preciso) ─
    let appointmentId: string;
    let sectorKey: string;
    let sectorLabel: string;
    let visitorName: string;
    let visitorEmail: string | null;

    if (matched) {
      appointmentId = matched.id;
      sectorKey = matched.visit_reason;
      sectorLabel =
        reasons.find((r) => r.key === matched.visit_reason)?.label ||
        matched.visit_reason;
      visitorName = matched.visitor_name;
      visitorEmail = matched.visitor_email;

      // Atualizar status para 'comparecimento' se ainda nao estiver
      if (matched.status !== "comparecimento") {
        await supabase
          .from("visit_appointments")
          .update({ status: "comparecimento" })
          .eq("id", matched.id);
      }
    } else {
      // Walk-in: criar agendamento sintetico
      const now = new Date();
      const hhmm = now.toTimeString().slice(0, 5);
      const sector = reasons.find((r) => r.key === walkinSector);
      if (!sector) {
        return json(
          { error: "invalid_sector", message: "Setor informado não existe." },
          400,
        );
      }
      const { data: inserted, error: insErr } = await supabase
        .from("visit_appointments")
        .insert({
          visitor_name: walkinName,
          visitor_phone: phone,
          visit_reason: sector.key,
          appointment_date: today,
          appointment_time: hhmm,
          status: "comparecimento",
          origin: "in_person",
          companions: [],
        })
        .select(
          "id, visitor_name, visitor_phone, visitor_email, visit_reason, appointment_date, appointment_time, status",
        )
        .single();
      if (insErr || !inserted) {
        return json(
          {
            error: "walkin_create_failed",
            message: insErr?.message || "Falha ao registrar walk-in.",
          },
          500,
        );
      }
      appointmentId = (inserted as VisitAppointmentRow).id;
      sectorKey = sector.key;
      sectorLabel = sector.label;
      visitorName = walkinName!;
      visitorEmail = null;
    }

    // ── Emitir numero da senha ──────────────────────────────────────────────
    const { data: numberRow, error: numErr } = await supabase.rpc(
      "next_attendance_ticket_number",
      { p_sector_key: sectorKey, p_format: format },
    );
    if (numErr) {
      return json(
        { error: "number_generation_failed", message: numErr.message },
        500,
      );
    }
    const ticketNumber = numberRow as unknown as string;

    // ── Determinar grupo de prioridade ─────────────────────────────────────
    const priorityCfg = (settings.attendance?.priority_queue ?? {
      enabled: false,
      window_minutes_before: 30,
      window_minutes_after: 30,
      show_type_indicator: true,
    }) as {
      enabled: boolean;
      window_minutes_before: number;
      window_minutes_after: number;
      show_type_indicator: boolean;
    };

    let priorityGroup = 2;
    let scheduledTime: string | null = null;

    if (
      priorityCfg.enabled &&
      matched &&
      matched.appointment_date === today
    ) {
      // Calcular diferença em minutos entre agora e o horário agendado
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const [apptH, apptM] = matched.appointment_time.split(":").map(Number);
      const apptMinutes = apptH * 60 + apptM;
      const diffMinutes = nowMinutes - apptMinutes; // positivo = atrasado, negativo = adiantado

      if (
        diffMinutes >= -priorityCfg.window_minutes_before &&
        diffMinutes <= priorityCfg.window_minutes_after
      ) {
        priorityGroup = 1;
        scheduledTime = matched.appointment_time;
      }
    }

    const { data: ticket, error: ticketErr } = await supabase
      .from("attendance_tickets")
      .insert({
        ticket_number: ticketNumber,
        sector_key: sectorKey,
        sector_label: sectorLabel,
        appointment_id: appointmentId,
        visitor_name: visitorName,
        visitor_phone: phone,
        visitor_email: visitorEmail,
        status: "waiting",
        checkin_lat: lat,
        checkin_lng: lng,
        checkin_distance_m: distance,
        priority_group: priorityGroup,
        scheduled_time: scheduledTime,
      })
      .select("*")
      .single();

    if (ticketErr || !ticket) {
      return json(
        { error: "ticket_create_failed", message: ticketErr?.message },
        500,
      );
    }

    return json({ eligible: true, ticket, distance_m: distance, priority_group: priorityGroup });
  } catch (err) {
    console.error("[attendance-checkin] unexpected", err);
    return json(
      {
        error: "unexpected",
        message: (err as Error).message,
        stack: (err as Error).stack,
      },
      500,
    );
  }
});
