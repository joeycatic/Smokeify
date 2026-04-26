import { mergeAnalyzerGuideLinks } from "@/lib/plantAnalyzerDecisionSupport";
import type { PlantAnalyzerDiagnosis } from "@/lib/plantAnalyzerTypes";
import type {
  PlantAnalyzerRemediationPlan,
  PlantAnalyzerRemediationStep,
  PlantAnalyzerRemediationUrgency,
} from "@/lib/plantAnalyzerRemediationTypes";
import type {
  PlantAnalyzerGuideSuggestion,
  PlantAnalyzerProductSuggestion,
} from "@/lib/plantAnalyzerTypes";

function detectUrgency(
  diagnosis: PlantAnalyzerDiagnosis,
): PlantAnalyzerRemediationUrgency {
  if (
    diagnosis.healthStatus === "critical" ||
    diagnosis.issues.some((issue) => issue.severity === "critical")
  ) {
    return "high";
  }
  if (
    diagnosis.healthStatus === "warning" ||
    diagnosis.issues.some((issue) => issue.severity === "warning")
  ) {
    return "medium";
  }
  return "low";
}

function buildMonitoringWindow(urgency: PlantAnalyzerRemediationUrgency) {
  if (urgency === "high") {
    return {
      label: "12-24h",
      summary: "Erste Reaktion zeitnah erneut prüfen.",
      hoursMin: 12,
      hoursMax: 24,
      checkpoints: [
        "Betroffene Blattbereiche erneut vergleichen.",
        "Neue Flecken, Krallen oder Verbrennungen dokumentieren.",
        "Nur eine Hauptvariable gleichzeitig verändern.",
      ],
    };
  }

  if (urgency === "medium") {
    return {
      label: "24-48h",
      summary: "Stabilisieren und nach dem nächsten Zyklus erneut prüfen.",
      hoursMin: 24,
      hoursMax: 48,
      checkpoints: [
        "Neue oder abklingende Symptome notieren.",
        "Werte wie pH, EC oder Feuchte gegenprüfen.",
        "Vorher-Nachher-Foto für den Recheck aufnehmen.",
      ],
    };
  }

  return {
    label: "48-72h",
    summary: "Ruhig beobachten und Veränderungen sauber tracken.",
    hoursMin: 48,
    hoursMax: 72,
    checkpoints: [
      "Nur beobachten, nicht überkorrigieren.",
      "Falls Symptome zunehmen, neuen Recheck starten.",
      "Setup-Werte trotzdem dokumentieren.",
    ],
  };
}

function splitProducts(
  products: PlantAnalyzerProductSuggestion[],
): Pick<PlantAnalyzerRemediationPlan["productBundle"], "optionalProducts" | "setupHelpers"> {
  return {
    optionalProducts: products.filter((product) => product.classification !== "verify"),
    setupHelpers: products.filter((product) => product.classification === "verify"),
  };
}

export function buildPlantAnalyzerRemediationPlan(input: {
  diagnosis: PlantAnalyzerDiagnosis;
  productSuggestions: PlantAnalyzerProductSuggestion[];
  guideSuggestions: PlantAnalyzerGuideSuggestion[];
}): PlantAnalyzerRemediationPlan {
  const urgency = detectUrgency(input.diagnosis);
  const monitoringWindow = buildMonitoringWindow(urgency);
  const detectedSymptoms =
    input.diagnosis.issues.map((issue) => issue.label).slice(0, 4);
  const split = splitProducts(input.productSuggestions);
  const careSteps: PlantAnalyzerRemediationStep[] = input.diagnosis.recommendations
    .slice(0, 4)
    .map((step, index) => ({
      id: `care-step-${index + 1}`,
      title: `Schritt ${index + 1}`,
      detail: step,
      kind: index === 0 ? "adjust" : "monitor",
    }));

  return {
    detectedSymptoms,
    urgency,
    careSteps,
    monitoringWindow,
    followUpPrompt: {
      title: "Recheck vorbereiten",
      detail:
        "Nutze denselben Kamerawinkel und ähnliche Lichtbedingungen, damit der nächste Check sauber vergleichbar bleibt.",
      comparisonHint:
        "Ein Recheck mit Basisbericht zeigt schneller, ob sich Symptome verschärfen oder beruhigen.",
    },
    productBundle: {
      name: "Analyzer-Checkliste",
      summary:
        split.setupHelpers.length > 0
          ? "Miss zuerst Werte und stabilisiere das Setup, bevor du Produkte nur auf Verdacht kaufst."
          : "Nutze Produkthinweise nur, wenn sie nach dem Gegencheck weiter sinnvoll wirken.",
      mustCheckItems: [
        "Symptom erneut visuell prüfen",
        "pH / EC / Feuchte gegenprüfen",
        "Nur eine Anpassung nach der anderen machen",
      ],
      optionalProducts: split.optionalProducts,
      setupHelpers: split.setupHelpers,
    },
    setupAdjustmentPath: null,
    guideLinks: mergeAnalyzerGuideLinks(input.guideSuggestions),
    uncertaintyNote:
      urgency === "high"
        ? "Bei kritischen Symptomen ist dies nur eine vorsichtige Ersteinschätzung. Gegenprüfung bleibt wichtig."
        : "Die Einschätzung ist als strukturierte Ersteinschätzung gedacht und sollte mit deinem Setup abgeglichen werden.",
  };
}
