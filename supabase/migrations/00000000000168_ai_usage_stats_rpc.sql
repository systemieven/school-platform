-- Migration 168: RPC ai_usage_stats — Sprint 13.IA-dash PR1
--
-- Agrega `ai_usage_log` para alimentar o dashboard de uso (KPIs do período,
-- série temporal diária e top agentes). Retorna JSON único para reduzir
-- round-trips. Custos em USD são estimados por modelo via tabela de preços
-- embutida (ver CASE abaixo); snapshot oficial continua em `ai_usage_snapshots`.

CREATE OR REPLACE FUNCTION ai_usage_stats(
  p_from         TIMESTAMPTZ,
  p_to           TIMESTAMPTZ,
  p_provider     TEXT DEFAULT NULL,
  p_agent_slug   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_kpis     JSONB;
  v_daily    JSONB;
  v_top      JSONB;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Preço estimado por 1k tokens (input/output). Valores de referência em USD;
  -- atualize conforme o tabelamento dos providers.
  WITH priced AS (
    SELECT
      l.*,
      CASE
        WHEN l.model ILIKE 'claude-opus%'    THEN 15.0 / 1000.0
        WHEN l.model ILIKE 'claude-sonnet%'  THEN  3.0 / 1000.0
        WHEN l.model ILIKE 'claude-haiku%'   THEN  0.8 / 1000.0
        WHEN l.model ILIKE 'gpt-4o-mini%'    THEN  0.15 / 1000.0
        WHEN l.model ILIKE 'gpt-4o%'         THEN  2.5 / 1000.0
        WHEN l.model ILIKE 'gpt-4-turbo%'    THEN 10.0 / 1000.0
        WHEN l.model ILIKE 'gpt-4%'          THEN 30.0 / 1000.0
        WHEN l.model ILIKE 'gpt-3.5%'        THEN  0.5 / 1000.0
        ELSE 0
      END AS price_in_per_1k,
      CASE
        WHEN l.model ILIKE 'claude-opus%'    THEN 75.0 / 1000.0
        WHEN l.model ILIKE 'claude-sonnet%'  THEN 15.0 / 1000.0
        WHEN l.model ILIKE 'claude-haiku%'   THEN  4.0 / 1000.0
        WHEN l.model ILIKE 'gpt-4o-mini%'    THEN  0.6 / 1000.0
        WHEN l.model ILIKE 'gpt-4o%'         THEN 10.0 / 1000.0
        WHEN l.model ILIKE 'gpt-4-turbo%'    THEN 30.0 / 1000.0
        WHEN l.model ILIKE 'gpt-4%'          THEN 60.0 / 1000.0
        WHEN l.model ILIKE 'gpt-3.5%'        THEN  1.5 / 1000.0
        ELSE 0
      END AS price_out_per_1k
    FROM ai_usage_log l
    WHERE l.created_at >= p_from
      AND l.created_at <  p_to
      AND (p_provider   IS NULL OR l.provider   = p_provider)
      AND (p_agent_slug IS NULL OR l.agent_slug = p_agent_slug)
  ), costed AS (
    SELECT
      priced.*,
      COALESCE(input_tokens, 0)  * price_in_per_1k  / 1.0 AS cost_in,
      COALESCE(output_tokens, 0) * price_out_per_1k / 1.0 AS cost_out
    FROM priced
  )
  SELECT jsonb_build_object(
    'requests',        COUNT(*),
    'input_tokens',    COALESCE(SUM(input_tokens),  0),
    'output_tokens',   COALESCE(SUM(output_tokens), 0),
    'cost_usd',        COALESCE(SUM(cost_in + cost_out), 0),
    'avg_latency_ms',  COALESCE(AVG(latency_ms)::INT, 0),
    'errors',          COUNT(*) FILTER (WHERE status = 'error')
  ) INTO v_kpis FROM costed;

  SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb) INTO v_daily
  FROM (
    SELECT
      date_trunc('day', created_at)::DATE AS day,
      COUNT(*)                             AS requests,
      SUM(COALESCE(input_tokens, 0))       AS input_tokens,
      SUM(COALESCE(output_tokens, 0))      AS output_tokens,
      SUM(
        COALESCE(input_tokens, 0)  * CASE
          WHEN model ILIKE 'claude-opus%'    THEN 15.0/1000.0
          WHEN model ILIKE 'claude-sonnet%'  THEN  3.0/1000.0
          WHEN model ILIKE 'claude-haiku%'   THEN  0.8/1000.0
          WHEN model ILIKE 'gpt-4o-mini%'    THEN  0.15/1000.0
          WHEN model ILIKE 'gpt-4o%'         THEN  2.5/1000.0
          WHEN model ILIKE 'gpt-4-turbo%'    THEN 10.0/1000.0
          WHEN model ILIKE 'gpt-4%'          THEN 30.0/1000.0
          WHEN model ILIKE 'gpt-3.5%'        THEN  0.5/1000.0
          ELSE 0 END
        +
        COALESCE(output_tokens, 0) * CASE
          WHEN model ILIKE 'claude-opus%'    THEN 75.0/1000.0
          WHEN model ILIKE 'claude-sonnet%'  THEN 15.0/1000.0
          WHEN model ILIKE 'claude-haiku%'   THEN  4.0/1000.0
          WHEN model ILIKE 'gpt-4o-mini%'    THEN  0.6/1000.0
          WHEN model ILIKE 'gpt-4o%'         THEN 10.0/1000.0
          WHEN model ILIKE 'gpt-4-turbo%'    THEN 30.0/1000.0
          WHEN model ILIKE 'gpt-4%'          THEN 60.0/1000.0
          WHEN model ILIKE 'gpt-3.5%'        THEN  1.5/1000.0
          ELSE 0 END
      ) AS cost_usd
    FROM ai_usage_log
    WHERE created_at >= p_from
      AND created_at <  p_to
      AND (p_provider   IS NULL OR provider   = p_provider)
      AND (p_agent_slug IS NULL OR agent_slug = p_agent_slug)
    GROUP BY 1
  ) d;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.requests DESC), '[]'::jsonb) INTO v_top
  FROM (
    SELECT
      agent_slug,
      provider,
      COUNT(*) AS requests,
      SUM(COALESCE(input_tokens, 0))  AS input_tokens,
      SUM(COALESCE(output_tokens, 0)) AS output_tokens
    FROM ai_usage_log
    WHERE created_at >= p_from
      AND created_at <  p_to
      AND (p_provider   IS NULL OR provider   = p_provider)
      AND (p_agent_slug IS NULL OR agent_slug = p_agent_slug)
    GROUP BY agent_slug, provider
    ORDER BY requests DESC
    LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'kpis',  v_kpis,
    'daily', v_daily,
    'top',   v_top
  );
END;
$$;

REVOKE ALL ON FUNCTION ai_usage_stats(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_usage_stats(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'ai', 'Aplicada migration 168 (RPC ai_usage_stats)');
