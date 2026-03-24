'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function SeatCheckinClient() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event')?.trim() ?? '';
  const seatId = searchParams.get('seat')?.trim() ?? '';

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; detail?: string } | null>(null);

  const confirm = async () => {
    if (!seatId) {
      setResult({ ok: false, message: 'QR invalido', detail: 'Falta el identificador del asiento.' });
      return;
    }

    setLoading(true);
    setResult(null);
    const res = await fetch('/api/public/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId || undefined, seat_id: seatId }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setResult({ ok: false, message: data.error || 'No se pudo validar asistencia', detail: data.assigned_display });
    } else {
      setResult({ ok: true, message: data.message || 'Asistencia confirmada', detail: data.seat_display });
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#001D2D]/80 backdrop-blur-xl p-7">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400 font-bold">Check-in por asiento</p>
        <h1 className="text-2xl font-black mt-2">Confirmar llegada</h1>
        <p className="text-slate-300 mt-2 text-sm">Asiento detectado: <span className="text-orange font-bold">{seatId || 'No disponible'}</span></p>

        <button
          onClick={confirm}
          disabled={loading}
          className="mt-6 w-full py-3 rounded-xl bg-orange hover:bg-[#ff7b26] text-white font-black transition-colors disabled:opacity-60"
        >
          {loading ? 'Verificando...' : 'Estoy en mi asiento'}
        </button>

        {result && (
          <div className={`mt-5 rounded-xl border p-4 ${result.ok ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-red-400/40 bg-red-500/10'}`}>
            <p className={`font-bold ${result.ok ? 'text-emerald-300' : 'text-red-300'}`}>{result.message}</p>
            {result.detail && <p className="text-sm text-slate-300 mt-1">{result.detail}</p>}
          </div>
        )}

        <p className="text-xs text-slate-500 mt-5">Tip: abre primero tu enlace de invitación en este mismo celular para validar tu sesión.</p>
      </div>
    </main>
  );
}

export default function SeatCheckinPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#0a0a0b] text-slate-300 flex items-center justify-center">Cargando check-in...</main>}>
      <SeatCheckinClient />
    </Suspense>
  );
}
