import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSchool, formatImageUrl } from '../../context/SchoolContext';
import { hasPermission } from '../../lib/permissions';
import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';

const SidebarItem: React.FC<{ to: string, icon: string, label: string }> = ({ to, icon, label }) => {
    const location = useLocation();
    const { currentUser } = useSchool();
    const isActive = location.pathname === to;

    if (currentUser && !hasPermission(currentUser.role, to)) {
        return null;
    }

    return (
        <Link
            to={to}
            className="block relative group"
        >
            {isActive && (
                <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200/50"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
            )}
            <div className={`relative flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors duration-200 ${isActive ? 'text-white' : 'text-slate-600 group-hover:bg-slate-50'
                }`}>
                <span className="text-xl relative z-10">{icon}</span>
                <span className={`font-bold text-sm relative z-10 ${isActive ? 'font-black' : 'font-medium'}`}>{label}</span>
            </div>
        </Link>
    );
};

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
    const { data, currentUser, logout } = useSchool();
    const systemLogoUrl = formatImageUrl(data.settings.systemLogo);
    const role = currentUser?.role || 'prof';

    const roleLabels: Record<string, string> = {
        admin_ti: 'Admin TI',
        admin_dir: 'Direção',
        coord: 'Coordenação',
        sec: 'Secretaria',
        prof: 'Professor'
    };

    // Classes de visibilidade e posicionamento
    const sidebarClasses = `
        fixed md:sticky top-0 h-screen z-50 flex flex-col 
        bg-white/80 backdrop-blur-xl border-r border-slate-200/60 w-72 
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    `;

    // Overlay para mobile
    const Overlay = () => (
        <div
            className={`fixed inset-0 bg-slate-900/50 z-40 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={onClose}
        />
    );

    return (
        <>
            <Overlay />
            <aside className={sidebarClasses}>
                <div className="p-8 border-b border-slate-100/50 flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="cursor-pointer"
                        >
                            {systemLogoUrl ? (
                                <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center bg-white shadow-sm ring-1 ring-slate-100 shrink-0">
                                    <img src={systemLogoUrl} alt="Logo Sistema" className="max-w-full max-h-full object-contain" />
                                </div>
                            ) : (
                                <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0 shadow-lg shadow-indigo-200">SEI</div>
                            )}
                        </motion.div>
                        <div className="overflow-hidden">
                            <h1 className="text-[11px] font-black tracking-tight text-[#0A1128] leading-tight uppercase">SEI - Sistema Escolar</h1>
                            <p className="text-[8px] text-slate-400 mt-1 uppercase tracking-widest font-bold leading-tight">Gestão Inteligente</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-6 space-y-2 overflow-y-auto custom-scrollbar" onClick={() => window.innerWidth < 768 && onClose()}>
                    <SidebarItem to="/" icon="📊" label="Dashboard" />
                    <SidebarItem to="/curriculum" icon="🧬" label="Grade Curricular" />
                    <SidebarItem to="/subjects" icon="📚" label="Disciplinas" />
                    <SidebarItem to="/classes" icon="🏫" label="Turmas" />
                    <SidebarItem to="/teachers" icon="👨‍🏫" label="Professores" />
                    <SidebarItem to="/students" icon="🎓" label="Protagonistas" />
                    <SidebarItem to="/grades" icon="📝" label="Lançar Notas" />
                    <SidebarItem to="/council" icon="📋" label="Conselho" />
                    <SidebarItem to="/analytics" icon="📈" label="Análise" />
                    <SidebarItem to="/reports" icon="📄" label="Boletins" />
                    <div className="h-px bg-slate-100 my-4" />
                    <SidebarItem to="/users" icon="👥" label="Usuários" />
                    <SidebarItem to="/settings" icon="⚙️" label="Configurações" />
                </nav>

                <div className="p-6 border-t border-slate-100/50 space-y-4 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-400 text-xs font-black shrink-0">
                                {currentUser?.name.substring(0, 1).toUpperCase()}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-[10px] font-black text-slate-800 uppercase truncate" title={currentUser?.name}>
                                    {currentUser?.name}
                                </p>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                                    {roleLabels[role]}
                                </p>
                            </div>
                        </div>
                        <button onClick={logout} className="p-2 text-slate-300 hover:text-red-500 transition-colors shrink-0" title="Sair">
                            <LogOut size={18} />
                        </button>
                    </div>
                    <div className="bg-white/50 rounded-2xl p-3 border border-slate-100 text-center">
                        <p className="text-[9px] font-black text-slate-400/80 uppercase tracking-widest">v3.7.0 Premium</p>
                    </div>
                </div>
            </aside>
        </>
    );
};
