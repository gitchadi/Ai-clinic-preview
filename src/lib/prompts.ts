export const TREATMENT_PROMPTS = {
  whitening:
    "Professional cosmetic dental whitening preview on the existing smile, enhancing tooth brightness, reducing yellow staining, and keeping enamel texture natural with clinically believable cosmetic dentistry results. Extremely subtle and realistic editing. Strictly preserve the original facial identity, structure, lighting, skin tone, and background. Do not alter eyes, nose, or face shape. Highly realistic photo.",
  alignment:
    "High-end orthodontic alignment preview on the existing smile, subtly straightening visible teeth, refining spacing and symmetry, and maintaining authentic bite proportions with medically plausible cosmetic improvement. Extremely subtle and realistic editing. Strictly preserve the original facial identity, structure, lighting, skin tone, and background. Do not alter eyes, nose, or face shape. Highly realistic photo.",
  skin: "Luxury aesthetic clinic skin rejuvenation preview with refined skin clarity, softened blemishes, smoother texture, and healthy radiance while preserving pores, realism, and natural human detail. Extremely subtle and realistic editing. Strictly preserve the original facial identity, structure, lighting, skin tone, and background. Do not alter eyes, nose, or face shape. Highly realistic photo.",
} as const;

export type TreatmentType = keyof typeof TREATMENT_PROMPTS;
