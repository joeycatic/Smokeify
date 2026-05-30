"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { prepareAnalyzerImageFile } from "@/app/pflanzen-analyzer/clientImageUpload";
import { useCart } from "@/components/CartProvider";
import {
  getLoadingSteps,
  PlantAnalyzerAuthModal,
  PlantAnalyzerHero,
  PlantAnalyzerHistoryModal,
  PlantAnalyzerHistorySection,
  PlantAnalyzerResultSection,
  PlantAnalyzerUploadSection,
} from "@/app/pflanzen-analyzer/PlantAnalyzerSections";
import { useDocumentLanguage } from "@/hooks/useDocumentLanguage";
import { getAnalyzerLoadingMessage } from "@/lib/analyzer-messages";
import { PLANT_ANALYZER_PATH } from "@/lib/plantAnalyzerPaths";
import type {
  AnalysisHistoryEntry,
  AnalyzerResponse,
  AsyncStatus,
  HistoryReportDetail,
  Locale,
} from "@/app/pflanzen-analyzer/types";
import type { PlantAnalyzerAnalysisContext } from "@/lib/plantAnalyzerTypes";
import type {
  PlantAnalyzerFeedbackClassification,
  PlantAnalyzerFeedbackOutcome,
} from "@/lib/plantAnalyzerRemediationTypes";
import { trackFirstPartyAnalyticsEvent } from "@/lib/analytics";
import { reportClientPerfMetric } from "@/lib/clientPerf";
import { STOREFRONT_ANALYTICS_EVENTS } from "@/lib/storefrontAnalytics";

const FREE_ANALYSIS_LIMIT = 3;
const FREE_ANALYSIS_WINDOW_HOURS = 24;
const FREE_ANALYSIS_WINDOW_MS = FREE_ANALYSIS_WINDOW_HOURS * 60 * 60 * 1000;

export default function PlantAnalyzerClient({
  locale: initialLocale,
  mode = "default",
  initialResult = null,
  initialImagePreview = null,
  initialImageName = "",
}: {
  locale?: Locale;
  mode?: "default" | "test";
  initialResult?: AnalyzerResponse | null;
  initialImagePreview?: string | null;
  initialImageName?: string;
}) {
  const isTestMode = mode === "test";
  const locale = useDocumentLanguage(initialLocale);
  const inputId = useId();
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialImagePreview,
  );
  const [imageName, setImageName] = useState(initialImageName);
  const [visualNotes, setVisualNotes] = useState("");
  const [growContextNotes, setGrowContextNotes] = useState("");
  const [analysisContext, setAnalysisContext] =
    useState<PlantAnalyzerAnalysisContext>({});
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >(initialResult ? "success" : "idle");
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalyzerResponse | null>(initialResult);
  const [historyRequested, setHistoryRequested] = useState(false);
  const [historyStatus, setHistoryStatus] = useState<AsyncStatus>("idle");
  const [history, setHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [selectedHistoryEntry, setSelectedHistoryEntry] =
    useState<AnalysisHistoryEntry | null>(null);
  const [selectedHistoryDetail, setSelectedHistoryDetail] =
    useState<HistoryReportDetail | null>(null);
  const [selectedHistoryDetailStatus, setSelectedHistoryDetailStatus] =
    useState<AsyncStatus>("idle");
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [shoppingListStatus, setShoppingListStatus] =
    useState<AsyncStatus>("idle");
  const [shoppingListMessage, setShoppingListMessage] = useState<string | null>(
    null,
  );
  const [historyFeedbackStatus, setHistoryFeedbackStatus] =
    useState<AsyncStatus>("idle");
  const [historyFeedbackMessage, setHistoryFeedbackMessage] = useState<
    string | null
  >(null);
  const [historyFeedbackPendingType, setHistoryFeedbackPendingType] =
    useState<PlantAnalyzerFeedbackClassification | null>(null);
  const [historyShoppingListStatus, setHistoryShoppingListStatus] =
    useState<AsyncStatus>("idle");
  const [historyShoppingListMessage, setHistoryShoppingListMessage] = useState<
    string | null
  >(null);
  const [historyPublicationStatus, setHistoryPublicationStatus] =
    useState<AsyncStatus>("idle");
  const [historyPublicationMessage, setHistoryPublicationMessage] = useState<
    string | null
  >(null);
  const [historyPublicationConsent, setHistoryPublicationConsent] =
    useState(false);
  const [historyPublicationImageConsent, setHistoryPublicationImageConsent] =
    useState(false);
  const [recheckBaseline, setRecheckBaseline] =
    useState<AnalysisHistoryEntry | null>(null);
  const analysisSectionRef = useRef<HTMLElement | null>(null);
  const shouldAutoScrollToAnalysisRef = useRef(false);
  const previewUrlRef = useRef<string | null>(null);
  const prepareRequestRef = useRef(0);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const analysisStartedAtRef = useRef<number | null>(null);
  const { addManyToCart } = useCart();
  const effectiveSessionStatus = hasHydrated ? sessionStatus : "loading";
  const isAuthenticated = isTestMode || effectiveSessionStatus === "authenticated";
  const userRole = hasHydrated ? (session?.user?.role ?? "USER") : "USER";
  const isPrivilegedUser =
    isTestMode || userRole === "ADMIN" || userRole === "STAFF";
  const recentAnalysisCount = history.filter((entry) => {
    const analyzedAt = new Date(entry.analyzedAt).getTime();
    return Number.isFinite(analyzedAt)
      ? Date.now() - analyzedAt < FREE_ANALYSIS_WINDOW_MS
      : false;
  }).length;
  const freeAnalysesRemaining = isPrivilegedUser
    ? Number.POSITIVE_INFINITY
    : Math.max(0, FREE_ANALYSIS_LIMIT - recentAnalysisCount);
  const freeAnalysisUsed =
    !isTestMode && !isPrivilegedUser && freeAnalysesRemaining <= 0;
  const loadingSteps = getLoadingSteps(locale);
  const analyzerSubmitPath = isTestMode
    ? "/api/plant-analyzer/test"
    : "/api/plant-analyzer";
  const clearPreviewUrl = () => {
    if (!previewUrlRef.current) return;
    URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
  };

  const resetSelectedImage = () => {
    prepareRequestRef.current += 1;
    clearPreviewUrl();
    setSelectedFile(null);
    setImagePreview(null);
    setImageName("");
  };

  const chooseLoadingMessage = useCallback(() => {
    const nextMessage = locale === "de" ? getAnalyzerLoadingMessage() : null;
    setLoadingMessage(nextMessage);
    return nextMessage;
  }, [locale]);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    return () => {
      clearPreviewUrl();
      analyzeAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!showAuthPrompt && !selectedHistoryEntry) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedHistoryEntry, showAuthPrompt]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!showAuthPrompt && !selectedHistoryEntry) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (selectedHistoryEntry) {
        closeHistoryReport();
        return;
      }

      if (showAuthPrompt) {
        setShowAuthPrompt(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedHistoryEntry, showAuthPrompt]);

  useEffect(() => {
    if (
      status !== "loading" ||
      typeof window === "undefined" ||
      !shouldAutoScrollToAnalysisRef.current
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const sectionTop =
        (analysisSectionRef.current?.getBoundingClientRect().top ?? 0) +
        window.scrollY;
      shouldAutoScrollToAnalysisRef.current = false;
      window.scrollTo({
        top: Math.max(0, sectionTop - 128),
        behavior: "smooth",
      });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [status]);

  useEffect(() => {
    if (status !== "loading") {
      setLoadingStepIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setLoadingStepIndex((current) => (current + 1) % loadingSteps.length);
    }, 1400);

    return () => window.clearInterval(intervalId);
  }, [loadingSteps.length, status]);

  const loadHistory = useCallback(async () => {
    if (isTestMode) {
      setHistory([]);
      return;
    }

    if (effectiveSessionStatus !== "authenticated") {
      setHistory([]);
      return;
    }

    setHistoryStatus("loading");
    try {
      const res = await fetch("/api/plant-analyzer/history?limit=8", {
        method: "GET",
      });
      if (!res.ok) {
        setHistoryStatus("error");
        return;
      }
      const data = (await res.json()) as { analyses?: AnalysisHistoryEntry[] };
      setHistory(data.analyses ?? []);
      setHistoryStatus("idle");
    } catch {
      setHistoryStatus("error");
    }
  }, [effectiveSessionStatus, isTestMode]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (effectiveSessionStatus !== "authenticated") {
      setHistory([]);
      setHistoryRequested(false);
      return;
    }
    if (isTestMode || !historyRequested) return;
    void loadHistory();
  }, [effectiveSessionStatus, hasHydrated, historyRequested, isTestMode, loadHistory]);

  const clearSelectedImage = () => {
    resetSelectedImage();
    setError("");
    setStatus("idle");
    setLoadingMessage(null);
    setResult(null);
    setShoppingListMessage(null);
  };

  const postFeedback = async ({
    analysisId,
    helpful,
    feedbackType,
    successMessage,
    setStatus,
    setMessage,
    outcome,
    onStored,
  }: {
    analysisId: string;
    helpful: boolean;
    feedbackType: PlantAnalyzerFeedbackClassification;
    successMessage: string;
    setStatus: (value: AsyncStatus) => void;
    setMessage: (value: string | null) => void;
    outcome?: PlantAnalyzerFeedbackOutcome;
    onStored?: () => void;
  }) => {
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/plant-analyzer/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId,
          isCorrect: helpful,
          feedbackType,
          outcome,
        }),
      });
      if (!res.ok) {
        setStatus("error");
        setMessage(
          locale === "de"
            ? "Feedback konnte nicht gespeichert werden."
            : "Feedback could not be saved.",
        );
        return;
      }
      setStatus("idle");
      setMessage(successMessage);
      onStored?.();
    } catch {
      setStatus("error");
      setMessage(
        locale === "de"
          ? "Feedback konnte nicht gespeichert werden."
          : "Feedback could not be saved.",
      );
    }
  };

  const resolveSuggestedCartItems = async (
    productSuggestions: AnalyzerResponse["productSuggestions"],
    sourceAnalysisId?: string | null,
  ) => {
    const variants = await Promise.all(
      productSuggestions.map(async (product) => {
        const res = await fetch(
          `/api/products/handle/${encodeURIComponent(product.handle)}/variants`,
        );
        if (!res.ok) return null;
        const data = (await res.json()) as {
          variants?: Array<{ id: string; available: boolean }>;
        };
        const variantId =
          data.variants?.find((variant) => variant.available)?.id ?? null;
        if (!variantId) return null;
        const reason =
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
        return {
          variantId,
          quantity: 1,
          options: [
            ...(sourceAnalysisId
              ? [{ name: "Analyzer Analyse", value: sourceAnalysisId }]
              : []),
            { name: "Analyzer Hinweis", value: reason },
            { name: "Empfehlung", value: product.reason.slice(0, 80) },
            { name: "Nicht automatisch", value: locale === "de" ? "vom Nutzer gewählt" : "user selected" },
          ],
        };
      }),
    );

    return variants.filter(
      (item): item is Exclude<(typeof variants)[number], null> => Boolean(item),
    );
  };

  const handleFileChange = async (file: File | null) => {
    setIsDraggingFile(false);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(
        locale === "de"
          ? "Bitte ein Bild hochladen."
          : "Please upload an image.",
      );
      return;
    }

    const requestId = prepareRequestRef.current + 1;
    prepareRequestRef.current = requestId;
    chooseLoadingMessage();
    setIsPreparingImage(true);
    setError("");
    setStatus("idle");
    setResult(null);

    try {
      const preparedFile = await prepareAnalyzerImageFile(file);
      if (prepareRequestRef.current !== requestId) return;

      clearPreviewUrl();
      const nextPreview = URL.createObjectURL(preparedFile);
      previewUrlRef.current = nextPreview;
      setSelectedFile(preparedFile);
      setImagePreview(nextPreview);
      setImageName(file.name);
    } catch {
      if (prepareRequestRef.current !== requestId) return;
      setError(
        locale === "de"
          ? "Das Bild konnte nicht verarbeitet werden."
          : "The image could not be processed.",
      );
      resetSelectedImage();
    } finally {
      if (prepareRequestRef.current === requestId) {
        setIsPreparingImage(false);
      }
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingFile(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null))
      return;
    setIsDraggingFile(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    handleFileChange(event.dataTransfer.files?.[0] ?? null).catch(() => {});
  };

  const cancelAnalysis = () => {
    analyzeAbortRef.current?.abort();
    analyzeAbortRef.current = null;
    setStatus("idle");
    setLoadingMessage(null);
  };

  const analyzeImage = async () => {
    if (!selectedFile) {
      setError(
        locale === "de"
          ? "Bitte zuerst ein Foto hochladen."
          : "Please upload a photo first.",
      );
      return;
    }
    if (isPreparingImage || (!isTestMode && effectiveSessionStatus === "loading")) {
      return;
    }
    if (!isTestMode && effectiveSessionStatus !== "authenticated") {
      setShowAuthPrompt(true);
      return;
    }
    if (freeAnalysisUsed) {
      setError(
        locale === "de"
          ? "Deine 3 kostenlosen Analysen in den letzten 24 Stunden wurden bereits verwendet. Das Limit setzt sich nach 24 Stunden zurück."
          : "Your 3 free analyses in the last 24 hours have already been used. The limit resets after 24 hours.",
      );
      return;
    }

    shouldAutoScrollToAnalysisRef.current = true;
    chooseLoadingMessage();
    setStatus("loading");
    setError("");
    setShoppingListStatus("idle");
    setShoppingListMessage(null);
    analysisStartedAtRef.current = performance.now();
    const controller = new AbortController();
    analyzeAbortRef.current = controller;

    try {
      const formData = new FormData();
      formData.set("file", selectedFile, selectedFile.name);
      if (visualNotes.trim()) {
        formData.set("visualNotes", visualNotes.trim());
      }
      if (growContextNotes.trim()) {
        formData.set("growContextNotes", growContextNotes.trim());
      }
      if (recheckBaseline?.id) {
        formData.set("previousAnalysisId", recheckBaseline.id);
      }
      (
        [
          "medium",
          "growthStage",
          "wateringCadence",
          "ph",
          "ec",
          "temperatureC",
          "humidityPercent",
          "lightDistanceCm",
          "lightType",
          "tentOrRoomSize",
        ] as const
      ).forEach((key) => {
        const value = analysisContext[key];
        if (value === undefined || value === null || value === "") return;
        formData.set(key, String(value));
      });

      const res = await fetch(analyzerSubmitPath, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const data = (await res.json()) as AnalyzerResponse & { error?: string };
      if (!res.ok) {
        setStatus("error");
        setLoadingMessage(null);
        setError(
          data.error ??
            (locale === "de" ? "Analyse fehlgeschlagen." : "Analysis failed."),
        );
        return;
      }
      setResult(data);
      setStatus("success");
      setLoadingMessage(null);
      if (data.storageWarning) {
        setError(
          locale === "de"
            ? "Die Analyse wurde berechnet, konnte aber nicht im Verlauf gespeichert werden."
            : "The analysis completed, but it could not be saved to history.",
        );
      }
      trackFirstPartyAnalyticsEvent(
        STOREFRONT_ANALYTICS_EVENTS.analyzerSubmit,
        {
          analysis_id: data.analysisId,
          health_status: data.diagnosis.healthStatus,
          confidence: data.diagnosis.confidence,
        },
      );
      if (analysisStartedAtRef.current !== null) {
        reportClientPerfMetric(
          "analyzer_submit_to_result",
          performance.now() - analysisStartedAtRef.current,
          "analysis-success",
          pathname ?? PLANT_ANALYZER_PATH,
        );
      }
      if (data.analysisId) {
        setHistoryRequested(true);
        void loadHistory();
      }
    } catch (fetchError) {
      if ((fetchError as Error).name === "AbortError") {
        setStatus("idle");
        setLoadingMessage(null);
        return;
      }
      setStatus("error");
      setLoadingMessage(null);
      setError(
        locale === "de" ? "Analyse fehlgeschlagen." : "Analysis failed.",
      );
    } finally {
      if (analyzeAbortRef.current === controller) {
        analyzeAbortRef.current = null;
      }
      analysisStartedAtRef.current = null;
    }
  };

  const addSuggestedProductsToCart = async () => {
    if (!result?.productSuggestions?.length) return;
    setShoppingListStatus("loading");
    setShoppingListMessage(null);
    try {
      const items = await resolveSuggestedCartItems(
        result.remediation.productBundle.optionalProducts.length > 0 ||
          result.remediation.productBundle.setupHelpers.length > 0
          ? [
              ...result.remediation.productBundle.optionalProducts,
              ...result.remediation.productBundle.setupHelpers,
            ]
          : result.productSuggestions,
        result.analysisId,
      );

      if (items.length === 0) {
        setShoppingListStatus("error");
        setShoppingListMessage(
          locale === "de"
            ? "Keine kaufbaren Empfehlungen gefunden."
            : "No purchasable recommendations were found.",
        );
        return;
      }

      await addManyToCart(items);
      setShoppingListStatus("idle");
      setShoppingListMessage(
        locale === "de"
          ? `${result.remediation.productBundle.name} wurde als opt-in Checkliste in den Warenkorb gelegt.`
          : `${result.remediation.productBundle.name} was added to the cart as an opt-in checklist.`,
      );
    } catch {
      setShoppingListStatus("error");
      setShoppingListMessage(
        locale === "de"
          ? "Empfohlene Produkte konnten nicht in den Warenkorb gelegt werden."
          : "Recommended products could not be added to the cart.",
      );
    }
  };

  const openHistoryReport = async (entry: AnalysisHistoryEntry) => {
    startTransition(() => {
      setSelectedHistoryEntry(entry);
      setSelectedHistoryDetail(null);
      setSelectedHistoryDetailStatus("loading");
      setHistoryFeedbackStatus("idle");
      setHistoryFeedbackMessage(null);
      setHistoryShoppingListStatus("idle");
      setHistoryShoppingListMessage(null);
    });

    try {
      const res = await fetch(`/api/plant-analyzer/history/${entry.id}`, {
        method: "GET",
      });
      if (!res.ok) {
        startTransition(() => {
          setSelectedHistoryDetailStatus("error");
        });
        return;
      }
      const data = (await res.json()) as HistoryReportDetail;
      startTransition(() => {
        setSelectedHistoryDetail(data);
        setSelectedHistoryDetailStatus("idle");
      });
      trackFirstPartyAnalyticsEvent(
        STOREFRONT_ANALYTICS_EVENTS.analyzerResultView,
        {
          analysis_id: entry.id,
          health_status: data.diagnosis.healthStatus,
        },
      );
    } catch {
      startTransition(() => {
        setSelectedHistoryDetailStatus("error");
      });
    }
  };

  const closeHistoryReport = () => {
    startTransition(() => {
      setSelectedHistoryEntry(null);
      setSelectedHistoryDetail(null);
      setSelectedHistoryDetailStatus("idle");
      setHistoryFeedbackStatus("idle");
      setHistoryFeedbackMessage(null);
      setHistoryFeedbackPendingType(null);
      setHistoryShoppingListStatus("idle");
      setHistoryShoppingListMessage(null);
      setHistoryPublicationStatus("idle");
      setHistoryPublicationMessage(null);
      setHistoryPublicationConsent(false);
      setHistoryPublicationImageConsent(false);
    });
  };

  const submitPublication = async ({
    analysisId,
    consentToPublish,
    requestedPublicImage,
    setStatus,
    setMessage,
    onStored,
  }: {
    analysisId: string;
    consentToPublish: boolean;
    requestedPublicImage: boolean;
    setStatus: (value: AsyncStatus) => void;
    setMessage: (value: string | null) => void;
    onStored: (value: NonNullable<AnalyzerResponse["publication"]>) => void;
  }) => {
    if (!analysisId) {
      setStatus("error");
      setMessage(
        locale === "de"
          ? "Der Fall konnte nicht gespeichert werden. Bitte die Analyse erneut ausführen."
          : "The case could not be saved. Please run the analysis again.",
      );
      return;
    }
    if (!consentToPublish) {
      setStatus("error");
      setMessage(
        locale === "de"
          ? "Bitte bestätige zuerst die Einreichung für die Community-Bibliothek."
          : "Please confirm the community-library submission first.",
      );
      return;
    }

    setStatus("loading");
    setMessage(null);

    try {
      const res = await fetch(
        `/api/plant-analyzer/publications/${analysisId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consentToPublish,
            requestedPublicImage,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        publication?: NonNullable<AnalyzerResponse["publication"]>;
      };
      if (!res.ok || !data.publication) {
        setStatus("error");
        setMessage(
          data.error ??
            (locale === "de"
              ? "Der Fall konnte nicht für die Bibliothek eingereicht werden."
              : "The case could not be submitted to the library."),
        );
        return;
      }

      onStored(data.publication);
      setStatus("idle");
      setMessage(
        locale === "de"
          ? "Danke. Der Fall wurde für die Community-Bibliothek eingereicht."
          : "Thanks. The case was submitted to the community library.",
      );
    } catch {
      setStatus("error");
      setMessage(
        locale === "de"
          ? "Der Fall konnte nicht für die Bibliothek eingereicht werden."
          : "The case could not be submitted to the library.",
      );
    }
  };

  const submitHistoryFeedback = async ({
    helpful,
    feedbackType,
    outcome,
    successMessage,
  }: {
    helpful: boolean;
    feedbackType: PlantAnalyzerFeedbackClassification;
    outcome?: PlantAnalyzerFeedbackOutcome;
    successMessage: string;
  }) => {
    if (!selectedHistoryEntry?.id) return;
    setHistoryFeedbackPendingType(feedbackType);
    await postFeedback({
      analysisId: selectedHistoryEntry.id,
      helpful,
      feedbackType,
      outcome,
      successMessage,
      setStatus: setHistoryFeedbackStatus,
      setMessage: setHistoryFeedbackMessage,
      onStored: () => {
        setSelectedHistoryDetail((current) =>
          current
            ? {
                ...current,
                lastFeedback: {
                  helpful,
                  classification: feedbackType,
                  outcome: outcome ?? null,
                  recordedAt: new Date().toISOString(),
                },
              }
            : current,
        );
      },
    });
    setHistoryFeedbackPendingType(null);
  };

  const addHistorySuggestedProductsToCart = async () => {
    if (!selectedHistoryDetail?.productSuggestions?.length) return;
    setHistoryShoppingListStatus("loading");
    setHistoryShoppingListMessage(null);
    try {
      const items = await resolveSuggestedCartItems(
        selectedHistoryDetail.remediation.productBundle.optionalProducts
          .length > 0 ||
          selectedHistoryDetail.remediation.productBundle.setupHelpers.length >
            0
          ? [
              ...selectedHistoryDetail.remediation.productBundle
                .optionalProducts,
              ...selectedHistoryDetail.remediation.productBundle.setupHelpers,
            ]
          : selectedHistoryDetail.productSuggestions,
        selectedHistoryDetail.id,
      );

      if (items.length === 0) {
        setHistoryShoppingListStatus("error");
        setHistoryShoppingListMessage(
          locale === "de"
            ? "Keine kaufbaren Empfehlungen gefunden."
            : "No purchasable recommendations were found.",
        );
        return;
      }

      await addManyToCart(items);
      setHistoryShoppingListStatus("idle");
      setHistoryShoppingListMessage(
        locale === "de"
          ? `${selectedHistoryDetail.remediation.productBundle.name} wurde als Checkliste in den Warenkorb gelegt.`
          : `${selectedHistoryDetail.remediation.productBundle.name} was added to the cart as a checklist.`,
      );
    } catch {
      setHistoryShoppingListStatus("error");
      setHistoryShoppingListMessage(
        locale === "de"
          ? "Empfohlene Produkte konnten nicht in den Warenkorb gelegt werden."
          : "Recommended products could not be added to the cart.",
      );
    }
  };

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="hidden md:block">
        <PlantAnalyzerHero locale={locale} />
      </div>

      <div className="space-y-5 sm:space-y-6">
        <PlantAnalyzerUploadSection
          testMode={isTestMode}
          inputId={inputId}
          locale={locale}
          pathname={pathname}
          imagePreview={imagePreview}
          imageName={imageName}
          isDraggingFile={isDraggingFile}
          isPreparingImage={isPreparingImage}
          visualNotes={visualNotes}
          growContextNotes={growContextNotes}
          analysisContext={analysisContext}
          recheckBaseline={recheckBaseline}
          status={status}
          loadingMessage={loadingMessage}
          error={error}
          isAuthenticated={isAuthenticated}
          isPrivilegedUser={isPrivilegedUser}
          freeAnalysesRemaining={freeAnalysesRemaining}
          freeAnalysisUsed={freeAnalysisUsed}
          effectiveSessionStatus={effectiveSessionStatus}
          hasHydrated={hasHydrated}
          onFileChange={(file) => {
            void handleFileChange(file);
          }}
          onClearImage={clearSelectedImage}
          onVisualNotesChange={setVisualNotes}
          onGrowContextNotesChange={setGrowContextNotes}
          onContextChange={(field, value) =>
            setAnalysisContext((current) => {
              const next = { ...current } as Record<string, unknown>;
              if (value === undefined || value === null || value === "") {
                delete next[field];
              } else {
                next[field] = value;
              }
              return next as PlantAnalyzerAnalysisContext;
            })
          }
          onClearRecheckBaseline={() => setRecheckBaseline(null)}
          onAnalyze={() => {
            void analyzeImage();
          }}
          onCancelAnalysis={cancelAnalysis}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />

        <PlantAnalyzerResultSection
          sectionRef={analysisSectionRef}
          locale={locale}
          status={status}
          result={result}
          imagePreview={imagePreview}
          loadingMessage={loadingMessage}
          loadingSteps={loadingSteps}
          loadingStepIndex={loadingStepIndex}
          onCancelAnalysis={cancelAnalysis}
          shoppingListStatus={shoppingListStatus}
          shoppingListMessage={shoppingListMessage}
          onAddShoppingList={() => {
            void addSuggestedProductsToCart();
          }}
        />

        {!isTestMode ? (
          <PlantAnalyzerHistorySection
            locale={locale}
            pathname={pathname}
            hasHydrated={hasHydrated}
            effectiveSessionStatus={effectiveSessionStatus}
            isAuthenticated={isAuthenticated}
            historyStatus={historyStatus}
            historyRequested={historyRequested}
            history={history}
            onLoadHistory={() => {
              setHistoryRequested(true);
              void loadHistory();
            }}
            onOpenHistoryReport={(entry) => {
              void openHistoryReport(entry);
            }}
          />
        ) : null}
      </div>

      {showAuthPrompt && !isTestMode ? (
        <PlantAnalyzerAuthModal
          locale={locale}
          pathname={pathname}
          onClose={() => setShowAuthPrompt(false)}
        />
      ) : null}

      {selectedHistoryEntry && !isTestMode ? (
        <PlantAnalyzerHistoryModal
          locale={locale}
          entry={selectedHistoryEntry}
          detail={selectedHistoryDetail}
          detailStatus={selectedHistoryDetailStatus}
          feedbackStatus={historyFeedbackStatus}
          feedbackPendingType={historyFeedbackPendingType}
          feedbackMessage={historyFeedbackMessage}
          shoppingListStatus={historyShoppingListStatus}
          shoppingListMessage={historyShoppingListMessage}
          publicationStatus={historyPublicationStatus}
          publicationMessage={historyPublicationMessage}
          publicationConsent={historyPublicationConsent}
          publicationImageConsent={historyPublicationImageConsent}
          onPublicationConsentChange={setHistoryPublicationConsent}
          onPublicationImageConsentChange={setHistoryPublicationImageConsent}
          onAddShoppingList={() => {
            void addHistorySuggestedProductsToCart();
          }}
          onFollowUpImproved={() => {
            void submitHistoryFeedback({
              helpful: true,
              feedbackType: "follow_up_improved",
              outcome: "improved",
              successMessage:
                locale === "de"
                  ? "Danke. Dieser Verlauf wurde als verbessert markiert."
                  : "Thanks. This follow-up was marked as improved.",
            });
          }}
          onFollowUpWorsened={() => {
            void submitHistoryFeedback({
              helpful: false,
              feedbackType: "follow_up_worsened",
              outcome: "worsened",
              successMessage:
                locale === "de"
                  ? "Danke. Dieser Verlauf wurde als verschlechtert markiert."
                  : "Thanks. This follow-up was marked as worsened.",
            });
          }}
          onUseAsRecheckBaseline={() => {
            setRecheckBaseline(selectedHistoryEntry);
            closeHistoryReport();
          }}
          onSubmitPublication={() => {
            if (!selectedHistoryEntry?.id) return;
            void submitPublication({
              analysisId: selectedHistoryEntry.id,
              consentToPublish: historyPublicationConsent,
              requestedPublicImage: historyPublicationImageConsent,
              setStatus: setHistoryPublicationStatus,
              setMessage: setHistoryPublicationMessage,
              onStored: (publication) => {
                setHistory((current) =>
                  current.map((entry) =>
                    entry.id === selectedHistoryEntry.id
                      ? { ...entry, publication }
                      : entry,
                  ),
                );
                setSelectedHistoryDetail((current) =>
                  current ? { ...current, publication } : current,
                );
              },
            });
          }}
          onClose={closeHistoryReport}
        />
      ) : null}
    </div>
  );
}
