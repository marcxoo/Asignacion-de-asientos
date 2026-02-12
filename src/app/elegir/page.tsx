'use client';

import { useState, useEffect } from 'react';
import { RegisterForm } from '@/components/RegisterForm';
import { PublicAuditoriumView } from '@/components/PublicAuditoriumView';
import { Registro } from '@/lib/types';

export default function ElegirPage() {
  const [me, setMe] = useState<Registro | null | undefined>(undefined);

  useEffect(() => {
    fetch('/api/registro/me')
      .then((res) => res.json())
      .then((data) => {
        setMe(data ?? null);
      })
      .catch(() => setMe(null));
  }, []);

  const handleRegisterSuccess = () => {
    fetch('/api/registro/me')
      .then((res) => res.json())
      .then((data) => {
        if (data) setMe(data);
      });
  };

  if (me === undefined) {
    return (
      <div className="min-h-screen bg-[#222223] flex items-center justify-center">
        <div className="text-slate-400">Cargando...</div>
      </div>
    );
  }

  if (me === null) {
    return <RegisterForm onSuccess={handleRegisterSuccess} />;
  }

  return <PublicAuditoriumView me={me} />;
}
