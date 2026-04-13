import { NextResponse } from 'next/server';
import axios from 'axios';
import FormData from 'form-data';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const STABILITY_KEY = process.env.STABILITY_API_KEY;
const STABILITY_URL = "https://api.stability.ai/v2beta/stable-image/edit/search-and-replace";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const TREATMENT_PROMPTS: Record<string, { search: string; replace: string }> = {
  whitening: { search: 'teeth', replace: 'glowing natural bright white teeth, highly detailed' },
  veneers: { search: 'teeth', replace: 'perfect symmetric hollywood smile veneers, highly uniform teeth' },
  braces: { search: 'teeth', replace: 'teeth with realistic metallic orthodontic braces and wires' },
  invisalign: { search: 'teeth', replace: 'teeth wearing clear transparent invisalign aligners' },
  gums: { search: 'gums', replace: 'healthy light coral pink gums, natural realistic texture' },
  implants: { search: 'missing teeth, gaps, broken teeth', replace: 'full set of natural perfect teeth, flawless restoration' },
};

export async function POST(request: Request) {
  try {
    const body = await request.formData();
    const image = body.get('image') as Blob;
    const treatmentTypesString = body.get('treatmentTypes') as string;

    if (!image || !treatmentTypesString) {
      return NextResponse.json({ error: "Missing image or treatments" }, { status: 400 });
    }

    const arrayBuffer = await image.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const mimeType = image.type || 'image/jpeg';

    // 1. GEMINI AI: Real Diagnosis (With Smart Retry Mechanism)
    let realSmileScore = 75;
    let aiAnalysisText = "Analisi completata.";
    let geminiSuccess = false;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: "gemini-2.5-flash", // أحدث وأسرع موديل
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE }
          ]
        });
        
        const prompt = "Analyze this portrait photo as a dental aesthetics expert. Focus strictly on teeth color, dental alignment, spaces/gaps, and gum health visible in the smile. Be concise, professional, and focus only on aesthetic improvements. Do not give medical advice. Provide a score out of 100 representing the current aesthetic health. Response format must be strictly valid JSON like this: {\"score\": 75, \"analysis\": \"string\"}. DO NOT wrap the response in markdown blocks.";
        const imagePart = { inlineData: { data: imageBuffer.toString("base64"), mimeType } };
        
        const result = await model.generateContent([prompt, imagePart]);
        let text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const cleanJson = text.match(/\{[\s\S]*\}/);
        
        if (cleanJson) {
          const parsed = JSON.parse(cleanJson[0]);
          realSmileScore = parsed.score;
          aiAnalysisText = parsed.analysis;
          geminiSuccess = true;
          console.log(`✅ Gemini نجح في المحاولة رقم ${attempt}`);
          break; // نخرج من اللوب لو نجح
        }
      } catch (e: any) {
        console.warn(`⚠️ محاولة Gemini رقم ${attempt} فشلت:`, e.message);
        if (attempt < maxRetries) {
          // نستنى ثانية ونص قبل المحاولة الجاية
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }

    // لو فشل في الـ 3 محاولات، نستخدم التشخيص البديل
    if (!geminiSuccess) {
      console.error("❌ Gemini فشل تماماً بعد 3 محاولات، هنستخدم التشخيص البديل.");
      aiAnalysisText = "Rilevate imperfezioni estetiche. L'applicazione dei trattamenti migliorerà l'armonia del sorriso.";
    }

    // 2. STABILITY AI: Real Image Generation
    const selectedTypes = treatmentTypesString.split(',');
    const searchTargets = Array.from(new Set(selectedTypes.map(t => TREATMENT_PROMPTS[t]?.search || 'teeth')));
    const replacePrompts = selectedTypes.map(t => TREATMENT_PROMPTS[t]?.replace || 'perfect teeth');

    const formData = new FormData();
    formData.append('image', imageBuffer, { filename: 'patient.png' });
    formData.append('search_prompt', searchTargets.join(', ')); 
    formData.append('prompt', `${replacePrompts.join(' AND ')}, photorealistic medical quality, flawless dental restoration`);
    formData.append('output_format', 'png');

    const stabilityResponse = await axios.post(STABILITY_URL, formData, {
        headers: { Authorization: `Bearer ${STABILITY_KEY}`, ...formData.getHeaders(), Accept: "image/*" },
        responseType: "arraybuffer",
        validateStatus: undefined
    });

    if (stabilityResponse.status === 200) {
        const resultBase64 = Buffer.from(stabilityResponse.data).toString('base64');
        const outputUrl = `data:image/png;base64,${resultBase64}`;
        return NextResponse.json({ outputUrl, realSmileScore, aiAnalysisText });
    } else {
        throw new Error(`Stability API Error: ${stabilityResponse.status} - ${JSON.stringify(stabilityResponse.data)}`);
    }

  } catch (error: any) {
    console.error("Server Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
