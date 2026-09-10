/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Transaksi, AppConfig } from "../types";
import { formatRupiah, terbilang, formatBulanIndo } from "../utils";
import { Printer, X, CreditCard } from "lucide-react";
import QRCode from "qrcode";

interface ReceiptViewProps {
  transaksi: Transaksi | null;
  config: AppConfig;
  onClose: () => void;
}

// CRC16 CCITT for QRIS generation
function calculateCrc16(str: string): string {
  let crc = 0xffff;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  let hex = (crc & 0xffff).toString(16).toUpperCase();
  return hex.padStart(4, '0');
}

// Generate a valid static QRIS format payload with dynamic amount
export function generateQRISString(merchantName: string, city: string, amount: number, transactionId: string, merchantId?: string): string {
  const pad = (num: number) => num.toString().padStart(2, '0');
  
  let cleanName = merchantName.toUpperCase().replace(/[^A-Z0-9 ]/g, '').substring(0, 25);
  if (!cleanName) cleanName = "KASIR SEKOLAH";
  
  let cleanCity = city.toUpperCase().replace(/[^A-Z0-9 ]/g, '').substring(0, 15);
  if (!cleanCity) cleanCity = "BANDUNG";
  
  const cleanId = transactionId.replace(/[^A-Z0-9]/ig, '').substring(0, 15);

  let qris = "000201"; 
  qris += "010212"; // Point of Initiation: 12 (Dynamic QR with Amount)
  
  let subFieldMerchant = "0014ID.CO.QRIS.WWW011893600520000000000102031201234567890303ULE";
  if (merchantId) {
    const cleanMid = merchantId.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const gId = "0014ID.CO.QRIS.WWW";
    const mId = "01" + pad(cleanMid.length) + cleanMid;
    const mClass = "0215ID1020304050607";
    subFieldMerchant = gId + mId + mClass;
  }
  qris += "26" + pad(subFieldMerchant.length) + subFieldMerchant;
  
  qris += "52048211"; // MCC Category: Elementary & Secondary Schools
  qris += "5303360"; // Currency: IDR (360)
  
  const amountStr = Math.round(amount).toString();
  qris += "54" + pad(amountStr.length) + amountStr; // Amount field
  
  qris += "5802ID"; // Country Code
  qris += "59" + pad(cleanName.length) + cleanName; // Merchant Name
  qris += "60" + pad(cleanCity.length) + cleanCity; // City
  
  const feeLabel = "0105PAYSP07" + pad(cleanId.length) + cleanId;
  qris += "62" + pad(feeLabel.length) + feeLabel;
  
  qris += "6304";
  
  const crcValue = calculateCrc16(qris);
  return qris + crcValue;
}

// Helper to format a Date into Indonesian string format: "DD MMMM YYYY HH:mm:ss"
export function formatIndonesianDateTime(date: Date): string {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`;
}

export default function ReceiptView({ transaksi, config, onClose }: ReceiptViewProps) {
  if (!transaksi) return null;

  const [selectedTempat, setSelectedTempat] = useState<string>("");
  const [selectedTanggal, setSelectedTanggal] = useState<string>("");
  const [isRealtime, setIsRealtime] = useState<boolean>(true);

  // Initialize selectedTempat with config city or default
  useEffect(() => {
    const defaultCity = config.alamatSekolah.split(",")[0]?.trim() || "Bandung";
    setSelectedTempat(defaultCity);
  }, [config]);

  // Set real-time clock interval
  useEffect(() => {
    if (!isRealtime) return;

    // Set initial date/time
    setSelectedTanggal(formatIndonesianDateTime(new Date()));

    const timer = setInterval(() => {
      setSelectedTanggal(formatIndonesianDateTime(new Date()));
    }, 1000);

    return () => clearInterval(timer);
  }, [isRealtime]);

  const handlePrint = () => {
    window.print();
  };

  // Generate dynamic QRIS string for scanning
  const qrisPayload = generateQRISString(
    config.namaSekolah,
    config.alamatSekolah.split(",")[0] || "BANDUNG",
    transaksi.jumlah,
    transaksi.id,
    config.merchantId
  );

  const [qrisQrUrl, setQrisQrUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrisPayload, {
      margin: 1,
      width: 250,
      errorCorrectionLevel: 'M'
    })
      .then(url => {
        if (active) {
          setQrisQrUrl(url);
        }
      })
      .catch(err => {
        console.log("[QR Status] Local QR generator fallback active:", err instanceof Error ? err.message : err);
      });
    return () => {
      active = false;
    };
  }, [qrisPayload]);

  return (
    <div id="receipt-modal-overlay" className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="glass text-white rounded-2xl w-full max-w-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh] no-print">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 bg-white/5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400 border border-blue-500/20 animate-pulse">
              <Printer className="size-5" />
            </div>
            <h3 className="font-semibold text-white">Pratinjau Kuitansi Pembayaran</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Receipt Content Container */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-transparent">
          
          {/* Pengaturan Cetak Kuitansi (Manual & Realtime) */}
          <div className="mb-6 bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 no-print text-sm">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-blue-400 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <svg className="size-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Pengaturan Cetak Kuitansi
              </h4>
              <button 
                onClick={() => {
                  setIsRealtime(!isRealtime);
                  if (!isRealtime) {
                    setSelectedTanggal(formatIndonesianDateTime(new Date()));
                  }
                }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase transition-all ${
                  isRealtime 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                    : "bg-slate-500/15 text-slate-400 border border-slate-500/20 hover:bg-slate-500/25"
                }`}
              >
                <span className={`inline-block size-1.5 rounded-full ${isRealtime ? "bg-emerald-400" : "bg-slate-500"}`} />
                {isRealtime ? "Realtime Aktif" : "Realtime Mati"}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tempat Kuitansi (Manual)</label>
                <input 
                  type="text"
                  value={selectedTempat}
                  onChange={(e) => setSelectedTempat(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 font-medium"
                  placeholder="Masukkan kota tempat kuitansi..."
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tanggal Kuitansi</label>
                <input 
                  type="text"
                  value={selectedTanggal}
                  onChange={(e) => {
                    setIsRealtime(false);
                    setSelectedTanggal(e.target.value);
                  }}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 font-mono font-medium"
                  placeholder="Contoh: 31 Mei 2026 21:00"
                />
              </div>
            </div>
          </div>

          {/* Main Visual Kuitansi */}
          <div className="bg-slate-900/95 border border-white/10 p-6 md:p-8 rounded-xl shadow-xl relative overflow-hidden text-slate-100">
            {/* Stamp Watermark Background */}
            <div className="absolute right-12 bottom-12 opacity-5 pointer-events-none rotate-12 select-none">
              {transaksi.sisaTunggakan && transaksi.sisaTunggakan > 0 ? (
                <div className="border-4 border-amber-500 rounded-full size-40 flex items-center justify-center flex-col text-amber-500 font-bold tracking-widest text-center border-dashed p-2">
                  <span className="text-xl">BELUM LUNAS</span>
                  <span className="text-[10px]">{config.namaSekolah}</span>
                </div>
              ) : (
                <div className="border-4 border-emerald-500 rounded-full size-40 flex items-center justify-center flex-col text-emerald-400 font-bold tracking-widest text-center border-dashed p-2">
                  <span className="text-xl">LUNAS</span>
                  <span className="text-[10px]">{config.namaSekolah}</span>
                </div>
              )}
            </div>

            {/* Header Kuitansi */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 border-b-2 border-white/5 pb-5">
              <div className="flex items-start gap-4">
                {config.logoSekolah && (
                  <img 
                    src={config.logoSekolah} 
                    alt="Logo Sekolah" 
                    referrerPolicy="no-referrer"
                    className="size-16 object-contain shrink-0" 
                  />
                )}
                <div>
                  <h4 className="text-xl font-bold text-white tracking-tight">{config.namaSekolah}</h4>
                  <p className="text-xs text-slate-300 mt-1 max-w-xs">{config.alamatSekolah}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Telp: {config.teleponSekolah}</p>
                </div>
              </div>
              <div className="text-left md:text-right flex flex-col gap-0.5 md:items-end">
                <span className="inline-flex px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-400 text-xs font-semibold uppercase tracking-wide border border-emerald-500/20">
                  Bukti Pembayaran {transaksi.metode}
                </span>
                <span className="text-xs font-mono text-slate-400 mt-2">No: {transaksi.id}</span>
                <span className="text-xs text-slate-400">Tanggal: {selectedTanggal}</span>
              </div>
            </div>

            {/* Kuitansi Body */}
            <div className="py-6 space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-2 border-b border-white/5 pb-2">
                <div className="text-slate-400 font-medium font-sans">Telah Diterima Dari</div>
                <div className="col-span-2 text-white font-semibold">{transaksi.siswaNama}</div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-b border-white/5 pb-2">
                <div className="text-slate-400 font-medium font-sans">NIS / Kelas</div>
                <div className="col-span-2 text-slate-100 font-mono">
                  {transaksi.siswaNis} <span className="text-white/20 font-sans mx-2">|</span> {transaksi.siswaKelas}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-b border-white/5 pb-2">
                <div className="text-slate-400 font-medium font-sans">Untuk Pembayaran</div>
                <div className="col-span-2 text-white font-semibold flex items-center gap-2">
                  <span>{transaksi.jenisPembayaran}</span>
                  {transaksi.bulanCovered && (
                    <span className="text-blue-400 bg-blue-500/15 border border-blue-500/20 text-xs px-2.5 py-0.5 rounded font-bold uppercase tracking-wider text-[10px]">
                      SPP Bulan {formatBulanIndo(transaksi.bulanCovered)}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-b border-white/5 pb-2">
                <div className="text-slate-400 font-medium font-sans">Jumlah Uang</div>
                <div className="col-span-2 space-y-1">
                  {transaksi.sisaTunggakan && transaksi.sisaTunggakan > 0 ? (
                    <>
                      <div className="text-slate-300 text-xs font-sans">
                        Nilai Tagihan Asli: <span className="font-mono font-semibold">{formatRupiah(transaksi.originalTagihan || 0)}</span>
                      </div>
                      <div className="text-emerald-400 font-mono font-bold text-base">
                        Dibayar Sekarang: {formatRupiah(transaksi.jumlah)}
                      </div>
                      <div className="text-red-400 text-xs font-semibold font-sans">
                        Sisa Tagihan: <span className="font-mono">{formatRupiah(transaksi.sisaTunggakan)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-emerald-400 font-mono font-bold text-base">
                      {formatRupiah(transaksi.jumlah)}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-b border-white/5 pb-2">
                <div className="text-slate-400 font-medium font-sans">Terbilang</div>
                <div className="col-span-2 text-slate-305 italic font-medium bg-white/5 p-2 rounded-lg text-xs leading-relaxed border border-white/5 animate-fade-in text-slate-300">
                  {terbilang(transaksi.jumlah)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-b border-white/5 pb-2">
                <div className="text-slate-400 font-medium font-sans">Metode Bayar</div>
                <div className="col-span-2 text-slate-100">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {transaksi.metode}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pb-2">
                <div className="text-slate-400 font-medium font-sans">Catatan</div>
                <div className="col-span-2 text-slate-300 text-xs">
                  {transaksi.keterangan || "-"}
                </div>
              </div>
            </div>

            {/* QRIS / Transfer Bank Section (Dynamic QR Code) */}
            <div className="mt-2 p-4 rounded-xl border border-dashed border-white/20 bg-white/5 flex flex-col sm:flex-row items-center gap-4 text-left">
              <div className="bg-white p-2 rounded-lg flex-shrink-0 flex flex-col items-center justify-center">
                <img 
                  src={qrisQrUrl || `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrisPayload)}`} 
                  alt="QRIS Pembayaran" 
                  className="size-24"
                  referrerPolicy="no-referrer"
                />
                <div className="text-[9px] font-black tracking-widest text-[#1e1b4b] mt-1 flex items-center justify-center">
                  <span className="text-red-500">Q</span>
                  <span className="text-indigo-900">R</span>
                  <span className="text-blue-500">I</span>
                  <span className="text-amber-500">S</span>
                  <span className="text-slate-505 text-[8px] font-semibold ml-1 text-slate-700">DIGITAL</span>
                </div>
              </div>
              <div className="flex-1 space-y-1.5 font-sans">
                <h5 className="text-[11px] font-extrabold text-[#60a5fa] flex items-center gap-1.5 uppercase tracking-wider">
                  <CreditCard className="size-3.5" /> Scan QRIS / Rekening Transfer ({config.namaBank || "BSI"})
                </h5>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Scan barcode QRIS di samping melalui M-Banking / E-Wallet, atau lakukan transfer langsung ke rekening bank resmi sekolah di bawah ini:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-1 pt-1 text-[11px]">
                  <div>
                    <span className="text-[9px] text-slate-400 block font-medium">Bank Tujuan:</span>
                    <span className="text-white font-bold">{config.namaBank || "Bank Syariah Indonesia"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block font-medium">No. Rekening:</span>
                    <span className="text-blue-300 font-mono font-bold tracking-wider hover:underline select-all">{config.rekeningBank || "7123456789"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block font-medium">Atas Nama:</span>
                    <span className="text-slate-200 font-semibold">{config.pemilikRekening || "SMA Nusantara Mandiri"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Kuitansi */}
            <div className="flex justify-between items-end pt-5 border-t border-white/5 mt-5">
              <div className="text-left">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Catatan Penting</div>
                <p className="text-[10px] text-slate-400 max-w-[240px] leading-relaxed mt-1">
                  * Kuitansi ini valid secara digital dilampiri kode verifikasi transfer dan QRIS pembayaran sekolah.
                </p>
              </div>
              <div className="text-center min-w-[150px]">
                <p className="text-[11px] text-slate-300 font-sans italic mb-1" title="Kota dan tanggal kuitansi yang dapat disesuaikan di atas">
                  {selectedTempat}, {selectedTanggal.split(" ").slice(0, 3).join(" ")}
                </p>
                <p className="text-xs text-slate-400 font-sans font-semibold">Penerima,</p>
                <div className="h-12 flex items-center justify-center">
                  {transaksi.sisaTunggakan && transaksi.sisaTunggakan > 0 ? (
                    <span className="text-amber-500 font-mono font-semibold text-xs border border-amber-500/35 border-dashed px-2 py-1 rotate-[-2deg] rounded bg-amber-500/10 select-none">
                      {config.namaSekolah}
                    </span>
                  ) : (
                    <span className="text-blue-400 font-mono font-semibold text-xs border border-blue-500/30 border-dashed px-2 py-1 rotate-[-2deg] rounded bg-blue-500/5 select-none">
                      LUNAS - {config.namaSekolah}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-white border-t border-white/10 pt-1">
                  {transaksi.penerima}
                </p>
                <p className="text-[10px] text-slate-400">Petugas Keuangan</p>
              </div>
            </div>

          </div>

        </div>

        {/* Action Controls */}
        <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-white/10 text-slate-300 rounded-xl hover:bg-white/5 text-sm font-medium transition-colors cursor-pointer"
          >
            Tutup
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25 border border-blue-400/20 cursor-pointer active:transform active:scale-[0.98] transition-all"
          >
            <Printer className="size-4" />
            Cetak Kuitansi (Ctrl+P)
          </button>
        </div>

      </div>

      {/* --- DUPLICATE PRINT AREA ELEMENT --- */}
      {/* This element will be targeted by @media print in index.css */}
      <div className="printable-receipt bg-white text-black p-12 leading-relaxed" style={{ fontFamily: "sans-serif", position: "relative" }}>
        
        {/* Printable Watermark Background Overlay */}
        <div style={{
          position: "absolute",
          top: "43%",
          left: "50%",
          transform: "translate(-50%, -50%) rotate(-25deg)",
          fontSize: "76px",
          fontWeight: "900",
          fontFamily: "sans-serif",
          color: transaksi.sisaTunggakan && transaksi.sisaTunggakan > 0 ? "rgba(220, 38, 38, 0.04)" : "rgba(16, 185, 129, 0.04)",
          border: `10px dashed ${transaksi.sisaTunggakan && transaksi.sisaTunggakan > 0 ? "rgba(220, 38, 38, 0.05)" : "rgba(16, 185, 129, 0.05)"}`,
          padding: "15px 35px",
          borderRadius: "20px",
          letterSpacing: "6px",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          zIndex: 0,
          textTransform: "uppercase"
        }}>
          {transaksi.sisaTunggakan && transaksi.sisaTunggakan > 0 ? "BELUM LUNAS" : "LUNAS"}
        </div>

        {/* Border Frame for Print */}
        <div style={{ border: "2px solid #555", padding: "20px", borderRadius: "10px", position: "relative", zIndex: 10 }}>
          
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #333", paddingBottom: "15px", marginBottom: "15px" }}>
            <div style={{ display: "flex", alignItems: "start", gap: "15px" }}>
              {config.logoSekolah && (
                <img 
                  src={config.logoSekolah} 
                  alt="Logo" 
                  style={{ width: "60px", height: "60px", objectFit: "contain" }} 
                />
              )}
              <div>
                <h2 style={{ margin: 0, fontSize: "22px", fontWeight: "bold" }}>{config.namaSekolah}</h2>
                <p style={{ margin: "5px 0 0 0", fontSize: "11px", color: "#333" }}>{config.alamatSekolah}</p>
                <p style={{ margin: "3px 0 0 0", fontSize: "11px", color: "#333" }}>Telp: {config.teleponSekolah}</p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <h4 style={{ margin: 0, fontSize: "16px", textTransform: "uppercase", letterSpacing: "1px" }}>BUKTI KUITANSI</h4>
              <p style={{ margin: "5px 0 0 0", fontSize: "12px", fontFamily: "monospace" }}>No: {transaksi.id}</p>
              <p style={{ margin: "3px 0 0 0", fontSize: "11px" }}>Tanggal: {selectedTanggal}</p>
            </div>
          </div>

          {/* Table Details */}
          <div style={{ margin: "25px 0", fontSize: "14px" }}>
            
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "10px 0", width: "180px", color: "#555", fontWeight: "bold" }}>Sudah Diterima Dari</td>
                  <td style={{ padding: "10px 0", fontWeight: "bold" }}>: {transaksi.siswaNama}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "10px 0", color: "#555", fontWeight: "bold" }}>NIS / Kelas</td>
                  <td style={{ padding: "10px 0", fontFamily: "monospace" }}>: {transaksi.siswaNis} / {transaksi.siswaKelas}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "10px 0", color: "#555", fontWeight: "bold" }}>Untuk Pembayaran</td>
                  <td style={{ padding: "10px 0", fontWeight: "bold" }}>
                    : {transaksi.jenisPembayaran} {transaksi.bulanCovered ? `(SPP Bulan ${formatBulanIndo(transaksi.bulanCovered)})` : ""}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "10px 0", color: "#555", fontWeight: "bold" }}>Jumlah Uang Nominal</td>
                  <td style={{ padding: "10px 0" }}>
                    {transaksi.sisaTunggakan && transaksi.sisaTunggakan > 0 ? (
                      <div>
                        <div style={{ fontSize: "12px", color: "#555" }}>Nilai Tagihan Asli: <span style={{ fontFamily: "monospace" }}>: {formatRupiah(transaksi.originalTagihan || 0)}</span></div>
                        <div style={{ fontWeight: "bold", fontSize: "16px", color: "#10b981", margin: "2px 0" }}>: Dibayar Sekarang: {formatRupiah(transaksi.jumlah)}</div>
                        <div style={{ fontSize: "12px", color: "#ef4444", fontWeight: "bold" }}>: Sisa Tagihan: <span style={{ fontFamily: "monospace" }}>{formatRupiah(transaksi.sisaTunggakan)}</span></div>
                      </div>
                    ) : (
                      <span style={{ fontWeight: "bold", fontSize: "16px", color: "#111" }}>: {formatRupiah(transaksi.jumlah)}</span>
                    )}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "10px 0", color: "#555", fontWeight: "bold", verticalAlign: "top" }}>Terbilang</td>
                  <td style={{ padding: "10px 0", fontStyle: "italic", backgroundColor: "#f9f9f9", textIndent: "5px" }}>
                    : {terbilang(transaksi.jumlah)}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "10px 0", color: "#555", fontWeight: "bold" }}>Metode Bayar</td>
                  <td style={{ padding: "10px 0" }}>: {transaksi.metode}</td>
                </tr>
                <tr>
                  <td style={{ padding: "10px 0", color: "#555", fontWeight: "bold" }}>Catatan</td>
                  <td style={{ padding: "10px 0" }}>: {transaksi.keterangan || "-"}</td>
                </tr>
              </tbody>
            </table>

          </div>

          {/* Printable QR payment code + transfer guidelines */}
          <div style={{ display: "flex", border: "1px dashed #777", padding: "12px", borderRadius: "10px", margin: "20px 0", fontSize: "12px", alignItems: "center", gap: "20px" }}>
            <div style={{ textAlign: "center" }}>
              <img 
                src={qrisQrUrl || `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrisPayload)}`} 
                alt="QRIS Pembayaran" 
                style={{ width: "95px", height: "95px" }}
                referrerPolicy="no-referrer"
              />
              <div style={{ fontSize: "8px", fontWeight: "bold", marginTop: "3px", letterSpacing: "1px" }}>QRIS DIGITAL</div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 5px 0", fontWeight: "bold", textTransform: "uppercase", fontSize: "11px", color: "#000" }}>Pintu Pembayaran Transfer / Cashless</p>
              <p style={{ margin: "0 0 8px 0", fontSize: "10px", color: "#444" }}>Jika belum lunas atau melakukan transaksi transfer lanjutan, Anda dapat dengan mudah memindai barcode QRIS di samping atau mentransfer pembayaran secara langsung ke rekening sekolah berikut:</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", fontSize: "10px" }}>
                <div><strong>Bank Penerima:</strong> {config.namaBank || "Bank Syariah Indonesia (BSI)"}</div>
                <div><strong>No. Rekening:</strong> {config.rekeningBank || "7123456789"}</div>
                <div style={{ gridColumn: "span 2" }}><strong>Pemilik Rekening:</strong> {config.pemilikRekening || "SMA Nusantara Mandiri"}</div>
              </div>
            </div>
          </div>

          {/* Footer Area with Signatures */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "30px" }}>
            <div style={{ fontSize: "10px", color: "#555", maxWidth: "250px" }}>
              <p style={{ margin: 0 }}>* Pembayaran ini dinyatakan sah apabila telah divalidasi oleh petugas kasir sekolah.</p>
              <p style={{ margin: "5px 0 0 0" }}>* Dicetak otomatis oleh Sistem Kasir {config.namaSekolah}.</p>
            </div>
            <div style={{ textAlign: "center", minWidth: "180px", fontSize: "12px" }}>
              <p style={{ margin: 0 }}>{selectedTempat}, {selectedTanggal.split(" ").slice(0, 3).join(" ")}</p>
              <p style={{ margin: "5px 0 0 0" }}>Petugas Keuangan,</p>
              <div style={{ height: "60px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ border: `2px solid ${transaksi.sisaTunggakan && transaksi.sisaTunggakan > 0 ? "#f59e0b" : "#555"}`, color: transaksi.sisaTunggakan && transaksi.sisaTunggakan > 0 ? "#d97706" : "#000", padding: "5px 12px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", opacity: 0.8, textTransform: "uppercase" }}>
                  {transaksi.sisaTunggakan && transaksi.sisaTunggakan > 0 ? "BELUM LUNAS" : "LUNAS"}
                </span>
              </div>
              <p style={{ margin: 0, fontWeight: "bold", borderTop: "1px solid #333", paddingTop: "5px" }}>{transaksi.penerima}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#555" }}>Administrasi Sekolah</p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
