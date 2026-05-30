import Image from "next/image";
import Link from "next/link";
import {
  ArrowTopRightOnSquareIcon,
  ArrowUpTrayIcon,
  BeakerIcon,
  CheckBadgeIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  TrashIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type {
  AnalysisHistoryEntry,
  AnalyzerResponse,
  AnalyzerSessionStatus,
  AnalyzerStatus,
  AsyncStatus,
  HistoryReportDetail,
  LoadingStep,
  Locale,
} from "@/app/pflanzen-analyzer/types";
import type {
  PlantAnalyzerAnalysisContext,
  PlantAnalyzerConsideredInput,
  PlantAnalyzerHealthStatus,
  PlantAnalyzerInfluenceNote,
} from "@/lib/plantAnalyzerTypes";
import type {
  PlantAnalyzerFeedbackClassification,
  PlantAnalyzerRemediationPlan,
  PlantAnalyzerStoredFeedback,
} from "@/lib/plantAnalyzerRemediationTypes";
import { PLANT_ANALYZER_PATH } from "@/lib/plantAnalyzerPaths";
import { trackFirstPartyAnalyticsEvent } from "@/lib/analytics";
import { SITE_NAME } from "@/lib/siteConfig";
import { STOREFRONT_ANALYTICS_EVENTS } from "@/lib/storefrontAnalytics";
import LoadingSpinner from "@/components/LoadingSpinner";

const formatDate = (value: string, locale: Locale) =>
  new Date(value).toLocaleString(locale === "de" ? "de-DE" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const lightFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4C56C] focus-visible:ring-offset-2";
const darkFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4C56C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#21150f]";

export function getLocalizedUploadTips(locale: Locale) {
  return locale === "de"
    ? ["Nah dran", "Ohne Filter", "Gutes Licht"]
    : ["Close up", "No filters", "Good light"];
}

export function getLoadingSteps(locale: Locale): LoadingStep[] {
  return locale === "de"
    ? [
        {
          title: "Bilddetails werden gelesen",
          detail: "Format, Schärfe und sichtbare Blattbereiche werden geprüft.",
          color: "#E4C56C",
        },
        {
          title: "Symptome werden abgeglichen",
          detail:
            "Farbveränderungen, Blattstruktur und Auffälligkeiten werden eingeordnet.",
          color: "#E7A55A",
        },
        {
          title: "Empfehlungen werden gebaut",
          detail:
            "Nächste Schritte, Produktbezug und Priorität werden vorbereitet.",
          color: "#7DD3FC",
        },
      ]
    : [
        {
          title: "Reading image details",
          detail: "Checking format, sharpness, and visible leaf areas.",
          color: "#E4C56C",
        },
        {
          title: "Matching visible symptoms",
          detail:
            "Comparing color shifts, leaf structure, and visual anomalies.",
          color: "#E7A55A",
        },
        {
          title: "Preparing recommendations",
          detail: "Building next steps, product context, and priority.",
          color: "#7DD3FC",
        },
      ];
}

function confidenceLabel(value: number) {
  return `${Math.round(value * 100)} %`;
}

function confidencePercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function confidenceBandLabel(
  value: AnalyzerResponse["confidenceBand"],
  locale: Locale,
) {
  if (value === "high") return locale === "de" ? "hoch" : "high";
  if (value === "low") return locale === "de" ? "niedrig" : "low";
  return locale === "de" ? "mittel" : "medium";
}

function confidenceBandMessage(
  value: AnalyzerResponse["confidenceBand"],
  locale: Locale,
) {
  if (value === "high") {
    return locale === "de"
      ? "Klare Signale im Bild."
      : "Clear visual signals.";
  }
  if (value === "low") {
    return locale === "de"
      ? "Noch unscharf. Bitte gegenprüfen."
      : "Still ambiguous. Verify manually.";
  }
  return locale === "de"
    ? "Gute Tendenz, aber prüfen."
    : "Useful direction, but verify.";
}

function confidenceBandVisuals(value: AnalyzerResponse["confidenceBand"]) {
  if (value === "high") {
    return {
      ring: "#E4C56C",
      glow: "0 0 42px rgba(228,197,108,0.22)",
      accentClass: "text-[#f5deb2]",
      panelClass:
        "border-[#E4C56C]/25 bg-[linear-gradient(180deg,rgba(228,197,108,0.14)_0%,rgba(9,13,10,0.7)_100%)]",
    };
  }
  if (value === "low") {
    return {
      ring: "#C88B54",
      glow: "0 0 36px rgba(200,139,84,0.18)",
      accentClass: "text-[#e8b07a]",
      panelClass:
        "border-[#e8b07a]/20 bg-[linear-gradient(180deg,rgba(200,139,84,0.12)_0%,rgba(9,13,10,0.7)_100%)]",
    };
  }
  return {
    ring: "#F0D4A0",
    glow: "0 0 36px rgba(240,212,160,0.18)",
    accentClass: "text-[#F0D4A0]",
    panelClass:
      "border-[#F0D4A0]/18 bg-[linear-gradient(180deg,rgba(240,212,160,0.12)_0%,rgba(9,13,10,0.7)_100%)]",
  };
}

function InlineConfidenceBar({
  value,
  locale,
  tone = "default",
}: {
  value: number;
  locale: Locale;
  tone?: "default" | "soft";
}) {
  const percent = confidencePercent(value);

  return (
    <div className="mt-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/48">
          {locale === "de" ? "Confidence" : "Confidence"}
        </p>
        <span className="text-xs font-semibold text-white/78">
          {percent}%
        </span>
      </div>
      <div
        className={`h-2 overflow-hidden rounded-full ${
          tone === "soft" ? "bg-white/8" : "bg-black/30"
        }`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[color:var(--gv-lime)] via-[#e4c56c] to-[#f5e8bc] transition-all duration-700"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function compactAnalyzerLabel(value: string) {
  return value
    .replace(/^Sichtbare Auffälligkeit:\s*/i, "")
    .replace(/^Visible symptom:\s*/i, "")
    .replace(/\.$/, "")
    .trim();
}

function ConfidenceDial({
  locale,
  confidence,
  confidenceBand,
}: {
  locale: Locale;
  confidence: number;
  confidenceBand: AnalyzerResponse["confidenceBand"];
}) {
  const percent = confidencePercent(confidence);
  const radius = 56;
  const strokeWidth = 10;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset =
    circumference - (percent / 100) * circumference;
  const visuals = confidenceBandVisuals(confidenceBand);

  return (
    <div
      className={`rounded-[22px] border p-3.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${visuals.panelClass}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
            {locale === "de" ? "Confidence" : "Confidence"}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-white/68">
            {confidenceBandMessage(confidenceBand, locale)}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 self-start rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${visuals.accentClass}`}
        >
          {confidenceBandLabel(confidenceBand, locale)}
        </span>
      </div>
      <div className="mt-3 flex justify-center">
        <div
          className="relative flex h-32 w-32 items-center justify-center rounded-full"
          style={{ boxShadow: visuals.glow }}
        >
          <svg
            viewBox={`0 0 ${radius * 2} ${radius * 2}`}
            className="h-full w-full -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx={radius}
              cy={radius}
              r={normalizedRadius}
              fill="none"
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={strokeWidth}
            />
            <circle
              cx={radius}
              cy={radius}
              r={normalizedRadius}
              fill="none"
              stroke={visuals.ring}
              strokeLinecap="round"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-center">
            <span className="font-[family:var(--font-syne)] text-3xl font-bold tracking-[-0.06em] text-white">
              {percent}
              <span className="ml-0.5 text-lg text-white/68">%</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderContextSummary(
  context: PlantAnalyzerAnalysisContext | null,
  locale: Locale,
) {
  if (!context) return [];

  const items: string[] = [];
  if (context.medium && context.medium !== "unknown") {
    items.push(`${locale === "de" ? "Medium" : "Medium"}: ${context.medium}`);
  }
  if (context.growthStage && context.growthStage !== "unknown") {
    items.push(
      `${locale === "de" ? "Phase" : "Stage"}: ${context.growthStage}`,
    );
  }
  if (typeof context.ph === "number") items.push(`pH: ${context.ph}`);
  if (typeof context.ec === "number") items.push(`EC: ${context.ec}`);
  if (typeof context.temperatureC === "number") {
    items.push(
      `${locale === "de" ? "Temperatur" : "Temperature"}: ${context.temperatureC} C`,
    );
  }
  if (typeof context.humidityPercent === "number") {
    items.push(
      `${locale === "de" ? "Luftfeuchte" : "Humidity"}: ${context.humidityPercent}%`,
    );
  }
  if (typeof context.lightDistanceCm === "number") {
    items.push(
      `${locale === "de" ? "Lichtabstand" : "Light distance"}: ${context.lightDistanceCm} cm`,
    );
  }
  if (context.lightType) {
    items.push(
      `${locale === "de" ? "Lichttyp" : "Light"}: ${context.lightType}`,
    );
  }
  if (context.tentOrRoomSize) {
    items.push(
      `${locale === "de" ? "Raum / Zelt" : "Space"}: ${context.tentOrRoomSize}`,
    );
  }
  if (context.wateringCadence) {
    items.push(
      `${locale === "de" ? "Gießrhythmus" : "Watering"}: ${context.wateringCadence}`,
    );
  }
  return items;
}

function consideredInputLabel(
  key: PlantAnalyzerConsideredInput["key"],
  locale: Locale,
) {
  switch (key) {
    case "visualNotes":
      return locale === "de" ? "Bildnotiz" : "Photo note";
    case "growContextNotes":
      return locale === "de" ? "Verlauf / Grow-Kontext" : "Grow context note";
    case "medium":
      return locale === "de" ? "Medium" : "Medium";
    case "growthStage":
      return locale === "de" ? "Phase" : "Stage";
    case "wateringCadence":
      return locale === "de" ? "Gießrhythmus" : "Watering cadence";
    case "ph":
      return "pH";
    case "ec":
      return "EC";
    case "temperatureC":
      return locale === "de" ? "Temperatur" : "Temperature";
    case "humidityPercent":
      return locale === "de" ? "Luftfeuchte" : "Humidity";
    case "lightDistanceCm":
      return locale === "de" ? "Lichtabstand" : "Light distance";
    case "lightType":
      return locale === "de" ? "Lichttyp" : "Light type";
    case "tentOrRoomSize":
      return locale === "de" ? "Raum / Zelt" : "Space";
    default:
      return key;
  }
}

function consideredInputStageLabel(
  stage: PlantAnalyzerConsideredInput["stage"],
  locale: Locale,
) {
  if (stage === "visual") {
    return locale === "de" ? "Nur Bildlese-Hilfe" : "Image reading only";
  }
  return locale === "de" ? "Nur Ursachenabwägung" : "Reasoning only";
}

function influenceNoteLabel(note: PlantAnalyzerInfluenceNote, locale: Locale) {
  const sourceLabels = [
    ...new Set(
      note.sources.map((source) => consideredInputLabel(source, locale)),
    ),
  ];
  const formattedSources = sourceLabels.join(", ");

  switch (note.code) {
    case "visual_notes_image_only":
      return locale === "de"
        ? "Bildnotizen helfen nur beim Einordnen sichtbarer Bereiche im Foto."
        : "Photo notes only help narrow down visible areas in the image.";
    case "grow_notes_reasoning_only":
      return locale === "de"
        ? "Freitext zum Verlauf fließt nur in die Ursachenabwägung ein."
        : "Grow-history notes are used only in the reasoning step.";
    case "context_changes_reasoning_only":
      return locale === "de"
        ? `${formattedSources} beeinflussen nur die Ursachenabwägung, nicht das reine Bildlesen.`
        : `${formattedSources} affect reasoning, not the raw image read.`;
    case "context_guides_environment_checks":
      return locale === "de"
        ? `${formattedSources} wurden für Klima-, Licht- oder Gieß-Checks genutzt.`
        : `${formattedSources} were used to guide environment, light, or watering checks.`;
  }
}

function AnalyzerAttributionCard({
  locale,
  consideredInputs,
  influenceNotes,
}: {
  locale: Locale;
  consideredInputs: PlantAnalyzerConsideredInput[];
  influenceNotes: PlantAnalyzerInfluenceNote[];
}) {
  if (consideredInputs.length === 0 && influenceNotes.length === 0) {
    return null;
  }

  const isGerman = locale === "de";

  return (
    <div className="rounded-[18px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
        {isGerman ? "Was den Befund beeinflusst hat" : "What shaped the result"}
      </p>
      <p className="mt-2 text-sm leading-5 text-[color:var(--gv-text-muted)]">
        {isGerman
          ? "Die Bildanalyse bleibt bildbasiert. Optionaler Kontext verschiebt nur die Einordnung und die Checkliste."
          : "The image read stays image-first. Optional context only shifts interpretation and the follow-up checks."}
      </p>

      {influenceNotes.length > 0 ? (
        <div className="mt-3 space-y-2">
          {influenceNotes.map((note) => (
            <div
              key={`${note.code}-${note.sources.join("-")}`}
              className="rounded-[16px] border border-[color:var(--gv-border)] bg-black/10 px-3.5 py-2.5 text-sm leading-5 text-[color:var(--gv-text)]"
            >
              {influenceNoteLabel(note, locale)}
            </div>
          ))}
        </div>
      ) : null}

      {consideredInputs.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {consideredInputs.map((input) => (
            <div
              key={`${input.stage}-${input.key}-${input.value}`}
              className="rounded-[16px] border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-3 py-2 text-xs text-[color:var(--gv-text)]"
            >
              <div className="font-semibold">
                {consideredInputLabel(input.key, locale)}: {input.value}
              </div>
              <div className="mt-1 text-[color:var(--gv-text-muted)]">
                {consideredInputStageLabel(input.stage, locale)}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function healthStatusLabel(value: PlantAnalyzerHealthStatus, locale: Locale) {
  if (value === "healthy") {
    return locale === "de" ? "Eher unkritisch" : "Mostly fine";
  }
  if (value === "critical") {
    return locale === "de" ? "Erhöhter Handlungsbedarf" : "Needs attention";
  }
  return locale === "de" ? "Bitte prüfen" : "Worth checking";
}

function healthStatusClasses(value: PlantAnalyzerHealthStatus) {
  if (value === "healthy") {
    return "border-[#e4c56c]/45 bg-[#fff5da] text-[#6e4521]";
  }
  if (value === "critical") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-[#c88b54]/45 bg-[#fff1e3] text-[#7b4f28]";
}

function formatPrice(amount: string, currencyCode: string, locale: Locale) {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

function severityLabel(value: PlantAnalyzerHealthStatus, locale: Locale) {
  if (value === "critical") return locale === "de" ? "kritisch" : "critical";
  if (value === "healthy") return locale === "de" ? "unkritisch" : "low risk";
  return locale === "de" ? "prüfen" : "check";
}

function severityCardClasses(value: PlantAnalyzerHealthStatus) {
  if (value === "critical") {
    return "border-red-500/28 bg-[linear-gradient(135deg,rgba(127,29,29,0.26)_0%,rgba(23,14,12,0.94)_100%)]";
  }
  if (value === "healthy") {
    return "border-[#e4c56c]/28 bg-[linear-gradient(135deg,rgba(132,84,33,0.28)_0%,rgba(23,14,12,0.94)_100%)]";
  }
  return "border-[#c88b54]/24 bg-[linear-gradient(135deg,rgba(104,62,26,0.22)_0%,rgba(23,14,12,0.94)_100%)]";
}

function urgencyLabel(
  value: PlantAnalyzerRemediationPlan["urgency"],
  locale: Locale,
) {
  if (value === "high") {
    return locale === "de" ? "Heute priorisieren" : "Prioritize today";
  }
  if (value === "medium") {
    return locale === "de" ? "Zeitnah prüfen" : "Check soon";
  }
  return locale === "de" ? "Ruhig beobachten" : "Monitor calmly";
}

function resultHeroClasses(value: PlantAnalyzerHealthStatus) {
  if (value === "critical") {
    return "border-red-500/35 bg-[linear-gradient(135deg,rgba(69,10,10,0.96)_0%,rgba(23,14,12,0.98)_58%,rgba(18,12,10,1)_100%)] text-white shadow-[0_28px_70px_rgba(0,0,0,0.28)]";
  }
  if (value === "healthy") {
    return "border-[#e4c56c]/30 bg-[linear-gradient(135deg,rgba(74,44,18,0.98)_0%,rgba(23,14,12,0.98)_56%,rgba(18,12,10,1)_100%)] text-white shadow-[0_28px_70px_rgba(0,0,0,0.24)]";
  }
  return "border-[#c88b54]/30 bg-[linear-gradient(135deg,rgba(58,34,17,0.98)_0%,rgba(23,14,12,0.98)_58%,rgba(18,12,10,1)_100%)] text-white shadow-[0_28px_70px_rgba(0,0,0,0.24)]";
}

function resultHeroAccentClasses(value: PlantAnalyzerHealthStatus) {
  if (value === "critical") {
    return "text-[#ffb4b4]";
  }
  if (value === "healthy") {
    return "text-[#f5deb2]";
  }
  return "text-[#f0d4a0]";
}

function feedbackLabel(feedback: PlantAnalyzerStoredFeedback, locale: Locale) {
  const labels: Record<PlantAnalyzerFeedbackClassification, string> =
    locale === "de"
      ? {
          helpful: "Als hilfreich markiert",
          issue_guess_wrong: "Mögliche Ursache wirkt falsch",
          product_suggestion_off: "Produkthinweise wirken unpassend",
          recommendation_relevant: "Empfehlung war relevant",
          follow_up_improved: "Verlauf später verbessert",
          follow_up_worsened: "Verlauf später verschlechtert",
          needs_recheck: "Erneute Prüfung angefragt",
        }
      : {
          helpful: "Marked as helpful",
          issue_guess_wrong: "Possible cause seems wrong",
          product_suggestion_off: "Product hints seem off",
          recommendation_relevant: "Recommendation was relevant",
          follow_up_improved: "Marked as improved later",
          follow_up_worsened: "Marked as worsened later",
          needs_recheck: "Requested a recheck",
        };

  return labels[feedback.classification];
}

function reviewedCaseLabel(
  value: NonNullable<AnalyzerResponse["reviewedCase"]>,
  locale: Locale,
) {
  const mapping =
    locale === "de"
      ? {
          new: "Neu",
          in_review: "In Prüfung",
          rerun_requested: "Rerun angefragt",
          resolved: "Geprüft",
          dismissed: "Geschlossen",
        }
      : {
          new: "New",
          in_review: "In review",
          rerun_requested: "Rerun requested",
          resolved: "Reviewed",
          dismissed: "Dismissed",
        };

  return mapping[value.queueStatus];
}

function publicationStatusLabel(
  status: NonNullable<AnalyzerResponse["publication"]>["status"],
  locale: Locale,
) {
  const mapping =
    locale === "de"
      ? {
          DRAFT: "Entwurf",
          SUBMITTED: "Eingereicht",
          REJECTED: "Abgelehnt",
          PUBLISHED: "Veröffentlicht",
        }
      : {
          DRAFT: "Draft",
          SUBMITTED: "Submitted",
          REJECTED: "Rejected",
          PUBLISHED: "Published",
        };

  return mapping[status];
}

function publicationButtonLabel(input: {
  locale: Locale;
  asyncStatus: AsyncStatus;
  publicationStatus: AnalyzerResponse["publication"] extends infer T
    ? T extends { status: infer S }
      ? S
      : null
    : null;
}) {
  if (input.asyncStatus === "loading") {
    return input.locale === "de" ? "Wird eingereicht..." : "Submitting...";
  }

  if (input.publicationStatus === "PUBLISHED") {
    return input.locale === "de"
      ? "Bereits veröffentlicht"
      : "Already published";
  }

  if (input.publicationStatus === "SUBMITTED") {
    return input.locale === "de" ? "Bereits eingereicht" : "Already submitted";
  }

  if (input.publicationStatus === "REJECTED") {
    return input.locale === "de" ? "Erneut einreichen" : "Resubmit case";
  }

  return input.locale === "de" ? "Fall einreichen" : "Submit case";
}

function publicationIsLocked(
  status: AnalyzerResponse["publication"] extends infer T
    ? T extends { status: infer S }
      ? S
      : null
    : null,
) {
  return status === "SUBMITTED" || status === "PUBLISHED";
}

function publicationMessageClasses(status: AsyncStatus) {
  if (status === "error") {
    return "text-red-300";
  }

  if (status === "loading") {
    return "text-[color:var(--gv-lime)]";
  }

  return "text-[#f5deb2]";
}

function feedbackMessageClasses(status: AsyncStatus) {
  if (status === "error") {
    return "text-red-300";
  }

  if (status === "loading") {
    return "text-[color:var(--gv-lime)]";
  }

  return "text-[#f5deb2]";
}

function historyDetailToAnalyzerResponse(
  detail: HistoryReportDetail,
): AnalyzerResponse {
  return {
    analysisId: detail.id,
    storageWarning: null,
    diagnosis: detail.diagnosis,
    summary: detail.summary,
    observedSymptoms: detail.observedSymptoms,
    possibleCauses: detail.possibleCauses,
    verificationChecks: detail.verificationChecks,
    immediateActions: detail.immediateActions,
    deferActions: detail.deferActions,
    environmentConsiderations: detail.environmentConsiderations,
    uncertaintyNote: detail.uncertaintyNote,
    confidenceBand: detail.confidenceBand,
    needsHumanReview: detail.needsHumanReview,
    analysisContext: detail.analysisContext,
    consideredInputs: detail.consideredInputs,
    influenceNotes: detail.influenceNotes,
    contextUsed: detail.contextUsed,
    promptVersion: detail.promptVersion,
    reasoningVersion: detail.reasoningVersion,
    followUp: detail.followUp,
    productSuggestions: detail.productSuggestions,
    guideSuggestions: detail.guideSuggestions,
    remediation: detail.remediation,
    lastFeedback: detail.lastFeedback,
    reviewedCase: detail.reviewedCase,
    publication: detail.publication,
  };
}

function UploadedPlantImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const shouldBypassOptimization =
    src.startsWith("blob:") || src.startsWith("data:");

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized={shouldBypassOptimization}
      decoding="async"
      sizes="(min-width: 768px) 320px, 100vw"
      className={className}
    />
  );
}

function ProductSuggestionGrid({
  locale,
  productSuggestions,
  surface = "page",
}: {
  locale: Locale;
  productSuggestions: AnalyzerResponse["productSuggestions"];
  surface?: "page" | "modal";
}) {
  if (productSuggestions.length === 0) {
    return (
      <div className="gv-glass rounded-2xl px-4 py-3 text-sm text-[color:var(--gv-text-muted)]">
        {locale === "de"
          ? "Keine Produktempfehlungen verfügbar."
          : "No product recommendations available."}
      </div>
    );
  }

  const gridClasses =
    surface === "modal"
      ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      : "grid gap-5 sm:grid-cols-2 xl:grid-cols-4";

  return (
    <div className={gridClasses}>
      {productSuggestions.map((product) => {
        const rationale =
          product.classification === "verify"
            ? locale === "de"
              ? "Erst messen"
              : "Measure first"
            : product.classification === "stabilize"
              ? locale === "de"
                ? "Klima stabilisieren"
                : "Stabilize climate"
              : locale === "de"
                ? "Optionale Unterstützung"
                : "Optional support";
        return (
          <Link
            key={product.id}
            href={`/products/${product.handle}`}
            onClick={() =>
              trackFirstPartyAnalyticsEvent(
                STOREFRONT_ANALYTICS_EVENTS.analyzerProductClick,
                {
                  product_id: product.id,
                  product_handle: product.handle,
                },
              )
            }
            className={`group gv-glass flex h-full w-full flex-col overflow-hidden rounded-[24px] transition-transform duration-200 hover:-translate-y-0.5 hover:border-[color:var(--gv-lime)]/45 hover:shadow-[0_24px_60px_rgba(3,8,4,0.4)] ${lightFocusRing}`}
          >
          <div className="relative aspect-[9/8] overflow-hidden rounded-t-[24px] bg-white sm:aspect-square">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.imageAlt}
                fill
                sizes="(min-width: 1280px) 240px, (min-width: 640px) 50vw, 100vw"
                className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.04]"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-stone-300">
                <PhotoIcon className="h-8 w-8" />
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col p-4">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-[color:var(--gv-lime)]/24 bg-[color:var(--gv-lime)]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--gv-lime)]">
                  {rationale}
                </span>
                <span className="rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--gv-text-muted)]">
                  {locale === "de" ? "Nicht automatisch" : "Not automatic"}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 break-words font-[family:var(--font-dm-sans)] text-base font-semibold leading-snug text-[color:var(--gv-text)]">
                {product.title}
              </p>
              <p className="mt-2 line-clamp-3 min-h-[4.5rem] break-words text-sm leading-6 text-[color:var(--gv-text-muted)]">
                {product.reason}
              </p>
            </div>
            <div className="mt-auto pt-3">
              <div className="mt-2 flex min-h-[2rem] items-baseline gap-2">
                <span className="font-[family:var(--font-jetbrains-mono)] text-lg font-semibold text-[color:var(--gv-lime)]">
                  {product.price
                    ? formatPrice(
                        product.price.amount,
                        product.price.currencyCode,
                        locale,
                      )
                    : locale === "de"
                      ? "Shop ansehen"
                      : "View product"}
                </span>
              </div>
              <div className="mt-4 flex w-full items-center justify-end">
                <span className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] p-3 text-[color:var(--gv-text-muted)] shadow-sm transition hover:border-[color:var(--gv-lime)]/40 hover:text-[color:var(--gv-lime)]">
                  <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                </span>
              </div>
            </div>
          </div>
          </Link>
        );
      })}
    </div>
  );
}

function GuideSuggestionList({
  locale,
  guideSuggestions,
}: {
  locale: Locale;
  guideSuggestions: AnalyzerResponse["guideSuggestions"];
}) {
  if (guideSuggestions.length === 0) {
    return (
      <div className="gv-glass rounded-2xl px-4 py-3 text-sm text-[color:var(--gv-text-muted)]">
        {locale === "de"
          ? "Keine weiterführenden Guides verfügbar."
          : "No further guides available."}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {guideSuggestions.map((guide) => (
        <Link
          key={guide.slug}
          href={guide.href}
          className={`gv-glass rounded-2xl px-4 py-4 transition hover:border-[color:var(--gv-lime)]/35 hover:bg-[color:var(--gv-lime)]/10 ${lightFocusRing}`}
        >
          <p className="break-words text-sm font-semibold text-[color:var(--gv-text)]">
            {guide.title}
          </p>
          <p className="mt-2 break-words text-sm leading-6 text-[color:var(--gv-text-muted)]">
            {guide.description}
          </p>
        </Link>
      ))}
    </div>
  );
}

export function PlantAnalyzerHero({ locale }: { locale: Locale }) {
  const isGerman = locale === "de";

  return (
    <section className="gv-panel relative isolate overflow-hidden rounded-[28px] px-4 py-5 sm:rounded-[36px] sm:px-7 sm:py-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(228,197,108,0.14),transparent_30%),radial-gradient(circle_at_left,rgba(200,139,84,0.12),transparent_24%)]" />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:items-start">
        <div className="min-w-0">
          <span className="gv-chip">{isGerman ? "Analyzer" : "Analyzer"}</span>
          <p className="mt-3 font-[family:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.2em] text-[color:var(--gv-text-muted)] sm:mt-4 sm:text-xs sm:tracking-[0.22em]">
            {isGerman
              ? "Vorsichtige KI-Ersteinschätzung"
              : "Cautious AI first review"}
          </p>
          <h1 className="mt-3 max-w-4xl font-[family:var(--font-syne)] text-[2.8rem] font-bold leading-[0.92] tracking-[-0.07em] text-[color:var(--gv-text)] sm:text-5xl sm:leading-[0.94]">
            {isGerman
              ? "Foto hochladen und sofort sehen, was du als Nächstes prüfen solltest"
              : "Upload a plant photo, interpret symptoms, and see relevant next steps"}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--gv-text-muted)] sm:mt-4 sm:text-base sm:leading-7">
            {isGerman
              ? "Ein Foto rein, dann Befund, Confidence und nächste Checks."
              : "A clear plant photo gives you a cautious read, confidence context, next checks, and only relevant product hints."}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row">
            <a
              href="#plant-analyzer-upload"
              className={`inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[color:var(--gv-lime)] px-5 py-3 text-sm font-semibold text-[color:var(--gv-forest)] sm:w-auto ${lightFocusRing}`}
            >
              {isGerman ? "Analyse starten" : "Start analysis"}
            </a>
          </div>
        </div>

        <div className="hidden rounded-[28px] p-4 lg:block gv-glass">
          <p className="font-[family:var(--font-jetbrains-mono)] text-xs uppercase tracking-[0.22em] text-[color:var(--gv-lime)]">
            {isGerman ? "Was du hier machst" : "What you do here"}
          </p>
          <div className="mt-4 grid gap-3">
            {[
              {
                label: isGerman ? "Schritt 1" : "Step 1",
                value: isGerman
                  ? "Pflanzenfoto hochladen"
                  : "Upload a plant photo",
                icon: <ArrowUpTrayIcon className="h-4.5 w-4.5" />,
              },
              {
                label: isGerman ? "Schritt 2" : "Step 2",
                value: isGerman
                  ? "KI-Einschätzung mit Befund und Confidence"
                  : "AI assessment with finding and confidence",
                icon: <BeakerIcon className="h-4.5 w-4.5" />,
              },
              {
                label: isGerman ? "Schritt 3" : "Step 3",
                value: isGerman
                  ? "Nächste Schritte prüfen und passend handeln"
                  : "Review next steps and act accordingly",
                icon: <CheckBadgeIcon className="h-4.5 w-4.5" />,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[20px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 py-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] text-[color:var(--gv-lime)]">
                  {item.icon}
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                  {item.label}
                </p>
                <p className="mt-2 text-sm font-semibold text-[color:var(--gv-text)]">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PlantAnalyzerUploadSection({
  testMode,
  inputId,
  locale,
  pathname,
  imagePreview,
  imageName,
  isDraggingFile,
  isPreparingImage,
  visualNotes,
  growContextNotes,
  analysisContext,
  recheckBaseline,
  status,
  loadingMessage,
  error,
  isAuthenticated,
  isPrivilegedUser,
  freeAnalysesRemaining,
  freeAnalysisUsed,
  effectiveSessionStatus,
  hasHydrated,
  onFileChange,
  onClearImage,
  onVisualNotesChange,
  onGrowContextNotesChange,
  onContextChange,
  onClearRecheckBaseline,
  onAnalyze,
  onCancelAnalysis,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  testMode: boolean;
  inputId: string;
  locale: Locale;
  pathname: string | null;
  imagePreview: string | null;
  imageName: string;
  isDraggingFile: boolean;
  isPreparingImage: boolean;
  visualNotes: string;
  growContextNotes: string;
  analysisContext: PlantAnalyzerAnalysisContext;
  recheckBaseline: AnalysisHistoryEntry | null;
  status: AnalyzerStatus;
  loadingMessage: string | null;
  error: string;
  isAuthenticated: boolean;
  isPrivilegedUser: boolean;
  freeAnalysesRemaining: number;
  freeAnalysisUsed: boolean;
  effectiveSessionStatus: AnalyzerSessionStatus;
  hasHydrated: boolean;
  onFileChange: (file: File | null) => void;
  onClearImage: () => void;
  onVisualNotesChange: (value: string) => void;
  onGrowContextNotesChange: (value: string) => void;
  onContextChange: (
    field: keyof PlantAnalyzerAnalysisContext,
    value: string | number | null | undefined,
  ) => void;
  onClearRecheckBaseline: () => void;
  onAnalyze: () => void;
  onCancelAnalysis: () => void;
  onDragOver: (event: React.DragEvent<HTMLLabelElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLLabelElement>) => void;
  onDrop: (event: React.DragEvent<HTMLLabelElement>) => void;
}) {
  const isGerman = locale === "de";
  const uploadTips = getLocalizedUploadTips(locale);
  const contextSummary = renderContextSummary(
    Object.keys(analysisContext).length > 0 ? analysisContext : null,
    locale,
  );
  const optionalInputCount =
    contextSummary.length +
    (visualNotes.trim() ? 1 : 0) +
    (growContextNotes.trim() ? 1 : 0);
  const hasLoadedTestResult = testMode && status === "success";
  const mobileStatusLabel = testMode
    ? isGerman
      ? "Testmodus ohne Credits und ohne Speicherung"
      : "Test mode without credits or saved history"
    : isAuthenticated
    ? isPrivilegedUser
      ? isGerman
        ? "Unbegrenzte Analysen aktiv"
        : "Unlimited analyses enabled"
      : freeAnalysisUsed
        ? isGerman
          ? "24h-Limit erreicht"
          : "24h limit reached"
        : isGerman
          ? `${freeAnalysesRemaining} freie Analysen übrig`
          : `${freeAnalysesRemaining} free analyses left`
    : hasHydrated && effectiveSessionStatus !== "loading"
      ? isGerman
        ? "Login nötig für die Analyse"
        : "Login required for analysis"
      : isGerman
        ? "Status wird geladen"
        : "Loading status";

  return (
    <section className="relative isolate w-full overflow-hidden rounded-[24px] border border-[color:var(--gv-border)] bg-[linear-gradient(180deg,rgba(26,18,14,0.98)_0%,rgba(14,10,9,1)_100%)] px-4 pb-4 pt-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:rounded-[32px] sm:px-6 sm:pb-6 sm:pt-5">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(228,197,108,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(123,79,40,0.28),transparent_30%)]" />

      <div className="mx-auto max-w-5xl">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.86fr)] lg:items-center lg:gap-8">
          <div className="min-w-0 lg:py-3">
            <p className="font-[family:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--gv-lime)]">
              {isGerman ? "Pflanzenanalyse" : "Analyzer"}
            </p>
            <h1 className="mt-2 font-[family:var(--font-syne)] text-[2rem] font-bold leading-[0.94] tracking-[-0.08em] text-[color:var(--gv-text)] sm:hidden">
              {isGerman
                ? "Foto rein. Ergebnis in 30 Sek."
                : "Add a photo. Results in 30 seconds."}
            </h1>
            <h2 className="mt-2 hidden font-[family:var(--font-syne)] text-[2.2rem] font-bold tracking-[-0.06em] text-[color:var(--gv-text)] sm:block">
              {isGerman ? "Lade ein Pflanzenfoto hoch" : "Upload a plant photo"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--gv-text-muted)] sm:text-base sm:leading-7">
              {isGerman
                ? "Ein klares Blattfoto reicht. Optionale Angaben verfeinern nur die Einordnung, nicht das reine Bildlesen."
                : "One clear leaf photo is enough. Optional details refine interpretation, not the raw image read."}
            </p>
            <p className="mt-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--gv-lime)]/88 sm:mt-3 sm:text-xs sm:tracking-[0.16em]">
              {mobileStatusLabel}
            </p>
          </div>
          <div className="hidden self-stretch rounded-[24px] border border-white/8 bg-black/20 p-3 sm:block">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {[
                {
                  label: isGerman ? "Foto" : "Photo",
                  value: isGerman
                    ? "Betroffenes Blatt nah aufnehmen"
                    : "Shoot the affected leaf close up",
                },
                {
                  label: isGerman ? "Optional" : "Optional",
                  value: isGerman
                    ? "Fotohinweis oder Grow-Kontext ergänzen"
                    : "Add a photo note or grow context",
                },
                {
                  label: isGerman ? "Ergebnis" : "Result",
                  value: isGerman
                    ? "Befund, Checks und nächste Schritte"
                    : "Finding, checks, and next steps",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[18px] border border-white/8 bg-black/20 px-3 py-3"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--gv-lime)]">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm leading-5 text-[color:var(--gv-text)]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <label
          id="plant-analyzer-upload"
          htmlFor={inputId}
          onDragOver={onDragOver}
          onDragEnter={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`mt-3 flex w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[24px] border border-dashed px-4 text-center transition focus-within:border-[color:var(--gv-lime)]/55 focus-within:bg-[color:var(--gv-lime)]/8 focus-within:shadow-[0_0_0_4px_rgba(228,197,108,0.12)] sm:mt-4 sm:rounded-[32px] sm:px-6 ${
            imagePreview
              ? "min-h-0 py-4 sm:py-5"
              : "min-h-[18rem] py-6 sm:min-h-[260px] sm:py-10"
          } ${
            isDraggingFile
              ? "border-[color:var(--gv-lime)]/55 bg-[color:var(--gv-lime)]/8 shadow-[0_0_0_4px_rgba(228,197,108,0.12)]"
              : "border-white/10 bg-black/15 hover:border-[color:var(--gv-lime)]/35 hover:bg-[color:var(--gv-lime)]/6"
          }`}
        >
          {imagePreview ? (
            <div className="w-full">
              <div className="relative mx-auto aspect-[4/5] w-full max-w-[17rem] overflow-hidden rounded-[24px] border border-white/10 bg-[color:var(--gv-dark)] sm:max-w-sm sm:rounded-[26px]">
                <UploadedPlantImage
                  src={imagePreview}
                  alt={
                    isGerman
                      ? "Vorschau des hochgeladenen Pflanzenfotos"
                      : "Preview of the uploaded plant photo"
                  }
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="mt-4 text-base font-semibold text-[color:var(--gv-text)]">
                {isPreparingImage
                  ? isGerman
                    ? "Bild wird vorbereitet ..."
                    : "Preparing image ..."
                  : hasLoadedTestResult
                    ? isGerman
                      ? "Demo-Report ist geladen. Du kannst die UI direkt prüfen oder ein neues Bild testen."
                      : "Demo report loaded. You can inspect the UI or try a new image."
                    : isGerman
                      ? "Foto sitzt. Starte jetzt die Analyse."
                      : "Photo ready. Start the analysis now."}
              </p>
              {imageName ? (
                <p className="mt-1 break-words text-xs text-[color:var(--gv-text-muted)]">
                  {imageName}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="max-w-md">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] border border-[color:var(--gv-lime)]/18 bg-black/25 text-[color:var(--gv-lime)] sm:h-16 sm:w-16 sm:rounded-[22px]">
                <ArrowUpTrayIcon className="h-7 w-7" />
              </div>
              <p className="mt-4 text-[1.35rem] font-semibold tracking-[-0.04em] text-[color:var(--gv-text)] sm:mt-5 sm:text-2xl">
                {isGerman ? "Pflanzenfoto hochladen" : "Upload a plant photo"}
              </p>
              <p className="mt-2 text-sm leading-5 text-[color:var(--gv-text-muted)] sm:leading-6">
                {isGerman
                  ? "Nah ran, ohne Filter, gutes Licht."
                  : "Close up, no filters, good light."}
              </p>
              <span className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[color:var(--gv-lime)] px-5 py-3 text-sm font-semibold text-[color:var(--gv-forest)] sm:mt-5 sm:min-h-12">
                {isGerman ? "Foto wählen" : "Choose photo"}
              </span>
            </div>
          )}
          <input
            id={inputId}
            type="file"
            accept="image/*"
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              onFileChange(nextFile);
              event.currentTarget.value = "";
            }}
            className="sr-only"
          />
        </label>

        {imagePreview ? (
          <div className="mt-3 flex flex-col gap-3 rounded-[22px] border border-white/8 bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[color:var(--gv-text)]">
                {imageName ||
                  (isGerman ? "Ausgewähltes Foto" : "Selected photo")}
              </p>
              <p className="mt-1 text-sm text-[color:var(--gv-text-muted)]">
                {testMode
                  ? isGerman
                    ? "Im Testmodus bleibt das Bild nur in dieser Vorschau und wird nicht im Verlauf gespeichert."
                    : "In test mode the image stays only in this preview and is not saved to history."
                  : isGerman
                    ? "Wird komprimiert gespeichert und später automatisch entfernt."
                    : "Stored in compressed form and removed automatically later."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClearImage}
              aria-label={isGerman ? "Foto entfernen" : "Remove photo"}
              className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-4 text-sm font-medium text-[color:var(--gv-text)] transition hover:border-red-400/35 hover:bg-red-500/10 hover:text-red-200 sm:h-10 sm:w-auto sm:rounded-full sm:px-3 sm:text-xs ${lightFocusRing}`}
            >
              <TrashIcon className="h-4.5 w-4.5" />
              <span>{isGerman ? "Foto entfernen" : "Remove photo"}</span>
            </button>
          </div>
        ) : null}

        {recheckBaseline ? (
          <div className="mt-3 rounded-[22px] border border-[color:var(--gv-lime)]/24 bg-[color:var(--gv-lime)]/10 px-4 py-3 text-sm text-[color:var(--gv-text)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-lime)]">
                  {isGerman ? "Recheck-Basis" : "Recheck baseline"}
                </p>
                <p className="mt-1">
                  {recheckBaseline.species ||
                    (isGerman ? "Vorherige Analyse" : "Previous analysis")}{" "}
                  · {formatDate(recheckBaseline.analyzedAt, locale)}
                </p>
              </div>
              <button
                type="button"
                onClick={onClearRecheckBaseline}
                className={`inline-flex min-h-10 items-center justify-center rounded-[18px] border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-[color:var(--gv-text)] transition hover:border-[color:var(--gv-lime)]/30 ${lightFocusRing}`}
              >
                {isGerman ? "Basis entfernen" : "Remove baseline"}
              </button>
            </div>
          </div>
        ) : null}

        <details className="group mt-3 rounded-[22px] border border-white/8 bg-black/15 open:border-[color:var(--gv-lime)]/18 open:bg-black/25 sm:mt-4 sm:rounded-[24px]">
          <summary className="cursor-pointer list-none px-4 py-3.5 sm:px-5 sm:py-4 [&::-webkit-details-marker]:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[color:var(--gv-text)]">
                  {isGerman ? "Optionaler Kontext" : "Optional context"}
                </p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--gv-text-muted)] sm:hidden">
                  {isGerman
                    ? "Setup- und Verlaufsinfos nur für die Ursachenabwägung."
                    : "Setup and history details only refine the reasoning."}
                </p>
                <p className="mt-1 hidden text-xs leading-5 text-[color:var(--gv-text-muted)] sm:block">
                  {isGerman
                    ? "Foto-Hinweise bleiben im Bildschritt. Setup- und Verlaufsinfos fließen nur in die Ursachenabwägung ein."
                    : "Photo notes stay in the image step. Setup and history notes are used only for reasoning."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <span className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--gv-text-muted)] sm:inline">
                  {isGerman ? "Aufklappen" : "Expand"}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--gv-lime)] sm:px-3 sm:text-[11px] sm:tracking-[0.16em]">
                  {optionalInputCount > 0
                    ? isGerman
                      ? `${optionalInputCount} Angaben`
                      : `${optionalInputCount} entries`
                    : isGerman
                      ? "Optional"
                      : "Optional"}
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 transition duration-200 group-open:rotate-180 group-open:border-[color:var(--gv-lime)]/30 group-open:bg-[color:var(--gv-lime)]/10 sm:h-10 sm:w-10">
                  <ChevronDownIcon className="h-4 w-4 text-[color:var(--gv-lime)]" />
                </span>
              </div>
            </div>
          </summary>
          <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-open:grid-rows-[1fr]">
            <div className="overflow-hidden">
              <div className="translate-y-[-8px] border-t border-white/8 px-4 pb-4 pt-3 opacity-0 transition duration-300 ease-out group-open:translate-y-0 group-open:opacity-100 sm:px-5 sm:pb-5 sm:pt-4">
                <p className="text-xs leading-5 text-[color:var(--gv-text-muted)]">
                  {isGerman
                    ? "Bitte nur Pflanzenbilder hochladen und keine Gesichter, Etiketten oder persönliche Details."
                    : "Upload plant photos only and avoid faces, labels, or other personal details."}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-[color:var(--gv-text)]">
                    <span className="mb-1 block text-xs text-[color:var(--gv-text-muted)]">
                      {isGerman ? "Medium" : "Medium"}
                    </span>
                    <select
                      value={analysisContext.medium ?? ""}
                      onChange={(event) =>
                        onContextChange(
                          "medium",
                          event.target.value || undefined,
                        )
                      }
                      className="gv-input w-full rounded-[16px] px-3 py-2"
                    >
                      <option value="">
                        {isGerman ? "Nicht angegeben" : "Not set"}
                      </option>
                      <option value="soil">Soil</option>
                      <option value="coco">Coco</option>
                      <option value="hydro">Hydro</option>
                      <option value="unknown">
                        {isGerman ? "Unklar" : "Unknown"}
                      </option>
                    </select>
                  </label>
                  <label className="text-sm text-[color:var(--gv-text)]">
                    <span className="mb-1 block text-xs text-[color:var(--gv-text-muted)]">
                      {isGerman ? "Phase" : "Stage"}
                    </span>
                    <select
                      value={analysisContext.growthStage ?? ""}
                      onChange={(event) =>
                        onContextChange(
                          "growthStage",
                          event.target.value || undefined,
                        )
                      }
                      className="gv-input w-full rounded-[16px] px-3 py-2"
                    >
                      <option value="">
                        {isGerman ? "Nicht angegeben" : "Not set"}
                      </option>
                      <option value="seedling">
                        {isGerman ? "Sämling" : "Seedling"}
                      </option>
                      <option value="veg">Veg</option>
                      <option value="early_flower">
                        {isGerman ? "Frühe Blüte" : "Early flower"}
                      </option>
                      <option value="late_flower">
                        {isGerman ? "Späte Blüte" : "Late flower"}
                      </option>
                      <option value="unknown">
                        {isGerman ? "Unklar" : "Unknown"}
                      </option>
                    </select>
                  </label>
                  <label className="text-sm text-[color:var(--gv-text)]">
                    <span className="mb-1 block text-xs text-[color:var(--gv-text-muted)]">
                      pH
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      value={analysisContext.ph ?? ""}
                      onChange={(event) =>
                        onContextChange(
                          "ph",
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                      className="gv-input w-full rounded-[16px] px-3 py-2"
                    />
                  </label>
                  <label className="text-sm text-[color:var(--gv-text)]">
                    <span className="mb-1 block text-xs text-[color:var(--gv-text-muted)]">
                      EC
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      value={analysisContext.ec ?? ""}
                      onChange={(event) =>
                        onContextChange(
                          "ec",
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                      className="gv-input w-full rounded-[16px] px-3 py-2"
                    />
                  </label>
                  <label className="text-sm text-[color:var(--gv-text)]">
                    <span className="mb-1 block text-xs text-[color:var(--gv-text-muted)]">
                      {isGerman ? "Temperatur C" : "Temperature C"}
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      value={analysisContext.temperatureC ?? ""}
                      onChange={(event) =>
                        onContextChange(
                          "temperatureC",
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                      className="gv-input w-full rounded-[16px] px-3 py-2"
                    />
                  </label>
                  <label className="text-sm text-[color:var(--gv-text)]">
                    <span className="mb-1 block text-xs text-[color:var(--gv-text-muted)]">
                      {isGerman ? "Luftfeuchte %" : "Humidity %"}
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      value={analysisContext.humidityPercent ?? ""}
                      onChange={(event) =>
                        onContextChange(
                          "humidityPercent",
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                      className="gv-input w-full rounded-[16px] px-3 py-2"
                    />
                  </label>
                  <label className="text-sm text-[color:var(--gv-text)]">
                    <span className="mb-1 block text-xs text-[color:var(--gv-text-muted)]">
                      {isGerman ? "Lichtabstand cm" : "Light distance cm"}
                    </span>
                    <input
                      type="number"
                      step="1"
                      value={analysisContext.lightDistanceCm ?? ""}
                      onChange={(event) =>
                        onContextChange(
                          "lightDistanceCm",
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                      className="gv-input w-full rounded-[16px] px-3 py-2"
                    />
                  </label>
                  <label className="text-sm text-[color:var(--gv-text)]">
                    <span className="mb-1 block text-xs text-[color:var(--gv-text-muted)]">
                      {isGerman ? "Lichttyp" : "Light type"}
                    </span>
                    <input
                      type="text"
                      value={analysisContext.lightType ?? ""}
                      onChange={(event) =>
                        onContextChange("lightType", event.target.value)
                      }
                      className="gv-input w-full rounded-[16px] px-3 py-2"
                    />
                  </label>
                  <label className="text-sm text-[color:var(--gv-text)] sm:col-span-2">
                    <span className="mb-1 block text-xs text-[color:var(--gv-text-muted)]">
                      {isGerman ? "Raum / Zeltgröße" : "Tent or room size"}
                    </span>
                    <input
                      type="text"
                      value={analysisContext.tentOrRoomSize ?? ""}
                      onChange={(event) =>
                        onContextChange("tentOrRoomSize", event.target.value)
                      }
                      className="gv-input w-full rounded-[16px] px-3 py-2"
                    />
                  </label>
                  <label className="text-sm text-[color:var(--gv-text)] sm:col-span-2">
                    <span className="mb-1 block text-xs text-[color:var(--gv-text-muted)]">
                      {isGerman ? "Gießrhythmus" : "Watering cadence"}
                    </span>
                    <input
                      type="text"
                      value={analysisContext.wateringCadence ?? ""}
                      onChange={(event) =>
                        onContextChange("wateringCadence", event.target.value)
                      }
                      className="gv-input w-full rounded-[16px] px-3 py-2"
                    />
                  </label>
                </div>
                {contextSummary.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {contextSummary.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-[color:var(--gv-text-muted)]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 grid gap-3">
                  <label className="text-sm text-[color:var(--gv-text)]">
                    <span className="mb-1 block text-xs text-[color:var(--gv-text-muted)]">
                      {isGerman ? "Bildnotiz" : "Photo note"}
                    </span>
                    <textarea
                      value={visualNotes}
                      onChange={(event) =>
                        onVisualNotesChange(event.target.value)
                      }
                      placeholder={
                        isGerman
                          ? "Nur sichtbare Hinweise notieren, z. B. 'oben rechts betroffen'."
                          : "Visible hints only, for example 'top-right leaf is affected'."
                      }
                      rows={3}
                      className="gv-input min-h-[76px] w-full resize-y rounded-[20px] px-4 py-3 text-sm leading-6 text-[color:var(--gv-text)] [color-scheme:dark] caret-[color:var(--gv-text)] outline-none transition placeholder:text-[color:var(--gv-text-muted)] focus:border-[color:var(--gv-lime)]/55 focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/18 sm:min-h-[88px]"
                    />
                  </label>
                  <label className="text-sm text-[color:var(--gv-text)]">
                    <span className="mb-1 block text-xs text-[color:var(--gv-text-muted)]">
                      {isGerman
                        ? "Verlauf / Grow-Kontext"
                        : "History / grow context"}
                    </span>
                    <textarea
                      value={growContextNotes}
                      onChange={(event) =>
                        onGrowContextNotesChange(event.target.value)
                      }
                      placeholder={
                        isGerman
                          ? "Zeitlicher Verlauf, letzte Änderungen oder bekannte Messwerte ergänzen."
                          : "Add timing, recent changes, or known measurements."
                      }
                      rows={4}
                      className="gv-input min-h-[92px] w-full resize-y rounded-[20px] px-4 py-3 text-sm leading-6 text-[color:var(--gv-text)] [color-scheme:dark] caret-[color:var(--gv-text)] outline-none transition placeholder:text-[color:var(--gv-text-muted)] focus:border-[color:var(--gv-lime)]/55 focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/18 sm:min-h-[112px]"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </details>

        <div className="mt-3 flex flex-col gap-3 sm:mt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {uploadTips.map((tip) => (
              <span
                key={tip}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-[color:var(--gv-text-muted)] sm:px-3 sm:text-xs"
              >
                {tip}
              </span>
            ))}
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={onAnalyze}
              disabled={
                !imagePreview ||
                isPreparingImage ||
                status === "loading" ||
                (!testMode && effectiveSessionStatus === "loading") ||
                freeAnalysisUsed
              }
              className={`group relative inline-flex min-h-12 w-full items-center justify-center overflow-hidden rounded-2xl border border-[color:var(--gv-lime)]/50 bg-[color:var(--gv-lime)] px-5 py-3 text-sm font-semibold text-[color:var(--gv-forest)] shadow-[0_14px_30px_rgba(228,197,108,0.18)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(228,197,108,0.24)] active:translate-y-0 active:scale-[0.99] sm:w-auto disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-[color:var(--gv-muted)] disabled:text-black/45 disabled:shadow-none ${darkFocusRing}`}
            >
              <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.28)_18%,transparent_36%)] opacity-70 transition-transform duration-700 group-hover:translate-x-[160%] group-hover:opacity-100" />
              <span className="relative z-10 inline-flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/55 ring-1 ring-black/5 transition group-hover:scale-105">
                  <ArrowUpTrayIcon className="h-4 w-4" />
                </span>
                <span>
                  {isPreparingImage
                    ? isGerman
                      ? "Bild wird vorbereitet ..."
                      : "Preparing image ..."
                    : status === "loading"
                      ? isGerman
                        ? "Analyse läuft ..."
                        : "Analyzing ..."
                      : testMode
                        ? isGerman
                          ? hasLoadedTestResult
                            ? "Neue Testanalyse starten"
                            : "Testanalyse starten"
                          : hasLoadedTestResult
                            ? "Start new test analysis"
                            : "Start test analysis"
                        : !isAuthenticated
                          ? isGerman
                            ? "Anmelden für Analyse"
                          : "Sign in to analyze"
                        : freeAnalysisUsed
                          ? isGerman
                            ? "Freie Analysen verbraucht"
                            : "Free analyses used up"
                          : isGerman
                            ? "Foto analysieren"
                            : "Analyze photo"}
                </span>
              </span>
            </button>
            {status === "loading" ? (
              <button
                type="button"
                onClick={onCancelAnalysis}
                className={`inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-[color:var(--gv-text)] transition hover:border-[color:var(--gv-lime)]/30 hover:bg-[color:var(--gv-lime)]/8 sm:w-auto ${darkFocusRing}`}
              >
                <XMarkIcon className="mr-2 h-4 w-4" />
                {isGerman ? "Abbrechen" : "Cancel"}
              </button>
            ) : null}
          </div>
        </div>

        {isPreparingImage && loadingMessage ? (
          <p
            aria-live="polite"
            className="mt-3 text-xs text-[color:var(--gv-lime)]/80 sm:text-sm"
          >
            {loadingMessage}
          </p>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {testMode ? (
          <div className="mt-3 rounded-[22px] border border-[color:var(--gv-lime)]/24 bg-[color:var(--gv-lime)]/10 px-4 py-3 text-sm leading-5 text-[color:var(--gv-text)] sm:leading-6">
            <p className="font-semibold text-[color:var(--gv-lime)]">
              {isGerman ? "Analyzer-Testmodus" : "Analyzer test mode"}
            </p>
            <p className="mt-1 text-[color:var(--gv-text-muted)]">
              {isGerman
                ? "Diese Testseite verbraucht keine Credits, umgeht das 24h-Limit, speichert keine Analyse im Verlauf und startet bereits mit einem Demo-Report."
                : "This test page does not consume credits, skips the 24h limit, does not save analyses to history, and starts with a demo report."}
            </p>
          </div>
        ) : isAuthenticated ? (
          <div className="mt-3 rounded-[22px] border border-white/8 bg-black/20 px-4 py-3 text-sm leading-6 text-[color:var(--gv-text-muted)]">
            <p className="font-semibold text-[color:var(--gv-text)]">
              {isPrivilegedUser
                ? isGerman
                  ? "Unbegrenzte Analysen aktiv"
                  : "Unlimited analyses enabled"
                : freeAnalysisUsed
                  ? isGerman
                    ? "24h-Limit erreicht"
                    : "Free analyses used up"
                  : isGerman
                    ? `${freeAnalysesRemaining} kostenlose Analysen in den nächsten 24h verfügbar`
                    : `${freeAnalysesRemaining} free analyses available in the next 24h`}
            </p>
            <p className="mt-1">
              {isPrivilegedUser
                ? isGerman
                  ? "Dein Konto ist als Admin oder Staff freigeschaltet und kann beliebig viele Bilder analysieren."
                  : "Your account is unlocked as admin or staff and can analyze as many images as needed."
                : isGerman
                  ? "Mit deinem Konto werden Analysen gespeichert und später im Verlauf wieder geladen."
                  : "With your account, analyses are saved and can be reopened in your history later."}
            </p>
          </div>
        ) : hasHydrated && effectiveSessionStatus !== "loading" ? (
          <div className="mt-3 rounded-[22px] border border-white/8 bg-black/20 px-4 py-3.5 text-sm leading-5 text-[color:var(--gv-text-muted)] sm:rounded-[24px] sm:px-5 sm:py-4 sm:leading-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-lime)]">
                  {isGerman ? "Login erforderlich" : "Login required"}
                </div>
                <p className="mt-3 text-base font-semibold text-[color:var(--gv-text)] sm:text-[1.05rem]">
                  {isGerman ? "Bitte kurz anmelden" : "Please sign in"}
                </p>
                <p className="mt-1 text-sm leading-5 text-[color:var(--gv-text-muted)] sm:leading-6">
                  {isGerman
                    ? `Mit deinem ${SITE_NAME} Konto bleibt der Verlauf gespeichert und du kannst direkt starten.`
                    : `With a ${SITE_NAME} account your analyses stay saved and you can start right away.`}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:min-w-[260px] sm:flex-row sm:justify-end">
                <Link
                  href={`/auth/signin?returnTo=${encodeURIComponent(pathname || PLANT_ANALYZER_PATH)}`}
                  className={`inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[color:var(--gv-lime)] px-4 py-2.5 text-sm font-semibold text-[color:var(--gv-forest)] transition sm:w-auto ${lightFocusRing}`}
                >
                  {isGerman ? "Anmelden" : "Sign in"}
                </Link>
                <Link
                  href={`/auth/register?returnTo=${encodeURIComponent(pathname || PLANT_ANALYZER_PATH)}`}
                  className={`inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 py-2.5 text-sm font-semibold text-[color:var(--gv-text)] transition hover:border-[color:var(--gv-lime)]/35 hover:bg-[color:var(--gv-surface)] sm:w-auto ${lightFocusRing}`}
                >
                  {isGerman ? "Registrieren" : "Register"}
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-3 rounded-[22px] border border-amber-400/20 bg-amber-400/10 px-3.5 py-2.5 text-sm text-amber-100 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-black/20 text-amber-200">
              <ExclamationTriangleIcon className="h-4.5 w-4.5" />
            </div>
            <p className="leading-5 sm:leading-6">
              {isGerman
                ? "Nur Ersteinschätzung. Wichtiges bitte selbst prüfen."
                : "This is only a cautious AI first assessment. Double-check important decisions yourself."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PlantAnalyzerResultSection({
  sectionRef,
  locale,
  status,
  result,
  imagePreview,
  loadingMessage,
  loadingSteps,
  loadingStepIndex,
  onCancelAnalysis,
  shoppingListStatus,
  shoppingListMessage,
  onAddShoppingList,
  surface = "page",
}: {
  sectionRef: React.RefObject<HTMLElement | null>;
  locale: Locale;
  status: AnalyzerStatus;
  result: AnalyzerResponse | null;
  imagePreview: string | null;
  loadingMessage: string | null;
  loadingSteps: LoadingStep[];
  loadingStepIndex: number;
  onCancelAnalysis: () => void;
  shoppingListStatus: AsyncStatus;
  shoppingListMessage: string | null;
  onAddShoppingList: () => void;
  surface?: "page" | "modal";
}) {
  const isGerman = locale === "de";
  const showAnalysisPanel = status === "loading" || result !== null;
  const primaryIssue = result?.diagnosis.issues[0] ?? null;
  const firstCareStep = result?.remediation.careSteps[0] ?? null;
  const heroSymptoms =
    result?.remediation.detectedSymptoms.length
      ? result.remediation.detectedSymptoms
      : result?.observedSymptoms ?? [];
  const featuredProducts = result
    ? Array.from(
        new Map(
          [
            ...result.productSuggestions,
            ...result.remediation.productBundle.optionalProducts,
            ...result.remediation.productBundle.setupHelpers,
          ].map((product) => [product.id, product]),
        ).values(),
      ).slice(0, 4)
    : [];
  const compactCauses = result?.possibleCauses.slice(0, 2) ?? [];
  const compactChecks = result?.verificationChecks.slice(0, 3) ?? [];
  const hasShoppableProducts = result
    ? result.remediation.productBundle.optionalProducts.length > 0 ||
      result.remediation.productBundle.setupHelpers.length > 0
    : false;

  if (!showAnalysisPanel) {
    return null;
  }

  const isModalSurface = surface === "modal";
  const sectionClasses = isModalSurface
    ? "w-full overflow-hidden rounded-[28px] p-0"
    : "gv-panel w-full overflow-hidden rounded-[32px] p-4 sm:p-6";
  const loadingPanelClasses = isModalSurface
    ? "rounded-[24px] border border-[color:var(--gv-border)] bg-[linear-gradient(135deg,rgba(228,197,108,0.08)_0%,rgba(14,10,9,0.98)_36%,rgba(24,16,13,0.98)_100%)] px-4 py-6 text-[color:var(--gv-text)] sm:px-6 sm:py-8"
    : "rounded-[28px] border border-[color:var(--gv-border)] bg-[linear-gradient(135deg,rgba(228,197,108,0.12)_0%,rgba(14,10,9,0.98)_36%,rgba(24,16,13,0.98)_100%)] px-4 py-6 text-[color:var(--gv-text)] shadow-[0_24px_60px_rgba(0,0,0,0.24)] sm:px-6 sm:py-8";
  const heroPanelClasses = isModalSurface
    ? resultHeroClasses(result?.diagnosis.healthStatus ?? "warning").replace(
        / shadow-\[[^\]]+\]/g,
        "",
      )
    : resultHeroClasses(result?.diagnosis.healthStatus ?? "warning");
  const resultContentSpacing = isModalSurface
    ? "space-y-3 sm:space-y-4"
    : "space-y-4 sm:space-y-5";
  const heroGridClasses = isModalSurface
    ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] xl:items-start"
    : "grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] xl:items-start";
  const lowerGridClasses = isModalSurface
    ? "grid gap-3 lg:grid-cols-2 xl:items-start"
    : "grid gap-4 xl:grid-cols-2 xl:items-start";
  const deepGridClasses = isModalSurface
    ? "grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start [content-visibility:auto] [contain-intrinsic-size:900px]"
    : "grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start [content-visibility:auto] [contain-intrinsic-size:900px]";

  return (
    <section ref={sectionRef} className={sectionClasses}>
      {status === "loading" ? (
        <div className={loadingPanelClasses}>
          <div className="mb-4 inline-flex items-center rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--gv-lime)] backdrop-blur-sm">
            {isGerman ? "Live-Analyse" : "Live analysis"}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-[family:var(--font-jetbrains-mono)] text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--gv-lime)]">
                {isGerman ? "Analyse läuft" : "Analysis running"}
              </p>
              <h3 className="mt-2 font-[family:var(--font-syne)] text-3xl font-bold tracking-[-0.05em]">
                {isGerman
                  ? "Wir lesen gerade das Foto und bereiten den Befund vor"
                  : "We are checking your plant photo"}
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[color:var(--gv-text-muted)]">
                {isGerman
                  ? "Du bekommst danach direkt die wahrscheinlichsten Probleme, die Confidence-Einschätzung und die nächsten sinnvollen Checks."
                  : "The image is being reviewed, likely issues, next steps and product hints are being prepared."}
              </p>
              {loadingMessage ? (
                <p
                  aria-live="polite"
                  className="mt-3 text-xs text-[color:var(--gv-lime)]/80 sm:text-sm"
                >
                  {loadingMessage}
                </p>
              ) : null}
            </div>
            <div className="w-fit rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] p-3 text-[color:var(--gv-lime)] shadow-[0_12px_30px_rgba(0,0,0,0.12)] backdrop-blur-sm">
              <BeakerIcon className="h-7 w-7 animate-pulse" />
            </div>
          </div>
          <div className="mt-6 grid gap-3">
            {loadingSteps.map((step, index) => {
              const isActive = loadingStepIndex === index;

              return (
                <div
                  key={step.title}
                  className={`rounded-2xl border px-4 py-4 transition duration-500 ${
                    isActive
                      ? "translate-y-[-2px] border-[color:var(--gv-lime)]/28 bg-[color:var(--gv-surface)] shadow-[0_12px_28px_rgba(0,0,0,0.16)]"
                      : "border-[color:var(--gv-border)] bg-black/15"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex h-3.5 w-3.5 items-center justify-center">
                      <div
                        className={`absolute inset-0 rounded-full ${
                          isActive ? "animate-ping opacity-60" : "opacity-25"
                        }`}
                        style={{ backgroundColor: step.color }}
                      />
                      <div
                        className="relative h-3 w-3 rounded-full"
                        style={{ backgroundColor: step.color }}
                      />
                    </div>
                    <p className="text-sm font-semibold">{step.title}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] sm:ml-auto ${
                        isActive
                          ? "bg-white/16 text-[#f5e8bc]"
                          : "bg-white/8 text-white/55"
                      }`}
                    >
                      {index < loadingStepIndex
                        ? isGerman
                          ? "Fertig"
                          : "Done"
                        : isActive
                          ? isGerman
                            ? "Aktiv"
                            : "Active"
                          : isGerman
                            ? "Wartet"
                            : "Queued"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--gv-text-muted)]">
                    {step.detail}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between font-[family:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
              <span>{isGerman ? "Fortschritt" : "Progress"}</span>
              <span>
                {Math.round(
                  ((loadingStepIndex + 1) / loadingSteps.length) * 100,
                )}
                %
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--gv-surface)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[color:var(--gv-lime)] via-[#f3d7a4] to-[color:var(--gv-lime)] shadow-[0_0_18px_rgba(228,197,108,0.35)] transition-all duration-700"
                style={{
                  width: `${((loadingStepIndex + 1) / loadingSteps.length) * 100}%`,
                }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelAnalysis}
            className={`relative z-10 mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-4 py-3 text-sm font-semibold text-[color:var(--gv-text)] transition hover:border-[color:var(--gv-lime)]/30 hover:bg-[color:var(--gv-lime)]/8 sm:w-auto ${darkFocusRing}`}
          >
            <XMarkIcon className="mr-2 h-4 w-4" />
            {isGerman ? "Analyse abbrechen" : "Cancel analysis"}
          </button>
        </div>
      ) : result ? (
        <div className={resultContentSpacing}>
          <div
            className={`rounded-[24px] border px-3.5 py-3.5 sm:rounded-[26px] sm:px-5 sm:py-4 ${heroPanelClasses}`}
          >
            <div className={heroGridClasses}>
              <div className="space-y-3">
                <div className="max-w-3xl">
                  <p className="font-[family:var(--font-jetbrains-mono)] text-xs font-semibold uppercase tracking-[0.2em] text-white/62">
                    {isGerman ? "Ersteinschätzung" : "First read"}
                  </p>
                  <h3
                    className={`mt-2 font-[family:var(--font-syne)] text-[1.65rem] font-bold leading-[0.94] tracking-[-0.05em] sm:text-[2.15rem] sm:leading-none ${resultHeroAccentClasses(
                      result.diagnosis.healthStatus,
                    )}`}
                  >
                    {primaryIssue?.label ??
                      healthStatusLabel(result.diagnosis.healthStatus, locale)}
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-5 text-white/72 sm:leading-6">
                    {result.summary ||
                      firstCareStep?.detail ||
                      result.remediation.uncertaintyNote}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-sm font-semibold text-white">
                      {result.diagnosis.species ||
                        (isGerman ? "Unbekannt" : "Unknown")}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-sm font-semibold text-white">
                      {confidenceBandLabel(result.confidenceBand, locale)}
                    </span>
                    <span className="rounded-full border border-white/12 bg-black/20 px-3 py-1 text-sm font-semibold text-white">
                      {urgencyLabel(result.remediation.urgency, locale)}
                    </span>
                    {result.needsHumanReview ? (
                      <span className="rounded-full border border-[#f0e1a2]/20 bg-[#f0e1a2]/10 px-3 py-1 text-sm font-semibold text-[#f0e1a2]">
                        {isGerman ? "Review empfohlen" : "Review recommended"}
                      </span>
                    ) : null}
                  </div>
                </div>

                {heroSymptoms.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {heroSymptoms.slice(0, 4).map((symptom) => (
                      <span
                        key={symptom}
                        className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-medium text-white/88 sm:px-3 sm:text-xs"
                      >
                        {compactAnalyzerLabel(symptom)}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-white/10 bg-white/6 px-3 py-2.5 sm:px-3.5 sm:py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                      {isGerman ? "Gefunden" : "Found"}
                    </p>
                    <p className="mt-1.5 text-[1.75rem] font-bold text-white sm:mt-2 sm:text-2xl">
                      {result.diagnosis.issues.length}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-white/10 bg-white/6 px-3 py-2.5 sm:px-3.5 sm:py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                      {isGerman ? "Jetzt zuerst" : "Start with"}
                    </p>
                    <p className="mt-1.5 text-sm font-semibold leading-5 text-white sm:mt-2">
                      {firstCareStep?.title ||
                        result.remediation.monitoringWindow.label}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[168px_minmax(0,1fr)] xl:grid-cols-[168px_minmax(0,1fr)]">
                <ConfidenceDial
                  locale={locale}
                  confidence={result.diagnosis.confidence}
                  confidenceBand={result.confidenceBand}
                />
                <div className="overflow-hidden rounded-[22px] border border-white/10 bg-black/18 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                        {isGerman ? "Bild" : "Image"}
                      </p>
                      <p className="mt-1 text-sm text-white/74">
                        {primaryIssue?.label ??
                          healthStatusLabel(result.diagnosis.healthStatus, locale)}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
                      {confidenceLabel(result.diagnosis.confidence)}
                    </span>
                  </div>
                  <div className="mt-3 overflow-hidden rounded-[18px] border border-white/10 bg-white/6 p-2">
                    {imagePreview ? (
                      <div className="relative mx-auto aspect-[4/5] w-full max-w-[156px] overflow-hidden rounded-[16px] border border-white/10 bg-white/6 sm:max-w-[176px]">
                        <UploadedPlantImage
                          src={imagePreview}
                          alt={
                            isGerman
                              ? "Analysiertes Pflanzenfoto"
                              : "Analyzed plant photo"
                          }
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-[4/5] w-full items-center justify-center rounded-[16px] border border-white/10 bg-white/6 text-white/40">
                        <PhotoIcon className="h-7 w-7" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={lowerGridClasses}>
            <div className="gv-glass self-start rounded-[22px] px-4 py-4 sm:px-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-lime)]">
                {isGerman ? "Was gefunden wurde" : "What was found"}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-[color:var(--gv-text)]">
                {primaryIssue?.label ??
                  healthStatusLabel(result.diagnosis.healthStatus, locale)}
              </h3>
              <div className="mt-4 grid gap-3">
                {result.diagnosis.issues.length > 0 ? (
                  result.diagnosis.issues.map((issue) => (
                    <div
                      key={issue.id}
                      className={`rounded-[18px] border px-4 py-3.5 shadow-sm ${severityCardClasses(
                        issue.severity,
                      )}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-base font-semibold text-white">
                            {issue.label}
                          </p>
                          <p className="mt-1 text-sm text-white/66">
                            {severityLabel(issue.severity, locale)}
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-semibold text-white/86">
                          {confidencePercent(issue.confidence)}%
                        </span>
                      </div>
                      <InlineConfidenceBar
                        value={issue.confidence}
                        locale={locale}
                      />
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 py-4 text-sm text-[color:var(--gv-text-muted)]">
                    {isGerman
                      ? "Kein klarer Befund erkannt."
                      : "No clear finding detected."}
                  </div>
                )}
              </div>
              {heroSymptoms.length > 0 ? (
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                    {isGerman ? "Sichtbare Symptome" : "Visible symptoms"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {heroSymptoms.slice(0, 5).map((symptom) => (
                      <span
                        key={symptom}
                        className="rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-3 py-1.5 text-sm text-[color:var(--gv-text)]"
                      >
                        {compactAnalyzerLabel(symptom)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="gv-glass self-start rounded-[22px] px-4 py-4 sm:px-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-lime)]">
                {isGerman ? "Was du jetzt tun kannst" : "What to do now"}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-[color:var(--gv-text)]">
                {isGerman ? "Nächste sinnvolle Schritte" : "Next useful steps"}
              </h3>
              <div className="mt-4 space-y-3">
                {result.remediation.careSteps.slice(0, 3).map((step, index) => (
                  <div
                    key={step.id}
                    className="rounded-[18px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 py-3.5"
                  >
                    <div className="flex gap-3">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--gv-lime)] text-xs font-bold text-[color:var(--gv-forest)]">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[color:var(--gv-text)]">
                          {step.title}
                        </p>
                        <p className="mt-1 text-sm leading-5 text-[color:var(--gv-text-muted)]">
                          {step.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[18px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                    {isGerman ? "Recheck" : "Recheck"}
                  </p>
                  <span className="inline-flex items-center rounded-full border border-[color:var(--gv-border)] bg-black/10 px-3 py-1 text-xs font-semibold text-[color:var(--gv-lime)]">
                    <ClockIcon className="mr-1.5 h-3.5 w-3.5" />
                    {result.remediation.monitoringWindow.label}
                  </span>
                </div>
                <p className="mt-2.5 text-sm leading-5 text-[color:var(--gv-text)]">
                  {result.remediation.monitoringWindow.summary}
                </p>
              </div>
            </div>
          </div>

          <div className="gv-glass gv-section-auto rounded-[22px] px-4 py-4 sm:px-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-lime)]">
              {isGerman
                ? "Optionale Produkte, keine automatische Diagnose"
                : "Optional products, not an automatic diagnosis"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--gv-text-muted)]">
              {featuredProducts.length > 0
                ? `${result.remediation.productBundle.summary} ${
                    isGerman
                      ? "Bitte erst die Checks oben abgleichen und nur bewusst hinzufügen."
                      : "Run the checks above first and add products deliberately."
                  }`
                : isGerman
                  ? "Für diesen Fall wurden noch keine direkten Produktkarten gefunden. Prüfe zuerst die Schritte oben."
                  : "No direct product picks were found for this case yet. Start with the checks above first."}
            </p>
            <div className="mt-3">
              <ProductSuggestionGrid
                locale={locale}
                productSuggestions={featuredProducts}
                surface={surface}
              />
            </div>
            {hasShoppableProducts || result.remediation.setupAdjustmentPath ? (
              <div className="mt-3 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={onAddShoppingList}
                  disabled={
                    shoppingListStatus === "loading" || !hasShoppableProducts
                  }
                  className={`inline-flex min-h-10 items-center justify-center rounded-[18px] border px-4 py-2 text-sm font-semibold transition ${lightFocusRing} ${
                    shoppingListStatus === "loading"
                      ? "border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] text-[color:var(--gv-text-muted)]"
                      : "border-[color:var(--gv-lime)]/28 bg-[color:var(--gv-lime)]/10 text-[color:var(--gv-lime)]"
                  }`}
                >
                  {isGerman
                    ? "Produkte vormerken"
                    : "Save product shortlist"}
                </button>
                {result.remediation.setupAdjustmentPath ? (
                  <Link
                    href={result.remediation.setupAdjustmentPath.href}
                    className={`inline-flex min-h-10 items-center justify-center rounded-[18px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 py-2 text-sm font-semibold text-[color:var(--gv-text)] transition hover:border-[color:var(--gv-lime)]/30 ${lightFocusRing}`}
                  >
                    {isGerman ? "Setup prüfen" : "Check setup"}
                  </Link>
                ) : null}
              </div>
            ) : null}
            {shoppingListMessage ? (
              <p className="mt-3 text-sm text-[color:var(--gv-text-muted)]">
                {shoppingListMessage}
              </p>
            ) : null}
          </div>

          <div className={deepGridClasses}>
            <div className="gv-glass self-start rounded-[22px] px-4 py-4 sm:px-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-lime)]">
                {isGerman ? "Mögliche Ursachen" : "Possible causes"}
              </p>
              <div className="mt-3 grid gap-3">
                {compactCauses.length > 0 ? (
                  compactCauses.map((cause) => (
                    <div
                      key={cause.label}
                      className="rounded-[18px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 py-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-base font-semibold text-[color:var(--gv-text)]">
                          {cause.label}
                        </p>
                        <span className="text-sm font-semibold text-[#f0d4a0]">
                          {confidencePercent(cause.confidence)}%
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--gv-text-muted)]">
                        {cause.whyThisFits}
                      </p>
                      <InlineConfidenceBar
                        value={cause.confidence}
                        locale={locale}
                        tone="soft"
                      />
                      {cause.whatCouldAlsoExplainIt ? (
                        <p className="mt-2 text-sm leading-6 text-[color:var(--gv-text-muted)]">
                          {cause.whatCouldAlsoExplainIt}
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 py-4 text-sm text-[color:var(--gv-text-muted)]">
                    {isGerman
                      ? "Keine wahrscheinlichen Ursachen vorhanden."
                      : "No likely causes available."}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 self-start">
              <div className="gv-glass rounded-[22px] px-4 py-4 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-lime)]">
                    {isGerman ? "Recheck" : "Recheck"}
                  </p>
                  <span className="inline-flex items-center rounded-full border border-[color:var(--gv-border)] bg-black/10 px-3 py-1 text-xs font-semibold text-[color:var(--gv-lime)]">
                    <ClockIcon className="mr-1.5 h-3.5 w-3.5" />
                    {result.followUp.recommendedRecheckWindowHoursMin}-
                    {result.followUp.recommendedRecheckWindowHoursMax}h
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[color:var(--gv-text)]">
                  {result.remediation.followUpPrompt.detail}
                </p>
                {compactChecks.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {compactChecks.map((check) => (
                      <div
                        key={check.id}
                        className="rounded-[16px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-3.5 py-3"
                      >
                        <p className="text-sm font-semibold text-[color:var(--gv-text)]">
                          {check.title}
                        </p>
                        <p className="mt-1 text-sm leading-5 text-[color:var(--gv-text-muted)]">
                          {check.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="gv-glass rounded-[22px] px-4 py-4 sm:px-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-lime)]">
                  {isGerman ? "Hinweis" : "Note"}
                </p>
                <p className="mt-3 text-sm leading-6 text-[color:var(--gv-text)]">
                  {result.uncertaintyNote}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function PlantAnalyzerHistorySection({
  locale,
  pathname,
  hasHydrated,
  effectiveSessionStatus,
  isAuthenticated,
  historyStatus,
  historyRequested,
  history,
  onLoadHistory,
  onOpenHistoryReport,
}: {
  locale: Locale;
  pathname: string | null;
  hasHydrated: boolean;
  effectiveSessionStatus: AnalyzerSessionStatus;
  isAuthenticated: boolean;
  historyStatus: AsyncStatus;
  historyRequested: boolean;
  history: AnalysisHistoryEntry[];
  onLoadHistory: () => void;
  onOpenHistoryReport: (entry: AnalysisHistoryEntry) => void;
}) {
  const isGerman = locale === "de";

  return (
    <section className="gv-panel overflow-hidden rounded-[28px] p-3.5 sm:rounded-[32px] sm:p-6">
        <div className="gv-glass relative rounded-[22px] px-4 py-3.5 sm:rounded-[24px] sm:px-5 sm:py-4">
          <div className="min-w-0 pr-16 sm:pr-20">
            <p className="font-[family:var(--font-jetbrains-mono)] text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--gv-lime)]">
              {isGerman ? "Analyseverlauf" : "Analysis history"}
            </p>
          <h2 className="mt-2 font-[family:var(--font-syne)] text-[2rem] font-bold leading-[0.92] tracking-[-0.05em] text-[color:var(--gv-text)] sm:text-3xl sm:leading-none">
            <span className="sm:hidden">
              {isGerman ? "Dein Pflanzenjournal" : "Your plant journal"}
            </span>
            <span className="hidden sm:inline">
              {isGerman
                ? "Dein persönliches Pflanzenjournal"
                : "Your personal plant journal"}
            </span>
          </h2>
          <p className="mt-2 text-sm leading-5 text-[color:var(--gv-text-muted)] sm:leading-6">
            {isGerman
              ? "Frühere Analysen bleiben sichtbar, damit du Symptome, Trends und Empfehlungen später ruhiger vergleichen kannst."
              : "Earlier analyses stay visible so you can compare symptoms, trends and recommendations more calmly later on."}
          </p>
        </div>
        <div className="absolute right-4 top-4 rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] p-2.5 text-[color:var(--gv-lime)] sm:right-5 sm:top-5 sm:p-3">
          <ClockIcon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
      </div>

      {!hasHydrated || effectiveSessionStatus === "loading" ? (
        <div className="gv-glass mt-4 rounded-[24px] px-4 py-7 text-sm text-[color:var(--gv-text-muted)] sm:mt-6 sm:px-6 sm:py-8">
          {isGerman ? "Verlauf wird geladen ..." : "Loading history ..."}
        </div>
      ) : !isAuthenticated ? (
        <div className="gv-glass mt-4 rounded-[24px] border-dashed px-4 py-7 text-center sm:mt-6 sm:px-6 sm:py-10">
          <UserCircleIcon className="mx-auto h-7 w-7 text-[color:var(--gv-text-muted)] sm:h-8 sm:w-8" />
          <p className="mt-3 text-base font-semibold text-[color:var(--gv-text)] sm:mt-4">
            {isGerman ? "Verlauf nach Login verfügbar" : "History after login"}
          </p>
          <p className="mt-2 text-sm leading-5 text-[color:var(--gv-text-muted)] sm:leading-6">
            {isGerman
              ? "Melde dich an, damit neue Analysen in deinem Verlauf gespeichert werden."
              : "Sign in so new analyses are saved to your history."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href={`/auth/signin?returnTo=${encodeURIComponent(pathname || PLANT_ANALYZER_PATH)}`}
              className={`inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[color:var(--gv-lime)] px-5 py-3 text-sm font-semibold text-[color:var(--gv-forest)] transition sm:w-auto ${lightFocusRing}`}
            >
              {isGerman ? "Anmelden" : "Sign in"}
            </Link>
            <Link
              href={`/auth/register?returnTo=${encodeURIComponent(pathname || PLANT_ANALYZER_PATH)}`}
              className={`inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-5 py-3 text-sm font-semibold text-[color:var(--gv-text)] transition hover:border-[color:var(--gv-lime)]/35 hover:bg-[color:var(--gv-surface)] sm:w-auto ${lightFocusRing}`}
            >
              {isGerman ? "Registrieren" : "Register"}
            </Link>
          </div>
        </div>
      ) : !historyRequested ? (
        <div className="gv-glass mt-4 rounded-[24px] px-4 py-6 text-center sm:mt-6 sm:px-6 sm:py-8">
          <p className="text-base font-semibold text-[color:var(--gv-text)]">
            {isGerman
              ? "Verlauf bei Bedarf laden"
              : "Load your history when you need it"}
          </p>
          <p className="mt-2 text-sm leading-5 text-[color:var(--gv-text-muted)] sm:leading-6">
            {isGerman
              ? "Der Verlauf wird nicht mehr direkt beim Seitenaufruf geladen. Öffne ihn erst, wenn du frühere Berichte vergleichen willst."
              : "History is no longer loaded on initial page view. Open it only when you want to compare previous reports."}
          </p>
          <button
            type="button"
            onClick={onLoadHistory}
            className={`mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[color:var(--gv-lime)] px-4 py-2.5 text-sm font-semibold text-[color:var(--gv-forest)] transition sm:w-auto ${lightFocusRing}`}
          >
            {isGerman ? "Verlauf laden" : "Load history"}
          </button>
        </div>
      ) : historyStatus === "loading" ? (
        <div className="gv-glass mt-4 rounded-[24px] px-4 py-7 text-sm text-[color:var(--gv-text-muted)] sm:mt-6 sm:px-6 sm:py-8">
          {isGerman ? "Verlauf wird geladen ..." : "Loading history ..."}
        </div>
      ) : historyStatus === "error" ? (
        <div className="mt-4 rounded-[24px] border border-red-500/20 bg-red-500/10 px-4 py-7 text-center sm:mt-6 sm:px-6 sm:py-8">
          <p className="text-base font-semibold text-red-100">
            {isGerman
              ? "Verlauf konnte nicht geladen werden"
              : "History could not be loaded"}
          </p>
          <button
            type="button"
            onClick={onLoadHistory}
            className={`mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-red-400/30 bg-black/15 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:bg-red-500/10 sm:w-auto ${lightFocusRing}`}
          >
            {isGerman ? "Erneut versuchen" : "Try again"}
          </button>
        </div>
      ) : history.length === 0 ? (
        <div className="gv-glass mt-4 rounded-[24px] border-dashed px-4 py-7 text-center sm:mt-6 sm:px-6 sm:py-10">
          <ClockIcon className="mx-auto h-7 w-7 text-[color:var(--gv-text-muted)] sm:h-8 sm:w-8" />
          <p className="mt-3 text-base font-semibold text-[color:var(--gv-text)] sm:mt-4">
            {isGerman
              ? "Noch keine gespeicherten Analysen"
              : "No saved analyses yet"}
          </p>
          <p className="mt-2 text-sm leading-5 text-[color:var(--gv-text-muted)] sm:leading-6">
            {isGerman
              ? "Sobald du ein Bild analysierst, erscheint es hier in deinem Verlauf."
              : "As soon as you analyze an image, it will appear here in your history."}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {history.map((entry) => (
            <div key={entry.id} className="gv-glass rounded-[26px] p-4 sm:p-5">
              <div className="flex flex-col gap-5 sm:flex-row">
                <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-[22px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] shadow-[0_10px_24px_rgba(0,0,0,0.12)] sm:h-28 sm:w-28">
                  {entry.imageUri ? (
                    <UploadedPlantImage
                      src={entry.imageUri}
                      alt={
                        isGerman
                          ? "Gespeichertes Pflanzenfoto"
                          : "Saved plant photo"
                      }
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-stone-300">
                      <PhotoIcon className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold tracking-tight text-[color:var(--gv-text)]">
                        {entry.species || (isGerman ? "Unbekannt" : "Unknown")}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--gv-text-muted)]">
                        {formatDate(entry.analyzedAt, locale)}
                      </p>
                    </div>
                    <span
                      className={`self-start rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${healthStatusClasses(
                        entry.healthStatus,
                      )}`}
                    >
                      {healthStatusLabel(entry.healthStatus, locale)}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {entry.issues.slice(0, 2).map((issue) => (
                      <div
                        key={issue.id}
                        className="rounded-[18px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-3 py-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold text-[color:var(--gv-text)]">
                              {issue.label}
                            </p>
                            <p className="mt-1 text-xs text-[color:var(--gv-text-muted)]">
                              {isGerman ? "Wahrscheinlichkeit" : "Likelihood"}{" "}
                              {confidenceLabel(issue.confidence)}
                            </p>
                          </div>
                          <span className="rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--gv-text)]">
                            {severityLabel(issue.severity, locale)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {entry.recommendations[0] ? (
                    <div className="mt-4 rounded-[18px] border border-[color:var(--gv-lime)]/20 bg-[color:var(--gv-lime)]/10 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--gv-lime)]">
                        {isGerman ? "Erster Schritt" : "First step"}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--gv-text)]">
                        {entry.recommendations[0]}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => onOpenHistoryReport(entry)}
                      className={`inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[color:var(--gv-lime)] px-4 py-3 text-sm font-semibold text-[color:var(--gv-forest)] transition ${lightFocusRing}`}
                    >
                      {isGerman
                        ? "Vollständigen Bericht öffnen"
                        : "Open full report"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function PlantAnalyzerAuthModal({
  locale,
  pathname,
  onClose,
}: {
  locale: Locale;
  pathname: string | null;
  onClose: () => void;
}) {
  const isGerman = locale === "de";
  const dialogTitleId = "plant-analyzer-auth-title";
  const dialogDescriptionId = "plant-analyzer-auth-description";

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:items-center sm:px-4 sm:pb-6 sm:pt-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label={isGerman ? "Schließen" : "Close"}
      />
      <div
        className="relative w-full max-w-sm max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1.5rem)] overflow-y-auto rounded-[28px] border border-[#d8dfd4] bg-[linear-gradient(180deg,#fffef9_0%,#ffffff_100%)] p-5 shadow-[0_30px_80px_rgba(15,23,42,0.30)] sm:rounded-3xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={isGerman ? "Schließen" : "Close"}
          className={`absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:bg-stone-100 hover:text-stone-900 ${lightFocusRing}`}
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
        <div className="mb-4 inline-flex items-center rounded-full border border-[#e4c56c]/45 bg-[#fff5da] px-3 py-1 text-xs font-semibold text-[#6e4521]">
          {isGerman ? "Analyse mit Verlauf" : "Analysis with history"}
        </div>
        <h3
          id={dialogTitleId}
          className="pr-12 text-xl font-semibold text-stone-900"
        >
          {isGerman
            ? "Bitte anmelden oder registrieren"
            : "Please sign in or register"}
        </h3>
        <p
          id={dialogDescriptionId}
          className="mt-2 text-sm leading-relaxed text-stone-500"
        >
          {isGerman
            ? `Damit deine Pflanzenanalysen gespeichert werden und im Verlauf sichtbar bleiben, brauchst du ein ${SITE_NAME} Konto.`
            : `You need a ${SITE_NAME} account so your plant analyses are saved and stay visible in your history.`}
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <Link
            href={`/auth/signin?returnTo=${encodeURIComponent(pathname || PLANT_ANALYZER_PATH)}`}
            onClick={onClose}
            className={`inline-flex w-full items-center justify-center rounded-2xl bg-[#2f3e36] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#24312b] ${lightFocusRing}`}
          >
            {isGerman ? "Anmelden" : "Sign in"}
          </Link>
          <Link
            href={`/auth/register?returnTo=${encodeURIComponent(pathname || PLANT_ANALYZER_PATH)}`}
            onClick={onClose}
            className={`inline-flex w-full items-center justify-center rounded-2xl border border-black/10 bg-white px-5 py-3.5 text-sm font-semibold text-stone-800 transition hover:border-black/20 hover:bg-stone-50 ${lightFocusRing}`}
          >
            {isGerman ? "Registrieren" : "Register"}
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`mt-4 w-full text-center text-xs text-stone-400 transition hover:text-stone-600 ${lightFocusRing}`}
        >
          {isGerman ? "Abbrechen" : "Cancel"}
        </button>
      </div>
    </div>
  );
}

export function PlantAnalyzerHistoryModal({
  locale,
  entry,
  detail,
  detailStatus,
  feedbackStatus,
  feedbackPendingType,
  feedbackMessage,
  shoppingListStatus,
  shoppingListMessage,
  publicationStatus,
  publicationMessage,
  publicationConsent,
  publicationImageConsent,
  onPublicationConsentChange,
  onPublicationImageConsentChange,
  onAddShoppingList,
  onFollowUpImproved,
  onFollowUpWorsened,
  onUseAsRecheckBaseline,
  onSubmitPublication,
  onClose,
}: {
  locale: Locale;
  entry: AnalysisHistoryEntry;
  detail: HistoryReportDetail | null;
  detailStatus: AsyncStatus;
  feedbackStatus: AsyncStatus;
  feedbackPendingType: PlantAnalyzerFeedbackClassification | null;
  feedbackMessage: string | null;
  shoppingListStatus: AsyncStatus;
  shoppingListMessage: string | null;
  publicationStatus: AsyncStatus;
  publicationMessage: string | null;
  publicationConsent: boolean;
  publicationImageConsent: boolean;
  onPublicationConsentChange: (value: boolean) => void;
  onPublicationImageConsentChange: (value: boolean) => void;
  onAddShoppingList: () => void;
  onFollowUpImproved: () => void;
  onFollowUpWorsened: () => void;
  onUseAsRecheckBaseline: () => void;
  onSubmitPublication: () => void;
  onClose: () => void;
}) {
  const isGerman = locale === "de";
  const dialogTitleId = "plant-analyzer-history-title";
  const historyResult = detail
    ? historyDetailToAnalyzerResponse(detail)
    : null;
  const diagnosis = historyResult?.diagnosis ?? null;
  const remediation = detail?.remediation ?? null;
  const guideSuggestions =
    remediation?.guideLinks && remediation.guideLinks.length > 0
      ? remediation.guideLinks
      : (detail?.guideSuggestions ?? []);
  const historyResultSectionRef = {
    current: null,
  } as React.RefObject<HTMLElement | null>;
  const reportTitle =
    diagnosis?.issues[0]?.label ??
    healthStatusLabel(
      diagnosis?.healthStatus ?? entry.healthStatus,
      locale,
    );
  const resultImagePreview = detail?.imageUri ?? entry.imageUri;

  return (
    <div className="fixed inset-0 z-[1100] overflow-y-auto overscroll-contain bg-black/82 px-0 pb-0 pt-0 sm:px-4 sm:pb-6 sm:pt-6">
      <button
        type="button"
        className="absolute inset-0 z-0"
        onClick={onClose}
        aria-label={isGerman ? "Schließen" : "Close"}
      />
      <div
        className="relative z-10 mx-auto flex h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none border-y border-[color:var(--gv-border)] bg-[linear-gradient(180deg,#101914_0%,#0a110d_100%)] text-[color:var(--gv-text)] shadow-none sm:my-6 sm:h-auto sm:max-h-[88dvh] sm:max-w-[1200px] sm:rounded-[30px] sm:border sm:shadow-[0_24px_80px_rgba(0,0,0,0.4)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
      >
        <div className="sticky top-0 z-20 border-b border-[color:var(--gv-border)] bg-[linear-gradient(135deg,rgba(22,56,45,0.98)_0%,rgba(12,24,19,0.99)_52%,rgba(7,14,11,1)_100%)] px-3 py-3 text-white sm:px-5 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-lime)]">
                {isGerman ? "Gespeicherter Bericht" : "Saved report"}
              </div>
              <h3
                id={dialogTitleId}
                className="mt-2.5 font-[family:var(--font-syne)] text-[1.55rem] font-bold leading-[0.94] tracking-[-0.05em] sm:mt-3 sm:text-[2.05rem]"
              >
                {reportTitle}
              </h3>
              <p className="mt-1.5 text-xs text-white/68 sm:mt-2 sm:text-sm">
                {formatDate(entry.analyzedAt, locale)}
              </p>
            </div>
            <div className="ml-2 flex shrink-0 items-center gap-1.5 self-start sm:gap-2">
              <div className="hidden items-center gap-2 sm:flex">
                <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-semibold text-white">
                  {confidenceBandLabel(
                    detail?.confidenceBand ?? entry.confidenceBand,
                    locale,
                  )}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${healthStatusClasses(
                    diagnosis?.healthStatus ?? entry.healthStatus,
                  )}`}
                >
                  {confidenceLabel(diagnosis?.confidence ?? entry.confidence)}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={isGerman ? "Schließen" : "Close"}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/10 text-white transition hover:bg-white/16 sm:h-10 sm:w-10 ${darkFocusRing}`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 sm:hidden">
            <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white">
              {confidenceBandLabel(
                detail?.confidenceBand ?? entry.confidenceBand,
                locale,
              )}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${healthStatusClasses(
                diagnosis?.healthStatus ?? entry.healthStatus,
              )}`}
            >
              {confidenceLabel(diagnosis?.confidence ?? entry.confidence)}
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 sm:px-4 sm:py-4">
          <div className="space-y-4">
            {detailStatus === "loading" ? (
              <div className="gv-panel rounded-[28px] p-4 sm:p-6">
                <div className="grid gap-4">
                  <div className="h-28 animate-pulse rounded-[24px] bg-white/6" />
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="h-56 animate-pulse rounded-[24px] bg-white/6" />
                    <div className="h-56 animate-pulse rounded-[24px] bg-white/6" />
                  </div>
                </div>
              </div>
            ) : detailStatus === "error" ? (
              <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 px-4 py-6 text-center text-red-100">
                <p className="text-base font-semibold">
                  {isGerman
                    ? "Bericht konnte nicht geladen werden"
                    : "Report could not be loaded"}
                </p>
                <p className="mt-2 text-sm text-red-200/90">
                  {isGerman
                    ? "Bitte schließe den Bericht und versuche es erneut."
                    : "Please close the report and try again."}
                </p>
              </div>
            ) : historyResult ? (
              <>
                {detail?.reviewedCase ? (
                  <div className="rounded-[24px] border border-[#d9c46b]/28 bg-[linear-gradient(135deg,rgba(228,197,108,0.16)_0%,rgba(255,248,220,0.06)_100%)] p-4 text-[color:var(--gv-text)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e4c56c]">
                      {isGerman ? "Interne Prüfung" : "Internal review"}
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {reviewedCaseLabel(detail.reviewedCase, locale)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--gv-text-muted)]">
                      {detail.reviewedCase.override?.resolutionNote ??
                        detail.reviewedCase.reviewNotes ??
                        (isGerman
                          ? "Dieser Bericht wurde später im Backoffice geprüft."
                          : "This report was later reviewed in the back office.")}
                    </p>
                  </div>
                ) : null}

                <PlantAnalyzerResultSection
                  sectionRef={historyResultSectionRef}
                  locale={locale}
                  status="success"
                  result={historyResult}
                  imagePreview={resultImagePreview}
                  loadingMessage={null}
                  loadingSteps={[]}
                  loadingStepIndex={0}
                  onCancelAnalysis={onClose}
                  shoppingListStatus={shoppingListStatus}
                  shoppingListMessage={shoppingListMessage}
                  onAddShoppingList={onAddShoppingList}
                  surface="modal"
                />

                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
                  <div className="space-y-4">
                    {detail ? (
                      <AnalyzerAttributionCard
                        locale={locale}
                        consideredInputs={detail.consideredInputs}
                        influenceNotes={detail.influenceNotes}
                      />
                    ) : null}

                    <div className="gv-glass rounded-[20px] px-4 py-4 sm:rounded-[22px] sm:px-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-lime)]">
                        {isGerman ? "Recheck und Verlauf" : "Recheck and trend"}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-[color:var(--gv-text-muted)]">
                        {detail?.followUp.previousAnalysisId
                          ? isGerman
                            ? "Dieser Bericht ist bereits mit einem früheren Check verknüpft."
                            : "This report is already linked to an earlier check."
                          : isGerman
                            ? "Nutze diesen Bericht als Basis für einen neuen Recheck, damit spätere Veränderungen sauber vergleichbar bleiben."
                            : "Use this report as the baseline for a new recheck so later changes stay easy to compare."}
                      </p>
                      {detail?.followUp.trendSummary ? (
                        <div className="mt-3 rounded-[18px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 py-3 text-sm text-[color:var(--gv-text)]">
                          <p>
                            {isGerman
                              ? "Confidence-Differenz"
                              : "Confidence delta"}
                            :{" "}
                            {detail.followUp.trendSummary.confidenceDelta ===
                            null
                              ? "—"
                              : detail.followUp.trendSummary.confidenceDelta > 0
                                ? `+${Math.round(detail.followUp.trendSummary.confidenceDelta * 100)}%`
                                : `${Math.round(detail.followUp.trendSummary.confidenceDelta * 100)}%`}
                          </p>
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2.5">
                        <button
                          type="button"
                          onClick={onUseAsRecheckBaseline}
                          className={`inline-flex min-h-10 items-center justify-center rounded-[18px] border border-[color:var(--gv-lime)]/28 bg-[color:var(--gv-lime)]/10 px-4 py-2 text-sm font-semibold text-[color:var(--gv-lime)] transition ${lightFocusRing}`}
                        >
                          {isGerman
                            ? "Als Recheck-Basis nutzen"
                            : "Use as recheck baseline"}
                        </button>
                      </div>
                    </div>

                    <div className="gv-glass rounded-[20px] px-4 py-4 sm:rounded-[22px] sm:px-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-lime)]">
                        {isGerman
                          ? "Follow-up-Feedback"
                          : "Follow-up feedback"}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-[color:var(--gv-text-muted)]">
                        {isGerman
                          ? "Markiere später, ob sich der Zustand nach den Schritten verbessert oder verschlechtert hat."
                          : "Later on, mark whether the condition improved or worsened after the steps."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2.5">
                        <button
                          type="button"
                          onClick={onFollowUpImproved}
                          disabled={feedbackStatus === "loading"}
                          className={`inline-flex min-h-10 items-center justify-center rounded-[18px] border px-4 py-2 text-sm font-semibold transition ${lightFocusRing} ${
                            detail?.lastFeedback?.classification ===
                            "follow_up_improved"
                              ? "border-[#e4c56c]/60 bg-[#f8e0aa] text-[#52361d]"
                              : feedbackStatus === "loading"
                                ? "border-stone-200 bg-stone-100 text-stone-400"
                                : "border-[#e4c56c]/45 bg-[#fff5da] text-[#6e4521]"
                          }`}
                        >
                          {feedbackStatus === "loading" &&
                          feedbackPendingType === "follow_up_improved" ? (
                            <>
                              <LoadingSpinner size="sm" className="mr-2" />
                              {isGerman ? "Wird gespeichert..." : "Saving..."}
                            </>
                          ) : detail?.lastFeedback?.classification ===
                            "follow_up_improved" ? (
                            <>
                              <CheckIcon className="mr-2 h-4 w-4" />
                              {isGerman
                                ? "Verbessert gespeichert"
                                : "Improved saved"}
                            </>
                          ) : isGerman ? (
                            "Später verbessert"
                          ) : (
                            "Improved later"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={onFollowUpWorsened}
                          disabled={feedbackStatus === "loading"}
                          className={`inline-flex min-h-10 items-center justify-center rounded-[18px] border px-4 py-2 text-sm font-semibold transition ${lightFocusRing} ${
                            detail?.lastFeedback?.classification ===
                            "follow_up_worsened"
                              ? "border-red-300 bg-red-100 text-red-900"
                              : feedbackStatus === "loading"
                                ? "border-stone-200 bg-stone-100 text-stone-400"
                                : "border-red-200 bg-red-50 text-red-700"
                          }`}
                        >
                          {feedbackStatus === "loading" &&
                          feedbackPendingType === "follow_up_worsened" ? (
                            <>
                              <LoadingSpinner size="sm" className="mr-2" />
                              {isGerman ? "Wird gespeichert..." : "Saving..."}
                            </>
                          ) : detail?.lastFeedback?.classification ===
                            "follow_up_worsened" ? (
                            <>
                              <CheckIcon className="mr-2 h-4 w-4" />
                              {isGerman
                                ? "Verschlechtert gespeichert"
                                : "Worsened saved"}
                            </>
                          ) : isGerman ? (
                            "Später verschlechtert"
                          ) : (
                            "Worsened later"
                          )}
                        </button>
                      </div>
                      {feedbackMessage ? (
                        <p
                          className={`mt-3 text-sm ${feedbackMessageClasses(feedbackStatus)}`}
                          role={feedbackStatus === "error" ? "alert" : "status"}
                          aria-live="polite"
                        >
                          {feedbackMessage}
                        </p>
                      ) : detail?.lastFeedback ? (
                        <p className="mt-3 text-sm text-[color:var(--gv-text-muted)]">
                          {feedbackLabel(detail.lastFeedback, locale)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="gv-glass rounded-[20px] px-4 py-4 sm:rounded-[22px] sm:px-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-lime)]">
                        {isGerman ? "Weiterführende Guides" : "Further guides"}
                      </p>
                      <div className="mt-3">
                        <GuideSuggestionList
                          locale={locale}
                          guideSuggestions={guideSuggestions}
                        />
                      </div>
                    </div>

                    <div className="gv-glass rounded-[20px] px-4 py-4 sm:rounded-[22px] sm:px-5">
              <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                {isGerman
                  ? "Community-Fallbibliothek"
                  : "Community case library"}
              </h4>
              <p className="mt-3 text-sm leading-6 text-[color:var(--gv-text-muted)]">
                {isGerman
                  ? "Du kannst auch einen gespeicherten Bericht anonymisiert für die Fallbibliothek einreichen. Bilder werden nur mit gesonderter Zustimmung und Freigabe gezeigt."
                  : "You can also submit a saved report anonymously to the case library. Images are only shown with separate consent and approval."}
              </p>
              <div className="mt-3 space-y-3">
                <label className="flex items-start gap-3 rounded-[18px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 py-3 text-sm text-[color:var(--gv-text)]">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={publicationConsent}
                    onChange={(event) =>
                      onPublicationConsentChange(event.target.checked)
                    }
                  />
                  <span>
                    {isGerman
                      ? "Diesen Bericht anonymisiert für die Community-Bibliothek einreichen."
                      : "Submit this report anonymously to the community library."}
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-[18px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 py-3 text-sm text-[color:var(--gv-text)]">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={publicationImageConsent}
                    onChange={(event) =>
                      onPublicationImageConsentChange(event.target.checked)
                    }
                  />
                  <span>
                    {isGerman
                      ? "Das Foto darf zusätzlich verwendet werden, falls der Fall freigegeben wird."
                      : "The photo may also be used if the case is approved."}
                  </span>
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={onSubmitPublication}
                  disabled={
                    publicationStatus === "loading" ||
                    publicationIsLocked(detail?.publication?.status ?? null)
                  }
                  aria-busy={publicationStatus === "loading"}
                  className={`inline-flex min-h-10 items-center justify-center rounded-[18px] border px-4 py-2 text-sm font-semibold transition ${lightFocusRing} ${
                    publicationIsLocked(detail?.publication?.status ?? null)
                      ? "border-[#e4c56c]/60 bg-[#f8e0aa] text-[#52361d]"
                      : publicationStatus === "loading"
                        ? "border-stone-200 bg-stone-100 text-stone-400"
                        : "border-[#e4c56c]/45 bg-[#fff5da] text-[#6e4521]"
                  }`}
                >
                  {publicationStatus === "loading" ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      {publicationButtonLabel({
                        locale,
                        asyncStatus: publicationStatus,
                        publicationStatus: detail?.publication?.status ?? null,
                      })}
                    </>
                  ) : publicationIsLocked(detail?.publication?.status ?? null) ? (
                    <>
                      <CheckIcon className="mr-2 h-4 w-4" />
                      {publicationButtonLabel({
                        locale,
                        asyncStatus: publicationStatus,
                        publicationStatus: detail?.publication?.status ?? null,
                      })}
                    </>
                  ) : (
                    publicationButtonLabel({
                      locale,
                      asyncStatus: publicationStatus,
                      publicationStatus: detail?.publication?.status ?? null,
                    })
                  )}
                </button>
                {detail?.publication?.publicUrl ? (
                  <Link
                    href={detail.publication.publicUrl}
                    className={`inline-flex min-h-10 items-center justify-center rounded-[18px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 py-2 text-sm font-semibold text-[color:var(--gv-text)] transition hover:border-[color:var(--gv-lime)]/35 ${lightFocusRing}`}
                  >
                    {isGerman
                      ? "Öffentlichen Fall ansehen"
                      : "Open public case"}
                  </Link>
                ) : null}
              </div>
              {detail?.publication ? (
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--gv-text-muted)]">
                  {publicationStatusLabel(detail.publication.status, locale)}
                </p>
              ) : null}
              {publicationStatus === "loading" || publicationMessage ? (
                <p
                  className={`mt-3 text-sm ${publicationMessageClasses(publicationStatus)}`}
                  role={publicationStatus === "error" ? "alert" : "status"}
                  aria-live="polite"
                >
                  {publicationStatus === "loading"
                    ? isGerman
                      ? "Der Fall wird gerade für die Community-Bibliothek eingereicht."
                      : "The case is being submitted to the community library."
                    : publicationMessage}
                </p>
              ) : null}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="border-t border-[color:var(--gv-border)] bg-[rgba(12,9,8,0.92)] px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className={`inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#8e5a2b] via-[#573421] to-[#2d1b13] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 sm:w-auto ${lightFocusRing}`}
            >
              {isGerman ? "Schließen" : "Close"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
