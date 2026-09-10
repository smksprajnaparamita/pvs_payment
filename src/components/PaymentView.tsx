/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Siswa, Transaksi, AppConfig, BiayaSekolah } from "../types";
import { 
  formatRupiah, 
  generateKuitansiNumber, 
  DAFTAR_BULAN, 
  formatBulanIndo, 
  NAMA_BULAN, 
  DAFTAR_TAHUN,
  DAFTAR_TAHUN_PELAJARAN,
  getMonthsForAcademicYear,
  getAcademicYearFromCalendarKey,
  getYearAndMonthFromAcademicYear
} from "../utils";
import React, { useState, useEffect, useRef } from "react";
import { 
  Search, 
  User, 
  Clock, 
  HelpCircle, 
  Check, 
  AlertCircle, 
  CreditCard,
  Coins,
  ChevronDown
} from "lucide-react";

interface PaymentViewProps {
  siswaList: Siswa[];
  config: AppConfig;
  onSubmitPayment: (transaksi: Transaksi) => void;
  selectedSiswaIdFromNav?: string;
  biayaList: BiayaSekolah[];
}

export default function PaymentView({ 
  siswaList, 
  config, 
  onSubmitPayment,
  selectedSiswaIdFromNav,
  biayaList = []
}: PaymentViewProps) {
  
  // --- STATE ---
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedSiswaId, setSelectedSiswaId] = useState<string | null>(null);

  // Selected academic year (defaulting dynamically to current date's academic year)
  const [selectedTahunPelajaran, setSelectedTahunPelajaran] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const start = month >= 7 ? year : year - 1;
    return `${start}/${start + 1}`;
  });

  // Helper to dynamically look up the standard SPP rate from Manajemen Biaya (biayaList)
  const getSppTarifFromBiayaList = (): number => {
    const sppBiayaItems = biayaList.filter(b => b.kategori === 'SPP');
    if (sppBiayaItems.length > 0) {
      return sppBiayaItems[0].jumlah;
    }
    const selectedSiswa = siswaList.find(s => s.id === selectedSiswaId);
    return selectedSiswa ? selectedSiswa.tagihanSpp : 350000;
  };

  // Form Fields
  const [jenisPembayaran, setJenisPembayaran] = useState<'SPP' | 'Uang Gedung' | 'Seragam' | 'Kegiatan' | 'Lainnya'>('SPP');
  const [selectedBiayaId, setSelectedBiayaId] = useState<string>("");
  const [bulanCovered, setBulanCovered] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [jumlah, setJumlah] = useState<number>(350000);
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [jumlahBayarSekarang, setJumlahBayarSekarang] = useState<number>(350000);
  const [metode, setMetode] = useState<'Cash' | 'Transfer'>('Cash');
  const [uangDibayar, setUangDibayar] = useState<string>("");
  const [refundNeeded, setRefundNeeded] = useState<number>(0);
  const [keterangan, setKeterangan] = useState("");
  const [penerima, setPenerima] = useState(config.penerimaDefault || "Staff Keuangan");

  // Keep jumlahBayarSekarang in sync with total bill if partial payment is disabled
  useEffect(() => {
    if (!isPartialPayment) {
      setJumlahBayarSekarang(jumlah);
    }
  }, [jumlah, isPartialPayment]);

  // Modal Confirmation State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<Transaksi | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // If selectedSiswaIdFromNav is provided, auto-select it
  useEffect(() => {
    if (selectedSiswaIdFromNav) {
      handleSelectSiswa(selectedSiswaIdFromNav);
    }
  }, [selectedSiswaIdFromNav]);

  // Click outside search dropdown close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter students based on search query safely
  const filteredSiswa = siswaList.filter(s => {
    if (!s) return false;
    const sNama = s.nama ? String(s.nama) : "";
    const sNis = s.nis ? String(s.nis) : "";
    const sKelas = s.kelas ? String(s.kelas) : "";

    const query = searchQuery.toLowerCase();
    return sNama.toLowerCase().includes(query) || 
           sNis.includes(searchQuery) ||
           sKelas.toLowerCase().includes(query);
  });

  const selectedSiswa = siswaList.find(s => s.id === selectedSiswaId) || null;

  // Calculate total historical arrears (tunggakan)
  const tunggakanList = selectedSiswa
    ? DAFTAR_BULAN.map(m => {
        const sSpp = selectedSiswa.statusSpp || {};
        const status = sSpp[m.key] || "Belum_Bayar";
        const sppTarif = getSppTarifFromBiayaList();
        if (status === "Belum_Bayar") {
          return { key: m.key, label: m.label, sisa: sppTarif, type: "Belum_Bayar" };
        } else if (typeof status === "string" && status.startsWith("Kurang:")) {
          const sisa = Number(status.split(":")[1]) || 0;
          return { key: m.key, label: m.label, sisa, type: "Kurang" };
        }
        return null;
      }).filter((item): item is { key: string; label: string; sisa: number; type: string } => item !== null)
    : [];

  const totalTunggakan = tunggakanList.reduce((sum, item) => sum + item.sisa, 0);

  // Find currently selected months from the comma-separated string in state
  const selectedMonthsList = (jenisPembayaran === "SPP" && bulanCovered) 
    ? bulanCovered.split(",").filter(Boolean) 
    : [];

  // React to change in selectedSiswa or JenisPembayaran
  useEffect(() => {
    if (selectedSiswa) {
      const sSpp = selectedSiswa.statusSpp || {};
      const sppTarif = getSppTarifFromBiayaList();
      if (jenisPembayaran === "SPP") {
        // Find first unpaid month as default selection (checking from the dynamic months first)
        let unpaidMonth = getMonthsForAcademicYear(selectedTahunPelajaran).find(m => sSpp[m.key] !== "Lunas");
        if (!unpaidMonth) {
          unpaidMonth = DAFTAR_BULAN.find(m => sSpp[m.key] !== "Lunas");
        }
        
        if (unpaidMonth) {
          const unpaidTP = getAcademicYearFromCalendarKey(unpaidMonth.key);
          setSelectedTahunPelajaran(unpaidTP);
          setBulanCovered(unpaidMonth.key);
          setKeterangan(`Pembayaran SPP Bulan ${unpaidMonth.label} (Th Pelajaran ${unpaidTP})`);
          
          const statusVal = String(sSpp[unpaidMonth.key] || "Belum_Bayar");
          if (statusVal.startsWith("Kurang:")) {
            const sisa = Number(statusVal.split(":")[1]) || sppTarif;
            setJumlah(sisa);
            setJumlahBayarSekarang(sisa);
          } else {
            setJumlah(sppTarif);
            setJumlahBayarSekarang(sppTarif);
          }
        } else {
          const tpMonths = getMonthsForAcademicYear(selectedTahunPelajaran);
          const lastMonth = tpMonths[tpMonths.length - 1];
          setBulanCovered(lastMonth.key);
          setKeterangan(`Pembayaran SPP Bulan ${lastMonth.label} (Th Pelajaran ${selectedTahunPelajaran})`);
          setJumlah(sppTarif);
          setJumlahBayarSekarang(sppTarif);
        }
        setSelectedBiayaId("");
      } else {
        // For non-SPP, find fees in this category from biayaList
        const items = biayaList ? biayaList.filter(b => b.kategori === jenisPembayaran) : [];
        if (items.length > 0) {
          const defaultItem = items[0];
          setSelectedBiayaId(defaultItem.id);
          setJumlah(defaultItem.jumlah);
          setJumlahBayarSekarang(defaultItem.jumlah);
          setKeterangan(`Pembayaran ${defaultItem.nama}`);
        } else {
          setSelectedBiayaId("custom");
          setJumlah(0);
          setJumlahBayarSekarang(0);
          setKeterangan(`Pembayaran ${jenisPembayaran} untuk ${selectedSiswa.nama}`);
        }
      }
      setIsPartialPayment(false);
    }
  }, [selectedSiswaId, jenisPembayaran, biayaList]);

  // Handle manual change of the specific fee item dropdown
  const handleBiayaItemChange = (feeId: string) => {
    setSelectedBiayaId(feeId);
    if (!selectedSiswa) return;
    
    if (feeId === "custom") {
      setJumlah(0);
      setJumlahBayarSekarang(0);
      setKeterangan(`Pembayaran ${jenisPembayaran} - ${selectedSiswa.nama}`);
    } else {
      const selectedItem = biayaList.find(b => b.id === feeId);
      if (selectedItem) {
        setJumlah(selectedItem.jumlah);
        setJumlahBayarSekarang(selectedItem.jumlah);
        setKeterangan(`Pembayaran ${selectedItem.nama}`);
      }
    }
  };

  // Handle auto-selected target months from grid clicks (supports multi-month aggregation)
  const handleSelectMonthGrid = (monthKey: string) => {
    if (!selectedSiswa) return;
    setJenisPembayaran("SPP");
    
    let nextList: string[];
    if (selectedMonthsList.includes(monthKey)) {
      // Toggle off SPP month
      nextList = selectedMonthsList.filter(m => m !== monthKey);
    } else {
      // Toggle on SPP month
      nextList = [...selectedMonthsList, monthKey];
    }
    
    // Sort chronologically
    nextList.sort();
    
    const newVal = nextList.join(",");
    setBulanCovered(newVal);
    
    // Auto multiply amount accounting for partial payments
    let totalAmount = 0;
    const sSpp = selectedSiswa.statusSpp || {};
    const sppTarif = getSppTarifFromBiayaList();
    nextList.forEach((key) => {
      const statusVal = String(sSpp[key] || "Belum_Bayar");
      if (statusVal.startsWith("Kurang:")) {
        totalAmount += Number(statusVal.split(":")[1]) || sppTarif;
      } else {
        totalAmount += sppTarif;
      }
    });
    setJumlah(totalAmount);
    
    // Auto-generate description notes
    const tpMonths = getMonthsForAcademicYear(selectedTahunPelajaran);
    if (nextList.length === 0) {
      setKeterangan("");
    } else if (nextList.length === 1) {
      const mLabel = tpMonths.find(d => d.key === nextList[0])?.label || "";
      setKeterangan(`Pembayaran SPP Bulan ${mLabel} (Th Pelajaran ${selectedTahunPelajaran})`);
    } else {
      const labels = nextList.map(k => tpMonths.find(d => d.key === k)?.label.split(" ")[0] || "").join(", ");
      const years = Array.from(new Set(nextList.map(k => k.split("-")[0])));
      setKeterangan(`Pembayaran SPP Gabungan ${nextList.length} Bulan (${labels}) Th Pelajaran ${selectedTahunPelajaran}`);
    }
  };

  // Change nominal calculation
  const nominalValue = Number(jumlah) || 0;
  const targetToPay = isPartialPayment ? (Number(jumlahBayarSekarang) || 0) : nominalValue;
  const payValue = Number(uangDibayar) || 0;

  useEffect(() => {
    if (metode === 'Transfer' || payValue < targetToPay) {
      setRefundNeeded(0);
    } else {
      setRefundNeeded(payValue - targetToPay);
    }
  }, [uangDibayar, targetToPay, metode]);

  const handleSelectSiswa = (id: string) => {
    setSelectedSiswaId(id);
    const sis = siswaList.find(s => s.id === id);
    if (sis) {
      setSearchQuery(`${sis.nama} (${sis.nis} - ${sis.kelas})`);
    }
    setShowDropdown(false);
  };

  // Handle cash bill addition shortcuts
  const addCashAmount = (amount: number) => {
    const currentPay = Number(uangDibayar) || 0;
    setUangDibayar(String(currentPay + amount));
  };

  const handleSetExactCash = () => {
    setUangDibayar(String(targetToPay));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSiswa) {
      alert("Harap pilih siswa terlebih dahulu.");
      return;
    }
    
    if (jumlah <= 0) {
      alert("Harap masukkan nominal tagihan yang valid.");
      return;
    }

    const actualPaid = isPartialPayment ? jumlahBayarSekarang : jumlah;

    if (isPartialPayment) {
      if (jumlahBayarSekarang <= 0) {
        alert("Harap masukkan jumlah pembayaran sebagian yang valid.");
        return;
      }
      if (jumlahBayarSekarang >= jumlah) {
        alert("Jumlah bayar sebagian harus lebih kecil dari total tagihan. Jika ingin melunasi seluruhnya, silakan matikan opsi Bayar Sebagian.");
        return;
      }
    }

    if (metode === 'Cash' && payValue < actualPaid) {
      alert(`Uang bayar kurang! Harap bayar minimal ${formatRupiah(actualPaid)}`);
      return;
    }

    // Build Kuitansi / Transaksi Schema with optional partial payment tracking details
    const newTransaction: Transaksi = {
      id: generateKuitansiNumber("KWT"),
      siswaId: selectedSiswa.id,
      siswaNis: selectedSiswa.nis,
      siswaNama: selectedSiswa.nama,
      siswaKelas: selectedSiswa.kelas,
      tanggal: new Date().toISOString().replace('T', ' ').substring(0, 19),
      jenisPembayaran: jenisPembayaran,
      bulanCovered: jenisPembayaran === "SPP" ? bulanCovered : undefined,
      jumlah: actualPaid,
      metode: metode,
      keterangan: keterangan,
      penerima: penerima,
      originalTagihan: jumlah,
      sisaTunggakan: jumlah - actualPaid
    };

    setPendingTransaction(newTransaction);
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = () => {
    if (pendingTransaction) {
      onSubmitPayment(pendingTransaction);
      
      // Clear Input & States
      setUangDibayar("");
      setRefundNeeded(0);
      setIsPartialPayment(false);
      setPendingTransaction(null);
      setShowConfirmModal(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in text-slate-100">
      
      {/* Search and Student Profiling Section (5/12 width) */}
      <div className="lg:col-span-5 space-y-6">
        
        <div className="glass glass-card p-5 rounded-2xl">
          <h3 className="font-bold text-white text-base mb-1">Cari / Pilih Siswa</h3>
          <p className="text-xs text-slate-350 mb-4">Masukkan NIS, Nama, atau Kelas siswa untuk memulai pembayaran</p>

          {/* Custom Dropdown Search Input */}
          <div ref={dropdownRef} className="relative">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowDropdown(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                  if (selectedSiswaId) {
                    setSelectedSiswaId(null);
                  }
                }}
                placeholder="Masukkan NIS, Nama Lengkap..."
                className="w-full pl-11 pr-10 py-3 bg-white/5 border border-white/10 text-white font-medium rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/10 transition-all shadow-md"
              />
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4.5 text-slate-400 cursor-pointer pointer-events-none" />
            </div>

            {/* Results popup list */}
            {showDropdown && filteredSiswa.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-white/10 rounded-xl shadow-xl max-h-56 overflow-y-auto z-40 divide-y divide-white/5 animate-fade-in">
                {filteredSiswa.slice(0, 15).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSiswa(s.id)}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center justify-between transition-colors cursor-pointer group"
                  >
                    <div>
                      <span className="font-semibold text-slate-205 text-sm group-hover:text-blue-400 block">{s.nama}</span>
                      <span className="text-xs font-semibold font-mono text-slate-400">{s.nis} • {s.kelas}</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-white/10 text-slate-300">
                      Angkatan {s.angkatan}
                    </span>
                  </button>
                ))}
                {filteredSiswa.length > 15 && (
                  <div className="px-4 py-2.5 bg-white/[0.02] text-[10px] font-mono text-slate-400 text-center border-t border-white/5">
                    Menampilkan 15 dari {filteredSiswa.length} siswa. Ketik lebih spesifik untuk menyaring.
                  </div>
                )}
              </div>
            )}

            {/* No matches */}
            {showDropdown && searchQuery && filteredSiswa.length === 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 p-4 rounded-xl shadow-xl border border-white/10 text-center text-slate-350 text-xs italic z-40">
                Siswa tidak ditemukan.
              </div>
            )}
          </div>
        </div>

        {/* Profile Details Panel (Shown when selected) */}
        {selectedSiswa ? (
          <div className="glass glass-card rounded-2xl overflow-hidden">
            
            {/* Upper profile decorative */}
            <div className="bg-blue-600/10 p-5 border-b border-white/5 flex items-center gap-4">
              <div className="size-12 rounded-xl bg-blue-500 text-white flex items-center justify-center font-bold text-lg select-none">
                {selectedSiswa.nama.charAt(0)}
              </div>
              <div>
                <h4 className="font-bold text-white text-base">{selectedSiswa.nama}</h4>
                <p className="text-xs font-semibold font-mono text-slate-400 mt-0.5">NIS: {selectedSiswa.nis} • {selectedSiswa.kelas}</p>
              </div>
            </div>

            {/* Profile Grid SPP matrix */}
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Matriks Pelunasan SPP Th Pelajaran {selectedTahunPelajaran}</span>
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="size-3" /> Klik bulan berjalan untuk bayar
                </span>
              </div>

              {/* SPP Grid Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {getMonthsForAcademicYear(selectedTahunPelajaran).map((m) => {
                  const sSpp = selectedSiswa.statusSpp || {};
                  const status = sSpp[m.key] || "Belum_Bayar";
                  const isPaid = status === "Lunas";
                  const isPartial = typeof status === "string" && status.startsWith("Kurang:");
                  const sisaAmount = isPartial ? Number(status.split(":")[1]) || 0 : 0;

                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => !isPaid && handleSelectMonthGrid(m.key)}
                      title={isPartial ? `Kurang bayar SPP: ${formatRupiah(sisaAmount)}` : undefined}
                      className={`p-2.5 rounded-xl border flex flex-col justify-between h-14 text-left transition-all cursor-pointer ${
                        isPaid 
                          ? "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15 text-emerald-400 cursor-default" 
                          : isPartial
                            ? "bg-amber-505/10 border-amber-500/30 hover:bg-amber-550/15 text-amber-400"
                            : selectedMonthsList.includes(m.key) && jenisPembayaran === "SPP"
                              ? "bg-blue-500 border-blue-400/30 font-semibold text-white shadow-md shadow-blue-500/20" 
                              : "bg-white/5 border-white/10 hover:border-blue-500/30 hover:bg-white/10 text-slate-300"
                      }`}
                    >
                      <span className={`text-[10px] font-semibold ${
                        isPaid 
                          ? "text-emerald-400" 
                          : isPartial
                            ? "text-amber-400"
                            : selectedMonthsList.includes(m.key) && jenisPembayaran === "SPP" 
                              ? "text-blue-200" 
                              : "text-slate-400"
                      }`}>
                        {m.label.split(" ")[0]}
                      </span>
                      <div className="flex justify-between items-center w-full mt-1">
                        <span className="text-xs font-bold leading-none">
                          {isPaid ? "LUNAS" : isPartial ? "KURANG" : "BELUM"}
                        </span>
                        {isPaid ? (
                          <Check className="size-3 text-emerald-400" strokeWidth={3} />
                        ) : isPartial ? (
                          <span className="text-[9px] font-mono font-bold text-amber-400">-{Math.round(sisaAmount/1000)}Rb</span>
                        ) : selectedMonthsList.includes(m.key) && jenisPembayaran === "SPP" ? (
                          <span className="size-1.5 rounded-full bg-white"></span>
                        ) : (
                          <span className="size-1.5 rounded-full bg-red-400"></span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Standard Tagihan List */}
              <div className="border-t border-white/5 pt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Tarif SPP Bulanan (Manajemen Biaya)</span>
                  <span className="font-bold text-white font-mono">{formatRupiah(getSppTarifFromBiayaList())} / bln</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Angkatan Masuk</span>
                  <span className="font-bold text-white font-mono">Tahun {selectedSiswa.angkatan}</span>
                </div>
              </div>

            </div>

          </div>
        ) : (
          <div className="bg-white/5 border-2 border-dashed border-white/10 rounded-2xl p-8 text-center flex flex-col items-center justify-center h-64 text-slate-400">
            <User className="size-10 text-slate-450 mb-3" />
            <p className="text-sm font-semibold text-slate-300">Belum Ada Siswa Terpilih</p>
            <p className="text-xs mt-1 max-w-[200px] leading-relaxed text-slate-400">
              Silakan cari dan pilih siswa pada kolom pencarian di atas untuk memproses loket pembayaran.
            </p>
          </div>
        )}

      </div>

      {/* Main Payment Cash Register Form (7/12 width) */}
      <div className="lg:col-span-7">
        
        <form onSubmit={handleSubmit} className="glass glass-card rounded-2xl overflow-hidden">
          
          <div className="bg-white/5 border-b border-white/10 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                <Coins className="size-4" />
              </div>
              <h3 className="font-bold text-white text-sm">Loket Pembayaran</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-semibold">
              Kasir Aktif
            </span>
          </div>

          <div className="p-6 space-y-5">
            
            {/* Row 1: Category and Target SPP selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Kategori Kelola Dana</label>
                <select
                  disabled={!selectedSiswa}
                  value={jenisPembayaran}
                  onChange={(e) => setJenisPembayaran(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="SPP" className="bg-slate-900 border-none select-none text-white">SPP (Sumbangan Pembinaan Pendidikan)</option>
                  <option value="Uang Gedung" className="bg-slate-900 border-none select-none text-white">Uang Gedung / Pangkal</option>
                  <option value="Seragam" className="bg-slate-900 border-none select-none text-white">Seragam Sekolah</option>
                  <option value="Kegiatan" className="bg-slate-900 border-none select-none text-white">Kegiatan / Program Sekolah</option>
                  <option value="Lainnya" className="bg-slate-900 border-none select-none text-white">Lainnya / Pembelian Buku</option>
                </select>
              </div>

              {jenisPembayaran === "SPP" ? (
                <div className="space-y-1.5 animate-fade-in text-left">
                  <label className="text-xs font-semibold text-slate-300">SPP Bulan & Tahun Pelajaran</label>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Month Select */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 block font-semibold">Pilih Bulan</span>
                      <select
                        disabled={!selectedSiswa}
                        value={
                          bulanCovered.includes(",") 
                            ? (bulanCovered.split(",")[0].split("-")[1] || "07") 
                            : (bulanCovered.split("-")[1] || "07")
                        }
                        onChange={(e) => {
                          const selectMonth = e.target.value;
                          const [startYear, endYear] = selectedTahunPelajaran.split("/");
                          const monthNum = parseInt(selectMonth, 10);
                          const year = (monthNum >= 7 && monthNum <= 12) ? startYear : endYear;
                          const nextVal = `${year}-${selectMonth}`;
                          setBulanCovered(nextVal);
                          
                          const mName = NAMA_BULAN.find(nb => nb.key === selectMonth)?.label || "";
                          setKeterangan(`Pembayaran SPP Bulan ${mName} (Th Pelajaran ${selectedTahunPelajaran})`);
                          
                          // Set SPP amount automatically from school fees definition
                          const sppTarif = getSppTarifFromBiayaList();
                          const sSpp = selectedSiswa ? (selectedSiswa.statusSpp || {}) : {};
                          const statusVal = String(sSpp[nextVal] || "Belum_Bayar");
                          if (statusVal.startsWith("Kurang:")) {
                            setJumlah(Number(statusVal.split(":")[1]) || sppTarif);
                          } else {
                            setJumlah(sppTarif);
                          }
                        }}
                        className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        {[
                          { key: "07", label: "Juli" },
                          { key: "08", label: "Agustus" },
                          { key: "09", label: "September" },
                          { key: "10", label: "Oktober" },
                          { key: "11", label: "November" },
                          { key: "12", label: "Desember" },
                          { key: "01", label: "Januari" },
                          { key: "02", label: "Februari" },
                          { key: "03", label: "Maret" },
                          { key: "04", label: "April" },
                          { key: "05", label: "Mei" },
                          { key: "06", label: "Juni" }
                        ].map((m) => (
                          <option key={m.key} value={m.key} className="bg-slate-900 text-white">
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
 
                    {/* Academic Year Select */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 block font-semibold">Tahun Pelajaran</span>
                      <select
                        disabled={!selectedSiswa}
                        value={selectedTahunPelajaran}
                        onChange={(e) => {
                          const tp = e.target.value;
                          setSelectedTahunPelajaran(tp);
                          const currentMonth = bulanCovered.includes(",") 
                            ? (bulanCovered.split(",")[0].split("-")[1] || "07") 
                            : (bulanCovered.split("-")[1] || "07");
                          
                          const [startYear, endYear] = tp.split("/");
                          const monthNum = parseInt(currentMonth, 10);
                          const year = (monthNum >= 7 && monthNum <= 12) ? startYear : endYear;
                          const nextVal = `${year}-${currentMonth}`;
                          setBulanCovered(nextVal);
                          
                          const mName = NAMA_BULAN.find(nb => nb.key === currentMonth)?.label || "";
                          setKeterangan(`Pembayaran SPP Bulan ${mName} (Th Pelajaran ${tp})`);
                          
                          const sppTarif = getSppTarifFromBiayaList();
                          const sSpp = selectedSiswa ? (selectedSiswa.statusSpp || {}) : {};
                          const statusVal = String(sSpp[nextVal] || "Belum_Bayar");
                          if (statusVal.startsWith("Kurang:")) {
                            setJumlah(Number(statusVal.split(":")[1]) || sppTarif);
                          } else {
                            setJumlah(sppTarif);
                          }
                        }}
                        className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        {DAFTAR_TAHUN_PELAJARAN.map((tp) => (
                          <option key={tp} value={tp} className="bg-slate-900 text-white">
                            Th Pelajaran {tp}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
 
                  {/* Show current selection status check */}
                  {selectedSiswa && (() => {
                    const activeKey = bulanCovered.includes(",") ? bulanCovered.split(",")[0] : bulanCovered;
                    const sSpp = selectedSiswa.statusSpp || {};
                    const statusVal = sSpp[activeKey];
                    if (statusVal === "Lunas") {
                      return (
                        <div className="mt-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold leading-none w-fit">
                          <span>✓ Status: Lunas</span>
                        </div>
                      );
                    } else if (statusVal && statusVal.startsWith("Kurang:")) {
                      return (
                        <div className="mt-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold leading-none w-fit">
                          <span>⚠ Status: Kurang bayar {formatRupiah(Number(statusVal.split(":")[1]) || 0)}</span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="mt-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs font-bold leading-none w-fit">
                          <span>● Status: Belum Bayar</span>
                        </div>
                      );
                    }
                  })()}
 
                  {/* Multi-month list visualizer badges */}
                  {selectedMonthsList.length > 0 && (
                    <div className="mt-2.5 space-y-1 animate-fade-in">
                      <span className="text-[10px] uppercase font-bold text-slate-450 block">Daftar Bulan SPP Digabungkan ({selectedMonthsList.length} bulan):</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedMonthsList.map((key) => {
                          const tpMonths = getMonthsForAcademicYear(selectedTahunPelajaran);
                          const label = tpMonths.find(d => d.key === key)?.label || key;
                          return (
                            <span 
                              key={key}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-semibold transition-all hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 group cursor-pointer"
                              title="Klik untuk hapus bulan ini dari gabungan"
                              onClick={() => {
                                const nextList = selectedMonthsList.filter(x => x !== key);
                                const newVal = nextList.join(",");
                                setBulanCovered(newVal);
                                if (selectedSiswa) {
                                  const sppTarif = getSppTarifFromBiayaList();
                                  setJumlah(sppTarif * nextList.length);
                                  if (nextList.length === 1) {
                                    const mLabel = tpMonths.find(d => d.key === nextList[0])?.label || "";
                                    setKeterangan(`Pembayaran SPP Bulan ${mLabel} (Th Pelajaran ${selectedTahunPelajaran})`);
                                  } else if (nextList.length > 1) {
                                    const labels = nextList.map(k => tpMonths.find(d => d.key === k)?.label.split(" ")[0] || "").join(", ");
                                    const years = Array.from(new Set(nextList.map(k => k.split("-")[0])));
                                    setKeterangan(`Pembayaran SPP Gabungan ${nextList.length} Bulan (${labels}) Th Pelajaran ${selectedTahunPelajaran}`);
                                  } else {
                                    setKeterangan("");
                                  }
                                }
                              }}
                            >
                              <span>{label}</span>
                              <span className="font-extrabold text-xs text-blue-400 group-hover:text-red-400 leading-none">&times;</span>
                            </span>
                          );
                        })}
                      </div>
                      <p className="text-[9px] text-slate-450 leading-tight">
                        * Klik pada pill bulan di atas atau klik cells pada Matriks untuk menambah/mengurangi bulan SPP.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5 animate-fade-in text-left">
                  <label className="text-xs font-semibold text-slate-300">Pilih Detail Biaya (Manajemen Biaya)</label>
                  <select
                    disabled={!selectedSiswa}
                    value={selectedBiayaId}
                    onChange={(e) => handleBiayaItemChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {biayaList.filter(b => b.kategori === jenisPembayaran).map((b) => (
                      <option 
                        key={b.id} 
                        value={b.id}
                        className="bg-slate-900 border-none select-none text-white"
                      >
                        {b.nama} ({formatRupiah(b.jumlah)})
                      </option>
                    ))}
                    <option value="custom" className="bg-slate-900 border-none select-none text-slate-300 hover:text-white">
                      -- Input/Kustom Nominal Manual --
                    </option>
                  </select>
                </div>
              )}

            </div>

            {/* Row 2: Method of payment and Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Nominal Tagihan (Rp)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">Rp</span>
                  <input
                    type="number"
                    disabled={!selectedSiswa}
                    value={jumlah}
                    onChange={(e) => setJumlah(parseInt(e.target.value, 10) || 0)}
                    placeholder="Contoh: 350000"
                    className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 text-white font-bold font-mono rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Metode Verifikasi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!selectedSiswa}
                    onClick={() => setMetode("Cash")}
                    className={`py-2.5 rounded-xl border flex items-center justify-center gap-1 text-xs font-semibold transition-all cursor-pointer ${
                      metode === "Cash" 
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/35 shadow-md" 
                        : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10"
                    }`}
                  >
                    <Coins className="size-4" />
                    Tunai / Cash
                  </button>
                  <button
                    type="button"
                    disabled={!selectedSiswa}
                    onClick={() => {
                      setMetode("Transfer");
                      setUangDibayar("");
                    }}
                    className={`py-2.5 rounded-xl border flex items-center justify-center gap-1 text-xs font-semibold transition-all cursor-pointer ${
                      metode === "Transfer" 
                        ? "bg-blue-500/15 text-blue-400 border-blue-500/35 shadow-md" 
                        : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10"
                    }`}
                  >
                    <CreditCard className="size-4" />
                    Transfer Bank
                  </button>
                </div>
              </div>

            </div>

            {/* PARTIAL PAYMENT ARREARS COMPONENT */}
            {selectedSiswa && (
              <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3.5 animate-slide-up">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-slate-200">Siswa Membayar Kurang (Cicil / Sebagian)</span>
                    <span className="text-[10px] text-slate-400">Aktifkan jika uang pembayaran yang diterima dari siswa kurang dari nominal tagihan</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isPartialPayment}
                      onChange={(e) => {
                        setIsPartialPayment(e.target.checked);
                        if (e.target.checked) {
                          setJumlahBayarSekarang(Math.round(jumlah / 2)); // Default to half of bill
                        } else {
                          setJumlahBayarSekarang(jumlah);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-350 after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                  </label>
                </div>

                {isPartialPayment && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2.5 border-t border-white/5 animate-fade-in text-left">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Jumlah Pembayaran Sekarang (Rp)</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">Rp</span>
                        <input
                          type="number"
                          value={jumlahBayarSekarang}
                          onChange={(e) => setJumlahBayarSekarang(Number(e.target.value) || 0)}
                          placeholder="Masukkan jumlah cicilan..."
                          className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-white/10 text-emerald-400 font-bold font-mono rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl p-3 flex flex-col justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-red-400 block">Tunggakan Baru (Kurang)</span>
                      <h4 className="text-lg font-bold font-mono mt-1 text-red-400 block">
                        {formatRupiah(Math.max(0, jumlah - jumlahBayarSekarang))}
                      </h4>
                      <span className="text-[9px] text-slate-450 block leading-tight mt-0.5">Akan dicatat sebagai sisa tunggakan di kuitansi pertama</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CASH REGISTER CASH DRAW COMPONENT */}
            {metode === "Cash" && selectedSiswa && (
              <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-4 animate-slide-up">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Uang Dibayar Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <span>Uang Diterima (Rp)</span>
                      <HelpCircle className="size-3 text-slate-450 select-none cursor-help" title="Masukkan jumlah uang cash yang diserahkan wali" />
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">Rp</span>
                      <input
                        type="number"
                        value={uangDibayar}
                        onChange={(e) => setUangDibayar(e.target.value)}
                        placeholder="Masukkan Jumlah Cash..."
                        className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/15 text-emerald-400 font-bold font-mono rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Real-Time Refund Box */}
                  <div className="bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 rounded-xl p-3 flex flex-col justify-between shadow-xs">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-250">Kembalian / Refund</span>
                    <h4 className="text-lg font-bold font-mono mt-1 text-emerald-450">
                      {formatRupiah(refundNeeded)}
                    </h4>
                    {payValue > 0 && payValue < nominalValue ? (
                      <span className="text-[9px] text-yellow-300 font-medium">Uang cash kurang {formatRupiah(nominalValue - payValue)}</span>
                    ) : (
                      <span className="text-[9px] text-emerald-200 font-sans">Sisa pembayaran cash siap diserah</span>
                    )}
                  </div>
                </div>

                {/* Cash Shortcuts */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-semibold text-slate-400">Pilihan Cepat (Shortcut Denominasi Rupiah)</span>
                    <button 
                      type="button" 
                      onClick={() => setUangDibayar("")} 
                      className="text-[10px] text-red-400 font-bold hover:underline"
                    >
                      Reset Tunai
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={handleSetExactCash}
                      className="px-2.5 py-1.5 bg-emerald-505/15 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/25 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                    >
                      Uang Pas
                    </button>
                    <button
                      type="button"
                      onClick={() => addCashAmount(50000)}
                      className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium rounded-lg text-white transition-all cursor-pointer"
                    >
                      +Rp50k
                    </button>
                    <button
                      type="button"
                      onClick={() => addCashAmount(100000)}
                      className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium rounded-lg text-white transition-all cursor-pointer"
                    >
                      +Rp100k
                    </button>
                    <button
                      type="button"
                      onClick={() => addCashAmount(200000)}
                      className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium rounded-lg text-white transition-all cursor-pointer"
                    >
                      +Rp200k
                    </button>
                    <button
                      type="button"
                      onClick={() => addCashAmount(500000)}
                      className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium rounded-lg text-white transition-all cursor-pointer"
                    >
                      +Rp500k
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* Note & Custom Recipient Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Catatan Pembayaran</label>
                <input
                  type="text"
                  disabled={!selectedSiswa}
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Contoh: Lunas SPP Mei 2026 atau Lunas Paket Seragam"
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 animate-fade-in"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Admin Penerima Kas</label>
                <input
                  type="text"
                  disabled={!selectedSiswa}
                  value={penerima}
                  onChange={(e) => setPenerima(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 animate-fade-in"
                />
              </div>

            </div>

          </div>

          {/* Form Action Submit */}
          <div className="bg-white/5 px-6 py-4 border-t border-white/10 flex justify-end gap-3">
            <button
              type="submit"
              disabled={!selectedSiswa || (metode === "Cash" && payValue < nominalValue)}
              className="w-full sm:w-auto px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 border border-blue-400/20 cursor-pointer active:transform active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-1.5"
            >
              <Check className="size-4" strokeWidth={2.5} />
              Proses Pembayaran & Cetak Kuitansi
            </button>
          </div>

        </form>

      </div>

      {showConfirmModal && pendingTransaction && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-slate-900 border border-slate-700 text-slate-100 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col transition-colors duration-300">
            {/* Modal Header */}
            <div className="flex items-center gap-3 px-6 py-4 bg-slate-850 border-b border-white/10">
              <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
                <AlertCircle className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Konfirmasi Validasi Pembayaran</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Pastikan seluruh data transaksi di bawah ini sudah sesuai</p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Alert message */}
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded-xl text-xs flex items-start gap-2.5">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-semibold">
                  Transaksi yang dideklarasikan di bawah ini akan digenerate ke kuitansi resmi sekolah dan mencakup pembaruan status tagihan siswa.
                </p>
              </div>

              {/* Transaction Detail Card */}
              <div className="bg-slate-950 border border-white/5 rounded-xl p-4 space-y-3.5 antialiased font-sans text-slate-100">
                {/* Siswa */}
                <div className="flex justify-between items-start gap-4 border-b border-white/5 pb-2.5">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Siswa Penerima</span>
                    <span className="text-sm font-bold text-white">{pendingTransaction.siswaNama}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block font-mono">NIS / Kelas</span>
                    <span className="text-xs font-semibold text-slate-300 font-mono">
                      {pendingTransaction.siswaNis} | {pendingTransaction.siswaKelas}
                    </span>
                  </div>
                </div>

                {/* Jenis Pembayaran & Bulan */}
                <div className="flex justify-between items-start gap-4 border-b border-white/5 pb-2.5">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Kategori Biaya</span>
                    <span className="text-xs font-semibold text-slate-200">{pendingTransaction.jenisPembayaran}</span>
                  </div>
                  {pendingTransaction.bulanCovered && (
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">SPP Bulan</span>
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        {formatBulanIndo(pendingTransaction.bulanCovered)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Nominal & Metode */}
                <div className="flex justify-between items-center gap-4 border-b border-white/5 pb-2.5">
                  <div>
                    {pendingTransaction.sisaTunggakan && pendingTransaction.sisaTunggakan > 0 ? (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Detail Bayar Sebagian</span>
                        <span className="text-xs text-slate-400 block leading-tight font-sans">
                          Tagihan Awal: <b className="font-mono text-white">{formatRupiah(pendingTransaction.originalTagihan || 0)}</b>
                        </span>
                        <span className="text-sm font-extrabold text-emerald-400 font-mono block leading-tight">
                          Dibayar Sekarang: {formatRupiah(pendingTransaction.jumlah)}
                        </span>
                        <span className="text-xs text-red-400 block leading-tight font-sans">
                          Sisa Tagihan: <b className="font-mono">{formatRupiah(pendingTransaction.sisaTunggakan)}</b>
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Nominal Pembayaran</span>
                        <span className="text-lg font-extrabold text-emerald-450 font-mono block">
                          {formatRupiah(pendingTransaction.jumlah)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Metode Pembayaran</span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold ${
                      pendingTransaction.metode === "Cash"
                        ? "bg-emerald-500/15 text-emerald-450 border border-emerald-500/30"
                        : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                    }`}>
                      {pendingTransaction.metode}
                    </span>
                  </div>
                </div>

                {/* Cash Details if Cash */}
                {pendingTransaction.metode === "Cash" && (
                  <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-2.5">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Uang Diterima</span>
                      <span className="text-xs font-bold text-slate-300 font-mono">
                        {formatRupiah(Number(uangDibayar) || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Kembalian</span>
                      <span className="text-xs font-bold text-emerald-400 font-mono">
                        {formatRupiah(refundNeeded)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Catatan / Keterangan */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Keterangan / Memo</span>
                  <span className="text-xs text-slate-300 font-medium">
                    {pendingTransaction.keterangan || "-"}
                  </span>
                </div>
              </div>

              {/* Informative message */}
              <div className="text-[11px] text-slate-400 leading-relaxed text-center">
                Silakan cetak struk setelah konfirmasi untuk bukti cetak lunas kepada orang tua siswa.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setPendingTransaction(null);
                  setShowConfirmModal(false);
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer border border-white/5"
              >
                Batal / Edit Lagi
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/25 border border-blue-400/20 transition-all cursor-pointer active:transform active:scale-95"
              >
                <Check className="size-4" strokeWidth={2.5} />
                Ya, Konfirmasi & Cetak
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
