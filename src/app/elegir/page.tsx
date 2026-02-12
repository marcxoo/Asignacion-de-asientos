'use client';

import { useState, useEffect } from 'react';
import { RegisterForm } from '@/components/RegisterForm';
import { PublicAuditoriumView } from '@/components/PublicAuditoriumView';
import { Registro } from '@/lib/types';
import { supabase } from '@/lib/supabase';

export default function ElegirPage() {
  const [me, setMe] = useState<Registro | null | undefined>(undefined);
  const [latestTemplate, setLatestTemplate] = useState<{ id: string, name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // 1. Fetch latest template
      const { data: templates } = await supabase
        .from('templates')
        .select('id, name')
        .order('created_at', { ascending: false })
        .limit(1);

      const template = templates?.[0];
      setLatestTemplate(template || null);

      // 2. Fetch me (if template)
      if (template) {
        try {
          const res = await fetch('/api/registro/me');
          const user = await res.json();
          // verify user belongs to template
          if (user && user.template_id === template.id) {
            setMe(user);
          } else {
            setMe(null);
          }
        } catch {
          setMe(null);
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  const handleRegisterSuccess = () => {
    // refetch me
    fetch('/api/registro/me')
      .then((res) => res.json())
      .then((data) => {
        if (data && latestTemplate && data.template_id === latestTemplate?.id) setMe(data);
      });
  };

  if (loading) return <div className="min-h-screen bg-[#222223] flex items-center justify-center text-slate-400">Cargando...</div>;

  if (!latestTemplate) return <div className="min-h-screen bg-[#222223] flex items-center justify-center text-slate-400">No hay eventos activos.</div>;

  if (me === null) {
    return <RegisterForm templateId={latestTemplate.id} templateName={latestTemplate.name} onSuccess={handleRegisterSuccess} />;
  }

  // user is logged in
  if (me) {
    return <PublicAuditoriumView me={me} templateId={latestTemplate.id} templateName={latestTemplate.name} />;
  }

  return null;
}
