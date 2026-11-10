/** OQ logo (PBC 03 item 1: logo instead of the application name). Stylised wordmark, drawn inline so it works offline. */
export function OqLogo({ size = 34, word = false }: { size?: number; word?: boolean }) {
  return (
    <svg className="oq-logo" style={{ color: "var(--ink)", flexShrink: 0 }} role="img" aria-label="OQ" width={word ? size * 2 : size} height={size} viewBox={word ? '0 0 80 40' : '0 0 40 40'} fill="none">
      <defs>
        <linearGradient id="oqg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e11d48" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
      {/* O */}
      <circle cx="20" cy="20" r="14" stroke="url(#oqg)" strokeWidth="6" />
      {word && (
        <>
          {/* Q with tail */}
          <circle cx="50" cy="20" r="14" stroke="currentColor" strokeWidth="6" className="oq-q" />
          <path d="M58 28l9 9" stroke="url(#oqg)" strokeWidth="6" strokeLinecap="round" />
        </>
      )}
      {!word && <path d="M26 27l7 7" stroke="currentColor" strokeWidth="5" strokeLinecap="round" className="oq-q" />}
    </svg>
  );
}
