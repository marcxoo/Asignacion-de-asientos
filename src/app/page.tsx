'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError(true);
      return;
    }
    setLoading(true);
    // TODO: validate against API route with env variable
    setTimeout(() => router.push('/mapa'), 300);
  };

  return (
    <div className="min-h-screen bg-[#222223] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🎓</div>
          <h1 className="text-2xl font-extrabold text-[#FF6900]">
            Graduación 2026
          </h1>
          <p className="text-sm text-slate-400 mt-2">Sistema de Asignación de Asientos</p>
        </div>

        {/* Login card */}
        <div className="bg-[#002E45] border border-white/10 rounded-2xl p-6">
          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Contraseña de acceso
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                placeholder="Ingresa la contraseña"
                className={`w-full bg-[#222223] border ${error ? 'border-red-500' : 'border-white/10'
                  } rounded-xl px-4 py-3 text-sm text-[#f5f0ea] placeholder-slate-500 focus:outline-none focus:border-[#FF6900] focus:ring-1 focus:ring-[#FF6900]/30 transition-all`}
                autoFocus
              />
              {error && (
                <p className="text-red-400 text-xs mt-1.5">Contraseña requerida</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold bg-[#FF6900] text-white hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/25 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#5c5550] mt-6">
          Acceso exclusivo para organizadores
        </p>
      </div>
    </div>
  );
}
