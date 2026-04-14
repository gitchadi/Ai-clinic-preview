'use client';

import React from 'react';
import { 
  LayoutDashboard, Users, Settings, MessageCircle, 
  TrendingUp, Calendar, Bell, Search, Sparkles, 
  ChevronRight, Phone, Euro
} from 'lucide-react';

// =====================================================================
// 📊 Mock Data (بيانات وهمية تظهر في الفيديو عشان تبهر العميل)
// =====================================================================
const stats = [
  { title: "Nuovi Lead (Mese)", value: "142", icon: Users, color: "text-blue-600", bg: "bg-blue-100", trend: "+12%" },
  { title: "Tasso di Conversione", value: "38%", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-100", trend: "+5.2%" },
  { title: "Valore Potenziale", value: "€ 45.500", icon: Euro, color: "text-indigo-600", bg: "bg-indigo-100", trend: "+18%" },
];

const recentLeads = [
  { id: 1, name: "Ahmed Hassan", phone: "+39 333 1234567", diagnosis: "Sbiancamento + Faccette (Denti ingialliti e spazi)", score: 45, date: "Oggi, 10:30", status: "Nuovo" },
  { id: 2, name: "Giulia Bianchi", phone: "+39 340 9876543", diagnosis: "Impianti (Denti mancanti arcata superiore)", score: 32, date: "Oggi, 09:15", status: "Contattato" },
  { id: 3, name: "Marco Rossi", phone: "+39 331 4567890", diagnosis: "Allineatori Trasparenti (Affollamento lieve)", score: 78, date: "Ieri, 16:45", status: "In visita" },
  { id: 4, name: "Sofia Ricci", phone: "+39 328 1122334", diagnosis: "Restauro Estetico Completo (Usura dentale)", score: 55, date: "Ieri, 11:20", status: "Nuovo" },
  { id: 5, name: "Lorenzo Romano", phone: "+39 345 6677889", diagnosis: "Sbiancamento Dentale (Discromia lieve)", score: 82, date: "2 giorni fa", status: "Chiuso" },
];

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      
      {/* ================= SIDEBAR ================= */}
      <aside className="w-64 bg-white border-r border-slate-200 flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Sparkles className="text-blue-600" /> IA Pro <span className="text-blue-600">Admin</span>
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <a href="#" className="flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-xl font-bold transition-colors">
            <LayoutDashboard size={20} /> Dashboard
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-xl font-semibold transition-colors">
            <Users size={20} /> Pazienti (Leads)
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-xl font-semibold transition-colors">
            <Calendar size={20} /> Appuntamenti
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-xl font-semibold transition-colors">
            <Settings size={20} /> Impostazioni Clinica
          </a>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
              SA
            </div>
            <div>
              <p className="text-sm font-bold">Studio Alessandro</p>
              <p className="text-xs text-slate-500">Piano Premium</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* HEADER */}
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-2xl font-bold text-slate-800">Panoramica Clinica</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="Cerca paziente..." className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64" />
            </div>
            <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Bell size={24} />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-auto p-8">
          
          {/* STATS CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {stats.map((stat, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
                <div className={`w-16 h-16 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                  <stat.icon size={32} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-bold uppercase tracking-wide">{stat.title}</p>
                  <div className="flex items-baseline gap-3 mt-1">
                    <h3 className="text-3xl font-black text-slate-800">{stat.value}</h3>
                    <span className="text-sm font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">{stat.trend}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CRM TABLE */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800">Leads Recenti (Generati dall'IA)</h3>
              <button className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                Vedi tutti <ChevronRight size={16} />
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-4 font-bold">Paziente</th>
                    <th className="px-6 py-4 font-bold">Punteggio IA</th>
                    <th className="px-6 py-4 font-bold">Diagnosi Estetica</th>
                    <th className="px-6 py-4 font-bold">Data</th>
                    <th className="px-6 py-4 font-bold text-right">Azione (Contatta)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold uppercase">
                            {lead.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{lead.name}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone size={12} /> {lead.phone}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-slate-100 rounded-full h-2 max-w-[80px]">
                            <div className={`h-full rounded-full ${lead.score < 50 ? 'bg-red-500' : lead.score < 75 ? 'bg-yellow-400' : 'bg-green-500'}`} style={{ width: `${lead.score}%` }}></div>
                          </div>
                          <span className="text-xs font-bold text-slate-600">{lead.score}/100</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600 font-medium max-w-xs truncate" title={lead.diagnosis}>
                          {lead.diagnosis}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-slate-500">{lead.date}</span>
                        {lead.status === 'Nuovo' && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm">
                          <MessageCircle size={16} /> WhatsApp
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
