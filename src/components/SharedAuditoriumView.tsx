'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { SeatState, SeatCategory } from '@/lib/types';
import { ROWS, parseSeatId, CATEGORY_CONFIG, TEACHER_SLOT_LABEL, generateAllSeatIds } from '@/lib/seats-data';
import { supabase } from '@/lib/supabase';
import {
    CheckCircleIcon,
    XMarkIcon,
    ChartBarIcon,
    PlusIcon,
    CheckIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface AssignmentRow {
    seat_id: string;
    nombre_invitado: string;
    categoria: SeatCategory;
    registro_id: string | null;
    assigned_at: string;
}

interface SharedAuditoriumViewProps {
    templateId: string;
    eventName?: string;
}

export function SharedAuditoriumView({ templateId, eventName }: SharedAuditoriumViewProps) {
    // ── State ──
    const [assignments, setAssignments] = useState<SeatState>({});
    const [loading, setLoading] = useState(false);
    const isInitialLoad = useRef(true);
    const [selectedSeatIds, setSelectedSeatIds] = useState<Set<string>>(new Set());
    const [selectedCategory, setSelectedCategory] = useState<SeatCategory>('invitado');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // ── Supabase Realtime & Fetch ──
    useEffect(() => {
        const fetchAssignments = async () => {
            if (!templateId) return;

            setLoading(true);
            isInitialLoad.current = true;

            const { data, error } = await supabase.from('assignments').select('*').eq('template_id', templateId);

            if (error) {
                console.error('Error fetching assignments:', error);
                setLoading(false);
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
            isInitialLoad.current = false;
            setLoading(false);
        };

        fetchAssignments();

        // Subscribe to changes
        const channel = supabase
            .channel(`realtime assignments ${templateId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments', filter: `template_id=eq.${templateId}` }, (payload) => {
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
    }, [templateId]);

    // ── Handlers ──

    const handleSeatClick = useCallback((e: React.MouseEvent) => {
        const target = (e.target as HTMLElement).closest('[data-seat-id]') as HTMLElement | null;

        if (!target) {
            // If clicking background, clear selection unless shift/ctrl held? 
            // For simplicity, let's keep selection if clicking empty space? 
            // Or clear it? Standard behavior is clear.
            if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
                setSelectedSeatIds(new Set());
            }
            return;
        }

        const clickedSeatId = target.dataset.seatId!;

        // Toggle selection
        setSelectedSeatIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(clickedSeatId)) {
                newSet.delete(clickedSeatId);
            } else {
                newSet.add(clickedSeatId);
            }
            return newSet;
        });
    }, []);

    const handleReserve = async () => {
        if (selectedSeatIds.size === 0) return;
        setLoading(true);
        const now = new Date().toISOString();

        // Prepare name based on category
        let defaultName = 'Cupo Reservado';
        if (selectedCategory === 'docente') defaultName = TEACHER_SLOT_LABEL;
        else if (selectedCategory === 'bloqueado' || selectedCategory === 'autoridad') defaultName = 'Reservado';

        // 1. Optimistic Update
        setAssignments(prev => {
            const next = { ...prev };
            selectedSeatIds.forEach(id => {
                next[id] = {
                    nombre_invitado: defaultName,
                    categoria: selectedCategory,
                    asignado_en: now,
                    registro_id: null
                };
            });
            return next;
        });

        // 2. Supabase Upsert
        const updates = Array.from(selectedSeatIds).map(id => ({
            seat_id: id,
            nombre_invitado: defaultName,
            categoria: selectedCategory,
            assigned_at: now,
            template_id: templateId
        }));

        const { error } = await supabase.from('assignments').upsert(updates);

        if (error) {
            console.error('Error reserving:', error);
            alert('Error al reservar. Recargando...');
            window.location.reload();
        } else {
            setSelectedSeatIds(new Set());
        }
        setLoading(false);
    };

    const handleRelease = async () => {
        if (selectedSeatIds.size === 0) return;
        if (!confirm(`¿Liberar ${selectedSeatIds.size} asientos seleccionados?`)) return;

        setLoading(true);

        // 1. Optimistic Update
        setAssignments(prev => {
            const next = { ...prev };
            selectedSeatIds.forEach(id => {
                delete next[id];
            });
            return next;
        });

        // 2. Supabase Delete
        const { error } = await supabase
            .from('assignments')
            .delete()
            .in('seat_id', Array.from(selectedSeatIds))
            .eq('template_id', templateId);

        if (error) {
            console.error('Error releasing:', error);
            alert('Error al liberar. Recargando...');
            window.location.reload();
        } else {
            setSelectedSeatIds(new Set());
        }
        setLoading(false);
    };

    // ── Seat rendering helpers ──
    function seatClass(seatId: string): string {
        const a = assignments[seatId];
        if (!a) return 'seat seat-disponible';
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
        const isSelected = selectedSeatIds.has(seatId);

        return (
            <div
                key={seatId}
                className={`${seatClass(seatId)} md:w-[28px] md:h-[34px] md:m-[3px] w-[32px] h-[38px] m-[4px]
            ${isSelected ? 'ring-2 ring-orange z-40 scale-110 shadow-[0_0_15px_rgba(255,105,0,0.5)]' : 'hover:scale-110 hover:z-50'}
            transition-all duration-200 cursor-pointer relative
        `}
                data-seat-id={seatId}
            >
                <span className="seat-tooltip">{seatTooltip(seatId)}</span>
                <span className="absolute inset-0 flex items-center justify-center text-[16px] font-black text-white pointer-events-none z-10 select-none drop-shadow-md">
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
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16m-7 6h7" /></svg>
                        Menú Reserva
                    </>
                )}
            </button>

            <aside className={`fixed md:relative left-0 top-0 z-50 w-full md:w-85 h-full bg-[#001D2D]/95 backdrop-blur-xl border-r border-white/10 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                {/* Header Section */}
                <div className="p-8 border-b border-white/5 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10">
                        <h1 className="text-[28px] font-black text-white tracking-tighter leading-none">
                            {eventName || 'Evento'} <span className="text-orange shadow-[0_0_15px_rgba(255,105,0,0.3)]">2026</span>
                        </h1>
                        <p className="text-[10px] font-extrabold text-slate-400 mt-2 uppercase tracking-[4px] opacity-70">
                            Reserva de Asientos
                        </p>
                    </motion.div>
                </div>

                <div className="flex-1 overflow-y-auto sidebar-scroll px-6 py-8 space-y-8">
                    {/* Category Selector Section */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[3px] px-1 flex items-center gap-2">
                            <PlusIcon className="w-3.5 h-3.5" />
                            Categoría a Reservar
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                            {(Object.entries(CATEGORY_CONFIG) as [SeatCategory, typeof CATEGORY_CONFIG['invitado']][]).map(([key, config]) => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedCategory(key)}
                                    className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between group ${selectedCategory === key
                                        ? 'bg-white/10 border-white/20'
                                        : 'bg-white/[0.02] border-white/[0.03] hover:border-white/10'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: config.hex, boxShadow: `0 0 10px ${config.hex}40` }} />
                                        <span className={`text-sm font-bold transition-colors ${selectedCategory === key ? 'text-white' : 'text-slate-400'}`}>
                                            {config.label}
                                        </span>
                                    </div>
                                    {selectedCategory === key && (
                                        <CheckIcon className="w-5 h-5 text-orange" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Stats Section */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[3px] px-1 flex items-center gap-2">
                            <ChartBarIcon className="w-3.5 h-3.5" />
                            Ocupación Actual
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                                <span className="block text-xl font-black text-white leading-none mb-1">
                                    {Object.values(assignments).filter(Boolean).length}
                                </span>
                                <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider opacity-60">Ocupados</span>
                            </div>
                            <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/5 text-center">
                                <span className="block text-xl font-black text-slate-500 leading-none mb-1">
                                    {generateAllSeatIds().length - Object.values(assignments).filter(Boolean).length}
                                </span>
                                <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider opacity-60">Libres</span>
                            </div>
                        </div>
                    </div>

                    <p className="text-[11px] text-slate-500 italic px-2 leading-relaxed opacity-60">
                        * Selecciona uno o varios asientos en el mapa para realizar una reserva masiva.
                    </p>
                </div>

                {/* Footer Section with primary actions if needed */}
                <div className="p-6 border-t border-white/5">
                    <p className="text-[9px] text-center text-slate-600 font-bold uppercase tracking-widest">
                        Sistema de Asignación v2.0
                    </p>
                </div>
            </aside>

            {/* ── Main map area ── */}
            <main
                className="relative flex-1 h-full overflow-hidden bg-[#151517]"
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
                                <div className="p-40 min-w-fit cursor-grab active:cursor-grabbing" onClick={handleSeatClick}>
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


                                            {/* Left Block */}
                                            <div className="flex flex-col gap-1 items-start">
                                                {ROWS.filter(r => !r.type && !r.center).map(row => (row.id !== 'W' && row.id !== 'CB') && (
                                                    <div key={row.id} className="flex gap-4 items-center">
                                                        <span className="text-[11px] font-black text-slate-500 w-6 h-6 flex items-center justify-center rounded-full bg-white/5 border border-white/5">
                                                            {row.label}
                                                        </span>
                                                        <div className="flex gap-1 items-end">
                                                            {Array.from({ length: row.leftWallOffset || 0 }).map((_, i) => <div key={`lwo-${i}`} className="md:w-[28px] md:h-[34px] md:m-[3px] w-[32px] h-[38px] m-[4px] invisible" />)}
                                                            {renderSeats(row.id, 'L', row.left!, false)}
                                                            {Array.from({ length: row.leftAisleOffset || 0 }).map((_, i) => <div key={`lao-${i}`} className="md:w-[28px] md:h-[34px] md:m-[3px] w-[32px] h-[38px] m-[4px] invisible" />)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Center Aisle Spacer */}
                                            <div className="w-20" />

                                            {/* Right Block */}
                                            <div className="flex flex-col gap-1 items-end">
                                                {ROWS.filter(r => !r.type && !r.center).map(row => (row.id !== 'W' && row.id !== 'CB') && (
                                                    <div key={row.id} className="flex gap-4 items-center">
                                                        <div className="flex gap-1 items-end">
                                                            {Array.from({ length: row.rightAisleOffset || 0 }).map((_, i) => <div key={`rao-${i}`} className="md:w-[28px] md:h-[34px] md:m-[3px] w-[32px] h-[38px] m-[4px] invisible" />)}
                                                            {renderSeats(row.id, 'R', row.right!, true)}
                                                            {Array.from({ length: row.rightWallOffset || 0 }).map((_, i) => <div key={`rwo-${i}`} className="md:w-[28px] md:h-[34px] md:m-[3px] w-[32px] h-[38px] m-[4px] invisible" />)}
                                                        </div>
                                                        <span className="text-[11px] font-black text-slate-500 w-6 h-6 flex items-center justify-center rounded-full bg-white/5 border border-white/5">
                                                            {row.label}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Right Side Group (Wing + Door) */}
                                            <div className="absolute -right-80 top-[-130px] w-80 flex flex-col items-end gap-24">
                                                {/* Right Wing & Emergency Door */}
                                                <div className="flex items-center gap-8 h-full flex-row-reverse">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <div className="flex gap-1">{renderSeats('W', 'WR', 7, true)}</div>
                                                        <div className="flex gap-1">
                                                            {Array.from({ length: 7 }).map((_, i) => (
                                                                <div key={`WR2-${i + 1}`}>{renderSeat(`W-WR2-${i + 1}`)}</div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="px-4 py-2 border-2 border-red-500/60 bg-red-500/20 rounded-md flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:bg-red-500/30 transition-colors cursor-default">
                                                        <span className="text-red-400 text-[11px] font-black uppercase whitespace-nowrap tracking-[2px] drop-shadow-sm">P. Emergencia</span>
                                                    </div>
                                                </div>

                                                {/* SALIDA Marker */}
                                                <div className="h-14 w-[262px] border-2 border-white/30 flex items-center justify-center bg-[#151517]/90 backdrop-blur-md shadow-lg rounded-sm">
                                                    <span className="text-white/80 text-sm font-black tracking-[6px] uppercase drop-shadow-md">SALIDA</span>
                                                </div>
                                            </div>

                                            {/* Vertical PE markers aligned to Row 1 (Bottom up) */}
                                            <div className="absolute -left-80 bottom-0 h-40 w-10 border-2 border-red-500/60 bg-red-500/20 rounded-md flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:bg-red-500/30 transition-colors cursor-default">
                                                <span className="text-red-400 text-[11px] font-black uppercase rotate-90 whitespace-nowrap tracking-[3px] drop-shadow-sm">P. Emergencia</span>
                                            </div>
                                            <div className="absolute -right-80 bottom-0 h-40 w-10 border-2 border-red-500/60 bg-red-500/20 rounded-md flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:bg-red-500/30 transition-colors cursor-default">
                                                <span className="text-red-400 text-[11px] font-black uppercase -rotate-90 whitespace-nowrap tracking-[3px] drop-shadow-sm">P. Emergencia</span>
                                            </div>
                                        </div>

                                        {/* Bottom Center Row */}
                                        <div className="mt-16 relative">
                                            {ROWS.filter(r => r.type === 'center').map(row => (
                                                <div key={row.id} className="flex justify-center gap-1 mb-6 border-t border-b border-white/5 py-4 px-8 bg-white/5 rounded-2xl">
                                                    {renderSeats(row.id, 'C', row.center!, false)}
                                                </div>
                                            ))}
                                            <div className="flex flex-col items-center gap-2 cursor-default opacity-80 mt-4">
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

            {/* ── Action Bar ── */}
            <AnimatePresence>
                {selectedSeatIds.size > 0 && (
                    <motion.div
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className="fixed bottom-0 left-0 right-0 z-[70] p-6 flex justify-center pointer-events-none md:left-[340px]"
                    >
                        <div className="bg-[#001D2D]/90 backdrop-blur-xl border border-white/20 p-4 rounded-3xl shadow-2xl flex items-center gap-6 pointer-events-auto">
                            <div className="flex items-center gap-3 pr-6 border-r border-white/10">
                                <span className="bg-orange text-white text-sm font-black px-3 py-1.5 rounded-xl shadow-[0_0_15px_rgba(255,105,0,0.3)]">
                                    {selectedSeatIds.size}
                                </span>
                                <span className="text-white text-xs font-black uppercase tracking-widest whitespace-nowrap">
                                    Seleccionados
                                </span>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleRelease}
                                    className="px-6 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/40 text-red-400 font-bold text-sm flex items-center gap-2 transition-all active:scale-95 group"
                                >
                                    <XMarkIcon className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                                    Liberar
                                </button>
                                <button
                                    onClick={handleReserve}
                                    disabled={loading}
                                    className="px-8 py-4 rounded-2xl bg-orange hover:bg-orange-hover text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,105,0,0.4)] hover:shadow-[0_0_30px_rgba(255,105,0,0.6)] transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <CheckCircleIcon className="w-5 h-5" />
                                            Reservar como {CATEGORY_CONFIG[selectedCategory].label}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
