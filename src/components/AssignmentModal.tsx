import { useState, useRef, useEffect } from 'react';
import { SeatState, SeatCategory } from '@/lib/types';
import { CATEGORY_CONFIG, parseSeatId } from '@/lib/seats-data';

interface Props {
  seatId: string;
  assignment?: SeatState[string];
  onAssign: (seatId: string, nombre: string, categoria: SeatCategory) => void;
  onRelease: (seatId: string) => void;
  onClose: () => void;
}

export function AssignmentModal({ seatId, assignment, onAssign, onRelease, onClose }: Props) {
  const [nombre, setNombre] = useState(assignment?.nombre_invitado || '');
  const [categoria, setCategoria] = useState<SeatCategory>(assignment?.categoria || 'invitado');
  const info = parseSeatId(seatId);

  // Get current category config for styling
  const activeConfig = CATEGORY_CONFIG[categoria];
  // Fallback if hex is missing (though it should be there from seats-data.ts)
  const activeColor = activeConfig.hex || '#10b981';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nombre.trim()) {
      onAssign(seatId, nombre, categoria);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Main Card - Solid darker background, no blur */}
      <div
        className="modal-card bg-[#18181b] border border-white/10 rounded-2xl p-8 w-[480px] max-w-full shadow-2xl relative overflow-hidden"
        style={{ borderTop: `4px solid ${activeColor}` }}
      >

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-2xl font-serif font-bold text-white mb-1">
                {assignment ? 'Editar Asignación' : 'Asignar Asiento'}
              </h2>
              <div className="flex items-center gap-2 text-sm font-mono mt-1">
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white font-bold">{info.display}</span>
                <span className="text-slate-500">•</span>
                <span style={{ color: assignment ? activeColor : '#10b981' }} className="font-bold">
                  {assignment ? 'Ocupado' : 'Disponible'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block ml-1">
                Nombre del Invitado
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full bg-[#27272a] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none transition-colors font-medium"
                style={{
                  borderColor: nombre.trim() ? activeColor : 'rgba(255,255,255,0.1)'
                }}
                placeholder="Ingrese nombre completo..."
                autoFocus
              />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block ml-1">
                Categoría
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(Object.entries(CATEGORY_CONFIG) as [SeatCategory, typeof CATEGORY_CONFIG['invitado']][]).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategoria(key)}
                    className="relative p-3 rounded-xl border text-left transition-all overflow-hidden"
                    style={{
                      backgroundColor: categoria === key ? config.hex : '#27272a',
                      borderColor: categoria === key ? config.hex : 'transparent',
                      color: categoria === key ? '#ffffff' : '#94a3b8'
                    }}
                  >
                    <div className="flex items-center gap-2 relative z-10">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          backgroundColor: categoria === key ? '#ffffff' : config.hex
                        }}
                      />
                      <span className="block text-sm font-bold">
                        {config.label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-6 mt-8 border-t border-white/5">
              {assignment && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('¿Liberar este asiento?')) onRelease(seatId);
                  }}
                  className="px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:text-red-300 bg-transparent hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
                >
                  Liberar
                </button>
              )}
              <div className="flex-1"></div>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 rounded-xl text-sm font-bold text-slate-300 hover:text-white bg-transparent hover:bg-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!nombre.trim()}
                className="px-8 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-transform active:scale-95"
                style={{
                  backgroundColor: activeColor
                }}
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
