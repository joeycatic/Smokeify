"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { prepareAnalyzerImageFile } from "@/app/pflanzen-analyzer/clientImageUpload";
import { useCart } from "@/components/CartProvider";
import {
  detectPreferredLocale,
  getLoadingSteps,
  PlantAnalyzerAuthModal,
  PlantAnalyzerHero,
  PlantAnalyzerHistoryModal,
  PlantAnalyzerHistorySection,
  PlantAnalyzerResultSection,
  PlantAnalyzerUploadSection,
} from "@/app/pflanzen-analyzer/PlantAnalyzerSections";
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

const FREE_ANALYSIS_LIMIT = 3;
const FREE_ANALYSIS_WINDOW_HOURS = 24;
const FREE_ANALYSIS_WINDOW_MS = FREE_ANALYSIS_WINDOW_HOURS * 60 * 60 * 1000;

export default function PlantAnalyzerClient() {
  const inputId = useId();
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [locale, setLocale] = useState<Locale>("de");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [notes, setNotes] = useState("");
  const [analysisContext, setAnalysisContext] =
    useState<PlantAnalyzerAnalysisContext>({});
  const [recheckBaseline, setRecheckBaseline] =
    useState<AnalysisHistoryEntry | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalyzerResponse | null>(null);
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
  const [feedbackStatus, setFeedbackStatus] = useState<AsyncStatus>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [shoppingListStatus, setShoppingListStatus] = useState<AsyncStatus>("idle");
  const [shoppingListMessage, setShoppingListMessage] = useState<string | null>(null);
  const [historyFeedbackStatus, setHistoryFeedbackStatus] =
    useState<AsyncStatus>("idle");
  const [historyFeedbackMessage, setHistoryFeedbackMessage] =
    useState<string | null>(null);
  const [historyShoppingListStatus, setHistoryShoppingListStatus] =
    useState<AsyncStatus>("idle");
  const [historyShoppingListMessage, setHistoryShoppingListMessage] =
    useState<string | null>(null);
  const analysisSectionRef = useRef<HTMLElement | null>(null);
  const shouldAutoScrollToAnalysisRef = useRef(false);
  const previewUrlRef = useRef<string | null>(null);
  const prepareRequestRef = useRef(0);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const { addManyToCart } = useCart();
  const effectiveSessionStatus = hasHydrated ? sessionStatus : "loading";
  const isAuthenticated = effectiveSessionStatus === "authenticated";
  const userRole = hasHydrated ? (session?.user?.role ?? "USER") : "USER";
  const isPrivilegedUser = userRole === "ADMIN" || userRole === "STAFF";
  const recentAnalysisCount = history.filter((entry) => {
    const analyzedAt = new Date(entry.analyzedAt).getTime();
    return Number.isFinite(analyzedAt)
      ? Date.now() - analyzedAt < FREE_ANALYSIS_WINDOW_MS
      : false;
  }).length;
  const freeAnalysesRemaining = isPrivilegedUser
    ? Number.POSITIVE_INFINITY
    : Math.max(0, FREE_ANALYSIS_LIMIT - recentAnalysisCount);
  const freeAnalysisUsed = !isPrivilegedUser && freeAnalysesRemaining <= 0;
  const loadingSteps = getLoadingSteps(locale);
  const previousAnalysis =
    result?.followUp.previousAnalysisId
      ? history.find((entry) => entry.id === result.followUp.previousAnalysisId) ??
        null
      : result?.analysisId
        ? history.find((entry) => entry.id !== result.analysisId) ?? null
        : null;

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

  useEffect(() => {
    setHasHydrated(true);
    setLocale(detectPreferredLocale());
  }, []);

  useEffect(() => {
    if (!hasHydrated || typeof window === "undefined") return;
    window.localStorage.setItem("smokeify-plant-analyzer-locale", locale);
  }, [hasHydrated, locale]);

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
  }, [effectiveSessionStatus]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (effectiveSessionStatus !== "authenticated") {
      setHistory([]);
      setHistoryRequested(false);
      return;
    }
    if (!historyRequested) return;
    void loadHistory();
  }, [effectiveSessionStatus, hasHydrated, historyRequested, loadHistory]);

  const clearSelectedImage = () => {
    resetSelectedImage();
    setError("");
    setStatus("idle");
    setResult(null);
    setFeedbackMessage(null);
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
        return data.variants?.find((variant) => variant.available)?.id ?? null;
      }),
    );

    return variants
      .filter((variantId): variantId is string => Boolean(variantId))
      .map((variantId) => ({ variantId, quantity: 1 }));
  };

  const handleFileChange = async (file: File | null) => {
    setIsDraggingFile(false);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(locale === "de" ? "Bitte ein Bild hochladen." : "Please upload an image.");
      return;
    }

    const requestId = prepareRequestRef.current + 1;
    prepareRequestRef.current = requestId;
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
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
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
    if (isPreparingImage || effectiveSessionStatus === "loading") {
      return;
    }
    if (effectiveSessionStatus !== "authenticated") {
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
    setStatus("loading");
    setError("");
    setFeedbackStatus("idle");
    setFeedbackMessage(null);
    setShoppingListStatus("idle");
    setShoppingListMessage(null);
    const controller = new AbortController();
    analyzeAbortRef.current = controller;

    try {
      const formData = new FormData();
      formData.set("file", selectedFile, selectedFile.name);
      if (notes.trim()) {
        formData.set("notes", notes.trim());
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

      const res = await fetch("/api/plant-analyzer", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const data = (await res.json()) as AnalyzerResponse & { error?: string };
      if (!res.ok) {
        setStatus("error");
        setError(
          data.error ??
            (locale === "de" ? "Analyse fehlgeschlagen." : "Analysis failed."),
        );
        return;
      }
      setResult(data);
      setStatus("success");
      if (data.storageWarning) {
        setFeedbackMessage(
          locale === "de"
            ? "Die Analyse wurde berechnet, konnte aber nicht im Verlauf gespeichert werden."
            : "The analysis completed, but it could not be saved to history.",
        );
      }
      if (data.analysisId) {
        setHistoryRequested(true);
        void loadHistory();
      }
    } catch (fetchError) {
      if ((fetchError as Error).name === "AbortError") {
        setStatus("idle");
        return;
      }
      setStatus("error");
      setError(locale === "de" ? "Analyse fehlgeschlagen." : "Analysis failed.");
    } finally {
      if (analyzeAbortRef.current === controller) {
        analyzeAbortRef.current = null;
      }
    }
  };

  const submitFeedback = async ({
    helpful,
    feedbackType,
    successMessage,
  }: {
    helpful: boolean;
    feedbackType: PlantAnalyzerFeedbackClassification;
    successMessage: string;
  }) => {
    if (!result?.analysisId) return;
    await postFeedback({
      analysisId: result.analysisId,
      helpful,
      feedbackType,
      successMessage,
      setStatus: setFeedbackStatus,
      setMessage: setFeedbackMessage,
      onStored: () => {
        setResult((current) =>
          current
            ? {
                ...current,
                lastFeedback: {
                  helpful,
                  classification: feedbackType,
                  recordedAt: new Date().toISOString(),
                },
              }
            : current,
        );
      },
    });
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
          ? `${result.remediation.productBundle.name} wurde als Checkliste in den Warenkorb gelegt.`
          : `${result.remediation.productBundle.name} was added to the cart as a checklist.`,
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
    setSelectedHistoryEntry(entry);
    setSelectedHistoryDetail(null);
    setSelectedHistoryDetailStatus("loading");
    setHistoryFeedbackStatus("idle");
    setHistoryFeedbackMessage(null);
    setHistoryShoppingListStatus("idle");
    setHistoryShoppingListMessage(null);

    try {
      const res = await fetch(`/api/plant-analyzer/history/${entry.id}`, {
        method: "GET",
      });
      if (!res.ok) {
        setSelectedHistoryDetailStatus("error");
        return;
      }
      const data = (await res.json()) as HistoryReportDetail;
      setSelectedHistoryDetail(data);
      setSelectedHistoryDetailStatus("idle");
    } catch {
      setSelectedHistoryDetailStatus("error");
    }
  };

  const closeHistoryReport = () => {
    setSelectedHistoryEntry(null);
    setSelectedHistoryDetail(null);
    setSelectedHistoryDetailStatus("idle");
    setHistoryFeedbackStatus("idle");
    setHistoryFeedbackMessage(null);
    setHistoryShoppingListStatus("idle");
    setHistoryShoppingListMessage(null);
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
  };

  const addHistorySuggestedProductsToCart = async () => {
    if (!selectedHistoryDetail?.productSuggestions?.length) return;
    setHistoryShoppingListStatus("loading");
    setHistoryShoppingListMessage(null);
    try {
      const items = await resolveSuggestedCartItems(
        selectedHistoryDetail.remediation.productBundle.optionalProducts.length > 0 ||
          selectedHistoryDetail.remediation.productBundle.setupHelpers.length > 0
          ? [
              ...selectedHistoryDetail.remediation.productBundle.optionalProducts,
              ...selectedHistoryDetail.remediation.productBundle.setupHelpers,
            ]
          : selectedHistoryDetail.productSuggestions,
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
    <div className="space-y-8">
      <PlantAnalyzerHero locale={locale} onLocaleChange={setLocale} />

      <div className="space-y-6">
        <PlantAnalyzerUploadSection
          inputId={inputId}
          locale={locale}
          pathname={pathname}
          imagePreview={imagePreview}
          imageName={imageName}
          isDraggingFile={isDraggingFile}
          isPreparingImage={isPreparingImage}
          notes={notes}
          analysisContext={analysisContext}
          recheckBaseline={recheckBaseline}
          status={status}
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
          onNotesChange={setNotes}
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
          comparisonEntry={previousAnalysis}
          imagePreview={imagePreview}
          loadingSteps={loadingSteps}
          loadingStepIndex={loadingStepIndex}
          onCancelAnalysis={cancelAnalysis}
          feedbackStatus={feedbackStatus}
          feedbackMessage={feedbackMessage}
          shoppingListStatus={shoppingListStatus}
          shoppingListMessage={shoppingListMessage}
          onHelpful={() => {
            void submitFeedback({
              helpful: true,
              feedbackType: "helpful",
              successMessage:
                locale === "de"
                  ? "Danke. Die Einschätzung wurde als hilfreich markiert."
                  : "Thanks. The result was marked as helpful.",
            });
          }}
          onIssueGuessWrong={() => {
            void submitFeedback({
              helpful: false,
              feedbackType: "issue_guess_wrong",
              successMessage:
                locale === "de"
                  ? "Danke. Die Problemschätzung wurde für die Nachprüfung markiert."
                  : "Thanks. The issue estimate was flagged for review.",
            });
          }}
          onProductSuggestionOff={() => {
            void submitFeedback({
              helpful: false,
              feedbackType: "product_suggestion_off",
              successMessage:
                locale === "de"
                  ? "Danke. Die Produkthinweise wurden als unpassend markiert."
                  : "Thanks. The product suggestions were flagged as off.",
            });
          }}
          onAddShoppingList={() => {
            void addSuggestedProductsToCart();
          }}
        />

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
      </div>

      {showAuthPrompt ? (
        <PlantAnalyzerAuthModal
          locale={locale}
          pathname={pathname}
          onClose={() => setShowAuthPrompt(false)}
        />
      ) : null}

      {selectedHistoryEntry ? (
        <PlantAnalyzerHistoryModal
          locale={locale}
          entry={selectedHistoryEntry}
          detail={selectedHistoryDetail}
          detailStatus={selectedHistoryDetailStatus}
          feedbackStatus={historyFeedbackStatus}
          feedbackMessage={historyFeedbackMessage}
          shoppingListStatus={historyShoppingListStatus}
          shoppingListMessage={historyShoppingListMessage}
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
          onClose={closeHistoryReport}
        />
      ) : null}
    </div>
  );
}
