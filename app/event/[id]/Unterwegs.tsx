"use client";

// Fahrzeit (OSRM, gratis) und Wetter-Vorhersage (Open-Meteo, gratis) – beides ohne Schlüssel, direkt vom Handy abgefragt.
import { useEffect, useState } from "react";
import {
  Car,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  Umbrella,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";
import { wienTag } from "@/lib/datum";

function luftlinie(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

function dauerText(sek: number) {
  // Etwas Puffer: Der Routenplaner rechnet mit freier Fahrt
  const min = Math.round((sek * 1.1) / 60 / 5) * 5 || 5;
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} Std. ${rest} Min.` : `${h} Std.`;
}

/** „ca. 35 Min. mit dem Auto (39 km) von Spittal“ – fällt auf Luftlinie zurück, solange nichts da ist. */
export function FahrzeitZeile({ lat, lng }: { lat: number; lng: number }) {
  const { startpunkt, bereit } = useApp();
  const schluessel = `${startpunkt.lat},${startpunkt.lng}>${lat},${lng}`;
  const [route, setRoute] = useState<{ schluessel: string; sek: number; km: number } | null>(null);

  useEffect(() => {
    if (!bereit) return;
    const ab = new AbortController();
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${startpunkt.lng},${startpunkt.lat};${lng},${lat}?overview=false`,
      { signal: ab.signal }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { code: string; routes?: { duration: number; distance: number }[] } | null) => {
        const r = d?.code === "Ok" ? d.routes?.[0] : null;
        if (r) setRoute({ schluessel, sek: r.duration, km: r.distance / 1000 });
      })
      .catch(() => {});
    return () => ab.abort();
  }, [bereit, schluessel, startpunkt.lat, startpunkt.lng, lat, lng]);

  if (!bereit) return null;
  const von = startpunkt.art === "hier" ? "deinem Standort" : startpunkt.name;
  const aktuell = route?.schluessel === schluessel ? route : null;
  const luft = luftlinie(startpunkt, { lat, lng });

  if (luft < 1) return <p className="mt-1 font-semibold text-laerche">Gleich bei {von} ums Eck</p>;
  return (
    <p className="mt-1 flex items-start gap-2 font-semibold text-laerche">
      <Car aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
      <span>
        {aktuell ? (
          <>
            ca. {dauerText(aktuell.sek)} mit dem Auto ({Math.round(aktuell.km)} km) von {von}
          </>
        ) : (
          <>
            ca. {Math.round(luft)} km Luftlinie von {von}
          </>
        )}
      </span>
    </p>
  );
}

// Wetter-Codes (WMO) auf Deutsch
function wetterArt(code: number): { text: string; Icon: LucideIcon } {
  if (code === 0) return { text: "Sonnig", Icon: Sun };
  if (code <= 2) return { text: "Teils sonnig", Icon: CloudSun };
  if (code === 3) return { text: "Bewölkt", Icon: Cloud };
  if (code === 45 || code === 48) return { text: "Nebelig", Icon: CloudFog };
  if (code >= 51 && code <= 57) return { text: "Nieselregen", Icon: CloudDrizzle };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { text: "Regen", Icon: CloudRain };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { text: "Schnee", Icon: CloudSnow };
  if (code >= 95) return { text: "Gewitter", Icon: CloudLightning };
  return { text: "Wechselhaft", Icon: Cloud };
}

interface Wetter {
  tag: string;
  code: number;
  max: number;
  min: number;
  regen: number | null;
}

type WetterZustand = { schluessel: string; wetter: Wetter | null; hinweis: string | null };

/** Wetter-Vorhersage für den Veranstaltungstag (geht bis ca. 15 Tage im Voraus). */
export function WetterKasten({
  lat,
  lng,
  beginn,
  ende,
  freiluft,
}: {
  lat: number;
  lng: number;
  beginn: string;
  ende: string | null;
  freiluft: boolean | null;
}) {
  const schluessel = `${lat},${lng},${beginn}`;
  const [z, setZ] = useState<WetterZustand | null>(null);

  useEffect(() => {
    const ab = new AbortController();
    const jetzt = new Date();
    const heute = wienTag(jetzt);
    const start = wienTag(new Date(beginn));
    const schluss = ende ? wienTag(new Date(ende)) : start;
    if (schluss < heute) return; // vorbei
    const tag = start < heute ? heute : start; // läuft gerade → heute
    const tageBis = Math.round((new Date(`${tag}T12:00:00`).getTime() - new Date(`${heute}T12:00:00`).getTime()) / 86_400_000);
    if (tageBis > 15) {
      const ab14 = new Date(new Date(`${tag}T12:00:00`).getTime() - 15 * 86_400_000);
      const text = new Intl.DateTimeFormat("de-AT", { day: "numeric", month: "long" }).format(ab14);
      // Hinweis erst nach dem ersten Zeichnen setzen (Datum hängt vom Handy ab)
      queueMicrotask(() => setZ({ schluessel, wetter: null, hinweis: `Die Wetter-Vorhersage gibt es ab ca. ${text}.` }));
      return;
    }
    const p = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      timezone: "Europe/Vienna",
      start_date: tag,
      end_date: tag,
    });
    fetch(`https://api.open-meteo.com/v1/forecast?${p}`, { signal: ab.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const t = d?.daily;
        if (!t?.time?.length) return;
        setZ({
          schluessel,
          hinweis: null,
          wetter: {
            tag,
            code: t.weather_code[0],
            max: Math.round(t.temperature_2m_max[0]),
            min: Math.round(t.temperature_2m_min[0]),
            regen: t.precipitation_probability_max?.[0] ?? null,
          },
        });
      })
      .catch(() => {});
    return () => ab.abort();
  }, [schluessel, lat, lng, beginn, ende]);

  const aktuell = z?.schluessel === schluessel ? z : null;
  if (!aktuell) return null;
  if (aktuell.hinweis) {
    return <p className="mt-4 flex items-center gap-2 text-[0.95rem] text-gedaempft"><CloudSun aria-hidden className="h-5 w-5" /> {aktuell.hinweis}</p>;
  }
  const w = aktuell.wetter;
  if (!w) return null;
  const { text, Icon } = wetterArt(w.code);
  const nass = (w.regen ?? 0) >= 50;
  const tagText = new Intl.DateTimeFormat("de-AT", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${w.tag}T12:00:00`));

  return (
    <section className="mt-5 rounded-3xl bg-gradient-to-br from-see-zart to-flaeche p-4 ring-1 ring-linie" aria-label="Wetter-Vorhersage">
      <p className="text-[0.9rem] font-semibold text-gedaempft">Wetter am {tagText}</p>
      <div className="mt-2 flex items-center gap-4">
        <Icon aria-hidden className="h-12 w-12 shrink-0 text-see" strokeWidth={1.8} />
        <div className="min-w-0">
          <p className="text-xl font-bold">
            {text} · {w.max}° <span className="font-normal text-gedaempft">/ {w.min}°</span>
          </p>
          {w.regen != null && (
            <p className="text-gedaempft">
              Regen-Wahrscheinlichkeit: <strong className={nass ? "text-abendsonne" : "text-foreground"}>{w.regen} %</strong>
            </p>
          )}
        </div>
      </div>
      {freiluft && nass && (
        <p className="mt-3 flex items-center gap-2 rounded-2xl bg-abendsonne-zart px-3 py-2 font-semibold text-abendsonne">
          <Umbrella aria-hidden className="h-5 w-5 shrink-0" /> Findet im Freien statt – Schirm nicht vergessen!
        </p>
      )}
      {freiluft && !nass && w.max <= 3 && (
        <p className="mt-3 text-[0.95rem] font-semibold text-see">Findet im Freien statt – warm anziehen!</p>
      )}
    </section>
  );
}
