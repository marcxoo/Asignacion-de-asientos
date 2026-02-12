import { useState } from 'react';
import { SeatState, SeatCategory } from '@/lib/types';
import { CATEGORY_CONFIG, parseSeatId } from '@/lib/seats-data';
import { motion } from 'framer-motion';
import {
  XMarkIcon,
  CheckCircleIcon,
  UserCircleIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

interface Props {
  seatId: string;
  assignment?: SeatState[string];
  onAssign: (seatId: string, nombre: string, categoria: SeatCategory) => void;
  onRelease: (seatId: string) => void;
  onClose: () => void;
  loading?: boolean;
}

export function AssignmentModal({ seatId, assignment, onAssign, onRelease, onClose, loading = false }: Props) {
  const [nombre, setNombre] = useState(assignment?.nombre_invitado || '');
  const [categoria, setCategoria] = useState<SeatCategory>(assignment?.categoria || 'invitado');
  const info = parseSeatId(seatId);

  const activeConfig = CATEGORY_CONFIG[categoria];
  const activeColor = activeConfig.hex || '#10b981';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nombre.trim()) {
      onAssign(seatId, nombre, categoria);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 font-sans"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#001D2D] border border-white/10 rounded-[32px] p-8 w-[500px] max-w-full shadow-2xl relative overflow-hidden"
      >
        <div
          className="absolute top-0 left-0 w-full h-1.5 transition-colors duration-500"
          style={{ backgroundColor: activeColor }}
        />

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight leading-none mb-3">
                {assignment ? 'Editar Lugar' : 'Asignar Lugar'}
              </h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-xl text-xs font-mono font-bold text-slate-400">
                  {info.display}
                </span>
                <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-xl">
                  <div className={`w-2 h-2 rounded-full ${assignment ? 'bg-orange animate-pulse' : 'bg-emerald-500'}`} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${assignment ? 'text-orange' : 'text-emerald-500'}`}>
                    {assignment ? 'Ocupado' : 'Disponible'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-white p-2.5 rounded-2xl hover:bg-white/5 transition-all"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[3px] block ml-1">
                Nombre del Invitado
              </label>
              <div className="relative group">
                <UserCircleIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 transition-colors group-focus-within:text-orange" />
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-black/20 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white focus:ring-4 focus:ring-orange/10 focus:border-orange/40 transition-all outline-none placeholder:text-slate-700 font-semibold"
                  placeholder="Ingrese nombre completo..."
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[3px] block ml-1">
                Categoría
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(CATEGORY_CONFIG) as [SeatCategory, typeof CATEGORY_CONFIG['invitado']][]).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategoria(key)}
                    className={`relative p-4 rounded-2xl border-2 transition-all group overflow-hidden ${categoria === key
                      ? 'bg-white/5'
                      : 'bg-transparent border-white/5 hover:border-white/10'
                      }`}
                    style={{
                      borderColor: categoria === key ? config.hex : undefined
                    }}
                  >
                    <div className="flex items-center gap-3 relative z-10">
                      <div
                        className="w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                        style={{ backgroundColor: config.hex }}
                      />
                      <span className={`text-sm font-black tracking-tight transition-colors ${categoria === key ? 'text-white' : 'text-slate-500 group-hover:text-slate-400'
                        }`}>
                        {config.label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              {assignment && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('¿Liberar este asiento?')) onRelease(seatId);
                  }}
                  className="p-4 rounded-2xl text-red-500 hover:bg-red-500/10 border border-red-500/20 transition-all active:scale-95 group"
                  title="Liberar asiento"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-4 rounded-2xl text-sm font-black text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 transition-all border border-transparent hover:border-white/5"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={!nombre.trim() || loading}
                className="flex-[1.8] py-4 rounded-2xl text-sm font-black text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2 group overflow-hidden relative"
                style={{ backgroundColor: activeColor }}
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CheckCircleIcon className="w-5 h-5" />
                <span>{loading ? 'Procesando...' : assignment ? 'Actualizar' : 'Guardar'}</span>
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
