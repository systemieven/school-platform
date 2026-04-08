-- ============================================================================
-- Migration 00000000000003: Notification settings additions
--
-- Adds notify_wa_connection toggle to system_settings (notifications tab).
-- ============================================================================

INSERT INTO system_settings (category, key, value)
VALUES ('notifications', 'notify_wa_connection', 'true')
ON CONFLICT (category, key) DO NOTHING;
