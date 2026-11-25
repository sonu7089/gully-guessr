export function Compass({ heading }: { heading: number | null }) {
  const known = heading != null && Number.isFinite(heading);
  const label = known ? `Facing ${Math.round(heading!)}°` : 'Heading unavailable for this photo';
  return (
    <div className="compass" role="img" aria-label={label} title={label}>
      <div className="compass__dial" style={{ transform: `rotate(${known ? -heading! : 0}deg)`, opacity: known ? 1 : 0.4 }}>
        <span className="n">N</span>
        <span className="e">E</span>
        <span className="s">S</span>
        <span className="w">W</span>
      </div>
      <span className="compass__needle" aria-hidden="true" />
      <span className="compass__deg">{known ? `${Math.round(heading!)}°` : '—'}</span>
    </div>
  );
}
