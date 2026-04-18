import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';

const STABILITY_KEY = process.env.STABILITY_API_KEY;

async function smartReplace() {
    console.log("🎯 Running Smart Search & Replace (Face remains 100% untouched)...");

    try {
        if (!STABILITY_KEY) {
            throw new Error("STABILITY_API_KEY is not configured.");
        }

        const formData = new FormData();
        // بنبعت الصورة الأصلية بس
        formData.append('image', fs.createReadStream('original.png'));
        
        // الكلمة اللي الـ AI هيدور عليها عشان يمسحها
        formData.append('search_prompt', 'teeth'); 
        
        // الحاجة الجديدة اللي هيحطها مكانها
        formData.append('prompt', 'perfect natural white straight teeth, highly detailed medical quality'); 
        
        formData.append('output_format', 'png');

        const response = await axios.post(
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

        if (response.status === 200) {
            fs.writeFileSync("final_smile_PERFECT.png", Buffer.from(response.data));
            console.log("--------------------------------------------------");
            console.log("✅ SUCCESS! The teeth were replaced smoothly.");
            console.log("📁 Open: final_smile_PERFECT.png");
            console.log("--------------------------------------------------");
        } else {
            console.log(`❌ API Error (${response.status}):`, Buffer.from(response.data).toString());
        }
    } catch (err) {
        console.log("❌ Execution Error:", err.message);
    }
}

smartReplace();
