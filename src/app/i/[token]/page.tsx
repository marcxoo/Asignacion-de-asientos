'use client';

import { use, useEffect, useState } from 'react';
import { PublicAuditoriumView } from '@/components/PublicAuditoriumView';
import { Registro } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface PageProps {
  params: Promise<{ token: string }>;
}

interface InvitationViewModel {
  id: string;
  nombre: string;
  categoria: Registro['categoria'];
  correo?: string | null;
  template_id: string;
}

export default function InvitationPage({ params }: PageProps) {
  const { token } = use(params);
  const [invitation, setInvitation] = useState<InvitationViewModel | null>(null);
  const [eventName, setEventName] = useState('Evento');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`/api/public/invitaciones/validate?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? 'Invitación inválida');
          setLoading(false);
          return;
        }

        setInvitation(data);

        const { data: templateData } = await supabase
          .from('templates')
          .select('name')
          .eq('id', data.template_id)
          .single();

        if (templateData?.name) {
          setEventName(templateData.name);
        }
      } catch {
        setError('No se pudo validar la invitación');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [token]);

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-slate-300">Validando invitación...</div>;
  }

  if (error || !invitation) {
    return <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-red-400">{error ?? 'Invitación inválida'}</div>;
  }

  const me: Registro = {
    id: invitation.id,
    nombre: invitation.nombre,
    categoria: invitation.categoria,
    template_id: invitation.template_id,
    correo: invitation.correo,
  };

  return (
    <PublicAuditoriumView
      me={me}
      templateId={invitation.template_id}
      templateName={eventName}
      invitationToken={token}
    />
  );
}
