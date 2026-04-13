'use client';

import React, { useState } from 'react';
import { UploadCloud, Sparkles, Smile, Wrench, ScanFace, Droplet, ShieldPlus, Download, CheckCircle, Activity, FileText, ShieldAlert, User, Phone, Lock, AlertCircle } from 'lucide-react';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';
import { jsPDF } from "jspdf";
import QRCode from 'qrcode';

const TREATMENTS = [
  { id: 'whitening', title: 'Sbiancamento Dentale', desc: 'Smalto bianco e luminoso', icon: <Sparkles size={24} /> },
  { id: 'veneers', title: 'Faccette Hollywood', desc: 'Sorriso simmetrico perfetto', icon: <Smile size={24} /> },
  { id: 'braces', title: 'Apparecchio Metallico', desc: 'Allineamento ortodontico', icon: <Wrench size={24} /> },
  { id: 'invisalign', title: 'Allineatori Trasparenti', desc: 'Correzione invisibile', icon: <ScanFace size={24} /> },
  { id: 'gums', title: 'Depigmentazione Gengivale', desc: 'Gengive rosa e sane', icon: <Droplet size={24} /> },
  { id: 'implants', title: 'Impianti e Ponti', desc: 'Riempimento spazi', icon: <ShieldPlus size={24} /> },
];

export default function Page() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>(['whitening']);
  const [gdprConsent, setGdprConsent] = useState<boolean>(false);
  
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'generating' | 'lead_capture' | 'done'>('idle');
  const [analysisText, setAnalysisText] = useState<string>('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  
  const [smileScore, setSmileScore] = useState<number | null>(null);
  const [aiDiagnosis, setAiDiagnosis] = useState<string | null>(null);

  const [patientName, setPatientName] = useState<string>('');
  const [patientPhone, setPatientPhone] = useState<string>('');
  
  // New state for showing validation errors elegantly
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
      setPatientName('');
      setPatientPhone('');
      setFormError(null);
    }
  };

  const toggleTreatment = (id: string) => {
    setSelectedTreatments(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!selectedImage) return;
    if (selectedTreatments.length === 0) return;
    if (!gdprConsent) return;

    setStatus('analyzing');
    const scanningSteps = [
      "Scansione volumetrica in corso...", 
      "Calcolo dell'indice estetico...", 
      "Analisi clinica IA del sorriso...",
      "Preparazione della simulazione..."
    ];
    
    for (let i = 0; i < scanningSteps.length; i++) {
      setAnalysisText(scanningSteps[i]);
      await new Promise(r => setTimeout(r, 1000));
    }

    setStatus('generating');
    setAnalysisText("Applicazione della simulazione clinica...");
    
    try {
      const formData = new FormData();
      formData.append('image', selectedImage);
      formData.append('treatmentTypes', selectedTreatments.join(','));

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData, 
      });

      if (response.ok) {
        const data = await response.json();
        setResultUrl(data.outputUrl);
        setSmileScore(data.realSmileScore || 98);
        setAiDiagnosis(data.aiAnalysisText || "Simulazione completata con successo.");
        setStatus('lead_capture'); 
      } else {
        alert("Ops! Errore di elaborazione.");
        setStatus('idle');
      }
    } catch (error) {
      console.error(error);
      alert("Errore di connessione.");
      setStatus('idle');
    }
  };

  // ADVANCED VALIDATION (Italian Standards)
  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 1. Name Validation (Only letters and spaces, min 3 chars)
    const nameRegex = /^[a-zA-Z\s\u00C0-\u024F]{3,}$/;
    if (!nameRegex.test(patientName.trim())) {
      setFormError("Inserisci un nome valido (solo lettere, min 3 caratteri).");
      return;
    }

    // 2. Italian Phone Validation
    // Cleans spaces or dashes
    const cleanPhone = patientPhone.replace(/[\s\-]/g, '');
    // Matches: optional +39 or 0039, followed by 3, followed by 8 or 9 digits.
    const phoneRegex = /^(?:\+39|0039)?3\d{8,9}$/;
    
    if (!phoneRegex.test(cleanPhone)) {
      setFormError("Inserisci un cellulare italiano valido (es. +39 333 1234567 o 3331234567).");
      return;
    }

    console.log("🔥 NUOVO LEAD VALIDO:", { nome: patientName, telefono: cleanPhone });
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
    pdf.text("CLINICA DENTALE PRO", 20, 25);
    
    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(16);
    pdf.text("Report di Consultazione Estetica (IA)", 20, 55);

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Paziente: ${patientName.toUpperCase()}`, 20, 65);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Data: ${new Date().toLocaleDateString('it-IT')}`, 150, 65);
    
    pdf.setFont("helvetica", "bold");
    pdf.text("Diagnosi AI (Estetica):", 20, 80);
    pdf.setFont("helvetica", "normal");
    
    const textLines = pdf.splitTextToSize(aiDiagnosis, 170);
    pdf.text(textLines, 20, 87);
    const offset = textLines.length * 5;
    
    const selectedNames = TREATMENTS.filter(t => selectedTreatments.includes(t.id)).map(t => t.title).join(' + ');
    pdf.setFont("helvetica", "bold");
    pdf.text(`Trattamenti Consigliati: ${selectedNames}`, 20, 90 + offset);
    pdf.text(`Punteggio Sorriso Finale Previsto: 98/100`, 20, 97 + offset);

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
      pdf.text("Condividi la Magia!", 60, qrY + 12);
      
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text("Inquadra il QR Code con la fotocamera per vedere il risultato interattivo", 60, qrY + 18);
      pdf.text("e prenota la tua visita con la promozione esclusiva.", 60, qrY + 23);
    } catch (err) {
      console.error("QR Error", err);
    }

    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text("Disclaimer: Il risultato dell'IA è solo illustrativo. Non costituisce diagnosi medica definitiva.", 20, 280);
    pdf.text("Privacy: Immagine elaborata nel rispetto del GDPR. Nessun dato biometrico è archiviato.", 20, 285);

    pdf.save(`Report_IA_${patientName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        
        <div className="text-center mb-10 flex flex-col items-center justify-center">
          <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">
            Clinica Dentale IA <span className="text-blue-600">Pro</span>
          </h1>
          <p className="mt-3 text-slate-500 text-lg font-medium max-w-2xl">
            Simulazione Clinica Avanzata e Analisi Estetica del Sorriso.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[2fr,3fr] gap-10">
          
          <div className="space-y-6">
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-white relative hover:bg-slate-50 transition-colors">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              {previewUrl ? (
                <img src={previewUrl} alt="Anteprima" className="h-48 object-cover rounded-xl mx-auto shadow-sm" />
              ) : (
                <div className="py-8 text-slate-500">
                  <UploadCloud size={48} className="mx-auto mb-4 opacity-70" />
                  <p className="font-medium text-lg">Carica foto del paziente</p>
                  <p className="text-sm mt-1">Formati supportati: JPG, PNG</p>
                </div>
              )}
            </div>

            {(smileScore || aiDiagnosis) && status === 'done' && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col gap-5 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-full bg-green-100 text-green-600">
                    <Activity size={32} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-500 font-semibold">Punteggio Sorriso (IA)</p>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000 bg-green-500" style={{ width: `${smileScore}%` }}></div>
                    </div>
                  </div>
                  <div className="text-3xl font-bold">{smileScore}%</div>
                </div>
                
                {aiDiagnosis && (
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-2"><FileText size={18} /> Analisi Estetica:</h4>
                    <p className="text-slate-600 text-sm leading-relaxed">{aiDiagnosis}</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {TREATMENTS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTreatment(t.id)}
                  disabled={status === 'lead_capture' || status === 'done'}
                  className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${
                    selectedTreatments.includes(t.id) ? 'border-blue-600 bg-blue-50 shadow-md' : 'border-slate-200 bg-white hover:border-blue-300'
                  } ${status === 'lead_capture' || status === 'done' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className={`mb-2 ${selectedTreatments.includes(t.id) ? 'text-blue-600' : 'text-slate-400'}`}>{t.icon}</div>
                  <span className="font-semibold text-slate-800 text-sm">{t.title}</span>
                  <span className="text-xs text-slate-500 mt-1 leading-tight">{t.desc}</span>
                </button>
              ))}
            </div>

            {status !== 'lead_capture' && status !== 'done' && (
              <div className="flex items-start gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm mt-4">
                <input
                  type="checkbox"
                  id="gdpr"
                  checked={gdprConsent}
                  onChange={(e) => setGdprConsent(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-slate-300 text-blue-600 cursor-pointer"
                />
                <label htmlFor="gdpr" className="text-xs text-slate-500 leading-snug cursor-pointer">
                  Acconsento al trattamento dell'immagine per la simulazione estetica ai sensi del <strong className="text-slate-700">GDPR (Regolamento UE 2016/679)</strong>.
                </label>
              </div>
            )}

            {status !== 'lead_capture' && status !== 'done' && (
              <button 
                onClick={handleGenerate}
                disabled={!selectedImage || selectedTreatments.length === 0 || !gdprConsent || status === 'analyzing' || status === 'generating'}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-xl shadow-lg transition-all text-lg flex justify-center items-center gap-2"
              >
                {status === 'idle' && <span className="flex items-center gap-2"><Sparkles /> Genera Simulazione</span>}
                {(status === 'analyzing' || status === 'generating') && <span className="animate-pulse">{analysisText}</span>}
              </button>
            )}
            
            {status === 'done' && (
              <div className="w-full bg-green-100 text-green-700 font-bold py-4 rounded-xl shadow-sm text-lg flex justify-center items-center gap-2">
                <CheckCircle /> Risultato Sbloccato
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-6 border border-slate-100 flex flex-col justify-center items-center min-h-[600px] relative overflow-hidden">
            
            {/* LEAD CAPTURE WITH VALIDATION */}
            {status === 'lead_capture' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 bg-white/95 backdrop-blur-md animate-in fade-in zoom-in duration-500">
                <div className="bg-white border-2 border-blue-100 p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                    <Lock size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Risultato Pronto!</h3>
                  <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                    Inserisci i tuoi dati corretti per sbloccare la foto e scaricare il referto.
                  </p>
                  
                  <form onSubmit={handleLeadSubmit} className="space-y-4">
                    <div className="relative">
                      <User className="absolute left-3 top-3.5 text-slate-400" size={20} />
                      <input 
                        type="text" 
                        placeholder="Nome e Cognome" 
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        className={`w-full pl-10 pr-4 py-3 rounded-xl border ${formError && patientName.length < 3 ? 'border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'} outline-none transition-all focus:ring-4`}
                      />
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3.5 text-slate-400" size={20} />
                      <input 
                        type="tel" 
                        placeholder="Numero di Cellulare (es. 3331234567)" 
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(e.target.value)}
                        className={`w-full pl-10 pr-4 py-3 rounded-xl border ${formError && patientPhone.length < 9 ? 'border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'} outline-none transition-all focus:ring-4`}
                      />
                    </div>
                    
                    {/* Error Message Box */}
                    {formError && (
                      <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-xs text-left animate-in slide-in-from-top-1">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <p>{formError}</p>
                      </div>
                    )}

                    <button 
                      type="submit" 
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 transition-all shadow-lg mt-2"
                    >
                      <Sparkles size={20} /> Sblocca il Risultato
                    </button>
                  </form>
                </div>
              </div>
            )}

            {status === 'lead_capture' && previewUrl && (
              <div className="absolute inset-0 opacity-20 filter blur-xl scale-110" style={{ backgroundImage: `url(${previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
            )}

            {status === 'done' && resultUrl && previewUrl && aiDiagnosis ? (
              <div className="w-full animate-in fade-in zoom-in duration-700 text-center z-0">
                <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border-4 border-white mb-8 mx-auto">
                  <ReactCompareSlider
                    itemOne={<ReactCompareSliderImage src={previewUrl} alt="Prima" />}
                    itemTwo={<ReactCompareSliderImage src={resultUrl} alt="Dopo" />}
                    className="w-full h-auto aspect-square object-cover"
                  />
                </div>
                <button onClick={generatePDF} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold text-lg flex justify-center items-center gap-3 transition-colors max-w-sm mx-auto shadow-lg">
                  <Download size={22} /> Scarica Referto PDF con QR
                </button>
              </div>
            ) : (
              status !== 'lead_capture' && (
                <div className="text-center text-slate-400">
                  {status === 'analyzing' || status === 'generating' ? (
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
                  ) : (
                    <ShieldAlert size={64} className="mx-auto opacity-40 mb-4" />
                  )}
                  <p className="mt-2 text-sm font-medium">La simulazione apparirà qui</p>
                </div>
              )
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
