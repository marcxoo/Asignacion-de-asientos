'use client';

import { parseSeatId, CATEGORY_CONFIG } from '@/lib/seats-data';
import { SeatAssignment } from '@/lib/types';
import { motion } from 'framer-motion';
import { XMarkIcon, CheckCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface PublicSeatModalProps {
  seatId: string;
  assignment: SeatAssignment | undefined;
  isMine: boolean;
  onConfirm: () => void;
  onRelease: () => void;
  onClose: () => void;
  loading?: boolean;
  isSelectable?: boolean;
}

export function PublicSeatModal({
  seatId,
  assignment,
  isMine,
  onConfirm,
  onRelease,
  onClose,
  loading = false,
  isSelectable = false,
}: PublicSeatModalProps) {
  const info = parseSeatId(seatId);

  // A seat is available if it's explicitly selectable by the user
  const available = isSelectable && !isMine;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 font-sans"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#001D2D] border border-white/10 rounded-[32px] p-8 w-[420px] max-w-full shadow-2xl relative overflow-hidden"
      >
        <div
          className="absolute top-0 left-0 w-full h-1.5"
          style={{ backgroundColor: available ? '#10b981' : isMine ? CATEGORY_CONFIG[assignment!.categoria].hex : '#475569' }}
        />

        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              {available ? 'Confirmar lugar' : isMine ? 'Tu lugar' : 'Ocupado'}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-mono font-bold text-slate-400">
                {info.display}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white p-2 rounded-2xl hover:bg-white/5 transition-all"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6 mb-8">
          {available ? (
            <div className="flex gap-4 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
              <CheckCircleIcon className="w-6 h-6 text-emerald-500 shrink-0" />
              <p className="text-slate-300 text-sm leading-relaxed">
                Este asiento está disponible. Se registrará con tu nombre completo y categoría para el evento.
              </p>
            </div>
          ) : isMine ? (
            <div className="flex gap-4 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
              <InformationCircleIcon className="w-6 h-6 text-blue-500 shrink-0" />
              <p className="text-slate-300 text-sm leading-relaxed">
                Este es tu asiento actual. Puedes liberarlo si prefieres elegir una ubicación diferente.
              </p>
            </div>
          ) : (
            <div className="flex gap-4 p-4 bg-slate-500/5 border border-slate-500/10 rounded-2xl opacity-60">
              <XMarkIcon className="w-6 h-6 text-slate-500 shrink-0" />
              <p className="text-slate-400 text-sm leading-relaxed italic">
                Este lugar ya ha sido reservado por otro invitado. Por favor, selecciona uno marcado en gris.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl text-sm font-black text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all border border-transparent hover:border-white/5"
          >
            Volver
          </button>
          {available && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="flex-[1.5] py-4 rounded-2xl text-sm font-black text-white bg-orange hover:bg-orange-hover shadow-[0_10px_20px_rgba(255,105,0,0.2)] disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? 'Procesando...' : 'Asignar ahora'}
            </button>
          )}
          {isMine && assignment && (
            <button
              type="button"
              onClick={onRelease}
              disabled={loading}
              className="flex-[1.5] py-4 rounded-2xl text-sm font-black text-red-500 hover:bg-red-500/10 border border-red-500/20 transition-all active:scale-95"
            >
              {loading ? '...' : 'Liberar lugar'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
