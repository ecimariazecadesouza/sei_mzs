
import React, { useState, useMemo } from 'react';
import { useSchool } from '../context/SchoolContext';
import { SchoolData } from '../types';
import { Pencil, Trash2, Plus, Folder, ChevronDown } from 'lucide-react';
import { sortSubjects } from '../lib/sorting';

// --- Icons ---
const Icons = {
  Edit: () => <Pencil size={16} />,
  Trash: () => <Trash2 size={16} />,
  Plus: () => <Plus size={16} />,
  Folder: () => <Folder size={20} className="text-indigo-200" />,
  ChevronDown: ({ className }: { className?: string }) => <ChevronDown size={16} className={className} />
};

type ModalType = 'formation' | 'area' | 'subarea' | 'subject';
type Periodicity = 'Anual' | 'Semestral';
type Semester = '1' | '2' | 'Ambos';

interface ModalState {
  type: ModalType;
  parentId?: string;
  editingId?: string;
  initialName?: string;
  initialPeriod?: Periodicity;
  initialSemester?: Semester;
}

interface DeleteState {
  type: keyof SchoolData;
  id: string;
  label: string;
}

const ActionButton: React.FC<{ onClick: (e: React.MouseEvent) => void; icon: React.ReactNode; colorClass: string; title?: string }> = ({ onClick, icon, colorClass, title }) => (
  <button onClick={(e) => { e.stopPropagation(); onClick(e); }} className={`p-1.5 rounded-lg transition-all hover:bg-opacity-10 hover:bg-slate-900 ${colorClass}`} title={title}>{icon}</button>
);

const SubjectRow: React.FC<{ subject: any; onEdit: () => void; onDelete: () => void }> = ({ subject, onEdit, onDelete }) => (
  <div className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg hover:border-indigo-200 hover:shadow-sm transition-all group">
    <div className="flex items-center space-x-3">
      <div className={`w-2 h-2 rounded-full ${subject.periodicity === 'Semestral' ? 'bg-amber-400' : 'bg-indigo-400'}`}></div>
      <div>
        <div className="text-sm font-bold text-slate-700">{subject.name}</div>
        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
          {subject.periodicity} {subject.periodicity === 'Semestral' && `• ${subject.semester === 'Ambos' ? 'Ambos Semestres' : `${subject.semester}º Semestre`}`}
        </div>
      </div>
    </div>
    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <ActionButton onClick={onEdit} icon={<Icons.Edit />} colorClass="text-indigo-500" />
      <ActionButton onClick={onDelete} icon={<Icons.Trash />} colorClass="text-red-400" />
    </div>
  </div>
);

const SubAreaBlock: React.FC<{ subArea: any; subjects: any[]; onAddSubject: () => void; onEdit: () => void; onDelete: () => void; onEditSubject: (s: any) => void; onDeleteSubject: (s: any) => void; }> = ({ subArea, subjects, onAddSubject, onEdit, onDelete, onEditSubject, onDeleteSubject }) => {
  const sortedSubjects = useMemo(() => {
    return [...subjects].sort(sortSubjects);
  }, [subjects]);

  return (
    <div className="pl-4 border-l-2 border-indigo-100 space-y-3 pt-2">
      <div className="flex justify-between items-center group">
        <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-slate-300 rounded-sm"></span> {subArea.name}
        </h5>
        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onAddSubject} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100">+ Disciplina</button>
          <ActionButton onClick={onEdit} icon={<Icons.Edit />} colorClass="text-slate-400 hover:text-indigo-600" />
          <ActionButton onClick={onDelete} icon={<Icons.Trash />} colorClass="text-slate-400 hover:text-red-500" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {sortedSubjects.length === 0 && <div className="text-[10px] text-slate-300 italic p-2">Nenhuma disciplina cadastrada.</div>}
        {sortedSubjects.map(subj => (
          <SubjectRow key={subj.id} subject={subj} onEdit={() => onEditSubject(subj)} onDelete={() => onDeleteSubject(subj)} />
        ))}
      </div>
    </div>
  );
};

const KnowledgeAreaCard: React.FC<{ area: any; subAreas: any[]; allSubjects: any[]; onAddSubArea: () => void; onEdit: () => void; onDelete: () => void; handlers: any; }> = ({ area, subAreas, allSubjects, onAddSubArea, onEdit, onDelete, handlers }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden transition-all hover:border-indigo-300">
      <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-white transition-colors" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center space-x-3">
          <Icons.Folder />
          <span className="font-bold text-slate-700 text-sm">{area.name}</span>
          <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-bold">{subAreas.length} sub</span>
        </div>
        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}><Icons.ChevronDown className="text-slate-400" /></div>
      </div>
      {isOpen && (
        <div className="p-4 pt-0 space-y-6 animate-in slide-in-from-top-2">
          <div className="h-px bg-slate-200 w-full mb-4"></div>
          <div className="flex justify-end space-x-2 mb-2">
            <button onClick={(e) => { e.stopPropagation(); onAddSubArea(); }} className="text-[10px] font-bold text-indigo-600 border border-indigo-200 bg-white px-3 py-1.5 rounded-lg hover:bg-indigo-50 shadow-sm">+ Subárea</button>
            <ActionButton onClick={onEdit} icon={<Icons.Edit />} colorClass="text-slate-400 hover:text-indigo-600 bg-white shadow-sm border border-slate-200" />
            <ActionButton onClick={onDelete} icon={<Icons.Trash />} colorClass="text-slate-400 hover:text-red-500 bg-white shadow-sm border border-slate-200" />
          </div>
          {subAreas.length === 0 && <div className="text-center py-4 text-xs text-slate-400">Esta área está vazia. Adicione uma subárea.</div>}
          {subAreas.map(sub => (
            <SubAreaBlock
              key={sub.id} subArea={sub} subjects={allSubjects.filter(s => s.subAreaId === sub.id)}
              onAddSubject={() => handlers.openModal('subject', sub.id)}
              onEdit={() => handlers.openModal('subarea', undefined, sub.id, sub.name)}
              onDelete={() => handlers.setDeleteConfirm({ type: 'subAreas', id: sub.id, label: sub.name })}
              onEditSubject={(s: any) => handlers.openModal('subject', sub.id, s.id, s.name, s.periodicity, s.semester)}
              onDeleteSubject={(s: any) => handlers.setDeleteConfirm({ type: 'subjects', id: s.id, label: s.name })}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Curriculum: React.FC = () => {
  const { data, addFormation, updateFormation, addKnowledgeArea, updateKnowledgeArea, addSubArea, updateSubArea, addSubject, updateSubject, deleteItem } = useSchool();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteState | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemPeriod, setItemPeriod] = useState<Periodicity>('Anual');
  const [itemSemester, setItemSemester] = useState<Semester>('1');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const openModal = (type: ModalType, parentId?: string, editingId?: string, initialName?: string, initialPeriod?: Periodicity, initialSemester?: Semester) => {
    setModal({ type, parentId, editingId, initialName, initialPeriod, initialSemester });
    setItemName(initialName || '');
    setItemPeriod(initialPeriod || 'Anual');
    setItemSemester(initialSemester || '1');
    setErrorMsg(null);
  };

  const handleSave = async () => {
    if (!modal || !itemName) return;
    setIsSaving(true);
    try {
      const semesterPayload = itemPeriod === 'Anual' ? 'Ambos' : itemSemester;
      if (modal.editingId) {
        switch (modal.type) {
          case 'formation': await updateFormation(modal.editingId, { name: itemName }); break;
          case 'area': await updateKnowledgeArea(modal.editingId, { name: itemName }); break;
          case 'subarea': await updateSubArea(modal.editingId, { name: itemName }); break;
          case 'subject': await updateSubject(modal.editingId, { name: itemName, periodicity: itemPeriod, semester: semesterPayload }); break;
        }
      } else {
        switch (modal.type) {
          case 'formation': await addFormation({ name: itemName }); break;
          case 'area': await addKnowledgeArea({ name: itemName, formationTypeId: modal.parentId! }); break;
          case 'subarea': await addSubArea({ name: itemName, knowledgeAreaId: modal.parentId! }); break;
          case 'subject': await addSubject({ name: itemName, subAreaId: modal.parentId!, periodicity: itemPeriod, semester: semesterPayload, year: '2026' }); break;
        }
      }
      setModal(null);
    } catch (err: any) { setErrorMsg(err.message || "Erro desconhecido."); } finally { setIsSaving(false); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#0A1128] tracking-tight">Grade Curricular</h1>
          <p className="text-slate-500 font-medium mt-1">Gestão da estrutura acadêmica e disciplinas.</p>
        </div>
        <button onClick={() => openModal('formation')} className="bg-[#0A1128] text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all flex items-center gap-2">
          <Icons.Plus /> Nova Formação
        </button>
      </div>

      <div className="space-y-8">
        {data.formations.map(formation => (
          <div key={formation.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-xl font-black text-indigo-900 uppercase tracking-tight flex items-center gap-3">
                <span className="w-2 h-8 bg-indigo-600 rounded-full block"></span> {formation.name}
              </h2>
              <div className="flex space-x-1">
                <button onClick={() => openModal('area', formation.id)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100">+ Área</button>
                <ActionButton onClick={() => openModal('formation', undefined, formation.id, formation.name)} icon={<Icons.Edit />} colorClass="text-slate-400 hover:text-indigo-600" />
                <ActionButton onClick={() => setDeleteConfirm({ type: 'formations', id: formation.id, label: formation.name })} icon={<Icons.Trash />} colorClass="text-slate-400 hover:text-red-500" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4 pl-4 border-l-2 border-slate-100 ml-3">
              {data.knowledgeAreas.filter(ka => ka.formationTypeId === formation.id).length === 0 && <div className="p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center text-slate-400 text-sm font-medium">Nenhuma área cadastrada.</div>}
              {data.knowledgeAreas.filter(ka => ka.formationTypeId === formation.id).map(area => (
                <KnowledgeAreaCard key={area.id} area={area} subAreas={data.subAreas.filter(sa => sa.knowledgeAreaId === area.id)} allSubjects={data.subjects} onAddSubArea={() => openModal('subarea', area.id)} onEdit={() => openModal('area', undefined, area.id, area.name)} onDelete={() => setDeleteConfirm({ type: 'knowledgeAreas', id: area.id, label: area.name })} handlers={{ openModal, setDeleteConfirm }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-[#0A1128]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50"><h3 className="text-xl font-black text-slate-800">{modal.editingId ? 'Editar' : 'Adicionar'} <span className="text-indigo-600 ml-1">{modal.type === 'formation' ? 'Formação' : modal.type === 'area' ? 'Área' : modal.type === 'subarea' ? 'Subárea' : 'Disciplina'}</span></h3></div>
            <div className="p-8 space-y-6">
              {errorMsg && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg font-bold">{errorMsg}</div>}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome</label>
                <input autoFocus value={itemName} onChange={e => setItemName(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all" />
              </div>
              {modal.type === 'subject' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Periodicidade</label>
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                      {['Anual', 'Semestral'].map(p => (
                        <button key={p} onClick={() => setItemPeriod(p as any)} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${itemPeriod === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{p}</button>
                      ))}
                    </div>
                  </div>
                  {itemPeriod === 'Semestral' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Semestre de Aplicação</label>
                      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                        {['1', '2', 'Ambos'].map(s => (
                          <button key={s} onClick={() => setItemSemester(s as any)} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${itemSemester === s ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                            {s === 'Ambos' ? 'Ambos' : `${s}º Sem`}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 italic">Nota: 1º Semestre habilita B1 e B2. 2º Semestre habilita B3 e B4.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-6 py-3 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-xl">Cancelar</button>
              <button onClick={handleSave} disabled={isSaving || !itemName} className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 disabled:opacity-50">{isSaving ? 'Salvando...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-red-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto text-3xl">⚠️</div>
              <h3 className="text-xl font-black text-slate-800">Excluir Item?</h3>
              <p className="text-sm text-slate-400">Você está prestes a remover <strong>{deleteConfirm.label}</strong>.</p>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs">Cancelar</button>
                <button onClick={async () => { await deleteItem(deleteConfirm.type, deleteConfirm.id); setDeleteConfirm(null); }} className="flex-1 py-3 bg-red-600 text-white font-black rounded-xl text-xs">Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Curriculum;
