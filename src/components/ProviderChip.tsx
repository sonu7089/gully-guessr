import { PROVIDER_LABELS, type ProviderId } from '../engine/imageryProviders';

const NOTES: Record<ProviderId, string> = {
  open: 'Playing on street photography from Wikimedia Commons. Add VITE_GOOGLE_MAPS_API_KEY or VITE_MAPILLARY_ACCESS_TOKEN to .env for full 360° street navigation everywhere in India.',
  mapillary: 'Playing on Mapillary 360° panoramas. Add VITE_GOOGLE_MAPS_API_KEY to .env for Google Street View coverage.',
  google: 'Playing on live Google Street View with full 360° navigation.',
};

export function ProviderChip({ provider }: { provider: ProviderId }) {
  return (
    <span className="provider-chip" title={NOTES[provider]}>
      <span className="provider-chip__dot" aria-hidden="true" />
      Imagery · {PROVIDER_LABELS[provider]}
    </span>
  );
}

export function ProviderNote({ provider }: { provider: ProviderId }) {
  if (provider === 'google') return <p className="provider-note">{NOTES.google}</p>;
  return (
    <p className="provider-note">
      {provider === 'open' ? (
        <>
          Open Mode uses street photography from Wikimedia Commons. Add <code>VITE_GOOGLE_MAPS_API_KEY</code> or{' '}
          <code>VITE_MAPILLARY_ACCESS_TOKEN</code> to <code>.env</code> to unlock 360° street navigation across India.
        </>
      ) : (
        <>
          Mapillary 360° panoramas are active. Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to <code>.env</code> for Google Street View coverage.
        </>
      )}
    </p>
  );
}
