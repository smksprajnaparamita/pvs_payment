/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Siswa, Transaksi, AppConfig, BiayaSekolah, NotifikasiLog } from "./types";
import { SEED_SISWA, SEED_TRANSAKSI } from "./seedData";
import { formatRupiah, normalizePhoneNumber } from "./utils";

import DashboardView from "./components/DashboardView";
import PaymentView from "./components/PaymentView";
import StudentsView from "./components/StudentsView";
import ReportsView from "./components/ReportsView";
import SheetIntegrationView from "./components/SheetIntegrationView";
import ReceiptView from "./components/ReceiptView";
import SchoolFeesView from "./components/SchoolFeesView";
import NotificationView from "./components/NotificationView";
import LoginView from "./components/LoginView";

import { 
  Building2, 
  Home, 
  Coins, 
  Users, 
  FileText, 
  Settings, 
  HelpCircle,
  LogOut,
  AlertTriangle,
  Sliders,
  Calendar,
  X,
  Clock,
  Database,
  Tag,
  Bell,
  Sun,
  Moon
} from "lucide-react";

export default function App() {
  
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'payment' | 'students' | 'fees' | 'notifications' | 'reports' | 'integration'>('dashboard');
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [transaksiList, setTransaksiList] = useState<Transaksi[]>([]);
  const [biayaList, setBiayaList] = useState<BiayaSekolah[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotifikasiLog[]>([]);
  const [config, setConfig] = useState<AppConfig>({
    sheetUrl: "",
    namaSekolah: "SMA Nusantara Mandiri",
    alamatSekolah: "Jl. Diponegoro No. 45, Coblong, Kota Bandung, Jawa Barat",
    teleponSekolah: "(022) 250-1234",
    penerimaDefault: "Alya Safitri (Bendahara)",
    namaBank: "Bank Syariah Indonesia (BSI)",
    rekeningBank: "7123456789",
    pemilikRekening: "Bendahara SMA Nusantara Mandiri",
    namaKepalaSekolah: "Drs. H. Mulyadi",
    nipKepalaSekolah: "196805121993021003"
  });

  const [activeReceipt, setActiveReceipt] = useState<Transaksi | null>(null);
  const [selectedSiswaIdForPayment, setSelectedSiswaIdForPayment] = useState<string | undefined>(undefined);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing'>('disconnected');
  const [backgroundSyncActive, setBackgroundSyncActive] = useState<boolean>(false);
  const [backgroundSyncStatus, setBackgroundSyncStatus] = useState<string>("");
  const [schoolSettingsOpen, setSchoolSettingsOpen] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    const cachedVal = localStorage.getItem("KAS_SEKOLAH_THEME");
    return cachedVal === "dark"; // Default is false (light mode, white background)
  });
  
  const isThemeMounted = useRef(false);

  useEffect(() => {
    localStorage.setItem("KAS_SEKOLAH_THEME", isDark ? "dark" : "light");
    if (isThemeMounted.current) {
      if (config.sheetUrl) {
        saveGlobalSettings(config, undefined, undefined, isDark ? "dark" : "light");
      }
    } else {
      isThemeMounted.current = true;
    }
  }, [isDark]);

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem("KAS_SEKOLAH_LOGGED_IN") === "true";
  });
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  // General settings modal state
  const [setOpenNama, setSetOpenNama] = useState("");
  const [setOpenAlamat, setSetOpenAlamat] = useState("");
  const [setOpenTelepon, setSetOpenTelepon] = useState("");
  const [setOpenPenerima, setSetOpenPenerima] = useState("");
  const [setOpenNamaBank, setSetOpenNamaBank] = useState("");
  const [setOpenRekeningBank, setSetOpenRekeningBank] = useState("");
  const [setOpenPemilikRekening, setSetOpenPemilikRekening] = useState("");
  const [setOpenMerchantId, setSetOpenMerchantId] = useState("");
  const [setOpenLogo, setSetOpenLogo] = useState("");
  const [setOpenNamaKepala, setSetOpenNamaKepala] = useState("");
  const [setOpenNipKepala, setSetOpenNipKepala] = useState("");
  const [setOpenUsername, setSetOpenUsername] = useState("");
  const [setOpenPassword, setSetOpenPassword] = useState("");

  const saveGlobalSettings = async (
    targetConfig: AppConfig,
    username?: string,
    password?: string,
    theme?: string
  ) => {
    const currentUsername = username !== undefined ? username : (localStorage.getItem("KAS_SEKOLAH_USER") || "admin");
    const currentPassword = password !== undefined ? password : (localStorage.getItem("KAS_SEKOLAH_PASS") || "admin123");
    const currentTheme = theme !== undefined ? theme : (isDark ? "dark" : "light");

    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: targetConfig,
          auth: { username: currentUsername, password: currentPassword },
          theme: currentTheme
        })
      });
    } catch (err) {
      console.log("[Server Settings Status] Local state persisted, server sync status:", err instanceof Error ? err.message : err);
    }
  };

  const saveGlobalDatabaseOnServer = async (
    targetSiswa?: Siswa[],
    targetTransaksi?: Transaksi[],
    targetBiaya?: BiayaSekolah[],
    targetLogs?: NotifikasiLog[]
  ) => {
    try {
      const finalSiswa = targetSiswa !== undefined ? targetSiswa : siswaList;
      const finalTrx = targetTransaksi !== undefined ? targetTransaksi : transaksiList;
      const finalBiaya = targetBiaya !== undefined ? targetBiaya : biayaList;
      const finalLogs = targetLogs !== undefined ? targetLogs : notificationLogs;

      await fetch("/api/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siswa: finalSiswa,
          transaksi: finalTrx,
          biaya: finalBiaya,
          logs: finalLogs
        })
      });
    } catch (err) {
      console.log("[Server DB Status] Local DB updated, server backup sync status:", err instanceof Error ? err.message : err);
    }
  };

  // --- INITIAL DATA LOAD & RE-SYNC ---
  useEffect(() => {
    // 1. Get cached config
    const cachedConfig = localStorage.getItem("KAS_SEKOLAH_CONFIG");
    let currentConfig = config;
    if (cachedConfig) {
      try {
        const parsed = JSON.parse(cachedConfig);
        setConfig(parsed);
        currentConfig = parsed;
      } catch (e) {}
    }

    // 2. Get cached students or fall back
    const cachedSiswa = localStorage.getItem("KAS_SEKOLAH_SISWA");
    let initialSiswa = SEED_SISWA.map(s => ({
      ...s,
      teleponOrangTua: normalizePhoneNumber(s.teleponOrangTua)
    }));
    if (cachedSiswa) {
      try {
        const parsed = JSON.parse(cachedSiswa);
        if (Array.isArray(parsed)) {
          initialSiswa = parsed.map(s => ({
            ...s,
            teleponOrangTua: normalizePhoneNumber(s.teleponOrangTua)
          }));
        }
      } catch (e) {}
    }
    setSiswaList(initialSiswa);

    // 3. Get cached transactions or fall back
    const cachedTrx = localStorage.getItem("KAS_SEKOLAH_TRANSAKSI");
    let initialTrx = SEED_TRANSAKSI;
    if (cachedTrx) {
      try {
        initialTrx = JSON.parse(cachedTrx);
      } catch (e) {}
    }
    setTransaksiList(initialTrx);

    // 4. Get cached defined fees or fall back
    const cachedBiaya = localStorage.getItem("KAS_SEKOLAH_BIAYA");
    let initialBiaya: BiayaSekolah[] = [
      { id: "biaya-1", nama: "Iuran SPP Bulanan SMA Kelas X", kategori: "SPP", jumlah: 350000, tenggatWaktu: "2026-06-10" },
      { id: "biaya-2", nama: "Sumbangan Sarana Prasana (Uang Gedung)", kategori: "Uang Gedung", jumlah: 1500000, tenggatWaktu: "2026-06-30" },
      { id: "biaya-3", nama: "Pengadaan Seragam Olahraga & Almamater", kategori: "Seragam", jumlah: 650000, tenggatWaktu: "2026-06-15" },
      { id: "biaya-4", nama: "Iuran Kegiatan Study Tour Mandiri", kategori: "Kegiatan", jumlah: 200000, tenggatWaktu: "2026-06-25" }
    ];
    if (cachedBiaya) {
      try {
        initialBiaya = JSON.parse(cachedBiaya);
      } catch (e) {}
    }
    setBiayaList(initialBiaya);

    // 5. Get cached notification logs or fall back
    const cachedLogs = localStorage.getItem("KAS_SEKOLAH_LOGS");
    let initialLogs: NotifikasiLog[] = [];
    if (cachedLogs) {
      try {
        initialLogs = JSON.parse(cachedLogs);
      } catch (e) {}
    }
    setNotificationLogs(initialLogs);

    // 6. Async load backend server settings and background sync from Google Sheet url
    const loadAndSyncBackground = async () => {
      let activeSheetUrl = currentConfig.sheetUrl;
      let activeSiswa = initialSiswa;
      let activeTrx = initialTrx;
      let activeBiaya = initialBiaya;
      let activeLogs = initialLogs;
      
      try {
        setBackgroundSyncActive(true);
        setBackgroundSyncStatus("Menghubungkan ke server...");
        
        // Load Settings
        const res = await fetch("/api/settings");
        if (res.ok) {
          const body = await res.json();
          if (body.success && body.data) {
            console.log("[Settings Sync] Server settings loaded successfully:", body.data);
            const { config: serverConfig, auth, theme } = body.data;
            
            if (serverConfig) {
              setConfig(serverConfig);
              localStorage.setItem("KAS_SEKOLAH_CONFIG", JSON.stringify(serverConfig));
              activeSheetUrl = serverConfig.sheetUrl;
            }

            if (auth) {
              if (auth.username) localStorage.setItem("KAS_SEKOLAH_USER", auth.username);
              if (auth.password) localStorage.setItem("KAS_SEKOLAH_PASS", auth.password);
            }

            if (theme) {
              setIsDark(theme === "dark");
              localStorage.setItem("KAS_SEKOLAH_THEME", theme);
            }
          }
        }
      } catch (err) {
        console.log("[Server Settings Status] Initial fetch local settings:", err instanceof Error ? err.message : err);
      }

      // Load Database from server
      try {
        setBackgroundSyncStatus("Sinkronisasi database...");
        const dbRes = await fetch("/api/database");
        if (dbRes.ok) {
          const dbBody = await dbRes.json();
          if (dbBody.success && dbBody.data) {
            const { siswa, transaksi, biaya, logs } = dbBody.data;
            if (siswa) {
              const normalizedSiswa = (siswa || []).map((s: any) => ({
                ...s,
                teleponOrangTua: normalizePhoneNumber(s.teleponOrangTua)
              }));
              setSiswaList(normalizedSiswa);
              localStorage.setItem("KAS_SEKOLAH_SISWA", JSON.stringify(normalizedSiswa));
              activeSiswa = normalizedSiswa;
            }
            if (transaksi) {
              setTransaksiList(transaksi);
              localStorage.setItem("KAS_SEKOLAH_TRANSAKSI", JSON.stringify(transaksi));
              activeTrx = transaksi;
            }
            if (biaya) {
              setBiayaList(biaya);
              localStorage.setItem("KAS_SEKOLAH_BIAYA", JSON.stringify(biaya));
              activeBiaya = biaya;
            }
            if (logs) {
              setNotificationLogs(logs);
              localStorage.setItem("KAS_SEKOLAH_LOGS", JSON.stringify(logs));
              activeLogs = logs;
            }
            console.log("[Database Sync] Server database loaded successfully in background.");
          }
        }
      } catch (dbErr) {
        console.log("[Server DB Status] Initial fetch local DB backup status:", dbErr instanceof Error ? dbErr.message : dbErr);
      }

      if (activeSheetUrl) {
        setBackgroundSyncStatus("Menghubungkan ke Google Sheets...");
        try {
          const syncRes = await testSheetConnection(
            activeSheetUrl,
            activeSiswa,
            activeTrx,
            activeBiaya,
            activeLogs,
            true
          );
          if (syncRes.success) {
            setBackgroundSyncStatus("Sinkronisasi Google Sheets berhasil!");
          } else {
            setBackgroundSyncStatus("Gagal menyinkronkan data.");
          }
        } catch (e) {
          console.log("[Sheets Sync status] Background sync issue (will retry):", e instanceof Error ? e.message : e);
          setBackgroundSyncStatus("Gagal menyambung ke Sheets.");
        }
      } else {
        setBackgroundSyncActive(false);
      }

      // Hide sync indicator automatically after delay
      setTimeout(() => {
        setBackgroundSyncActive(false);
      }, 4000);
    };

    loadAndSyncBackground();
  }, []);

  // Sync variables to localStorage when changed locally
  const saveLocalDatabaseState = (
    newSiswa: Siswa[],
    newTransaksi: Transaksi[],
    newBiaya?: BiayaSekolah[],
    newLogs?: NotifikasiLog[]
  ) => {
    const normalizedSiswa = (newSiswa || []).map((s) => ({
      ...s,
      teleponOrangTua: normalizePhoneNumber(s.teleponOrangTua)
    }));
    setSiswaList(normalizedSiswa);
    setTransaksiList(newTransaksi);
    localStorage.setItem("KAS_SEKOLAH_SISWA", JSON.stringify(normalizedSiswa));
    localStorage.setItem("KAS_SEKOLAH_TRANSAKSI", JSON.stringify(newTransaksi));
    
    if (newBiaya) {
      setBiayaList(newBiaya);
      localStorage.setItem("KAS_SEKOLAH_BIAYA", JSON.stringify(newBiaya));
    }
    if (newLogs) {
      setNotificationLogs(newLogs);
      localStorage.setItem("KAS_SEKOLAH_LOGS", JSON.stringify(newLogs));
    }

    saveGlobalDatabaseOnServer(
      normalizedSiswa,
      newTransaksi,
      newBiaya !== undefined ? newBiaya : biayaList,
      newLogs !== undefined ? newLogs : notificationLogs
    );
  };

  const saveLocalSiswa = (list: Siswa[]) => {
    const normalizedSiswa = (list || []).map((s) => ({
      ...s,
      teleponOrangTua: normalizePhoneNumber(s.teleponOrangTua)
    }));
    setSiswaList(normalizedSiswa);
    localStorage.setItem("KAS_SEKOLAH_SISWA", JSON.stringify(normalizedSiswa));
    saveGlobalDatabaseOnServer(normalizedSiswa);
  };

  const saveLocalTransaksi = (list: Transaksi[]) => {
    setTransaksiList(list);
    localStorage.setItem("KAS_SEKOLAH_TRANSAKSI", JSON.stringify(list));
    saveGlobalDatabaseOnServer(undefined, list);
  };

  const saveLocalConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    localStorage.setItem("KAS_SEKOLAH_CONFIG", JSON.stringify(newConfig));
    saveGlobalSettings(newConfig);
  };

  // --- GOOGLE SHEETS CONNECTION & SYNC ---
  const executeSheetsRequest = async (
    url: string,
    action: 'get' | 'post',
    payload?: any
  ): Promise<any> => {
    // 1. Coba lewat proxy local/Express (/api/proxy) terlebih dahulu
    try {
      const response = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url,
          action: action,
          payload: payload
        })
      });

      if (response.ok) {
        const text = await response.text();
        try {
          const json = JSON.parse(text);
          // Bila dibungkus proxy server.ts: { success: true, data: ... } atau memiliki success: true/false langsung
          if (json && (json.success === true || json.success === false || json.siswa || json.transaksi || json.data)) {
            return json;
          }
        } catch (e) {
          console.warn("Proxy JSON parse failed, falling back to direct client fetch", e);
        }
      } else {
        console.warn(`Proxy server returned non-200 status (${response.status}), falling back to direct fetch.`);
      }
    } catch (proxyError) {
      console.warn("Proxy request failed, falling back to direct client fetch", proxyError);
    }

    // 2. Fallback: Request langsung (CORS CLIENT-SIDE DIRECT FETCH) dari browser
    console.log(`[CORS Fallback] Melakukan koneksi langsung ke Google Apps Script: ${url}`);
    
    if (action === "get") {
      const response = await fetch(url, {
        method: "GET"
      });
      if (!response.ok) {
        throw new Error(`Koneksi langsung gagal dengan kode HTTP status: ${response.status}`);
      }
      const text = await response.text();
      try {
        const parsed = JSON.parse(text);
        // Samakan format dengan proxy `{ success: true, data: content }`
        return { success: true, data: parsed };
      } catch (parseErr) {
        if (text.includes("<!DOCTYPE") || text.includes("<html") || text.includes("The page c") || text.includes("Google Accounts")) {
          throw new Error("Google Apps Script mengembalikan halaman HTML/Login. Pastikan deployment Google Apps Script Anda diset ke Akses: 'Siapa saja (Anyone)' dan Dijalankan sebagai: 'Saya sendiri' (Me/akun Google Anda).");
        }
        throw new Error("Respon langsung dari Google Sheets Apps Script tidak berformat JSON valid.");
      }
    } else {
      // POST request
      // Gunakan Content-Type: text/plain agar browser menganggapnya sebagai "simple request"
      // untuk mencegah preflight OPTIONS request CORS yang sering gagal di server Apps Script
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain"
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`Koneksi langsung gagal dengan kode HTTP status: ${response.status}`);
      }
      const text = await response.text();
      try {
        const parsed = JSON.parse(text);
        return parsed; // Apps script POST mengembalikan { success: true, message: ... }
      } catch (parseErr) {
        if (text.includes("<!DOCTYPE") || text.includes("<html") || text.includes("The page c") || text.includes("Google Accounts")) {
          throw new Error("Google Apps Script mengembalikan halaman HTML/Login. Pastikan deployment Google Apps Script Anda diset ke Akses: 'Siapa saja (Anyone)' dan Dijalankan sebagai: 'Saya sendiri' (Me/akun Google Anda).");
        }
        throw new Error("Respon pasca-kirim langsung dari Google Sheets Apps Script tidak berformat JSON valid.");
      }
    }
  };

  const testSheetConnection = async (
    url: string = config.sheetUrl, 
    currentSiswa = siswaList, 
    currentTrx = transaksiList,
    currentBiaya = biayaList,
    currentLogs = notificationLogs,
    forceOverwriteEmpty = false
  ): Promise<{ success: boolean; message: string }> => {
    if (!url) return { success: false, message: "URL Google Apps Script kosong atau belum diset." };
    setConnectionStatus('testing');
    
    try {
      const body = await executeSheetsRequest(url, "get");

      if (body.success && body.data) {
        setConnectionStatus('connected');
        console.log("[Sheets API Sync] Connected successfully!");
        
        // Merge state from sheets if records exist
        const sheetSiswa: Siswa[] = (body.data.siswa || []).map((s: any) => ({
          ...s,
          teleponOrangTua: normalizePhoneNumber(s.teleponOrangTua)
        }));
        const sheetTransaksi: Transaksi[] = body.data.transaksi || [];
        const sheetBiaya: BiayaSekolah[] = body.data.biaya || [];
        const sheetLogs: NotifikasiLog[] = body.data.logs || [];

        if (sheetSiswa.length > 0 || (forceOverwriteEmpty && body.data.siswa !== undefined)) {
          // Keep sheets list since sheet is source of truth
          setSiswaList(sheetSiswa);
          localStorage.setItem("KAS_SEKOLAH_SISWA", JSON.stringify(sheetSiswa));
        }
        
        if (sheetTransaksi.length > 0 || (forceOverwriteEmpty && body.data.transaksi !== undefined)) {
          setTransaksiList(sheetTransaksi);
          localStorage.setItem("KAS_SEKOLAH_TRANSAKSI", JSON.stringify(sheetTransaksi));
        }

        if (sheetBiaya.length > 0 || (forceOverwriteEmpty && body.data.biaya !== undefined)) {
          setBiayaList(sheetBiaya);
          localStorage.setItem("KAS_SEKOLAH_BIAYA", JSON.stringify(sheetBiaya));
        }

        if (sheetLogs.length > 0 || (forceOverwriteEmpty && body.data.logs !== undefined)) {
          setNotificationLogs(sheetLogs);
          localStorage.setItem("KAS_SEKOLAH_LOGS", JSON.stringify(sheetLogs));
        }
        return { success: true, message: "Koneksi ke Google Sheets berhasil terjalin dan seluruh records tersinkronisasi!" };
      } else {
        throw new Error(body.error || "Gagal menghubungi Apps Script.");
      }
    } catch (err: any) {
      console.log("[Sheets Sync status] Sync connection issue:", err?.message || err);
      setConnectionStatus('disconnected');
      return { success: false, message: err.message || "Gagal menghubungkan ke Google Apps Script." };
    }
  };

  // Sync manual upload to Google Sheet
  const handleUploadDataToSheet = async (): Promise<{ success: boolean; message: string }> => {
    if (!config.sheetUrl) {
      return { success: false, message: "URL Google Apps Script tidak diset!" };
    }

    try {
      const body = await executeSheetsRequest(config.sheetUrl, "post", {
        action: "sync_all",
        siswa: siswaList,
        transaksi: transaksiList,
        biaya: biayaList,
        logs: notificationLogs
      });

      if (body.success) {
        testSheetConnection(); // Refresh
        return { success: true, message: "Seluruh data siswa, transaksi, biaya, dan log notifikasi berhasil diselaraskan ke Google Sheets!" };
      } else {
        return { success: false, message: body.error || "Terjadi kesalahan respon server Google Sheets." };
      }
    } catch (err: any) {
      return { success: false, message: err.message || "Gagal menyelaraskan data ke Google Sheet." };
    }
  };

  // --- RECORD TRANSACTION (KASIR SUBMIT) ---
  const handleProcessPayment = async (newTransaction: Transaksi) => {
    // 1. Save local transaction list
    const updatedTrx = [...transaksiList, newTransaction];

    // 2. Update Student status locally
    const updatedSiswa = siswaList.map((s) => {
      if (s.id === newTransaction.siswaId) {
        const nextStatus = { ...s.statusSpp };
        // Lookup standard SPP tariff from biayaList (Manajemen Biaya)
        const sppBiayaItems = biayaList.filter(b => b.kategori === 'SPP');
        const sppTarif = sppBiayaItems.length > 0 ? sppBiayaItems[0].jumlah : s.tagihanSpp;

        if (newTransaction.jenisPembayaran === "SPP" && newTransaction.bulanCovered) {
          newTransaction.bulanCovered.split(",").forEach((m) => {
            const trimmed = m.trim();
            if (trimmed) {
              // Calculate total paid for this specific month from entire history, including this transaction
              const trxsForMonth = updatedTrx.filter(t => 
                t.siswaId === s.id && 
                t.jenisPembayaran === "SPP" && 
                t.bulanCovered && 
                t.bulanCovered.split(",").map(x => x.trim()).includes(trimmed)
              );
              const totalPaid = trxsForMonth.reduce((sum, t) => sum + t.jumlah, 0);
              
              if (totalPaid >= sppTarif) {
                nextStatus[trimmed] = "Lunas";
              } else if (totalPaid > 0) {
                nextStatus[trimmed] = `Kurang:${sppTarif - totalPaid}`;
              } else {
                nextStatus[trimmed] = "Belum_Bayar";
              }
            }
          });
        }
        return { ...s, statusSpp: nextStatus };
      }
      return s;
    });

    // Save both simultaneously to prevent stale state server overwrites
    saveLocalDatabaseState(updatedSiswa, updatedTrx);

    // 3. Trigger receipt view modal instantly
    setActiveReceipt(newTransaction);
    setSelectedSiswaIdForPayment(undefined); // Clear navigation parameter state

    // 4. Sync transaction row to Sheets Web App in background
    if (config.sheetUrl) {
      console.log("[Sheets Sync] Syncing row transaction in background...");
      executeSheetsRequest(config.sheetUrl, "post", {
        action: "save_transaction",
        transaction: newTransaction
      })
      .then((body) => {
        if (body.success) {
          console.log("[Sheets Sync] Succesfully apppended row to Sheets!");
          setConnectionStatus('connected');
        } else {
          console.log("[Sheets Sync status] Target status response:", body?.error);
        }
      })
      .catch((err) => {
        console.log("[Sheets Sync status] Sync connection issue:", err?.message || err);
      });
    }
  };

  // --- DELETE TRANSACTION (KASIR DELETE) ---
  const handleDeleteTransaction = async (id: string): Promise<{ success: boolean; message: string }> => {
    const trxToDelete = transaksiList.find(t => t.id === id);
    if (!trxToDelete) {
      return { success: false, message: "Transaksi tidak ditemukan." };
    }

    // 1. Save local transaction list
    const updatedTrx = transaksiList.filter((t) => t.id !== id);

    // 2. Update Student status locally
    const updatedSiswa = siswaList.map((s) => {
      if (s.id === trxToDelete.siswaId) {
        const nextStatus = { ...s.statusSpp };
        // Lookup standard SPP tariff from biayaList (Manajemen Biaya)
        const sppBiayaItems = biayaList.filter(b => b.kategori === 'SPP');
        const sppTarif = sppBiayaItems.length > 0 ? sppBiayaItems[0].jumlah : s.tagihanSpp;

        if (trxToDelete.jenisPembayaran === "SPP" && trxToDelete.bulanCovered) {
          trxToDelete.bulanCovered.split(",").forEach((m) => {
            const trimmed = m.trim();
            if (trimmed) {
              // Calculate total paid for this specific month from entire remaining history
              const trxsForMonth = updatedTrx.filter(t => 
                t.siswaId === s.id && 
                t.jenisPembayaran === "SPP" && 
                t.bulanCovered && 
                t.bulanCovered.split(",").map(x => x.trim()).includes(trimmed)
              );
              const totalPaid = trxsForMonth.reduce((sum, t) => sum + t.jumlah, 0);
              
              if (totalPaid >= sppTarif) {
                nextStatus[trimmed] = "Lunas";
              } else if (totalPaid > 0) {
                nextStatus[trimmed] = `Kurang:${sppTarif - totalPaid}`;
              } else {
                nextStatus[trimmed] = "Belum_Bayar";
              }
            }
          });
        }
        return { ...s, statusSpp: nextStatus };
      }
      return s;
    });
    
    // Save both simultaneously to prevent stale state server overwrites
    saveLocalDatabaseState(updatedSiswa, updatedTrx);

    // 3. Sync full database back to Google Sheets in background
    if (config.sheetUrl) {
      console.log("[Sheets Sync] Syncing updated database in background...");
      executeSheetsRequest(config.sheetUrl, "post", {
        action: "sync_all",
        siswa: updatedSiswa,
        transaksi: updatedTrx,
        biaya: biayaList,
        logs: notificationLogs
      })
      .then((body) => {
        if (body.success) {
          console.log("[Sheets Sync] Successfully synchronized updated database to Sheets!");
          setConnectionStatus('connected');
        } else {
          console.log("[Sheets Sync status] Target status response:", body?.error);
        }
      })
      .catch((err) => {
        console.log("[Sheets Sync status] Sync connection issue:", err?.message || err);
      });
    }

    return { success: true, message: "Transaksi berhasil dihapus." };
  };

  // Master update
  const saveSiswaMaster = (newList: Siswa[]) => {
    saveLocalSiswa(newList);
    
    // Auto sync back to Google Sheets if connected
    if (config.sheetUrl && connectionStatus === 'connected') {
      executeSheetsRequest(config.sheetUrl, "post", {
        action: "sync_all",
        siswa: newList
      }).catch(e => console.log("[Sheets Sync status] Auto master sync updated (background):", e?.message || e));
    }
  };

  const handleAddSiswa = (newSiswa: Siswa) => {
    const updated = [...siswaList, newSiswa];
    saveSiswaMaster(updated);
  };

  const handleAddSiswaBatch = (newSiswaArray: Siswa[], isReplace?: boolean) => {
    const updated = isReplace ? newSiswaArray : [...siswaList, ...newSiswaArray];
    saveSiswaMaster(updated);
  };

  const handleEditSiswa = (editedSiswa: Siswa) => {
    const updated = siswaList.map((s) => s.id === editedSiswa.id ? editedSiswa : s);
    saveSiswaMaster(updated);
  };

  const handleDeleteSiswa = (id: string) => {
    const updated = siswaList.filter((s) => s.id !== id);
    saveSiswaMaster(updated);
  };

  // --- SCHOOL FEES AND NOTIFICATIONS HANDLERS ---
  const saveBiayaMaster = (newList: BiayaSekolah[]) => {
    setBiayaList(newList);
    localStorage.setItem("KAS_SEKOLAH_BIAYA", JSON.stringify(newList));
    saveGlobalDatabaseOnServer(undefined, undefined, newList);
    
    // Auto sync back to Google Sheets if connected
    if (config.sheetUrl && connectionStatus === 'connected') {
      executeSheetsRequest(config.sheetUrl, "post", {
        action: "sync_biaya",
        biaya: newList
      }).catch(e => console.log("[Sheets Sync status] Auto fees sync updated (background):", e?.message || e));
    }
  };

  const handleAddBiaya = (newBiaya: BiayaSekolah) => {
    const updated = [...biayaList, newBiaya];
    saveBiayaMaster(updated);
  };

  const handleEditBiaya = (edited: BiayaSekolah) => {
    const updated = biayaList.map((b) => b.id === edited.id ? edited : b);
    saveBiayaMaster(updated);
  };

  const handleDeleteBiaya = (id: string) => {
    const updated = biayaList.filter((b) => b.id !== id);
    saveBiayaMaster(updated);
  };

  const handleAddLog = (newLog: NotifikasiLog) => {
    const updated = [...notificationLogs, newLog];
    setNotificationLogs(updated);
    localStorage.setItem("KAS_SEKOLAH_LOGS", JSON.stringify(updated));
    saveGlobalDatabaseOnServer(undefined, undefined, undefined, updated);

    // Sync log back to Google Sheets if connected
    if (config.sheetUrl && connectionStatus === 'connected') {
      executeSheetsRequest(config.sheetUrl, "post", {
        action: "save_log",
        log: newLog
      }).catch(e => console.log("[Sheets Sync status] Auto logging sync updated (background):", e?.message || e));
    }
  };

  // Nav helper from students catalog straight to payment
  const handleNavigateToPayment = (siswaId?: string) => {
    setSelectedSiswaIdForPayment(siswaId);
    setActiveTab('payment');
  };

  // Trigger modal settings edit
  const openSchoolSettings = () => {
    setSetOpenNama(config.namaSekolah);
    setSetOpenAlamat(config.alamatSekolah);
    setSetOpenTelepon(config.teleponSekolah);
    setSetOpenPenerima(config.penerimaDefault);
    setSetOpenNamaBank(config.namaBank || "Bank Syariah Indonesia (BSI)");
    setSetOpenRekeningBank(config.rekeningBank || "7123456789");
    setSetOpenPemilikRekening(config.pemilikRekening || "Bendahara SMA Nusantara Mandiri");
    setSetOpenMerchantId(config.merchantId || "");
    setSetOpenLogo(config.logoSekolah || "");
    setSetOpenNamaKepala(config.namaKepalaSekolah || "Drs. H. Mulyadi");
    setSetOpenNipKepala(config.nipKepalaSekolah || "196805121993021003");
    
    // Load auth configurations from localStorage (default admin/admin123)
    setSetOpenUsername(localStorage.getItem("KAS_SEKOLAH_USER") || "admin");
    setSetOpenPassword(localStorage.getItem("KAS_SEKOLAH_PASS") || "admin123");
    
    setSchoolSettingsOpen(true);
  };

  const handleSaveSchoolSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...config,
      namaSekolah: setOpenNama,
      alamatSekolah: setOpenAlamat,
      teleponSekolah: setOpenTelepon,
      penerimaDefault: setOpenPenerima,
      namaBank: setOpenNamaBank,
      rekeningBank: setOpenRekeningBank,
      pemilikRekening: setOpenPemilikRekening,
      merchantId: setOpenMerchantId,
      logoSekolah: setOpenLogo,
      namaKepalaSekolah: setOpenNamaKepala,
      nipKepalaSekolah: setOpenNipKepala
    };
    saveLocalConfig(updated);
    
    // Save authentication overrides
    const finalUser = setOpenUsername.trim() || "admin";
    const finalPass = setOpenPassword || "admin123";
    localStorage.setItem("KAS_SEKOLAH_USER", finalUser);
    localStorage.setItem("KAS_SEKOLAH_PASS", finalPass);
    saveGlobalSettings(updated, finalUser, finalPass);
    
    setSchoolSettingsOpen(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("KAS_SEKOLAH_LOGGED_IN");
    localStorage.removeItem("KAS_SEKOLAH_LOGGED_IN");
    setIsLoggedIn(false);
  };

  // Today Date Formatting
  const today = new Date();
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const monthsIndo = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const formattedToday = `${days[today.getDay()]}, ${today.getDate()} ${monthsIndo[today.getMonth()]} ${today.getFullYear()}`;

  if (!isLoggedIn) {
    return (
      <LoginView
        onLoginSuccess={() => setIsLoggedIn(true)}
        config={config}
        isDark={isDark}
      />
    );
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans select-none antialiased md:h-screen transition-colors duration-300 ${isDark ? "dark mesh-bg text-slate-100" : "light bg-slate-50 text-slate-800"}`}>
      
      {/* Top Navbar Chrome */}
      <header className={`backdrop-blur-md h-16 shrink-0 px-6 flex items-center justify-between z-30 no-print transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-b border-white/10' : 'bg-white border-b border-slate-200 shadow-sm'}`}>
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          {config.logoSekolah ? (
            <img 
              src={config.logoSekolah} 
              alt="Logo" 
              referrerPolicy="no-referrer"
              className="size-10 object-contain" 
            />
          ) : (
            <div className="size-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Building2 className="size-5.5" />
            </div>
          )}
          <div>
            <h1 className={`font-extrabold text-sm tracking-tight transition-colors duration-300 ${isDark ? "text-white" : "text-slate-900"}`}>{config.namaSekolah}</h1>
            <p className={`text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 transition-colors duration-300 ${isDark ? "text-slate-305" : "text-slate-500"}`}>
              <span>Sistem Kasir Penerimaan Sekolah</span>
              {connectionStatus === 'connected' ? (
                <span className="text-emerald-400 font-black flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-450 rounded-full inline-block animate-pulse"></span> Sheets Active</span>
              ) : (
                <span className="text-amber-400 font-extrabold flex items-center gap-1"><span className="w-1.5 h-1.5 bg-amber-450 rounded-full inline-block"></span> Manual Offline</span>
              )}
            </p>
          </div>
        </div>

        {/* Global info and setting trigger */}
        <div className="flex items-center gap-4">
          
          <div className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors ${isDark ? "bg-white/5 text-slate-300 border-white/10" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
            <Calendar className="size-3.5 text-blue-500" />
            <span className="text-xs font-semibold">{formattedToday}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            {connectionStatus === 'connected' ? (
              <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${isDark ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                <Database className="size-3 mr-1" /> Google Sheet Sync
              </span>
            ) : (
              <span className={`inline-flex items-center border text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${isDark ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-600"}`}>
                Mode Demo Lokal
              </span>
            )}
          </div>

          {/* Background synchronization indicator */}
          {backgroundSyncActive && (
            <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border animate-fade-in transition-all ${
              isDark ? "bg-blue-500/10 border-blue-500/20 text-blue-300" : "bg-blue-50 border-blue-100 text-blue-700"
            }`}>
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </div>
              <span className="text-[10px] font-bold tracking-tight max-w-[120px] sm:max-w-[200px] md:max-w-none truncate">{backgroundSyncStatus}</span>
            </div>
          )}

          {/* Theme Switcher Button */}
          <button
            onClick={() => setIsDark(!isDark)}
            className={`p-2 rounded-xl border transition-all duration-300 flex items-center justify-center cursor-pointer ${
              isDark 
                ? "bg-white/5 text-slate-300 border-white/10 hover:text-white" 
                : "bg-slate-100 text-slate-755 border-slate-200 hover:bg-slate-200"
            }`}
            title={isDark ? "Ganti ke Mode Terang" : "Ganti ke Mode Gelap"}
          >
            {isDark ? (
              <Sun className="size-4 text-amber-400" />
            ) : (
              <Moon className="size-4 text-slate-700" />
            )}
          </button>

          {/* Quick Config Button */}
          <button
            onClick={openSchoolSettings}
            className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
              isDark 
                ? "bg-white/5 text-slate-305 hover:text-white hover:bg-white/10 border-white/10" 
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200"
            }`}
            title="Kelola Profil Sekolah"
          >
            <Sliders className="size-4" />
            <span className="hidden md:inline">Profil Sekolah</span>
          </button>

        </div>

      </header>

      {/* Main Panel Content: Desktop layout splits left sidebar / right viewer */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        
        {/* SIDEBAR ON LEFT (Desktop-only responsive navigation) */}
        <aside className={`w-full md:w-60 py-4 px-3 shrink-0 flex flex-row md:flex-col justify-between overflow-y-auto no-print transition-colors duration-300 ${isDark ? 'bg-slate-955/20 border-r border-white/10' : 'bg-white border-r border-slate-200 shadow-sm'}`}>
          
          <div className="flex flex-row md:flex-col gap-1 w-full overflow-x-auto md:overflow-x-visible">
            
            {/* Sidebar Title for desktop */}
            <p className={`hidden md:block text-[10px] uppercase font-bold tracking-widest mb-3 px-3 transition-colors ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Menu Utama
            </p>

            {/* Tab 1 */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer w-auto md:w-full shrink-0 ${
                activeTab === 'dashboard' 
                  ? isDark ? "bg-white/10 text-blue-400 border-l-2 border-blue-400" : "bg-blue-50 text-blue-600 border-l-2 border-blue-500" 
                  : isDark ? "text-slate-300 hover:text-white hover:bg-white/5" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Home className="size-4.5" />
              <span>Beranda Dashboard</span>
            </button>

            {/* Tab 2 */}
            <button
              onClick={() => handleNavigateToPayment()}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer w-auto md:w-full shrink-0 ${
                activeTab === 'payment' 
                  ? isDark ? "bg-white/10 text-blue-400 border-l-2 border-blue-400" : "bg-blue-50 text-blue-600 border-l-2 border-blue-500" 
                  : isDark ? "text-slate-300 hover:text-white hover:bg-white/5" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Coins className="size-4.5" />
              <span>Loket Penerimaan</span>
            </button>

            {/* Tab 3 */}
            <button
              onClick={() => setActiveTab('students')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer w-auto md:w-full shrink-0 ${
                activeTab === 'students' 
                  ? isDark ? "bg-white/10 text-blue-400 border-l-2 border-blue-400" : "bg-blue-50 text-blue-600 border-l-2 border-blue-500" 
                  : isDark ? "text-slate-300 hover:text-white hover:bg-white/5" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Users className="size-4.5" />
              <span>Data Siswa & Tagihan</span>
            </button>

            {/* Tab: Manajemen Biaya */}
            <button
              onClick={() => setActiveTab('fees')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer w-auto md:w-full shrink-0 ${
                activeTab === 'fees' 
                  ? isDark ? "bg-white/10 text-blue-400 border-l-2 border-blue-400" : "bg-blue-50 text-blue-600 border-l-2 border-blue-500" 
                  : isDark ? "text-slate-300 hover:text-white hover:bg-white/5" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Tag className="size-4.5" />
              <span>Manajemen Biaya</span>
            </button>

            {/* Tab: Sistem Pengingat */}
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer w-auto md:w-full shrink-0 ${
                activeTab === 'notifications' 
                  ? isDark ? "bg-white/10 text-blue-400 border-l-2 border-blue-400" : "bg-blue-50 text-blue-600 border-l-2 border-blue-500" 
                  : isDark ? "text-slate-300 hover:text-white hover:bg-white/5" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Bell className="size-4.5" />
              <span>Sistem Pengingat</span>
            </button>

            {/* Tab 4 */}
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer w-auto md:w-full shrink-0 ${
                activeTab === 'reports' 
                  ? isDark ? "bg-white/10 text-blue-400 border-l-2 border-blue-400" : "bg-blue-50 text-blue-600 border-l-2 border-blue-500" 
                  : isDark ? "text-slate-300 hover:text-white hover:bg-white/5" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <FileText className="size-4.5" />
              <span>Laporan Jurnal Kas</span>
            </button>

            {/* Tab 5 */}
            <button
              onClick={() => setActiveTab('integration')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer w-auto md:w-full shrink-0 ${
                activeTab === 'integration' 
                  ? isDark ? "bg-white/10 text-blue-400 border-l-2 border-blue-400" : "bg-blue-50 text-blue-600 border-l-2 border-blue-500" 
                  : isDark ? "text-slate-300 hover:text-white hover:bg-white/5" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Settings className="size-4.5" />
              <span>Koneksi Google Sheet</span>
            </button>

            {/* Logout Tab */}
            <button
              onClick={() => setLogoutConfirmOpen(true)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer w-auto md:w-full shrink-0 text-red-500 hover:text-red-400 md:hover:bg-red-500/15 group`}
              title="Keluar dari Aplikasi"
            >
              <LogOut className="size-4.5 text-red-500 transition-transform group-hover:scale-110" />
              <span>Log Out</span>
            </button>

          </div>

          {/* Quick Footer inside desktop sidebar */}
          <div className={`hidden md:block pt-4 border-t px-3 text-[10px] font-sans leading-relaxed transition-colors ${isDark ? "border-white/10 text-slate-400" : "border-slate-200 text-slate-500"}`}>
            <p className={`font-extrabold ${isDark ? "text-slate-300" : "text-slate-800"} truncate`} title={config.namaSekolah || "Toko Berkah"}>
              {config.namaSekolah || "Toko Berkah"}
            </p>
            <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500">v1.0</p>
            <p className="mt-1">Sistem Kasir Offline-First Terintegrasi Google Sheet.</p>
          </div>

        </aside>

        {/* CONTAINER ON RIGHT (Holds the view templates scrollable) */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 bg-transparent no-print">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
              className="w-full"
            >
              {activeTab === 'dashboard' && (
                <DashboardView
                  siswaList={siswaList}
                  transaksiList={transaksiList}
                  config={config}
                  onNavigateToPayment={handleNavigateToPayment}
                  onReprintReceipt={(trx) => setActiveReceipt(trx)}
                  onDeleteTransaction={handleDeleteTransaction}
                />
              )}

              {activeTab === 'payment' && (
                <PaymentView
                  siswaList={siswaList}
                  config={config}
                  onSubmitPayment={handleProcessPayment}
                  selectedSiswaIdFromNav={selectedSiswaIdForPayment}
                  biayaList={biayaList}
                />
              )}

              {activeTab === 'students' && (
                <StudentsView
                  siswaList={siswaList}
                  config={config}
                  onAddSiswa={handleAddSiswa}
                  onAddSiswaBatch={handleAddSiswaBatch}
                  onEditSiswa={handleEditSiswa}
                  onDeleteSiswa={handleDeleteSiswa}
                  onNavigateToPayment={handleNavigateToPayment}
                />
              )}

              {activeTab === 'fees' && (
                <SchoolFeesView
                  biayaList={biayaList}
                  onAddBiaya={handleAddBiaya}
                  onEditBiaya={handleEditBiaya}
                  onDeleteBiaya={handleDeleteBiaya}
                />
              )}

              {activeTab === 'notifications' && (
                <NotificationView
                  siswaList={siswaList}
                  biayaList={biayaList}
                  notificationLogs={notificationLogs}
                  onAddLog={handleAddLog}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsView
                  transaksiList={transaksiList}
                  config={config}
                  onSyncFromSheet={async () => {
                    return await testSheetConnection(config.sheetUrl, siswaList, transaksiList, biayaList, notificationLogs, true);
                  }}
                  onDeleteTransaction={handleDeleteTransaction}
                />
              )}

              {activeTab === 'integration' && (
                <SheetIntegrationView
                  config={config}
                  onUpdateConfig={saveLocalConfig}
                  onSyncAllData={handleUploadDataToSheet}
                  connectionStatus={connectionStatus}
                  onTestConnection={async () => {
                    return await testSheetConnection();
                  }}
                  onPullAllData={async () => {
                    return await testSheetConnection(config.sheetUrl, siswaList, transaksiList, biayaList, notificationLogs, true);
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

      </div>

      {/* MODAL: GENERAL SCHOOL CONFIGURATION */}
      {schoolSettingsOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl w-full max-w-md shadow-2xl border border-white/15 overflow-hidden text-slate-100">
            
            <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Kelola Profil Sekolah & Kasir</h3>
              <button 
                onClick={() => setSchoolSettingsOpen(false)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors text-slate-300 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSchoolSettings} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              
              {/* Logo Sekolah Upload */}
              <div className="space-y-1 bg-white/5 p-3 rounded-xl border border-white/5">
                <label className="text-xs font-bold text-slate-300 block text-left">Logo Lembaga / Sekolah</label>
                <div className="flex items-center gap-4 mt-1.5">
                  {setOpenLogo ? (
                    <div className="relative group shrink-0">
                      <img 
                        src={setOpenLogo} 
                        alt="Logo Sekolah" 
                        referrerPolicy="no-referrer"
                        className="size-16 object-contain" 
                      />
                      <button
                        type="button"
                        onClick={() => setSetOpenLogo("")}
                        className="absolute -top-1.5 -right-1.5 p-1 bg-rose-600 hover:bg-rose-500 text-white rounded-full transition-all shadow-md cursor-pointer"
                        title="Hapus Logo"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="size-16 rounded-xl border border-dashed border-white/25 flex flex-col items-center justify-center bg-slate-1000 text-slate-500 text-[10px] shrink-0 font-medium">
                      No Image
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <input 
                      type="file"
                      id="logo-upload-input"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              setSetOpenLogo(event.target.result as string);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label 
                      htmlFor="logo-upload-input"
                      className="px-3 py-1.5 inline-block bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/30 text-blue-300 hover:text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
                    >
                      Pilih File Logo
                    </label>
                    <p className="text-[10px] text-slate-400 mt-1 leading-normal">Format PNG/JPG, maks 500kb. Logo akan otomatis dipasang pada kuitansi dan kop laporan.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Nama Lembaga / Sekolah</label>
                <input
                  type="text"
                  required
                  value={setOpenNama}
                  onChange={(e) => setSetOpenNama(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl text-xs focus:ring-blue-400 focus:bg-slate-900/65 focus:outline-none focus:ring-2 focus:border-transparent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Alamat Lengkap</label>
                <textarea
                  required
                  rows={2}
                  value={setOpenAlamat}
                  onChange={(e) => setSetOpenAlamat(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl text-xs focus:ring-blue-400 focus:bg-slate-900/65 focus:outline-none focus:ring-2 focus:border-transparent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Nomor Telepon Kontak</label>
                <input
                  type="text"
                  required
                  value={setOpenTelepon}
                  onChange={(e) => setSetOpenTelepon(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl text-xs focus:ring-blue-400 focus:bg-slate-900/65 focus:outline-none focus:ring-2 focus:border-transparent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Nama Bendahara Default</label>
                <input
                  type="text"
                  required
                  value={setOpenPenerima}
                  onChange={(e) => setSetOpenPenerima(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl text-xs focus:ring-blue-400 focus:bg-slate-900/65 focus:outline-none focus:ring-2 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Nama Kepala Sekolah</label>
                  <input
                    type="text"
                    required
                    value={setOpenNamaKepala}
                    onChange={(e) => setSetOpenNamaKepala(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/40 border border-white/10 text-white font-semibold rounded-lg text-xs focus:ring-blue-400 focus:outline-none focus:ring-1"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">NIP Kepala Sekolah</label>
                  <input
                    type="text"
                    required
                    value={setOpenNipKepala}
                    onChange={(e) => setSetOpenNipKepala(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/40 border border-white/10 text-white font-mono rounded-lg text-xs focus:ring-blue-400 focus:outline-none focus:ring-1"
                  />
                </div>
              </div>

              <div className="border-t border-white/10 pt-3 mt-2 space-y-3">
                <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest leading-none">Pengaturan Rekening Transfer</h4>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-305">Nama Bank Penerima</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Bank Syariah Indonesia (BSI)"
                    value={setOpenNamaBank}
                    onChange={(e) => setSetOpenNamaBank(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl text-xs focus:ring-blue-400 focus:bg-slate-900/65 focus:outline-none focus:ring-2 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-305">Nomor Rekening</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 7123456789"
                      value={setOpenRekeningBank}
                      onChange={(e) => setSetOpenRekeningBank(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-bold font-mono rounded-xl text-xs focus:ring-blue-400 focus:bg-slate-900/65 focus:outline-none focus:ring-2 focus:border-transparent"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-305">Pemilik Rekening</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: SMA Nusantara Mandiri"
                      value={setOpenPemilikRekening}
                      onChange={(e) => setSetOpenPemilikRekening(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl text-xs focus:ring-blue-400 focus:bg-slate-900/65 focus:outline-none focus:ring-2 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="space-y-1 mt-2">
                  <label className="text-xs font-bold text-slate-305 text-left block">Merchant ID (Akurasi QRIS Statis Sekolah)</label>
                  <input
                    type="text"
                    placeholder="Contoh: ID1020260531002 atau MID-987654321"
                    value={setOpenMerchantId}
                    onChange={(e) => setSetOpenMerchantId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold font-mono rounded-xl text-xs focus:ring-blue-400 focus:bg-slate-900/65 focus:outline-none focus:ring-2 focus:border-transparent"
                  />
                  <p className="text-[9px] text-slate-400 leading-normal text-left">
                    Opsional: Masukkan Merchant ID terdaftar untuk membuat QRIS statis yang dicetak pada kuitansi pembayaran non-tunai menjadi lebih akurat sesuai data merchant resmi sekolah Anda.
                  </p>
                </div>
              </div>

              <div className="border-t border-white/10 pt-3 mt-2 space-y-3 animate-fade-in">
                <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest leading-none">PENGATURAN KREDENSIAL LOGIN</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-305">Username Baru</label>
                    <input
                      type="text"
                      required
                      placeholder="Username admin"
                      value={setOpenUsername}
                      onChange={(e) => setSetOpenUsername(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl text-xs focus:ring-blue-400 focus:bg-slate-900/65 focus:outline-none focus:ring-2 focus:border-transparent"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-305">Password Baru</label>
                    <input
                      type="text"
                      required
                      placeholder="Password admin"
                      value={setOpenPassword}
                      onChange={(e) => setSetOpenPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-mono rounded-xl text-xs focus:ring-blue-400 focus:bg-slate-900/65 focus:outline-none focus:ring-2 focus:border-transparent"
                    />
                  </div>
                </div>
                <p className="text-[9px] text-slate-450 leading-relaxed font-semibold">
                  * Kredensial di atas digunakan untuk login masuk ke dashboard aplikasi. Default adalah admin / admin123.
                </p>
              </div>

              <div className="pt-4 flex justify-end gap-2.5 border-t border-white/10 mt-4">
                <button
                  type="button"
                  onClick={() => setSchoolSettingsOpen(false)}
                  className="px-4 py-2 border border-white/10 text-slate-300 rounded-xl hover:bg-white/10 font-semibold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/20"
                >
                  Simpan Profil
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL: LOGOUT CONFIRMATION VALIDATION */}
      {logoutConfirmOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl w-full max-w-sm shadow-2xl border border-red-500/20 overflow-hidden text-slate-100">
            
            <div className="bg-red-500/10 px-6 py-4 border-b border-red-500/20 flex items-center gap-2.5">
              <AlertTriangle className="size-5 text-red-550 shrink-0" />
              <h3 className="font-bold text-white text-sm">Konfirmasi Keluar</h3>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                Apakah Anda yakin ingin keluar dari sistem? Anda harus memasukkan kembali username dan password jika ingin mengelola transaksi dan melihat laporan kembali.
              </p>

              <div className="flex justify-end gap-2.5 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setLogoutConfirmOpen(false)}
                  className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl hover:bg-white/10 font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLogoutConfirmOpen(false);
                    handleLogout();
                  }}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-red-500/20 cursor-pointer transition-all active:scale-95"
                >
                  Ya, Logout
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* FLOATING KUITANSI MODAL DRAWER */}
      {activeReceipt && (
        <ReceiptView
          transaksi={activeReceipt}
          config={config}
          onClose={() => setActiveReceipt(null)}
        />
      )}

    </div>
  );
}
