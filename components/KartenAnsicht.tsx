"use client";

// Landkarte mit allen Veranstaltungen: MapLibre + OpenFreeMap (gratis, ohne Schlüssel).
import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as KartenMap, MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { EventKurz } from "@/lib/event-typ";
import { kategorieInfo } from "./KategorieBild";

// Hilfsdatei der Karte liegt unter /public (Versionsnummer im Namen → sauberes Zwischenspeichern)
const WORKER_URL = "/maplibre/maplibre-gl-worker-6.17.0.mjs";
const STIL_HELL = "https://tiles.openfreemap.org/styles/liberty";
const STIL_DUNKEL = "https://tiles.openfreemap.org/styles/dark";
const SEE = "#0B6E78";

function istDunkel() {
  const t = document.documentElement.dataset.theme;
  if (t) return t === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Kreis (als Vieleck) um einen Punkt – für den Umkreis. */
function kreis(lat: number, lng: number, km: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const punkte: [number, number][] = [];
  for (let i = 0; i <= 72; i++) {
    const w = (i / 72) * 2 * Math.PI;
    const dLat = (km / 111.32) * Math.sin(w);
    const dLng = (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(w);
    punkte.push([lng + dLng, lat + dLat]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [punkte] } };
}

function alsGeoJson(events: EventKurz[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: events
      .filter((e) => e.lat != null && e.lng != null)
      .map((e) => ({
        type: "Feature",
        properties: { id: e.id, farbe: kategorieInfo(e.kategorien[0] ?? "sonstiges").farbe },
        geometry: { type: "Point", coordinates: [e.lng as number, e.lat as number] },
      })),
  };
}

export function KartenAnsicht({
  events,
  mitte,
  umkreisKm,
  onAuswahl,
}: {
  events: EventKurz[];
  mitte: { lat: number; lng: number; name: string };
  umkreisKm: number | null;
  onAuswahl: (ids: string[]) => void;
}) {
  const behaelter = useRef<HTMLDivElement>(null);
  const karte = useRef<KartenMap | null>(null);
  const [geladen, setGeladen] = useState(false);
  const [fehler, setFehler] = useState(false);
  const auswahlRef = useRef(onAuswahl);
  useEffect(() => {
    auswahlRef.current = onAuswahl;
  }, [onAuswahl]);

  // Karte einmal aufbauen (MapLibre wird erst hier geladen – die anderen Seiten bleiben schlank)
  useEffect(() => {
    let abgebrochen = false;
    let m: KartenMap | null = null;
    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (abgebrochen || !behaelter.current) return;
        maplibre.setWorkerUrl(WORKER_URL);
        m = new maplibre.Map({
          container: behaelter.current,
          style: istDunkel() ? STIL_DUNKEL : STIL_HELL,
          center: [13.5, 46.75],
          zoom: 8,
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
        });
        m.touchZoomRotate.disableRotation();
        m.addControl(new maplibre.NavigationControl({ showCompass: false }), "bottom-right");
        karte.current = m;

        m.on("load", () => {
          if (!m) return;
          // Orts- und Landschaftsnamen auf Deutsch (falls vorhanden), sonst Originalname
          for (const ebene of m.getStyle().layers) {
            if (ebene.type !== "symbol") continue;
            const feld = m.getLayoutProperty(ebene.id, "text-field");
            if (feld && JSON.stringify(feld).includes("name")) {
              m.setLayoutProperty(ebene.id, "text-field", ["coalesce", ["get", "name:de"], ["get", "name_de"], ["get", "name"]]);
            }
          }
          m.addSource("umkreis", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          m.addLayer({ id: "umkreis-flaeche", type: "fill", source: "umkreis", paint: { "fill-color": SEE, "fill-opacity": 0.07 } });
          m.addLayer({
            id: "umkreis-rand",
            type: "line",
            source: "umkreis",
            paint: { "line-color": SEE, "line-width": 2.5, "line-dasharray": [2, 2] },
          });

          // Daheim/Startpunkt: oranger Punkt UNTER den Veranstaltungen (verdeckt nichts)
          m.addSource("daheim", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          m.addLayer({
            id: "daheim",
            type: "circle",
            source: "daheim",
            paint: { "circle-color": "#e46f2e", "circle-radius": 13, "circle-stroke-color": "#ffffff", "circle-stroke-width": 4 },
          });

          m.addSource("events", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
            cluster: true,
            clusterRadius: 42,
            clusterMaxZoom: 13,
          });
          m.addLayer({
            id: "gruppen",
            type: "circle",
            source: "events",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": SEE,
              "circle-radius": ["step", ["get", "point_count"], 18, 10, 23, 40, 29],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 3,
            },
          });
          m.addLayer({
            id: "gruppen-zahl",
            type: "symbol",
            source: "events",
            filter: ["has", "point_count"],
            layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": 16 },
            paint: { "text-color": "#ffffff" },
          });
          m.addLayer({
            id: "punkte",
            type: "circle",
            source: "events",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": ["get", "farbe"],
              "circle-radius": 12,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 3,
            },
          });

          // Tipp auf eine Gruppe: hineinzoomen – oder, wenn alle am selben Ort sind, die Liste zeigen
          m.on("click", "gruppen", async (ev: MapLayerMouseEvent) => {
            const f = ev.features?.[0];
            if (!f || !m) return;
            const quelle = m.getSource("events") as GeoJSONSource;
            const gruppenId = f.properties.cluster_id as number;
            const zoom = await quelle.getClusterExpansionZoom(gruppenId);
            const ziel = (f.geometry as GeoJSON.Point).coordinates as [number, number];
            if (zoom <= 14 && zoom > m.getZoom() + 0.3) {
              m.easeTo({ center: ziel, zoom });
            } else {
              const blaetter = await quelle.getClusterLeaves(gruppenId, 100, 0);
              auswahlRef.current(blaetter.map((b) => String(b.properties?.id)));
            }
          });
          m.on("click", "punkte", (ev: MapLayerMouseEvent) => {
            const f = ev.features?.[0];
            if (f) auswahlRef.current([String(f.properties.id)]);
          });
          for (const ebene of ["gruppen", "punkte"]) {
            m.on("mouseenter", ebene, () => m && (m.getCanvas().style.cursor = "pointer"));
            m.on("mouseleave", ebene, () => m && (m.getCanvas().style.cursor = ""));
          }
          setGeladen(true);
        });
        m.on("error", (ev) => console.warn("Karte:", ev.error?.message));
      } catch (e) {
        console.error(e);
        setFehler(true);
      }
    })();
    return () => {
      abgebrochen = true;
      m?.remove();
      karte.current = null;
    };
  }, []);

  // Punkte aktualisieren
  useEffect(() => {
    const m = karte.current;
    if (!geladen || !m) return;
    (m.getSource("events") as GeoJSONSource).setData(alsGeoJson(events));
  }, [geladen, events]);

  // Startpunkt + Umkreis zeichnen und passend hinzoomen
  useEffect(() => {
    const m = karte.current;
    if (!geladen || !m) return;
    (m.getSource("umkreis") as GeoJSONSource).setData(
      umkreisKm ? kreis(mitte.lat, mitte.lng, umkreisKm) : { type: "FeatureCollection", features: [] }
    );
    (m.getSource("daheim") as GeoJSONSource).setData({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [mitte.lng, mitte.lat] },
    });
    const km = umkreisKm ?? 150;
    const dLat = km / 111.32;
    const dLng = km / (111.32 * Math.cos((mitte.lat * Math.PI) / 180));
    m.fitBounds(
      [
        [mitte.lng - dLng, mitte.lat - dLat],
        [mitte.lng + dLng, mitte.lat + dLat],
      ],
      { padding: { top: 150, bottom: 40, left: 20, right: 20 }, duration: 800 }
    );
  }, [geladen, mitte.lat, mitte.lng, mitte.name, umkreisKm]);

  return (
    <div className="absolute inset-0">
      <div ref={behaelter} className="h-full w-full" />
      {fehler && (
        <p className="absolute inset-x-5 top-1/3 rounded-3xl bg-flaeche p-5 text-center shadow-karte">
          Die Karte konnte nicht geladen werden. Bitte später nochmal probieren.
        </p>
      )}
    </div>
  );
}
