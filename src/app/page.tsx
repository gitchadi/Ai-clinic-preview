'use client';

import React, { useState } from 'react';
import { UploadCloud, Sparkles, Download, CheckCircle, Activity, ShieldAlert, User, Phone, Lock, AlertCircle, Wand2 } from 'lucide-react';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';
import { jsPDF } from "jspdf";
import QRCode from 'qrcode';

export default function Page() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gdprConsent, setGdprConsent] = useState<boolean>(false);
  
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'generating' | 'lead_capture' | 'done'>('idle');
  const [analysisText, setAnalysisText] = useState<string>('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  
  const [smileScore, setSmileScore] = useState<number | null>(null);
  const [aiDiagnosis, setAiDiagnosis] = useState<string | null>(null);
  const [appliedTreatments, setAppliedTreatments] = useState<string[]>([]); 
  const [previewWarning, setPreviewWarning] = useState<string | null>(null);

  const [patientName, setPatientName] = useState<string>('');
  const [patientPhone, setPatientPhone] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      
      setStatus('idle');
      setResultUrl(null);
      setSmileScore(null);
      setAiDiagnosis(null);
      setAppliedTreatments([]);
      setPreviewWarning(null);
      setPatientName('');
      setPatientPhone('');
      setFormError(null);
    }
  };

  const handleGenerate = async () => {
    if (!selectedImage) return;
    if (!gdprConsent) return;

    setStatus('analyzing');
    const scanningSteps = [
      "Analisi del tuo sorriso in corso...", 
      "Studio delle possibili aree di miglioramento...", 
      "Creazione della simulazione estetica...",
      "Preparazione della tua anteprima personalizzata..."
    ];
    
    for (let i = 0; i < scanningSteps.length; i++) {
      setAnalysisText(scanningSteps[i]);
      await new Promise(r => setTimeout(r, 1200));
    }

    setStatus('generating');
    
    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData, 
      });

      if (response.ok) {
        const data = await response.json();
        
        // =====================================================================
        // 🔥 GOD MODE: حائط الصد لو جيميناي رفض الصورة (الفم مقفول)
        // =====================================================================
        if (data.is_rejected) {
          alert("❌ Attenzione: " + data.message); // بيطلع للمريض رسالة بالإيطالي
          setStatus('idle'); // بنرجع الموقع لحالته الأولى عشان يقدر يرفع صورة تانية
          return; // بنوقف التنفيذ فوراً
        }

        setResultUrl(data.outputUrl);
        setSmileScore(data.realSmileScore || 98);
        setAiDiagnosis(data.aiAnalysisText || "Simulazione completata con successo.");
        setAppliedTreatments(data.autoTreatments || ["Restauro Estetico Completo"]);
        setPreviewWarning(data.previewWarning || null);
        setStatus('lead_capture'); 
      } else {
        const errorData = await response.json().catch(() => null);
        alert(errorData?.message || errorData?.error || "Ops! Errore di elaborazione. Riprova con un'altra foto.");
        setStatus('idle');
      }
    } catch (error) {
      console.error(error);
      alert("Errore di connessione.");
      setStatus('idle');
    }
  };

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const nameRegex = /^[a-zA-Z\s\u00C0-\u024F]{3,}$/;
    if (!nameRegex.test(patientName.trim())) {
      setFormError("Inserisci un nome valido (solo lettere, min 3 caratteri).");
      return;
    }

    const cleanPhone = patientPhone.replace(/[\s\-]/g, '');
    const phoneRegex = /^(?:\+39|0039)?3\d{8,9}$/;
    
    if (!phoneRegex.test(cleanPhone)) {
      setFormError("Inserisci un cellulare italiano valido (es. +39 333 1234567).");
      return;
    }

    setStatus('done');
  };

  const generatePDF = async () => {
    if (!previewUrl || !resultUrl || !aiDiagnosis) return;
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    pdf.setFillColor(37, 99, 235);
    pdf.rect(0, 0, 210, 40, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);
    pdf.text("SMILE PREVIEW IA", 20, 25);
    
    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(16);
    pdf.text("Riepilogo della tua simulazione estetica", 20, 55);

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Paziente: ${patientName.toUpperCase()}`, 20, 65);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Data: ${new Date().toLocaleDateString('it-IT')}`, 150, 65);
    
    pdf.setFont("helvetica", "bold");
    pdf.text("Osservazioni estetiche IA:", 20, 80);
    pdf.setFont("helvetica", "normal");
    
    const textLines = pdf.splitTextToSize(aiDiagnosis, 170);
    pdf.text(textLines, 20, 87);
    const offset = textLines.length * 5;
    
    const selectedNames = appliedTreatments.join(' + ');
    pdf.setFont("helvetica", "bold");
    pdf.text(`Miglioramenti simulati: ${selectedNames}`, 20, 90 + offset);
    pdf.text(`Armonia del sorriso simulata: 98/100`, 20, 97 + offset);

    pdf.text("PRIMA:", 20, 115 + offset);
    pdf.addImage(previewUrl, 'JPEG', 20, 120 + offset, 80, 80);
    
    pdf.text("DOPO (IA):", 110, 115 + offset);
    pdf.addImage(resultUrl, 'PNG', 110, 120 + offset, 80, 80);

    try {
      const patientId = patientName.replace(/\s+/g, '').toLowerCase() || 'paziente';
      const bookingLink = `https://clinica-pro.it/prenota?ref=${patientId}&promo=IA_SMILE`;
      const qrDataUrl = await QRCode.toDataURL(bookingLink, { margin: 1, color: { dark: '#1E293B', light: '#FFFFFF' } });
      
      const qrY = 220;
      pdf.setFillColor(241, 245, 249);
      pdf.rect(20, qrY, 170, 35, 'F');
      pdf.addImage(qrDataUrl, 'PNG', 25, qrY + 2.5, 30, 30);
      
      pdf.setTextColor(30, 41, 59);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("Rivedi la tua anteprima del sorriso", 60, qrY + 12);
      
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text("Inquadra il QR Code per rivedere il confronto prima/dopo", 60, qrY + 18);
      pdf.text("e richiedere una valutazione personalizzata allo studio.", 60, qrY + 23);
    } catch (err) {
      console.error("QR Error", err);
    }

    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text("Disclaimer: la preview IA e' illustrativa. Non costituisce diagnosi, piano terapeutico o garanzia di risultato.", 20, 280);
    pdf.save(`Report_IA_${patientName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        
        <div className="text-center mb-10 flex flex-col items-center justify-center animate-in slide-in-from-top-4 duration-700">
          <h1 className="text-5xl font-extrabold text-slate-800 tracking-tight mb-2">
            Scopri il tuo sorriso <span className="text-blue-600">in anteprima</span>
          </h1>
          <p className="mt-3 text-slate-500 text-lg font-medium max-w-2xl bg-blue-50 px-4 py-2 rounded-full border border-blue-100">
            Carica una foto e guarda una simulazione realistica di come potrebbe migliorare il tuo sorriso
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[2fr,3fr] gap-10">
          
          <div className="space-y-6">
            <div className="border-2 border-dashed border-slate-300 rounded-3xl p-6 text-center bg-white relative hover:bg-slate-50 hover:border-blue-400 transition-all group overflow-hidden">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              {previewUrl ? (
                <img src={previewUrl} alt="Anteprima" className="h-64 object-cover rounded-2xl mx-auto shadow-md group-hover:scale-[1.02] transition-transform" />
              ) : (
                <div className="py-12 text-slate-500 flex flex-col items-center">
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                    <UploadCloud size={40} className="text-blue-500" />
                  </div>
                  <p className="font-bold text-xl text-slate-700">Carica una foto del tuo sorriso</p>
                  <p className="text-sm mt-2 text-slate-400 max-w-[240px] leading-relaxed">L&apos;IA creerà una simulazione estetica per aiutarti a immaginare il possibile risultato dopo un percorso personalizzato.</p>
                </div>
              )}
            </div>

            {(smileScore || aiDiagnosis) && status === 'done' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col gap-5 shadow-lg animate-in fade-in slide-in-from-left-4">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-full bg-blue-100 text-blue-600">
                    <Activity size={32} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-500 font-bold uppercase tracking-wider">Armonia del sorriso simulata</p>
                    <div className="w-full bg-slate-100 rounded-full h-3 mt-2 overflow-hidden shadow-inner">
                      <div className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-red-400 via-yellow-400 to-green-500" style={{ width: `${smileScore}%` }}></div>
                    </div>
                  </div>
                  <div className="text-4xl font-black text-slate-800">{smileScore}%</div>
                </div>
                
                {aiDiagnosis && (
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                    <h4 className="font-black text-slate-800 flex items-center gap-2 mb-3"><Wand2 size={20} className="text-blue-500" /> Miglioramenti simulati:</h4>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {appliedTreatments.map((t, idx) => (
                        <span key={idx} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200">{t}</span>
                      ))}
                    </div>
                    {previewWarning && (
                      <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs font-semibold text-amber-700">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <p>{previewWarning}</p>
                      </div>
                    )}
                    <p className="text-slate-600 text-sm leading-relaxed border-t border-slate-200 pt-3">{aiDiagnosis}</p>
                  </div>
                )}
              </div>
            )}

            {status !== 'lead_capture' && status !== 'done' && (
              <div className="flex items-start gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mt-4 transition-all hover:shadow-md">
                <input
                  type="checkbox"
                  id="gdpr"
                  checked={gdprConsent}
                  onChange={(e) => setGdprConsent(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-slate-300 text-blue-600 cursor-pointer focus:ring-blue-500"
                />
                <label htmlFor="gdpr" className="text-xs text-slate-500 leading-relaxed cursor-pointer">
                  Autorizzo l&apos;utilizzo della mia immagine per generare una simulazione estetica illustrativa ai sensi del <strong className="text-slate-700">GDPR (Regolamento UE 2016/679)</strong>.
                </label>
              </div>
            )}

            {status !== 'lead_capture' && status !== 'done' && (
              <button 
                onClick={handleGenerate}
                disabled={!selectedImage || !gdprConsent || status === 'analyzing' || status === 'generating'}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-black py-5 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all text-xl flex justify-center items-center gap-3 disabled:hover:translate-y-0"
              >
                {status === 'idle' && <span className="flex items-center gap-2"><Wand2 size={24} /> Vedi il mio sorriso in anteprima</span>}
                {(status === 'analyzing' || status === 'generating') && <span className="flex items-center gap-2"><Sparkles className="animate-spin" size={24} /> {analysisText}</span>}
              </button>
            )}
            
            {status === 'done' && (
              <div className="w-full bg-green-50 border-2 border-green-500 text-green-700 font-black py-5 rounded-2xl shadow-md text-xl flex justify-center items-center gap-3 animate-in zoom-in">
                <CheckCircle size={28} /> La tua anteprima è pronta
              </div>
            )}
          </div>

          <div className="bg-white rounded-[2rem] shadow-2xl p-6 border border-slate-100 flex flex-col justify-center items-center min-h-[600px] relative overflow-hidden">
            
            {status === 'lead_capture' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-500">
                <div className="bg-white p-8 rounded-[2rem] shadow-2xl w-full max-w-md text-center transform transition-all animate-in zoom-in-95">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-white">
                    <Lock size={36} />
                  </div>
                  <h3 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">La tua anteprima è pronta</h3>
                  <p className="text-slate-500 text-sm mb-8 leading-relaxed px-4">
                    Lascia nome e telefono per vedere il confronto completo e ricevere una valutazione personalizzata dallo studio.
                  </p>
                  
                  <form onSubmit={handleLeadSubmit} className="space-y-4">
                    <div className="relative group">
                      <User className="absolute left-4 top-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                      <input 
                        type="text" 
                        placeholder="Nome e Cognome" 
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        className={`w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-2 ${formError && patientName.length < 3 ? 'border-red-400 bg-red-50' : 'border-slate-100 focus:border-blue-500 focus:bg-white'} outline-none transition-all font-medium`}
                      />
                    </div>
                    <div className="relative group">
                      <Phone className="absolute left-4 top-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                      <input 
                        type="tel" 
                        placeholder="Cellulare (es. 3331234567)" 
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(e.target.value)}
                        className={`w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-2 ${formError && patientPhone.length < 9 ? 'border-red-400 bg-red-50' : 'border-slate-100 focus:border-blue-500 focus:bg-white'} outline-none transition-all font-medium`}
                      />
                    </div>
                    
                    {formError && (
                      <div className="flex items-start gap-2 text-red-600 bg-red-50 p-4 rounded-xl text-xs text-left font-semibold border border-red-100">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <p>{formError}</p>
                      </div>
                    )}

                    <button 
                      type="submit" 
                      className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl flex justify-center items-center gap-2 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 mt-4 text-lg"
                    >
                      Guarda il risultato <Sparkles size={20} />
                    </button>
                  </form>
                </div>
              </div>
            )}

            {status === 'lead_capture' && previewUrl && (
              <div className="absolute inset-0 opacity-30 filter blur-3xl scale-125" style={{ backgroundImage: `url(${previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
            )}

            {status === 'done' && resultUrl && previewUrl && aiDiagnosis ? (
              <div className="w-full animate-in fade-in zoom-in duration-700 text-center z-0 flex flex-col items-center justify-center">
                <div className="w-full max-w-[450px] rounded-[2rem] overflow-hidden shadow-2xl border-8 border-white mb-8 mx-auto relative group">
                  <div className="absolute top-4 left-4 z-20 bg-black/50 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm">PRIMA</div>
                  <div className="absolute top-4 right-4 z-20 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg shadow-blue-500/50">DOPO (IA)</div>
                  <ReactCompareSlider
                    itemOne={<ReactCompareSliderImage src={previewUrl} alt="Prima" />}
                    itemTwo={<ReactCompareSliderImage src={resultUrl} alt="Dopo" />}
                    className="w-full h-auto aspect-square object-cover"
                  />
                </div>
                <button onClick={generatePDF} className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black text-lg flex justify-center items-center gap-3 transition-all max-w-md mx-auto shadow-xl hover:shadow-2xl hover:-translate-y-1">
                  <Download size={24} /> Scarica la mia simulazione
                </button>
              </div>
            ) : (
              status !== 'lead_capture' && (
                <div className="text-center text-slate-300 flex flex-col items-center">
                  {status === 'analyzing' || status === 'generating' ? (
                    <div className="relative">
                      <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-blue-600 mx-auto"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-blue-600 animate-pulse">
                        <Wand2 size={32} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                        <ShieldAlert size={64} className="opacity-20 text-slate-600" />
                      </div>
                      <p className="text-lg font-bold text-slate-400">La simulazione del tuo sorriso apparirà qui</p>
                    </>
                  )}
                </div>
              )
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
