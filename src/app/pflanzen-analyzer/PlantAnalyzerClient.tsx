"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { prepareAnalyzerImageFile } from "@/app/pflanzen-analyzer/clientImageUpload";
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
  const analysisSectionRef = useRef<HTMLElement | null>(null);
  const shouldAutoScrollToAnalysisRef = useRef(false);
  const previewUrlRef = useRef<string | null>(null);
  const prepareRequestRef = useRef(0);
  const analyzeAbortRef = useRef<AbortController | null>(null);
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
    const controller = new AbortController();
    analyzeAbortRef.current = controller;

    try {
      const formData = new FormData();
      formData.set("file", selectedFile, selectedFile.name);
      if (notes.trim()) {
        formData.set("notes", notes.trim());
      }

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
      setHistoryRequested(true);
      void loadHistory();
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

  const openHistoryReport = async (entry: AnalysisHistoryEntry) => {
    setSelectedHistoryEntry(entry);
    setSelectedHistoryDetail(null);
    setSelectedHistoryDetailStatus("loading");

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
          loadingSteps={loadingSteps}
          loadingStepIndex={loadingStepIndex}
          onCancelAnalysis={cancelAnalysis}
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
          onClose={closeHistoryReport}
        />
      ) : null}
    </div>
  );
}
