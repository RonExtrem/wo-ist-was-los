-- Pro gemerkter Veranstaltung entscheiden: erinnern oder nur merken
ALTER TABLE favoriten ADD COLUMN IF NOT EXISTS erinnern boolean NOT NULL DEFAULT true;
