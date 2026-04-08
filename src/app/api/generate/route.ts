import { NextResponse } from 'next/server';
import axios from 'axios';
import FormData from 'form-data';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageUrl, treatmentType } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
    }

    console.log(`🚀 Starting treatment: ${treatmentType} using Stability AI`);

    
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    
    const formData = new FormData();
    formData.append('image', imageBuffer, { filename: 'patient.png' });
    formData.append('search_prompt', 'teeth'); 
    
    
    const promptText = treatmentType === 'whitening' || treatmentType === 'alignment' 
      ? 'perfect natural white straight teeth, highly detailed medical quality' 
      : 'perfect highly detailed restoration, realistic';
      
    formData.append('prompt', promptText);
    formData.append('output_format', 'png');

    
    const STABILITY_KEY = process.env.STABILITY_API_KEY;

    const stabilityResponse = await axios.post(
        "https://api.stability.ai/v2beta/stable-image/edit/search-and-replace",
        formData,
        {
            headers: { 
                Authorization: `Bearer ${STABILITY_KEY}`, 
                ...formData.getHeaders(),
                Accept: "image/*" 
            },
            responseType: "arraybuffer",
            validateStatus: undefined
        }
    );

    
    if (stabilityResponse.status === 200) {
        const base64Image = Buffer.from(stabilityResponse.data).toString('base64');
        const outputUrl = `data:image/png;base64,${base64Image}`;

        return NextResponse.json({ outputUrl });
    } else {
        const errorBody = Buffer.from(stabilityResponse.data).toString();
        console.error("❌ Stability Error:", errorBody);
        return NextResponse.json({ error: "AI Generation failed" }, { status: stabilityResponse.status });
    }

  } catch (error: any) {
    console.error("❌ API Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
