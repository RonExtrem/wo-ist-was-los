-- Familien-Profile: jedes Handy hat seinen Vornamen (für Begrüßung und Push-Nachrichten)
ALTER TABLE einstellungen ADD COLUMN IF NOT EXISTS name text;
