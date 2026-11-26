"use client";

// Landkarte mit allen Veranstaltungen: MapLibre + OpenFreeMap (gratis, ohne Schlüssel).
import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as KartenMap, MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { EventKurz } from "@/lib/event-typ";
import { kategorieInfo } from "./KategorieBild";
import { SUCHGEBIET_RINGE, SUCHGEBIET_RAHMEN } from "@/lib/suchgebiet";

/** Alles außerhalb des Suchgebiets: die ganze Welt mit dem Suchgebiet als Loch. */
const AUSSERHALB: GeoJSON.Feature<GeoJSON.Polygon> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]],
      ...SUCHGEBIET_RINGE.map((r) => [...r].reverse()),
    ],
  },
};
const GRENZE: GeoJSON.Feature<GeoJSON.MultiLineString> = {
  type: "Feature",
  properties: {},
  geometry: { type: "MultiLineString", coordinates: SUCHGEBIET_RINGE },
};

// Hilfsdatei der Karte liegt unter /public (Versionsnummer im Namen → sauberes Zwischenspeichern)
const WORKER_URL = "/maplibre/maplibre-gl-worker-6.17.0.mjs";
// Immer die helle Karte – auf der dunklen gingen die Ortsnamen unter
const STIL = "https://tiles.openfreemap.org/styles/liberty";
// Satellitenbild: Sentinel-2 cloudless von EOX (gratis für private, nicht-kommerzielle Nutzung, ohne Schlüssel)
const SATELLIT_KACHELN = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg";
const SATELLIT_HINWEIS =
  '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless – s2maps.eu</a> von EOX IT Services GmbH (enthält veränderte Copernicus-Sentinel-Daten 2024)';
const SEE = "#0B6E78";
const UNSERE_EBENEN = new Set(["satellit", "ausserhalb", "grenze-schein", "grenze", "umkreis-flaeche", "umkreis-rand", "daheim", "gruppen", "gruppen-zahl", "punkte"]);

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

function alsGeoJson(events: EventKurz[], bevorzugt: string[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: events
      .filter((e) => e.lat != null && e.lng != null)
      .map((e) => ({
        type: "Feature",
        // Bei aktivem Kategorie-Filter: Farbe der gewählten Kategorie
        properties: {
          id: e.id,
          farbe: kategorieInfo(e.kategorien.find((k) => bevorzugt.includes(k)) ?? e.kategorien[0] ?? "sonstiges").farbe,
        },
        geometry: { type: "Point", coordinates: [e.lng as number, e.lat as number] },
      })),
  };
}

export function KartenAnsicht({
  events,
  mitte,
  umkreisKm,
  onAuswahl,
  satellit = false,
  bevorzugt = [],
  onKartenTipp,
}: {
  events: EventKurz[];
  mitte: { lat: number; lng: number; name: string };
  umkreisKm: number | null;
  onAuswahl: (ids: string[]) => void;
  satellit?: boolean;
  bevorzugt?: string[];
  /** Gesetzt = „Punkt wählen“-Modus: der nächste Tipp auf die Karte liefert die Stelle */
  onKartenTipp?: ((lat: number, lng: number) => void) | null;
}) {
  const behaelter = useRef<HTMLDivElement>(null);
  const karte = useRef<KartenMap | null>(null);
  const [geladen, setGeladen] = useState(false);
  const [fehler, setFehler] = useState(false);
  const auswahlRef = useRef(onAuswahl);
  const tippRef = useRef(onKartenTipp);
  useEffect(() => {
    auswahlRef.current = onAuswahl;
    tippRef.current = onKartenTipp;
  }, [onAuswahl, onKartenTipp]);
  // Im „Punkt wählen“-Modus ein Fadenkreuz zeigen
  useEffect(() => {
    const m = karte.current;
    if (m) m.getCanvas().style.cursor = onKartenTipp ? "crosshair" : "";
  }, [onKartenTipp, geladen]);

  // Quellenangabe nur als kleines (i) – aufgeklappt würde sie den Satelliten-Knopf verdecken
  const zuklappen = () =>
    behaelter.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");

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
          style: STIL,
          center: [13.5, 46.75],
          zoom: 8,
          // Nur das Suchgebiet: nicht weit darüber hinaus schieben oder herauszoomen
          maxBounds: [
            [SUCHGEBIET_RAHMEN[0][0] - 2.5, SUCHGEBIET_RAHMEN[0][1] - 1.2],
            [SUCHGEBIET_RAHMEN[1][0] + 2.5, SUCHGEBIET_RAHMEN[1][1] + 1.2],
          ],
          minZoom: 4.8,
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
          // Satellitenbild direkt über dem Hintergrund, Straßen und Ortsnamen bleiben darüber
          const ebenen = m.getStyle().layers;
          const ersteNachHintergrund = ebenen.find((e) => e.type !== "background")?.id;
          m.addSource("satellit", {
            type: "raster",
            tiles: [SATELLIT_KACHELN],
            tileSize: 256,
            maxzoom: 15,
            attribution: SATELLIT_HINWEIS,
          });
          m.addLayer({ id: "satellit", type: "raster", source: "satellit", layout: { visibility: "none" } }, ersteNachHintergrund);

          // Suchgebiet: außerhalb abgedunkelt, rote Grenzlinie
          m.addSource("ausserhalb", { type: "geojson", data: AUSSERHALB });
          m.addLayer({ id: "ausserhalb", type: "fill", source: "ausserhalb", paint: { "fill-color": "#0b1d22", "fill-opacity": 0.45 } });
          m.addSource("grenze", { type: "geojson", data: GRENZE });
          m.addLayer({
            id: "grenze-schein",
            type: "line",
            source: "grenze",
            paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.55 },
            layout: { "line-join": "round" },
          });
          m.addLayer({
            id: "grenze",
            type: "line",
            source: "grenze",
            paint: { "line-color": "#d62828", "line-width": 3 },
            layout: { "line-join": "round" },
          });

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
              "circle-opacity": 0.62,
              "circle-radius": ["step", ["get", "point_count"], 17, 10, 21, 40, 26],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2.5,
              "circle-stroke-opacity": 0.9,
            },
          });
          m.addLayer({
            id: "gruppen-zahl",
            type: "symbol",
            source: "events",
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-font": ["Noto Sans Bold"],
              "text-size": 16,
              // Zahl immer zeigen, ohne Ortsnamen wegzudrängen
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            },
            paint: { "text-color": "#ffffff", "text-halo-color": "rgba(4,50,56,0.85)", "text-halo-width": 1.5 },
          });
          m.addLayer({
            id: "punkte",
            type: "circle",
            source: "events",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": ["get", "farbe"],
              "circle-opacity": 0.7,
              "circle-radius": 11,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2.5,
              "circle-stroke-opacity": 0.95,
            },
          });

          // Tipp auf eine Gruppe: hineinzoomen – oder, wenn alle am selben Ort sind, die Liste zeigen
          // „Punkt wählen“: irgendwo auf die Karte tippen
          m.on("click", (ev) => {
            if (tippRef.current) tippRef.current(ev.lngLat.lat, ev.lngLat.lng);
          });
          m.on("click", "gruppen", async (ev: MapLayerMouseEvent) => {
            const f = ev.features?.[0];
            if (!f || !m || tippRef.current) return;
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
            if (f && !tippRef.current) auswahlRef.current([String(f.properties.id)]);
          });
          for (const ebene of ["gruppen", "punkte"]) {
            m.on("mouseenter", ebene, () => m && !tippRef.current && (m.getCanvas().style.cursor = "pointer"));
            m.on("mouseleave", ebene, () => m && !tippRef.current && (m.getCanvas().style.cursor = ""));
          }
          zuklappen();
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
      setGeladen(false);
    };
  }, []);

  // Punkte aktualisieren
  useEffect(() => {
    const m = karte.current;
    if (!geladen || !m || !m.getSource("events")) return;
    (m.getSource("events") as GeoJSONSource).setData(alsGeoJson(events, bevorzugt));
  }, [geladen, events, bevorzugt]);

  // Satellit ein/aus: Bild zeigen, Flächen der normalen Karte (Wald, Wiesen, Häuser …) ausblenden
  useEffect(() => {
    const m = karte.current;
    if (!geladen || !m || !m.getSource("events")) return;
    m.setLayoutProperty("satellit", "visibility", satellit ? "visible" : "none");
    for (const ebene of m.getStyle().layers) {
      if (UNSERE_EBENEN.has(ebene.id)) continue;
      if (ebene.type === "fill" || ebene.type === "fill-extrusion" || ebene.type === "hillshade") {
        m.setLayoutProperty(ebene.id, "visibility", satellit ? "none" : "visible");
      }
      // Ortsnamen auf dem Foto: kräftiger weißer Rand, damit sie gut lesbar sind
      if (ebene.type === "symbol" && ebene.id.startsWith("label")) {
        m.setPaintProperty(ebene.id, "text-halo-width", satellit ? 2.2 : 1);
      }
    }
    setTimeout(zuklappen, 50);
  }, [geladen, satellit]);

  // Startpunkt + Umkreis zeichnen und passend hinzoomen
  useEffect(() => {
    const m = karte.current;
    if (!geladen || !m || !m.getSource("events")) return;
    (m.getSource("umkreis") as GeoJSONSource).setData(
      umkreisKm ? kreis(mitte.lat, mitte.lng, umkreisKm) : { type: "FeatureCollection", features: [] }
    );
    (m.getSource("daheim") as GeoJSONSource).setData({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [mitte.lng, mitte.lat] },
    });
    const abstand = { padding: { top: 170, bottom: 40, left: 20, right: 20 }, duration: 800 };
    if (umkreisKm == null) {
      // „Überall“: ganz Österreich mit den Grenzgebieten
      m.fitBounds(SUCHGEBIET_RAHMEN, abstand);
      return;
    }
    const dLat = umkreisKm / 111.32;
    const dLng = umkreisKm / (111.32 * Math.cos((mitte.lat * Math.PI) / 180));
    m.fitBounds(
      [
        [mitte.lng - dLng, mitte.lat - dLat],
        [mitte.lng + dLng, mitte.lat + dLat],
      ],
      abstand
    );
  }, [geladen, mitte.lat, mitte.lng, umkreisKm]);

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
