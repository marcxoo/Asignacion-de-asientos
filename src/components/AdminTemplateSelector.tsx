import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { PlusIcon, CalendarIcon, ArrowRightIcon, TrashIcon, MapIcon } from '@heroicons/react/24/outline';

interface Template {
    id: string;
    name: string;
    created_at: string;
    data: any[];
}

interface AdminTemplateSelectorProps {
    onSelectTemplate: (template: Template) => void;
    onNewTemplate: () => void;
    onContinue: () => void;
}

export function AdminTemplateSelector({ onSelectTemplate, onNewTemplate, onContinue }: AdminTemplateSelectorProps) {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [hasAssignments, setHasAssignments] = useState(false);
    const [orphanedCount, setOrphanedCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTemplates();
        checkCurrentAssignments();
    }, []);

    const fetchTemplates = async () => {
        const { data } = await supabase
            .from('templates')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setTemplates(data);
        setLoading(false);
    };

    const checkCurrentAssignments = async () => {
        // Check for active assignments in general (just to show "Continue" button if needed)
        const { count } = await supabase
            .from('assignments')
            .select('*', { count: 'exact', head: true })
            .neq('seat_id', 'placeholder__');

        setHasAssignments((count || 0) > 0);

        // Check for ORPHANED assignments (null template_id)
        const { count: orphans } = await supabase
            .from('assignments')
            .select('*', { count: 'exact', head: true })
            .is('template_id', null)
            .neq('seat_id', 'placeholder__');

        setOrphanedCount(orphans || 0);
    };

    const handleMigrateOrphans = async (targetTemplateId: string) => {
        if (!confirm('¿Estás seguro de mover los datos antiguos a este evento?')) return;

        try {
            const res = await fetch('/api/admin/migrate-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_template_id: targetTemplateId })
            });
            const data = await res.json();
            if (data.success) {
                alert('Datos migrados correctamente. Ahora aparecerán en este evento.');
                checkCurrentAssignments();
                fetchTemplates();
            } else {
                alert('Error al migrar datos.');
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión.');
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('¿Estás seguro de eliminar este evento?')) return;

        const { error } = await supabase.from('templates').delete().eq('id', id);
        if (!error) fetchTemplates();
    };

    return (
        <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center p-8 relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-orange/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px]" />
            </div>

            <div className="max-w-4xl w-full relative z-10">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-white tracking-tighter mb-4">
                        Panel de Administración
                    </h1>
                    <p className="text-slate-400 text-lg">
                        Selecciona el evento que deseas gestionar o crea uno nuevo
                    </p>
                </div>

                <div className="flex justify-center mb-10">
                    {hasAssignments && (
                        <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={onContinue}
                            className="flex items-center gap-3 px-8 py-4 bg-orange/20 border border-orange/40 hover:bg-orange/30 rounded-2xl text-orange font-black text-sm transition-all group"
                        >
                            <MapIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            Continuar con distribución actual (sin cargar plantilla)
                        </motion.button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* New Event Card */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onNewTemplate}
                        className="flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed border-white/10 hover:border-orange/50 hover:bg-orange/5 transition-all group min-h-[240px]"
                    >
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-orange/20 transition-colors">
                            <PlusIcon className="w-8 h-8 text-slate-400 group-hover:text-orange transition-colors" />
                        </div>
                        <span className="text-lg font-bold text-white mb-1">Nuevo Evento</span>
                        <span className="text-xs text-slate-500 text-center">
                            Comenzar con el auditorio vacío
                        </span>
                    </motion.button>

                    {/* Existing Templates */}
                    {templates.map((template) => (
                        <motion.div
                            key={template.id}
                            whileHover={{ scale: 1.02 }}
                            className="relative p-8 rounded-3xl bg-[#001D2D] border border-white/5 hover:border-white/20 transition-all group cursor-pointer flex flex-col min-h-[240px]"
                            onClick={() => onSelectTemplate(template)}
                        >
                            <div className="flex-1">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6">
                                    <CalendarIcon className="w-6 h-6 text-indigo-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">
                                    {template.name}
                                </h3>
                                <p className="text-xs text-slate-500 font-mono">
                                    Creado el {new Date(template.created_at).toLocaleDateString()}
                                </p>
                            </div>

                            <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/5">
                                <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors flex items-center gap-2">
                                    Gestionar <ArrowRightIcon className="w-3 h-3" />
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const url = `${window.location.origin}/e/${template.id}`;
                                            navigator.clipboard.writeText(url);
                                            alert('Enlace público copiado al portapapeles');
                                        }}
                                        className="p-2 hover:bg-emerald-500/10 rounded-lg text-slate-600 hover:text-emerald-400 transition-colors"
                                        title="Copiar enlace público"
                                    >
                                        <PlusIcon className="w-4 h-4 rotate-45" /> {/* Simulating a link/share icon with rotation or just use a Clipboard one if available */}
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(e, template.id)}
                                        className="p-2 hover:bg-red-500/10 rounded-lg text-slate-600 hover:text-red-400 transition-colors"
                                        title="Eliminar evento"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Migration Option for Orphans */}
                            {orphanedCount > 0 && (
                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleMigrateOrphans(template.id);
                                        }}
                                        className="w-full py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-500 text-xs font-bold hover:bg-yellow-500/20 transition-all flex items-center justify-center gap-2"
                                    >
                                        ⚠️ Importar {orphanedCount} registros huérfanos aquí
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}
