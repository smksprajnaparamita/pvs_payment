/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Siswa, Transaksi, AppConfig } from "../types";
import { formatRupiah, DAFTAR_BULAN, formatBulanIndo, getOnlyDate } from "../utils";
import { 
  TrendingUp, 
  Users, 
  Receipt, 
  DollarSign, 
  PlusCircle, 
  ChevronRight, 
  Calendar,
  AlertCircle,
  Trash2
} from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";

interface DashboardViewProps {
  siswaList: Siswa[];
  transaksiList: Transaksi[];
  config: AppConfig;
  onNavigateToPayment: (siswaId?: string) => void;
  onReprintReceipt: (trx: Transaksi) => void;
  onDeleteTransaction?: (id: string) => Promise<{ success: boolean; message: string }>;
}

export default function DashboardView({ 
  siswaList, 
  transaksiList, 
  config, 
  onNavigateToPayment,
  onReprintReceipt,
  onDeleteTransaction
}: DashboardViewProps) {

  const [transactionToDelete, setTransactionToDelete] = useState<Transaksi | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteConfirm = async () => {
    if (!transactionToDelete || !onDeleteTransaction) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const result = await onDeleteTransaction(transactionToDelete.id);
      if (result.success) {
        setTransactionToDelete(null);
      } else {
        setDeleteError(result.message || "Gagal menghapus transaksi.");
      }
    } catch (err: any) {
      setDeleteError(err.message || "Gagal menghapus transaksi.");
    } finally {
      setIsDeleting(false);
    }
  };
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("Semua");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Filter transactions based on date range (YYYY-MM-DD)
  const filteredTransaksiList = transaksiList.filter(t => {
    const tDate = t.tanggal.substring(0, 10);
    if (startDate && tDate < startDate) return false;
    if (endDate && tDate > endDate) return false;
    return true;
  });

  // --- STATS CALCULATION ---
  const totalPenerimaan = filteredTransaksiList.reduce((sum, t) => sum + t.jumlah, 0);
  
  // Calculate this month's transactions
  const currentDate = new Date();
  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`; // e.g. "2026-05"
  
  const transBulanIni = filteredTransaksiList.filter(t => t.tanggal.startsWith(currentMonthKey));
  const penerimaanBulanIni = transBulanIni.reduce((sum, t) => sum + t.jumlah, 0);

  // Calculate unpaid students count for SPP this month
  const totalSiswa = siswaList.length;
  const siswaLunasBulanIni = siswaList.filter(s => {
    const sSpp = s.statusSpp || {};
    return sSpp[currentMonthKey] === "Lunas";
  }).length;
  const siswaBelumBulanIni = totalSiswa - siswaLunasBulanIni;
  
  // Class options - dynamically extracted from actual students list, or fallback if empty
  const dynamicClasses = Array.from(new Set(siswaList.map(s => s.kelas))).filter(Boolean).sort();
  const classes = ["Semua", ...(dynamicClasses.length > 0 ? dynamicClasses : ["X-IPA-1", "X-IPA-2", "X-IPS-1", "XI-IPA-1", "XI-IPA-2", "XI-IPS-1", "XII-IPA-1", "XII-IPS-1"])];

  // Monthly breakdown for SVG Trend Graph based on DAFTAR_BULAN academic year
  const monthlyDataMap: Record<string, number> = {};
  DAFTAR_BULAN.forEach(m => {
    monthlyDataMap[m.key] = 0;
  });
  
  filteredTransaksiList.forEach(t => {
    // Extract month key "YYYY-MM" from "YYYY-MM-DD HH:mm:ss"
    const mKey = t.tanggal.substring(0, 7);
    if (monthlyDataMap[mKey] !== undefined) {
      monthlyDataMap[mKey] += t.jumlah;
    }
  });

  const trendData = DAFTAR_BULAN.map(m => ({
    month: m.label.split(" ")[0], // Get only name e.g. "Juli"
    value: monthlyDataMap[m.key] || 0
  }));

  const maxTrendValue = Math.max(...trendData.map(d => d.value), 100000);

  // Payment categories breakdown
  const categorySummary = {
    "SPP": 0,
    "Uang Gedung": 0,
    "Seragam": 0,
    "Kegiatan": 0,
    "Lainnya": 0
  };

  filteredTransaksiList.forEach(t => {
    if (categorySummary[t.jenisPembayaran] !== undefined) {
      categorySummary[t.jenisPembayaran] += t.jumlah;
    } else {
      categorySummary["Lainnya"] += t.jumlah;
    }
  });

  const categories = Object.entries(categorySummary).map(([name, val]) => ({ name, val }));
  const maxCategoryValue = Math.max(...categories.map(c => c.val), 10000);

  // Students status based on selected path
  const filteredStudents = selectedClassFilter === "Semua" 
    ? siswaList 
    : siswaList.filter(s => s.kelas === selectedClassFilter);

  const filteredLunas = filteredStudents.filter(s => {
    const sSpp = s.statusSpp || {};
    return sSpp[currentMonthKey] === "Lunas";
  }).length;
  const filteredTotal = filteredStudents.length;
  const filteredBelumPay = filteredTotal - filteredLunas;
  const matchPercentage = filteredTotal > 0 ? Math.round((filteredLunas / filteredTotal) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      
      {/* Banner / Header */}
      <div className="glass-card bg-blue-600/10 border border-blue-500/20 text-white rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative z-10 space-y-1">
          <span className="bg-blue-500/20 text-blue-350 text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full border border-blue-550/30">
            DASHBOARD UTAMA
          </span>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Selamat Datang di Portal Kasir Sekolah</h2>
          <p className="text-sm text-slate-350 font-sans">
            Sistem Pemantauan Pembayaran Siswa Terintegrasi & Cetak Kuitansi Otomatis • <b>{config.namaSekolah}</b>
          </p>
        </div>
        <button
          onClick={() => onNavigateToPayment()}
          className="relative z-10 flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white transition-all font-semibold text-sm px-5 py-3 rounded-xl shadow-lg shadow-blue-500/20 cursor-pointer border border-blue-400/20"
        >
          <PlusCircle className="size-4" />
          Input Pembayaran Baru
        </button>

        {/* Decorative ambient blobs */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500 rounded-full blur-3xl opacity-15 translate-x-12 -translate-y-12 animate-pulse"></div>
        <div className="absolute -left-12 -bottom-12 w-60 h-60 bg-blue-800 rounded-full blur-2xl opacity-20"></div>
      </div>

      {/* Date Range Filter Controls */}
      <div className="glass glass-card p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in text-xs font-sans text-left">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
            <Calendar className="size-4 text-blue-450" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">Filter Rentang Tanggal</h4>
            <p className="text-[10px] text-slate-400">Pantau akumulasi nominal keuangan pada periode khusus</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-300">Dari:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-slate-200 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-300">Sampai:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-slate-200 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 hover:text-white rounded-lg transition-colors cursor-pointer text-[10px] font-extrabold flex items-center justify-center gap-1"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div className="glass glass-card rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
            <DollarSign className="size-6" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-450 uppercase tracking-wider">Total Penerimaan Kas</p>
            <h4 className="text-xl font-bold font-sans text-white tracking-tight">{formatRupiah(totalPenerimaan)}</h4>
            <p className="text-[10px] text-slate-400">Kas Lebih Terstruktur</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass glass-card rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
            <TrendingUp className="size-6" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-450 uppercase tracking-wider">Penerimaan Bulan Ini</p>
            <h4 className="text-xl font-bold font-sans text-white tracking-tight">{formatRupiah(penerimaanBulanIni)}</h4>
            <span className="inline-flex items-center text-[10px] text-emerald-400 font-semibold bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/20">
              {transBulanIni.length} Transaksi
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass glass-card rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20">
            <Users className="size-6" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-450 uppercase tracking-wider font-sans">Status SPP ({currentMonthKey})</p>
            <h4 className="text-xl font-bold text-white tracking-tight">
              {siswaLunasBulanIni} <span className="text-slate-400 text-sm font-normal">/ {totalSiswa} Lunas</span>
            </h4>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-1.5 border border-white/10">
              <div 
                className="bg-emerald-400 h-full transition-all duration-500" 
                style={{ width: `${totalSiswa > 0 ? (siswaLunasBulanIni / totalSiswa) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass glass-card rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
            <AlertCircle className="size-6" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-450 uppercase tracking-wider font-sans">Belum Bayar SPP</p>
            <h4 className="text-xl font-bold text-white tracking-tight">
              {siswaBelumBulanIni} <span className="text-slate-400 text-sm font-normal">Siswa</span>
            </h4>
            <p className="text-[10px] text-amber-400 font-medium">Bulan berjalan: {formatBulanIndo(currentMonthKey)}</p>
          </div>
        </div>

      </div>

      {/* Charts section with custom beautiful SVG visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SVG Payment Trend (2/3 width on desktop) */}
        <div className="glass glass-card rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-white">Tren Realisasi Penerimaan Kas</h3>
                <p className="text-xs text-slate-300 mt-0.5">Statistik pendapatan terdaftar 6 bulan terakhir</p>
              </div>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Real-Time
              </span>
            </div>

            {/* Custom SVG Line-Bar Graph */}
            <div className="relative w-full h-64 mt-4">
              <svg className="w-full h-full" viewBox="0 0 500 240" preserveAspectRatio="none">
                {/* Horizontal gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                  const y = 20 + ratio * 160;
                  const labelVal = Math.round(maxTrendValue - ratio * maxTrendValue);
                  return (
                    <g key={i} className="opacity-15">
                      <line x1="45" y1={y} x2="480" y2={y} stroke="#ffffff" strokeDasharray="4 4" strokeWidth="1" />
                      <text x="5" y={y + 4} fill="#cbd5e1" fontSize="9" className="font-mono">
                        {labelVal >= 1000000 ? `${(labelVal / 1000000).toFixed(1)}J` : `${labelVal / 1000}K`}
                      </text>
                    </g>
                  );
                })}

                {/* Bars & Dots */}
                {trendData.map((d, i) => {
                  const x = 50 + i * 38;
                  const barHeight = d.value > 0 ? (d.value / maxTrendValue) * 160 : 0;
                  const barY = 180 - barHeight;

                  return (
                    <g key={i} className="group cursor-pointer">
                      {/* Interactive block hover */}
                      <rect x={x - 14} y="20" width="28" height="170" fill="transparent" className="hover:fill-white/5 transition-all rounded" />
                      
                      {/* Main Bar */}
                      <rect 
                        x={x - 8} 
                        y={barY} 
                        width="16" 
                        height={barHeight} 
                        fill="#60a5fa" 
                        rx="4" 
                        className="opacity-70 group-hover:opacity-100 group-hover:fill-blue-400 transition-all"
                      />

                      {/* Tooltip on top of columns */}
                      <text 
                        x={x} 
                        y={barY - 8} 
                        fill="#ffffff" 
                        fontSize="10" 
                        fontWeight="600" 
                        textAnchor="middle"
                        className="opacity-0 group-hover:opacity-100 transition-all duration-200"
                      >
                        {formatRupiah(d.value).split(",")[0]}
                      </text>

                      {/* Month names on bottom */}
                      <text x={x} y="205" fill="#94a3b8" fontSize="10" fontWeight="555" textAnchor="middle">
                        {d.month.substring(0, 3)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
          
          <div className="border-t border-white/5 pt-3 flex justify-between items-center text-xs text-slate-450 font-sans">
            <span>Siswa yang bayar cash berkontribusi terbesar di periode ini.</span>
            <span className="flex items-center gap-1.5"><Calendar className="size-3 text-blue-400" strokeWidth={2.5} /> Juli 2025 - Juni 2026</span>
          </div>
        </div>

        {/* Categories Breakdown (1/3 width on desktop) */}
        <div className="glass glass-card rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white">Alokasi Penerimaan</h3>
            <p className="text-xs text-slate-400 mt-0.5">Perbandingan nominal per kategori dana</p>

            <div className="space-y-4 mt-6">
              {categories.map((c, i) => {
                const colors = ["bg-blue-400", "bg-emerald-400", "bg-amber-400", "bg-purple-400", "bg-rose-450"];
                const textColors = ["text-blue-400", "text-emerald-400", "text-amber-400", "text-purple-400", "text-rose-400"];
                const bgLight = ["bg-blue-500/10", "bg-emerald-500/10", "bg-amber-500/10", "bg-purple-500/10", "bg-rose-500/10"];
                const borderColors = ["border-blue-500/20", "border-emerald-500/20", "border-amber-500/20", "border-purple-500/20", "border-rose-500/20"];
                const prc = maxCategoryValue > 0 ? (c.val / maxCategoryValue) * 100 : 0;

                return (
                  <div key={i} className="space-y-1.5 group">
                    <div className="flex justify-between items-center text-xs">
                      <span className={`px-2 py-0.5 rounded font-semibold border ${bgLight[i]} ${textColors[i]} ${borderColors[i]}`}>
                        {c.name}
                      </span>
                      <span className="font-semibold text-slate-200 font-mono">
                        {formatRupiah(c.val)}
                      </span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/10">
                      <div 
                        className={`h-full transition-all duration-500 ${colors[i]}`} 
                        style={{ width: `${prc}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-white/5 pt-3 text-[11px] text-slate-400 mt-4 leading-relaxed font-sans">
            Penyortiran real-time berdasarkan data transaksi kuitansi kasir sekolah yang aktif.
          </div>
        </div>

      </div>

      {/* Class Status Tracker & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Pembayaran Per Kelas (1/3 width) */}
        <div className="glass glass-card rounded-2xl p-5">
          <div className="space-y-1">
            <h3 className="font-bold text-white">Status Registrasi SPP Bulanan</h3>
            <p className="text-xs text-slate-400">Pilih kelas siswa demi validasi status detail pembayaran berjalan</p>
          </div>

          {/* Quick Select Filter */}
          <div className="relative mt-4">
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 text-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              {classes.map((cls, i) => (
                <option key={i} value={cls} className="bg-slate-900 border-none select-none text-white">
                  {cls === "Semua" ? "Semua Kelas" : (cls.toLowerCase().startsWith("kelas") ? cls : `Kelas ${cls}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white/5 rounded-xl p-4 mt-4 space-y-3 border border-white/10">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Jumlah Siswa</span>
              <span className="font-bold text-slate-200">{filteredTotal} Anak</span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Siswa Lunas SPP</span>
              <span className="font-bold text-emerald-400">{filteredLunas} Lunas</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Siswa Menunggak</span>
              <span className="font-bold text-amber-400">{filteredBelumPay} Siswa</span>
            </div>

            <div className="border-t border-white/10 pt-3">
              <div className="flex justify-between items-center text-xs mb-1 font-semibold">
                <span className="text-slate-400">Persentase Kepatuhan SPP</span>
                <span className="text-blue-400">{matchPercentage}%</span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-500 h-full transition-all duration-500" 
                  style={{ width: `${matchPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Unpaid students list with quick shortcut icon */}
          {filteredTotal > 0 && (
            (() => {
              const unpaid = filteredStudents.filter(s => {
                const sSpp = s.statusSpp || {};
                return sSpp[currentMonthKey] !== "Lunas";
              });
              if (unpaid.length > 0) {
                return (
                  <div className="mt-4 border-t border-white/10 pt-4 space-y-2 text-left">
                    <span className="text-xs font-bold text-amber-500 uppercase tracking-wider block">
                      Siswa Belum Bayar Bulan Ini ({unpaid.length})
                    </span>
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                      {unpaid.map((s) => {
                        const sSpp = s.statusSpp || {};
                        const status = sSpp[currentMonthKey] || "Belum_Bayar";
                        const isPartial = typeof status === "string" && status.startsWith("Kurang:");
                        const sisaStr = isPartial ? ` (Kurang ${formatRupiah(Number(status.split(":")[1]))})` : "";
                        
                        return (
                          <div 
                            key={s.id} 
                            className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="text-xs font-bold text-white block truncate">{s.nama}</span>
                              <span className="text-[10px] text-slate-400 font-mono block">
                                {s.nis} • {s.kelas} {isPartial && <span className="text-amber-400 font-semibold">{sisaStr}</span>}
                              </span>
                            </div>
                            <button
                              onClick={() => onNavigateToPayment(s.id)}
                              type="button"
                              title={`Proses Bayar SPP ${s.nama}`}
                              className="p-1.5 shrink-0 rounded-lg text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-500 border border-blue-500/20 active:scale-95 transition-all cursor-pointer"
                            >
                              <ChevronRight className="size-3.5" strokeWidth={2.5} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="mt-4 border-t border-white/10 pt-4 text-center">
                    <span className="text-xs text-emerald-400 font-semibold">🎉 Semua siswa di kelas ini lunas bulan ini!</span>
                  </div>
                );
              }
            })()
          )}

          <p className="text-[10px] text-slate-450 mt-4 leading-relaxed italic text-center font-sans">
            Menunjukkan rekap SPP Bulan {formatBulanIndo(currentMonthKey)}
          </p>
        </div>

        {/* Recent Transactions (2/3 width) */}
        <div className="glass glass-card rounded-2xl p-5 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-white">5 Transaksi Pembayaran Terbaru</h3>
                <p className="text-xs text-slate-400 mt-0.5">Penerimaan kas cash dan transfer terbaru</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] bg-white/5 text-slate-300 font-semibold tracking-wide uppercase border border-white/10">
                Alur Kas
              </span>
            </div>

            {/* List Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-white/10 text-slate-300 text-xs font-semibold uppercase tracking-wider bg-white/10">
                    <th className="py-2.5 px-3">No. Jurnal</th>
                    <th className="py-2.5 px-3">Siswa / Kelas</th>
                    <th className="py-2.5 px-3">Jenis Pembayaran</th>
                    <th className="py-2.5 px-3 text-right">Nominal</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTransaksiList.slice(-5).reverse().map((t) => (
                    <motion.tr 
                      key={t.id} 
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="hover:bg-white/5 transition-colors group"
                    >
                      <td className="py-3 px-3 font-mono text-[11px] font-semibold text-slate-300">
                        {t.id}
                        <span className="block text-[9px] text-slate-450 mt-0.5">{getOnlyDate(t.tanggal)}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-200 block">{t.siswaNama}</span>
                        <span className="text-[10px] font-mono text-slate-400">{t.siswaNis} • {t.siswaKelas}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`size-1.5 rounded-full ${t.jenisPembayaran === "SPP" ? "bg-blue-400" : "bg-emerald-400"}`}></span>
                          <span className="text-xs font-semibold text-slate-300">{t.jenisPembayaran}</span>
                        </span>
                        {t.bulanCovered && (
                          <span className="block text-[9px] text-blue-400 font-medium mt-0.5">Smt / SPP: {t.bulanCovered}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-200">
                        {formatRupiah(t.jumlah)}
                        <span className="block text-[9px] font-sans font-semibold text-slate-400 uppercase mt-0.5">{t.metode}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onReprintReceipt(t)}
                            className="px-2.5 py-1 text-xs text-blue-400 hover:text-white border border-blue-400/20 hover:bg-blue-600 rounded-lg transition-all font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Receipt className="size-3" />
                            Kuitansi
                          </button>
                          {onDeleteTransaction && (
                            <button
                              onClick={() => {
                                setDeleteError(null);
                                setTransactionToDelete(t);
                              }}
                              className="p-1 text-red-400 hover:text-white border border-red-500/10 hover:bg-red-500/20 hover:border-red-500/30 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center"
                              title="Hapus Transaksi"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}

                  {filteredTransaksiList.length === 0 && (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <td colSpan={5} className="py-8 text-center text-slate-455 text-xs italic">
                        Belum ada riwayat transaksi terdaftar.
                      </td>
                    </motion.tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-white/5 pt-3 flex justify-between items-center text-xs mt-3">
            <span className="text-slate-450">Menampilkan kuitansi teratas dari keseluruhan jurnal transaksi.</span>
          </div>

        </div>

      </div>

      {/* --- CONFIRMATION DELETE MODAL --- */}
      {transactionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-red-400">
                <AlertCircle className="size-6 shrink-0" />
                <h3 className="text-base font-bold text-white">Konfirmasi Hapus Transaksi</h3>
              </div>
              
              <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/25 space-y-2 text-xs text-slate-300">
                <p><strong>PERINGATAN:</strong> Tindakan ini tidak dapat dibatalkan. Menghapus transaksi akan mengurangi total penerimaan kas dan memulihkan status tagihan siswa yang bersangkutan.</p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-white/5 py-1.5">
                  <span className="text-slate-400">No. Jurnal (Kuitansi):</span>
                  <span className="font-mono font-semibold text-white">{transactionToDelete.id}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 py-1.5">
                  <span className="text-slate-400">Nama Siswa / NIS:</span>
                  <span className="font-semibold text-white">{transactionToDelete.siswaNama} ({transactionToDelete.siswaNis})</span>
                </div>
                <div className="flex justify-between border-b border-white/5 py-1.5">
                  <span className="text-slate-400">Jenis Pembayaran:</span>
                  <span className="font-semibold text-slate-200">
                    {transactionToDelete.jenisPembayaran}
                    {transactionToDelete.bulanCovered && ` (${formatBulanIndo(transactionToDelete.bulanCovered).split(" ")[0]})`}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 py-1.5">
                  <span className="text-slate-400">Nominal:</span>
                  <span className="font-mono font-bold text-emerald-400">{formatRupiah(transactionToDelete.jumlah)}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Metode Bayar:</span>
                  <span className="font-semibold text-white">{transactionToDelete.metode}</span>
                </div>
              </div>

              {deleteError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-300 text-xs rounded-xl">
                  {deleteError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTransactionToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-red-600/50 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  {isDeleting ? "Menghapus..." : "Hapus Permanen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
