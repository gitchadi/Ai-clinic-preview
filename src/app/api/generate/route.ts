import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// التنظيف التلقائي لأي مسافة منسوخة بالغلط
const STABILITY_KEY = (process.env.STABILITY_API_KEY || "").trim();
const STABILITY_URL = "https://api.stability.ai/v2beta/stable-image/edit/search-and-replace";

const GEMINI_KEY = (process.env.GEMINI_API_KEY || "").trim();
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

export async function POST(request: Request) {
  try {
    const body = await request.formData();
    // استخدام الملف الأصلي مباشرة
    const image = body.get('image') as File;

    if (!image) return NextResponse.json({ error: "Missing image" }, { status: 400 });

    const arrayBuffer = await image.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const mimeType = image.type || 'image/jpeg';

    let isRejection = false; 
    let rejectionReason = ""; 
    let realScore = 85; 
    let realAnalysis = "Analisi estetica completata con successo."; 
    let realTreats = ["Restauro Estetico Completo"]; 
    let visibleArch = "both";

    // =====================================================================
    // 1. GEMINI GATEKEEPER
    // =====================================================================
    console.log("⏳ 1. جاري فحص الصورة بواسطة Gemini...");
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash", 
        generationConfig: { responseMimeType: "application/json" },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ]
      });
      
      const prompt = `Analyze this portrait photo as a dental aesthetics expert. 
      DEVI RISPONDERE SOLO IN LINGUA ITALIANA. Return strictly valid JSON like this: 
      {
        "is_valid": boolean (TRUE only if mouth is clearly open and teeth are visible),
        "visible_arch": "upper_only" | "both" | "none",
        "error_reason": "string (If invalid, state 'Bocca chiusa o denti non visibili.')",
        "score": number,
        "analysis": "string",
        "treatments": ["string"]
      }`;
      
      const imagePart = { inlineData: { data: imageBuffer.toString("base64"), mimeType } };
      const result = await model.generateContent([prompt, imagePart]);
      
      let text = result.response.text().replace(/```json/gi, '').replace(/```/gi, '').trim();
      const parsed = JSON.parse(text);
      
      if (parsed.is_valid === false || parsed.visible_arch === "none") {
        isRejection = true;
        rejectionReason = parsed.error_reason || "Bocca chiusa o denti non visibili. Carica un'altra foto.";
      } else {
        realScore = parsed.score || 85;
        realAnalysis = parsed.analysis || realAnalysis;
        visibleArch = parsed.visible_arch || "both";
        if (parsed.treatments && Array.isArray(parsed.treatments)) realTreats = parsed.treatments;
      }
      
      console.log("✅ Gemini انتهى من الفحص بنجاح.");
    } catch (e: any) {
      console.error("🚨 Gemini Error:", e.message);
      isRejection = true;
      rejectionReason = `Errore di analisi IA: Riprova tra poco.`; 
    }

    if (isRejection) {
      return NextResponse.json({ is_rejected: true, message: rejectionReason }, { status: 200 });
    }

    // =====================================================================
    // 2. STABILITY AI (استخدام Native Fetch لضمان عدم حدوث Invalid URL)
    // =====================================================================
    console.log("⏳ 2. جاري توليد الابتسامة بواسطة Stability AI...");
    let searchPrompt = 'teeth, broken teeth, missing teeth, dark gaps, weird tongue';
    let replacePrompt = 'perfect natural white upper and lower teeth, healthy gums, anatomically correct mouth, 8k photorealistic';

    if (visibleArch === "upper_only") {
      searchPrompt = 'upper teeth, broken teeth, empty gaps';
      replacePrompt = 'perfect natural white upper teeth only, anatomically correct, highly detailed 8k';
    }

    const nativeFormData = new FormData();
    // إرسال الملف مباشرة بدون مكتبات خارجية
    nativeFormData.append('image', image);
    nativeFormData.append('search_prompt', searchPrompt);
    nativeFormData.append('prompt', replacePrompt);
    nativeFormData.append('output_format', 'png');

    const stabilityResponse = await fetch(STABILITY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STABILITY_KEY}`,
        'Accept': 'image/*'
      },
      body: nativeFormData
    });

    if (!stabilityResponse.ok) {
      const errorText = await stabilityResponse.text();
      throw new Error(`Stability API Error: ${stabilityResponse.status} - ${errorText}`);
    }

    const arrayBufferRes = await stabilityResponse.arrayBuffer();
    const resultBase64 = Buffer.from(arrayBufferRes).toString('base64');
    const outputUrl = `data:image/png;base64,${resultBase64}`;

    console.log("✅ الصورة تم تعديلها بنجاح!");
    return NextResponse.json({ 
      outputUrl, 
      realSmileScore: realScore, 
      aiAnalysisText: realAnalysis, 
      autoTreatments: realTreats,
      is_rejected: false 
    });

  } catch (error: any) {
    console.error("🚨 Server Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
