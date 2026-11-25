-- Zwischenspeicher für KI-Auslesen: unveränderte Seiten werden nicht nochmal an die KI geschickt (spart Gratis-Kontingent)
CREATE TABLE IF NOT EXISTS ki_cache (
  url        text PRIMARY KEY,
  inhalt_hash text NOT NULL,
  ergebnis   jsonb NOT NULL,
  abgerufen  timestamptz NOT NULL DEFAULT now()
);
