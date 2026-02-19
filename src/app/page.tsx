'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LockClosedIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';


export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError(true);
      return;
    }

    setLoading(true);
    // Simulate a bit of loading for UX
    await new Promise(r => setTimeout(r, 800));

    // Simple validation for now, could be expanded
    if (password === 'admin123' || password === '123') { // Example passwords
      router.push('/admin');
    } else {
      setError(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center px-4 relative overflow-hidden">
      {/* ── Background Elements ── */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[440px] relative z-10">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <div className="relative inline-block mb-6">
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
                rotate: [0, -2, 2, 0]
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="text-6xl filter drop-shadow-[0_0_20px_rgba(255,105,0,0.3)]"
            >
              🎓
            </motion.div>
            <div className="absolute -inset-4 bg-orange/20 blur-2xl rounded-full -z-10" />
          </div>

          <h1 className="text-4xl font-black text-white tracking-tighter leading-tight">
            GRADUACIÓN <span className="text-orange block md:inline drop-shadow-[0_0_15px_rgba(255,105,0,0.4)]">2026</span>
          </h1>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="h-px w-8 bg-white/20" />
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-[4px]">
              Sistema de Asientos
            </p>
            <div className="h-px w-8 bg-white/20" />
          </div>
        </motion.div>

        {/* ── Login Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="bg-[#001D2D]/60 backdrop-blur-2xl border border-white/10 rounded-[32px] p-10 shadow-2xl relative overflow-hidden group"
        >
          {/* Decorative light effect */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute -right-20 -top-20 w-40 h-40 bg-orange/5 rounded-full blur-3xl group-hover:bg-orange/10 transition-all duration-700" />

          <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[3px] ml-1">
                <LockClosedIcon className="w-3 h-3" />
                Acceso Organizador
              </label>

              <div className="relative group">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(false); }}
                  placeholder="Ingrese la contraseña maestra"
                  className={`w-full bg-black/40 border ${error ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-orange/50'
                    } rounded-2xl pl-5 pr-12 py-4 text-[#f5f0ea] placeholder-slate-600 focus:outline-none focus:ring-4 ${error ? 'focus:ring-red-500/10' : 'focus:ring-orange/10'
                    } transition-all duration-300 font-semibold`}
                  autoFocus
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="text-red-400 text-[10px] font-bold uppercase tracking-wider mt-2 ml-1 flex items-center gap-1.5"
                  >
                    <span className="w-1 h-1 bg-red-400 rounded-full" />
                    Contraseña incorrecta o vacía
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full relative group overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange to-orange-hover opacity-100 group-hover:opacity-90 transition-opacity" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_white_0%,_transparent_100%)] opacity-0 group-hover:opacity-20 transition-opacity duration-700" />

              <div className="relative py-4 rounded-2xl flex items-center justify-center gap-3 text-white font-black text-sm uppercase tracking-widest shadow-[0_10px_30px_rgba(255,105,0,0.3)] group-hover:shadow-[0_15px_40px_rgba(255,105,0,0.4)] transition-all group-active:scale-[0.97]">
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Entrar al Panel</span>
                    <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </div>
            </button>
          </form>

          {/* Quick links / Help */}
          <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
            <button className="text-[10px] font-black text-slate-500 hover:text-orange uppercase tracking-widest transition-colors flex items-center gap-1 group">
              Ayuda
              <ChevronRightIcon className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
              <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
              <div className="w-1.5 h-1.5 rounded-full bg-orange/40" />
            </div>
          </div>
        </motion.div>

        {/* ── Footer ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-8 text-center space-y-4"
        >
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[4px]">
            © 2026 Registro de Eventos
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.02] border border-white/5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Servidor Seguro</span>
          </div>
        </motion.div>
      </div>

      {/* ── Texture ── */}
      <div className="absolute inset-0 pointer-events-none opacity-20 mix-blend-soft-light"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
    </div>
  );
}
