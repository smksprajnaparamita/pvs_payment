import React, { useState } from "react";
import { Lock, User, Eye, EyeOff, LogIn, AlertCircle } from "lucide-react";
import { AppConfig } from "../types";

interface LoginViewProps {
  onLoginSuccess: () => void;
  config: AppConfig;
  isDark: boolean;
}

export default function LoginView({ onLoginSuccess, config, isDark }: LoginViewProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      // Fetch custom credentials from localStorage, otherwise default to admin/admin123
      const savedUser = localStorage.getItem("KAS_SEKOLAH_USER") || "admin";
      const savedPass = localStorage.getItem("KAS_SEKOLAH_PASS") || "admin123";

      if (username.trim() === savedUser && password === savedPass) {
        sessionStorage.setItem("KAS_SEKOLAH_LOGGED_IN", "true");
        localStorage.removeItem("KAS_SEKOLAH_LOGGED_IN");
        onLoginSuccess();
      } else {
        setError("Username atau password salah. Silakan coba kembali.");
        setIsLoading(false);
      }
    }, 600);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 font-sans ${isDark ? "bg-[#0f172a]" : "bg-[#f3f4f6]"}`}>
      <div className="w-full max-w-4xl select-none animate-fade-in">
        
        {/* Main Split Layout Container */}
        <div className={`rounded-[32px] overflow-hidden shadow-2xl flex flex-col md:flex-row border transition-all duration-300 ${
          isDark 
            ? "bg-slate-900 border-white/10 text-white" 
            : "bg-white border-slate-100 text-slate-800"
        }`}>
          
          {/* Left Side: Dynamic Welcome Banner (Blue/Indigo Gradient matching Dashboard) */}
          <div className="w-full md:w-1/2 p-8 sm:p-12 flex flex-col justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white min-h-[380px] md:min-h-[520px] relative overflow-hidden">
            {/* Soft Ambient Vector Art Overlays */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-2xl -mr-20 -mt-20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/5 rounded-full blur-xl -ml-16 -mb-16 pointer-events-none" />

            <div className="relative z-10">
              {/* Person Icon in Circle */}
              <div className="inline-flex p-3.5 bg-white/10 border border-white/10 rounded-full w-fit mb-8 sm:mb-12 shadow-inner">
                <User className="size-6 text-white" />
              </div>

              {/* Headings */}
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                Selamat Datang di
              </h2>
              <h1 className="text-3xl sm:text-4xl font-black text-amber-305 tracking-tight leading-tight mt-1 mb-5 drop-shadow-sm uppercase">
                {config.namaSekolah || "Toko Berkah"}
              </h1>

              {/* Descriptive Text */}
              <p className="text-white/95 text-xs sm:text-sm leading-relaxed max-w-sm font-medium">
                Sistem SPP & Manajemen Kasir otomatis yang terintegrasi secara real-time antar perangkat dan cloud Google Sheets.
              </p>
            </div>
          </div>

          {/* Right Side: Login Action Form */}
          <div className="w-full md:w-1/2 p-8 sm:p-12 flex flex-col justify-center">
            
            {/* Header Title */}
            <div className="mb-8">
              <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                Login Account
              </h2>
              <p className={`text-xs sm:text-sm mt-1.5 font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Silakan masuk menggunakan username dan password Anda.
              </p>
            </div>

            {/* Error Notification Alert */}
            {error && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 rounded-xl text-xs flex items-start gap-2.5 mb-5 animate-shake font-medium">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-500" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Username Field */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block text-blue-600 dark:text-blue-400">
                  USERNAME LOGIN
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <User className="size-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username"
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-semibold placeholder:text-slate-400 placeholder:font-medium ${
                      isDark 
                        ? "bg-slate-800/50 border-white/10 text-white focus:bg-slate-955" 
                        : "bg-slate-50 border-slate-200/80 text-slate-800 focus:bg-white"
                    }`}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block text-blue-600 dark:text-blue-400">
                  PASSWORD
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock className="size-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className={`w-full pl-10 pr-10 py-3 border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-semibold placeholder:text-slate-400 placeholder:font-medium ${
                      isDark 
                        ? "bg-slate-800/50 border-white/10 text-white focus:bg-slate-955" 
                        : "bg-slate-50 border-slate-200/80 text-slate-800 focus:bg-white"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4 text-slate-400" />
                    ) : (
                      <Eye className="size-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Form Action Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-extrabold text-xs sm:text-sm rounded-xl tracking-wider uppercase transition-all shadow-md shadow-blue-600/10 active:scale-[0.98] cursor-pointer"
                >
                  <LogIn className="size-4" />
                  {isLoading ? "MEMVALIDASI..." : "MASUK APLIKASI"}
                </button>
              </div>

            </form>
          </div>

        </div>

        {/* Footer Attribution */}
        <div className={`text-center mt-8 text-[10px] font-medium tracking-wide uppercase transition-colors duration-300 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
          Sistem Keuangan Kasir & SPP Sekolah v1.2. All Rights Reserved.
        </div>

      </div>
    </div>
  );
}
