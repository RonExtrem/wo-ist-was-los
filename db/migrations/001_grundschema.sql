-- Wo ist was los? – Grundschema (Neon Postgres + PostGIS)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Quellen, aus denen der nächtliche Sammler Events holt
CREATE TABLE IF NOT EXISTS quellen (
  id                    text PRIMARY KEY,            -- z. B. 'kaerntner-messen'
  name                  text NOT NULL,
  url                   text NOT NULL,
  art                   text NOT NULL CHECK (art IN ('api', 'jsonld', 'html', 'ki')),
  land                  char(2) NOT NULL,
  aktiv                 boolean NOT NULL DEFAULT true,
  letzter_lauf          timestamptz,
  gefunden_letzter_lauf integer,
  durchschnitt          numeric,                     -- gleitender Schnitt der gefundenen Events
  schlechte_naechte     integer NOT NULL DEFAULT 0,  -- ab 2 → Push an Michi
  letzter_fehler        text
);

-- Veranstaltungen
CREATE TABLE IF NOT EXISTS events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titel             text NOT NULL,
  kurzbeschreibung  text,                         -- immer Deutsch, nur kurz
  originalsprache   text NOT NULL DEFAULT 'de',
  beginn            timestamptz NOT NULL,
  ende              timestamptz,
  ganztaegig        boolean NOT NULL DEFAULT false,
  ort_name          text NOT NULL,
  adresse           text,
  geo               geography(Point, 4326),
  land              char(2) NOT NULL,
  region            text,                         -- Bundesland / Region
  kategorien        text[] NOT NULL DEFAULT '{}',
  preis_text        text,
  gratis            boolean,
  bild_url          text,                         -- nur verlinkt, nie kopiert
  freiluft          boolean,
  sicherheit        text NOT NULL DEFAULT 'sicher' CHECK (sicherheit IN ('sicher', 'unsicher')),
  status            text NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv', 'geaendert', 'abgesagt', 'verschwunden')),
  von_nutzer        boolean NOT NULL DEFAULT false,
  fingerabdruck     text NOT NULL UNIQUE,         -- für die Erkennung von Doppelten
  erstellt          timestamptz NOT NULL DEFAULT now(),
  aktualisiert      timestamptz NOT NULL DEFAULT now(),
  zuletzt_gesehen   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_geo_idx ON events USING gist (geo);
CREATE INDEX IF NOT EXISTS events_beginn_idx ON events (beginn);
CREATE INDEX IF NOT EXISTS events_kategorien_idx ON events USING gin (kategorien);

-- Ein Event kann aus mehreren Quellen stammen → mehrere Links
CREATE TABLE IF NOT EXISTS event_links (
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  quelle_id  text REFERENCES quellen(id) ON DELETE SET NULL,
  url        text NOT NULL,
  PRIMARY KEY (event_id, url)
);

-- Änderungen an Events (Absage, neuer Termin) für Push-Hinweise
CREATE TABLE IF NOT EXISTS event_aenderungen (
  id         bigserial PRIMARY KEY,
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  art        text NOT NULL CHECK (art IN ('termin', 'abgesagt', 'verschwunden')),
  alt        jsonb,
  neu        jsonb,
  erkannt_am timestamptz NOT NULL DEFAULT now()
);

-- Handys (kein Login: jedes Gerät bekommt eine unsichtbare Kennung)
CREATE TABLE IF NOT EXISTS geraete (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash         text NOT NULL UNIQUE,          -- SHA-256 des geheimen Geräte-Tokens
  uebertragungscode  text UNIQUE,                   -- z. B. 'ADLER-4821', für Handywechsel
  code_gueltig_bis   timestamptz,
  ist_admin          boolean NOT NULL DEFAULT false, -- Michis Handy: bekommt Quellen-Warnungen
  erstellt           timestamptz NOT NULL DEFAULT now(),
  zuletzt_aktiv      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS einstellungen (
  geraet_id        uuid PRIMARY KEY REFERENCES geraete(id) ON DELETE CASCADE,
  wohnort_name     text,
  wohnort          geography(Point, 4326),
  umkreis_km       integer NOT NULL DEFAULT 50,
  interessen       text[] NOT NULL DEFAULT '{}',
  push_aktiv       boolean NOT NULL DEFAULT true,
  neu_fuer_dich    boolean NOT NULL DEFAULT true,
  seltener         boolean NOT NULL DEFAULT false,
  wochenend_tipp   boolean NOT NULL DEFAULT true,
  schriftgroesse   text NOT NULL DEFAULT 'gross' CHECK (schriftgroesse IN ('normal', 'gross', 'sehr_gross')),
  theme            text NOT NULL DEFAULT 'auto' CHECK (theme IN ('auto', 'hell', 'dunkel')),
  aktualisiert     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favoriten (
  geraet_id  uuid NOT NULL REFERENCES geraete(id) ON DELETE CASCADE,
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  erstellt   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (geraet_id, event_id)
);

CREATE TABLE IF NOT EXISTS erinnerungen (
  id          bigserial PRIMARY KEY,
  geraet_id   uuid NOT NULL REFERENCES geraete(id) ON DELETE CASCADE,
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  zeitpunkt   timestamptz NOT NULL,
  art         text NOT NULL CHECK (art IN ('vortag', 'am_tag')),
  gesendet_am timestamptz,
  UNIQUE (geraet_id, event_id, art)
);
CREATE INDEX IF NOT EXISTS erinnerungen_offen_idx ON erinnerungen (zeitpunkt) WHERE gesendet_am IS NULL;

CREATE TABLE IF NOT EXISTS push_abos (
  id         bigserial PRIMARY KEY,
  geraet_id  uuid NOT NULL REFERENCES geraete(id) ON DELETE CASCADE,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  erstellt   timestamptz NOT NULL DEFAULT now()
);

-- Verschickte Push-Nachrichten (für "höchstens 1× pro Tag" und Nachtruhe)
CREATE TABLE IF NOT EXISTS push_log (
  id          bigserial PRIMARY KEY,
  geraet_id   uuid NOT NULL REFERENCES geraete(id) ON DELETE CASCADE,
  art         text NOT NULL,
  titel       text,
  gesendet_am timestamptz NOT NULL DEFAULT now()
);

-- Zwischenspeicher für Ortssuche (Nominatim erlaubt nur 1 Abfrage pro Sekunde)
CREATE TABLE IF NOT EXISTS geocode_cache (
  anfrage     text PRIMARY KEY,
  lat         double precision,
  lng         double precision,
  gefunden_am timestamptz NOT NULL DEFAULT now()
);

-- Schutz der Teilen-/KI-Funktion vor Missbrauch
CREATE TABLE IF NOT EXISTS ki_aufrufe (
  id         bigserial PRIMARY KEY,
  geraet_id  uuid REFERENCES geraete(id) ON DELETE SET NULL,
  zweck      text NOT NULL,
  zeitpunkt  timestamptz NOT NULL DEFAULT now()
);

-- Umkreissuche: Events um einen Punkt, nach Zeitraum und Kategorien
CREATE OR REPLACE FUNCTION events_im_umkreis(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision,
  p_von timestamptz,
  p_bis timestamptz,
  p_kategorien text[] DEFAULT NULL
)
RETURNS TABLE (event_id uuid, entfernung_km double precision)
LANGUAGE sql STABLE AS $fn$
  SELECT e.id,
         ST_Distance(e.geo, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 1000.0
  FROM events e
  WHERE e.status <> 'verschwunden'
    AND e.geo IS NOT NULL
    AND coalesce(e.ende, e.beginn) >= p_von
    AND e.beginn <= p_bis
    AND (p_radius_km IS NULL OR ST_DWithin(e.geo, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000))
    AND (p_kategorien IS NULL OR e.kategorien && p_kategorien)
  ORDER BY e.beginn
$fn$;
