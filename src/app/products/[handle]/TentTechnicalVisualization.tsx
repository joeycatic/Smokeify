import {
  formatTentDimensionLabel,
  getTentFootprintSquareMeters,
  type TentDimensions,
} from "@/lib/tentDimensions";

export default function TentTechnicalVisualization({
  dimensions,
}: {
  dimensions: TentDimensions;
}) {
  const floorArea = getTentFootprintSquareMeters(dimensions).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="rounded-[22px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] p-4 shadow-[var(--gv-shadow)]">
      <div>
        <p className="font-[family:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-lime)]/90">
          Zeltmaße
        </p>
        <p className="mt-1 text-sm font-semibold text-[color:var(--gv-text)]">
          {formatTentDimensionLabel(dimensions)} cm
        </p>
      </div>

      <div className="mt-4 overflow-hidden rounded-[18px] border border-[color:var(--gv-border)] bg-[radial-gradient(circle_at_top,rgba(31,95,63,0.08),transparent_42%),linear-gradient(180deg,rgba(22,36,26,0.02),rgba(22,36,26,0.01))] p-4">
        <svg
          viewBox="0 0 280 248"
          className="h-auto w-full scale-[1.06] transform-gpu"
          role="img"
          aria-label={`Zelt mit ${dimensions.width} mal ${dimensions.depth} Zentimeter Grundfläche${
            dimensions.height ? ` und ${dimensions.height} Zentimeter Höhe` : ""
          }`}
        >
          <defs>
            <marker
              id="tent-dimension-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="4"
              refY="4"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill="rgba(31,95,63,0.92)" />
            </marker>
          </defs>

          <text x="72" y="26" fill="rgba(22,36,26,0.6)" fontSize="10" fontWeight="600" letterSpacing="1.6">
            VORNE
          </text>
          <text x="196" y="26" fill="rgba(22,36,26,0.6)" fontSize="10" fontWeight="600" letterSpacing="1.6">
            OBEN
          </text>

          <rect x="70" y="46" width="78" height="136" rx="4" fill="rgba(22,36,26,0.02)" stroke="rgba(22,36,26,0.4)" strokeWidth="2" />
          <rect x="84" y="73" width="36" height="62" rx="3" fill="none" stroke="rgba(22,36,26,0.3)" strokeWidth="1.5" />
          <circle cx="90" cy="63" r="9" fill="none" stroke="rgba(22,36,26,0.34)" strokeWidth="1.5" />
          <line x1="102" y1="73" x2="102" y2="170" stroke="rgba(22,36,26,0.16)" strokeWidth="1.5" strokeDasharray="4 5" />

          <rect x="184" y="74" width="58" height="58" rx="4" fill="rgba(22,36,26,0.02)" stroke="rgba(22,36,26,0.38)" strokeWidth="2" />
          <rect x="194" y="84" width="38" height="38" rx="3" fill="none" stroke="rgba(22,36,26,0.18)" strokeWidth="1.5" strokeDasharray="4 5" />

          <line x1="70" y1="198" x2="148" y2="198" stroke="rgba(31,95,63,0.92)" strokeWidth="2" markerStart="url(#tent-dimension-arrow)" markerEnd="url(#tent-dimension-arrow)" />
          {dimensions.height ? (
            <line x1="161" y1="46" x2="161" y2="182" stroke="rgba(31,95,63,0.92)" strokeWidth="2" markerStart="url(#tent-dimension-arrow)" markerEnd="url(#tent-dimension-arrow)" />
          ) : null}
          <line x1="184" y1="145" x2="242" y2="145" stroke="rgba(31,95,63,0.92)" strokeWidth="2" markerStart="url(#tent-dimension-arrow)" markerEnd="url(#tent-dimension-arrow)" />
          <line x1="255" y1="74" x2="255" y2="132" stroke="rgba(31,95,63,0.92)" strokeWidth="2" markerStart="url(#tent-dimension-arrow)" markerEnd="url(#tent-dimension-arrow)" />

          <text x="109" y="222" textAnchor="middle" fill="rgba(31,95,63,0.96)" fontSize="12" fontWeight="700">
            {dimensions.width} cm
          </text>
          {dimensions.height ? (
            <text x="172" y="116" fill="rgba(31,95,63,0.96)" fontSize="12" fontWeight="700" transform="rotate(90 172 116)">
              {dimensions.height} cm
            </text>
          ) : null}
          <text x="213" y="166" textAnchor="middle" fill="rgba(31,95,63,0.96)" fontSize="12" fontWeight="700">
            {dimensions.width} cm
          </text>
          <text x="263" y="104" fill="rgba(31,95,63,0.96)" fontSize="12" fontWeight="700" transform="rotate(90 263 104)">
            {dimensions.depth} cm
          </text>
        </svg>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-3 py-2">
          <p className="font-[family:var(--font-jetbrains-mono)] uppercase tracking-[0.16em] text-[color:var(--gv-text-muted)]">
            Stellfläche
          </p>
          <p className="mt-1 font-semibold text-[color:var(--gv-text)]">{floorArea} m²</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-3 py-2">
          <p className="font-[family:var(--font-jetbrains-mono)] uppercase tracking-[0.16em] text-[color:var(--gv-text-muted)]">
            Höhe
          </p>
          <p className="mt-1 font-semibold text-[color:var(--gv-text)]">
            {dimensions.height ? `${dimensions.height} cm` : "Nicht angegeben"}
          </p>
        </div>
      </div>
    </div>
  );
}
