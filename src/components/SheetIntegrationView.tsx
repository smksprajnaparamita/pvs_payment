/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppConfig } from "../types";
import { useState } from "react";
import { 
  Database, 
  CheckCircle, 
  AlertTriangle, 
  Copy, 
  HelpCircle, 
  Link2, 
  RefreshCw,
  Info
} from "lucide-react";

interface SheetIntegrationViewProps {
  config: AppConfig;
  onUpdateConfig: (newConfig: AppConfig) => void;
  onSyncAllData: () => Promise<{ success: boolean; message: string }>;
  connectionStatus: 'connected' | 'disconnected' | 'testing';
  onTestConnection: () => Promise<{ success: boolean; message: string }>;
  onPullAllData?: () => Promise<{ success: boolean; message: string }>;
}

export function getUrlExplanation(url: string): { type: "success" | "warn" | "error"; label: string; text: string } {
  if (!url) {
    return {
      type: "warn",
      label: "Mode Offline (Belum Terhubung)",
      text: "Aplikasi berjalan offline. Data aman disimpan lokal di browser. Tempelkan URL Web App Google Apps Script (/exec) untuk mengaktifkan sinkronisasi cloud dua arah."
    };
  }
  
  const trimmed = url.trim();
  
  if (trimmed.includes("docs.google.com/spreadsheets")) {
    return {
      type: "error",
      label: "Salah Tipe: Ini URL Google Spreadsheet",
      text: "Anda memasukkan URL dokumen Google Spreadsheet. Sistem Kasir tidak bisa terhubung langsung menggunakan URL dokumen ini. Anda harus mendeploy kode Google Apps Script di kanan sebagai 'Web App', lalu menyalin URL Aplikasi Web (/exec) dan menempelnya di sini."
    };
  }
  
  if (trimmed.includes("script.google.com") && (trimmed.includes("/edit") || trimmed.includes("/home") || trimmed.includes("/d/"))) {
    return {
      type: "error",
      label: "Salah Tipe: Ini URL Editor Apps Script",
      text: "Anda memasukkan URL halaman editor koding / penulisan Apps Script. Dari editor tersebut, Anda harus mengeklik tombol biru 'Terapkan (Deploy)' -> 'Penerapan baru (New deployment)' -> pilih 'Aplikasi Web' -> Salin 'URL Aplikasi Web' yang berakhiran '/exec' dan tempel di sini."
    };
  }
  
  if (!trimmed.startsWith("https://script.google.com/macros/s/")) {
    return {
      type: "error",
      label: "Format URL Tidak Dikenali",
      text: "URL Web App yang valid dari Google Apps Script biasanya diawali dengan 'https://script.google.com/macros/s/...' Periksa kembali apakah tautan tersalin dengan lengkap."
    };
  }
  
  if (!trimmed.endsWith("/exec")) {
    return {
      type: "warn",
      label: "Akhiran URL Tidak Sesuai (/exec )",
      text: "Tautan Web App Google Apps Script biasanya harus berakhiran dengan '/exec'. Pastikan Anda mendeploy proyek sebagai 'Penerapan Baru' (bukan 'Uji Penerapan') dan menyalin seluruh alamat URL-nya."
    };
  }
  
  return {
    type: "success",
    label: "Format URL Tampak Sesuai!",
    text: "Format URL sudah tepat. Silakan klik 'Simpan URL' lalu klik 'Uji Koneksi' untuk menguji dan menarik data database dari Google Sheet pertama kali."
  };
}

export default function SheetIntegrationView({
  config,
  onUpdateConfig,
  onSyncAllData,
  connectionStatus,
  onTestConnection,
  onPullAllData
}: SheetIntegrationViewProps) {
  
  const [sheetUrl, setSheetUrl] = useState(config.sheetUrl);
  const [copied, setCopied] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [pullLoading, setPullLoading] = useState(false);
  const [pullResult, setPullResult] = useState<{ success: boolean; message: string } | null>(null);

  const urlExp = getUrlExplanation(sheetUrl);

  const handleSave = () => {
    onUpdateConfig({
      ...config,
      sheetUrl: sheetUrl.trim()
    });
    setTestResult(null); // Reset when URL changes
    alert("URL Google Apps Script berhasil disimpan. Silahkan lakukan 'Uji Koneksi'!");
  };

  const handleTestConnection = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await onTestConnection();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Gagal menguji koneksi." });
    } finally {
      setTestLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const res = await onSyncAllData();
      setSyncResult(res);
    } catch (err: any) {
      setSyncResult({ success: false, message: err.message || "Gagal melakukan sinkronisasi." });
    } finally {
      setSyncLoading(false);
    }
  };

  const handlePull = async () => {
    if (!onPullAllData) return;
    const confirmChoice = window.confirm("PENTING: Menarik data dari Google Sheets akan menimpa seluruh database lokal Anda saat ini. Jika spreadsheet kosong, data lokal juga akan dikosongkan. Lanjutkan?");
    if (!confirmChoice) return;
    
    setPullLoading(true);
    setPullResult(null);
    try {
      const res = await onPullAllData();
      setPullResult(res);
    } catch (err: any) {
      setPullResult({ success: false, message: err.message || "Gagal menarik data." });
    } finally {
      setPullLoading(false);
    }
  };

  const scriptCodeTemplate = `/**
 * GOOGLE APPS SCRIPT DATABASE ENDPOINT (AUTOMATED)
 * -------------------------------------------------------------
 * Panduan Penggunaan:
 * 1. Buka Google Sheet BARU yang kosong (beri judul bebas, misal "Database Kasir Sekolah").
 *    *(TIPS: Anda TIDAK PERLU membuat tab/sheet sendiri, Apps Script ini secara otomatis
 *    akan membuat tab "Siswa", "Transaksi", "Biaya", dan "Logs" beserta judul kolomnya).*
 * 2. Masuk ke: Ekstensi > Apps Script.
 * 3. Hapus kode bawaan dan tempel kode lengkap di bawah ini.
 * 4. Klik Simpan (ikon disket), lalu klik "Terapkan" > "Penerapan Baru".
 * 5. Pilih Jenis: "Aplikasi Web" (Web App).
 * 6. Konfigurasi: 
 *    - Jalankan sebagai: "Diri Anda sendiri".
 *    - Siapa yang memiliki akses: "Siapa saja" (Anyone).
 * 7. Klik Terapkan, beri izin Otorisasi, lalu salin "URL Aplikasi Web" Anda.
 * 8. Tempelkan URL tersebut ke kolom integrasi di aplikasi kasir ini!
 */

// Kosongkan atau masukkan ID Sheet bersangkutan jika tidak mempan (opsional)
var SHEET_ID = ""; 

function doGet(e) {
  var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sheetSiswa = getOrCreateSheet(ss, "Siswa");
  var sheetTransaksi = getOrCreateSheet(ss, "Transaksi");
  var sheetBiaya = getOrCreateSheet(ss, "Biaya");
  var sheetLogs = getOrCreateSheet(ss, "Logs");
  
  // Bersihkan lembar default kosong bawaan Google Sheets jika ada
  deleteDefaultSheet(ss);
  
  var siswaData = getRowsData(sheetSiswa);
  var transaksiData = getRowsData(sheetTransaksi);
  var biayaData = getRowsData(sheetBiaya);
  var logsData = getRowsData(sheetLogs);
  
  var response = {
    siswa: siswaData,
    transaksi: transaksiData,
    biaya: biayaData,
    logs: logsData
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sheetSiswa = getOrCreateSheet(ss, "Siswa");
  var sheetTransaksi = getOrCreateSheet(ss, "Transaksi");
  var sheetBiaya = getOrCreateSheet(ss, "Biaya");
  var sheetLogs = getOrCreateSheet(ss, "Logs");
  
  // Bersihkan lembar default kosong bawaan Google Sheets jika ada
  deleteDefaultSheet(ss);
  
  var postData = JSON.parse(e.postData.contents);
  var action = postData.action;
  
  if (action === "save_transaction") {
    var trx = postData.transaction;
    
    // 1. Tambah baris transaksi baru
    sheetTransaksi.appendRow([
      trx.id,
      trx.siswaId,
      trx.siswaNis,
      trx.siswaNama,
      trx.siswaKelas,
      trx.tanggal,
      trx.jenisPembayaran,
      trx.bulanCovered || "",
      trx.jumlah,
      trx.metode,
      trx.keterangan,
      trx.penerima
    ]);
    
    // 2. Update status SPP Siswa jika jenisPembayaran = 'SPP'
    if (trx.jenisPembayaran === "SPP" && trx.bulanCovered) {
      updateSiswaSppStatus(sheetSiswa, trx.siswaId, trx.bulanCovered, "Lunas");
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Transaksi berhasil dicatat ke Google Sheets!" }))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === "sync_biaya") {
    var biayaList = postData.biaya;
    updateAllBiaya(sheetBiaya, biayaList);
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Definisi Biaya berhasil disinkronisasi ke Google Sheets!" }))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === "save_log") {
    var log = postData.log;
    sheetLogs.appendRow([
      log.id,
      log.siswaId,
      log.siswaNama,
      log.tipe,
      log.kontakTujuan,
      log.pesan,
      log.tanggalKirim,
      log.status
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Log Notifikasi berhasil dicatat ke Google Sheets!" }))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === "sync_all") {
    // Sinkronisasi penuh seluruh data, timpa sheets
    var siswaList = postData.siswa;
    updateAllSiswa(sheetSiswa, siswaList);
    
    if (postData.transaksi) {
      updateAllTransaksi(sheetTransaksi, postData.transaksi);
    }
    if (postData.biaya) {
      updateAllBiaya(sheetBiaya, postData.biaya);
    }
    if (postData.logs) {
      updateAllLogs(sheetLogs, postData.logs);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Database Sekolah berhasil disinkronisasi penuh ke Google Sheets!" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Aksi tidak dikenal" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- HELPER FUNCTIONS ---

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  
  if (sheet.getLastRow() === 0) {
    // Masukkan baris judul header berdasarkan skema secara otomatis jika sheet baru/kosong
    if (name === "Siswa") {
      sheet.appendRow(["id", "nis", "nama", "kelas", "angkatan", "tagihanSpp", "emailOrangTua", "teleponOrangTua", "statusSppJson"]);
    } else if (name === "Transaksi") {
      sheet.appendRow(["id", "siswaId", "siswaNis", "siswaNama", "siswaKelas", "tanggal", "jenisPembayaran", "bulanCovered", "jumlah", "metode", "keterangan", "penerima"]);
    } else if (name === "Biaya") {
      sheet.appendRow(["id", "nama", "kategori", "jumlah", "tenggatWaktu"]);
    } else if (name === "Logs") {
      sheet.appendRow(["id", "siswaId", "siswaNama", "tipe", "kontakTujuan", "pesan", "tanggalKirim", "status"]);
    }
  }
  return sheet;
}

function deleteDefaultSheet(ss) {
  var sheets = ss.getSheets();
  if (sheets.length > 1) {
    for (var i = 0; i < sheets.length; i++) {
      var name = sheets[i].getName();
      // Deteksi sheet kosong default bawaan Spreadsheet baru seperti "Sheet1", "Sheet 1", "Lembar1", atau "Lembar 1"
      if ((name === "Sheet1" || name === "Sheet 1" || name === "Lembar1" || name === "Lembar 1") && sheets[i].getLastRow() === 0) {
        try {
          ss.deleteSheet(sheets[i]);
        } catch (e) {
          // Abaikan jika gagal
        }
      }
    }
  }
}

function getRowsData(sheet) {
  var range = sheet.getDataRange();
  var values = range.getValues();
  if (values.length <= 1) return [];
  
  var headers = values[0];
  var data = [];
  
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var headerName = headers[j];
      var cellValue = row[j];
      
      // Khusus untuk field dictionary status SPP di kolom Siswa
      if (headerName === "statusSppJson") {
        try {
          obj["statusSpp"] = cellValue ? JSON.parse(cellValue) : {};
        } catch (err) {
          obj["statusSpp"] = {};
        }
      } else {
        obj[headerName] = cellValue;
      }
    }
    data.push(obj);
  }
  return data;
}

function updateSiswaSppStatus(sheet, siswaId, bulanKey, newStatus) {
  var range = sheet.getDataRange();
  var values = range.getValues();
  if (values.length <= 1) return;
  
  var headers = values[0];
  var idColIdx = headers.indexOf("id");
  var statusColIdx = headers.indexOf("statusSppJson");
  
  if (idColIdx === -1 || statusColIdx === -1) return;
  
  for (var i = 1; i < values.length; i++) {
    if (values[i][idColIdx] === siswaId) {
      var statusJsonStr = values[i][statusColIdx] || "{}";
      var statusObj = {};
      try {
        statusObj = JSON.parse(statusJsonStr);
      } catch(e) {}
      
      if (bulanKey.indexOf(",") !== -1) {
        var keys = bulanKey.split(",");
        for (var k = 0; k < keys.length; k++) {
          var key = keys[k].trim();
          if (key) {
            statusObj[key] = newStatus;
          }
        }
      } else {
        statusObj[bulanKey] = newStatus;
      }
      sheet.getRange(i + 1, statusColIdx + 1).setValue(JSON.stringify(statusObj));
      break;
    }
  }
}

function updateAllSiswa(sheet, siswaList) {
  sheet.clear();
  sheet.appendRow(["id", "nis", "nama", "kelas", "angkatan", "tagihanSpp", "emailOrangTua", "teleponOrangTua", "statusSppJson"]);
  
  for (var i = 0; i < siswaList.length; i++) {
    var s = siswaList[i];
    sheet.appendRow([
      s.id,
      s.nis,
      s.nama,
      s.kelas,
      s.angkatan,
      s.tagihanSpp,
      s.emailOrangTua || "-",
      s.teleponOrangTua || "-",
      JSON.stringify(s.statusSpp)
    ]);
  }
}

function updateAllBiaya(sheet, biayaList) {
  sheet.clear();
  sheet.appendRow(["id", "nama", "kategori", "jumlah", "tenggatWaktu"]);
  for (var i = 0; i < biayaList.length; i++) {
    var b = biayaList[i];
    sheet.appendRow([b.id, b.nama, b.kategori, b.jumlah, b.tenggatWaktu]);
  }
}

function updateAllTransaksi(sheet, transaksiList) {
  sheet.clear();
  sheet.appendRow(["id", "siswaId", "siswaNis", "siswaNama", "siswaKelas", "tanggal", "jenisPembayaran", "bulanCovered", "jumlah", "metode", "keterangan", "penerima"]);
  for (var i = 0; i < transaksiList.length; i++) {
    var t = transaksiList[i];
    sheet.appendRow([
      t.id, t.siswaId, t.siswaNis, t.siswaNama, t.siswaKelas, t.tanggal, t.jenisPembayaran, t.bulanCovered || "", t.jumlah, t.metode, t.keterangan || "", t.penerima || ""
    ]);
  }
}

function updateAllLogs(sheet, logsList) {
  sheet.clear();
  sheet.appendRow(["id", "siswaId", "siswaNama", "tipe", "kontakTujuan", "pesan", "tanggalKirim", "status"]);
  for (var i = 0; i < logsList.length; i++) {
    var l = logsList[i];
    sheet.appendRow([
      l.id, l.siswaId, l.siswaNama, l.tipe, l.kontakTujuan, l.pesan, l.tanggalKirim, l.status
    ]);
  }
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(scriptCodeTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in text-sm text-slate-100">
      
      {/* Configuration Input section */}
      <div className="glass glass-card p-6 rounded-2xl space-y-4">
        
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div>
            <h3 className="font-bold text-white text-base">Konfigurasi Database Google Sheet</h3>
            <p className="text-xs text-slate-350 mt-0.5">Integrasikan data transaksi lokal dengan baris Google Sheet via Google Apps Script</p>
          </div>
          
          <div className="flex items-center gap-1.5 self-start">
            <span className="text-xs font-semibold text-slate-400">Status Gateway:</span>
            {connectionStatus === 'connected' ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md shadow-emerald-500/5">
                <CheckCircle className="size-3.5" /> Terkoneksi
              </span>
            ) : connectionStatus === 'testing' ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-450 border border-blue-500/20 animate-pulse">
                Menguji...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-450 border border-amber-500/20">
                <AlertTriangle className="size-3.5" /> Demo Lokal (Offline)
              </span>
            )}
          </div>
        </div>

        {/* URL Inputs */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
            <Link2 className="size-4 text-slate-400" />
            URL Web App Google Apps Script
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="flex-1 px-3.5 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/10 placeholder:text-slate-400"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold text-xs rounded-xl shadow-lg border border-blue-400/20 cursor-pointer text-center whitespace-nowrap active:transform active:scale-[0.98] transition-all"
              >
                Simpan URL
              </button>
              <button
                disabled={!config.sheetUrl || connectionStatus === 'testing' || testLoading}
                onClick={handleTestConnection}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold text-xs rounded-xl cursor-pointer flex items-center gap-1 disabled:opacity-50 active:transform active:scale-[0.98] transition-all"
              >
                <RefreshCw className={`size-3.5 ${connectionStatus === 'testing' || testLoading ? 'animate-spin' : ''}`} />
                Uji Koneksi
              </button>
            </div>
          </div>

          {/* Real-time URL format advisor card */}
          <div className={`p-3 rounded-xl border flex gap-2.5 text-xs transition-all duration-300 leading-relaxed max-w-xl ${
            urlExp.type === 'success' 
              ? "bg-emerald-500/5 border-emerald-500/10 text-slate-300"
              : urlExp.type === 'error'
              ? "bg-red-500/10 border-red-500/20 text-red-300"
              : "bg-slate-500/10 border-slate-500/10 text-slate-300"
          }`}>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 font-bold text-[10.5px] uppercase tracking-wider">
                <span className={`inline-block size-2 rounded-full ${
                  urlExp.type === 'success' ? "bg-emerald-450 animate-pulse" : urlExp.type === 'error' ? "bg-red-400 animate-pulse" : "bg-amber-400"
                }`} />
                {urlExp.label}
              </div>
              <p className="text-[11px] text-slate-300">{urlExp.text}</p>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed max-w-xl pt-1">
            * Apabila dikosongkan, aplikasi akan berjalan dalam mode offline (menyimpan data di memori browser lokal/localStorage). Integrasi dapat diisi kapan saja setelah script dideploy.
          </p>

          {testResult && (
            <div className={`p-4 rounded-xl border flex gap-3 text-xs leading-relaxed max-w-xl animate-fade-in ${
              testResult.success 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" 
                : "bg-red-500/10 border-red-500/20 text-red-300"
            }`}>
              {testResult.success ? <CheckCircle className="size-4 shrink-0 text-emerald-400 mt-0.5" /> : <AlertTriangle className="size-4 shrink-0 text-red-405 mt-0.5" />}
              <div className="flex flex-col gap-1 w-full">
                <span className="font-bold uppercase tracking-wider text-[10.5px]">
                  {testResult.success ? "Koneksi Berhasil" : "Koneksi Gagal"}
                </span>
                <span>{testResult.message}</span>

                {!testResult.success && (
                  <div className="mt-3 pt-3 border-t border-red-500/15 text-red-300 text-[11px] space-y-2">
                    <p className="font-bold uppercase tracking-wider text-[9.5px] text-red-200">Panduan Mengatasi Error Koneksi Google Sheet:</p>
                    <ul className="list-decimal pl-4 space-y-1.5 text-slate-300 leading-relaxed">
                      <li>
                        <strong className="text-red-200">Sistem Otomatis:</strong> Aplikasi ini secara otomatis mendeteksi dan membuat seluruh sheet tab (<span className="font-mono bg-white/10 px-1 py-0.5 rounded text-white font-bold">Siswa</span>, <span className="font-mono bg-white/10 px-1 py-0.5 rounded text-white font-bold">Transaksi</span>, <span className="font-mono bg-white/10 px-1 py-0.5 rounded text-white font-bold">Biaya</span>, dan <span className="font-mono bg-white/10 px-1 py-0.5 rounded text-white font-bold">Logs</span>). Anda tidak perlu membuatnya sendiri. Apabila sebelumnya Anda membuat tab manual dengan nama/kapitalisasi yang salah, hapus saja tab tersebut dan biarkan script ini yang membuatnya secara otomatis.
                      </li>
                      <li>
                        <strong className="text-red-200">Pastikan Akses "Siapa Saja":</strong> Masuk kembali ke editor Apps Script Anda, klik tombol biru <strong>Terapkan (Deploy) &gt; Kelola Penerapan (Manage Deployments) &gt; Edit (ikon pensil)</strong>. Pastikan setelan diisi:
                        <ul className="list-disc pl-4 mt-1 text-[10px] text-slate-400">
                          <li>Jalankan sebagai (Execute as): <strong>Diri Anda sendiri (Me / akun Google Anda)</strong></li>
                          <li>Siapa yang memiliki akses (Who has access): <strong>Siapa Saja (Anyone / Anyone even anonymous)</strong></li>
                        </ul>
                      </li>
                      <li>
                        <strong className="text-red-200">Gunakan Versi Baru:</strong> Di Google Apps Script, setiap ada perubahan konfigurasi atau kode, Anda <strong className="text-red-200">WAJIB</strong> memilih opsi <strong>"Versi: Baru" (New Version)</strong> dalam dropdown versi saat menerapkan ulang agar perubahan tersimpan dan link update bekerja.
                      </li>
                      <li>
                        <strong className="text-red-200">Gunakan URL Aplikasi Web, bukan URL Editor:</strong> Pastikan tautan yang Anda simpan di atas berakhiran <span className="font-mono bg-white/10 px-1 text-white">/exec</span>, bukan <span className="font-mono bg-white/10 px-1 text-white">/edit</span> atau URL Google Spreadsheet.
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sync panel */}
        {config.sheetUrl && (
          <div className="border-t border-white/5 pt-5 space-y-4">
            <div className="flex items-center gap-2">
              <Database className="size-4.5 text-blue-450" />
              <h4 className="font-bold text-white text-xs text-left">Sinkronisasi Database Manual</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
              Gunakan kontrol di bawah untuk mengirim data lokal ke Google Sheet ("Unggah") atau menarik data terbaru dari Google Sheet ("Tarik") untuk menyelaraskan catatan.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                disabled={syncLoading}
                onClick={handleSync}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-colors border border-emerald-400/20 shadow-lg shadow-emerald-500/10 cursor-pointer flex items-center gap-1.5 active:transform active:scale-[0.98] w-full sm:w-auto justify-center"
              >
                <RefreshCw className={`size-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
                Unggah Katalog Siswa ke Google Sheet
              </button>

              {onPullAllData && (
                <button
                  disabled={pullLoading}
                  onClick={handlePull}
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition-colors border border-sky-500/20 shadow-lg shadow-sky-600/10 cursor-pointer flex items-center gap-1.5 active:transform active:scale-[0.98] w-full sm:w-auto justify-center"
                >
                  <RefreshCw className={`size-3.5 ${pullLoading ? 'animate-spin' : ''}`} />
                  Tarik Seluruh Data dari Google Sheet
                </button>
              )}
            </div>

            {syncResult && (
              <div className={`p-3 rounded-xl border flex gap-2 text-xs leading-relaxed max-w-xl animate-fade-in ${
                syncResult.success 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" 
                  : "bg-red-500/10 border-red-500/20 text-red-300"
              }`}>
                {syncResult.success ? <CheckCircle className="size-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="size-4 shrink-0 text-red-400" />}
                <span>
                  {syncResult.success ? <strong className="font-bold">Berhasil: </strong> : <strong className="font-bold">Gagal: </strong>}
                  {syncResult.message}
                </span>
              </div>
            )}

            {pullResult && (
              <div className={`p-3 rounded-xl border flex gap-2 text-xs leading-relaxed max-w-xl animate-fade-in ${
                pullResult.success 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" 
                  : "bg-red-500/10 border-red-500/20 text-red-300"
              }`}>
                {pullResult.success ? <CheckCircle className="size-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="size-4 shrink-0 text-red-400" />}
                <span>
                  {pullResult.success ? <strong className="font-bold">Berhasil: </strong> : <strong className="font-bold">Gagal: </strong>}
                  {pullResult.message}
                </span>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Guide steps and Code Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Step Guide (4/12 width) */}
        <div className="lg:col-span-4 glass glass-card p-5 rounded-2xl space-y-4">
          <div className="flex items-center gap-1.5">
            <Info className="size-4.5 text-blue-400" />
            <h4 className="font-bold text-white text-xs">Langkah Deploy Script</h4>
          </div>

          <ol className="space-y-4 text-xs text-slate-200 list-decimal pl-4">
            <li className="leading-relaxed">
              Buat sebuah <b>Google Sheet BARU yang kosong</b>. *(Anda <b>TIDAK PERLU</b> repot membuat tab Siswa/Transaksi atau mengetik judul kolom sendiri secara manual. Script di samping akan <b>membuat semua tab & kolom secara 100% otomatis</b> untuk mencegah kesalahan ketik).*
            </li>
            <li className="leading-relaxed">
              Klik menu <b>Ekstensi</b> {`>`} <b>Apps Script</b> dari menu bagian atas spreadsheet baru tersebut.
            </li>
            <li className="leading-relaxed">
              Salin kode template Apps Script di samping ini (Gunakan tombol Salin), lalu tempelkan sepenuhnya di editor Apps Script Anda.
            </li>
            <li className="leading-relaxed">
              Simpan proyek, lalu klik tombol biru <b>Terapkan {`>`} Penerapan Baru</b> di kanan atas editor.
            </li>
            <li className="leading-relaxed">
              Klik ikon gerigi di sebelah "Pilih Jenis", pilih <b>Aplikasi Web</b>.
            </li>
            <li className="leading-relaxed">
              Pilih opsi:
              <ul className="list-disc pl-4 mt-1 space-y-1 text-[11px] text-slate-350">
                <li>Jalankan sebagai: <b>Diri Anda Sendiri</b></li>
                <li>Siapa yang memiliki akses: <b>Siapa Saja</b></li>
              </ul>
            </li>
            <li className="leading-relaxed">
              Klik <b>Terapkan</b> (Deploy). Klik izin otorisasi untuk akun Google Anda (Anda akan mendapatkan peringatan aman, klik Advanced/Lanjutan {`>`} Go to Untitled Project/Pergi ke Proyek).
            </li>
            <li className="leading-relaxed">
              Salin <b>Aplikasi Web URL</b> yang disediakan, lalu tempelkan di input di atas, lalu klik <b>Simpan</b>.
            </li>
          </ol>
        </div>

        {/* Code panel (8/12 width) */}
        <div 
          style={{ backgroundColor: '#0f172a', borderColor: '#334155' }} 
          className="lg:col-span-8 rounded-2xl border shadow-2xl overflow-hidden flex flex-col h-[400px]"
        >
          <div 
            style={{ backgroundColor: '#1e293b', borderBottomColor: '#334155' }} 
            className="px-4 py-2.5 border-b flex justify-between items-center text-xs"
          >
            <span style={{ color: '#cbd5e1' }} className="font-semibold font-mono text-[11px]">google_sheets_connector.js</span>
            <button
              onClick={copyToClipboard}
              style={{ color: '#34d399', backgroundColor: 'rgba(52, 211, 153, 0.1)', borderColor: 'rgba(52, 211, 153, 0.2)' }}
              className="flex items-center gap-1 text-[10px] font-bold hover:bg-emerald-500/20 transform active:scale-95 transition-all px-2.5 py-1 rounded cursor-pointer border"
            >
              <Copy className="size-3" />
              {copied ? "Tersalin!" : "Salin Kode"}
            </button>
          </div>
          <div 
            style={{ backgroundColor: '#090d16', color: '#e2e8f0' }} 
            className="p-4 overflow-auto flex-1 font-mono text-[11px] leading-relaxed font-semibold"
          >
            <pre style={{ color: '#e2e8f0' }}>{scriptCodeTemplate}</pre>
          </div>
        </div>

      </div>

    </div>
  );
}
