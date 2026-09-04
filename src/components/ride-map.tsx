"use client";

import { useEffect, useRef, useState } from "react";

type LatLng = { lat: number; lng: number };

type RideMapProps = {
  from: string;
  to: string;
  fromCoords?: LatLng | null;
  toCoords?: LatLng | null;
  stops?: string[];
  height?: string;
  className?: string;
  liveDriver?: LatLng | null;
};

// Resolve a place name to coordinates from our static list
function resolveCoords(name: string): LatLng | null {
  const PLACES: Record<string, LatLng> = {
    "kothrud": { lat: 18.5074, lng: 73.8077 },
    "warje": { lat: 18.4831, lng: 73.807 },
    "karve nagar": { lat: 18.483, lng: 73.823 },
    "erandwane": { lat: 18.51, lng: 73.833 },
    "bhandarkar road": { lat: 18.522, lng: 73.842 },
    "deccan gymkhana": { lat: 18.518, lng: 73.839 },
    "shivajinagar": { lat: 18.5308, lng: 73.8475 },
    "model colony": { lat: 18.525, lng: 73.837 },
    "aundh": { lat: 18.5642, lng: 73.8077 },
    "baner": { lat: 18.559, lng: 73.7868 },
    "pashan": { lat: 18.5755, lng: 73.8075 },
    "wakad": { lat: 18.5993, lng: 73.7626 },
    "hinjewadi": { lat: 18.5913, lng: 73.7389 },
    "balewadi": { lat: 18.5745, lng: 73.7635 },
    "pimpri": { lat: 18.6298, lng: 73.7997 },
    "chinchwad": { lat: 18.645, lng: 73.8 },
    "nigdi": { lat: 18.652, lng: 73.774 },
    "katraj": { lat: 18.457, lng: 73.86 },
    "bibwewadi": { lat: 18.464, lng: 73.866 },
    "sinhagad road": { lat: 18.479, lng: 73.83 },
    "sahakar nagar": { lat: 18.488, lng: 73.852 },
    "swargate": { lat: 18.501, lng: 73.86 },
    "kalyani nagar": { lat: 18.546, lng: 73.89 },
    "viman nagar": { lat: 18.567, lng: 73.914 },
    "kharadi": { lat: 18.551, lng: 73.9416 },
    "hadapsar": { lat: 18.56, lng: 73.93 },
    "magarpatta city": { lat: 18.5602, lng: 73.928 },
    "mundhwa": { lat: 18.552, lng: 73.897 },
    "nanded city": { lat: 18.464, lng: 73.806 },
    "mit college, kothrud": { lat: 18.516, lng: 73.842 },
    "mit wpu, kothrud": { lat: 18.5124, lng: 73.8077 },
    "coep tech university": { lat: 18.5296, lng: 73.8564 },
    "pict, katraj": { lat: 18.455, lng: 73.86 },
    "cummins college, karve nagar": { lat: 18.485, lng: 73.826 },
    "vit pune, bibwewadi": { lat: 18.463, lng: 73.866 },
    "bharati vidyapeeth, katraj": { lat: 18.4551, lng: 73.861 },
    "modern college, shivajinagar": { lat: 18.526, lng: 73.845 },
    "symbiosis, viman nagar": { lat: 18.566, lng: 73.916 },
    "indira college, wakad": { lat: 18.598, lng: 73.763 },
    "dy patil, pimpri": { lat: 18.625, lng: 73.806 },
  };

  const clean = name.trim().toLowerCase();
  if (PLACES[clean]) return PLACES[clean];
  // Partial match
  for (const [key, val] of Object.entries(PLACES)) {
    if (clean.includes(key) || key.includes(clean)) return val;
  }
  return null;
}

export function RideMap({
  from,
  to,
  fromCoords,
  toCoords,
  stops = [],
  height = "280px",
  className = "",
  liveDriver = null,
}: RideMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [L, setL] = useState<typeof import("leaflet") | null>(null);

  const startCoords = fromCoords ?? resolveCoords(from);
  const endCoords = toCoords ?? resolveCoords(to);

  // Dynamically load Leaflet (client-side only)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load CSS
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.crossOrigin = "";
      document.head.appendChild(link);
    }

    import("leaflet").then((leaflet) => {
      setL(leaflet);
      setLoaded(true);
    });
  }, []);

  // Render map
  useEffect(() => {
    if (!loaded || !L || !mapRef.current || !startCoords || !endCoords) return;

    // Clean up previous map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Custom icons
    const greenIcon = L.divIcon({
      className: "",
      html: '<div style="width:28px;height:28px;border-radius:50%;background:#10b981;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px">🏠</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const blueIcon = L.divIcon({
      className: "",
      html: '<div style="width:28px;height:28px;border-radius:50%;background:#2451e6;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px">🏫</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    // Start marker
    L.marker([startCoords.lat, startCoords.lng], { icon: greenIcon })
      .addTo(map)
      .bindPopup(`<b>Pickup:</b> ${from}`);

    // End marker
    L.marker([endCoords.lat, endCoords.lng], { icon: blueIcon })
      .addTo(map)
      .bindPopup(`<b>Drop:</b> ${to}`);

    // Route line
    const routePoints: L.LatLngExpression[] = [
      [startCoords.lat, startCoords.lng],
    ];

    // Add stops
    for (const stop of stops) {
      const c = resolveCoords(stop);
      if (c) {
        routePoints.push([c.lat, c.lng]);
        L.circleMarker([c.lat, c.lng], {
          radius: 6,
          color: "#f59e0b",
          fillColor: "#fbbf24",
          fillOpacity: 1,
          weight: 2,
        })
          .addTo(map)
          .bindPopup(`<b>Via:</b> ${stop}`);
      }
    }

    routePoints.push([endCoords.lat, endCoords.lng]);

    L.polyline(routePoints, {
      color: "#2451e6",
      weight: 4,
      opacity: 0.7,
      dashArray: "8 6",
    }).addTo(map);

    // Fit bounds with padding
    const bounds = L.latLngBounds(routePoints as [number, number][]);
    map.fitBounds(bounds, { padding: [40, 40] });

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      driverMarkerRef.current = null;
    };
  }, [loaded, L, startCoords, endCoords, from, to, stops]);

  // Live driver marker — updates in place without re-rendering the whole map.
  useEffect(() => {
    if (!L || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (!liveDriver) {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
      return;
    }

    const carIcon = L.divIcon({
      className: "",
      html: '<div style="width:32px;height:32px;border-radius:50%;background:#f59e0b;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:16px">🚗</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng([liveDriver.lat, liveDriver.lng]);
    } else {
      driverMarkerRef.current = L.marker([liveDriver.lat, liveDriver.lng], { icon: carIcon })
        .addTo(map)
        .bindPopup("Driver's current location");
    }
  }, [L, liveDriver]);

  if (!startCoords || !endCoords) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-500 ${className}`}
        style={{ height }}
      >
        📍 Map unavailable for this route
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className={`rounded-2xl overflow-hidden border border-slate-200 shadow-card ${className}`}
      style={{ height, width: "100%" }}
    />
  );
}

/** Small inline map for ride cards */
export function RideMapMini({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  return <RideMap from={from} to={to} height="160px" className="mt-3" />;
}
