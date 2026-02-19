import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { PlusIcon, CalendarIcon, ArrowRightIcon, TrashIcon, ShieldCheckIcon, UserGroupIcon } from '@heroicons/react/24/outline';

interface Template {
    id: string;
    name: string;
    created_at: string;
    data: unknown[];
}

interface AdminTemplateSelectorProps {
    onSelectTemplate: (template: Template) => void;
    onNewTemplate: () => void;
}

export function AdminTemplateSelector({ onSelectTemplate, onNewTemplate }: AdminTemplateSelectorProps) {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [orphanedCount, setOrphanedCount] = useState(0);
    const [csvLoadingByTemplate, setCsvLoadingByTemplate] = useState<Record<string, boolean>>({});
    const [sendLoadingByTemplate, setSendLoadingByTemplate] = useState<Record<string, boolean>>({});

    async function fetchTemplates() {
        const { data } = await supabase
            .from('templates')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setTemplates(data);
    }

    async function checkCurrentAssignments() {
        const { count: orphans } = await supabase
            .from('assignments')
            .select('*', { count: 'exact', head: true })
            .is('template_id', null)
            .neq('seat_id', 'placeholder__');

        setOrphanedCount(orphans || 0);
    }

    useEffect(() => {
        fetchTemplates();
        checkCurrentAssignments();
    }, []);

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

    const handleCsvImport = async (templateId: string, file: File | null) => {
        if (!file) return;
        setCsvLoadingByTemplate((prev) => ({ ...prev, [templateId]: true }));
        try {
            const previewData = new FormData();
            previewData.append('file', file);

            const previewRes = await fetch(`/api/admin/events/${templateId}/invitations/import/preview`, {
                method: 'POST',
                body: previewData,
            });
            const preview = await previewRes.json();

            if (!previewRes.ok) {
                alert(preview.error || 'No se pudo procesar el CSV');
                return;
            }

            const confirmImport = confirm(
                `Vista previa CSV\n` +
                `- Total: ${preview.total}\n` +
                `- Válidos: ${preview.valid}\n` +
                `- Inválidos: ${preview.invalid}\n` +
                `- Duplicados en archivo: ${preview.duplicates_in_file}\n` +
                `- Ya existentes en evento: ${preview.duplicates_in_db}\n\n` +
                `¿Deseas confirmar importación?`
            );

            if (!confirmImport) return;

            const confirmRes = await fetch(`/api/admin/events/${templateId}/invitations/import/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: preview.rows }),
            });
            const confirmed = await confirmRes.json();

            if (!confirmRes.ok) {
                alert(confirmed.error || 'No se pudo confirmar la importación');
                return;
            }

            alert(`Importación completada. Insertados: ${confirmed.inserted}, Actualizados: ${confirmed.updated}, Omitidos: ${confirmed.skipped}`);
        } catch (error) {
            console.error(error);
            alert('Error de conexión durante la importación CSV');
        } finally {
            setCsvLoadingByTemplate((prev) => ({ ...prev, [templateId]: false }));
        }
    };

    const handleSendInvitations = async (templateId: string) => {
        setSendLoadingByTemplate((prev) => ({ ...prev, [templateId]: true }));
        try {
            const res = await fetch(`/api/admin/events/${templateId}/invitations/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'simulate', limit: 1000 }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || 'No se pudo iniciar la campaña');
                return;
            }
            alert(`Campaña simulada completada. Enviados: ${data.sent}, Fallidos: ${data.failed}`);
        } catch (error) {
            console.error(error);
            alert('Error de conexión al enviar invitaciones');
        } finally {
            setSendLoadingByTemplate((prev) => ({ ...prev, [templateId]: false }));
        }
    };

    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            alert(`${label} copiado al portapapeles`);
        } catch (err) {
            console.error('Failed to copy keys', err);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center p-8 relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-orange/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px]" />
            </div>

            <div className="max-w-6xl w-full relative z-10">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-white tracking-tighter mb-4">
                        Panel de Administración
                    </h1>
                    <p className="text-slate-400 text-lg">
                        Selecciona el evento que deseas gestionar o crea uno nuevo
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* New Event Card */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onNewTemplate}
                        className="flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed border-white/10 hover:border-orange/50 hover:bg-orange/5 transition-all group min-h-[280px]"
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
                            className="relative p-6 rounded-3xl bg-[#001D2D] border border-white/5 hover:border-white/20 transition-all group flex flex-col min-h-[280px]"
                            onClick={() => onSelectTemplate(template)}
                        >
                            <div className="flex-1 cursor-pointer">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                                        <CalendarIcon className="w-6 h-6 text-indigo-400" />
                                    </div>
                                    <div className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono text-slate-500">
                                        {new Date(template.created_at).toLocaleDateString()}
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">
                                    {template.name}
                                </h3>

                            </div>

                            {/* Actions Section */}
                            <div className="mt-6 space-y-3" onClick={(e) => e.stopPropagation()}>
                                {/* Share Links */}
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => copyToClipboard(`${window.location.origin}/evento/${template.id}`, 'Enlace Público (Invitados)')}
                                        className="flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-emerald-500/20 border border-white/5 hover:border-emerald-500/30 rounded-xl transition-all group/btn"
                                        title="Copiar enlace para inivitados (Público)"
                                    >
                                        <UserGroupIcon className="w-4 h-4 text-emerald-400 group-hover/btn:scale-110 transition-transform" />
                                        <span className="text-[10px] font-bold text-emerald-400">Invitados</span>
                                    </button>

                                    <button
                                        onClick={() => copyToClipboard(`${window.location.origin}/delegado/${template.id}`, 'Enlace Admin (Delegado)')}
                                        className="flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-orange/20 border border-white/5 hover:border-orange/30 rounded-xl transition-all group/btn"
                                        title="Copiar enlace administrativo (Delegado)"
                                    >
                                        <ShieldCheckIcon className="w-4 h-4 text-orange group-hover/btn:scale-110 transition-transform" />
                                        <span className="text-[10px] font-bold text-orange">Admin</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <label className="flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-sky-500/20 border border-white/5 hover:border-sky-500/30 rounded-xl transition-all cursor-pointer">
                                        <input
                                            type="file"
                                            accept=".csv,.xlsx,.xls"
                                            className="hidden"
                                            onChange={(e) => handleCsvImport(template.id, e.target.files?.[0] ?? null)}
                                        />
                                        <span className="text-[10px] font-bold text-sky-300">
                                            {csvLoadingByTemplate[template.id] ? 'Procesando...' : 'CSV Docentes'}
                                        </span>
                                    </label>

                                    <button
                                        onClick={() => handleSendInvitations(template.id)}
                                        className="flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-blue-500/20 border border-white/5 hover:border-blue-500/30 rounded-xl transition-all"
                                    >
                                        <span className="text-[10px] font-bold text-blue-300">
                                            {sendLoadingByTemplate[template.id] ? 'Enviando...' : 'Enviar Campaña'}
                                        </span>
                                    </button>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                    <button
                                        onClick={() => onSelectTemplate(template)}
                                        className="text-xs font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                                    >
                                        Gestionar Mapa <ArrowRightIcon className="w-3 h-3" />
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
                                <div className="mt-4 pt-4 border-t border-white/5" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => handleMigrateOrphans(template.id)}
                                        className="w-full py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-500 text-xs font-bold hover:bg-yellow-500/20 transition-all flex items-center justify-center gap-2"
                                    >
                                        ⚠️ Importar {orphanedCount} huérfanos
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
