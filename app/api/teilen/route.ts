import { sql } from "@/lib/db";
import { geraetAusAnfrage, nichtErlaubt } from "@/lib/geraet-server";
import { ortFinden } from "@/lib/ort-server";
import { KATEGORIEN } from "@/lib/kategorien";
import { fingerabdruck } from "@/pipeline/lib/doppelte";

const LAENDER = new Set(["AT", "SI", "IT"]);

// Geteilte Veranstaltung speichern (Kennzeichen „von dir hinzugefügt“) und gleich merken
export async function POST(req: Request) {
  const geraet = await geraetAusAnfrage(req);
  if (!geraet) return nichtErlaubt();
  const e = (await req.json().catch(() => ({}))) as {
    titel?: string;
    datum?: string;
    uhrzeit?: string;
    datumEnde?: string;
    ort?: string;
    adresse?: string;
    kategorie?: string;
    kurzbeschreibung?: string;
    preisText?: string;
    gratis?: boolean | null;
    freiluft?: boolean | null;
    bildUrl?: string;
    url?: string;
  };
  const titel = (e.titel ?? "").trim().slice(0, 200);
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(e.datum ?? "") ? e.datum! : "";
  const uhrzeit = /^\d{2}:\d{2}$/.test(e.uhrzeit ?? "") ? e.uhrzeit! : "";
  const datumEnde = /^\d{4}-\d{2}-\d{2}$/.test(e.datumEnde ?? "") && e.datumEnde! >= datum ? e.datumEnde! : "";
  const ortName = (e.ort ?? "").trim().slice(0, 120);
  if (titel.length < 3) return Response.json({ fehler: "Bitte einen Namen eintragen." }, { status: 400 });
  if (!datum) return Response.json({ fehler: "Bitte ein Datum eintragen." }, { status: 400 });
  if (ortName.length < 2) return Response.json({ fehler: "Bitte den Ort eintragen." }, { status: 400 });

  const adresse = (e.adresse ?? "").trim().slice(0, 200);
  const ort = (adresse ? await ortFinden(`${adresse}, ${ortName}`) : null) ?? (await ortFinden(ortName));
  if (!ort) return Response.json({ fehler: `Den Ort „${ortName}“ habe ich nicht gefunden. Bitte genauer schreiben.` }, { status: 400 });
  if (!ort.land || !LAENDER.has(ort.land)) {
    return Response.json({ fehler: "Der Ort liegt außerhalb von Österreich, Slowenien und Italien." }, { status: 400 });
  }

  const kategorie = KATEGORIEN.some((k) => k.id === e.kategorie) ? e.kategorie! : "sonstiges";
  const url = /^https?:\/\//i.test(e.url ?? "") ? e.url!.slice(0, 1000) : null;
  const bild = /^https:\/\//.test(e.bildUrl ?? "") ? e.bildUrl!.slice(0, 1000) : null;
  const db = sql();

  const zeilen = (await db.query(
    `INSERT INTO events (titel, kurzbeschreibung, beginn, ende, ganztaegig, ort_name, adresse, geo, land, region, kategorien,
                         preis_text, gratis, bild_url, freiluft, von_nutzer, fingerabdruck)
     VALUES ($1, $2,
             (($3 || ' ' || coalesce(nullif($4, ''), '00:00'))::timestamp AT TIME ZONE 'Europe/Vienna'),
             CASE WHEN $5 <> '' THEN (($5 || ' 23:59')::timestamp AT TIME ZONE 'Europe/Vienna') END,
             $4 = '', $6, nullif($7, ''), ST_SetSRID(ST_MakePoint($9, $8), 4326)::geography, $10, $11, ARRAY[$12],
             nullif($13, ''), $14, $15, $16, true, $17)
     ON CONFLICT (fingerabdruck) DO UPDATE SET zuletzt_gesehen = now()
     RETURNING id`,
    [
      titel, (e.kurzbeschreibung ?? "").slice(0, 500) || null, datum, uhrzeit, datumEnde, ortName, adresse, ort.lat, ort.lng,
      ort.land, ort.region, kategorie, (e.preisText ?? "").slice(0, 120), e.gratis ?? null, bild, e.freiluft ?? null,
      fingerabdruck(titel, datum, ort.lat, ort.lng),
    ]
  )) as { id: string }[];
  const id = zeilen[0].id;
  if (url) await db.query("INSERT INTO event_links (event_id, url) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, url]);
  await db.query("INSERT INTO favoriten (geraet_id, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [geraet, id]);
  return Response.json({ id });
}
