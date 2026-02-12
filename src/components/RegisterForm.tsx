import { useState } from 'react';
import { SeatCategory } from '@/lib/types';
import { CATEGORY_CONFIG } from '@/lib/seats-data';
import { motion } from 'framer-motion';
import {
  UserCircleIcon,
  AcademicCapIcon,
  ArrowRightIcon,
  CheckBadgeIcon
} from '@heroicons/react/24/outline';

interface RegisterFormProps {
  onSuccess: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState<SeatCategory>('invitado');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activeConfig = CATEGORY_CONFIG[categoria];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!nombre.trim()) {
      setError('Ingresa tu nombre completo');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), categoria }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al registrarse');
        setLoading(false);
        return;
      }
      onSuccess();
    } catch {
      setError('Error de conexión');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Dynamic Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[480px] relative z-10"
      >
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="w-20 h-20 bg-gradient-to-br from-orange/20 to-orange/5 border border-orange/20 rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-2xl relative group"
          >
            <div className="absolute inset-0 bg-orange/20 rounded-[28px] blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
            <AcademicCapIcon className="w-10 h-10 text-orange relative z-10 drop-shadow-[0_0_10px_rgba(255,105,0,0.5)]" />
          </motion.div>

          <h1 className="text-4xl font-black text-white tracking-tighter leading-none mb-3">
            Graduación <span className="text-orange drop-shadow-[0_0_15px_rgba(255,105,0,0.3)]">2026</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[5px] opacity-70">
            Sistema de Asignación
          </p>
        </div>

        <div className="bg-[#001D2D]/80 backdrop-blur-2xl border border-white/10 rounded-[40px] p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
          <div
            className="absolute top-0 left-0 w-full h-1.5 transition-colors duration-500"
            style={{ backgroundColor: activeConfig.hex }}
          />

          <div className="mb-10 text-center">
            <h2 className="text-xl font-bold text-white tracking-tight">Regístrate para continuar</h2>
            <p className="text-slate-500 text-xs mt-2 font-medium">Ingresa tus datos para reservar tu ubicación</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[3px] block ml-1">
                Nombre Completo
              </label>
              <div className="relative group">
                <UserCircleIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 transition-colors group-focus-within:text-orange" />
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => { setNombre(e.target.value); setError(''); }}
                  placeholder="Tu nombre"
                  className="w-full bg-black/20 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white focus:ring-4 focus:ring-orange/10 focus:border-orange/20 transition-all outline-none placeholder:text-slate-700 font-semibold"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[3px] block ml-1">
                ¿Quién eres?
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(CATEGORY_CONFIG) as [SeatCategory, typeof CATEGORY_CONFIG['invitado']][]).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategoria(key)}
                    className={`relative p-4 rounded-2xl border-2 transition-all group overflow-hidden ${categoria === key
                        ? 'bg-white/5 shadow-inner'
                        : 'bg-transparent border-white/5 hover:border-white/10'
                      }`}
                    style={{
                      borderColor: categoria === key ? config.hex : undefined
                    }}
                  >
                    <div className="flex items-center gap-3 relative z-10">
                      <div
                        className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                        style={{ backgroundColor: config.hex }}
                      />
                      <span className={`text-[13px] font-black tracking-tight transition-colors ${categoria === key ? 'text-white' : 'text-slate-500 group-hover:text-slate-400'
                        }`}>
                        {config.label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-500 text-xs font-bold text-center"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 rounded-2xl text-[14px] font-black text-white bg-orange shadow-[0_10px_30px_rgba(255,105,0,0.3)] hover:shadow-[0_15px_40px_rgba(255,105,0,0.4)] transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-3 group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span>{loading ? 'Procesando...' : 'Continuar al mapa'}</span>
              <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 opacity-40">
          <CheckBadgeIcon className="w-4 h-4 text-slate-500" />
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Asegura tu lugar para el gran evento</p>
        </div>
      </motion.div>
    </div>
  );
}
