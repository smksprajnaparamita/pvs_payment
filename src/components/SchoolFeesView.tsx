/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BiayaSekolah } from "../types";
import { formatRupiah } from "../utils";
import React, { useState } from "react";
import { 
  Plus, 
  Trash2, 
  Edit, 
  Calendar, 
  FileText, 
  Tag, 
  AlertTriangle,
  FolderPlus,
  Coins,
  Heading,
  X
} from "lucide-react";

interface SchoolFeesViewProps {
  biayaList: BiayaSekolah[];
  onAddBiaya: (biaya: BiayaSekolah) => void;
  onEditBiaya: (biaya: BiayaSekolah) => void;
  onDeleteBiaya: (id: string) => void;
}

export default function SchoolFeesView({
  biayaList,
  onAddBiaya,
  onEditBiaya,
  onDeleteBiaya
}: SchoolFeesViewProps) {
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

  // Form states
  const [formId, setFormId] = useState("");
  const [formNama, setFormNama] = useState("");
  const [formKategori, setFormKategori] = useState<'SPP' | 'Uang Gedung' | 'Seragam' | 'Kegiatan' | 'Lainnya'>('SPP');
  const [formJumlah, setFormJumlah] = useState<number>(0);
  const [formTenggat, setFormTenggat] = useState("");

  const openAddModal = () => {
    setModalMode('add');
    setFormId("");
    setFormNama("");
    setFormKategori('SPP');
    setFormJumlah(150000);
    // Default tenggat to next month
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setFormTenggat(nextMonth.toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const openEditModal = (b: BiayaSekolah) => {
    setModalMode('edit');
    setFormId(b.id);
    setFormNama(b.nama);
    setFormKategori(b.kategori);
    setFormJumlah(b.jumlah);
    setFormTenggat(b.tenggatWaktu);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNama || formJumlah <= 0 || !formTenggat) {
      alert("Seluruh field nama, jumlah, dan tenggat waktu harus diisi dengan benar!");
      return;
    }

    const item: BiayaSekolah = {
      id: modalMode === 'add' ? `biaya-${Date.now()}` : formId,
      nama: formNama,
      kategori: formKategori,
      jumlah: Number(formJumlah),
      tenggatWaktu: formTenggat
    };

    if (modalMode === 'add') {
      onAddBiaya(item);
    } else {
      onEditBiaya(item);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string, nama: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus definisi biaya "${nama}"?`)) {
      onDeleteBiaya(id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-sm text-slate-100">
      
      {/* Top action section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass glass-card p-5 rounded-2xl">
        <div>
          <h3 className="font-bold text-white text-base">Definisi Biaya & Tarif Sekolah</h3>
          <p className="text-xs text-slate-350 mt-0.5">Definisikan berbagai iuran sekolah, tentukan jumlah kontribusi, dan set tenggat waktu penagihan.</p>
        </div>
        
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold px-5 py-2.5 text-xs shadow-lg shadow-blue-500/20 border border-blue-400/20 transition-all cursor-pointer text-center justify-center active:scale-[0.98]"
        >
          <Plus className="size-4" />
          Tambah Biaya Baru
        </button>
      </div>

      {/* Main Grid display / Table */}
      <div className="glass glass-card rounded-2xl overflow-hidden">
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-slate-400 text-xs font-semibold uppercase bg-white/5">
                <th className="py-3.5 px-5 font-bold">Kategori</th>
                <th className="py-3.5 px-5 font-bold">Nama Biaya</th>
                <th className="py-3.5 px-5 text-right font-bold">Nominal Tarif</th>
                <th className="py-3.5 px-5 font-bold">Tenggat Pembayaran</th>
                <th className="py-3.5 px-5 text-center font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {biayaList.map((b) => (
                <tr key={b.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-4 px-5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                      b.kategori === 'SPP' 
                        ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                        : b.kategori === 'Uang Gedung'
                        ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                        : b.kategori === 'Seragam'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                        : b.kategori === 'Kegiatan'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        : 'bg-slate-500/10 text-slate-300 border-slate-500/20'
                    }`}>
                      {b.kategori}
                    </span>
                  </td>
                  <td className="py-4 px-5">
                    <span className="font-semibold text-white block">{b.nama}</span>
                    <span className="text-[10px] text-slate-450 block mt-0.5">ID: {b.id}</span>
                  </td>
                  <td className="py-4 px-5 text-right font-bold font-mono text-white">
                    {formatRupiah(b.jumlah)}
                  </td>
                  <td className="py-4 px-5 font-mono text-xs">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Calendar className="size-3.5 text-slate-400" />
                      <span>{b.tenggatWaktu}</span>
                    </div>
                  </td>
                  <td className="py-4 px-5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEditModal(b)}
                        className="p-1 px-2 text-xs font-semibold bg-white/5 hover:bg-white/10 text-blue-300 border border-white/10 rounded-lg transition-all cursor-pointer"
                        title="Edit Biaya"
                      >
                        <Edit className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(b.id, b.nama)}
                        className="p-1 px-2 text-xs font-semibold bg-red-500/10 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/10 rounded-lg transition-all cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {biayaList.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-slate-400 text-xs italic">
                    <FolderPlus className="size-8 mx-auto text-slate-500 mb-2" />
                    Belum ada definisi tarif atau jenis biaya sekolah ditambahkan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white/5 px-5 py-3 border-t border-white/10 text-xs text-slate-350">
          Total Terdefinisi: <b>{biayaList.length}</b> Macam Biaya Sekolah.
        </div>
      </div>

      {/* DISKUSI INTEGRASI MANDIRI */}
      <div className="bg-blue-900/20 border border-blue-500/15 p-5 rounded-2xl flex gap-3">
        <Coins className="size-6 text-blue-405 shrink-0" />
        <div className="space-y-1">
          <h4 className="font-bold text-white text-xs">Tentang Sinkronisasi Google Sheets</h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            Data ini secara otomatis disimpan lokal di browser Anda. Ketika Anda mengunggah atau menguji koneksi (jika sudah terhubung Google Sheet), lembar kerja <b>"Biaya"</b> di Google Spreadsheet akan diinisiasi dan di-update secara berkala agar pencatatan keuangan tersinkron penuh dua arah.
          </p>
        </div>
      </div>

      {/* MODAL: ADD / EDIT SCHOOL FEES */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-sm text-slate-100">
            
            <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">
                {modalMode === 'add' ? 'Definisikan Biaya Baru' : 'Ubah Detail Biaya'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors text-slate-450 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-slate-300">Nama Biaya / Tagihan</label>
                <input
                  type="text"
                  required
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Contoh: Uang Kegiatan Semester Ganjil"
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl text-xs focus:ring-blue-505 focus:bg-slate-950 block focus:outline-none focus:ring-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-left">
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Kategori Biaya</label>
                  <select
                    value={formKategori}
                    onChange={(e) => setFormKategori(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl text-xs focus:outline-none"
                  >
                    <option value="SPP" className="bg-slate-900 text-white">SPP</option>
                    <option value="Uang Gedung" className="bg-slate-900 text-white">Uang Gedung</option>
                    <option value="Seragam" className="bg-slate-900 text-white">Seragam</option>
                    <option value="Kegiatan" className="bg-slate-900 text-white">Kegiatan</option>
                    <option value="Lainnya" className="bg-slate-900 text-white">Lainnya</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Tenggat Pembayaran</label>
                  <input
                    type="date"
                    required
                    value={formTenggat}
                    onChange={(e) => setFormTenggat(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl text-xs focus:outline-none"
                  />
                </div>

              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-slate-300">Tarif / Nominal (Rupiah)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    required
                    value={formJumlah}
                    onChange={(e) => setFormJumlah(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="Contoh: 150000"
                    className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 text-white font-bold font-mono rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 flex gap-2 text-[10px] text-amber-300 leading-relaxed font-sans mt-2 text-left">
                <AlertTriangle className="size-5 shrink-0 text-amber-450" />
                <span>
                  <b>Perhatian:</b> Biaya yang didefinisikan di sini akan menjadi acuan bagi kasir ketika memproses pembayaran di menu Loket Pembayaran maupun ketika membuat laporan tagihan berkala.
                </span>
              </div>

              <div className="pt-4 flex justify-end gap-2.5 border-t border-white/10 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-white/10 text-slate-200 rounded-xl hover:bg-white/10 font-semibold text-xs transition-all active:scale-95 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/20 border border-blue-400/20 transition-all active:scale-95 cursor-pointer"
                >
                  {modalMode === 'add' ? 'Tambahkan' : 'Simpan Perubahan'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
