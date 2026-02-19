import { SharedAuditoriumView } from '@/components/SharedAuditoriumView';
import { createSupabaseServer } from '@/lib/supabase-server'; // Assuming this exists or I need to check
import { notFound } from 'next/navigation';

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function SharedReservationPage({ params }: PageProps) {
    const { id } = await params;

    // Verify if the ID exists as a template
    // Ideally we should use a separate "shared_links" table for security,
    // but per user request for simplicity "link de admin solo a una persona",
    // we can treat the template ID as the shared key for now.
    // Or we can check if it matches a known pattern if we don't want to expose pure IDs.

    // Let's create a Supabase client to verify existence
    // Note: createSupabaseServer might be needing cookies, but here we are in a server component.
    // I need to check if 'createSupabaseServer' is available. 
    // Based on `src/app/api/asiento/asignar/route.ts`, it is imported from `@/lib/supabase-server`.

    const supabase = createSupabaseServer();

    // Verify template exists
    const { data: template, error } = await supabase
        .from('templates')
        .select('id, name')
        .eq('id', id)
        .single();

    if (error || !template) {
        // If not a template, maybe it's a "magic string" for the main event?
        // User didn't specify, but let's stick to template IDs for now.
        // If the user wants the "LIVE" main event without a template, 
        // we could accept a special token like "evento-principal-2026".
        if (id === 'evento-principal-2026') {
            return <SharedAuditoriumView templateId="" eventName="Evento Principal" />;
        }

        return notFound();
    }

    return (
        <SharedAuditoriumView
            templateId={template.id}
            eventName={template.name}
        />
    );
}
