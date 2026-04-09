-- Add variables_used JSONB column to whatsapp_message_log
-- Stores the raw key→value map of template variables used at send time,
-- enabling the UI to mask sensitive values (e.g. temp_password) in the
-- message preview without altering the stored rendered_content.

ALTER TABLE whatsapp_message_log
  ADD COLUMN IF NOT EXISTS variables_used JSONB DEFAULT '{}';

COMMENT ON COLUMN whatsapp_message_log.variables_used IS
  'Raw variable map used to render the message. Sensitive values are masked in the UI but kept here for audit purposes.';
