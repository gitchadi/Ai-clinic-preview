"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  CloudUpload,
  LoaderCircle,
  ScanFace,
  Smile,
  Sparkles,
} from "lucide-react";

import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import type { TreatmentType } from "@/lib/prompts";

const loadingMessages = [
  "Uploading secure image...",
  "Analyzing facial symmetry...",
  "Applying AI magic...",
];

const treatments: Array<{
  id: TreatmentType;
  title: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  {
    id: "whitening",
    title: "Smile Whitening",
    description: "Brighten enamel with premium, natural-looking enhancement.",
    icon: Sparkles,
  },
  {
    id: "alignment",
    title: "Alignment Preview",
    description: "Visualize subtle straightening and a more balanced smile line.",
    icon: Smile,
  },
  {
    id: "skin",
    title: "Skin Refresh",
    description: "Preview refined tone and texture with realistic clinic polish.",
    icon: ScanFace,
  },
];

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type ToastType = Exclude<ToastState, null>["type"];

export default function Home() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [treatment, setTreatment] = useState<TreatmentType>("whitening");
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingText, setLoadingText] = useState(loadingMessages[0]);
  const [resultUrl, setResultUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const isBusy = isUploading || isGenerating;

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!isBusy) {
      setLoadingText(loadingMessages[0]);
      return;
    }

    let index = 0;
    const interval = window.setInterval(() => {
      index = (index + 1) % loadingMessages.length;
      setLoadingText(loadingMessages[index]);
    }, 1700);

    return () => window.clearInterval(interval);
  }, [isBusy]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 4200);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  const ctaLabel = useMemo(() => {
    if (isBusy) {
      return loadingText;
    }

    return "Generate My Preview";
  }, [isBusy, loadingText]);

  const showToast = (type: ToastType, message: string) => {
    setToast(type ? { type, message } : null);
  };

  const resetPreview = () => {
    setResultUrl("");
  };

  const handleFileSelection = (file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      showToast("error", "Please upload a valid image file.");
      return;
    }

    if (previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(nextPreviewUrl);
    resetPreview();
    showToast("success", "Image selected. Choose a treatment to continue.");
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFileSelection(event.dataTransfer.files?.[0] ?? null);
  };

  const handleGenerate = async () => {
    if (!selectedFile) {
      showToast("error", "Upload a patient photo before generating a preview.");
      return;
    }

    setIsUploading(true);
    setIsGenerating(false);
    setResultUrl("");

    try {
      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: selectedFile.name,
          contentType: selectedFile.type || "application/octet-stream",
        }),
      });

      const uploadPayload = (await uploadResponse.json()) as {
        uploadUrl?: string;
        fileUrl?: string;
        error?: string;
      };

      if (!uploadResponse.ok || !uploadPayload.uploadUrl || !uploadPayload.fileUrl) {
        throw new Error(uploadPayload.error || "Unable to prepare secure upload.");
      }

      const directUpload = await fetch(uploadPayload.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type || "application/octet-stream",
        },
        body: selectedFile,
      });

      if (!directUpload.ok) {
        throw new Error("Secure upload failed. Please try again.");
      }

      setIsUploading(false);
      setIsGenerating(true);
      setLoadingText(loadingMessages[1]);

      const generateResponse = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: uploadPayload.fileUrl,
          treatmentType: treatment,
        }),
      });

      const generatePayload = (await generateResponse.json()) as {
        outputUrl?: string;
        error?: string;
      };

      if (!generateResponse.ok || !generatePayload.outputUrl) {
        throw new Error(generatePayload.error || "AI preview generation failed.");
      }

      setResultUrl(generatePayload.outputUrl);
      showToast("success", "Preview generated successfully.");
    } catch (error) {
      showToast(
        "error",
        error instanceof Error
          ? error.message
          : "Something went wrong while generating the preview.",
      );
    } finally {
      setIsUploading(false);
      setIsGenerating(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.35),_transparent_30%),linear-gradient(180deg,_#f8fdff_0%,_#e7f7fb_45%,_#eff6ff_100%)] text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-16 h-64 w-64 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="absolute right-[-4rem] top-24 h-72 w-72 rounded-full bg-blue-400/25 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-teal-300/20 blur-3xl" />
      </div>

      {toast ? (
        <div className="fixed inset-x-0 top-5 z-50 flex justify-center px-4">
          <div
            className={`w-full max-w-md rounded-2xl border px-5 py-4 shadow-2xl backdrop-blur-2xl ${
              toast.type === "error"
                ? "border-rose-300/50 bg-rose-500/15 text-rose-950"
                : "border-cyan-200/60 bg-white/70 text-slate-900"
            }`}
          >
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      ) : null}

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 py-10 lg:px-10 lg:py-14">
        <div className="rounded-[2rem] border border-white/30 bg-white/45 p-6 shadow-[0_30px_120px_rgba(15,23,42,0.12)] backdrop-blur-2xl sm:p-8 lg:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/60 bg-white/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-900 backdrop-blur-xl">
                <Sparkles className="h-4 w-4" />
                AI Preview Project for Clinics
              </div>

              <div className="space-y-5">
                <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-6xl lg:text-7xl">
                  Preview Your Dream Smile
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                  A premium before-and-after visualization flow for dental and
                  aesthetic clinics. Upload a patient photo, pick a treatment,
                  and generate a luxurious consultation-ready preview in minutes.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  "Medical-trust visual language",
                  "Secure upload and generation flow",
                  "Consultation-ready preview experience",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/35 bg-white/55 p-4 text-sm text-slate-700 shadow-lg backdrop-blur-xl"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-cyan-300/30 via-white/15 to-blue-400/20 blur-2xl" />
              <div className="relative rounded-[2rem] border border-white/35 bg-slate-950/[0.05] p-5 backdrop-blur-2xl">
                <div className="rounded-[1.8rem] border border-white/30 bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(226,248,255,0.36))] p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-2xl border border-white/35 bg-white/65 px-4 py-3 backdrop-blur-xl">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-700">
                          Preview Engine
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Smile, alignment, and aesthetic enhancement
                        </p>
                      </div>
                      <div className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 p-3 text-white shadow-lg">
                        <Sparkles className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {treatments.map((item) => {
                        const Icon = item.icon;

                        return (
                          <div
                            key={item.id}
                            className={`rounded-2xl border p-4 transition duration-300 ${
                              treatment === item.id
                                ? "border-cyan-300/70 bg-white/80 shadow-lg"
                                : "border-white/30 bg-white/45"
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 p-3 text-white shadow-lg">
                                <Icon className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {item.title}
                                </p>
                                <p className="text-sm text-slate-600">
                                  {item.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-white/30 bg-white/45 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-800">
                  Upload Patient Photo
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                  Secure Consultation Preview
                </h2>
              </div>
              <div className="rounded-2xl border border-white/40 bg-white/60 p-3 text-cyan-700">
                <CloudUpload className="h-6 w-6" />
              </div>
            </div>

            <div
              className={`group relative flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border border-dashed p-8 text-center transition duration-300 ${
                isDragging
                  ? "border-cyan-400 bg-cyan-400/10"
                  : "border-cyan-200/70 bg-white/35 hover:border-cyan-300 hover:bg-white/55"
              }`}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <input
                ref={inputRef}
                accept="image/*"
                className="hidden"
                type="file"
                onChange={(event) =>
                  handleFileSelection(event.target.files?.[0] ?? null)
                }
              />

              {previewUrl ? (
                <div className="relative w-full overflow-hidden rounded-[1.5rem] border border-white/40 bg-white/40 p-3 shadow-xl">
                  <Image
                    alt="Selected preview"
                    className="aspect-[4/5] w-full rounded-[1.2rem] object-cover"
                    height={1200}
                    src={previewUrl}
                    width={960}
                  />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <div className="rounded-2xl border border-white/25 bg-slate-950/45 px-4 py-3 text-left text-white backdrop-blur-xl">
                      <p className="truncate text-sm font-semibold">
                        {selectedFile?.name}
                      </p>
                      <p className="mt-1 text-xs text-white/75">
                        Ready for secure upload and AI transformation
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-xl">
                    <CloudUpload className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-slate-900">
                      Drag &amp; drop an image here
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Or click to browse. Use a clear front-facing portrait for
                      the most realistic whitening, alignment, or skin preview.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {treatments.map((item) => {
                const Icon = item.icon;
                const active = treatment === item.id;

                return (
                  <button
                    key={item.id}
                    className={`rounded-[1.5rem] border p-5 text-left transition duration-300 ${
                      active
                        ? "border-cyan-300/70 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 shadow-lg"
                        : "border-white/35 bg-white/50 hover:bg-white/70"
                    }`}
                    disabled={isBusy}
                    type="button"
                    onClick={() => {
                      setTreatment(item.id);
                      resetPreview();
                    }}
                  >
                    <div className="mb-4 inline-flex rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 p-3 text-white shadow-lg">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <button
              className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 px-7 py-4 text-base font-semibold text-white shadow-[0_20px_50px_rgba(8,145,178,0.35)] transition duration-300 hover:scale-[1.01] hover:shadow-[0_24px_60px_rgba(14,116,144,0.4)] disabled:cursor-not-allowed disabled:opacity-80"
              disabled={!selectedFile || isBusy}
              type="button"
              onClick={handleGenerate}
            >
              {isBusy ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <ArrowRight className="h-5 w-5" />
              )}
              {ctaLabel}
            </button>
          </div>

          <div className="rounded-[2rem] border border-white/30 bg-white/45 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-800">
                  Live Result
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                  Before &amp; After Preview
                </h2>
              </div>
              <div className="rounded-2xl border border-white/40 bg-white/60 p-3 text-cyan-700">
                <ScanFace className="h-6 w-6" />
              </div>
            </div>

            {resultUrl && previewUrl ? (
              <div className="space-y-6">
                <BeforeAfterSlider generated={resultUrl} original={previewUrl} />

                <a
                  className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-cyan-300/50 bg-white/75 px-7 py-4 text-base font-semibold text-slate-950 shadow-lg backdrop-blur-xl transition hover:bg-white"
                  href="#consultation"
                >
                  Book Free Consultation
                  <ArrowRight className="h-5 w-5" />
                </a>
              </div>
            ) : (
              <div className="flex min-h-[36rem] flex-col justify-between rounded-[1.75rem] border border-white/35 bg-[linear-gradient(180deg,rgba(255,255,255,0.65),rgba(236,254,255,0.4))] p-6">
                <div className="space-y-4">
                  <div className="inline-flex rounded-full border border-cyan-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-800">
                    Consultation-Ready
                  </div>
                  <h3 className="text-2xl font-semibold tracking-[-0.04em] text-slate-900">
                    Elegant AI transformation preview
                  </h3>
                  <p className="text-sm leading-7 text-slate-600">
                    Upload an image and select a treatment to reveal a polished
                    side-by-side consultation preview for your clinic.
                  </p>
                </div>

                <div className="rounded-[1.5rem] border border-white/35 bg-slate-950/[0.03] p-5">
                  <div className="grid gap-4">
                    {[
                      "Secure presigned upload",
                      "Realistic identity-preserving enhancement",
                      "Luxury patient presentation experience",
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-3 rounded-2xl border border-white/35 bg-white/60 px-4 py-4"
                      >
                        <div className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 p-2 text-white">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section
          id="consultation"
          className="rounded-[2rem] border border-white/30 bg-[linear-gradient(135deg,rgba(6,182,212,0.15),rgba(37,99,235,0.18),rgba(255,255,255,0.55))] p-8 shadow-[0_30px_120px_rgba(15,23,42,0.12)] backdrop-blur-2xl sm:p-10"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-900">
                Premium Clinic Experience
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl">
                Turn curiosity into confident consultations
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-700">
                Designed to create immediate trust, reduce patient hesitation,
                and elevate aesthetic treatment conversations with vivid, highly
                realistic previews.
              </p>
            </div>

            <button
              className="inline-flex items-center justify-center gap-3 rounded-full bg-slate-950 px-7 py-4 text-base font-semibold text-white shadow-xl transition hover:bg-slate-800"
              type="button"
            >
              Book Free Consultation
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
