/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Siswa, AppConfig } from "../types";
import { formatRupiah, DAFTAR_BULAN, normalizePhoneNumber } from "../utils";
import React, { useState } from "react";
import { 
  UserPlus, 
  Trash2, 
  Edit, 
  Search, 
  X, 
  Compass, 
  AlertTriangle,
  FolderOpen,
  Filter,
  Upload,
  Download,
  Check,
  FileSpreadsheet,
  FileText
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface StudentsViewProps {
  siswaList: Siswa[];
  config?: AppConfig;
  onAddSiswa: (siswa: Siswa) => void;
  onAddSiswaBatch?: (siswaArray: Siswa[], isReplace?: boolean) => void;
  onEditSiswa: (siswa: Siswa) => void;
  onDeleteSiswa: (id: string) => void;
  onNavigateToPayment: (siswaId: string) => void;
}

export default function StudentsView({ 
  siswaList, 
  config,
  onAddSiswa, 
  onAddSiswaBatch,
  onEditSiswa, 
  onDeleteSiswa,
  onNavigateToPayment
}: StudentsViewProps) {
  
  // States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState("Semua");
  const [statusSppFilter, setStatusSppFilter] = useState("Semua");
  
  const currentDate = new Date();
  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`; // e.g. "2026-05"

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

  // CSV Import States
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvPreviewList, setCsvPreviewList] = useState<any[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('replace');

  // Form states
  const [formId, setFormId] = useState("");
  const [formNis, setFormNis] = useState("");
  const [formNama, setFormNama] = useState("");
  const [formKelas, setFormKelas] = useState("");
  const [formAngkatan, setFormAngkatan] = useState("2026");
  const [formTagihanSpp, setFormTagihanSpp] = useState<number>(350000);
  const [formEmail, setFormEmail] = useState("");
  const [formTelepon, setFormTelepon] = useState("");

  // Filter lists - dynamically extracted from actual students list, or fallback if empty
  const dynamicClasses = Array.from(new Set(siswaList.map(s => s.kelas))).filter(Boolean).sort();
  const classes = ["Semua", ...(dynamicClasses.length > 0 ? dynamicClasses : ["X-IPA-1", "X-IPA-2", "X-IPS-1", "XI-IPA-1", "XI-IPA-2", "XI-IPS-1", "XII-IPA-1", "XII-IPS-1"])];

  // Smart CSV parser
  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(line => line !== "");
    if (lines.length < 2) return [];
    
    // Find if separator is semicolon or comma
    const firstLine = lines[0];
    let separator = ",";
    if (firstLine.includes(";")) {
      separator = ";";
    }
    
    const headers = firstLine.split(separator).map(h => h.trim().toLowerCase());
    
    // Header indices
    const nisIdx = headers.indexOf("nis");
    const namaIdx = headers.indexOf("nama");
    const kelasIdx = headers.indexOf("kelas");
    const angkatanIdx = headers.indexOf("angkatan");
    const tagihanSppIdx = headers.indexOf("tagihanspp") !== -1 ? headers.indexOf("tagihanspp") : headers.findIndex(h => h.includes("tagihan") || h.includes("spp"));
    
    // Find email and phone with flexible synonym matching
    const emailIdx = headers.findIndex(h => {
      const normalized = h.replace(/[^a-z0-9]/g, "");
      return ["emailorangtua", "emailortu", "email_orang_tua", "email", "mail", "e-mail", "posel"].some(syn => normalized.includes(syn));
    });

    const telpIdx = headers.findIndex(h => {
      const normalized = h.replace(/[^a-z0-9]/g, "");
      return ["teleponorangtua", "teleponortu", "telepon_orang_tua", "telepon", "telp", "phone", "contact", "whatsapp", "wa", "nowa", "nowhatsapp", "nohp", "hp", "nomorwhatsapp", "nomorwa", "nomorhp"].some(syn => normalized.includes(syn));
    });
    
    // If we can't find core fields, alert/fail
    if (nisIdx === -1 || namaIdx === -1) {
      alert("Format kolom header CSV tidak valid. Template harus mengandung setidaknya: nis, nama, kelas, angkatan, tagihanSpp");
      return [];
    }
    
    const parsedStudents: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const currentLine = lines[i];
      const cols = currentLine.split(separator).map(col => {
        let val = col.trim();
        // Handle Excel formulas like ="08123"
        if (val.startsWith('="') && val.endsWith('"')) {
          val = val.substring(2, val.length - 1);
        }
        // Handle normal quotes like "08123"
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        }
        // Handle single quote text prefix like '08123
        if (val.startsWith("'")) {
          val = val.substring(1);
        }
        return val;
      });
      
      const nis = cols[nisIdx] || "";
      const nama = cols[namaIdx] || "";
      const kelas = cols[kelasIdx] || "X-IPA-1";
      const angkatan = cols[angkatanIdx] || "2026";
      const tagihanSpp = parseInt(cols[tagihanSppIdx], 10) || 350000;
      const emailOrangTua = emailIdx !== -1 ? cols[emailIdx] : "";
      
      let teleponOrangTua = telpIdx !== -1 ? cols[telpIdx] : "";
      teleponOrangTua = normalizePhoneNumber(teleponOrangTua);
      
      if (nis && nama) {
        parsedStudents.push({
          nis,
          nama,
          kelas,
          angkatan,
          tagihanSpp,
          emailOrangTua,
          teleponOrangTua
        });
      }
    }
    
    return parsedStudents;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      alert("Hanya berkas format .csv yang diperbolehkan!");
      return;
    }
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        alert("Gagal membaca atau tidak menemukan baris data siswa yang valid di dalam file CSV.");
        setCsvFileName("");
        return;
      }
      setCsvPreviewList(parsed);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const downloadCSVTemplate = () => {
    const headers = "nis,nama,kelas,angkatan,tagihanSpp,emailOrangTua,teleponOrangTua\n";
    const rows = [
      "2026010,Ahmad Fauzi,X-IPA-1,2026,350000,fauzi.ortu@gmail.com,08123456789",
      "2026011,Budi Hartono,X-IPS-1,2026,350000,budi.ortu@gmail.com,0818273645",
      "2026012,Citra Handayani,XI-IPA-1,2026,350000,citra.ortu@gmail.com,0852736456",
    ].join("\n");
    
    const csvContent = headers + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "template_impor_siswa.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const executeImport = () => {
    if (csvPreviewList.length === 0) return;
    
    let duplicateCount = 0;
    let addedCount = 0;

    const defaultStatusSpp: Record<string, 'Lunas' | 'Belum_Bayar'> = {};
    DAFTAR_BULAN.forEach(m => {
      defaultStatusSpp[m.key] = "Belum_Bayar";
    });

    const newSiswaList: Siswa[] = [];

    csvPreviewList.forEach((parsed, index) => {
      // If we are appending, check duplicate against current list, otherwise only against the newly parsed list
      const isDuplicate = importMode === 'append'
        ? siswaList.some(s => s.nis === parsed.nis) || newSiswaList.some(s => s.nis === parsed.nis)
        : newSiswaList.some(s => s.nis === parsed.nis);
        
      if (isDuplicate) {
        duplicateCount++;
        return;
      }

      const newSiswa: Siswa = {
        id: `sis-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
        nis: parsed.nis,
        nama: parsed.nama,
        kelas: parsed.kelas,
        angkatan: parsed.angkatan,
        tagihanSpp: Number(parsed.tagihanSpp) || 350000,
        statusSpp: { ...defaultStatusSpp },
        emailOrangTua: parsed.emailOrangTua || "-",
        teleponOrangTua: parsed.teleponOrangTua || "-"
      };

      newSiswaList.push(newSiswa);
      addedCount++;
    });

    if (newSiswaList.length > 0) {
      if (onAddSiswaBatch) {
        onAddSiswaBatch(newSiswaList, importMode === 'replace');
      } else {
        if (importMode === 'replace') {
          // Fallback if batch add is not available, but since it is, it'll run onAddSiswaBatch
          newSiswaList.forEach(s => onAddSiswa(s));
        } else {
          newSiswaList.forEach(s => onAddSiswa(s));
        }
      }
    }

    if (importMode === 'replace') {
      alert(`Proses impor selesai! Seluruh data siswa lama telah digantikan dengan ${addedCount} data siswa baru.${duplicateCount > 0 ? ` Terlewati ${duplicateCount} baris dDuplikasi NIS dalam berkas.` : ""}`);
    } else {
      alert(`Proses impor selesai! Berhasil menambahkan ${addedCount} siswa baru ke sistem.${duplicateCount > 0 ? ` Terlewati ${duplicateCount} baris dDuplikasi NIS dengan data yang ada.` : ""}`);
    }
    
    // Reset
    setCsvPreviewList([]);
    setCsvFileName("");
    setIsImportOpen(false);
  };

  const filteredStudents = siswaList.filter(s => {
    if (!s) return false;
    const nameStr = s.nama ? String(s.nama) : "";
    const nisStr = s.nis ? String(s.nis) : "";
    const searchVal = searchQuery.toLowerCase();
    
    const matchesSearch = nameStr.toLowerCase().includes(searchVal) || 
                          nisStr.includes(searchQuery);
    const matchesClass = selectedClassFilter === "Semua" || String(s.kelas || "") === selectedClassFilter;
    
    const sSpp = s.statusSpp || {};
    let matchesStatus = true;
    if (statusSppFilter === "Lunas") {
      matchesStatus = sSpp[currentMonthKey] === "Lunas";
    } else if (statusSppFilter === "Belum_Lunas") {
      matchesStatus = sSpp[currentMonthKey] !== "Lunas";
    }

    return matchesSearch && matchesClass && matchesStatus;
  });

  // Export to Excel / CSV function
  const exportStudentsToCSV = () => {
    if (filteredStudents.length === 0) {
      alert("Tidak ada data siswa untuk diekspor.");
      return;
    }

    const headers = [
      "NIS",
      "Nama Siswa",
      "Kelas",
      "Angkatan",
      "Tarif SPP Bulanan (Rp)",
      "Status SPP Bulan Ini",
      "Email Orang Tua",
      "Telepon Orang Tua"
    ];

    const rows = filteredStudents.map(s => {
      const sSpp = s.statusSpp || {};
      const status = sSpp[currentMonthKey] || "Belum_Bayar";
      const isLunas = status === "Lunas";
      const isKurang = typeof status === "string" && status.startsWith("Kurang:");
      let statusStr = "Belum Lunas";
      if (isLunas) statusStr = "Lunas";
      else if (isKurang) statusStr = `Kurang: Rp ${status.split(":")[1]}`;

      return [
        s.nis,
        s.nama,
        s.kelas,
        s.angkatan,
        s.tagihanSpp,
        statusStr,
        s.emailOrangTua || "-",
        s.teleponOrangTua || "-"
      ];
    });

    // Add Byte Order Mark (BOM) for Excel compatibility with UTF-8 character encoding
    const csvContent = "\uFEFF" 
      + [headers.join(","), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Daftar_Siswa_${selectedClassFilter === "Semua" ? "Semua_Kelas" : selectedClassFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF function
  const exportStudentsToPDF = () => {
    if (filteredStudents.length === 0) {
      alert("Tidak ada data siswa untuk diekspor.");
      return;
    }

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const primaryColor = [26, 54, 93]; 
    const secondaryColor = [74, 85, 104];
    const blackColor = [17, 24, 39];

    // Header title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("DAFTAR SISWA & STATUS TUNGGAKAN SPP", 105, 15, { align: "center" });

    doc.setFontSize(11);
    doc.text(config?.namaSekolah || "Aplikasi Kasir Sekolah", 105, 21, { align: "center" });

    // Header double-lines separator
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.8);
    doc.line(15, 25, 195, 25);

    // Meta parameters left/right
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(blackColor[0], blackColor[1], blackColor[2]);
    doc.text("Filter Kelas:", 15, 32);
    doc.setFont("helvetica", "normal");
    doc.text(selectedClassFilter === "Semua" ? "Semua Kelas" : `Kelas ${selectedClassFilter}`, 40, 32);

    doc.setFont("helvetica", "bold");
    doc.text("Status SPP:", 120, 32);
    doc.setFont("helvetica", "normal");
    const statusLabel = statusSppFilter === "Semua" ? "Semua Status" : statusSppFilter === "Lunas" ? "Lunas Bulan Ini" : "Belum Lunas Bulan Ini";
    doc.text(statusLabel, 145, 32);

    // Aggregations display box
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(15, 37, 180, 12, 1, 1, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    const totalSiswaCount = filteredStudents.length;
    const lunasCount = filteredStudents.filter(s => {
      const sSpp = s.statusSpp || {};
      return sSpp[currentMonthKey] === "Lunas";
    }).length;
    const belumLunasCount = totalSiswaCount - lunasCount;

    doc.text(`TOTAL TAMPIL: ${totalSiswaCount} SISWA`, 20, 44);
    doc.setTextColor(21, 128, 61);
    doc.text(`LUNAS SPP MEI 2026: ${lunasCount}`, 80, 44);
    doc.setTextColor(185, 28, 28);
    doc.text(`BELUM LUNAS MEI 2026: ${belumLunasCount}`, 140, 44);

    // Table mapping
    const tableHeaders = [
      ["No", "NIS", "Nama Siswa", "Kelas", "Angkatan", "Tarif SPP", "Status SPP (Bulan Ini)"]
    ];

    const tableBody = filteredStudents.map((s, idx) => {
      const sSpp = s.statusSpp || {};
      const statusValue = sSpp[currentMonthKey] || "Belum_Bayar";
      const isLunas = statusValue === "Lunas";
      const isKurang = typeof statusValue === "string" && statusValue.startsWith("Kurang:");
      let sStr = "Belum Lunas";
      if (isLunas) sStr = "Lunas";
      else if (isKurang) sStr = `Kurang: Rp ${statusValue.split(":")[1]}`;

      return [
        idx + 1,
        s.nis,
        s.nama,
        s.kelas,
        s.angkatan,
        formatRupiah(s.tagihanSpp).replace(",00", ""),
        sStr
      ];
    });

    autoTable(doc, {
      startY: 53,
      head: tableHeaders,
      body: tableBody,
      theme: "grid",
      headStyles: {
        fillColor: [26, 54, 93],
        textColor: [255, 255, 255],
        fontSize: 8,
        halign: "left",
        fontStyle: "bold"
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 20 },
        2: { cellWidth: 50, fontStyle: "bold" },
        3: { cellWidth: 20 },
        4: { cellWidth: 15, halign: "center" },
        5: { cellWidth: 25, halign: "right" },
        6: { cellWidth: 40, halign: "center" }
      },
      styles: {
        textColor: [51, 51, 51],
        fontSize: 8,
        cellPadding: 2,
        valign: "middle"
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      }
    });

    doc.save(`Daftar_Siswa_${selectedClassFilter}.pdf`);
  };

  // Highlight search queries in text strings safely
  const highlightText = (text: any, query: string, fieldId: string) => {
    const cleanText = (text !== undefined && text !== null) ? String(text) : "";
    if (!query.trim()) return <span id={`${fieldId}-text`}>{cleanText}</span>;
    const safeQuery = query.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const parts = cleanText.split(new RegExp(`(${safeQuery})`, 'gi'));
    return (
      <span id={`${fieldId}-highlight-container`}>
        {parts.map((part, i) => 
          part.toLowerCase() === query.trim().toLowerCase() ? (
            <mark key={i} id={`${fieldId}-highlight-span-${i}`} className="bg-amber-500/35 text-amber-150 font-bold rounded-sm px-0.5">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const openAddModal = () => {
    setModalMode('add');
    setFormId("");
    setFormNis("");
    setFormNama("");
    setFormKelas("");
    setFormAngkatan("2026");
    setFormTagihanSpp(350000);
    setFormEmail("");
    setFormTelepon("");
    setIsModalOpen(true);
  };

  const openEditModal = (s: Siswa) => {
    setModalMode('edit');
    setFormId(s.id);
    setFormNis(s.nis);
    setFormNama(s.nama);
    setFormKelas(s.kelas);
    setFormAngkatan(s.angkatan);
    setFormTagihanSpp(s.tagihanSpp);
    setFormEmail(s.emailOrangTua || "");
    setFormTelepon(s.teleponOrangTua || "");
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNis || !formNama) {
      alert("NIS dan Nama Siswa harus diisi!");
      return;
    }

    if (modalMode === 'add') {
      // Check if NIS already exists
      if (siswaList.some(s => s.nis === formNis)) {
        alert("Siswa dengan NIS ini sudah terdaftar!");
        return;
      }

      // Build status SPP dictionary
      const defaultStatusSpp: Record<string, 'Lunas' | 'Belum_Bayar'> = {};
      DAFTAR_BULAN.forEach(m => {
        defaultStatusSpp[m.key] = "Belum_Bayar";
      });

      const newSiswa: Siswa = {
        id: `sis-${Date.now()}`,
        nis: formNis,
        nama: formNama,
        kelas: formKelas,
        angkatan: formAngkatan,
        tagihanSpp: Number(formTagihanSpp) || 350000,
        statusSpp: defaultStatusSpp,
        emailOrangTua: formEmail,
        teleponOrangTua: formTelepon
      };

      onAddSiswa(newSiswa);
    } else {
      // Find current student parameters to preserve statusSpp
      const originalSiswa = siswaList.find(s => s.id === formId);
      if (!originalSiswa) return;

      const updatedSiswa: Siswa = {
        ...originalSiswa,
        nis: formNis,
        nama: formNama,
        kelas: formKelas,
        angkatan: formAngkatan,
        tagihanSpp: Number(formTagihanSpp) || 350000,
        emailOrangTua: formEmail,
        teleponOrangTua: formTelepon
      };

      onEditSiswa(updatedSiswa);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus data siswa "${name}"? Seluruh riwayat tunggakan di master akan dihilangkan.`)) {
      onDeleteSiswa(id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-sm text-slate-100">
      
      {/* Top action layout */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass glass-card p-5 rounded-2xl">
        
        {/* Left Search with input */}
        <div className="flex flex-1 flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-450" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Nama Siswa atau NIS..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 text-white font-medium rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/10 transition-all placeholder:text-slate-400 shadow-inner"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="size-4 text-slate-450" />
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-medium rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-900"
            >
              {classes.map((cls, i) => (
                <option key={i} value={cls} className="bg-slate-900 border-none select-none text-white">
                  {cls === "Semua" ? "Semua Kelas" : (cls.toLowerCase().startsWith("kelas") ? cls : `Kelas ${cls}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="size-4 text-slate-450" />
            <select
              value={statusSppFilter}
              onChange={(e) => setStatusSppFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-medium rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-900"
            >
              <option value="Semua" className="bg-slate-900 border-none select-none text-white">Semua Status SPP</option>
              <option value="Lunas" className="bg-slate-900 border-none select-none text-white">Lunas Bulan Ini</option>
              <option value="Belum_Lunas" className="bg-slate-900 border-none select-none text-white">Belum Lunas Bulan Ini</option>
            </select>
          </div>

        </div>

        {/* Right action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportStudentsToCSV}
            className="flex items-center gap-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/25 rounded-xl font-bold px-4 py-2.5 text-xs transition-colors cursor-pointer text-center justify-center active:scale-[0.98]"
            title="Ekspor data siswa terseleksi ke Excel (CSV)"
          >
            <FileSpreadsheet className="size-4 text-emerald-400 animate-bounce" />
            Ekspor Excel
          </button>

          <button
            onClick={exportStudentsToPDF}
            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 rounded-xl font-bold px-4 py-2.5 text-xs transition-colors cursor-pointer text-center justify-center active:scale-[0.98]"
            title="Ekspor data siswa terseleksi ke PDF"
          >
            <FileText className="size-4 text-red-400 animate-pulse" />
            Ekspor PDF
          </button>

          <button
            onClick={() => setIsImportOpen(!isImportOpen)}
            className={`flex items-center gap-2 rounded-xl font-bold px-4 py-2.5 text-xs border transition-all cursor-pointer text-center justify-center active:scale-[0.98] ${
              isImportOpen
                ? "bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/15"
                : "bg-white/5 text-slate-300 border-white/10 hover:text-white hover:bg-white/10"
            }`}
          >
            <Upload className="size-4" />
            Impor Massal (CSV)
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold px-5 py-2.5 text-xs shadow-lg shadow-blue-500/20 border border-blue-400/20 transition-all cursor-pointer text-center justify-center active:scale-[0.98]"
          >
            <UserPlus className="size-4" />
            Tambah Siswa Baru
          </button>
        </div>

      </div>

      {/* CSV Import Panel / Box */}
      {isImportOpen && (
        <div className="glass glass-card p-6 rounded-2xl space-y-4 animate-fade-in text-left">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="size-4.5 text-blue-400" />
                Impor Massal Siswa via Berkas CSV
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Daftarkan siswa baru sekaligus dengan mudah menggunakan file CSV.
              </p>
            </div>
            <button
              onClick={() => {
                setIsImportOpen(false);
                setCsvPreviewList([]);
                setCsvFileName("");
              }}
              className="p-1 cursor-pointer hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Step 1: Download template */}
            <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-blue-400">Langkah 1</span>
                <h4 className="text-xs font-bold text-white mt-1">Unduh Template Berkas</h4>
                <p className="text-[11px] text-slate-350 mt-1.5 leading-relaxed">
                  Gunakan format kolom yang sesuai agar sistem dapat memproses data Anda dengan lancar tanpa error.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadCSVTemplate}
                className="mt-4 flex items-center gap-2 justify-center py-2 px-3 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold border border-white/10 transition-colors cursor-pointer"
              >
                <Download className="size-4 text-blue-400" />
                Unduh Template CSV
              </button>
            </div>

            {/* Step 2: Upload Excel/CSV */}
            <div className="md:col-span-2 flex flex-col">
              <span className="text-[10px] font-black uppercase text-blue-400">Langkah 2</span>
              <h4 className="text-xs font-bold text-white mt-1 mb-2">Unggah atau Seret File (.csv)</h4>
              
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all cursor-pointer text-center ${
                  isDragging 
                    ? "border-blue-500 bg-blue-500/15" 
                    : csvFileName 
                      ? "border-emerald-500 bg-emerald-500/5" 
                      : "border-white/15 bg-white/5 hover:border-white/30"
                }`}
                onClick={() => document.getElementById('csv-file-input-s')?.click()}
              >
                <input
                  id="csv-file-input-s"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Upload className={`size-8 mb-2 ${csvFileName ? "text-emerald-400" : "text-slate-400"}`} />
                {csvFileName ? (
                  <div>
                    <p className="text-xs font-bold text-white mb-1">Pemberkasan Terbaca!</p>
                    <p className="text-[11px] font-mono text-emerald-400">{csvFileName}</p>
                    <p className="text-[10px] text-slate-300 mt-2 font-semibold">
                      Klik lagi atau seret untuk mengganti file
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold text-slate-300">
                      Seret berkas CSV ke sini, atau <span className="text-blue-400 font-bold hover:underline">Pilih dari Komputer</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Maksimal ukuran file 5 MB format .csv dengan pemisah koma/titik-koma
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Step 3: Review Preview & execute */}
          {csvPreviewList.length > 0 && (
            <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-white">Langkah 3: Pratinjau Data yang Siap Diimpor</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Membaca {csvPreviewList.length} siswa dari berkas. Silakan pilih metode impor:
                  </p>
                </div>

                {/* Import Mode Selection */}
                <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setImportMode('append')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                      importMode === 'append'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Tambahkan (Append)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                      importMode === 'replace'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Gantikan Semua (Replace)
                  </button>
                </div>
                
                <button
                  onClick={executeImport}
                  className={`flex items-center gap-2 rounded-lg font-bold px-4 py-2 text-xs shadow-md transition-colors cursor-pointer text-white active:scale-95 ${
                    importMode === 'replace'
                      ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/15'
                      : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/15'
                  }`}
                >
                  <Check className="size-4" />
                  Konfirmasi Impor ({csvPreviewList.length} Siswa)
                </button>
              </div>

              {/* Dynamic warning/info description based on selected import mode */}
              <div className={`p-3 rounded-xl text-[11px] leading-relaxed border ${
                importMode === 'replace' 
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' 
                  : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
              }`}>
                {importMode === 'replace' ? (
                  <span>
                    <strong>⚠️ Mode Gantikan Semua (Replace) Aktif (Default):</strong> Seluruh data siswa lama yang ada di database akan <strong>dihapus total</strong> dan digantikan secara 100% presisi dengan {csvPreviewList.length} data siswa dari file CSV ini. Hasil akhir database dijamin sama persis dengan berkas CSV Anda.
                  </span>
                ) : (
                  <span>
                    <strong>ℹ️ Mode Tambahkan (Append) Aktif:</strong> Siswa baru dari berkas CSV akan ditambahkan ke dalam database yang ada tanpa menghapus data siswa lama. Siswa dengan NIS yang sudah ada di database akan dilewati secara otomatis untuk mencegah duplikasi.
                  </span>
                )}
              </div>

              <div className="overflow-x-auto max-h-48 border border-white/5 rounded-lg">
                <table className="w-full text-left text-xs border-collapse font-sans font-medium text-slate-300">
                  <thead className="bg-white/5 text-[10px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="p-2 border-b border-white/5 leading-none">NIS</th>
                      <th className="p-2 border-b border-white/5 leading-none">Nama Lengkap</th>
                      <th className="p-2 border-b border-white/10 leading-none">Kelas</th>
                      <th className="p-2 border-b border-white/10 leading-none">Angkatan</th>
                      <th className="p-2 border-b border-white/10 text-right leading-none">Tarif SPP</th>
                      <th className="p-2 border-b border-white/10 leading-none">Kontak Ortu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {csvPreviewList.map((parsed, idx) => (
                      <tr key={idx} className="hover:bg-white/5 font-sans font-medium">
                        <td className="p-2 font-mono text-[11px] text-slate-400">{parsed.nis}</td>
                        <td className="p-2 text-white font-bold">{parsed.nama}</td>
                        <td className="p-2">{parsed.kelas}</td>
                        <td className="p-2 font-mono">{parsed.angkatan}</td>
                        <td className="p-2 text-right font-mono font-bold text-blue-300">{formatRupiah(parsed.tagihanSpp)}</td>
                        <td className="p-2 max-w-[150px] truncate text-[11px] text-slate-405">
                          {parsed.emailOrangTua || "-"} ({parsed.teleponOrangTua || "-"})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Student list card */}
      <div className="glass glass-card rounded-2xl overflow-hidden">
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-slate-400 text-xs font-semibold uppercase bg-white/5">
                <th className="py-3 px-4 font-bold">NIS</th>
                <th className="py-3 px-4 font-bold">Nama Siswa</th>
                <th className="py-3 px-4 font-bold">Kelas</th>
                <th className="py-3 px-4 font-bold">Angkatan</th>
                <th className="py-3 px-4 text-right font-bold">Tarif SPP Bulanan</th>
                <th className="py-3 px-4 text-center font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-250">
              {filteredStudents.map((s) => (
                <tr key={s.id} className="hover:bg-white/5 transition-colors group">
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-400 text-xs">
                    {highlightText(s.nis, searchQuery, `sis-nis-${s.id}`)}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white block leading-tight text-xs sm:text-sm">
                        {highlightText(s.nama, searchQuery, `sis-nama-${s.id}`)}
                      </span>
                      {(() => {
                        const sSpp = s.statusSpp || {};
                        const status = sSpp[currentMonthKey] || "Belum_Bayar";
                        const isLunas = status === "Lunas";
                        const isKurang = typeof status === "string" && status.startsWith("Kurang:");
                        if (isLunas) {
                          return (
                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                              Lunas
                            </span>
                          );
                        } else if (isKurang) {
                          const sisa = status.split(":")[1];
                          return (
                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-amber-500/10 text-amber-450 border border-amber-500/25" title={`Kurang bayar SPP: ${formatRupiah(Number(sisa))}`}>
                              Kurang
                            </span>
                          );
                        } else {
                          return (
                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-red-500/10 text-red-400 border border-red-500/25">
                              Belum Lunas
                            </span>
                          );
                        }
                      })()}
                      {(() => {
                        const today = new Date();
                        const dayOfMonth = today.getDate();
                        const sSpp = s.statusSpp || {};
                        const status = sSpp[currentMonthKey] || "Belum_Bayar";
                        const isLunas = status === "Lunas";
                        
                        const previousMonths = DAFTAR_BULAN.filter(m => m.key < currentMonthKey);
                        const hasUnpaidPrevious = previousMonths.some(m => sSpp[m.key] !== "Lunas");
                        const isPastDueCurrent = !isLunas;
                        const hasUnpaidSpp = hasUnpaidPrevious || isPastDueCurrent;

                        const isPastDate10 = dayOfMonth > 10;
                        
                        if (hasUnpaidSpp) {
                          if (isPastDate10) {
                            return (
                              <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-red-650 text-red-100 border border-red-500 shadow-md shadow-red-500/30 animate-pulse" title="Pembayaran SPP melewati batas tanggal 10">
                                Lewat Tgl 10
                              </span>
                            );
                          } else {
                            return (
                              <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-blue-500/10 text-blue-400 border border-blue-500/25" title="Siswa belum lunas tetapi belum melewati batas tanggal 10">
                                Batas Tgl 10
                              </span>
                            );
                          }
                        }
                        return null;
                      })()}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5 font-medium whitespace-nowrap">
                      ✉️ {s.emailOrangTua || "-"} &nbsp;|&nbsp; 📱 {s.teleponOrangTua || "-"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 font-semibold text-xs border border-blue-500/20">
                      {s.kelas.toLowerCase().startsWith("kelas") ? s.kelas : `Kelas ${s.kelas}`}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-350">Tahun {s.angkatan}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100">{formatRupiah(s.tagihanSpp)}</td>
                  
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onNavigateToPayment(s.id)}
                        className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500 hover:text-white rounded-lg border border-emerald-500/20 transition-all cursor-pointer shadow-sm active:scale-95"
                        title="Proses Pembayaran Siswa"
                      >
                        Bayar SPP
                      </button>
                      <button
                        onClick={() => openEditModal(s)}
                        className="p-1 px-1.5 text-slate-300 hover:text-blue-400 hover:bg-white/5 rounded-lg transition-all cursor-pointer"
                        title="Edit Profil"
                      >
                        <Edit className="size-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id, s.nama)}
                        className="p-1 px-1.5 text-slate-350 hover:text-red-450 hover:bg-white/5 rounded-lg transition-all cursor-pointer"
                        title="Hapus Siswa"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredStudents.length === 0 && (
                <tr>
                   <td colSpan={6} className="py-12 text-center text-slate-400 text-sm italic">
                    <FolderOpen className="size-8 mx-auto text-slate-500 mb-2" />
                    Tidak ada data siswa ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white/5 px-5 py-3 border-t border-white/10 flex justify-between items-center text-xs text-slate-305">
          <span>Menampilkan <b>{filteredStudents.length}</b> siswa dari <b>{siswaList.length}</b> terdaftar.</span>
        </div>

      </div>

      {/* MODAL: ADD / EDIT DIALOG BOX */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-sm">
            
            <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">
                {modalMode === 'add' ? 'Registrasi Siswa Baru' : 'Edit Biodata Siswa'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors text-slate-400"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-slate-300">Nomor Induk Siswa (NIS)</label>
                <input
                  type="text"
                  required
                  value={formNis}
                  disabled={modalMode === 'edit'}
                  onChange={(e) => setFormNis(e.target.value)}
                  placeholder="Contoh: 102356"
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-950 disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-slate-300">Nama Siswa Lengkap</label>
                <input
                  type="text"
                  required
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Contoh: Ahmad Rizky"
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-left">
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Kelas / Rombel</label>
                  <input
                    type="text"
                    required
                    value={formKelas}
                    onChange={(e) => setFormKelas(e.target.value)}
                    placeholder="Contoh: VII-A, XI-RPL-1, XII-IP-1"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-950"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Angkatan Masuk</label>
                  <input
                    type="text"
                    required
                    value={formAngkatan}
                    onChange={(e) => setFormAngkatan(e.target.value)}
                    placeholder="Contoh: 2026"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-950"
                  />
                </div>

              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-slate-300">Tarif Tagihan SPP Bulanan (Rupiah)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    required
                    value={formTagihanSpp}
                    onChange={(e) => setFormTagihanSpp(parseInt(e.target.value, 10) || 0)}
                    placeholder="Contoh: 350000"
                    className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 text-white font-bold font-mono rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-left font-sans">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Email Orang Tua/Wali</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="Contoh: bapak.budi@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-xs focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">WhatsApp Orang Tua/Wali</label>
                  <input
                    type="text"
                    value={formTelepon}
                    onChange={(e) => setFormTelepon(e.target.value)}
                    placeholder="Contoh: 08123456789"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 flex gap-2 text-[10px] text-amber-300 leading-relaxed font-sans mt-4 text-left">
                <AlertTriangle className="size-5 shrink-0 text-amber-450" />
                <span>
                  <b>Informasi:</b> Menambah siswa baru akan langsung membuat matriks kewajiban SPP bulanan otomatis selama tahun 2026 dengan status Belum Bayar.
                </span>
              </div>

              <div className="pt-4 flex justify-end gap-2.5 border-t border-white/10 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-white/10 text-slate-200 rounded-xl hover:bg-white/10 font-semibold text-xs active:scale-95 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/20 border border-blue-400/20 active:scale-95 transition-all cursor-pointer"
                >
                  {modalMode === 'add' ? 'Registrasi' : 'Simpan Perubahan'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
