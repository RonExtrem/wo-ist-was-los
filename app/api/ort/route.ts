import type { NextRequest } from "next/server";

const KENNUNG = "Mozilla/5.0 (compatible; WoIsWosLos/0.1; private Familien-App)";
// Alpen-Adria-Raum (Österreich, Slowenien, Norditalien, Südbayern) – nur hier wird gesucht
const GEBIET = { west: 9.4, sued: 44.8, ost: 17.3, nord: 48.9 };
const LAENDER = new Set(["AT", "SI", "IT", "DE", "HR"]);
const LAND_NAME: Record<string, string> = { AT: "Österreich", SI: "Slowenien", IT: "Italien", DE: "Deutschland", HR: "Kroatien" };

interface Treffer {
  name: string;
  lat: number;
  lng: number;
  zusatz?: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    name?: string;
    postcode?: string;
    city?: string;
    county?: string;
    state?: string;
    countrycode?: string;
    osm_value?: string;
  };
}

// Hat Photon gerade nicht geantwortet, ein paar Minuten gleich Nominatim nehmen (spart das Warten)
let photonPauseBis = 0;

async function photon(q: string, lang: string, lat: number, lng: number): Promise<PhotonFeature[]> {
  if (Date.now() < photonPauseBis) throw new Error("Photon pausiert");
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", lang);
  // Orte in der Nähe des Startpunkts zuerst
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("bbox", `${GEBIET.west},${GEBIET.sued},${GEBIET.ost},${GEBIET.nord}`);
  for (const ebene of ["city", "district", "locality"]) url.searchParams.append("layer", ebene);
  // Photon ist manchmal überlastet → nicht lange warten, dann übernimmt Nominatim
  const res = await fetch(url, { headers: { "User-Agent": KENNUNG }, signal: AbortSignal.timeout(4_000) });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const d = (await res.json()) as { features?: PhotonFeature[] };
  return (d.features ?? []).filter((f) => f.properties.name && LAENDER.has(f.properties.countrycode?.toUpperCase() ?? ""));
}

/** Ersatz, falls Photon nicht antwortet: Nominatim, Orte rund um den Startpunkt zuerst. */
async function nominatim(q: string, lat: number, lng: number): Promise<Treffer[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "10");
  url.searchParams.set("countrycodes", "at,si,it,de");
  url.searchParams.set("accept-language", "de");
  url.searchParams.set("viewbox", `${lng - 1.2},${lat + 0.7},${lng + 1.2},${lat - 0.7}`);
  const res = await fetch(url, { headers: { "User-Agent": KENNUNG }, signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return [];
  const daten = (await res.json()) as {
    lat: string;
    lon: string;
    name?: string;
    category?: string;
    display_name: string;
    address?: Record<string, string>;
  }[];
  const gesehen = new Set<string>();
  const treffer: Treffer[] = [];
  for (const d of daten) {
    if (d.category !== "place" && d.category !== "boundary") continue;
    const a = d.address ?? {};
    const name = d.name || d.display_name.split(",")[0];
    const gehoertZu = [a.city, a.town, a.municipality, a.village].find((x) => x && x !== name);
    const zusatz = [a.postcode && gehoertZu ? `${a.postcode} ${gehoertZu}` : (gehoertZu ?? a.postcode), a.state, a.country]
      .filter(Boolean)
      .join(", ");
    if (gesehen.has(`${name}|${zusatz}`)) continue;
    gesehen.add(`${name}|${zusatz}`);
    treffer.push({ name, lat: Number(d.lat), lng: Number(d.lon), zusatz });
  }
  return treffer;
}

/** Postleitzahl → Ort (Nominatim, nur Österreich/Slowenien bei 4 Stellen, Italien bei 5). */
async function postleitzahl(plz: string): Promise<Treffer[]> {
  const laender = plz.length === 4 ? ["at", "si"] : ["it"];
  const treffer: Treffer[] = [];
  for (const land of laender) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("postalcode", plz);
    url.searchParams.set("country", land);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "3");
    url.searchParams.set("accept-language", "de");
    const res = await fetch(url, { headers: { "User-Agent": KENNUNG }, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) continue;
    const daten = (await res.json()) as { lat: string; lon: string; display_name: string; address?: Record<string, string> }[];
    for (const d of daten) {
      const a = d.address ?? {};
      const ort = a.town ?? a.city ?? a.village ?? a.municipality ?? d.display_name.split(",")[1]?.trim() ?? "";
      treffer.push({
        name: `${plz} ${ort}`.trim(),
        lat: Number(d.lat),
        lng: Number(d.lon),
        zusatz: [a.state, a.country].filter(Boolean).join(", "),
      });
    }
    if (treffer.length) break;
  }
  return treffer;
}

// Ortssuche für „Anderer Ort…“ und den Wohnort: auch kleine Ortschaften, Tippfehler und Postleitzahlen
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const roh = p.get("q")?.trim().replace(/\s+/g, " ").slice(0, 100) ?? "";
  if (roh.length < 2) return Response.json({ orte: [] });
  const lat = Number(p.get("lat")) || 46.75;
  const lng = Number(p.get("lng")) || 13.6;

  try {
    // Nur eine Postleitzahl (z. B. „9500“)
    const nurPlz = roh.match(/^(\d{4,5})$/);
    if (nurPlz) return Response.json({ orte: await postleitzahl(nurPlz[1]) });

    // „9500 Buch“ → Postleitzahl hilft beim Sortieren; „Buch bei Villach“ → „Buch Villach“
    const plz = roh.match(/\b(\d{4,5})\b/)?.[1];
    const text = roh.replace(/\b\d{4,5}\b/, "").replace(/\s+(bei|b\.|nahe|in der nähe von)\s+/i, " ").trim() || roh;

    // Deutsche Namen (Tarvis, Laibach …) und Originalnamen (Tarvisio, Ljubljana …) gleichzeitig holen
    let de: PhotonFeature[];
    let original: PhotonFeature[];
    try {
      [de, original] = await Promise.all([photon(text, "de", lat, lng), photon(text, "default", lat, lng).catch(() => [])]);
    } catch {
      photonPauseBis = Date.now() + 5 * 60_000;
      const ersatz = await nominatim(text, lat, lng);
      if (!ersatz.length && plz) return Response.json({ orte: await postleitzahl(plz) });
      return Response.json({ orte: ersatz.slice(0, 6) });
    }
    const originalName = new Map(original.map((f) => [f.properties.osm_id, f.properties.name]));

    const gesehen = new Set<string>();
    let orte: (Treffer & { plzPasst: boolean })[] = [];
    for (const f of de.length ? de : original) {
      const pr = f.properties;
      const name = pr.name!;
      const anders = originalName.get(pr.osm_id);
      const titel = anders && anders !== name ? `${name} (${anders})` : name;
      const gehoertZu = pr.city && pr.city !== name ? pr.city : pr.county && pr.county !== name ? pr.county : null;
      const land = LAND_NAME[pr.countrycode?.toUpperCase() ?? ""];
      const zusatz = [pr.postcode && gehoertZu ? `${pr.postcode} ${gehoertZu}` : (gehoertZu ?? pr.postcode), pr.state, land]
        .filter(Boolean)
        .join(", ");
      const schluessel = `${titel}|${zusatz}`;
      if (gesehen.has(schluessel)) continue;
      gesehen.add(schluessel);
      orte.push({
        name: titel,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        zusatz,
        plzPasst: !!plz && pr.postcode === plz,
      });
    }
    if (plz) orte = [...orte.filter((o) => o.plzPasst), ...orte.filter((o) => !o.plzPasst)];
    // Nichts gefunden, aber eine Postleitzahl dabei → wenigstens den PLZ-Ort anbieten
    if (!orte.length && plz) return Response.json({ orte: await postleitzahl(plz) });
    return Response.json({ orte: orte.slice(0, 6).map((o) => ({ name: o.name, lat: o.lat, lng: o.lng, zusatz: o.zusatz })) });
  } catch {
    return Response.json({ orte: [] });
  }
}
