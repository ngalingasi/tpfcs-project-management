// Minimal typings for the part of the Google Maps JavaScript API the map screens use.
// Kept in the project so the build does not depend on installing @types/google.maps.
declare namespace google.maps {
  interface LatLngLiteral { lat: number; lng: number }
  interface MapsEventListener { remove(): void }
  class Size { constructor(width: number, height: number) }
  class Point { constructor(x: number, y: number) }
  interface Icon { url: string; scaledSize?: Size; anchor?: Point }
  class LatLngBounds {
    extend(p: LatLngLiteral): this;
    toJSON(): { north: number; south: number; east: number; west: number };
  }
  class Map {
    constructor(el: HTMLElement, opts?: Record<string, unknown>);
    getZoom(): number | undefined;
    setZoom(zoom: number): void;
    setCenter(p: LatLngLiteral): void;
    panTo(p: LatLngLiteral): void;
    fitBounds(b: LatLngBounds, padding?: number): void;
    getBounds(): LatLngBounds | null | undefined;
    addListener(event: string, handler: () => void): MapsEventListener;
  }
  class Marker {
    constructor(opts: { map?: Map | null; position: LatLngLiteral; icon?: Icon; zIndex?: number; title?: string });
    setMap(map: Map | null): void;
    addListener(event: string, handler: () => void): MapsEventListener;
  }
}
interface Window { google: typeof google }
