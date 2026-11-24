import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../../../utils/googleMaps';
import type { GeoLayer, GeoPin } from '../../../api/geo';

/** Zoom at which pins stop being grouped by area (pins on the exact same spot are still stacked). */
const SPLIT_ZOOM = 17;
const CELL_PX = 64;

const svgUrl = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
const pinIcons = new Map<string, string>();
const pinIcon = (color: string, big: boolean) => {
  const k = `${color}${big}`;
  if (!pinIcons.has(k)) {
    const [w, h] = big ? [34, 48] : [24, 34];
    pinIcons.set(k, svgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 34">` +
      `<path d="M12 0C5.4 0 0 5.2 0 11.6 0 20.3 12 34 12 34s12-13.7 12-22.4C24 5.2 18.6 0 12 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>` +
      `<circle cx="12" cy="11.5" r="4.5" fill="#fff"/></svg>`));
  }
  return pinIcons.get(k)!;
};
const clusterIcons = new Map<string, string>();
const clusterIcon = (n: number, stack: boolean) => {
  const size = n < 10 ? 34 : n < 100 ? 40 : n < 1000 ? 48 : 56;
  const k = `${size}|${n}|${stack}`;
  if (!clusterIcons.has(k)) {
    const fill = stack ? '#7c3aed' : '#2563eb';
    clusterIcons.set(k, svgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="${fill}" fill-opacity=".85" stroke="#fff" stroke-width="2"/>` +
      `<text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="${size < 40 ? 12 : 13}" fill="#fff">${n}</text></svg>`));
  }
  return { url: clusterIcons.get(k)!, size };
};

const mercator = (lat: number, lng: number, zoom: number): [number, number] => {
  const scale = 256 * 2 ** zoom;
  const sin = Math.min(0.9999, Math.max(-0.9999, Math.sin((lat * Math.PI) / 180)));
  return [((lng + 180) / 360) * scale, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale];
};

interface Props {
  pins: GeoPin[];
  layers: GeoLayer[];
  selectedId: number | null;
  /** One id for a normal pin, several when pins share the exact same spot. */
  onSelect: (ids: number[]) => void;
  /** Re-fit the view whenever this changes (e.g. filters changed). */
  fitKey: string;
  /** Move to a point and zoom in. `nonce` makes the same point work twice. */
  focus: { lat: number; lng: number; nonce: number } | null;
}

type Item = { key: string; lat: number; lng: number; ids: number[]; layerId: number; stack: boolean };

export default function GeoMap({ pins, layers, selectedId, onSelect, fitKey, focus }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markers = useRef(new Map<string, google.maps.Marker>());
  const [status, setStatus] = useState<'loading' | 'ready' | 'nokey' | 'error'>('loading');

  // always read the freshest props from inside map callbacks
  const live = useRef({ pins, layers, selectedId, onSelect });
  live.current = { pins, layers, selectedId, onSelect };

  const draw = useRef<() => void>(() => undefined);
  draw.current = () => {
    const map = mapRef.current;
    if (!map) return;
    const gm = window.google.maps;
    const zoom = Math.round(map.getZoom() ?? 6);
    const b = map.getBounds()?.toJSON();
    const { pins: ps, layers: ls, selectedId: sel } = live.current;
    const colour = new Map(ls.map((l) => [l.layer_id, l.color]));
    const padLat = b ? (b.north - b.south) * 0.25 : 0;
    const padLng = b ? (b.east - b.west) * 0.25 : 0;

    const cells = new Map<string, Item>();
    ps.forEach(([id, layerId, lat, lng]) => {
      if (b && (lat > b.north + padLat || lat < b.south - padLat || lng > b.east + padLng || lng < b.west - padLng)) return;
      let key: string;
      if (zoom >= SPLIT_ZOOM) key = `s${lat.toFixed(6)},${lng.toFixed(6)}`;
      else { const [x, y] = mercator(lat, lng, zoom); key = `c${Math.floor(x / CELL_PX)}:${Math.floor(y / CELL_PX)}`; }
      const it = cells.get(key);
      if (it) { it.lat = (it.lat * it.ids.length + lat) / (it.ids.length + 1); it.lng = (it.lng * it.ids.length + lng) / (it.ids.length + 1); it.ids.push(id); }
      else cells.set(key, { key, lat, lng, ids: [id], layerId, stack: zoom >= SPLIT_ZOOM });
    });

    const want = new Map<string, Item & { sig: string }>();
    cells.forEach((it) => {
      const single = it.ids.length === 1;
      const isSel = single && it.ids[0] === sel;
      const sig = single ? `p${it.ids[0]}${isSel ? '*' : ''}` : `${it.key}#${it.ids.length}${it.ids.includes(sel ?? -1) ? '*' : ''}`;
      want.set(sig, { ...it, sig });
    });

    markers.current.forEach((m, sig) => { if (!want.has(sig)) { m.setMap(null); markers.current.delete(sig); } });
    want.forEach((it, sig) => {
      if (markers.current.has(sig)) return;
      const single = it.ids.length === 1;
      let icon: google.maps.Icon;
      let zIndex = 1;
      if (single) {
        const big = it.ids[0] === sel;
        const [w, h] = big ? [34, 48] : [24, 34];
        icon = { url: pinIcon(colour.get(it.layerId) ?? '#2563eb', big), scaledSize: new gm.Size(w, h), anchor: new gm.Point(w / 2, h) };
        zIndex = big ? 1000 : 1;
      } else {
        const c = clusterIcon(it.ids.length, it.stack);
        icon = { url: c.url, scaledSize: new gm.Size(c.size, c.size), anchor: new gm.Point(c.size / 2, c.size / 2) };
      }
      const m = new gm.Marker({ map, position: { lat: it.lat, lng: it.lng }, icon, zIndex, title: single ? undefined : `${it.ids.length} points` });
      m.addListener('click', () => {
        if (single || it.stack) { live.current.onSelect(it.ids); return; }
        // zoom into the group
        const members = live.current.pins.filter((p) => it.ids.includes(p[0]));
        const bounds = new gm.LatLngBounds();
        members.forEach((p) => bounds.extend({ lat: p[2], lng: p[3] }));
        map.fitBounds(bounds, 60);
      });
      markers.current.set(sig, m);
    });
  };

  // create the map once
  useEffect(() => {
    let dead = false;
    const listeners: google.maps.MapsEventListener[] = [];
    loadGoogleMaps()
      .then((gm) => {
        if (dead || !elRef.current) return;
        const map = new gm.Map(elRef.current, {
          center: { lat: -6.37, lng: 34.89 }, zoom: 6, maxZoom: 20, minZoom: 3,
          mapTypeControl: true, streetViewControl: true, fullscreenControl: false, gestureHandling: 'greedy',
        });
        mapRef.current = map;
        listeners.push(map.addListener('idle', () => draw.current()));
        setStatus('ready');
      })
      .catch((e: Error) => { if (!dead) setStatus(e.message === 'NO_KEY' ? 'nokey' : 'error'); });
    const current = markers.current;
    return () => {
      dead = true;
      listeners.forEach((l) => l.remove());
      current.forEach((m) => m.setMap(null));
      current.clear();
      mapRef.current = null;
    };
  }, []);

  // pins / selection changed -> redraw from scratch
  useEffect(() => {
    markers.current.forEach((m) => m.setMap(null));
    markers.current.clear();
    draw.current();
  }, [pins, layers, selectedId, status]);

  // fit to the pins when the filter changes
  useEffect(() => {
    const map = mapRef.current;
    const ps = live.current.pins;
    if (!map || status !== 'ready' || !ps.length) return;
    const gm = window.google.maps;
    if (ps.length === 1) { map.setCenter({ lat: ps[0][2], lng: ps[0][3] }); map.setZoom(16); return; }
    const bounds = new gm.LatLngBounds();
    ps.forEach((p) => bounds.extend({ lat: p[2], lng: p[3] }));
    map.fitBounds(bounds, 40);
  }, [fitKey, status, pins.length === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.panTo({ lat: focus.lat, lng: focus.lng });
    if ((map.getZoom() ?? 0) < 17) map.setZoom(17);
  }, [focus]);

  if (status === 'nokey') {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 dark:bg-gray-800 p-6 text-center">
        <div className="max-w-sm">
          <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">Google Maps key not set</p>
          <p className="text-sm text-gray-500">Set <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> in the frontend environment file and rebuild.</p>
        </div>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 dark:bg-gray-800 p-6 text-center text-sm text-gray-500">
        Google Maps could not be loaded. Check the API key, that billing and the Maps JavaScript API are enabled, and the internet connection.
      </div>
    );
  }
  return (
    <div className="relative h-full w-full">
      <div ref={elRef} className="h-full w-full" data-testid="geo-map" />
      {status === 'loading' && <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800 text-sm text-gray-400">Loading map…</div>}
    </div>
  );
}
