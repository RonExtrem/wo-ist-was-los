-- Etappe 5: Push-Nachrichten, Erinnerungen, Teilen

-- Erinnerung an gemerkte Veranstaltungen (Vortag ~18 Uhr, am Tag ~8 Uhr)
ALTER TABLE einstellungen ADD COLUMN IF NOT EXISTS erinnern boolean NOT NULL DEFAULT true;

-- Terminänderungen/Absagen nur einmal melden
ALTER TABLE event_aenderungen ADD COLUMN IF NOT EXISTS gemeldet boolean NOT NULL DEFAULT false;

-- Quellen-Warnung an Michi höchstens einmal pro Tag
ALTER TABLE quellen ADD COLUMN IF NOT EXISTS gewarnt_am timestamptz;

-- „Neu für dich“ braucht schnellen Zugriff auf neue Events
CREATE INDEX IF NOT EXISTS events_erstellt_idx ON events (erstellt);
CREATE INDEX IF NOT EXISTS push_log_geraet_idx ON push_log (geraet_id, art, gesendet_am);
CREATE INDEX IF NOT EXISTS ki_aufrufe_geraet_idx ON ki_aufrufe (geraet_id, zeitpunkt);
