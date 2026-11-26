// Nächtlicher Lauf des Event-Sammlers.
// Lokal:  node --env-file=.env.local pipeline/lauf.ts [--quelle=meinbezirk] [--trocken]
import type { Quelle, RohEvent } from "./typen.ts";
import { holeText } from "./lib/http.ts";
import { db, dbSchliessen } from "./lib/db.ts";
import { speichereEvents, verschwundeneMarkieren, leereStatistik } from "./speichern.ts";
import { kaerntnerMessen } from "./quellen/kaerntner-messen.ts";
import { BUNDESLAENDER, meinbezirkQuelle } from "./quellen/meinbezirk.ts";
import { KI_SEITEN, kiQuelle } from "./quellen/ki-seiten.ts";
import { kiAufrufeBisher } from "./lib/gemini.ts";
import { GEMEINDEN, gemeindeQuelle } from "./quellen/gemeinde-kalender.ts";
import { kranjskaGora } from "./quellen/kranjska-gora.ts";
import { suedtirol } from "./quellen/suedtirol.ts";
import { dolomiti } from "./quellen/dolomiti.ts";
import { aufraeumen } from "./aufraeumen.ts";

// Reihenfolge = Wichtigkeit: Kärnten und Grenzgebiete zuerst, dann die anderen Bundesländer
const [meinbezirkKaernten, ...meinbezirkRest] = BUNDESLAENDER.map(meinbezirkQuelle);
const ALLE_QUELLEN: Quelle[] = [
  kaerntnerMessen,
  meinbezirkKaernten,
  ...GEMEINDEN.map(gemeindeQuelle),
  kranjskaGora,
  suedtirol,
  dolomiti,
  ...KI_SEITEN.map(kiQuelle),
  ...meinbezirkRest,
];
// Zeitgrenze: danach keine neue Quelle mehr anfangen (der Lauf soll sauber enden, bevor GitHub ihn abbricht)
const MAX_MINUTEN = Number(process.env.MAX_MINUTEN ?? 320);

const args = process.argv.slice(2);
const nurQuelle = args.find((a) => a.startsWith("--quelle="))?.split("=")[1];
const trocken = args.includes("--trocken");

function log(t: string) {
  console.log(t);
}

interface QuellenBericht {
  quelle: string;
  gefunden: number;
  fehler?: string;
  hinweise: string[];
  statistik?: ReturnType<typeof leereStatistik>;
  verschwunden?: number;
  sekunden: number;
}

async function main() {
  const laufStart = new Date();
  // --quelle=gemeinde-* → alle Quellen, deren Kennung so beginnt
  const passt = (id: string) =>
    !nurQuelle || (nurQuelle.endsWith("*") ? id.startsWith(nurQuelle.slice(0, -1)) : id === nurQuelle);
  const quellen = ALLE_QUELLEN.filter((q) => passt(q.id));
  if (!quellen.length) throw new Error(`Unbekannte Quelle: ${nurQuelle}`);
  log(`Event-Sammler startet (${quellen.map((q) => q.id).join(", ")})${trocken ? " – TROCKENLAUF, nichts wird gespeichert" : ""}`);

  const pool = db();
  // Ersatz-Termin: Wenn heute Nacht schon fertig gesammelt wurde, nichts doppelt tun
  if (args.includes("--nur-falls-noetig") && !nurQuelle) {
    const { rows } = await pool.query(
      // Teil-Läufe (nur einzelne Quellen, z. B. zum Testen) zählen nicht
      `SELECT 1 FROM sammler_laeufe WHERE beendet IS NOT NULL AND gestartet > now() - interval '18 hours'
         AND NOT coalesce((bericht->>'teil')::boolean, false) LIMIT 1`,
    );
    if (rows.length) {
      log("Heute wurde schon gesammelt – Ersatz-Lauf nicht nötig.");
      await dbSchliessen();
      return;
    }
  }
  let laufId: number | null = null;
  if (!trocken) {
    const { rows } = await pool.query("INSERT INTO sammler_laeufe (gestartet) VALUES ($1) RETURNING id", [laufStart]);
    laufId = rows[0].id;
  }

  const berichte: QuellenBericht[] = [];
  for (const q of quellen) {
    if (Date.now() - laufStart.getTime() > MAX_MINUTEN * 60_000) {
      log(`
⏱ Zeitgrenze von ${MAX_MINUTEN} Minuten erreicht – ${q.name} und folgende kommen beim nächsten Lauf dran.`);
      break;
    }
    const t0 = Date.now();
    log(`\n▶ ${q.name}`);
    if (!trocken) {
      await pool.query(
        `INSERT INTO quellen (id, name, url, art, land) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url, art = EXCLUDED.art, land = EXCLUDED.land`,
        [q.id, q.name, q.url, q.art, q.land]
      );
    }
    const bekannteUrls = new Set<string>();
    const bericht: QuellenBericht = { quelle: q.id, gefunden: 0, hinweise: [], sekunden: 0 };
    let events: RohEvent[] = [];
    try {
      const erg = await q.holen({ holeText: (u) => holeText(u), log, bekannteUrls, trocken });
      events = erg.events;
      bericht.gefunden = events.length;
      bericht.hinweise = erg.hinweise;
      log(`  ${events.length} Termine ausgelesen`);
      erg.hinweise.slice(0, 10).forEach((h) => log(`  Hinweis: ${h}`));

      if (trocken) {
        for (const e of events.slice(0, Number(process.env.TROCKEN_ZEILEN ?? 15))) {
          log(`   · ${e.beginn.toISOString().slice(0, 16)} | ${e.titel} | ${e.ortName} | ${e.kategorien.join(",")}`);
        }
      } else {
        const st = leereStatistik();
        await speichereEvents(events, st, log);
        bericht.statistik = st;
        bericht.verschwunden = await verschwundeneMarkieren(q.id, q.horizontTage, laufStart);
        log(`  gespeichert: ${JSON.stringify(st)}, verschwunden: ${bericht.verschwunden}`);
      }
    } catch (err) {
      bericht.fehler = (err as Error).message;
      log(`  FEHLER: ${bericht.fehler}`);
      // Wo genau? (erste Zeilen der Spur, hilft beim Reparieren)
      (err as Error).stack?.split("\n").slice(1, 4).forEach((z) => log(`    ${z.trim()}`));
    }
    bericht.sekunden = Math.round((Date.now() - t0) / 1000);
    berichte.push(bericht);

    if (!trocken) {
      // Gesundheit der Quelle: deutlich weniger als sonst → „schlechte Nacht“
      const { rows } = await pool.query("SELECT durchschnitt FROM quellen WHERE id = $1", [q.id]);
      const schnitt = rows[0]?.durchschnitt == null ? null : Number(rows[0].durchschnitt);
      const kontingent = /Höchstzahl|GEMINI_API_KEY fehlt/.test(bericht.fehler ?? "");
      const schlecht =
        !kontingent &&
        (!!bericht.fehler ||
          (bericht.gefunden === 0 && !q.leerOk) ||
          (schnitt != null && schnitt >= 5 && bericht.gefunden < schnitt * 0.4));
      const neuerSchnitt = bericht.fehler ? schnitt : schnitt == null ? bericht.gefunden : schnitt * 0.7 + bericht.gefunden * 0.3;
      await pool.query(
        `UPDATE quellen SET letzter_lauf = now(), gefunden_letzter_lauf = $2, durchschnitt = $3,
           schlechte_naechte = CASE WHEN $4 THEN schlechte_naechte + 1 ELSE 0 END, letzter_fehler = $5
         WHERE id = $1`,
        [q.id, bericht.gefunden, neuerSchnitt, schlecht, bericht.fehler ?? null]
      );
    }
  }

  // Nach einem vollen Lauf: übersehene Doppelte zusammenführen, Vergangenes löschen
  if (!nurQuelle) {
    try {
      await aufraeumen(trocken, log);
    } catch (err) {
      log(`  Aufräumen fehlgeschlagen: ${(err as Error).message}`);
    }
  }

  if (!trocken && laufId != null) {
    const { rows: warnungen } = await pool.query("SELECT id, name, schlechte_naechte FROM quellen WHERE schlechte_naechte >= 2 AND aktiv");
    await pool.query("UPDATE sammler_laeufe SET beendet = now(), bericht = $2 WHERE id = $1", [
      laufId,
      JSON.stringify({ quellen: berichte, warnungen, teil: !!nurQuelle }),
    ]);
    if (warnungen.length) log(`\n⚠ Quellen mit Problemen: ${warnungen.map((w) => w.name).join(", ")}`);
    const { rows } = await pool.query("SELECT count(*)::int n FROM events WHERE coalesce(ende, beginn) >= now() AND status <> 'verschwunden'");
    log(`\nFertig. Kommende Events in der Datenbank: ${rows[0].n}`);
  }
  await dbSchliessen();
  if (berichte.every((b) => b.fehler)) process.exitCode = 1;
}

main().catch(async (err) => {
  console.error(err);
  await dbSchliessen();
  process.exit(1);
});
