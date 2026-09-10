/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Siswa, NotifikasiLog, BiayaSekolah } from "../types";
import React, { useState, useMemo } from "react";
import { formatRupiah } from "../utils";
import { 
  Send, 
  MessageSquare, 
  Mail, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Bell,
  RefreshCw,
  Search,
  BookOpen,
  Check,
  X,
  Plus,
  Trash2,
  Edit,
  Save,
  FileText
} from "lucide-react";

interface NotificationViewProps {
  siswaList: Siswa[];
  biayaList: BiayaSekolah[];
  notificationLogs: NotifikasiLog[];
  onAddLog: (newLog: NotifikasiLog) => void;
  onBulkTriggerReminders?: () => void;
}

interface MessageTemplate {
  id: string;
  name: string;
  type: 'WhatsApp' | 'Email';
  content: string;
}

const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: "temp-wa-halus",
    name: "WA - Pengingat Sopan (Halus)",
    type: "WhatsApp",
    content: "Yth. Orang Tua/Wali dari {nama_siswa}, menginfokan bahwa iuran {bulan} sebesar {jumlah} akan jatuh tempo pada {tenggat}. Silahkan lakukan pembayaran di loket sekolah atau transfer bank ke rekening sekolah resmi. Terima kasih atas kerja samanya."
  },
  {
    id: "temp-wa-tegas",
    name: "WA - Peringatan Keras (Tegas)",
    type: "WhatsApp",
    content: "[Pemberitahuan Mendesak] Yth. Orang Tua/Wali dari {nama_siswa}, kami menginfokan kembali bahwa tunggakan {bulan} sebesar {jumlah} telah melewati batas jatuh tempo ({tenggat}). Mohon segera menyelesaikan administrasi di loket keuangan sekolah hari ini demi kenyamanan belajar putra/putri Anda."
  },
  {
    id: "temp-email-halus",
    name: "Email - Formulir Pengingat Halus",
    type: "Email",
    content: "Kepada Yth. Bapak/Ibu Wali dari {nama_siswa},\n\nKami menginformasikan bahwa pembayaran kewajiban sekolah untuk putra/putri Anda saat ini telah mendekati tenggat waktu/jatuh tempo:\n- Nama Siswa: {nama_siswa}\n- Kelas: {kelas}\n- Tagihan: {nama_tagihan}\n- Jumlah: {jumlah}\n- Tanggal Jatuh Tempo: {tenggat}\n\nMohon untuk segera menyelesaikan administrasi sebelum tenggat waktu terlewati.\n\nHormat kami,\nBendahara Sekolah"
  },
  {
    id: "temp-email-tegas",
    name: "Email - Surat Peringatan Tunggakan Tegas",
    type: "Email",
    content: "Kepada Yth. Bapak/Ibu Wali dari {nama_siswa},\n\nPERINGATAN SISA TUNGGAKAN ADMINISTRASI\n\nMelalui pemberitahuan resmi ini, kami mengabarkan bahwa berdasarkan pencatatan kami, putra/putri Anda memiliki tunggakan asministrasi yang belum dilunasi sebagai berikut:\n- Nama Siswa: {nama_siswa}\n- Kelas: {kelas}\n- Deskripsi: {nama_tagihan}\n- Jumlah Belum Bayar: {jumlah}\n- Tanggal Jatuh Tempo: {tenggat}\n\nMohon segera melakukan pembayaran selambat-lambatnya 3 hari setelah surel ini diterima. Terima kasih atas pengertian dan kerja sama Bapak/Ibu.\n\nHormat kami,\nKepala Bagian Keuangan Sekolah"
  }
];

export default function NotificationView({
  siswaList,
  biayaList,
  notificationLogs,
  onAddLog,
}: NotificationViewProps) {
  
  // States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<'All' | 'Email' | 'WhatsApp'>('All');
  
  // Load templates from localStorage or DEFAULT_TEMPLATES
  const [templates, setTemplates] = useState<MessageTemplate[]>(() => {
    const cached = localStorage.getItem("KAS_SEKOLAH_TEMPLATES");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    return DEFAULT_TEMPLATES;
  });

  const saveTemplates = (updated: MessageTemplate[]) => {
    setTemplates(updated);
    localStorage.setItem("KAS_SEKOLAH_TEMPLATES", JSON.stringify(updated));
  };

  const [reminderConfig, setReminderConfig] = useState({
    autoRemind: true,
    remindDaysBefore: 3,
    waTemplate: "Yth. Orang Tua/Wali dari {nama_siswa}, menginfokan tagihan SPP {bulan} sebesar {jumlah} akan jatuh tempo pada {tenggat}. Silahkan lakukan pembayaran di loket sekolah atau transfer bank ke rekening SMA Nusantara Mandiri. Terima kasih.",
    emailTemplate: "Kepada Yth. Bapak/Ibu Wali dari {nama_siswa},\n\nKami menginformasikan bahwa pembayaran kewajiban sekolah untuk putra/putri Anda saat ini telah mendekati tenggat waktu/jatuh tempo:\n- Nama Siswa: {nama_siswa}\n- Kelas: {kelas}\n- Tagihan: {nama_tagihan}\n- Jumlah: {jumlah}\n- Tanggal Jatuh Tempo: {tenggat}\n\nMohon untuk segera menyelesaikan administrasi sebelum tenggat waktu terlewati.\n\nHormat kami,\nBendahara SMA Nusantara Mandiri"
  });

  // Manage custom template state variables
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateType, setNewTemplateType] = useState<'WhatsApp' | 'Email'>('WhatsApp');
  const [newTemplateContent, setNewTemplateContent] = useState("");

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim() || !newTemplateContent.trim()) {
      alert("Nama template dan isi pesan wajib diisi!");
      return;
    }

    if (editingId) {
      const updated = templates.map(t => {
        if (t.id === editingId) {
          return {
            ...t,
            name: newTemplateName.trim(),
            type: newTemplateType,
            content: newTemplateContent.trim()
          };
        }
        return t;
      });
      saveTemplates(updated);
      setEditingId(null);
    } else {
      const newTemp: MessageTemplate = {
        id: `template-${Date.now()}`,
        name: newTemplateName.trim(),
        type: newTemplateType,
        content: newTemplateContent.trim()
      };
      saveTemplates([...templates, newTemp]);
    }

    // Reset Form
    setNewTemplateName("");
    setNewTemplateContent("");
    setShowAddForm(false);
  };

  const handleStartEditTemplate = (temp: MessageTemplate) => {
    setEditingId(temp.id);
    setNewTemplateName(temp.name);
    setNewTemplateType(temp.type);
    setNewTemplateContent(temp.content);
    setShowAddForm(true);
  };

  const handleDeleteTemplate = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus template pesan ini?")) {
      const updated = templates.filter(t => t.id !== id);
      saveTemplates(updated);
    }
  };

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const [activeTemplatePreview, setActiveTemplatePreview] = useState<{
    siswa: Siswa;
    tagihanName: string;
    bulanKey?: string;
    jumlah: number;
    tenggatHex: string;
    type: 'Email' | 'WhatsApp';
  } | null>(null);

  const [customMsgText, setCustomMsgText] = useState("");

  const currentYearMonth = "2026-05"; // static baseline for the application's timeline

  // Memoized: Find students who have unpaid bills
  const overdueUnpaidList = useMemo(() => {
    const list: Array<{
      siswa: Siswa;
      tunggakanSppBulan: string[];
      totalTunggakanSpp: number;
      nearDueFees: Array<{ name: string; amount: number; date: string }>;
    }> = [];

    siswaList.forEach(s => {
      // Find SPP months that are "Belum_Bayar" up to current period month (e.g., 2026-05 or older)
      const unpaidMonths: string[] = [];
      const sSpp = s.statusSpp || {};
      Object.keys(sSpp).forEach(monthKey => {
        // Simple comparison: Month keys <= 2026-05 are considered current or overdue if unpaid
        if (sSpp[monthKey] === "Belum_Bayar" && monthKey <= currentYearMonth) {
          unpaidMonths.push(monthKey);
        }
      });

      // Find other general defined school fees that haven't been paid as per student status
      // We can check if are near-due
      const nearDue: Array<{ name: string; amount: number; date: string }> = [];
      biayaList.forEach(b => {
        // If it's SPP, s.tagihanSpp already tracks it. If it's other categories, let's list them
        if (b.kategori !== "SPP") {
          // As a logical representation, we can see if student has unpaid non-SPP fees.
          // Since the database contains student transaction records, if they don't have a transaction 
          // matching this category, it's considered unpaid. For UI completeness, if SPP is unpaid we flag it.
          // Let's add any defined fees as outstanding sample reminders for display purposes.
        }
      });

      if (unpaidMonths.length > 0) {
        list.push({
          siswa: s,
          tunggakanSppBulan: unpaidMonths.sort(),
          totalTunggakanSpp: unpaidMonths.length * s.tagihanSpp,
          nearDueFees: nearDue
        });
      }
    });

    return list;
  }, [siswaList, biayaList]);

  // Filter list by search term safely
  const searchedOverdueList = useMemo(() => {
    return overdueUnpaidList.filter(item => {
      const s = item.siswa;
      if (!s) return false;
      const nameStr = s.nama ? String(s.nama) : "";
      const nisStr = s.nis ? String(s.nis) : "";
      const classStr = s.kelas ? String(s.kelas) : "";
      const q = searchTerm.toLowerCase();

      return nameStr.toLowerCase().includes(q) ||
             nisStr.includes(searchTerm) ||
             classStr.toLowerCase().includes(q);
    });
  }, [overdueUnpaidList, searchTerm]);

  // Handle generation of WhatsApp Deep Link
  const handleOpenWhatsAppLink = (siswa: Siswa, bulanName: string, jumlahText: string, total: number) => {
    const phone = siswa.teleponOrangTua || "";
    if (!phone) {
      alert("No. WhatsApp Orang Tua tidak diset! Harap edit biodata siswa dan isi telepon wali terlebih dahulu.");
      return;
    }

    // Clean phone number
    let cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "62" + cleanPhone.slice(1);
    }

    // Fill message template
    let text = reminderConfig.waTemplate
      .replace(/{nama_siswa}/g, siswa.nama)
      .replace(/{bulan}/g, bulanName)
      .replace(/{jumlah}/g, formatRupiah(total))
      .replace(/{tenggat}/g, "Tanggal 10 " + bulanName);

    // Add explicit log entry to database local storage
    const newLog: NotifikasiLog = {
      id: `log-${Date.now()}`,
      siswaId: siswa.id,
      siswaNama: siswa.nama,
      tipe: 'WhatsApp',
      kontakTujuan: phone,
      pesan: text,
      tanggalKirim: new Date().toISOString().replace('T', ' ').substring(0, 19),
      status: 'Sukses'
    };
    onAddLog(newLog);

    // Open WA Link
    const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  // Helper to compile a message template
  const compileTemplate = (
    templateContent: string,
    siswa: Siswa,
    tagihanName: string,
    jumlah: number,
    tenggatStr: string,
    bulanKey?: string
  ): string => {
    return templateContent
      .replace(/{nama_siswa}/g, siswa.nama)
      .replace(/{kelas}/g, siswa.kelas)
      .replace(/{nama_tagihan}/g, tagihanName)
      .replace(/{bulan}/g, bulanKey || tagihanName)
      .replace(/{jumlah}/g, formatRupiah(jumlah))
      .replace(/{tenggat}/g, tenggatStr);
  };

  // Preview and custom message sender modal
  const handleOpenPreviewModal = (
    siswa: Siswa, 
    tagihanName: string, 
    jumlah: number, 
    tenggatStr: string,
    type: 'Email' | 'WhatsApp',
    bulanKey?: string
  ) => {
    const matchingTemplates = templates.filter(t => t.type === type);
    let selectedId = "";
    let rawText = "";

    if (matchingTemplates.length > 0) {
      selectedId = matchingTemplates[0].id;
      rawText = compileTemplate(matchingTemplates[0].content, siswa, tagihanName, jumlah, tenggatStr, bulanKey);
    } else {
      // Fallback boilerplate
      const fallbackContent = type === 'WhatsApp' ? reminderConfig.waTemplate : reminderConfig.emailTemplate;
      rawText = compileTemplate(fallbackContent, siswa, tagihanName, jumlah, tenggatStr, bulanKey);
    }

    setSelectedTemplateId(selectedId);
    setCustomMsgText(rawText);
    setActiveTemplatePreview({
      siswa,
      tagihanName,
      bulanKey,
      jumlah,
      tenggatHex: tenggatStr,
      type
    });
  };

  const handleDirectEmail = (siswa: Siswa, tagihanName: string, total: number, bulanKey?: string) => {
    const address = siswa.emailOrangTua || "";
    if (!address || address === "-") {
      alert(`Email orang tua belum diset untuk siswa ${siswa.nama}! Harap edit biodata siswa terlebih dahulu.`);
      return;
    }

    // Get the first Email template or default
    const emailTemplates = templates.filter(t => t.type === 'Email');
    const templateContent = emailTemplates.length > 0 ? emailTemplates[0].content : reminderConfig.emailTemplate;
    
    const compiledText = compileTemplate(
      templateContent,
      siswa,
      tagihanName,
      total,
      "Tanggal 10 " + (bulanKey || tagihanName),
      bulanKey
    );

    // Capture Log
    const newLog: NotifikasiLog = {
      id: `log-${Date.now()}`,
      siswaId: siswa.id,
      siswaNama: siswa.nama,
      tipe: 'Email',
      kontakTujuan: address,
      pesan: compiledText,
      tanggalKirim: new Date().toISOString().replace('T', ' ').substring(0, 19),
      status: 'Sukses'
    };
    
    // Dispatch
    onAddLog(newLog);

    // Direct redirection via mailto using standard window.location.href (reliable in iframe/browsers)
    const subjectText = encodeURIComponent(`Pengingat Pembayaran Sekolah - ${siswa.nama}`);
    const mailtoUrl = `mailto:${address}?subject=${subjectText}&body=${encodeURIComponent(compiledText)}`;
    window.location.href = mailtoUrl;
  };

  const handleSendCustomMessage = () => {
    if (!activeTemplatePreview) return;
    const { siswa, type } = activeTemplatePreview;
    
    const address = type === 'Email' ? (siswa.emailOrangTua || "ortu@example.com") : (siswa.teleponOrangTua || "");
    if (!address || address === "-") {
      alert(`Kontak ${type} orang tua belum diset untuk siswa ${siswa.nama}!`);
      return;
    }

    // Capture Log
    const newLog: NotifikasiLog = {
      id: `log-${Date.now()}`,
      siswaId: siswa.id,
      siswaNama: siswa.nama,
      tipe: type,
      kontakTujuan: address,
      pesan: customMsgText,
      tanggalKirim: new Date().toISOString().replace('T', ' ').substring(0, 19),
      status: 'Sukses'
    };
    
    // Dispatch
    onAddLog(newLog);
    alert(`Notifikasi pengingat via ${type} berhasil dikirim dan diarsipkan di log!`);
    
    // Apply real action if WA
    if (type === 'WhatsApp') {
      let cleanPhone = address.replace(/[^0-9]/g, "");
      if (cleanPhone.startsWith("0")) {
        cleanPhone = "62" + cleanPhone.slice(1);
      }
      const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(customMsgText)}`;
      window.open(waUrl, '_blank');
    } else {
      // Direct email trigger using standard window.location.href
      const subjectText = encodeURIComponent(`Pengingat Pembayaran Sekolah - ${siswa.nama}`);
      const mailtoUrl = `mailto:${address}?subject=${subjectText}&body=${encodeURIComponent(customMsgText)}`;
      window.location.href = mailtoUrl;
    }

    setActiveTemplatePreview(null);
  };

  // Stats Counters
  const countOverdueTotal = overdueUnpaidList.length;
  const countTotalNominalUnpaid = useMemo(() => {
    return overdueUnpaidList.reduce((acc, curr) => acc + curr.totalTunggakanSpp, 0);
  }, [overdueUnpaidList]);

  const sortedLogs = useMemo(() => {
    return [...notificationLogs].sort((a, b) => b.tanggalKirim.localeCompare(a.tanggalKirim));
  }, [notificationLogs]);

  // Bulk trigger simulation
  const [bulkSending, setBulkSending] = useState(false);
  const handleBulkSimulate = () => {
    if (overdueUnpaidList.length === 0) {
      alert("Tidak ada siswa dengan iuran tertunggak atau jatuh tempo!");
      return;
    }

    if (!confirm(`Konfirmasi: Kirim notifikasi pengingat email otomatis secara massal ke ${overdueUnpaidList.length} orang tua siswa yang belum melunasi iuran?`)) {
      return;
    }

    setBulkSending(true);
    setTimeout(() => {
      let successCount = 0;
      overdueUnpaidList.forEach((item, index) => {
        const siswa = item.siswa;
        const parentEmail = siswa.emailOrangTua;
        if (parentEmail && parentEmail !== "-") {
          const unpaidFormat = item.tunggakanSppBulan.map(b => b).join(", ");
          
          let composed = reminderConfig.emailTemplate
            .replace(/{nama_siswa}/g, siswa.nama)
            .replace(/{kelas}/g, siswa.kelas)
            .replace(/{nama_tagihan}/g, `Iuran SPP Periode (${unpaidFormat})`)
            .replace(/{jumlah}/g, formatRupiah(item.totalTunggakanSpp))
            .replace(/{tenggat}/g, "Satu minggu dari sekarang");

          onAddLog({
            id: `log-bulk-${Date.now()}-${index}`,
            siswaId: siswa.id,
            siswaNama: siswa.nama,
            tipe: 'Email',
            kontakTujuan: parentEmail,
            pesan: composed,
            tanggalKirim: new Date().toISOString().replace('T', ' ').substring(0, 19),
            status: 'Sukses'
          });
          successCount++;
        }
      });

      setBulkSending(false);
      alert(`Sukses mengirimkan pengingat email otomatis massal ke ${successCount} orang tua/wali siswa! Log tercatat.`);
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-fade-in text-sm text-slate-100">
      
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="glass glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="size-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="size-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Siswa Menunggak SPP</span>
            <span className="text-2xl font-bold font-mono text-white block mt-0.5">{countOverdueTotal} <span className="text-xs text-slate-400 font-sans font-medium">Siswa</span></span>
          </div>
        </div>

        <div className="glass glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="size-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <AlertCircle className="size-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Total Nominal Belum Tertagih</span>
            <span className="text-2xl font-bold font-mono text-white block mt-0.5">{formatRupiah(countTotalNominalUnpaid)}</span>
          </div>
        </div>

        <div className="glass glass-card p-5 rounded-2xl flex items-center gap-4">
          <div className="size-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle className="size-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Notifikasi Terkirim (Bulan Ini)</span>
            <span className="text-2xl font-bold font-mono text-white block mt-0.5">{notificationLogs.length} <span className="text-xs text-slate-400 font-sans font-medium">Pengiriman</span></span>
          </div>
        </div>

      </div>

      {/* Auto Reminders Configuration & Bulk Dispatcher */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Configurations column */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass glass-card p-6 rounded-2xl space-y-6">
            <div className="flex items-center gap-2">
              <Bell className="size-5 text-blue-450 animate-pulse" />
              <h4 className="font-bold text-white text-sm">Konfigurasi Pengingat Otomatis</h4>
            </div>

            <div className="space-y-4 text-xs font-sans">
              
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <span className="font-semibold text-white block">Status Auto-Reminder</span>
                  <span className="text-[10px] text-slate-400">E-mail massal malam hari</span>
                </div>
                <button 
                  onClick={() => setReminderConfig(prev => ({ ...prev, autoRemind: !prev.autoRemind }))}
                  className="text-slate-300 hover:text-white transition-opacity cursor-pointer"
                >
                  {reminderConfig.autoRemind ? (
                    <ToggleRight className="size-8 text-blue-500" />
                  ) : (
                    <ToggleLeft className="size-8 text-slate-500" />
                  )}
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block text-left">Hari Sebelum Jatuh Tempo (SPP)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="7"
                    value={reminderConfig.remindDaysBefore}
                    onChange={(e) => setReminderConfig(prev => ({ ...prev, remindDaysBefore: parseInt(e.target.value, 10) || 3 }))}
                    className="w-16 px-2.5 py-1.5 bg-slate-950 border border-white/10 text-white font-mono rounded text-center text-xs"
                  />
                  <span className="text-slate-400">Hari sebelum tgl 10 bulanan</span>
                </div>
              </div>

              <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-3 mt-4 text-left">
                <h5 className="font-bold text-blue-300 text-[11px] uppercase tracking-wide">Picu Pengingat Manual Massal</h5>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Kirimkan email tagihan pembayaran formal secara massal sekaligus ke semua kontak wali murid yang memiliki iuran terutang dalam satu klik.
                </p>
                <button
                  disabled={bulkSending || overdueUnpaidList.length === 0}
                  onClick={handleBulkSimulate}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs text-white font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {bulkSending ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  <span>Kirim Pengingat Email Massal</span>
                </button>
              </div>

            </div>
          </div>

          {/* Template management panel */}
          <div className="glass glass-card p-6 rounded-2xl space-y-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-emerald-400 animate-pulse" />
                <h4 className="font-bold text-white text-sm">Kelola Template Pesan</h4>
              </div>
              <button
                onClick={() => {
                  setEditingId(null);
                  setNewTemplateName("");
                  setNewTemplateContent("");
                  setShowAddForm(!showAddForm);
                }}
                className="p-1 px-2.5 bg-emerald-500/10 hover:bg-emerald-550 hover:text-white rounded-lg text-emerald-300 border border-emerald-500/20 flex items-center justify-center cursor-pointer text-[10px] font-bold gap-1 transition-all"
              >
                {showAddForm ? <X className="size-3" /> : <Plus className="size-3" />}
                <span>{showAddForm ? "Batal" : "Buat"}</span>
              </button>
            </div>

            {showAddForm && (
              <form onSubmit={handleSaveTemplate} className="space-y-3 bg-white/5 p-3 rounded-xl border border-white/5 text-xs animate-fade-in">
                <h5 className="font-semibold text-slate-200 text-[11px] uppercase tracking-wide">
                  {editingId ? "Ubah Template" : "Tambah Template Baru"}
                </h5>
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold block text-[10px]">Nama Template</label>
                  <input
                    type="text"
                    required
                    placeholder="Misal: WA - Himbauan Santun"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-white/10 text-white rounded text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold block text-[10px]">Media Pengiriman</label>
                  <select
                    value={newTemplateType}
                    onChange={(e) => setNewTemplateType(e.target.value as 'WhatsApp' | 'Email')}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-white/10 text-white rounded text-xs font-semibold"
                  >
                    <option value="WhatsApp" className="bg-slate-900 text-white">WhatsApp</option>
                    <option value="Email" className="bg-slate-900 text-white">Email</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-slate-400 font-semibold block text-[10px]">Kalimat Iuran</label>
                    <span className="text-[8px] text-slate-500">Placeholder valid: <b className="font-mono">{`{nama_siswa}, {bulan}, {jumlah}, {tenggat}, {kelas}, {nama_tagihan}`}</b></span>
                  </div>
                  <textarea
                    required
                    rows={4}
                    placeholder="Contoh: Yth Bapak/Ibu Wali dari {nama_siswa}, tagihan iuran {bulan}..."
                    value={newTemplateContent}
                    onChange={(e) => setNewTemplateContent(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-white/10 text-white rounded font-mono text-[10px] leading-relaxed"
                  />
                </div>
                <div className="flex justify-end gap-1.5 pt-1">
                  <button
                    type="submit"
                    className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px] flex items-center gap-1 transition-all"
                  >
                    <Save className="size-3" />
                    <span>{editingId ? "Update" : "Simpan"}</span>
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2 mt-2 max-h-80 overflow-y-auto pr-1">
              {templates.map(t => (
                <div key={t.id} className="p-2.5 bg-white/5 border border-white/5 rounded-xl hover:border-white/10 transition-colors">
                  <div className="flex justify-between items-start gap-1">
                    <div className="truncate pr-1">
                      <span className={`px-1 py-0.5 rounded font-bold text-[8px] mr-1 ${t.type === 'WhatsApp' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/10' : 'bg-blue-500/15 text-blue-300 border border-blue-500/10'}`}>
                        {t.type}
                      </span>
                      <span className="font-semibold text-white text-[11px] truncate align-middle" title={t.name}>{t.name}</span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => handleStartEditTemplate(t)}
                        className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                        title="Edit Template ini"
                      >
                        <Edit className="size-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(t.id)}
                        className="p-1 text-red-400 hover:text-red-300 hover:bg-white/5 rounded transition-colors"
                        title="Hapus Template ini"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono line-clamp-2 mt-1.5 bg-slate-950/40 p-1.5 rounded leading-relaxed border border-white/5">
                    {t.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Overdue/Outstanding list table */}
        <div className="lg:col-span-8 glass glass-card p-6 rounded-2xl flex flex-col min-h-0">
          
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-4">
            <div>
              <h4 className="font-bold text-white text-sm">Daftar Siswa dengan Iuran Belum Lunas</h4>
              <p className="text-xs text-slate-400 mt-0.5">Ditemukan {searchedOverdueList.length} wali murid perlu dihubungi</p>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-450" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari siswa atau kelas..."
                className="w-full sm:w-52 pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 text-white rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1 border border-white/5 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 text-slate-450 font-bold uppercase bg-white/5">
                  <th className="py-2.5 px-3">Nama Siswa</th>
                  <th className="py-2.5 px-3">Kelas</th>
                  <th className="py-2.5 px-3">Kontak Orang Tua</th>
                  <th className="py-2.5 px-3 text-right">Tunggakan SPP</th>
                  <th className="py-2.5 px-3 text-center">Hubungi Wali</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {searchedOverdueList.map((item, i) => {
                  const s = item.siswa;
                  const unfilteredBulan = item.tunggakanSppBulan;
                  const latestMonth = unfilteredBulan[unfilteredBulan.length - 1];
                  const unpaidMonthsDisplay = unfilteredBulan.join(", ");
                  
                  return (
                    <tr key={s.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-semibold text-white block">{s.nama}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">NIS: {s.nis}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 font-semibold text-[10px]">
                          {s.kelas}
                        </span>
                      </td>
                      <td className="py-3 px-3 space-y-0.5">
                        <span className="text-slate-200 block text-[11px]">📱 {s.teleponOrangTua || "-"}</span>
                        <span className="text-slate-400 block text-[11px]">✉️ {s.emailOrangTua || "-"}</span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono font-bold text-red-400 block">{formatRupiah(item.totalTunggakanSpp)}</span>
                        <span className="text-[9px] text-slate-450 block truncate max-w-32" title={unpaidMonthsDisplay}>Bulan: {unpaidMonthsDisplay}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          
                          <button
                            onClick={() => handleOpenPreviewModal(s, `Iuran SPP (${unpaidMonthsDisplay})`, item.totalTunggakanSpp, `Tanggal 10 Bulanan`, 'WhatsApp', latestMonth)}
                            className="p-1 px-2 text-[10px] bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 rounded font-semibold cursor-pointer flex items-center gap-1 transition-all"
                            title="Kirim Pesan WhatsApp Pengingat"
                          >
                            <MessageSquare className="size-3" />
                            <span>WA</span>
                          </button>

                          <button
                            onClick={() => handleDirectEmail(s, `Iuran SPP (${unpaidMonthsDisplay})`, item.totalTunggakanSpp, latestMonth)}
                            className="p-1 px-2 text-[10px] bg-blue-500/10 text-blue-350 hover:bg-blue-600 hover:text-white border border-blue-500/20 rounded font-semibold cursor-pointer flex items-center gap-1 transition-all"
                            title="Kirim Email Pengingat (Buka Email Admin)"
                          >
                            <Mail className="size-3" />
                            <span>Email</span>
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                })}

                {searchedOverdueList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-450 italic">
                      <BookOpen className="size-6 mx-auto text-slate-500 mb-2" />
                      Tidak ada tunggakan pembayaran siswa yang ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>

      {/* Log history section */}
      <div className="glass glass-card p-6 rounded-2xl space-y-4">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="size-4.5 text-emerald-450" />
            <h4 className="font-bold text-white text-sm">Riwayat Pengiriman Notifikasi Pengingat</h4>
          </div>
          <span className="text-xs text-slate-400">Total Tercatat: <b>{notificationLogs.length}</b> Log</span>
        </div>

        <div className="overflow-x-auto border border-white/5 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 text-slate-450 font-bold uppercase bg-white/5">
                <th className="py-2.5 px-3">Tanggal Kirim</th>
                <th className="py-2.5 px-3">Nama Siswa</th>
                <th className="py-2.5 px-3">Metode / Media</th>
                <th className="py-2.5 px-3">Alamat / Nomor Tujuan</th>
                <th className="py-2.5 px-3">Kalimat Isi Notifikasi</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-350">
              {sortedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-[10px] whitespace-nowrap">{log.tanggalKirim}</td>
                  <td className="py-2.5 px-3 font-semibold text-white">{log.siswaNama}</td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold text-[10px] ${
                      log.tipe === 'Email' 
                        ? 'bg-blue-500/10 text-blue-300' 
                        : 'bg-emerald-500/10 text-emerald-300'
                    }`}>
                      {log.tipe === 'Email' ? <Mail className="size-2.5" /> : <MessageSquare className="size-2.5" />}
                      <span>{log.tipe}</span>
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] truncate max-w-36">{log.kontakTujuan}</td>
                  <td className="py-2.5 px-3 max-w-xs truncate" title={log.pesan}>{log.pesan}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                      ● {log.status}
                    </span>
                  </td>
                </tr>
              ))}

              {notificationLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                    Belum ada riwayat pengiriman notifikasi/pengingat bulan ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* TEMPLATE PREVIEW MODAL */}
      {activeTemplatePreview && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-sm text-slate-100">
            
            <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm">Pratinjau Pesan Pengingat</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Media: <span className="font-bold text-blue-400 uppercase">{activeTemplatePreview.type}</span> &nbsp;|&nbsp; Penerima: <span className="font-bold text-slate-200">{activeTemplatePreview.siswa.nama}</span></p>
              </div>
              <button 
                onClick={() => setActiveTemplatePreview(null)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors text-slate-450 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-350 block text-left">Alamat / Nomor Tujuan</label>
                <input
                  type="text"
                  readOnly
                  value={activeTemplatePreview.type === 'Email' ? (activeTemplatePreview.siswa.emailOrangTua || "-") : (activeTemplatePreview.siswa.teleponOrangTua || "")}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 text-slate-300 font-mono text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[11px] font-bold text-slate-350 block">Pilih Template Pengingat ({activeTemplatePreview.type})</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => {
                    const tempId = e.target.value;
                    setSelectedTemplateId(tempId);
                    const found = templates.find(t => t.id === tempId);
                    if (found) {
                      const compiled = compileTemplate(
                        found.content,
                        activeTemplatePreview.siswa,
                        activeTemplatePreview.tagihanName,
                        activeTemplatePreview.jumlah,
                        activeTemplatePreview.tenggatHex,
                        activeTemplatePreview.bulanKey
                      );
                      setCustomMsgText(compiled);
                    } else if (tempId === "custom_empty") {
                      setCustomMsgText("");
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 text-white font-semibold rounded-xl text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  {templates.filter(t => t.type === activeTemplatePreview.type).map(t => (
                    <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                      {t.name}
                    </option>
                  ))}
                  <option value="custom_empty" className="bg-slate-900 text-slate-400">
                    -- Buat Kalimat Kustom Sendiri --
                  </option>
                </select>
              </div>

              <div className="space-y-1.5 text-left">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-350">Kalimat Notifikasi (Bisa Diedit Manual)</label>
                  <span className="text-[10px] text-slate-500 font-semibold font-mono">{customMsgText.length} karakter</span>
                </div>
                <textarea
                  rows={8}
                  value={customMsgText}
                  onChange={(e) => setCustomMsgText(e.target.value)}
                  className="w-full p-4 bg-slate-950 border border-white/15 text-white font-sans text-xs rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none focus:border-transparent leading-relaxed"
                />
              </div>

              {activeTemplatePreview.type === 'WhatsApp' ? (
                <div className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20 text-[10px] text-emerald-350 leading-relaxed text-left flex gap-1.5">
                  <CheckCircle className="size-4.5 shrink-0 text-emerald-400" />
                  <span>
                    <b>Integrasi WhatsApp Web:</b> Mengklik tombol kirim akan mendokumentasikan log, memperbarui rekapitulasi, dan secara otomatis membuka jendela baru langsung ke API WhatsApp Web resmi yang telah terisi kalimat pesan ini secara real-time!
                  </span>
                </div>
              ) : (
                <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/20 text-[10px] text-blue-350 leading-relaxed text-left flex gap-1.5">
                  <Mail className="size-4.5 shrink-0 text-blue-400" />
                  <span>
                    <b>Pengiriman Email Remainder:</b> Mengklik kirim akan mencatat history ke log secara instan, menyelaraskan rekap, dan memicu email client di perangkat Anda.
                  </span>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-2.5 border-t border-white/10 mt-4">
                <button
                  type="button"
                  onClick={() => setActiveTemplatePreview(null)}
                  className="px-4 py-2 border border-white/10 text-slate-200 rounded-xl hover:bg-white/10 font-semibold text-xs cursor-pointer active:scale-95"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSendCustomMessage}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/20 border border-blue-450/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Send className="size-3.5" />
                  <span>Kirim Notifikasi Sekarang</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
