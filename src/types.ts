/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Siswa {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  angkatan: string;
  tagihanSpp: number; // Jumlah SPP per bulan
  statusSpp: Record<string, 'Lunas' | 'Belum_Bayar' | string>; // key: 'YYYY-MM' e.g. '2026-05': 'Lunas' atau 'Kurang:150000'
  emailOrangTua?: string;
  teleponOrangTua?: string;
}

export interface Transaksi {
  id: string; // Kuitansi number, e.g., KWT-20260529-0001
  siswaId: string;
  siswaNis: string;
  siswaNama: string;
  siswaKelas: string;
  tanggal: string; // YYYY-MM-DD HH:mm:ss
  jenisPembayaran: 'SPP' | 'Uang Gedung' | 'Seragam' | 'Kegiatan' | 'Lainnya';
  bulanCovered?: string; // e.g. "2026-05" jika jenisPembayaran = 'SPP'
  jumlah: number;
  metode: 'Cash' | 'Transfer';
  keterangan: string;
  penerima: string;
  originalTagihan?: number; // Jumlah tagihan asli sebelum dicicil/kurang
  sisaTunggakan?: number; // Sisa tunggakan yang belum dibayar
}

export interface AppConfig {
  sheetUrl: string;
  namaSekolah: string;
  alamatSekolah: string;
  teleponSekolah: string;
  penerimaDefault: string;
  namaBank?: string;
  rekeningBank?: string;
  pemilikRekening?: string;
  merchantId?: string;
  logoSekolah?: string;
  namaKepalaSekolah?: string;
  nipKepalaSekolah?: string;
}

export interface BiayaSekolah {
  id: string;
  nama: string;
  kategori: 'SPP' | 'Uang Gedung' | 'Seragam' | 'Kegiatan' | 'Lainnya';
  jumlah: number;
  tenggatWaktu: string; // Format: YYYY-MM-DD
}

export interface NotifikasiLog {
  id: string;
  siswaId: string;
  siswaNama: string;
  tipe: 'Email' | 'WhatsApp';
  kontakTujuan: string;
  pesan: string;
  tanggalKirim: string;
  status: 'Sukses' | 'Gagal';
}
