/** Loads the Google Maps JavaScript API once. The key comes from VITE_GOOGLE_MAPS_API_KEY. */
const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

let loading: Promise<typeof google.maps> | null = null;

export const hasMapsKey = () => !!KEY;

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window !== 'undefined' && window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (!KEY) return Promise.reject(new Error('NO_KEY'));
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&v=weekly&loading=async&callback=__tpfcsMapsReady`;
      s.async = true;
      (window as unknown as Record<string, unknown>).__tpfcsMapsReady = () => resolve(window.google.maps);
      s.onerror = () => { loading = null; reject(new Error('LOAD_FAILED')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}
