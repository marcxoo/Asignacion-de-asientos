'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { parseSeatId, CATEGORY_CONFIG } from '@/lib/seats-data';
import { SeatCategory } from '@/lib/types';
import Link from 'next/link';

interface AssignmentRow {
  seat_id: string;
  nombre_invitado: string;
  categoria: SeatCategory;
  registro_id: string | null;
  template_id: string;
}

interface RegistroRow {
  id: string;
  attended_at: string | null;
  checked_in_at: string | null;
}

interface EventOption {
  id: string;
  name: string;
}

export default function ReportesPage() {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [registros, setRegistros] = useState<Map<string, RegistroRow>>(new Map());
  const [loading, setLoading] = useState(false);

  // Load events
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('templates').select('id, name').order('created_at', { ascending: false });
      if (data && data.length > 0) {
        setEvents(data);
        setSelectedEvent(data[0].id);
      }
    })();
  }, []);

  // Load data for selected event
  const loadData = useCallback(async () => {
    if (!selectedEvent) return;
    setLoading(true);

    const { data: asgn } = await supabase
      .from('assignments')
      .select('seat_id, nombre_invitado, categoria, registro_id, template_id')
      .eq('template_id', selectedEvent);

    const safeAsgn = (asgn ?? []) as AssignmentRow[];
    setAssignments(safeAsgn);

    const regIds = safeAsgn.map(a => a.registro_id).filter(Boolean) as string[];
    if (regIds.length > 0) {
      const { data: regs } = await supabase
        .from('registros')
        .select('id, attended_at, checked_in_at')
        .in('id', regIds);
      const map = new Map<string, RegistroRow>();
      regs?.forEach((r: RegistroRow) => map.set(r.id, r));
      setRegistros(map);
    } else {
      setRegistros(new Map());
    }

    setLoading(false);
  }, [selectedEvent]);

  useEffect(() => { loadData(); }, [loadData]);

  // Stats
  const total = assignments.length;
  const confirmedCount = assignments.filter(a => a.registro_id && registros.get(a.registro_id)?.attended_at).length;
  const pendingCount = total - confirmedCount;

  const categoryCounts: Record<string, { total: number; confirmed: number }> = {};
  assignments.forEach(a => {
    if (!categoryCounts[a.categoria]) categoryCounts[a.categoria] = { total: 0, confirmed: 0 };
    categoryCounts[a.categoria].total += 1;
    if (a.registro_id && registros.get(a.registro_id)?.attended_at) {
      categoryCounts[a.categoria].confirmed += 1;
    }
  });

  const handleExport = () => {
    if (!selectedEvent) return;
    window.open(`/api/admin/export?template_id=${selectedEvent}`, '_blank');
  };

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <Link href="/mapa" className="text-xs font-bold text-slate-400 hover:text-white mb-2 inline-block transition-colors">
              ← Volver al Panel
            </Link>
            <h1 className="text-3xl font-black tracking-tight">
              REPORTES <span className="text-orange-500">DE ASISTENCIA</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">Resumen de asignación y check-in por evento</p>
          </div>
          <button
            onClick={handleExport}
            disabled={!selectedEvent}
            className="px-6 py-3 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-2xl text-emerald-400 font-bold text-sm transition-all disabled:opacity-40"
          >
            📥 Descargar Excel
          </button>
        </div>

        {/* Event Selector */}
        <div className="mb-8">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[3px] block mb-2">Evento</label>
          <select
            value={selectedEvent}
            onChange={e => setSelectedEvent(e.target.value)}
            className="w-full max-w-md bg-[#001D2D] border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          >
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400">Cargando datos...</div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              <div className="bg-[#001D2D]/60 border border-white/5 rounded-2xl p-6">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[3px]">Total Asignados</p>
                <p className="text-4xl font-black mt-2 text-white">{total}</p>
              </div>
              <div className="bg-[#001D2D]/60 border border-emerald-500/10 rounded-2xl p-6">
                <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-[3px]">Asistencia Confirmada</p>
                <p className="text-4xl font-black mt-2 text-emerald-400">{confirmedCount}</p>
                <p className="text-xs text-slate-500 mt-1">{total > 0 ? ((confirmedCount / total) * 100).toFixed(1) : 0}%</p>
              </div>
              <div className="bg-[#001D2D]/60 border border-orange-500/10 rounded-2xl p-6">
                <p className="text-[10px] font-black text-orange-500/60 uppercase tracking-[3px]">Pendientes</p>
                <p className="text-4xl font-black mt-2 text-orange-400">{pendingCount}</p>
                <p className="text-xs text-slate-500 mt-1">{total > 0 ? ((pendingCount / total) * 100).toFixed(1) : 0}%</p>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-[#001D2D]/40 border border-white/5 rounded-2xl p-6 mb-10">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-[3px] mb-4">Desglose por Categoría</h2>
              <div className="space-y-3">
                {Object.entries(categoryCounts).map(([cat, counts]) => {
                  const config = CATEGORY_CONFIG[cat as SeatCategory];
                  const pct = counts.total > 0 ? (counts.confirmed / counts.total) * 100 : 0;
                  return (
                    <div key={cat} className="flex items-center gap-4">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: config?.hex || '#666' }} />
                      <span className="text-sm font-bold w-32">{config?.label || cat}</span>
                      <span className="text-sm text-slate-400 w-20">{counts.total} asientos</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: config?.hex || '#666' }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-400 w-24 text-right">
                        {counts.confirmed}/{counts.total} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Attendance Table */}
            <div className="bg-[#001D2D]/40 border border-white/5 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-white/5">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[3px]">Detalle de Asignaciones</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                      <th className="px-6 py-3">Asiento</th>
                      <th className="px-6 py-3">Nombre</th>
                      <th className="px-6 py-3">Categoría</th>
                      <th className="px-6 py-3">Asistencia</th>
                      <th className="px-6 py-3">Hora Check-in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a) => {
                      const info = parseSeatId(a.seat_id);
                      const reg = a.registro_id ? registros.get(a.registro_id) : undefined;
                      const confirmed = !!reg?.attended_at;
                      const config = CATEGORY_CONFIG[a.categoria];
                      return (
                        <tr key={a.seat_id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-3 text-sm font-bold text-white">{info.display}</td>
                          <td className="px-6 py-3 text-sm text-slate-300">{a.nombre_invitado}</td>
                          <td className="px-6 py-3">
                            <span
                              className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider"
                              style={{ backgroundColor: config?.hex + '20', color: config?.hex }}
                            >
                              {config?.label || a.categoria}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            {confirmed ? (
                              <span className="text-emerald-400 font-bold text-sm">✅ Confirmada</span>
                            ) : (
                              <span className="text-slate-500 text-sm">—</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-xs text-slate-400">
                            {reg?.checked_in_at
                              ? new Date(reg.checked_in_at).toLocaleString('es-EC', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
                              : ''}
                          </td>
                        </tr>
                      );
                    })}
                    {assignments.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-sm">
                          No hay asignaciones para este evento
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
