/** Minimal async loader for the Google Maps JavaScript API. */
let loading: Promise<void> | null = null;
let authFailed = false;

declare global {
  interface Window {
    __gullyGuessrGmapsInit?: () => void;
    gm_authFailure?: () => void;
  }
}

const authListeners = new Set<() => void>();

export function googleAuthFailed(): boolean {
  return authFailed;
}

/** Google reports a bad/restricted key after load too; maps subscribe so they can fall back. */
export function onGoogleAuthFailure(cb: () => void): () => void {
  authListeners.add(cb);
  return () => authListeners.delete(cb);
}

export function loadGoogleMaps(apiKey: string, timeoutMs = 10000): Promise<void> {
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('No window'));
    if (typeof window.google?.maps?.importLibrary === 'function') return resolve();
    const timer = setTimeout(() => reject(new Error('Google Maps load timed out')), timeoutMs);
    window.__gullyGuessrGmapsInit = () => {
      clearTimeout(timer);
      resolve();
    };
    window.gm_authFailure = () => {
      authFailed = true;
      clearTimeout(timer);
      reject(new Error('Google Maps authentication failed'));
      authListeners.forEach((cb) => cb());
    };
    const script = document.createElement('script');
    // region=IN renders borders as shown inside India.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&region=IN&language=en&callback=__gullyGuessrGmapsInit`;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Google Maps script failed to load'));
    };
    document.head.appendChild(script);
  }).catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

export async function mapsLibrary(): Promise<google.maps.MapsLibrary> {
  return (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary;
}

export async function streetViewLibrary(): Promise<google.maps.StreetViewLibrary> {
  return (await google.maps.importLibrary('streetView')) as google.maps.StreetViewLibrary;
}

export async function geocodingLibrary(): Promise<google.maps.GeocodingLibrary> {
  return (await google.maps.importLibrary('geocoding')) as google.maps.GeocodingLibrary;
}
