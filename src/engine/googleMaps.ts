/** Minimal async loader for the Google Maps JavaScript API. */
let loading: Promise<void> | null = null;
let authFailed = false;

declare global {
  interface Window {
    __gullyGuessrGmapsInit?: () => void;
    gm_authFailure?: () => void;
  }
}

export function googleAuthFailed(): boolean {
  return authFailed;
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
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=__gullyGuessrGmapsInit`;
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

export async function streetViewLibrary(): Promise<google.maps.StreetViewLibrary> {
  return (await google.maps.importLibrary('streetView')) as google.maps.StreetViewLibrary;
}

export async function geocodingLibrary(): Promise<google.maps.GeocodingLibrary> {
  return (await google.maps.importLibrary('geocoding')) as google.maps.GeocodingLibrary;
}
