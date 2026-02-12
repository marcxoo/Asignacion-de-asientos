'use client';

import { useState, useCallback, useMemo, Fragment, useEffect } from 'react';
import Link from 'next/link';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { SeatState, SeatCategory } from '@/lib/types';
import { ROWS, parseSeatId, CATEGORY_CONFIG } from '@/lib/seats-data';
import { AssignmentModal } from './AssignmentModal';
import { supabase } from '@/lib/supabase';
import {
  UserCircleIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ClipboardDocumentIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

interface AssignmentRow {
  seat_id: string;
  nombre_invitado: string;
  categoria: SeatCategory;
  registro_id: string | null;
  assigned_at: string;
}

interface Template {
  id: string;
  name: string;
  data: AssignmentRow[];
  created_at: string;
}

interface AuditoriumViewProps {
  onBack?: () => void;
  activeTemplateId?: string;
  activeTemplateName?: string;
  onSaveTemplate?: (name: string, data: any[]) => Promise<void>;
}

export function AuditoriumView({ onBack, activeTemplateId, activeTemplateName, onSaveTemplate }: AuditoriumViewProps) {
  const [assignments, setAssignments] = useState<SeatState>({});
  const [loading, setLoading] = useState(false);

  // ── Supabase Realtime & Fetch ──
  useEffect(() => {
    // 1. Fetch initial data
    const fetchAssignments = async () => {
      if (!activeTemplateId) return;
      const { data, error } = await supabase.from('assignments').select('*').eq('template_id', activeTemplateId);
      if (error) {
        console.error('Error fetching assignments:', error);
        return;
      }
      const newAssignments: SeatState = {};
      (data as AssignmentRow[])?.forEach((row) => {
        newAssignments[row.seat_id] = {
          nombre_invitado: row.nombre_invitado,
          categoria: row.categoria,
          registro_id: row.registro_id,
          asignado_en: row.assigned_at
        };
      });
      setAssignments(newAssignments);
    };

    fetchAssignments();

    // 2. Subscribe to changes
    if (!activeTemplateId) return;
    const channel = supabase
      .channel(`realtime assignments ${activeTemplateId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments', filter: `template_id=eq.${activeTemplateId}` }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as AssignmentRow;
          setAssignments(prev => ({
            ...prev,
            [row.seat_id]: {
              nombre_invitado: row.nombre_invitado,
              categoria: row.categoria,
              registro_id: row.registro_id,
              asignado_en: row.assigned_at
            }
          }));
        } else if (payload.eventType === 'DELETE') {
          const row = payload.old as { seat_id: string };
          setAssignments(prev => {
            const next = { ...prev };
            delete next[row.seat_id];
            return next;
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredSeatId, setHoveredSeatId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  // Template State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // ── Auto-save logic ──
  useEffect(() => {
    if (!activeTemplateName) return;

    const timer = setTimeout(() => {
      // Map local state back to row format
      const data = Object.entries(assignments)
        .filter(([_, a]) => !!a)
        .map(([id, a]) => ({
          seat_id: id,
          nombre_invitado: a!.nombre_invitado,
          categoria: a!.categoria,
          registro_id: a!.registro_id,
          assigned_at: a!.asignado_en,
          template_id: activeTemplateId
        }));
      if (onSaveTemplate) {
        onSaveTemplate(activeTemplateName, data);
      }
    }, 2000); // Debounce for 2 seconds

    return () => clearTimeout(timer);
  }, [assignments, activeTemplateName, onSaveTemplate]);

  // Handle Save
  const handleSaveToTemplate = async (name: string) => {
    const data = Object.entries(assignments)
      .filter(([_, a]) => !!a)
      .map(([id, a]) => ({
        seat_id: id,
        nombre_invitado: a!.nombre_invitado,
        categoria: a!.categoria,
        registro_id: a!.registro_id,
        assigned_at: a!.asignado_en,
        template_id: activeTemplateId
      }));

    if (onSaveTemplate) {
      await onSaveTemplate(name, data);
    }
  };

  const handleSaveClick = () => {
    if (activeTemplateName) {
      // Direct save if already in a template
      handleSaveToTemplate(activeTemplateName);
    } else {
      setNewTemplateName('');
      setIsSaveModalOpen(true);
    }
  };

  const confirmSave = async () => {
    if (!newTemplateName.trim()) return;
    await handleSaveToTemplate(newTemplateName);
    setIsSaveModalOpen(false);
  };

  // Removed internal handlers for load/delete since they are in parent


  const handleExport = () => {
    window.location.href = '/api/admin/export';
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Error importing');

      alert('Importación exitosa. La página se recargará para reflejar los cambios.');
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert('Error al importar el archivo.');
    } finally {
      setImporting(false);
    }
  };

  // ── Stats ──
  const totalSeats = useMemo(() => {
    return ROWS.reduce((acc, row) => acc + (row.left || 0) + (row.right || 0) + (row.center || 0), 0);
  }, []);

  const stats = useMemo(() => {
    const entries = Object.values(assignments);
    const assigned = entries.filter(Boolean).length;
    return {
      total: totalSeats,
      assigned,
      available: totalSeats - assigned,
      autoridades: entries.filter(a => a?.categoria === 'autoridad').length,
      docentes: entries.filter(a => a?.categoria === 'docente').length,
      invitados: entries.filter(a => a?.categoria === 'invitado').length,
      estudiantes: entries.filter(a => a?.categoria === 'estudiante').length,
      bloqueados: entries.filter(a => a?.categoria === 'bloqueado').length,
    };
  }, [assignments, totalSeats]);

  // ── Search ──
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return Object.entries(assignments)
      .filter(([, a]) => a?.nombre_invitado.toLowerCase().includes(q))
      .map(([seatId, a]) => ({ seatId, ...parseSeatId(seatId), assignment: a! }));
  }, [assignments, searchQuery]);

  // ── Handlers ──
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarCollapsed] = useState(false);

  const handleMapClick = useCallback((e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-seat-id]') as HTMLElement | null;
    if (!target) return;
    setSelectedSeatId(target.dataset.seatId!);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  const handleAssign = async (seatId: string, nombre: string, categoria: SeatCategory) => {
    setLoading(true);
    // Optimistic Update
    setAssignments(prev => ({
      ...prev,
      [seatId]: {
        nombre_invitado: nombre,
        categoria: categoria,
        asignado_en: new Date().toISOString()
      }
    }));
    setSelectedSeatId(null);

    const { error } = await supabase.from('assignments').upsert({
      seat_id: seatId,
      nombre_invitado: nombre,
      categoria: categoria,
      assigned_at: new Date().toISOString(),
      template_id: activeTemplateId
    });

    if (error) {
      console.error('Error:', error);
      // Rollback on error
      const { data } = await supabase.from('assignments').select('*').eq('seat_id', seatId).eq('template_id', activeTemplateId).single();
      setAssignments(prev => {
        const next = { ...prev };
        if (data) {
          next[seatId] = {
            nombre_invitado: data.nombre_invitado,
            categoria: data.categoria as SeatCategory,
            asignado_en: data.assigned_at
          };
        } else {
          delete next[seatId];
        }
        return next;
      });
    }
    setLoading(false);

    // Auto-save if in a template
    if (activeTemplateName) {
      handleSaveToTemplate(activeTemplateName);
    }
  };

  const handleRelease = async (seatId: string) => {
    setLoading(true);
    // Optimistic Update
    setAssignments(prev => {
      const next = { ...prev };
      delete next[seatId];
      return next;
    });
    setSelectedSeatId(null);

    const { error } = await supabase.from('assignments').delete().eq('seat_id', seatId).eq('template_id', activeTemplateId);

    if (error) {
      console.error('Error releasing seat:', error);
    } else {
      // Auto-save if in a template
      if (activeTemplateName) {
        handleSaveToTemplate(activeTemplateName);
      }
    }
    setLoading(false);
  };

  // ── Seat rendering helpers ──
  function seatClass(seatId: string): string {
    const a = assignments[seatId];
    if (!a) return 'seat seat-disponible';

    // Dim seats that don't match search
    const isMatch = !searchQuery.trim() || a.nombre_invitado.toLowerCase().includes(searchQuery.toLowerCase());

    // Dim "Cupo Disponible" slots for teachers so they are distinct from actual assignments
    const isTeacherSlot = a.categoria === 'docente' && (!a.registro_id || a.nombre_invitado === 'Cupo Disponible' || a.nombre_invitado === 'Reservado');
    const isTeacherDim = isTeacherSlot ? 'opacity-60 animate-pulse' : '';

    return `seat seat-${a.categoria} ${!isMatch ? 'opacity-20 grayscale' : isTeacherDim}`;
  }

  function seatTooltip(seatId: string): string {
    const info = parseSeatId(seatId);
    const a = assignments[seatId];
    if (a) return `${a.nombre_invitado}\n(${CATEGORY_CONFIG[a.categoria].label})\n${info.display}`;
    return `${info.display}\nDisponible`;
  }

  function renderSeat(seatId: string) {
    const { numero } = parseSeatId(seatId);
    const isHovered = seatId === hoveredSeatId;

    return (
      <div
        key={seatId}
        className={`${seatClass(seatId)} w-[28px] h-[34px] m-[3px] ${isHovered ? 'z-50 shadow-[0_0_20px_white] ring-2 ring-white/50 transition-all duration-200' : ''}`}
        data-seat-id={seatId}
        style={isHovered ? { filter: 'brightness(1.5)', zIndex: 9999 } : undefined}
      >
        <span className="seat-tooltip">{seatTooltip(seatId)}</span>
        <span className="absolute inset-0 flex items-center justify-center text-[15px] font-black text-white pointer-events-none z-10 select-none drop-shadow-md">
          {numero}
        </span>
        <div className="seat-cushion" />
      </div>
    );
  }

  function renderSeats(rowId: string, prefix: string, count: number, reverse = false) {
    const seats = [];
    if (reverse) {
      for (let i = count; i >= 1; i--) seats.push(renderSeat(`${rowId}-${prefix}-${i}`));
    } else {
      for (let i = 1; i <= count; i++) seats.push(renderSeat(`${rowId}-${prefix}-${i}`));
    }
    return seats;
  }

  // ── Render ──
  return (
    <div className="relative h-screen bg-[#0a0a0b] font-sans selection:bg-[#FF6900] selection:text-white overflow-hidden flex flex-col md:flex-row">
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-orange px-6 py-4 rounded-2xl shadow-[0_10_30px_rgba(255,105,0,0.4)] text-white font-black text-sm flex items-center gap-3 active:scale-95 transition-all outline-none"
      >
        {isSidebarOpen ? (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 20l-7-7 7-7m8 14l-7-7 7-7" /></svg>
            Ver Mapa
          </>
        ) : (
          <>
            <ChartBarIcon className="w-5 h-5" />
            Menú Admin
          </>
        )}
      </button>

      {/* ── Sidebar ── */}
      <aside
        className={`fixed md:relative left-0 top-0 z-50 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] bg-[#001D2D]/95 backdrop-blur-xl border-r border-white/10 flex flex-col 
          ${isSidebarCollapsed ? 'md:w-24' : 'md:w-96'} 
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} 
          w-full h-full md:h-full will-change-[width,height,transform]`}
      >
        {/* Header Section */}
        <div className="p-8 border-b border-white/5 flex flex-col gap-4 relative z-10 transition-all">
          {onBack && (
            <button
              onClick={onBack}
              className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-2 mb-2 transition-colors"
            >
              ← Volver al Menú
            </button>
          )}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-2xl font-black text-white tracking-tighter leading-none">
              {activeTemplateName || 'ADMIN'} <span className="text-orange drop-shadow-[0_0_10px_rgba(255,105,0,0.3)]">2026</span>
            </h1>
            <p className="text-[10px] font-black text-slate-500 mt-2 uppercase tracking-[3px] opacity-60">Control Central</p>
          </motion.div>
        </div>

        {!isSidebarCollapsed && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search Bar */}
            <div className="p-8 pb-4">
              <div className="relative group">
                <MagnifyingGlassIcon className={`absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${searchQuery ? 'text-orange' : 'text-slate-500 group-focus-within:text-orange'}`} />
                <input
                  type="text"
                  placeholder="Buscar invitado..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/20 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:ring-4 focus:ring-orange/10 focus:border-orange/40 transition-all outline-none placeholder:text-slate-600 font-semibold"
                />
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto sidebar-scroll px-8 py-4 space-y-10">
              {/* Metric Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-5 bg-white/[0.03] rounded-3xl border border-white/5 shadow-inner">
                  <span className="block text-2xl font-black text-white leading-none mb-1">{stats.total}</span>
                  <span className="text-[9px] uppercase text-slate-500 font-black tracking-widest opacity-60">Total</span>
                </div>
                <div className="p-5 bg-orange/5 rounded-3xl border border-orange/10">
                  <span className="block text-2xl font-black text-orange leading-none mb-1">{stats.assigned}</span>
                  <span className="text-[9px] uppercase text-orange/50 font-black tracking-widest">Ocupados</span>
                </div>
              </div>

              {/* Excel Management */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[3px] flex items-center gap-2">
                  <ChartBarIcon className="w-3.5 h-3.5" />
                  Gestión Excel
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleExport}
                    className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-[#1D754C]/20 border border-[#1D754C]/30 hover:bg-[#1D754C]/30 transition-all group"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5 text-[#25D366] group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-[#25D366]">Exportar</span>
                  </button>

                  <label className="relative flex items-center justify-center gap-2 p-4 rounded-2xl bg-white/[0.05] border border-white/10 hover:bg-white/10 transition-all group cursor-pointer">
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleImport}
                      className="hidden"
                      disabled={importing}
                    />
                    {importing ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <ArrowUpTrayIcon className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold text-white">Importar</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Search Results / List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4 px-1">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[3px] flex items-center gap-2">
                    <UserCircleIcon className="w-3.5 h-3.5" />
                    Resultados ({searchResults.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {searchResults.length === 0 ? (
                    <div className="p-10 text-center border-2 border-dashed border-white/5 rounded-[32px]">
                      <p className="text-xs text-slate-600 font-medium italic">
                        {searchQuery ? 'Sin resultados' : 'Ingresa un nombre para buscar'}
                      </p>
                    </div>
                  ) : (
                    searchResults.map((r) => (
                      <motion.button
                        layout
                        key={r.seatId}
                        onClick={() => {
                          setSelectedSeatId(r.seatId);
                          setIsSidebarOpen(false);
                        }}
                        onMouseEnter={() => setHoveredSeatId(r.seatId)}
                        onMouseLeave={() => setHoveredSeatId(null)}
                        className="w-full p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.03] hover:border-orange/20 text-left transition-all group"
                      >
                        <div className="flex justify-between items-center gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate group-hover:text-orange transition-colors">
                              {r.assignment.nombre_invitado}
                            </p>
                            <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase tracking-tighter">
                              {r.display}
                            </p>
                          </div>
                          <div
                            className="shrink-0 w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] border border-white/10"
                            style={{ backgroundColor: CATEGORY_CONFIG[r.assignment.categoria].hex }}
                          />
                        </div>
                      </motion.button>
                    ))
                  )}
                </div>
              </div>


              {/* Template Management */}
              <div className="pt-8 border-t border-white/5 space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[3px] flex items-center gap-2">
                  <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                  Gestión del Evento
                </h3>

                <button
                  onClick={handleSaveClick}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all group"
                >
                  <ArrowDownTrayIcon className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-indigo-400">Guardar Cambios</span>
                </button>
              </div>

              {/* Reference */}
              <div className="pt-8 border-t border-white/5">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[3px] mb-6">Referencia</h3>
                <div className="grid grid-cols-2 gap-4">
                  {(['autoridad', 'docente', 'invitado', 'estudiante', 'bloqueado'] as const).map(cat => (
                    <div key={cat} className="flex items-center gap-3 text-[11px] font-bold text-slate-400 p-2 rounded-xl bg-white/[0.02]">
                      <div className="w-2.5 h-2.5 rounded-full shadow-lg" style={{ backgroundColor: CATEGORY_CONFIG[cat].hex }} />
                      <span className="tracking-wide">{CATEGORY_CONFIG[cat].label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 mt-auto bg-black/30 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">En Línea</span>
              </div>
              <Link href="/reportes" className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest bg-white/5 px-4 py-2 rounded-xl transition-all">
                Reportes
              </Link>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main map area ── */}
      <main
        className="absolute inset-0 z-0 w-full h-full overflow-hidden bg-[#151517]"
        style={{
          background: 'radial-gradient(circle at 50% 120%, #1e2530 0%, #151517 60%)',
          backgroundImage: `
            radial-gradient(circle at 50% 120%, #1e2530 0%, #151517 60%),
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 40px 40px, 40px 40px'
        }}
      >
        <TransformWrapper
          initialScale={0.4}
          minScale={0.1}
          maxScale={4}
          centerOnInit
          limitToBounds={false}
          wheel={{ step: 0.2 }}
          panning={{ velocityDisabled: false }}
          doubleClick={{ disabled: false }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              {/* Controls */}
              <div className={`absolute top-8 right-8 z-40 flex flex-col gap-3 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto' : 'opacity-100'}`}>
                <div className="flex flex-col bg-[#002E45]/90 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl shadow-2xl">
                  <button onClick={() => zoomIn()} className="p-2.5 text-white hover:text-[#FF6900] hover:bg-white/10 rounded-xl transition-all" title="Acercar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                  </button>
                  <div className="h-px bg-white/10 w-4/5 mx-auto my-0.5" />
                  <button onClick={() => zoomOut()} className="p-2.5 text-white hover:text-[#FF6900] hover:bg-white/10 rounded-xl transition-all" title="Alejar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                  </button>
                </div>

                <button onClick={() => resetTransform()} className="bg-[#002E45]/90 backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-xl text-white hover:text-[#FF6900] hover:bg-white/10 transition-all group">
                  <svg className="group-hover:rotate-180 transition-transform duration-500" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                </button>
              </div>

              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', willChange: 'transform' }}
              >
                <div className="p-40 min-w-fit cursor-grab active:cursor-grabbing" onClick={handleMapClick}>
                  <div className="flex flex-col items-center">

                    {/* ── TOP SECTION: Flanks & Cabina ── */}
                    <div className="flex items-end gap-16 mb-20">
                      {/* Left Flank */}
                      <div className="w-48 flex justify-end">
                        <div className="flex flex-col gap-1 items-end">
                          {ROWS.filter(r => r.type === 'cabin-flank').map(row => (
                            <div key={row.id} className="flex gap-1">
                              {renderSeats(row.id, 'CL', row.left!, false)}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* CABINA */}
                      <div className="w-64 h-16 bg-black border border-white/40 flex items-center justify-center mb-[-0.25rem] shadow-[0_-5px_20px_rgba(255,255,255,0.05)] relative z-20 rounded-t-lg">
                        <span className="text-sm font-black tracking-[0.2em] text-white drop-shadow-md">CABINA</span>
                      </div>

                      {/* Right Flank */}
                      <div className="w-48 flex justify-start">
                        <div className="flex flex-col gap-1 items-start">
                          {ROWS.filter(r => r.type === 'cabin-flank').map(row => (
                            <div key={row.id} className="flex gap-1">
                              {renderSeats(row.id, 'CR', row.right!, true)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>


                    {/* ── MAIN SECTION: Wings | Doors | Block Left | Center | Block Right ── */}
                    <div className="flex gap-4 relative">

                      {/* Left Side Group (Wing + Door) */}
                      <div className="absolute -left-80 top-[-130px] w-80 flex flex-col items-start gap-24">
                        {/* Left Wing & Emergency Door (Placed in the gap) */}
                        <div className="flex items-center gap-8 h-full">
                          <div className="flex flex-col gap-1 items-start">
                            <div className="flex gap-1">{renderSeats('W', 'WL', 7, false)}</div>
                            <div className="flex gap-1">
                              {Array.from({ length: 7 }).map((_, i) => (
                                <div key={`WL2-${i + 1}`}>{renderSeat(`W-WL2-${i + 1}`)}</div>
                              ))}
                            </div>
                          </div>
                          <div className="px-4 py-2 border-2 border-red-500/60 bg-red-500/20 rounded-md flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:bg-red-500/30 transition-colors cursor-default">
                            <span className="text-red-400 text-[11px] font-black uppercase whitespace-nowrap tracking-[2px] drop-shadow-sm">P. Emergencia</span>
                          </div>
                        </div>

                        {/* ENTRADA Marker */}
                        <div className="h-14 w-[262px] border-2 border-white/30 flex items-center justify-center bg-[#151517]/90 backdrop-blur-md shadow-lg rounded-sm">
                          <span className="text-white/80 text-sm font-black tracking-[6px] uppercase drop-shadow-md">ENTRADA</span>
                        </div>
                      </div>

                      {/* Right Side Group (Wing + Door) */}
                      <div className="absolute -right-80 top-[-130px] w-80 flex flex-col items-end gap-24">
                        {/* Right Wing & Emergency Door (Placed in the gap) */}
                        <div className="flex items-center gap-8 h-full">
                          <div className="px-4 py-2 border-2 border-red-500/60 bg-red-500/20 rounded-md flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:bg-red-500/30 transition-colors cursor-default">
                            <span className="text-red-400 text-[11px] font-black uppercase whitespace-nowrap tracking-[2px] drop-shadow-sm">P. Emergencia</span>
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            <div className="flex gap-1">{renderSeats('W', 'WR', 7, true)}</div>
                            <div className="flex gap-1">
                              {Array.from({ length: 7 }).map((_, i) => (
                                <div key={`WR2-${7 - i}`}>{renderSeat(`W-WR2-${7 - i}`)}</div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* SALIDA Marker */}
                        <div className="h-14 w-[262px] border-2 border-white/30 flex items-center justify-center bg-[#151517]/90 backdrop-blur-md shadow-lg rounded-sm">
                          <span className="text-white/80 text-sm font-black tracking-[6px] uppercase drop-shadow-md">SALIDA</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 items-start">
                        {ROWS.filter(r => !r.type && !r.center).map(row => (row.id !== 'W' && row.id !== 'CB') && (
                          <div key={row.id} className="flex gap-4 items-center">
                            <span className="text-[11px] font-black text-slate-500 w-6 h-6 flex items-center justify-center rounded-full bg-white/5 border border-white/5 transition-colors group-hover:border-orange/20">
                              {row.label}
                            </span>
                            <div className="flex gap-1 items-end">
                              {/* Wall Offset */}
                              {Array.from({ length: row.leftWallOffset || 0 }).map((_, i) => (
                                <div key={`lwo-${i}`} className="w-[28px] h-[34px] m-[3px] invisible" />
                              ))}
                              {renderSeats(row.id, 'L', row.left!, false)}
                              {/* Aisle Offset */}
                              {Array.from({ length: row.leftAisleOffset || 0 }).map((_, i) => (
                                <div key={`lao-${i}`} className="w-[28px] h-[34px] m-[3px] invisible" />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Center Aisle */}
                      <div className="w-20 flex flex-col justify-end items-center pb-2 relative">
                        <div className="absolute bottom-0 w-full flex justify-between px-1 text-[8px] font-bold text-slate-500 opacity-50">
                          <span>&larr;</span>
                          <span>168 ALA</span>
                          <span>&rarr;</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 items-end">
                        {ROWS.filter(r => !r.type && !r.center).map(row => (row.id !== 'W' && row.id !== 'CB') && (
                          <div key={row.id} className="flex gap-4 items-center">
                            <div className="flex gap-1 items-end">
                              {/* Aisle Offset */}
                              {Array.from({ length: row.rightAisleOffset || 0 }).map((_, i) => (
                                <div key={`rao-${i}`} className="w-[28px] h-[34px] m-[3px] invisible" />
                              ))}
                              {renderSeats(row.id, 'R', row.right!, true)}
                              {/* Wall Offset */}
                              {Array.from({ length: row.rightWallOffset || 0 }).map((_, i) => (
                                <div key={`rwo-${i}`} className="w-[28px] h-[34px] m-[3px] invisible" />
                              ))}
                            </div>
                            <span className="text-[11px] font-black text-slate-500 w-6 h-6 flex items-center justify-center rounded-full bg-white/5 border border-white/5">
                              {row.label}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Vertical PE markers aligned to Row 1 (Bottom up) */}
                      <div className="absolute -left-80 bottom-0 h-40 w-10 border-2 border-red-500/60 bg-red-500/20 rounded-md flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:bg-red-500/30 transition-colors cursor-default">
                        <span className="text-red-400 text-[11px] font-black uppercase rotate-90 whitespace-nowrap tracking-[3px] drop-shadow-sm">P. Emergencia</span>
                      </div>
                      <div className="absolute -right-80 bottom-0 h-40 w-10 border-2 border-red-500/60 bg-red-500/20 rounded-md flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:bg-red-500/30 transition-colors cursor-default">
                        <span className="text-red-400 text-[11px] font-black uppercase -rotate-90 whitespace-nowrap tracking-[3px] drop-shadow-sm">P. Emergencia</span>
                      </div>
                    </div>


                    {/* ── BOTTOM SECTION: Center Row ── */}
                    <div className="mt-16 flex flex-col items-center">
                      {ROWS.filter(r => r.type === 'center').map(row => (
                        <div key={row.id} className="flex gap-1 mb-6 border-t border-b border-white/5 py-2 px-6">
                          {renderSeats(row.id, 'C', row.center!, false)}
                        </div>
                      ))}

                      <div className="flex flex-col items-center gap-2 group cursor-default opacity-80 hover:opacity-100 transition-opacity">
                        <div className="w-[500px] border-t-2 border-double border-white/30 my-2 shadow-[0_0_15px_rgba(255,255,255,0.1)]" />
                        <span className="text-xs font-black tracking-[8px] text-white/70 uppercase drop-shadow-sm">
                          Pantalla LED
                        </span>
                        <div className="w-[500px] border-b-2 border-double border-white/30 my-2 shadow-[0_0_15px_rgba(255,255,255,0.1)]" />
                      </div>
                    </div>

                  </div>
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </main>

      {/* ── Assignment Modal ── */}
      {
        selectedSeatId && (
          <AssignmentModal
            seatId={selectedSeatId}
            assignment={assignments[selectedSeatId]}
            onAssign={handleAssign}
            onRelease={handleRelease}
            onClose={() => setSelectedSeatId(null)}
            loading={loading}
          />
        )
      }

      {/* Save Template Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#001D2D] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Guardar Plantilla</h3>
            <input
              type="text"
              placeholder="Nombre de la plantilla (ej. Graduación 2026)"
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2 text-slate-400 hover:text-white font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={confirmSave}
                disabled={!newTemplateName.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}
