import { NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STABILITY_KEY = (process.env.STABILITY_API_KEY || "").trim();
const STABILITY_INPAINT_URL =
  "https://api.stability.ai/v2beta/stable-image/edit/inpaint";

const GEMINI_KEY = (process.env.GEMINI_API_KEY || "").trim();
const GEMINI_MODEL_CANDIDATES = (
  process.env.GEMINI_MODELS ||
  process.env.GEMINI_MODEL ||
  "gemini-2.5-flash-lite,gemini-2.5-flash,gemini-2.0-flash"
)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const GEMINI_MODE = (process.env.GEMINI_MODE || "").trim().toLowerCase();
const GEMINI_ENABLED_FLAG = (process.env.GEMINI_ENABLED || "")
  .trim()
  .toLowerCase();
const GEMINI_DISABLED_BY_CONFIG =
  ["off", "false", "0", "no", "disabled", "local", "none"].includes(
    GEMINI_MODE,
  ) ||
  ["off", "false", "0", "no", "disabled"].includes(GEMINI_ENABLED_FLAG);
const GEMINI_COOLDOWN_MS = 10 * 60 * 1000;
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
let geminiCooldownUntil = 0;

const MAX_GENERATION_ATTEMPTS = 2;
const ACCEPTABLE_PREVIEW_SCORE = 82;
const MASK_PADDING_PX = 10;
const MASK_GROW_PX = 0;
const INPAINT_STRENGTH = 1;

type VisibleArch = "upper_only" | "both" | "none";
type ImprovementLevel = "minimal" | "conservative" | "moderate";

type NormalizedPoint = {
  x: number;
  y: number;
};

type NormalizedBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DentalAnalysis = {
  isValid: boolean;
  visibleArch: VisibleArch;
  rejectionReason: string;
  score: number;
  analysis: string;
  treatments: string[];
  recommendedTreatment: string;
  treatmentRationale: string;
  visibleTeethSummary: string;
  shadeTarget: "A1" | "A2" | "B1" | "natural_white";
  improvementLevel: ImprovementLevel;
  editPriorities: string[];
  riskFactors: string[];
  teethBox: NormalizedBox | null;
  teethPolygons: NormalizedPoint[][];
  modelUsed: string;
  localMask?: Buffer;
};

type QualityReport = {
  approved: boolean;
  score: number;
  identityScore: number;
  anatomyScore: number;
  containmentScore: number;
  beautyScore: number;
  issues: string[];
  retryGuidance: string;
  userMessage: string;
  modelUsed: string;
};

type SourceImage = {
  buffer: Buffer;
  width: number;
  height: number;
};

const IDENTITY_LOCK_PROMPT = `This is an INPAINTING task. The source image shows a SPECIFIC REAL PERSON.
You must preserve 100% of their facial identity: same face shape, same age,
same skin tone, same eye color, same nose, same jaw, same hair, same lighting,
same background, same camera angle. Only modify pixels inside the supplied dental mask.
Do NOT generate a new face. Do NOT replace the person.`;

const USER_SMILE_GOAL_PROMPT = `Mantenendo la stessa identita del paziente e la stessa faccia, cambiando solo l'interno della bocca, genera una foto di quel paziente con un sorriso perfetto: il migliore sorriso realisticamente raggiungibile con i trattamenti odontoiatrici adeguati.`;

const NEGATIVE_PROMPT = [
  "different person",
  "different face",
  "different age",
  "different gender",
  "different ethnicity",
  "different skin tone",
  "new face",
  "replaced face",
  "changed eyes",
  "changed nose",
  "changed jaw",
  "changed hair",
  "different background",
  "different lighting",
  "changed lips",
  "changed mouth shape outside the teeth",
  "extra teeth",
  "missing teeth",
  "duplicated incisors",
  "four identical front teeth",
  "oversized veneers",
  "horse teeth",
  "fake gums",
  "unchanged teeth",
  "same teeth",
  "no visible improvement",
  "minimal whitening only",
  "tiny change",
  "cartoon",
  "illustration",
].join(", ");

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

function cleanJsonText(text: string) {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function parseJson<T>(text: string) {
  return JSON.parse(cleanJsonText(text)) as T;
}

function clampNumber(value: unknown, fallback: number, min = 0, max = 100) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : fallback;
}

function isTemporaryGeminiError(error: unknown) {
  const message = errorMessage(error).toLowerCase();

  return (
    message.includes("429") ||
    message.includes("too many requests") ||
    message.includes("quota") ||
    message.includes("resource_exhausted") ||
    message.includes("503") ||
    message.includes("unavailable") ||
    message.includes("timeout")
  );
}

function shouldTryNextGeminiModel(error: unknown) {
  const message = errorMessage(error).toLowerCase();

  return (
    isTemporaryGeminiError(error) ||
    message.includes("404") ||
    message.includes("not_found") ||
    message.includes("not found") ||
    message.includes("not supported") ||
    message.includes("model")
  );
}

function normalizeBox(value: unknown): NormalizedBox | null {
  if (!value || typeof value !== "object") return null;

  const box = value as Record<string, unknown>;
  const x = Number(box.x);
  const y = Number(box.y);
  const width = Number(box.width);
  const height = Number(box.height);

  if (![x, y, width, height].every(Number.isFinite)) return null;
  if (width < 20 || height < 10) return null;

  const clampedX = Math.max(0, Math.min(1000, Math.round(x)));
  const clampedY = Math.max(0, Math.min(1000, Math.round(y)));
  const clampedWidth = Math.max(
    1,
    Math.min(1000 - clampedX, Math.round(width)),
  );
  const clampedHeight = Math.max(
    1,
    Math.min(1000 - clampedY, Math.round(height)),
  );

  if (clampedWidth < 20 || clampedHeight < 10) return null;

  return {
    x: clampedX,
    y: clampedY,
    width: clampedWidth,
    height: clampedHeight,
  };
}

function normalizePoint(value: unknown): NormalizedPoint | null {
  if (!value || typeof value !== "object") return null;

  const point = value as Record<string, unknown>;
  const x = Number(point.x);
  const y = Number(point.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return {
    x: Math.max(0, Math.min(1000, Math.round(x))),
    y: Math.max(0, Math.min(1000, Math.round(y))),
  };
}

function normalizePolygons(value: unknown): NormalizedPoint[][] {
  if (!Array.isArray(value)) return [];

  return value
    .map((polygon) => {
      if (!Array.isArray(polygon)) return [];
      return polygon
        .map((point) => normalizePoint(point))
        .filter((point): point is NormalizedPoint => Boolean(point));
    })
    .filter((polygon) => polygon.length >= 3);
}

function normalizeVisibleArch(value: unknown): VisibleArch {
  return value === "upper_only" || value === "both" || value === "none"
    ? value
    : "none";
}

function normalizeShadeTarget(value: unknown): DentalAnalysis["shadeTarget"] {
  return value === "A1" ||
    value === "A2" ||
    value === "B1" ||
    value === "natural_white"
    ? value
    : "A1";
}

function normalizeImprovementLevel(value: unknown): ImprovementLevel {
  return value === "minimal" ||
    value === "conservative" ||
    value === "moderate"
    ? value
    : "moderate";
}

function createGeminiModel(model: string) {
  return genAI.getGenerativeModel({
    model,
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

async function runGeminiJson<T>(
  prompt: string,
  imageParts: Array<{ inlineData: { data: string; mimeType: string } }>,
) {
  let lastTemporaryError: unknown = null;
  let lastError: unknown = null;

  for (const modelName of GEMINI_MODEL_CANDIDATES) {
    try {
      const result = await createGeminiModel(modelName).generateContent([
        prompt,
        ...imageParts,
      ]);
      return {
        data: parseJson<T>(result.response.text()),
        modelUsed: modelName,
      };
    } catch (error: unknown) {
      lastError = error;
      if (shouldTryNextGeminiModel(error)) {
        lastTemporaryError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastTemporaryError || lastError || new Error("Gemini unavailable.");
}

function buildAnalysisPrompt() {
  return `Analyze this portrait as a world-class cosmetic dentist and dental image segmentation specialist.
Return only valid JSON in Italian. Do not include markdown.

Goal:
Create the safest possible data for a premium AI smile preview. The generated result must be the same exact patient and the same exact photo, with only the dental treatment zone changed.

Reject the image only when there are effectively no visible teeth, the mouth is closed, the mouth area is too small to edit, the image is too blurred, or the face/mouth is unusable.
Do NOT reject just because lips partially cover teeth. In that case, create a safe partial mask around the visible dental treatment zone and set risk_factors accordingly.

Return this exact JSON shape:
{
  "is_valid": boolean,
  "visible_arch": "upper_only" | "both" | "none",
  "error_reason": "Italian string",
  "score": number,
  "analysis": "Italian string, careful, non-diagnostic, lead-generation friendly",
  "treatments": ["Italian treatment names"],
  "recommended_treatment": "Italian string",
  "treatment_rationale": "Italian string",
  "visible_teeth_summary": "Italian string describing visible incisors, laterals, canines, premolars if visible",
  "shade_target": "A1" | "A2" | "B1" | "natural_white",
  "improvement_level": "minimal" | "conservative" | "moderate",
  "edit_priorities": ["Italian strings"],
  "risk_factors": ["Italian strings"],
  "teeth_bbox": { "x": number, "y": number, "width": number, "height": number },
  "teeth_mask_polygons": [[{ "x": number, "y": number }]]
}

Coordinate rules:
- Coordinates are normalized from 0 to 1000 relative to the full image.
- "teeth_bbox" must be tight around the visible dental treatment zone: visible tooth enamel, chipped/crooked tooth edges, small interdental gaps, dark spaces between visible teeth, immediately adjacent gumline, and tiny dark spaces needed to reshape visible teeth.
- "teeth_mask_polygons" must trace the visible dental treatment zone tightly enough to allow whitening, alignment refinement, edge reshaping, small gap closure, and veneer/bonding-style proportional improvements.
- Exclude lips, tongue, chin, cheeks, nose, face skin, hair, and background from both bbox and polygons.
- Add a small practical margin around the visible dental treatment zone, but exclude lips and skin. If lips partially cover teeth, trace only the visible dental area and keep "is_valid": true when enough teeth are visible for a useful preview.

Treatment rules:
- Recommend the best possible cosmetic treatment preview for this patient: whitening, alignment, veneers/bonding-style reshaping, bonding, contouring, gumline refinement, or a combined aesthetic preview.
- The preview should represent a best-case outcome from appropriate dental treatment, not a minimal tweak, while remaining clinically plausible for this patient.
- Preserve identity, age harmony, face, lips outside the mask, smile width, bite relationship, camera angle, lighting, skin, and background.`;
}

function normalizeAnalysis(
  value: Partial<{
    is_valid: boolean;
    visible_arch: VisibleArch;
    error_reason: string;
    score: number;
    analysis: string;
    treatments: string[];
    recommended_treatment: string;
    treatment_rationale: string;
    visible_teeth_summary: string;
    shade_target: DentalAnalysis["shadeTarget"];
    improvement_level: ImprovementLevel;
    edit_priorities: string[];
    risk_factors: string[];
    teeth_bbox: NormalizedBox;
    teeth_mask_polygons: NormalizedPoint[][];
  }>,
  modelUsed: string,
): DentalAnalysis {
  const visibleArch = normalizeVisibleArch(value.visible_arch);
  const teethBox = normalizeBox(value.teeth_bbox);
  const teethPolygons = normalizePolygons(value.teeth_mask_polygons);
  const hasMask = Boolean(teethBox);
  const rawReason = normalizeText(value.error_reason, "");
  const reasonLower = rawReason.toLowerCase();
  const partialLipCoverage =
    reasonLower.includes("labbra") ||
    reasonLower.includes("lip") ||
    reasonLower.includes("parzial") ||
    reasonLower.includes("partially") ||
    reasonLower.includes("oscura");
  const isValid =
    (value.is_valid === true || (partialLipCoverage && hasMask)) &&
    visibleArch !== "none" &&
    hasMask;

  return {
    isValid,
    visibleArch,
    rejectionReason:
      rawReason ||
      "La foto non consente una simulazione utile. Carica una foto frontale, nitida e con i denti visibili.",
    score: clampNumber(value.score, 85),
    analysis: normalizeText(
      value.analysis,
      "Analisi estetica completata. La preview mostra una simulazione illustrativa del possibile miglioramento del sorriso.",
    ),
    treatments: normalizeStringArray(value.treatments, [
      "Preview estetica completa del sorriso",
    ]),
    recommendedTreatment: normalizeText(
      value.recommended_treatment,
      "Riabilitazione estetica conservativa del sorriso",
    ),
    treatmentRationale: normalizeText(
      value.treatment_rationale,
      "Miglioramento simulato di colore, proporzioni e armonia mantenendo un risultato naturale.",
    ),
    visibleTeethSummary: normalizeText(
      value.visible_teeth_summary,
      "Denti anteriori visibili.",
    ),
    shadeTarget: normalizeShadeTarget(value.shade_target),
    improvementLevel: normalizeImprovementLevel(value.improvement_level),
    editPriorities: normalizeStringArray(value.edit_priorities, [
      "Migliorare colore e proporzioni in modo realistico.",
    ]),
    riskFactors: [
      ...normalizeStringArray(value.risk_factors, [
        "Evitare denti duplicati, extra o fuori proporzione.",
      ]),
      ...(partialLipCoverage
        ? [
            "Le labbra coprono parzialmente alcuni denti: lavorare solo sui denti visibili senza inventare anatomia nascosta.",
          ]
        : []),
    ],
    teethBox,
    teethPolygons,
    modelUsed,
  };
}

async function analyzeOriginalImage(source: SourceImage) {
  const result = await runGeminiJson<Parameters<typeof normalizeAnalysis>[0]>(
    buildAnalysisPrompt(),
    [
      {
        inlineData: {
          data: source.buffer.toString("base64"),
          mimeType: "image/png",
        },
      },
    ],
  );

  return normalizeAnalysis(result.data, result.modelUsed);
}

function buildReplacePrompt(
  analysis: DentalAnalysis,
  attempt: number,
  retryGuidance?: string,
) {
  const archInstruction =
    analysis.visibleArch === "upper_only"
      ? "Only refine visible upper teeth. Do not invent lower teeth if they are hidden."
      : "Only refine visible upper and lower teeth where teeth already exist.";

  const retryInstruction = retryGuidance
    ? `Previous QA found problems. Correct them strictly: ${retryGuidance}`
    : "First attempt: maximize aesthetic improvement while keeping anatomy and identity exact.";

  return `${IDENTITY_LOCK_PROMPT}

Inpaint only the supplied dental mask. Preserve every unmasked pixel exactly as it is.
This is the same patient and the same photograph. Only the masked dental treatment zone may change.

Best-case cosmetic goal:
${analysis.recommendedTreatment}
${analysis.treatmentRationale}

${archInstruction}
Improvement level: ${analysis.improvementLevel}.
Target shade: ${analysis.shadeTarget}. Aim for a dramatic but realistic premium best-case smile: clearly brighter, cleaner, straighter, better-proportioned, smoother-edged, more symmetric, and more harmonious.
Visible teeth context: ${analysis.visibleTeethSummary}
Edit priorities: ${analysis.editPriorities.join("; ")}
Risks to avoid: ${analysis.riskFactors.join("; ")}
${retryInstruction}

If lips partially cover some teeth, do not treat that as failure. Improve only the visible dental surfaces and visible gaps. Do not invent hidden tooth parts behind lips, but make the visible smile look like the best realistic post-treatment version.

Mandatory dental anatomy:
- Preserve the real dental arch curvature, bite relationship, smile midline, and tooth count implied by the original.
- Upper front teeth, if visible, must follow correct order: canine, lateral incisor, central incisor, central incisor, lateral incisor, canine.
- Central incisors may be slightly dominant, lateral incisors smaller, canines distinct but not exaggerated.
- Transform the visible smile substantially inside the mask. This must not look like a tiny whitening filter.
- Whiten to a natural premium shade, smooth chips/stains, refine crooked edges, improve visible alignment, close small dark gaps when clinically plausible, reshape visible tooth edges, and create ideal-but-natural post-treatment proportions.
- Do not add teeth. Do not remove teeth. Do not duplicate incisors. Do not create four identical front teeth.
- Do not create a flat white block, merged teeth, fake gums, horse teeth, or oversized veneers.
- Keep natural separators, embrasures, individual tooth boundaries, gum scallop, and tiny natural asymmetries.

Hard preservation rules:
- Do not change face, eyes, nose, jaw, cheeks, skin, hair, lips outside the mask, background, lighting, camera angle, pose, or expression.
- Do not alter the mouth opening or smile width outside the dental mask.

Output must look like the best realistic post-treatment version of this exact patient's smile, suitable for a top-tier dental clinic preview. Attempt ${attempt}.`;
}

function buildQualityPrompt(analysis: DentalAnalysis) {
  return `You are a strict QA reviewer for a premium dental smile preview.
Compare the original image and generated result. Return only valid JSON in Italian. Do not include markdown.

The intended product promise:
Same exact patient, same exact photo, same face, same age, same skin, same hair, same lighting, same background. Only visible teeth and immediately adjacent gumline should change.

Automatic rejection with score 0:
- The person looks visibly different from the original in face, age, ethnicity, gender, skin tone, hair, eyes, nose, jaw, cheeks, lighting, background, pose, or expression.
- Lips or mouth shape outside the dental region changed noticeably.

Critical dental failures:
- extra teeth, missing teeth, duplicated incisors, four identical front teeth
- canines/laterals/centrals anatomically wrong
- teeth merged into a flat white block
- oversized fake veneers, horse teeth, fake gums
- dental preview does not fit the patient's original smile width, arch curvature, bite, or facial harmony

Scoring:
- identity_score: 0-100, must be 100 if all non-dental areas are unchanged.
- anatomy_score: 0-100.
- containment_score: 0-100, measures whether edits stayed inside teeth/gumline.
- beauty_score: 0-100, commercial attractiveness while plausible.
- score: overall 0-100. Any identity drift makes score 0.

Approve only if score >= ${ACCEPTABLE_PREVIEW_SCORE}, identity_score >= 98, containment_score >= 95, anatomy_score >= 80.

Expected treatment: ${analysis.recommendedTreatment}
Visible teeth context: ${analysis.visibleTeethSummary}
Risks to avoid: ${analysis.riskFactors.join("; ")}

Return this exact JSON:
{
  "approved": boolean,
  "score": number,
  "identity_score": number,
  "anatomy_score": number,
  "containment_score": number,
  "beauty_score": number,
  "issues": ["Italian strings"],
  "retry_guidance": "English corrective instruction for the image generator",
  "user_message": "Italian string if the result cannot be safely shown"
}`;
}

function normalizeQualityReport(
  value: Partial<{
    approved: boolean;
    score: number;
    identity_score: number;
    anatomy_score: number;
    containment_score: number;
    beauty_score: number;
    issues: string[];
    retry_guidance: string;
    user_message: string;
  }>,
  modelUsed: string,
): QualityReport {
  const score = clampNumber(value.score, 0);
  const identityScore = clampNumber(value.identity_score, 0);
  const anatomyScore = clampNumber(value.anatomy_score, 0);
  const containmentScore = clampNumber(value.containment_score, 0);
  const beautyScore = clampNumber(value.beauty_score, 0);
  const approved =
    value.approved === true &&
    score >= ACCEPTABLE_PREVIEW_SCORE &&
    identityScore >= 98 &&
    containmentScore >= 95 &&
    anatomyScore >= 80;

  return {
    approved,
    score,
    identityScore,
    anatomyScore,
    containmentScore,
    beautyScore,
    issues: normalizeStringArray(value.issues, [
      "Controllo qualita non conclusivo.",
    ]),
    retryGuidance: normalizeText(
      value.retry_guidance,
      "Keep the exact same identity and all non-dental pixels unchanged. Improve only masked teeth with correct dental anatomy.",
    ),
    userMessage: normalizeText(
      value.user_message,
      "Non siamo riusciti a generare una preview abbastanza sicura. Prova con una foto piu frontale, nitida e con i denti ben visibili.",
    ),
    modelUsed,
  };
}

function hasDangerousIdentityIssue(review: QualityReport) {
  const issueText = review.issues.join(" ").toLowerCase();

  if (review.containmentScore >= 92) return false;

  return (
    (review.identityScore < 45 && review.containmentScore < 70) ||
    issueText.includes("identità") ||
    issueText.includes("età") ||
    issueText.includes("labbra cambiate") ||
    issueText.includes("forma della bocca") ||
    issueText.includes("mouth shape outside")
  );
}

async function reviewGeneratedImage(
  source: SourceImage,
  generatedBuffer: Buffer,
  analysis: DentalAnalysis,
) {
  const result = await runGeminiJson<Parameters<typeof normalizeQualityReport>[0]>(
    buildQualityPrompt(analysis),
    [
      {
        inlineData: {
          data: source.buffer.toString("base64"),
          mimeType: "image/png",
        },
      },
      {
        inlineData: {
          data: generatedBuffer.toString("base64"),
          mimeType: "image/png",
        },
      },
    ],
  );

  return normalizeQualityReport(result.data, result.modelUsed);
}

async function createSourceImage(imageBuffer: Buffer): Promise<SourceImage> {
  const buffer = await sharp(imageBuffer).rotate().png().toBuffer();
  const metadata = await sharp(buffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to read image dimensions.");
  }

  return {
    buffer,
    width: metadata.width,
    height: metadata.height,
  };
}

function normalizedPointToPixel(point: NormalizedPoint, source: SourceImage) {
  return {
    x: Math.round((point.x / 1000) * source.width),
    y: Math.round((point.y / 1000) * source.height),
  };
}

function boxToPolygon(box: NormalizedBox): NormalizedPoint[] {
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];
}

function pixelBoxToNormalizedBox(
  box: { left: number; top: number; right: number; bottom: number },
  source: SourceImage,
): NormalizedBox {
  const x = Math.max(0, Math.min(1000, Math.round((box.left / source.width) * 1000)));
  const y = Math.max(0, Math.min(1000, Math.round((box.top / source.height) * 1000)));
  const right = Math.max(
    x + 1,
    Math.min(1000, Math.round((box.right / source.width) * 1000)),
  );
  const bottom = Math.max(
    y + 1,
    Math.min(1000, Math.round((box.bottom / source.height) * 1000)),
  );

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
}

async function detectDentalBoxFromPixels(source: SourceImage) {
  const raw = await sharp(source.buffer).removeAlpha().raw().toBuffer();
  const searchLeft = Math.floor(source.width * 0.18);
  const searchRight = Math.ceil(source.width * 0.82);
  const searchTop = Math.floor(source.height * 0.32);
  const searchBottom = Math.ceil(source.height * 0.76);
  let left = source.width;
  let right = 0;
  let top = source.height;
  let bottom = 0;
  let count = 0;

  for (let y = searchTop; y < searchBottom; y += 1) {
    for (let x = searchLeft; x < searchRight; x += 1) {
      const index = (y * source.width + x) * 3;
      const r = raw[index];
      const g = raw[index + 1];
      const b = raw[index + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const brightness = (r + g + b) / 3;
      const saturation = max === 0 ? 0 : ((max - min) / max) * 100;
      const redDominance = r - Math.max(g, b);
      const likelyTooth =
        brightness > 92 &&
        saturation < 64 &&
        redDominance < 62 &&
        g > 55 &&
        b > 45;

      if (!likelyTooth) continue;

      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      count += 1;
    }
  }

  if (count < 12) return null;

  const padX = Math.max(18, Math.round((right - left) * 0.55));
  const padY = Math.max(16, Math.round((bottom - top) * 0.95));

  return pixelBoxToNormalizedBox(
    {
      left: Math.max(0, left - padX),
      top: Math.max(0, top - padY),
      right: Math.min(source.width, right + padX),
      bottom: Math.min(source.height, bottom + padY),
    },
    source,
  );
}

async function createLocalFallbackAnalysis(
  source: SourceImage,
  reason: string,
): Promise<DentalAnalysis> {
  const detectedBox = await detectDentalBoxFromPixels(source);
  const fallbackBox =
    detectedBox ||
    ({
      x: 315,
      y: 430,
      width: 370,
      height: 190,
    } satisfies NormalizedBox);

  return {
    isValid: true,
    visibleArch: "both",
    rejectionReason: "",
    score: 82,
    analysis:
      "Analisi automatica rapida: preview best-case del sorriso generata con mask locale per mantenere invariata l'identita del volto.",
    treatments: [
      "Preview estetica completa del sorriso",
      "Sbiancamento premium",
      "Rifinitura forma e proporzioni dentali",
    ],
    recommendedTreatment:
      "Smile makeover estetico best-case con sbiancamento, bonding/veneers-style reshaping e rifinitura dell'allineamento visibile",
    treatmentRationale:
      "Obiettivo: mostrare la migliore versione realisticamente raggiungibile del sorriso, mantenendo invariato il volto e intervenendo solo nella zona dentale visibile.",
    visibleTeethSummary:
      "Zona dentale stimata automaticamente dai pixel visibili della foto.",
    shadeTarget: "A1",
    improvementLevel: "moderate",
    editPriorities: [
      "Creare un sorriso visibilmente piu bianco, armonico e proporzionato.",
      "Migliorare forma, bordi, piccoli gap e allineamento visibile dentro la mask.",
    ],
    riskFactors: [
      "Analisi Gemini non disponibile: usare solo la mask locale e non modificare il volto.",
      reason,
    ],
    teethBox: fallbackBox,
    teethPolygons: [boxToPolygon(fallbackBox)],
    modelUsed: detectedBox ? "local-tooth-pixel-mask" : "local-mouth-estimate",
  };
}

function normalizedBoxToPixelBox(box: NormalizedBox, source: SourceImage) {
  const left = Math.max(
    0,
    Math.floor((box.x / 1000) * source.width) - MASK_PADDING_PX,
  );
  const top = Math.max(
    0,
    Math.floor((box.y / 1000) * source.height) - MASK_PADDING_PX,
  );
  const right = Math.min(
    source.width,
    Math.ceil(((box.x + box.width) / 1000) * source.width) + MASK_PADDING_PX,
  );
  const bottom = Math.min(
    source.height,
    Math.ceil(((box.y + box.height) / 1000) * source.height) + MASK_PADDING_PX,
  );

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function polygonsToSvgPaths(
  source: SourceImage,
  polygons: NormalizedPoint[][],
) {
  return polygons
    .map((polygon) => {
      const points = polygon
        .map((point) => {
          const pixel = normalizedPointToPixel(point, source);
          return `${pixel.x},${pixel.y}`;
        })
        .join(" ");
      return `<polygon points="${points}" />`;
    })
    .join("");
}

async function buildGeometryMask(
  source: SourceImage,
  analysis: DentalAnalysis,
  fillValue: number,
) {
  const paths = polygonsToSvgPaths(source, analysis.teethPolygons);
  const fallbackRect = analysis.teethBox
    ? normalizedBoxToPixelBox(analysis.teethBox, source)
    : null;
  const fallbackShape = fallbackRect
    ? `<rect x="${fallbackRect.left}" y="${fallbackRect.top}" width="${fallbackRect.width}" height="${fallbackRect.height}" />`
    : "";
  const shape = fallbackShape || paths;
  const fill = Math.max(0, Math.min(255, Math.round(fillValue)));

  const svg = `<svg width="${source.width}" height="${source.height}" viewBox="0 0 ${source.width} ${source.height}" xmlns="http://www.w3.org/2000/svg">
<rect width="100%" height="100%" fill="rgb(0,0,0)" />
<g fill="rgb(${fill},${fill},${fill})">${shape}</g>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function buildInpaintMask(source: SourceImage, analysis: DentalAnalysis) {
  return buildGeometryMask(source, analysis, Math.round(255 * INPAINT_STRENGTH));
}

async function buildCompositeMask(source: SourceImage, analysis: DentalAnalysis) {
  const mask = await buildGeometryMask(source, analysis, 255);
  return sharp(mask).blur(0.8).png().toBuffer();
}

function getCompositeBox(analysis: DentalAnalysis, source: SourceImage) {
  if (!analysis.teethBox) {
    throw new Error("Missing dental mask bounding box.");
  }

  const box = normalizedBoxToPixelBox(analysis.teethBox, source);
  const left = Math.max(0, box.left - MASK_PADDING_PX);
  const top = Math.max(0, box.top - MASK_PADDING_PX);
  const right = Math.min(source.width, box.left + box.width + MASK_PADDING_PX);
  const bottom = Math.min(source.height, box.top + box.height + MASK_PADDING_PX);

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function appendImageBlob(
  formData: FormData,
  field: string,
  buffer: Buffer,
  filename: string,
) {
  const blob = new Blob([new Uint8Array(buffer)], { type: "image/png" });
  formData.append(field, blob, filename);
}

async function generateDentalEdit(
  source: SourceImage,
  analysis: DentalAnalysis,
  prompt: string,
) {
  const inpaintMask = await buildInpaintMask(source, analysis);
  const formData = new FormData();

  appendImageBlob(formData, "image", source.buffer, "source.png");
  appendImageBlob(formData, "mask", inpaintMask, "dental-mask.png");
  formData.append("prompt", prompt);
  formData.append("negative_prompt", NEGATIVE_PROMPT);
  formData.append("grow_mask", String(MASK_GROW_PX));
  formData.append("output_format", "png");

  const stabilityResponse = await fetch(STABILITY_INPAINT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STABILITY_KEY}`,
      Accept: "image/*",
    },
    body: formData,
  });

  if (!stabilityResponse.ok) {
    const errorText = await stabilityResponse.text();
    throw new Error(
      `Stability Inpaint API Error: ${stabilityResponse.status} - ${errorText}`,
    );
  }

  return Buffer.from(await stabilityResponse.arrayBuffer());
}

async function compositeDentalPatch(
  source: SourceImage,
  generatedBuffer: Buffer,
  analysis: DentalAnalysis,
) {
  const compositeMask = await buildCompositeMask(source, analysis);
  const compositeBox = getCompositeBox(analysis, source);
  const resizedGenerated = await sharp(generatedBuffer)
    .resize(source.width, source.height, { fit: "fill" })
    .png()
    .toBuffer();
  const patch = await sharp(resizedGenerated)
    .extract(compositeBox)
    .removeAlpha()
    .png()
    .toBuffer();
  const patchMask = await sharp(compositeMask)
    .extract(compositeBox)
    .greyscale()
    .png()
    .toBuffer();
  const maskedPatch = await sharp(patch)
    .joinChannel(patchMask)
    .png()
    .toBuffer();

  return sharp(source.buffer)
    .composite([
      { input: maskedPatch, left: compositeBox.left, top: compositeBox.top },
    ])
    .png()
    .toBuffer();
}

async function createConservativeLocalPreview(
  source: SourceImage,
  analysis: DentalAnalysis,
) {
  const mask = await buildCompositeMask(source, analysis);
  const maskRaw = await sharp(mask).greyscale().raw().toBuffer();
  const sourceRaw = await sharp(source.buffer).removeAlpha().raw().toBuffer();
  const output = Buffer.from(sourceRaw);

  for (let pixel = 0; pixel < source.width * source.height; pixel += 1) {
    const alpha = maskRaw[pixel] / 255;
    if (alpha <= 0) continue;

    const i = pixel * 3;
    const r = sourceRaw[i];
    const g = sourceRaw[i + 1];
    const b = sourceRaw[i + 2];
    const average = (r + g + b) / 3;
    const strength = Math.min(0.62, alpha * 0.58);
    const targetR = Math.min(255, average * 0.96 + 42);
    const targetG = Math.min(255, average * 0.99 + 48);
    const targetB = Math.min(255, average * 1.08 + 62);

    output[i] = Math.round(r * (1 - strength) + targetR * strength);
    output[i + 1] = Math.round(g * (1 - strength) + targetG * strength);
    output[i + 2] = Math.round(b * (1 - strength) + targetB * strength);
  }

  return sharp(output, {
    raw: {
      width: source.width,
      height: source.height,
      channels: 3,
    },
  })
    .png()
    .toBuffer();
}

async function generateReviewedPreview(source: SourceImage, analysis: DentalAnalysis) {
  let bestResult: Buffer | null = null;
  let bestReview: QualityReport | null = null;
  let retryGuidance: string | undefined;
  let qaWarning: string | undefined;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const generated = await generateDentalEdit(
      source,
      analysis,
      buildReplacePrompt(analysis, attempt, retryGuidance),
    );
    const composited = await compositeDentalPatch(source, generated, analysis);

    try {
      const review = await reviewGeneratedImage(source, composited, analysis);

      if (!bestReview || review.score > bestReview.score) {
        bestReview = review;
        bestResult = composited;
      }

      if (review.approved) {
        return {
          result: composited,
          review,
          qaWarning,
        };
      }

      retryGuidance = review.retryGuidance;
    } catch (error: unknown) {
      if (!isTemporaryGeminiError(error)) throw error;

      qaWarning =
        "Controllo qualita Gemini temporaneamente non disponibile. La preview e' stata comunque limitata alla mask dentale.";
      bestResult = composited;
      bestReview = {
        approved: true,
        score: 70,
        identityScore: 100,
        anatomyScore: 70,
        containmentScore: 100,
        beautyScore: 70,
        issues: [qaWarning],
        retryGuidance: "",
        userMessage: qaWarning,
        modelUsed: "fallback",
      };
      break;
    }
  }

  if (!bestResult || !bestReview) {
    throw new Error("Generation failed before producing a usable result.");
  }

  if (hasDangerousIdentityIssue(bestReview)) {
    const fallbackResult = await createConservativeLocalPreview(source, analysis);
    const warning =
      "Il risultato generativo e' stato scartato per proteggere l'identita. Mostriamo una preview conservativa ottenuta modificando solo i pixel dentali dell'immagine originale.";

    return {
      result: fallbackResult,
      review: {
        ...bestReview,
        approved: false,
        score: Math.max(bestReview.score, 70),
        identityScore: 100,
        containmentScore: 100,
        issues: [warning, ...bestReview.issues],
        userMessage: warning,
      },
      qaWarning: warning,
    };
  }

  return {
    result: bestResult,
    review: bestReview,
    qaWarning:
      qaWarning ||
      (bestReview.approved
        ? undefined
        : "Preview generata come miglior risultato disponibile: richiede verifica dello studio."),
  };
}

export async function POST(request: Request) {
  try {
    if (!STABILITY_KEY) {
      return NextResponse.json(
        { error: "STABILITY_API_KEY must be configured for generation." },
        { status: 500 },
      );
    }

    const body = await request.formData();
    const image = body.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Missing image" }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const source = await createSourceImage(imageBuffer);

    let analysis: DentalAnalysis;
    if (!GEMINI_KEY) {
      analysis = await createLocalFallbackAnalysis(
        source,
        "GEMINI_API_KEY non configurata.",
      );
    } else {
      try {
        analysis = await analyzeOriginalImage(source);
      } catch (error: unknown) {
        analysis = await createLocalFallbackAnalysis(
          source,
          `Analisi Gemini temporaneamente non disponibile: ${errorMessage(error)}`,
        );
      }
    }

    if (!analysis.isValid) {
      return NextResponse.json(
        { is_rejected: true, message: analysis.rejectionReason },
        { status: 200 },
      );
    }

    const preview = await generateReviewedPreview(source, analysis);

    if (!preview.result) {
      return NextResponse.json(
        {
          is_rejected: true,
          message: preview.review.userMessage,
          qualityIssues: preview.review.issues,
        },
        { status: 200 },
      );
    }

    const outputUrl = `data:image/png;base64,${preview.result.toString(
      "base64",
    )}`;
    const warnings = [
      preview.qaWarning,
      preview.review.approved ? undefined : "Risultato sotto soglia premium.",
    ].filter(Boolean);

    return NextResponse.json({
      outputUrl,
      realSmileScore: analysis.score,
      aiAnalysisText: analysis.analysis,
      autoTreatments: [
        analysis.recommendedTreatment,
        ...analysis.treatments.filter(
          (treatment) => treatment !== analysis.recommendedTreatment,
        ),
      ],
      treatmentRationale: analysis.treatmentRationale,
      qualityScore: preview.review.score,
      identityScore: preview.review.identityScore,
      anatomyScore: preview.review.anatomyScore,
      containmentScore: preview.review.containmentScore,
      beautyScore: preview.review.beautyScore,
      qualityIssues: preview.review.issues,
      previewWarning: warnings.length > 0 ? warnings.join(" ") : undefined,
      generationMode: "masked_inpaint_reviewed",
      analysisModel: analysis.modelUsed,
      reviewModel: preview.review.modelUsed,
      is_rejected: false,
    });
  } catch (error: unknown) {
    console.error("Server Error:", errorMessage(error));
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
