import "server-only";
import { sql } from "./db";
import { sendePush, type Nachricht } from "./push-server";
import { tagText, wienStunde, zeitText } from "./datum";
import { NOCH_NICHT_VORBEI_SQL } from "./events-server";

// Was die App wann verschickt (Zeiten in Wien):
//   Morgens ~8 Uhr:  Erinnerung „Heute“, Absagen/Terminänderungen, „Neu für dich“, Quellen-Warnung an Michi
//   Abends ~18 Uhr:  Erinnerung „Morgen“, donnerstags der Wochenend-Tipp
// Nachtruhe 21–8 Uhr: außerhalb dieser Zeit wird nichts verschickt.

export type Bericht = Record<string, number | string>;

const MIT_ABO = "EXISTS (SELECT 1 FROM push_abos p WHERE p.geraet_id = %s)";
const mitAbo = (spalte: string) => MIT_ABO.replace("%s", spalte);

function nachtruhe(): boolean {
  const h = wienStunde();
  return h < 8 || h >= 21;
}

function wochentagWien(): number {
  const t = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Vienna", weekday: "short" }).format(new Date());
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(t);
}

function kurz(text: string, n = 60) {
  return text.length > n ? text.slice(0, n - 1).trimEnd() + "…" : text;
}

function nachGeraet<T extends { geraet_id: string }>(zeilen: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const z of zeilen) m.set(z.geraet_id, [...(m.get(z.geraet_id) ?? []), z]);
  return m;
}

interface ErinnerungsZeile {
  geraet_id: string;
  id: string;
  titel: string;
  ort_name: string;
  beginn: string;
  ende: string | null;
  ganztaegig: boolean;
}

/** Erinnerung an gemerkte Events, die heute (art=am_tag) bzw. morgen (art=vortag) beginnen. */
async function erinnerungen(art: "am_tag" | "vortag"): Promise<number> {
  const db = sql();
  const tagPlus = art === "vortag" ? 1 : 0;
  const zeilen = (await db.query(
    `SELECT f.geraet_id, e.id, e.titel, e.ort_name, e.beginn, e.ende, e.ganztaegig
       FROM favoriten f
       JOIN events e ON e.id = f.event_id
       JOIN einstellungen s ON s.geraet_id = f.geraet_id
      WHERE s.erinnern AND f.erinnern
        AND ${mitAbo("f.geraet_id")}
        AND e.status IN ('aktiv', 'geaendert')
        AND (e.beginn AT TIME ZONE 'Europe/Vienna')::date = (now() AT TIME ZONE 'Europe/Vienna')::date + $1::int
        AND NOT EXISTS (SELECT 1 FROM erinnerungen r WHERE r.geraet_id = f.geraet_id AND r.event_id = e.id
                         AND r.art = $2 AND r.gesendet_am IS NOT NULL)
      ORDER BY e.beginn`,
    [tagPlus, art]
  )) as ErinnerungsZeile[];

  let gesendet = 0;
  for (const [geraet, liste] of nachGeraet(zeilen)) {
    const wann = art === "vortag" ? "Morgen" : "Heute";
    const e = liste[0];
    const n: Nachricht =
      liste.length === 1
        ? {
            title: `${wann}: ${kurz(e.titel, 70)}`,
            body: `${zeitText({ beginn: new Date(e.beginn).toISOString(), ende: e.ende ? new Date(e.ende).toISOString() : null, ganztaegig: e.ganztaegig })} · ${e.ort_name}`,
            url: `/event/${e.id}`,
            tag: `erinnerung-${e.id}`,
          }
        : {
            title: `${wann} ist was los: ${liste.length} gemerkte Veranstaltungen`,
            body: liste.map((x) => kurz(x.titel, 40)).join(" · "),
            url: "/meine",
            tag: `erinnerung-${art}`,
          };
    if ((await sendePush(geraet, n, "erinnerung")) > 0) {
      gesendet++;
      for (const x of liste) {
        await db.query(
          `INSERT INTO erinnerungen (geraet_id, event_id, zeitpunkt, art, gesendet_am) VALUES ($1, $2, now(), $3, now())
           ON CONFLICT (geraet_id, event_id, art) DO UPDATE SET gesendet_am = now()`,
          [geraet, x.id, art]
        );
      }
    }
  }
  return gesendet;
}

/** Absagen und Terminänderungen bei gemerkten Events melden (jede Änderung nur einmal). */
async function aenderungen(): Promise<number> {
  const db = sql();
  const [{ bis_id: bisId }] = (await db.query("SELECT coalesce(max(id), 0) AS bis_id FROM event_aenderungen")) as { bis_id: number }[];
  const zeilen = (await db.query(
    `SELECT a.id AS aenderung_id, a.art, f.geraet_id, e.id, e.titel, e.beginn
       FROM event_aenderungen a
       JOIN events e ON e.id = a.event_id
       JOIN favoriten f ON f.event_id = a.event_id
      WHERE NOT a.gemeldet AND a.id <= $1
        AND coalesce(e.ende, e.beginn) > now() - interval '1 day'
        AND ${mitAbo("f.geraet_id")}`,
    [bisId]
  )) as { aenderung_id: number; art: string; geraet_id: string; id: string; titel: string; beginn: string }[];

  let gesendet = 0;
  for (const z of zeilen) {
    const n: Nachricht =
      z.art === "termin"
        ? {
            title: `Achtung, neuer Termin: ${kurz(z.titel, 55)}`,
            body: `Jetzt: ${tagText(new Date(z.beginn).toISOString())}. Bitte auf der Originalseite prüfen.`,
            url: `/event/${z.id}`,
            tag: `aenderung-${z.id}`,
          }
        : {
            title: `Achtung: ${kurz(z.titel, 55)}`,
            body: "Steht nicht mehr auf der Originalseite – möglicherweise abgesagt. Bitte dort nachschauen.",
            url: `/event/${z.id}`,
            tag: `aenderung-${z.id}`,
          };
    gesendet += (await sendePush(z.geraet_id, n, "aenderung")) > 0 ? 1 : 0;
  }
  // Als erledigt gilt nur, was es beim Lesen schon gab (auch Änderungen an nicht gemerkten Events) –
  // was der Sammler währenddessen neu einträgt, kommt beim nächsten Mal dran
  await db.query("UPDATE event_aenderungen SET gemeldet = true WHERE NOT gemeldet AND id <= $1", [bisId]);
  return gesendet;
}

/** „Neu für dich“: neue Events zu den Interessen im eigenen Umkreis – höchstens 1× am Tag bzw. 2× pro Woche. */
async function neuFuerDich(): Promise<number> {
  const db = sql();
  const montagOderDonnerstag = [1, 4].includes(wochentagWien());
  const geraete = (await db.query(
    `SELECT s.geraet_id, s.seltener, s.umkreis_km, s.interessen, s.wohnort,
            (SELECT max(l.gesendet_am) FROM push_log l WHERE l.geraet_id = s.geraet_id AND l.art = 'neu') AS zuletzt
       FROM einstellungen s
      WHERE s.neu_fuer_dich AND s.wohnort IS NOT NULL AND cardinality(s.interessen) > 0 AND ${mitAbo("s.geraet_id")}`
  )) as { geraet_id: string; seltener: boolean; umkreis_km: number; interessen: string[]; wohnort: string; zuletzt: string | null }[];

  let gesendet = 0;
  for (const g of geraete) {
    if (g.seltener && !montagOderDonnerstag) continue;
    const tage = g.seltener ? 4 : 1;
    const zuletzt = g.zuletzt ? new Date(g.zuletzt).getTime() : 0;
    if (Date.now() - zuletzt < 20 * 3600_000) continue; // höchstens 1× am Tag
    const seit = new Date(Math.max(zuletzt, Date.now() - tage * 86_400_000));
    const neu = (await db.query(
      `SELECT e.id, e.titel, e.ort_name, e.beginn
         FROM events e
        WHERE e.erstellt > $1 AND e.status = 'aktiv' AND NOT e.von_nutzer
          AND e.beginn > now() AND e.beginn < now() + interval '90 days'
          AND e.kategorien && $2::text[]
          AND ST_DWithin(e.geo, $3::geography, $4::float8 * 1000)
        ORDER BY e.beginn
        LIMIT 30`,
      [seit.toISOString(), g.interessen, g.wohnort, g.umkreis_km]
    )) as { id: string; titel: string; ort_name: string; beginn: string }[];
    if (!neu.length) continue;
    const e = neu[0];
    const n: Nachricht =
      neu.length === 1
        ? {
            title: `Neu für dich: ${kurz(e.titel, 60)}`,
            body: `${tagText(new Date(e.beginn).toISOString())} · ${e.ort_name}`,
            url: `/event/${e.id}`,
            tag: "neu",
          }
        : {
            title: `${neu.length} neue Veranstaltungen für dich`,
            body: neu.slice(0, 3).map((x) => kurz(x.titel, 38)).join(" · ") + (neu.length > 3 ? " …" : ""),
            url: `/suchen?neu=${tage}&zeit=drei-monate&radius=${g.umkreis_km}&kat=${g.interessen.join(",")}`,
            tag: "neu",
          };
    gesendet += (await sendePush(g.geraet_id, n, "neu")) > 0 ? 1 : 0;
  }
  return gesendet;
}

/** Donnerstagabend: die besten Events fürs Wochenende (eigene Interessen zuerst, dann nach Entfernung). */
async function wochenendTipp(): Promise<number> {
  const db = sql();
  const geraete = (await db.query(
    `SELECT s.geraet_id, s.umkreis_km, s.interessen, s.wohnort
       FROM einstellungen s
      WHERE s.wochenend_tipp AND s.wohnort IS NOT NULL AND ${mitAbo("s.geraet_id")}
        AND NOT EXISTS (SELECT 1 FROM push_log l WHERE l.geraet_id = s.geraet_id AND l.art = 'wochenende'
                         AND l.gesendet_am > now() - interval '3 days')`
  )) as { geraet_id: string; umkreis_km: number; interessen: string[]; wohnort: string }[];

  let gesendet = 0;
  for (const g of geraete) {
    const tipps = (await db.query(
      `WITH woche AS (SELECT date_trunc('week', now() AT TIME ZONE 'Europe/Vienna') AS montag)
       SELECT e.id, e.titel, e.ort_name
         FROM events e, woche w
        WHERE e.status IN ('aktiv', 'geaendert')
          AND NOT e.von_nutzer -- selbst eingetragene (von irgendeinem Handy) nicht an alle schicken
          AND ${NOCH_NICHT_VORBEI_SQL} >= ((w.montag + interval '4 days 14 hours') AT TIME ZONE 'Europe/Vienna')
          AND e.beginn < ((w.montag + interval '7 days') AT TIME ZONE 'Europe/Vienna')
          AND ST_DWithin(e.geo, $1::geography, $2::float8 * 1000)
        ORDER BY (e.kategorien && $3::text[]) DESC,
                 (e.ende IS NOT NULL AND e.ende - e.beginn > interval '3 days') ASC,
                 ST_Distance(e.geo, $1::geography)
        LIMIT 5`,
      [g.wohnort, g.umkreis_km, g.interessen]
    )) as { id: string; titel: string; ort_name: string }[];
    if (!tipps.length) continue;
    const n: Nachricht = {
      title: "Dein Wochenend-Tipp 🎉",
      body: tipps.slice(0, 3).map((t) => `${kurz(t.titel, 34)} (${kurz(t.ort_name.split(",").pop()!.trim(), 18)})`).join(" · "),
      url: "/suchen?zeit=wochenende",
      tag: "wochenende",
    };
    gesendet += (await sendePush(g.geraet_id, n, "wochenende")) > 0 ? 1 : 0;
  }
  return gesendet;
}

/** Warnung an Michi: Quelle liefert 2 Nächte kaum etwas, oder der Nachtlauf ist ausgefallen. */
async function adminWarnungen(): Promise<number> {
  const db = sql();
  const admins = (await db.query(`SELECT id FROM geraete g WHERE g.ist_admin AND ${mitAbo("g.id")}`)) as { id: string }[];
  if (!admins.length) return 0;
  const meldungen: string[] = [];

  const schlecht = (await db.query(
    `UPDATE quellen SET gewarnt_am = now()
      WHERE aktiv AND schlechte_naechte >= 2 AND (gewarnt_am IS NULL OR gewarnt_am < now() - interval '20 hours')
      RETURNING name`
  )) as { name: string }[];
  if (schlecht.length) meldungen.push(`Quelle macht Probleme: ${schlecht.map((q) => q.name).join(", ")}`);

  const lauf = (await db.query(
    "SELECT max(beendet) AS zuletzt FROM sammler_laeufe WHERE beendet IS NOT NULL"
  )) as { zuletzt: string | null }[];
  const schonGewarnt = (await db.query(
    "SELECT 1 FROM push_log WHERE art = 'admin-lauf' AND gesendet_am > now() - interval '20 hours' LIMIT 1"
  )) as unknown[];
  if ((!lauf[0]?.zuletzt || Date.now() - new Date(lauf[0].zuletzt).getTime() > 30 * 3600_000) && !schonGewarnt.length) {
    meldungen.push("Der nächtliche Event-Sammler ist ausgefallen (seit über 30 Stunden kein Lauf).");
  }
  if (!meldungen.length) return 0;

  let gesendet = 0;
  for (const a of admins) {
    const art = meldungen.some((m) => m.startsWith("Der nächtliche")) ? "admin-lauf" : "admin";
    gesendet += (await sendePush(a.id, { title: "⚠️ Wo is wos los – Wartung", body: meldungen.join(" "), url: "/status", tag: "admin" }, art)) > 0 ? 1 : 0;
  }
  return gesendet;
}

async function sicher(name: string, bericht: Bericht, f: () => Promise<number>) {
  try {
    bericht[name] = await f();
  } catch (e) {
    console.error(name, e);
    bericht[name] = `Fehler: ${(e as Error).message}`;
  }
}

export async function morgenRunde(): Promise<Bericht> {
  const bericht: Bericht = {};
  if (nachtruhe()) return { uebersprungen: "Nachtruhe" };
  await sicher("heute", bericht, () => erinnerungen("am_tag"));
  await sicher("aenderungen", bericht, aenderungen);
  await sicher("neuFuerDich", bericht, neuFuerDich);
  await sicher("admin", bericht, adminWarnungen);
  return bericht;
}

export async function abendRunde(): Promise<Bericht> {
  const bericht: Bericht = {};
  if (nachtruhe()) return { uebersprungen: "Nachtruhe" };
  await sicher("morgen", bericht, () => erinnerungen("vortag"));
  if (wochentagWien() === 4) await sicher("wochenende", bericht, wochenendTipp);
  return bericht;
}
