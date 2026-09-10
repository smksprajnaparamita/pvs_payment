/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formats a number into Indonesian Rupiah format.
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Converts a number of any scale into Indonesian spelled-out text (Terbilang).
 * E.g., 350000 -> "Tiga Ratus Lima Puluh Ribu Rupiah"
 */
export function terbilang(nominal: number): string {
  const words = [
    "", "Satu", "Dua", "Tiga", "Empat", "Lima", 
    "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"
  ];

  function convert(n: number): string {
    if (n < 12) {
      return words[n];
    } else if (n < 20) {
      return convert(n - 10) + " Belas";
    } else if (n < 100) {
      const tens = Math.floor(n / 10);
      const units = n % 10;
      return convert(tens) + " Puluh " + convert(units);
    } else if (n < 200) {
      return "Seratus " + convert(n - 100);
    } else if (n < 1000) {
      const hundreds = Math.floor(n / 100);
      const remainder = n % 100;
      return convert(hundreds) + " Ratus " + convert(remainder);
    } else if (n < 2000) {
      return "Seribu " + convert(n - 1000);
    } else if (n < 1000000) {
      const thousands = Math.floor(n / 1000);
      const remainder = n % 1000;
      return convert(thousands) + " Ribu " + convert(remainder);
    } else if (n < 1000000000) {
      const millions = Math.floor(n / 1000000);
      const remainder = n % 1000000;
      return convert(millions) + " Juta " + convert(remainder);
    } else if (n < 1000000000000) {
      const billions = Math.floor(n / 1000000000);
      const remainder = n % 1000000000;
      return convert(billions) + " Milyar " + convert(remainder);
    }
    return "Angka Terlalu Besar";
  }

  if (nominal === 0) return "Nol Rupiah";
  const processed = convert(Math.abs(nominal)).trim();
  // Safe cleanup for extra spaces
  return processed.replace(/\s+/g, " ") + " Rupiah";
}

/**
 * Generates a unique transaction billing number.
 */
export function generateKuitansiNumber(prefix: string = "KWT"): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${year}${month}${day}-${random}`;
}

/**
 * Translates a month key (YYYY-MM) to indonesian month format (e.g. "Mei 2026")
 */
export function formatBulanIndo(monthKey: string): string {
  if (monthKey.includes(",")) {
    return monthKey
      .split(",")
      .map((key) => formatBulanIndo(key.trim()))
      .join(", ");
  }
  const parts = monthKey.split("-");
  if (parts.length !== 2) return monthKey;
  
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const monthIdx = parseInt(parts[1], 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return monthKey;
  
  return `${monthNames[monthIdx]} ${parts[0]}`;
}

/**
 * List of months in school year / calendar year (dynamically calculated based on current date)
 */
const dynamicDate = new Date();
const dynamicYear = dynamicDate.getFullYear();
const dynamicMonth = dynamicDate.getMonth() + 1; // 1-indexed
const startYear = dynamicMonth >= 7 ? dynamicYear : dynamicYear - 1;
const endYear = startYear + 1;

export const DAFTAR_BULAN = [
  { key: `${startYear}-07`, label: `Juli ${startYear}` },
  { key: `${startYear}-08`, label: `Agustus ${startYear}` },
  { key: `${startYear}-09`, label: `September ${startYear}` },
  { key: `${startYear}-10`, label: `Oktober ${startYear}` },
  { key: `${startYear}-11`, label: `November ${startYear}` },
  { key: `${startYear}-12`, label: `Desember ${startYear}` },
  { key: `${endYear}-01`, label: `Januari ${endYear}` },
  { key: `${endYear}-02`, label: `Februari ${endYear}` },
  { key: `${endYear}-03`, label: `Maret ${endYear}` },
  { key: `${endYear}-04`, label: `April ${endYear}` },
  { key: `${endYear}-05`, label: `Mei ${endYear}` },
  { key: `${endYear}-06`, label: `Juni ${endYear}` }
];

/**
 * List of academic years available in the system
 */
export const DAFTAR_TAHUN_PELAJARAN = [
  "2023/2024",
  "2024/2025",
  "2025/2026",
  "2026/2027",
  "2027/2028",
  "2028/2029"
];

/**
 * Returns the 12 academic months (July - June) for a given academic year.
 * e.g., "2025/2026" -> [ { key: "2025-07", label: "Juli 2025" }, ... ]
 */
export function getMonthsForAcademicYear(academicYear: string) {
  const [startYear, endYear] = academicYear.split("/");
  return [
    { key: `${startYear}-07`, label: `Juli ${startYear}` },
    { key: `${startYear}-08`, label: `Agustus ${startYear}` },
    { key: `${startYear}-09`, label: `September ${startYear}` },
    { key: `${startYear}-10`, label: `Oktober ${startYear}` },
    { key: `${startYear}-11`, label: `November ${startYear}` },
    { key: `${startYear}-12`, label: `Desember ${startYear}` },
    { key: `${endYear}-01`, label: `Januari ${endYear}` },
    { key: `${endYear}-02`, label: `Februari ${endYear}` },
    { key: `${endYear}-03`, label: `Maret ${endYear}` },
    { key: `${endYear}-04`, label: `April ${endYear}` },
    { key: `${endYear}-05`, label: `Mei ${endYear}` },
    { key: `${endYear}-06`, label: `Juni ${endYear}` }
  ];
}

/**
 * Determines the academic year YYYY/YYYY based on a calendar YYYY-MM key.
 * e.g., "2026-03" -> "2025/2026"
 * e.g., "2025-08" -> "2025/2026"
 */
export function getAcademicYearFromCalendarKey(calendarKey: string): string {
  const parts = calendarKey.split("-");
  if (parts.length !== 2) return "2025/2026"; // Fallback default
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (month >= 7 && month <= 12) {
    return `${year}/${year + 1}`;
  } else {
    return `${year - 1}/${year}`;
  }
}

/**
 * Given academic year "2025/2026" and month key "03", returns calendar key "2026-03"
 */
export function getYearAndMonthFromAcademicYear(academicYear: string, monthKey: string): string {
  const [startYear, endYear] = academicYear.split("/");
  const monthNum = parseInt(monthKey, 10);
  const formattedMonthKey = String(monthNum).padStart(2, '0');
  if (monthNum >= 7 && monthNum <= 12) {
    return `${startYear}-${formattedMonthKey}`;
  } else {
    return `${endYear}-${formattedMonthKey}`;
  }
}

export const NAMA_BULAN = [
  { key: "01", label: "Januari" },
  { key: "02", label: "Februari" },
  { key: "03", label: "Maret" },
  { key: "04", label: "April" },
  { key: "05", label: "Mei" },
  { key: "06", label: "Juni" },
  { key: "07", label: "Juli" },
  { key: "08", label: "Agustus" },
  { key: "09", label: "September" },
  { key: "10", label: "Oktober" },
  { key: "11", label: "November" },
  { key: "12", label: "Desember" }
];

export const DAFTAR_TAHUN = ["2023", "2024", "2025", "2026", "2027", "2028"];

/**
 * Extracts only the date part (YYYY-MM-DD) from a string that could be "YYYY-MM-DD HH:mm:ss" or ISO string "YYYY-MM-DDTHH:mm:ss.sssZ"
 */
export function getOnlyDate(tanggal: string): string {
  if (!tanggal) return "";
  if (tanggal.includes("T")) {
    return tanggal.split("T")[0];
  }
  return tanggal.split(" ")[0];
}

/**
 * Formats a raw date string to a clean standard string "YYYY-MM-DD HH:mm:ss"
 */
export function formatDateTimeClean(tanggal: string): string {
  if (!tanggal) return "";
  if (tanggal.includes("T")) {
    const parts = tanggal.split("T");
    const datePart = parts[0];
    const timePart = parts[1].substring(0, 8); // e.g., "17:00:00"
    return `${datePart} ${timePart}`;
  }
  return tanggal;
}

/**
 * Normalizes a student parent's phone number to standard Indonesian format (with leading '0')
 */
export function normalizePhoneNumber(phoneVal: any): string {
  if (phoneVal === undefined || phoneVal === null) return "-";
  let phone = String(phoneVal).trim();
  if (phone === "" || phone === "-" || phone === "null" || phone === "undefined") {
    return "-";
  }
  // Strip single quotes, double quotes, formula signs like ="0812" -> 0812
  phone = phone.replace(/^['"=]+|['"]+$/g, "");
  
  // Clean characters except numbers and '+'
  let cleaned = phone.replace(/[^0-9+]/g, "");
  
  // If it starts with '8' and has a length of mobile number (9-13), auto prepend '0'
  if (/^8\d+$/.test(cleaned) && cleaned.length >= 9 && cleaned.length <= 13) {
    cleaned = "0" + cleaned;
  }
  
  // If it starts with '628' and has length of mobile number (11-15), convert to '08' for local display
  if (/^628\d+$/.test(cleaned) && cleaned.length >= 11 && cleaned.length <= 15) {
    cleaned = "0" + cleaned.slice(2);
  }
  
  return cleaned;
}


