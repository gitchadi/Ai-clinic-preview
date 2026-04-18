import { NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STABILITY_KEY = (process.env.STABILITY_API_KEY || "").trim();
const STABILITY_URL =
  "https://api.stability.ai/v2beta/stable-image/edit/search-and-replace";

const GEMINI_KEY = (process.env.GEMINI_API_KEY || "").trim();
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

const MAX_GENERATION_ATTEMPTS = 3;

type VisibleArch = "upper_only" | "both" | "none";

type DentalAnalysis = {
  is_valid: boolean;
  visible_arch: VisibleArch;
  error_reason: string;
  score: number;
  analysis: string;
  treatments: string[];
  visible_teeth_summary: string;
  tooth_shape: "oval" | "square" | "triangular" | "mixed" | "unclear";
  smile_width: "narrow" | "medium" | "wide" | "unclear";
  natural_shade_target: "A1" | "A2" | "B1" | "natural_white";
  gum_visibility: "none" | "low" | "medium" | "high" | "unclear";
  improvement_level: "minimal" | "conservative" | "moderate";
  patient_specific_notes: string[];
  edit_priorities: string[];
  risk_factors: string[];
};

type QualityReport = {
  approved: boolean;
  score: number;
  issues: string[];
  retry_guidance: string;
  user_message: string;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

function cleanJsonText(text: string) {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function parseJsonObject<T>(text: string): T {
  return JSON.parse(cleanJsonText(text)) as T;
}

function clampScore(score: unknown, fallback: number) {
  if (typeof score !== "number" || Number.isNaN(score)) return fallback;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : fallback;
}

function createGeminiModel() {
  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" },
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
  });
}

function normalizeDentalAnalysis(value: Partial<DentalAnalysis>): DentalAnalysis {
  const visibleArch: VisibleArch =
    value.visible_arch === "upper_only" ||
    value.visible_arch === "both" ||
    value.visible_arch === "none"
      ? value.visible_arch
      : "none";

  const toothShape = ["oval", "square", "triangular", "mixed", "unclear"].includes(
    value.tooth_shape || "",
  )
    ? value.tooth_shape
    : "unclear";

  const smileWidth = ["narrow", "medium", "wide", "unclear"].includes(
    value.smile_width || "",
  )
    ? value.smile_width
    : "unclear";

  const shadeTarget = ["A1", "A2", "B1", "natural_white"].includes(
    value.natural_shade_target || "",
  )
    ? value.natural_shade_target
    : "A2";

  const gumVisibility = ["none", "low", "medium", "high", "unclear"].includes(
    value.gum_visibility || "",
  )
    ? value.gum_visibility
    : "unclear";

  const improvementLevel = ["minimal", "conservative", "moderate"].includes(
    value.improvement_level || "",
  )
    ? value.improvement_level
    : "conservative";

  return {
    is_valid: value.is_valid === true,
    visible_arch: visibleArch,
    error_reason:
      typeof value.error_reason === "string" ? value.error_reason : "",
    score: clampScore(value.score, 85),
    analysis:
      typeof value.analysis === "string" && value.analysis.trim()
        ? value.analysis.trim()
        : "Analisi estetica completata con successo.",
    treatments: normalizeStringArray(value.treatments, [
      "Preview estetica conservativa del sorriso",
    ]),
    visible_teeth_summary:
      typeof value.visible_teeth_summary === "string"
        ? value.visible_teeth_summary.trim()
        : "Denti anteriori visibili.",
    tooth_shape: toothShape || "unclear",
    smile_width: smileWidth || "unclear",
    natural_shade_target: shadeTarget || "A2",
    gum_visibility: gumVisibility || "unclear",
    improvement_level: improvementLevel || "conservative",
    patient_specific_notes: normalizeStringArray(value.patient_specific_notes, [
      "Preservare proporzioni, ampiezza del sorriso e forma della bocca del paziente.",
    ]),
    edit_priorities: normalizeStringArray(value.edit_priorities, [
      "Migliorare colore e regolarita in modo realistico.",
    ]),
    risk_factors: normalizeStringArray(value.risk_factors, [
      "Evitare denti duplicati, extra o fuori proporzione.",
    ]),
  };
}

function buildAnalysisPrompt() {
  return `Analyze this portrait photo as a senior cosmetic dentist and dental anatomy QA specialist.
Return only valid JSON in Italian. Do not include markdown.

The site purpose is lead generation through a realistic smile preview. Your job is to protect realism and patient-specific anatomy before image generation.

Reject the image if the mouth is closed, teeth are not clearly visible, the face is too blurred, the mouth area is too small, or dental anatomy cannot be judged.

Return this exact JSON shape:
{
  "is_valid": boolean,
  "visible_arch": "upper_only" | "both" | "none",
  "error_reason": "string",
  "score": number,
  "analysis": "Italian string, clinically careful and non-diagnostic",
  "treatments": ["Italian strings"],
  "visible_teeth_summary": "Italian string describing visible incisors, lateral incisors, canines, premolars if visible",
  "tooth_shape": "oval" | "square" | "triangular" | "mixed" | "unclear",
  "smile_width": "narrow" | "medium" | "wide" | "unclear",
  "natural_shade_target": "A1" | "A2" | "B1" | "natural_white",
  "gum_visibility": "none" | "low" | "medium" | "high" | "unclear",
  "improvement_level": "minimal" | "conservative" | "moderate",
  "patient_specific_notes": ["Italian strings about face, lip line, original proportions, age harmony, genetic harmony"],
  "edit_priorities": ["Italian strings describing what should be improved subtly"],
  "risk_factors": ["Italian strings describing what the generator must avoid"]
}

Validation rules:
- "is_valid" must be true only when visible teeth are sufficient for a realistic preview.
- Prefer conservative improvements. This is a preview, not a fantasy makeover.
- The future image must preserve this patient's genetic harmony, mouth size, lip shape, dental arch width, midline, camera angle, lighting, skin, and background.
- Mention any anatomy risk such as hidden laterals, asymmetric visibility, only upper arch visible, shadows, tongue occlusion, gum exposure, low resolution, or risk of duplicated incisors.`;
}

function buildSearchPrompt(analysis: DentalAnalysis) {
  if (analysis.visible_arch === "upper_only") {
    return "visible upper teeth enamel and immediately adjacent gumline only, including central incisors, lateral incisors, canines, visible premolars, stains, chips, gaps, dental irregularities";
  }

  return "visible teeth enamel and immediately adjacent gumline only, including upper and lower incisors, lateral incisors, canines, visible premolars, stains, chips, gaps, dental irregularities";
}

function buildReplacePrompt(
  analysis: DentalAnalysis,
  attempt: number,
  retryGuidance?: string,
) {
  const archInstruction =
    analysis.visible_arch === "upper_only"
      ? "Edit only the visible upper arch. Do not invent a lower arch if it is hidden."
      : "Edit the visible upper and lower teeth only where they are already visible.";

  const retryInstruction = retryGuidance
    ? `Previous quality review found issues. Correct them strictly: ${retryGuidance}`
    : "First generation attempt: prioritize anatomical correctness over cosmetic intensity.";

  const intensityInstruction =
    analysis.improvement_level === "minimal"
      ? "Use a minimal enhancement: mainly natural shade correction and tiny alignment refinement."
      : analysis.improvement_level === "moderate"
        ? "Use a moderate but still realistic cosmetic dentistry preview."
        : "Use a conservative enhancement: natural whitening, subtle regularization, and patient-specific proportions.";

  return `Create a conservative, patient-specific dental aesthetic preview for this exact patient.

${archInstruction}
${intensityInstruction}
${retryInstruction}

Mandatory dental anatomy:
- The upper anterior segment, when visible, must contain exactly two central incisors, two smaller lateral incisors, and two canines in correct left-to-right order.
- Central incisors must be the widest front teeth, lateral incisors must be smaller and slightly different in shape, canines must sit laterally with distinct canine contour.
- Do not duplicate central incisors. Do not create four identical front teeth. Do not turn lateral incisors into central incisors.
- Do not add extra teeth. Do not remove visible teeth. Do not create a flat white block. Do not merge teeth together.
- Preserve natural separators, embrasures, individual tooth boundaries, gum scallop, bite relationship, arch curvature, and smile midline.
- Premolars and molars may appear only if they are already visible in the source image.

Patient-specific constraints:
- Preserve facial identity, mouth size, lip shape, smile width, jaw structure, camera angle, lighting, skin tone, and background.
- Preserve the patient's genetic harmony and original tooth-size family: ${analysis.tooth_shape} tooth shape, ${analysis.smile_width} smile width, ${analysis.gum_visibility} gum visibility.
- Target shade: ${analysis.natural_shade_target}. Natural enamel only, with slight translucency and age-appropriate texture. No pure white porcelain look.
- Keep tiny natural asymmetries so the result looks like realistic dentistry for this patient, not a generic Hollywood smile.

Clinical context from analysis:
Visible teeth: ${analysis.visible_teeth_summary}
Patient notes: ${analysis.patient_specific_notes.join("; ")}
Edit priorities: ${analysis.edit_priorities.join("; ")}
Risks to avoid: ${analysis.risk_factors.join("; ")}

Forbidden artifacts:
extra teeth, missing teeth, duplicated incisors, four central incisors, identical front teeth, oversized veneers, horse teeth, fake gums, distorted tongue, changed lips, changed mouth shape, changed face, unnatural symmetry, cartoon teeth, plastic texture, overexposed white teeth, black gaps that were not present, dental anatomy errors.

Output must be photorealistic, anatomically correct, subtle, clinically believable, and aligned with the patient's own face. Attempt ${attempt}.`;
}

async function analyzeOriginalImage(imageBuffer: Buffer, mimeType: string) {
  const model = createGeminiModel();
  const imagePart = {
    inlineData: { data: imageBuffer.toString("base64"), mimeType },
  };
  const result = await model.generateContent([buildAnalysisPrompt(), imagePart]);
  return normalizeDentalAnalysis(
    parseJsonObject<Partial<DentalAnalysis>>(result.response.text()),
  );
}

async function generateWithStability(
  image: File,
  searchPrompt: string,
  replacePrompt: string,
) {
  const nativeFormData = new FormData();
  nativeFormData.append("image", image);
  nativeFormData.append("search_prompt", searchPrompt);
  nativeFormData.append("prompt", replacePrompt);
  nativeFormData.append("output_format", "png");

  const stabilityResponse = await fetch(STABILITY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STABILITY_KEY}`,
      Accept: "image/*",
    },
    body: nativeFormData,
  });

  if (!stabilityResponse.ok) {
    const errorText = await stabilityResponse.text();
    throw new Error(
      `Stability API Error: ${stabilityResponse.status} - ${errorText}`,
    );
  }

  return Buffer.from(await stabilityResponse.arrayBuffer());
}

function buildQualityPrompt(analysis: DentalAnalysis) {
  return `You are a strict dental anatomy QA reviewer for an AI smile preview.
Compare the original photo and the generated result. Return only valid JSON in Italian, no markdown.

Approve only if the generated image is anatomically correct and commercially usable for a dental preview.

Critical rejection criteria:
- duplicated central incisors
- four identical upper front teeth
- missing lateral incisors when the original anatomy implies they should be visible
- canines shaped like incisors or placed incorrectly
- extra teeth, merged teeth, missing visible teeth
- oversized veneers or pure white fake teeth
- changed lip shape, mouth size, jaw, face, skin, lighting, or background
- smile that does not match patient's genetic/facial harmony
- distorted gums, tongue, bite, arch curvature, or tooth boundaries
- result looks like generic Hollywood smile instead of this specific patient

Expected source context:
Visible arch: ${analysis.visible_arch}
Visible teeth: ${analysis.visible_teeth_summary}
Tooth shape: ${analysis.tooth_shape}
Smile width: ${analysis.smile_width}
Shade target: ${analysis.natural_shade_target}
Gum visibility: ${analysis.gum_visibility}
Patient notes: ${analysis.patient_specific_notes.join("; ")}

Return this exact JSON shape:
{
  "approved": boolean,
  "score": number,
  "issues": ["Italian strings"],
  "retry_guidance": "English prompt guidance for the image generator, very specific and corrective",
  "user_message": "Italian string for the app if all attempts fail"
}`;
}

function normalizeQualityReport(value: Partial<QualityReport>): QualityReport {
  return {
    approved: value.approved === true,
    score: clampScore(value.score, 0),
    issues: normalizeStringArray(value.issues, [
      "Controllo qualita non conclusivo.",
    ]),
    retry_guidance:
      typeof value.retry_guidance === "string" && value.retry_guidance.trim()
        ? value.retry_guidance.trim()
        : "Regenerate with stricter tooth anatomy: exactly two central incisors, two smaller lateral incisors, distinct canines, no extra teeth, preserve the patient's original mouth and lips.",
    user_message:
      typeof value.user_message === "string" && value.user_message.trim()
        ? value.user_message.trim()
        : "La foto non consente una simulazione sufficientemente affidabile. Prova con una foto piu nitida, frontale e con i denti ben visibili.",
  };
}

async function reviewGeneratedImage(
  originalImageBuffer: Buffer,
  originalMimeType: string,
  generatedImageBuffer: Buffer,
  analysis: DentalAnalysis,
) {
  const model = createGeminiModel();
  const originalPart = {
    inlineData: {
      data: originalImageBuffer.toString("base64"),
      mimeType: originalMimeType,
    },
  };
  const generatedPart = {
    inlineData: {
      data: generatedImageBuffer.toString("base64"),
      mimeType: "image/png",
    },
  };

  const result = await model.generateContent([
    buildQualityPrompt(analysis),
    originalPart,
    generatedPart,
  ]);

  return normalizeQualityReport(
    parseJsonObject<Partial<QualityReport>>(result.response.text()),
  );
}

export async function POST(request: Request) {
  try {
    if (!GEMINI_KEY || !STABILITY_KEY) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY and STABILITY_API_KEY must be configured for generation.",
        },
        { status: 500 },
      );
    }

    const body = await request.formData();
    const image = body.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Missing image" }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const mimeType = image.type || "image/jpeg";

    console.log("1. Analisi dentale Gemini in corso...");
    const analysis = await analyzeOriginalImage(imageBuffer, mimeType);

    if (!analysis.is_valid || analysis.visible_arch === "none") {
      return NextResponse.json(
        {
          is_rejected: true,
          message:
            analysis.error_reason ||
            "Bocca chiusa o denti non visibili. Carica un'altra foto.",
        },
        { status: 200 },
      );
    }

    const searchPrompt = buildSearchPrompt(analysis);
    let retryGuidance: string | undefined;
    let bestResult: Buffer | null = null;
    let bestReview: QualityReport | null = null;

    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
      console.log(`2.${attempt} Generazione Stability con prompt anatomico...`);
      const replacePrompt = buildReplacePrompt(
        analysis,
        attempt,
        retryGuidance,
      );
      const generatedBuffer = await generateWithStability(
        image,
        searchPrompt,
        replacePrompt,
      );

      console.log(`3.${attempt} Controllo qualita Gemini sul risultato...`);
      const review = await reviewGeneratedImage(
        imageBuffer,
        mimeType,
        generatedBuffer,
        analysis,
      );

      if (!bestReview || review.score > bestReview.score) {
        bestReview = review;
        bestResult = generatedBuffer;
      }

      if (review.approved && review.score >= 82) {
        bestReview = review;
        bestResult = generatedBuffer;
        break;
      }

      retryGuidance = review.retry_guidance;
    }

    if (!bestResult || !bestReview || bestReview.score < 65) {
      return NextResponse.json(
        {
          is_rejected: true,
          message:
            bestReview?.user_message ||
            "Non siamo riusciti a generare una simulazione abbastanza realistica. Prova con una foto piu nitida e frontale.",
          qualityIssues: bestReview?.issues || [],
        },
        { status: 200 },
      );
    }

    const resultBase64 = bestResult.toString("base64");
    const outputUrl = `data:image/png;base64,${resultBase64}`;

    return NextResponse.json({
      outputUrl,
      realSmileScore: analysis.score,
      aiAnalysisText: analysis.analysis,
      autoTreatments: analysis.treatments,
      qualityScore: bestReview.score,
      qualityIssues: bestReview.issues,
      is_rejected: false,
    });
  } catch (error: unknown) {
    console.error("Server Error:", errorMessage(error));
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
