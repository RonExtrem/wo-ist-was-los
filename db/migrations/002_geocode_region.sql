-- Ortssuche merkt sich auch Bundesland/Region und Land
ALTER TABLE geocode_cache ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE geocode_cache ADD COLUMN IF NOT EXISTS land char(2);

-- Laufprotokoll des nächtlichen Sammlers
CREATE TABLE IF NOT EXISTS sammler_laeufe (
  id          bigserial PRIMARY KEY,
  gestartet   timestamptz NOT NULL DEFAULT now(),
  beendet     timestamptz,
  bericht     jsonb
);
