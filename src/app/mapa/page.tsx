'use client';

import { useState } from 'react';
import { AuditoriumView } from '@/components/AuditoriumView';
import { AdminTemplateSelector } from '@/components/AdminTemplateSelector';
import { supabase } from '@/lib/supabase';

type ViewMode = 'SELECTOR' | 'MAP';

export default function MapaPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('SELECTOR');
  const [activeTemplate, setActiveTemplate] = useState<{ id: string; name: string } | null>(null);

  const handleContinue = () => {
    setViewMode('MAP');
  };

  const handleSelectTemplate = async (template: any) => {
    // Just open the template. 
    // The AuditoriumView will fetch the LIVE data from 'assignments' table filtered by template.id
    // We do NOT want to overwrite live data with the old snapshot stored in template.data
    setActiveTemplate({ id: template.id, name: template.name });
    setViewMode('MAP');
  };

  const handleNewTemplate = () => {
    setActiveTemplate(null);
    setViewMode('MAP');
  };

  const handleSaveTemplate = async (name: string, data: any[]) => {
    const trimmedName = name.trim();
    let result;

    if (activeTemplate && activeTemplate.name === trimmedName) {
      // Update existing
      result = await supabase.from('templates').update({
        data: data
      }).eq('id', activeTemplate.id).select().single();
    } else {
      // Create new
      result = await supabase.from('templates').insert({
        name: trimmedName,
        data: data
      }).select().single();
    }

    if (result.error) {
      console.error('Error al guardar plantilla:', result.error);
    } else {
      setActiveTemplate({ id: result.data.id, name: result.data.name });
    }
  };

  if (viewMode === 'SELECTOR') {
    return (
      <AdminTemplateSelector
        onSelectTemplate={handleSelectTemplate}
        onNewTemplate={handleNewTemplate}
        onContinue={handleContinue}
      />
    );
  }

  return (
    <AuditoriumView
      onBack={() => setViewMode('SELECTOR')}
      activeTemplateId={activeTemplate?.id}
      activeTemplateName={activeTemplate?.name}
      onSaveTemplate={handleSaveTemplate}
    />
  );
}
