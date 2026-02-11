'use client';

import { useState, useCallback, useMemo, Fragment, useEffect, useRef } from 'react';
import Link from 'next/link';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { SeatState, SeatCategory, SeatAssignment } from '@/lib/types';
import { ROWS, parseSeatId, CATEGORY_CONFIG } from '@/lib/seats-data';
import { AssignmentModal } from './AssignmentModal';
import { supabase } from '@/lib/supabase';

export function AuditoriumView() {
  const [assignments, setAssignments] = useState<SeatState>({});

  // ── Supabase Realtime & Fetch ──
  useEffect(() => {
    // 1. Fetch initial data
    const fetchAssignments = async () => {
      const { data, error } = await supabase.from('assignments').select('*');
      if (error) {
        console.error('Error fetching assignments:', error);
        return;
      }
      const newAssignments: SeatState = {};
      data?.forEach((row: any) => {
        newAssignments[row.seat_id] = {
          nombre_invitado: row.nombre_invitado,
          categoria: row.categoria,
          asignado_en: row.assigned_at
        };
      });
      setAssignments(newAssignments);
    };

    fetchAssignments();

    // 2. Subscribe to changes
    const channel = supabase
      .channel('realtime assignments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as any;
          setAssignments(prev => ({
            ...prev,
            [row.seat_id]: {
              nombre_invitado: row.nombre_invitado,
              categoria: row.categoria,
              asignado_en: row.assigned_at
            }
          }));
        } else if (payload.eventType === 'DELETE') {
          const row = payload.old as any;
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
  const transformComponentRef = useRef<any | null>(null);

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleMapClick = useCallback((e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-seat-id]') as HTMLElement | null;
    if (!target) return;
    setSelectedSeatId(target.dataset.seatId!);
  }, []);

  const handleAssign = useCallback(async (seatId: string, nombre: string, categoria: SeatCategory) => {
    // Optimistic update
    setAssignments(prev => ({
      ...prev,
      [seatId]: { nombre_invitado: nombre, categoria, asignado_en: new Date().toISOString() },
    }));
    setSelectedSeatId(null);

    // Supabase upsert
    const { error } = await supabase.from('assignments').upsert({
      seat_id: seatId,
      nombre_invitado: nombre,
      categoria: categoria,
      assigned_at: new Date().toISOString()
    });

    if (error) {
      console.error('Error assigning seat:', error);
      // Revert optimization if needed (omitted for brevity)
    }
  }, []);

  const handleRelease = useCallback(async (seatId: string) => {
    // Optimistic update
    setAssignments(prev => {
      const next = { ...prev };
      delete next[seatId];
      return next;
    });
    setSelectedSeatId(null);

    // Supabase delete
    const { error } = await supabase.from('assignments').delete().eq('seat_id', seatId);

    if (error) {
      console.error('Error releasing seat:', error);
    }
  }, []);

  // ── Seat rendering helpers ──
  function seatClass(seatId: string): string {
    const a = assignments[seatId];
    if (!a) return 'seat seat-disponible';
    // Removed 'is-occupied' to prevent dimming, keeping category class for color
    return `seat seat-${a.categoria}`;
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
        className={`${seatClass(seatId)} ${isHovered ? 'z-50 scale-[2.5] shadow-[0_0_30px_white] ring-4 ring-white transition-transform duration-200 ease-out' : ''}`}
        data-seat-id={seatId}
        style={isHovered ? { filter: 'brightness(1.5)', zIndex: 9999 } : undefined}
      >
        <span className="seat-tooltip">{seatTooltip(seatId)}</span>
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white pointer-events-none z-10 select-none drop-shadow-md">
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
    return <div className="flex items-end gap-1">{seats}</div>;
  }

  // ── Render ──
  return (
    <div className="relative h-screen bg-[#1a1a1c] font-sans selection:bg-[#FF6900] selection:text-white overflow-hidden">
      {/* ── Sidebar ── */}
      <aside
        className={`fixed md:absolute left-0 top-0 z-50 shadow-2xl transition-[width,height,transform] duration-300 ease-in-out bg-[#002E45] border-r border-white/5 flex flex-col 
          ${isSidebarCollapsed ? 'md:w-20' : 'md:w-80'} 
          ${isMobileMenuOpen ? 'w-full h-full' : 'w-full h-auto overflow-visible'} 
          md:h-full will-change-[width,height]`}
      >
        {/* Header */}
        {/* Header */}
        <div className={`p-4 border-b border-white/5 flex flex-row justify-between items-center relative z-10 transition-all bg-[#002E45]`}>
          {!isSidebarCollapsed && (
            <div className="transition-opacity duration-200">
              <h1 className="text-xl font-serif font-black text-white tracking-tight leading-none">
                Graduación <span className="text-[#FF6900]">2026</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-[2px]">Sistema de Asignación</p>
            </div>
          )}

          {/* Logo/Icon when collapsed */}
          {isSidebarCollapsed && (
            <div className="text-2xl animate-in fade-in zoom-in duration-300">🎓</div>
          )}

          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`hidden md:flex p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors ${isSidebarCollapsed ? 'rotate-180' : ''}`}
            title={isSidebarCollapsed ? "Mostrar menú" : "Ocultar menú"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>

          {/* Mobile Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden ml-auto p-2 text-slate-300 hover:text-[#FF6900] transition-colors focus:outline-none"
          >
            {isMobileMenuOpen ? <span className="text-xl">✕</span> : <span className="text-xl">☰</span>}
          </button>
        </div>

        {/* Minimized Content */}
        {isSidebarCollapsed && (
          <div className="hidden md:flex flex-col items-center gap-6 mt-8 px-2">
            {/* Mini Stats */}
            <div className="flex flex-col gap-4 w-full">
              <div className="text-center">
                <span className="block text-lg font-black text-[#FF6900]">{stats.assigned}</span>
                <span className="text-[8px] uppercase text-slate-500 font-bold">Ocupados</span>
              </div>

              <div className="w-8 h-px bg-white/10 mx-auto" />

              <div className="text-center">
                <span className="block text-lg font-black text-emerald-400">{stats.available}</span>
                <span className="text-[8px] uppercase text-emerald-400/60 font-bold">Libres</span>
              </div>
            </div>
          </div>
        )}

        {/* Expanded Content */}
        <div className={`${isMobileMenuOpen ? 'flex' : 'hidden'} ${isSidebarCollapsed ? 'md:hidden' : 'md:flex'} flex-col flex-1 overflow-y-auto sidebar-scroll h-[calc(100vh-65px)] md:h-auto absolute md:relative w-full bg-[#002E45]/98 backdrop-blur-xl md:bg-transparent top-[65px] md:top-0 z-40 animate-in slide-in-from-top-5 duration-200`}>
          {/* Navigation */}
          <div className="px-6 py-5 border-b border-white/5 flex gap-3">
            <button className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#FF6900] text-white shadow-[0_0_15px_rgba(255,105,0,0.3)] transition-transform active:scale-95">
              Mapa en vivo
            </button>
            <Link
              href="/reportes"
              className="flex-1 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 border border-white/5 text-center transition-all active:scale-95"
            >
              Reportes
            </Link>
          </div>

          {/* Search */}
          <div className="p-6 border-b border-white/5">
            <div className="relative group">
              <input
                type="text"
                placeholder="Buscar invitado..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3.5 pl-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#FF6900]/50 focus:bg-black/30 transition-all shadow-inner"
              />
              <span className="absolute left-3 top-3.5 text-slate-500 group-focus-within:text-[#FF6900] transition-colors">🔍</span>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {searchResults.map(r => (
                  <button
                    key={r.seatId}
                    onClick={() => {
                      setSelectedSeatId(r.seatId);
                      setIsMobileMenuOpen(false);
                    }}
                    onMouseEnter={() => setHoveredSeatId(r.seatId)}
                    onMouseLeave={() => setHoveredSeatId(null)}
                    className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/5 group transition-all"
                  >
                    <span className="font-bold text-white group-hover:text-[#FF6900] transition-colors block">{r.assignment.nombre_invitado}</span>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] text-slate-400">{r.display}</span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded bg-opacity-20 text-white"
                        style={{ backgroundColor: `${CATEGORY_CONFIG[r.assignment.categoria].hex}40`, color: CATEGORY_CONFIG[r.assignment.categoria].hex }}
                      >
                        {CATEGORY_CONFIG[r.assignment.categoria].label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="p-4 md:p-6 border-b border-white/5">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Referencia</h3>
            <div className="grid grid-cols-2 gap-x-2 gap-y-3">
              {(['autoridad', 'docente', 'invitado'] as const).map(cat => (
                <div key={cat} className="flex items-center gap-3 text-sm text-slate-300">
                  <div
                    className="w-3 h-3 rounded-full shadow-lg"
                    style={{ backgroundColor: CATEGORY_CONFIG[cat].hex, boxShadow: `0 0 10px ${CATEGORY_CONFIG[cat].hex}` }}
                  />
                  <span className="opacity-80 font-medium">{CATEGORY_CONFIG[cat].label}</span>
                </div>
              ))}
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]" style={{ background: 'linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)' }} />
                <span className="opacity-60 font-medium">Disponible</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="p-4 md:p-6 border-b border-white/5">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Métricas</h3>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="p-3 bg-gradient-to-br from-white/5 to-white/[0.02] rounded-2xl border border-white/5 text-center shadow-lg">
                <span className="block text-2xl font-black text-white">{stats.total}</span>
                <span className="text-[9px] uppercase text-slate-500 font-bold tracking-wider">Total</span>
              </div>
              <div className="p-3 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-2xl border border-emerald-500/10 text-center shadow-lg">
                <span className="block text-2xl font-black text-emerald-400">{stats.available}</span>
                <span className="text-[9px] uppercase text-emerald-400/60 font-bold tracking-wider">Libres</span>
              </div>
              <div className="p-3 bg-gradient-to-br from-[#FF6900]/10 to-transparent rounded-2xl border border-[#FF6900]/10 text-center shadow-lg">
                <span className="block text-2xl font-black text-[#FF6900]">{stats.assigned}</span>
                <span className="text-[9px] uppercase text-[#FF6900]/60 font-bold tracking-wider">Ocupados</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1">
              <div className="p-1 px-2 bg-black/20 rounded-xl border border-white/5 text-center transition-colors hover:bg-white/5">
                <span className="block text-lg font-black text-purple-500">{stats.autoridades}</span>
                <span className="block text-[9px] text-slate-300 font-bold uppercase tracking-tight mt-0.5 truncate">Autoridad</span>
              </div>
              <div className="p-1 px-2 bg-black/20 rounded-xl border border-white/5 text-center transition-colors hover:bg-white/5">
                <span className="block text-lg font-black text-sky-500">{stats.docentes}</span>
                <span className="block text-[9px] text-slate-300 font-bold uppercase tracking-tight mt-0.5 truncate">Docente</span>
              </div>
              <div className="p-1 px-2 bg-black/20 rounded-xl border border-white/5 text-center transition-colors hover:bg-white/5">
                <span className="block text-lg font-black text-green-500">{stats.invitados}</span>
                <span className="block text-[9px] text-slate-300 font-bold uppercase tracking-tight mt-0.5 truncate">Invitado</span>
              </div>
            </div>
          </div>

          {/* Connection indicator */}
          <div className="p-6 mt-auto bg-black/20 border-t border-white/5">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
              </span>
              <div>
                <p className="text-xs font-bold text-white">Sistema Online</p>
                <p className="text-[10px] text-emerald-500/80 font-mono">Sincronizado</p>
              </div>
            </div>
          </div>
        </div>
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
          initialScale={1} // Zoomed in for better visibility
          minScale={0.2}
          maxScale={4}
          centerOnInit
          limitToBounds={false}
          wheel={{ step: 0.2 }} // Increased step for faster zoom
          panning={{ velocityDisabled: false }} // Enable momentum for smoother feel
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              {/* Controls */}
              <div className="absolute top-28 right-4 md:top-8 md:right-8 z-50 flex flex-col gap-3">
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
                      <div className="w-64 h-16 bg-black border border-white/20 flex items-center justify-center mb-[-0.25rem] shadow-2xl relative z-20 rounded-t-lg">
                        <span className="text-xs font-black tracking-widest text-slate-300">CABINA</span>
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
                          <div className="px-4 py-2 border-2 border-red-500/40 bg-red-500/10 rounded-md flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                            <span className="text-red-500/60 text-[10px] font-black uppercase whitespace-nowrap tracking-[2px]">P. Emergencia</span>
                          </div>
                        </div>

                        {/* ENTRADA Marker */}
                        <div className="h-12 w-[262px] border-2 border-white/10 flex items-center justify-center bg-[#151517]/80 backdrop-blur-sm">
                          <span className="text-white/40 text-xs font-black tracking-[4px] uppercase">ENTRADA</span>
                        </div>
                      </div>

                      {/* Right Side Group (Wing + Door) */}
                      <div className="absolute -right-80 top-[-130px] w-80 flex flex-col items-end gap-24">
                        {/* Right Wing & Emergency Door (Placed in the gap) */}
                        <div className="flex items-center gap-8 h-full">
                          <div className="px-4 py-2 border-2 border-red-500/40 bg-red-500/10 rounded-md flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                            <span className="text-red-500/60 text-[10px] font-black uppercase whitespace-nowrap tracking-[2px]">P. Emergencia</span>
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
                        <div className="h-12 w-[262px] border-2 border-white/10 flex items-center justify-center bg-[#151517]/80 backdrop-blur-sm">
                          <span className="text-white/40 text-xs font-black tracking-[4px] uppercase">SALIDA</span>
                        </div>
                      </div>

                      {/* Left Main Block */}
                      <div className="flex flex-col gap-1 items-start">
                        {ROWS.filter(r => !r.type && !r.center).map(row => (row.id !== 'W' && row.id !== 'CB') && (
                          <div key={row.id} className="flex gap-3 items-center">
                            <span className="text-[9px] font-mono text-slate-600 w-4 text-right">{row.label}</span>
                            {renderSeats(row.id, 'L', row.left!, false)}
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

                      {/* Right Main Block */}
                      <div className="flex flex-col gap-1 items-end">
                        {ROWS.filter(r => !r.type && !r.center).map(row => (row.id !== 'W' && row.id !== 'CB') && (
                          <div key={row.id} className="flex gap-3 items-center">
                            {renderSeats(row.id, 'R', row.right!, true)}
                            <span className="text-[9px] font-mono text-slate-600 w-4 text-left">{row.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Vertical PE markers aligned to Row 1 (Bottom up) */}
                      <div className="absolute -left-80 bottom-0 h-40 w-10 border-2 border-red-500/40 bg-red-500/10 rounded-md flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                        <span className="text-red-500/60 text-[10px] font-black uppercase rotate-90 whitespace-nowrap tracking-[3px]">P. Emergencia</span>
                      </div>
                      <div className="absolute -right-80 bottom-0 h-40 w-10 border-2 border-red-500/40 bg-red-500/10 rounded-md flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                        <span className="text-red-500/60 text-[10px] font-black uppercase -rotate-90 whitespace-nowrap tracking-[3px]">P. Emergencia</span>
                      </div>
                    </div>


                    {/* ── BOTTOM SECTION: Center Row ── */}
                    <div className="mt-16 flex flex-col items-center">
                      {ROWS.filter(r => r.type === 'center').map(row => (
                        <div key={row.id} className="flex gap-1 mb-6 border-t border-b border-white/5 py-2 px-6">
                          {renderSeats(row.id, 'C', row.center!, false)}
                        </div>
                      ))}

                      {/* Screen */}
                      <div className="flex flex-col items-center gap-2 group cursor-default">
                        <div className="w-[500px] border-t-2 border-double border-white/20 my-2" />
                        <span className="text-[10px] font-black tracking-[6px] text-white/40 uppercase">
                          Pantalla LED
                        </span>
                        <div className="w-[500px] border-b-2 border-double border-white/20 my-2" />
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
      {selectedSeatId && (
        <AssignmentModal
          seatId={selectedSeatId}
          assignment={assignments[selectedSeatId]}
          onAssign={handleAssign}
          onRelease={handleRelease}
          onClose={() => setSelectedSeatId(null)}
        />
      )}
    </div>
  );
}
