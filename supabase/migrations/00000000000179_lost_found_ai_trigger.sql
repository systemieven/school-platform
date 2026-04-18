-- 179: Trigger AFTER INSERT em lost_found_items → ai-event-dispatcher
-- Dispara o agente lost_found_match sempre que alguém registra um item.
-- Segue o padrão de notify_auto_trigger (baseline.sql linha 691).
-- Condicional porque alguns ambientes ainda não têm a tabela lost_found_items.

CREATE OR REPLACE FUNCTION notify_ai_event_trigger(
  p_event_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_payload JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_secret TEXT;
  v_url    TEXT;
BEGIN
  SELECT value #>> '{}' INTO v_secret
    FROM system_settings
   WHERE category = 'internal' AND key = 'trigger_secret';

  IF v_secret IS NULL THEN
    RAISE NOTICE '[ai-event] trigger_secret ausente — pulando evento %', p_event_type;
    RETURN;
  END IF;

  v_url := current_setting('app.settings.supabase_url', true);
  IF v_url IS NULL OR v_url = '' THEN
    v_url := 'https://dinbwugbwnkrzljuocbs.supabase.co';
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/ai-event-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-trigger-secret', v_secret
    ),
    body := jsonb_build_object(
      'event_type',  p_event_type,
      'entity_type', p_entity_type,
      'entity_id',   p_entity_id::TEXT,
      'payload',     p_payload
    )
  );
END;
$$;

DO $outer$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'lost_found_items'
  ) THEN
    EXECUTE $def$
      CREATE OR REPLACE FUNCTION trg_lost_found_ai_notify() RETURNS TRIGGER
      LANGUAGE plpgsql SECURITY DEFINER AS $fn$
      BEGIN
        PERFORM notify_ai_event_trigger(
          'lost_found.after_insert',
          'lost_found_item',
          NEW.id,
          jsonb_build_object(
            'item_id',         NEW.id,
            'item_type',       NEW.type,
            'item_description', NEW.description,
            'found_location',  NEW.found_location,
            'storage_location', NEW.storage_location
          )
        );
        RETURN NEW;
      END;
      $fn$;
    $def$;

    EXECUTE 'DROP TRIGGER IF EXISTS trg_lost_found_items_ai_notify ON lost_found_items';
    EXECUTE $t$
      CREATE TRIGGER trg_lost_found_items_ai_notify
        AFTER INSERT ON lost_found_items
        FOR EACH ROW
        WHEN (NEW.status = 'available')
        EXECUTE FUNCTION trg_lost_found_ai_notify()
    $t$;
  ELSE
    RAISE NOTICE '[migration 179] lost_found_items ainda não existe — trigger adiado';
  END IF;
END
$outer$;

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'ai', 'Aplicada migration 179 (trigger AFTER INSERT lost_found_items; condicional)');
