import { PROVIDER_LABELS, type ProviderId } from '../engine/imageryProviders';

const NOTES: Record<ProviderId, string> = {
  open: 'Playing on still street photographs from Wikimedia Commons — no street navigation. Add VITE_GOOGLE_MAPS_API_KEY or VITE_MAPILLARY_ACCESS_TOKEN to .env for navigable street view.',
  mapillary: 'Playing on navigable Mapillary street-level imagery. Add VITE_GOOGLE_MAPS_API_KEY to .env for Google Street View coverage.',
  google: 'Playing on live Google Street View with full street navigation.',
};

export function ProviderChip({ provider }: { provider: ProviderId }) {
  return (
    <span className="provider-chip" title={NOTES[provider]}>
      <span className="provider-chip__dot" aria-hidden="true" />
      {PROVIDER_LABELS[provider]}
    </span>
  );
}

export function ProviderNote({ provider }: { provider: ProviderId }) {
  if (provider === 'google') return null;
  return (
    <p className="provider-note">
      {provider === 'open' ? (
        <>
          Open Mode shows still photographs, so you can’t walk the streets. Add <code>VITE_GOOGLE_MAPS_API_KEY</code> or{' '}
          <code>VITE_MAPILLARY_ACCESS_TOKEN</code> to <code>.env</code> to explore navigable street view across India.
        </>
      ) : (
        <>
          Navigable Mapillary street view is active. Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to <code>.env</code> for Google Street View coverage.
        </>
      )}
    </p>
  );
}
