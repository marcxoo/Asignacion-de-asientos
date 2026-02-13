'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { SeatState, SeatCategory, Registro } from '@/lib/types';
import { ROWS, parseSeatId, CATEGORY_CONFIG, TEACHER_SLOT_LABEL } from '@/lib/seats-data';
import { PublicSeatModal } from './PublicSeatModal';
import { supabase } from '@/lib/supabase';
import {
  UserCircleIcon,
  MapPinIcon,
  ChartBarIcon,
  InformationCircleIcon,
  TicketIcon,
  ClipboardDocumentIcon,
  KeyIcon,
  CheckBadgeIcon,
  ArrowRightStartOnRectangleIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface PublicAuditoriumViewProps {
  me: Registro;
  templateId: string;
  templateName?: string;
}

export function PublicAuditoriumView({ me, templateId, templateName }: PublicAuditoriumViewProps) {
  const [assignments, setAssignments] = useState<SeatState>({});

  useEffect(() => {
    const fetchAssignments = async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select('seat_id, nombre_invitado, categoria, assigned_at, registro_id')
        .eq('template_id', templateId);
      if (error) {
        console.error('Error fetching assignments:', error);
        return;
      }
      const next: SeatState = {};
      data?.forEach((row: { seat_id: string; nombre_invitado: string; categoria: string; assigned_at: string; registro_id?: string | null }) => {
        next[row.seat_id] = {
          nombre_invitado: row.nombre_invitado,
          categoria: row.categoria as SeatCategory,
          asignado_en: row.assigned_at,
          registro_id: row.registro_id ?? undefined,
        };
      });
      setAssignments(next);
    };

    fetchAssignments();

    const channel = supabase
      .channel(`public assignments ${templateId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments', filter: `template_id=eq.${templateId}` }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as { seat_id: string; nombre_invitado: string; categoria: string; assigned_at: string; registro_id?: string | null };
          setAssignments(prev => ({
            ...prev,
            [row.seat_id]: {
              nombre_invitado: row.nombre_invitado,
              categoria: row.categoria as SeatCategory,
              asignado_en: row.assigned_at,
              registro_id: row.registro_id ?? undefined,
            },
          }));
        } else if (payload.eventType === 'DELETE') {
          const row = payload.old as { seat_id: string };
          setAssignments(prev => {
            const n = { ...prev };
            delete n[row.seat_id];
            return n;
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [hoveredSeatId, setHoveredSeatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const mySeatId = useMemo(() => {
    return Object.entries(assignments).find(([, a]) => a?.registro_id === me.id)?.[0] ?? null;
  }, [assignments, me.id]);

  // ... inside PublicAuditoriumView

  const handleMapClick = useCallback((e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-seat-id]') as HTMLElement | null;
    if (!target) return;

    const seatId = target.dataset.seatId!;
    const assignment = assignments[seatId];

    // Logic for Teachers
    const isTeacherSlot = assignment?.categoria === 'docente' && (!assignment?.registro_id || assignment?.nombre_invitado === 'Cupo Disponible' || assignment?.nombre_invitado === 'Reservado');
    const isGuestSlot = assignment?.categoria === 'invitado' && (!assignment?.registro_id || assignment?.nombre_invitado === 'Cupo Disponible' || assignment?.nombre_invitado === 'Reservado');
    const isStudentSlot = assignment?.categoria === 'estudiante' && (!assignment?.registro_id || assignment?.nombre_invitado === 'Cupo Disponible' || assignment?.nombre_invitado === 'Reservado');

    if (me.categoria === 'docente') {
      if (!isTeacherSlot) return;
    } else if (me.categoria === 'invitado') {
      if (assignment && !isGuestSlot) return;
    } else if (me.categoria === 'estudiante') {
      if (assignment && !isStudentSlot) return;
    } else {
      if (assignment) return;
    }

    setSelectedSeatId(seatId);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [assignments, me.categoria]);

  const handleAssign = useCallback(async () => {
    if (!selectedSeatId) return;
    setLoading(true);

    // Optimistic update
    const seatId = selectedSeatId;
    setAssignments(prev => {
      const next = { ...prev };
      // Liberar cualquier asiento anterior que tuviera este usuario
      Object.keys(next).forEach(key => {
        if (next[key]?.registro_id === me.id) {
          if (me.categoria === 'docente') {
            // Revertir a Cupo Disponible
            next[key] = {
              nombre_invitado: 'Cupo Disponible',
              categoria: 'docente',
              asignado_en: new Date().toISOString(),
              registro_id: null // Ensure no one owns it
            };
          } else {
            delete next[key];
          }
        }
      });
      // Asignar el nuevo
      next[seatId] = {
        nombre_invitado: me.nombre,
        categoria: me.categoria,
        asignado_en: new Date().toISOString(),
        registro_id: me.id
      };
      return next;
    });

    try {
      const res = await fetch('/api/asiento/asignar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat_id: seatId, template_id: templateId }),
      });

      if (!res.ok) {
        // Rollback if error
        const { data } = await supabase.from('assignments').select('*').eq('seat_id', seatId).eq('template_id', templateId).single();
        setAssignments(prev => {
          const next = { ...prev };
          if (data) {
            next[seatId] = {
              nombre_invitado: data.nombre_invitado,
              categoria: data.categoria as SeatCategory,
              asignado_en: data.assigned_at,
              registro_id: data.registro_id
            };
          } else {
            delete next[seatId];
          }
          return next;
        });
      }
      setSelectedSeatId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedSeatId, me]);

  const handleRelease = useCallback(async () => {
    if (!selectedSeatId) return;
    setLoading(true);

    // Optimistic update
    const seatId = selectedSeatId;
    setAssignments(prev => {
      const n = { ...prev };
      if (me.categoria === 'docente') {
        // Revert triggers to Cupo Disponible
        n[seatId] = {
          nombre_invitado: 'Cupo Disponible',
          categoria: 'docente',
          asignado_en: new Date().toISOString(),
          registro_id: null
        };
      } else {
        delete n[seatId];
      }
      return n;
    });

    try {
      const res = await fetch('/api/asiento/liberar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat_id: seatId }),
      });

      if (!res.ok) {
        // Rollback: fetch the real state
        const { data } = await supabase.from('assignments').select('*').eq('seat_id', seatId).single();
        if (data) {
          setAssignments(prev => ({
            ...prev,
            [seatId]: {
              nombre_invitado: data.nombre_invitado,
              categoria: data.categoria as SeatCategory,
              asignado_en: data.assigned_at,
              registro_id: data.registro_id
            }
          }));
        }
      }
      setSelectedSeatId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedSeatId]);

  function seatClass(seatId: string): string {
    const a = assignments[seatId];
    if (!a) return 'seat seat-disponible';
    return `seat seat-${a.categoria}`;
  }

  function seatTooltip(seatId: string): string {
    const info = parseSeatId(seatId);
    const a = assignments[seatId];

    if (a?.categoria === 'bloqueado') {
      return `${info.display}\nReservado / No Disponible`;
    }

    // Teacher Slot
    const isTeacherSlot = a?.categoria === 'docente' && (!a?.registro_id || a?.nombre_invitado === 'Cupo Disponible' || a?.nombre_invitado === 'Reservado');
    if (isTeacherSlot) {
      if (me.categoria === 'docente') return `${info.display}\n¡Cupo Disponible Docente! Clic para elegir`;
      return `${info.display}\nReservado para Docentes`;
    }

    const isMine = a?.registro_id === me.id;
    if (a) return `${a.nombre_invitado}${isMine ? ' (tú)' : ''}\n(${CATEGORY_CONFIG[a.categoria].label})\n${info.display}`;
    return `${info.display}\nDisponible`;
  }

  // ... inside renderSeat loop
  // Need to update the data-seat-id logic or ensure handleMapClick handles it.
  // Better to control visual interaction via CSS class (cursor-pointer vs not allowed)

  function renderSeat(seatId: string) {
    const { numero } = parseSeatId(seatId);
    const isHovered = seatId === hoveredSeatId;
    const isMySeat = seatId === mySeatId;
    const assignment = assignments[seatId];

    // Determine if selectable
    let isSelectable = false;
    let isBlocked = false;

    const isTeacherSlot = assignment?.categoria === 'docente' && (!assignment?.registro_id || assignment?.nombre_invitado === 'Cupo Disponible' || assignment?.nombre_invitado === 'Reservado');
    const isGuestSlot = assignment?.categoria === 'invitado' && (!assignment?.registro_id || assignment?.nombre_invitado === 'Cupo Disponible' || assignment?.nombre_invitado === 'Reservado');
    const isStudentSlot = assignment?.categoria === 'estudiante' && (!assignment?.registro_id || assignment?.nombre_invitado === 'Cupo Disponible' || assignment?.nombre_invitado === 'Reservado');

    if (me.categoria === 'docente') {
      if (isTeacherSlot || isMySeat) isSelectable = true;
      else isBlocked = true;
    } else if (me.categoria === 'invitado') {
      if (!assignment || isGuestSlot || isMySeat) isSelectable = true;
      else isBlocked = true;
    } else if (me.categoria === 'estudiante') {
      if (!assignment || isStudentSlot || isMySeat) isSelectable = true;
      else isBlocked = true;
    } else {
      if (!assignment || isMySeat) isSelectable = true;
      else isBlocked = true;
    }

    if (assignment?.categoria === 'bloqueado') isBlocked = true;

    const isSlot = isTeacherSlot || isGuestSlot || isStudentSlot;

    return (
      <div
        key={seatId}
        className={`${seatClass(seatId)} md:w-[28px] md:h-[34px] md:m-[3px] w-[32px] h-[38px] m-[4px] 
          ${isHovered && !isBlocked ? 'z-50 shadow-[0_0_20px_white] ring-2 ring-white/50 transition-all duration-200 scale-110' : ''}
          ${isMySeat ? 'z-40 ring-2 ring-white shadow-[0_0_15px_rgba(255,255,255,0.8)] scale-110' : ''}
          ${isSlot && !isMySeat ? (isSelectable ? 'opacity-80 animate-pulse' : 'opacity-40 grayscale-[0.2]') : ''}
          ${!isSelectable && !isMySeat && !isSlot ? 'opacity-40 grayscale-[0.3] cursor-not-allowed' : (isSelectable ? 'cursor-pointer' : 'cursor-not-allowed')}
        `}
        data-seat-id={isSelectable ? seatId : undefined}
        onMouseEnter={() => isSelectable && setHoveredSeatId(seatId)}
        onMouseLeave={() => setHoveredSeatId(null)}
        style={isHovered || isMySeat ? { filter: isHovered ? 'brightness(1.5)' : 'brightness(1.1)', zIndex: isHovered ? 9999 : 50 } : undefined}
      >

        <span className="seat-tooltip">{seatTooltip(seatId)}</span>
        <span className="absolute inset-0 flex items-center justify-center text-[16px] font-black text-white pointer-events-none z-10 select-none drop-shadow-md shadow-black">
          {numero}
        </span>
        <div className="seat-cushion" />
        {isMySeat && (
          <>
            <div
              className="beacon-ring"
              style={
                {
                  '--beacon-color': CATEGORY_CONFIG[me.categoria].hex,
                } as React.CSSProperties
              }
            />
            <div
              className="beacon-ring"
              style={
                {
                  '--beacon-color': CATEGORY_CONFIG[me.categoria].hex,
                  animationDelay: '0.5s',
                } as React.CSSProperties
              }
            />
          </>
        )}
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

  const totalSeats = useMemo(() => ROWS.reduce((acc, row) => acc + (row.left || 0) + (row.right || 0) + (row.center || 0), 0), []);
  const stats = useMemo(() => {
    const entries = Object.values(assignments);
    const assigned = entries.filter(Boolean).length;
    // Blocked seats are considered assigned for the purpose of "available" count, but maybe we want to distinguish them?
    // For now, let's just say available = total - assigned (which includes blocked)
    return { total: totalSeats, assigned, available: totalSeats - assigned };
  }, [assignments, totalSeats]);

  const selectedAssignment = selectedSeatId ? assignments[selectedSeatId] : undefined;
  const isMine = selectedSeatId && selectedAssignment?.registro_id === me.id;

  const isModalSelectable = useMemo(() => {
    if (!selectedSeatId) return false;
    const assignment = assignments[selectedSeatId];
    const isTeacherSlot = assignment?.categoria === 'docente' && (!assignment?.registro_id || assignment?.nombre_invitado === 'Cupo Disponible' || assignment?.nombre_invitado === 'Reservado');
    const isGuestSlot = assignment?.categoria === 'invitado' && (!assignment?.registro_id || assignment?.nombre_invitado === 'Cupo Disponible' || assignment?.nombre_invitado === 'Reservado');
    const isStudentSlot = assignment?.categoria === 'estudiante' && (!assignment?.registro_id || assignment?.nombre_invitado === 'Cupo Disponible' || assignment?.nombre_invitado === 'Reservado');
    const isMySeat = selectedSeatId === mySeatId;

    if (me.categoria === 'docente') {
      return isTeacherSlot || isMySeat;
    } else if (me.categoria === 'invitado') {
      return !assignment || isGuestSlot || isMySeat;
    } else if (me.categoria === 'estudiante') {
      return !assignment || isStudentSlot || isMySeat;
    } else {
      return !assignment || isMySeat;
    }
  }, [selectedSeatId, assignments, me.categoria, mySeatId]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
            <UserCircleIcon className="w-5 h-5" />
            Mi Perfil
          </>
        )}
      </button>

      <aside className={`fixed md:relative left-0 top-0 z-50 w-full md:w-85 h-full bg-[#001D2D]/95 backdrop-blur-xl border-r border-white/10 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Header Section */}
        <div className="p-8 border-b border-white/5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10">
            <h1 className="text-[28px] font-black text-white tracking-tighter leading-none">
              Graduación <span className="text-orange drop-shadow-[0_0_15px_rgba(255,105,0,0.3)]">2026</span>
            </h1>
            <p className="text-[10px] font-extrabold text-slate-400 mt-2 uppercase tracking-[4px] opacity-70">
              Sistema de Asignación
            </p>
          </motion.div>
        </div>

        <div className="flex-1 overflow-y-auto sidebar-scroll px-6 py-8 space-y-8">
          {/* Profile Section */}
          <div className="bg-white/5 rounded-3xl p-6 border border-white/5 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-orange/10 rounded-full blur-2xl group-hover:bg-orange/20 transition-all duration-500" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange/20 to-orange/5 border border-orange/20 flex items-center justify-center shadow-inner">
                <UserCircleIcon className="w-7 h-7 text-orange" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">Registrado como</p>
                <p className="text-lg font-bold text-white drop-shadow-sm break-words">{me.nombre}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span
                className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm border"
                style={{
                  backgroundColor: `${CATEGORY_CONFIG[me.categoria].hex}15`,
                  color: CATEGORY_CONFIG[me.categoria].hex,
                  borderColor: `${CATEGORY_CONFIG[me.categoria].hex}30`
                }}
              >
                {CATEGORY_CONFIG[me.categoria].label}
              </span>
              <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-bold uppercase tracking-tight">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                En Línea
              </div>
            </div>
          </div>

          {me.codigo_acceso && (
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 relative group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <KeyIcon className="w-3.5 h-3.5" />
                  Código de Acceso
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(me.codigo_acceso!);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="text-xs text-slate-500 hover:text-white transition-colors p-1"
                  title="Copiar código"
                >
                  {copiedCode ? <CheckBadgeIcon className="w-4 h-4 text-emerald-500" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                </button>
              </div>
              <div className="font-mono text-xl font-black text-orange tracking-[0.2em] text-center select-all bg-black/20 rounded-lg py-2">
                {me.codigo_acceso}
              </div>
              <p className="text-[9px] text-slate-600 mt-2 text-center leading-tight">
                Usa este código para ver tu asiento en otros dispositivos.
              </p>
            </div>
          )}

          {/* Your Seat Section */}
          <AnimatePresence mode="wait">
            {mySeatId ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative group cursor-default"
              >
                <div
                  className="relative rounded-3xl p-6 overflow-hidden border transition-colors duration-500"
                  style={{
                    backgroundColor: `${CATEGORY_CONFIG[me.categoria].hex}08`,
                    borderColor: `${CATEGORY_CONFIG[me.categoria].hex}30`
                  }}
                >
                  <div className="absolute inset-0 opacity-10 blur-3xl pointer-events-none" style={{ backgroundColor: CATEGORY_CONFIG[me.categoria].hex }} />
                  <div className="absolute right-0 top-0 p-4 opacity-[0.08]">
                    <TicketIcon className="w-16 h-16 -rotate-12" style={{ color: CATEGORY_CONFIG[me.categoria].hex }} />
                  </div>
                  <h3
                    className="text-[10px] font-black uppercase tracking-[3px] mb-3 flex items-center gap-2"
                    style={{ color: CATEGORY_CONFIG[me.categoria].hex }}
                  >
                    <MapPinIcon className="w-3.5 h-3.5" />
                    Tu Ubicación
                  </h3>
                  <div className="space-y-1 relative z-10">
                    <p className="text-2xl font-black text-white tracking-tight">
                      Fila {parseSeatId(mySeatId).label}
                    </p>
                    <p
                      className="text-sm font-bold opacity-80"
                      style={{ color: CATEGORY_CONFIG[me.categoria].hex }}
                    >
                      {parseSeatId(mySeatId).sectionLabel} · Asiento {parseSeatId(mySeatId).numero}
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="p-6 border-2 border-dashed border-white/5 rounded-3xl text-center group hover:border-orange/20 transition-colors">
                <p className="text-xs text-slate-500 font-medium italic group-hover:text-slate-400 transition-colors">Selecciona un asiento en el mapa para registrar tu lugar</p>
              </div>
            )}
          </AnimatePresence>

          {/* Legend Section */}
          <div className="space-y-5">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[3px] px-1 flex items-center gap-2">
              <InformationCircleIcon className="w-3.5 h-3.5" />
              Referencia
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {(['docente', 'invitado', 'estudiante'] as const).map(cat => (
                <div
                  key={cat}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.03] hover:border-white/10 transition-colors"
                >
                  <div className="w-2.5 h-2.5 rounded-full shadow-lg" style={{ backgroundColor: CATEGORY_CONFIG[cat].hex, boxShadow: `0 0 10px ${CATEGORY_CONFIG[cat].hex}40` }} />
                  <span className="text-xs font-semibold text-slate-300 opacity-80">{CATEGORY_CONFIG[cat].label}</span>
                </div>
              ))}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.03]">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-500/50 border border-white/10 shadow-inner" />
                <span className="text-xs font-semibold text-slate-500">Disponible</span>
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[3px] px-1 flex items-center gap-2">
              <ChartBarIcon className="w-3.5 h-3.5" />
              Ocupación Real
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 shadow-inner group hover:bg-white/[0.07] transition-all">
                <span className="block text-xl font-black text-white leading-none mb-1.5">{stats.total}</span>
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider opacity-60">Total</span>
              </div>
              <div className="p-4 bg-slate-500/5 rounded-2xl border border-white/5 group hover:bg-slate-500/10 transition-all">
                <span className="block text-xl font-black text-slate-400 leading-none mb-1.5">{stats.available}</span>
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider opacity-60">Libres</span>
              </div>
              <div className="p-4 bg-orange/5 rounded-2xl border border-orange/10 group hover:bg-orange/10 transition-all">
                <span className="block text-xl font-black text-orange leading-none mb-1.5">{stats.assigned}</span>
                <span className="text-[9px] text-orange/50 font-black uppercase tracking-wider opacity-80">Ocupados</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-auto p-6 border-t border-white/5">
          <button
            onClick={async () => {
              await fetch('/api/registro/logout', { method: 'POST' });
              window.location.reload();
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all group"
          >
            <ArrowRightStartOnRectangleIcon className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <main
        className="relative flex-1 h-full overflow-hidden bg-[#151517]"
        style={{
          background: 'radial-gradient(circle at 50% 120%, #1e2530 0%, #151517 60%)',
          backgroundImage: `radial-gradient(circle at 50% 120%, #1e2530 0%, #151517 60%), linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: '100% 100%, 40px 40px, 40px 40px',
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
              <div className={`absolute top-8 right-8 z-40 flex flex-col gap-3 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto' : 'opacity-100'}`}>
                <div className="flex flex-col bg-[#002E45]/90 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl shadow-2xl">
                  <button onClick={() => zoomIn()} className="p-2.5 text-white hover:text-[#FF6900] rounded-xl transition-all" title="Acercar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
                  </button>
                  <div className="h-px bg-white/10 w-4/5 mx-auto my-0.5" />
                  <button onClick={() => zoomOut()} className="p-2.5 text-white hover:text-[#FF6900] rounded-xl transition-all" title="Alejar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
                  </button>
                </div>
                <button onClick={() => resetTransform()} className="bg-[#002E45]/90 backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-xl text-white hover:text-[#FF6900] hover:bg-white/10 transition-all">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                </button>
              </div>
              <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', willChange: 'transform' }}>
                <div className="p-40 min-w-fit cursor-grab active:cursor-grabbing" onClick={handleMapClick}>
                  <div className="flex flex-col items-center">
                    <div className="flex items-end gap-16 mb-20">
                      <div className="w-48 flex justify-end">
                        <div className="flex flex-col gap-1 items-end">
                          {ROWS.filter(r => r.type === 'cabin-flank').map(row => (
                            <div key={row.id} className="flex gap-1">{renderSeats(row.id, 'CL', row.left!, false)}</div>
                          ))}
                        </div>
                      </div>
                      <div className="w-64 h-16 bg-black border border-white/40 flex items-center justify-center mb-[-0.25rem] shadow-[0_-5px_20px_rgba(255,255,255,0.05)] relative z-20 rounded-t-lg">
                        <span className="text-sm font-black tracking-[0.2em] text-white drop-shadow-md">CABINA</span>
                      </div>
                      <div className="w-48 flex justify-start">
                        <div className="flex flex-col gap-1 items-start">
                          {ROWS.filter(r => r.type === 'cabin-flank').map(row => (
                            <div key={row.id} className="flex gap-1">{renderSeats(row.id, 'CR', row.right!, true)}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4 relative">
                      <div className="absolute -left-80 top-[-130px] w-80 flex flex-col items-start gap-24">
                        <div className="flex items-center gap-8 h-full">
                          <div className="flex flex-col gap-1 items-start">
                            <div className="flex gap-1">{renderSeats('W', 'WL', 7, false)}</div>
                            <div className="flex gap-1">{Array.from({ length: 7 }, (_, i) => <div key={`WL2-${i + 1}`}>{renderSeat(`W-WL2-${i + 1}`)}</div>)}</div>
                          </div>
                          <div className="px-4 py-2 border-2 border-red-500/60 bg-red-500/20 rounded-md flex items-center justify-center cursor-default"><span className="text-red-400 text-[11px] font-black uppercase tracking-[2px]">P. Emergencia</span></div>
                        </div>
                        <div className="h-14 w-[262px] border-2 border-white/30 flex items-center justify-center bg-[#151517]/90 rounded-sm"><span className="text-white/80 text-sm font-black tracking-[6px] uppercase">ENTRADA</span></div>
                      </div>
                      <div className="absolute -right-80 top-[-130px] w-80 flex flex-col items-end gap-24">
                        <div className="flex items-center gap-8 h-full">
                          <div className="px-4 py-2 border-2 border-red-500/60 bg-red-500/20 rounded-md flex items-center justify-center cursor-default"><span className="text-red-400 text-[11px] font-black uppercase tracking-[2px]">P. Emergencia</span></div>
                          <div className="flex flex-col gap-1 items-end">
                            <div className="flex gap-1">{renderSeats('W', 'WR', 7, true)}</div>
                            <div className="flex gap-1">{Array.from({ length: 7 }, (_, i) => <div key={`WR2-${7 - i}`}>{renderSeat(`W-WR2-${7 - i}`)}</div>)}</div>
                          </div>
                        </div>
                        <div className="h-14 w-[262px] border-2 border-white/30 flex items-center justify-center bg-[#151517]/90 rounded-sm"><span className="text-white/80 text-sm font-black tracking-[6px] uppercase">SALIDA</span></div>
                      </div>
                      <div className="flex flex-col gap-1 items-start">
                        {ROWS.filter(r => !r.type && !r.center).map(row => (row.id !== 'W' && row.id !== 'CB') && (
                          <div key={row.id} className="flex gap-4 items-center">
                            <span className="text-[11px] font-black text-slate-500 w-6 h-6 flex items-center justify-center rounded-full bg-white/5 border border-white/5">
                              {row.label}
                            </span>
                            <div className="flex gap-1 items-end">
                              {Array.from({ length: row.leftWallOffset || 0 }).map((_, i) => <div key={`lwo-${i}`} className="w-[28px] h-[34px] m-[3px] invisible" />)}
                              {renderSeats(row.id, 'L', row.left!, false)}
                              {Array.from({ length: row.leftAisleOffset || 0 }).map((_, i) => <div key={`lao-${i}`} className="w-[28px] h-[34px] m-[3px] invisible" />)}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="w-20 flex flex-col justify-end items-center pb-2" />
                      <div className="flex flex-col gap-1 items-end">
                        {ROWS.filter(r => !r.type && !r.center).map(row => (row.id !== 'W' && row.id !== 'CB') && (
                          <div key={row.id} className="flex gap-4 items-center">
                            <div className="flex gap-1 items-end">
                              {Array.from({ length: row.rightAisleOffset || 0 }).map((_, i) => <div key={`rao-${i}`} className="w-[28px] h-[34px] m-[3px] invisible" />)}
                              {renderSeats(row.id, 'R', row.right!, true)}
                              {Array.from({ length: row.rightWallOffset || 0 }).map((_, i) => <div key={`rwo-${i}`} className="w-[28px] h-[34px] m-[3px] invisible" />)}
                            </div>
                            <span className="text-[11px] font-black text-slate-500 w-6 h-6 flex items-center justify-center rounded-full bg-white/5 border border-white/5">
                              {row.label}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="absolute -left-80 bottom-0 h-40 w-10 border-2 border-red-500/60 bg-red-500/20 rounded-md flex items-center justify-center cursor-default"><span className="text-red-400 text-[11px] font-black uppercase rotate-90 tracking-[3px]">P. Emergencia</span></div>
                      <div className="absolute -right-80 bottom-0 h-40 w-10 border-2 border-red-500/60 bg-red-500/20 rounded-md flex items-center justify-center cursor-default"><span className="text-red-400 text-[11px] font-black uppercase -rotate-90 tracking-[3px]">P. Emergencia</span></div>
                    </div>
                    <div className="mt-16 flex flex-col items-center">
                      {ROWS.filter(r => r.type === 'center').map(row => (
                        <div key={row.id} className="flex gap-1 mb-6 border-t border-b border-white/5 py-2 px-6">
                          {renderSeats(row.id, 'C', row.center!, false)}
                        </div>
                      ))}
                      <div className="flex flex-col items-center gap-2 cursor-default opacity-80">
                        <div className="w-[500px] border-t-2 border-double border-white/30 my-2" />
                        <span className="text-xs font-black tracking-[8px] text-white/70 uppercase">Pantalla LED</span>
                        <div className="w-[500px] border-b-2 border-double border-white/30 my-2" />
                      </div>
                    </div>
                  </div>
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </main>

      {selectedSeatId && (
        <PublicSeatModal
          seatId={selectedSeatId}
          assignment={assignments[selectedSeatId]}
          isMine={!!isMine}
          isSelectable={isModalSelectable}
          onConfirm={handleAssign}
          onRelease={handleRelease}
          onClose={() => setSelectedSeatId(null)}
          loading={loading}
        />
      )}
    </div>
  );
}
