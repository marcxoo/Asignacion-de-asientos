'use client';

import { useState, useEffect, use } from 'react';
import { RegisterForm } from '@/components/RegisterForm';
import { PublicAuditoriumView } from '@/components/PublicAuditoriumView';
import { Registro } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface PageProps {
    params: Promise<{ eventId: string }>;
}

export default function EventPage({ params }: PageProps) {
    const { eventId } = use(params);
    const [me, setMe] = useState<Registro | null | undefined>(undefined);
    const [templateName, setTemplateName] = useState<string>('');

    useEffect(() => {
        // 1. Fetch template name for context
        const fetchTemplateInfo = async () => {
            const { data } = await supabase
                .from('templates')
                .select('name')
                .eq('id', eventId)
                .single();
            if (data) setTemplateName(data.name);
        };

        // 2. Fetch current user
        const fetchMe = async () => {
            try {
                const res = await fetch('/api/registro/me');
                const data = await res.json();

                // Ensure user belongs to THIS event
                if (data && data.template_id === eventId) {
                    setMe(data);
                } else {
                    setMe(null);
                }
            } catch {
                setMe(null);
            }
        };

        fetchTemplateInfo();
        fetchMe();
    }, [eventId]);

    const handleSuccess = () => {
        fetch('/api/registro/me')
            .then((res) => res.json())
            .then((data) => {
                if (data) setMe(data);
            });
    };

    if (me === undefined) {
        return (
            <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-orange/20 border-t-orange rounded-full animate-spin" />
            </div>
        );
    }

    if (me === null) {
        return (
            <RegisterForm
                templateId={eventId}
                templateName={templateName}
                onSuccess={handleSuccess}
            />
        );
    }

    return (
        <PublicAuditoriumView
            me={me}
            templateId={eventId}
            templateName={templateName}
        />
    );
}
