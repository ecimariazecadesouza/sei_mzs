
import React, { useState, useMemo } from 'react';
import { useSchool } from '../context/SchoolContext';
import { Teacher, Assignment, Class, Subject } from '../types';
import { sortSubjects, sortClasses, sortTeachers } from '../lib/sorting';

const Icon = ({ name, className = "w-5 h-5" }: { name: string, className?: string }) => {
  const icons: Record<string, React.ReactNode> = {
    user: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
    link: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.101-1.101" />,
    trash: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />,
    plus: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />,
    mail: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
    book: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  };
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {icons[name] || null}
    </svg>
  );
};

const Teachers: React.FC = () => {
  const { data, addTeacher, assignTeacher, deleteItem, loading, refreshData } = useSchool();

  // States
  const [filterYear, setFilterYear] = useState('2026');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: 'teachers' | 'assignments', label: string } | null>(null);

  // Filtragem de dados baseada no ano letivo
  const classesDoAno = useMemo(() =>
    data.classes.filter(c => c.year === filterYear).sort(sortClasses)
    , [data.classes, filterYear]);

  const disciplinasDaCarga = useMemo(() => {
    if (selectedClasses.length === 0) return [];

    // Pegar todas as disciplinas que existem em PELO MENOS UMA das turmas selecionadas
    const subjectsInClasses = new Set<string>();
    selectedClasses.forEach(classId => {
      const cls = data.classes.find(c => String(c.id) === String(classId));
      cls?.subjectIds?.forEach(sid => subjectsInClasses.add(String(sid)));
    });

    return data.subjects
      .filter(s => subjectsInClasses.has(String(s.id)))
      .sort(sortSubjects);
  }, [selectedClasses, data.classes, data.subjects]);

  const atribuicoesDoAno = useMemo(() => {
    return data.assignments.filter(ass => {
      const cls = data.classes.find(c => String(c.id) === String(ass.classId));
      return cls?.year === filterYear;
    }).sort((a, b) => {
      const tA = data.teachers.find(t => String(t.id) === String(a.teacherId));
      const tB = data.teachers.find(t => String(t.id) === String(b.teacherId));
      return (tA?.name || '').localeCompare(tB?.name || '');
    });
  }, [data.assignments, data.classes, data.teachers, filterYear]);

  // Handlers
  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setIsAdding(true);
    try {
      await addTeacher({ name: name.trim().toUpperCase(), email: email.toLowerCase() });
      alert("Professor cadastrado com sucesso!");
      setName('');
      setEmail('');
    } catch (err) {
      alert("Erro ao cadastrar professor.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher || selectedClasses.length === 0 || selectedSubjects.length === 0) return;

    setIsAssigning(true);
    let successCount = 0;
    let skipCount = 0;

    try {
      for (const classId of selectedClasses) {
        const cls = data.classes.find(c => String(c.id) === String(classId));
        if (!cls) continue;

        // Filtrar apenas disciplinas que REALMENTE pertencem a esta turma específica
        const validSubjectsInThisClass = selectedSubjects.filter(sid => cls.subjectIds?.includes(sid));

        for (const subjectId of validSubjectsInThisClass) {
          const alreadyAssigned = data.assignments.some(a =>
            String(a.teacherId) === String(selectedTeacher) &&
            String(a.classId) === String(classId) &&
            String(a.subjectId) === String(subjectId)
          );

          if (!alreadyAssigned) {
            await assignTeacher({
              teacherId: selectedTeacher,
              classId: classId,
              subjectId: subjectId
            });
            successCount++;
          } else {
            skipCount++;
          }
        }
      }

      setSelectedSubjects([]);
      setSelectedClasses([]);
      await refreshData();

      let msg = `${successCount} vínculos criados com sucesso!`;
      if (skipCount > 0) msg += ` (${skipCount} já existiam e foram ignorados).`;
      alert(msg);
    } catch (err) {
      console.error("Erro na atribuição:", err);
      alert("Erro ao atribuir vínculos. Algumas atribuições podem ter sido processadas.");
    } finally {
      setIsAssigning(false);
    }
  };

  const toggleClass = (id: string) => {
    setSelectedClasses(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleSubject = (id: string) => {
    setSelectedSubjects(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  if (loading) return <div className="p-20 text-center animate-pulse text-slate-400 font-black uppercase tracking-widest">Sincronizando Corpo Docente...</div>;

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">

      {/* HEADER E FILTRO GLOBAL */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#0A1128] tracking-tight">Docentes</h1>
          <p className="text-slate-500 font-medium">Gestão de professores e atribuição de carga horária.</p>
        </div>

        <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-sm">
          <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest mr-4">Ano Letivo</span>
          <select
            title="Ano Letivo"
            aria-label="Selecionar Ano Letivo"
            value={filterYear}
            onChange={e => {
              setFilterYear(e.target.value);
              setSelectedClasses([]);
              setSelectedSubjects([]);
            }}
            className="bg-transparent outline-none text-slate-800 font-black text-sm cursor-pointer"
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

        {/* CADASTRO E ATRIBUIÇÃO (COLUNA ESQUERDA) */}
        <div className="lg:col-span-4 space-y-10">

          {/* Form: Novo Professor */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Icon name="user" /></div>
              Novo Professor
            </h3>
            <form onSubmit={handleAddTeacher} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <input
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-indigo-200 transition-all font-bold text-slate-700 uppercase"
                  placeholder="DIGITE O NOME..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail Institucional</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"><Icon name="mail" className="w-4 h-4" /></div>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full p-4 pl-12 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-indigo-200 transition-all font-medium text-slate-700"
                    placeholder="email@escola.com"
                  />
                </div>
              </div>
              <button type="submit" disabled={isAdding} className="w-full bg-[#0A1128] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2">
                <Icon name="plus" /> {isAdding ? 'CADASTRANDO...' : 'Cadastrar Professor'}
              </button>
            </form>
          </div>

          {/* Form: Atribuição Múltipla */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Icon name="link" /></div>
              Atribuição em Lote ({filterYear})
            </h3>
            <form onSubmit={handleAssign} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Professor</label>
                <select
                  title="Selecionar Professor"
                  aria-label="Selecionar Professor para Atribuição"
                  required
                  value={selectedTeacher}
                  onChange={e => setSelectedTeacher(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none bg-white font-bold text-slate-700 focus:border-purple-200"
                >
                  <option value="">SELECIONE...</option>
                  {[...data.teachers].sort(sortTeachers).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Turmas Selecionadas</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSelectedClasses(classesDoAno.map(c => c.id))} className="text-[8px] font-black text-indigo-600 hover:underline uppercase">Todas</button>
                    <button type="button" onClick={() => setSelectedClasses([])} className="text-[8px] font-black text-slate-400 hover:underline uppercase">Limpar</button>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-40 overflow-y-auto space-y-2 custom-scrollbar">
                  {classesDoAno.map(cls => (
                    <label key={cls.id} className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-indigo-200 transition-all">
                      <input
                        type="checkbox"
                        checked={selectedClasses.includes(cls.id)}
                        onChange={() => toggleClass(cls.id)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] font-bold text-slate-700 uppercase truncate">{cls.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {selectedClasses.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disciplinas Disponíveis</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setSelectedSubjects(disciplinasDaCarga.map(s => s.id))} className="text-[8px] font-black text-indigo-600 hover:underline uppercase">Todas</button>
                      <button type="button" onClick={() => setSelectedSubjects([])} className="text-[8px] font-black text-slate-400 hover:underline uppercase">Limpar</button>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-48 overflow-y-auto space-y-2 custom-scrollbar">
                    {disciplinasDaCarga.length === 0 && <p className="text-[10px] text-slate-400 italic text-center py-4">Nenhuma disciplina nas turmas selecionadas.</p>}
                    {disciplinasDaCarga.map(sub => (
                      <label key={sub.id} className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-indigo-200 transition-all">
                        <input
                          type="checkbox"
                          checked={selectedSubjects.includes(sub.id)}
                          onChange={() => toggleSubject(sub.id)}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-[10px] font-bold text-slate-700 uppercase truncate">{sub.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button type="submit" disabled={selectedSubjects.length === 0 || isAssigning} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-30">
                {isAssigning ? 'ATRIBUINDO...' : `Atribuir ${selectedSubjects.length > 0 ? `(${selectedSubjects.length})` : ''} Vínculos`}
              </button>
            </form>
          </div>
        </div>

        {/* LISTAGEM (COLUNA DIREITA) */}
        <div className="lg:col-span-8 space-y-10">

          {/* Lista de Professores Cadastrados */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 flex items-center justify-between">
              Corpo Docente Ativo
              <span className="bg-slate-200 px-3 py-1 rounded-full text-slate-600">{data.teachers.length} Cadastrados</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...data.teachers].sort(sortTeachers).map(teacher => (
                <div key={teacher.id} className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-400 transition-colors">
                      <Icon name="user" className="w-6 h-6" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-black text-slate-800 text-xs uppercase truncate leading-tight">{teacher.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5 lowercase truncate">{teacher.email}</p>
                    </div>
                  </div>
                  <button
                    title="Excluir Professor"
                    aria-label={`Excluir professor ${teacher.name}`}
                    onClick={() => setDeleteConfirm({ id: teacher.id, type: 'teachers', label: teacher.name })}
                    className="w-10 h-10 flex items-center justify-center text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Icon name="trash" className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Lista de Aulas e Horários do Ano */}
          <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                <Icon name="book" className="text-indigo-600" />
                Vínculos em {filterYear}
              </h3>
              <div className="text-[10px] font-black text-slate-400 uppercase">
                Aulas Atribuídas: {atribuicoesDoAno.length}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                  <tr>
                    <th className="px-8 py-5">Professor</th>
                    <th className="px-8 py-5">Disciplina</th>
                    <th className="px-8 py-5">Turma</th>
                    <th className="px-8 py-5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {atribuicoesDoAno.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center opacity-30 text-slate-400 italic font-bold">
                        Nenhuma aula atribuída para o ano letivo de {filterYear}.
                      </td>
                    </tr>
                  )}
                  {atribuicoesDoAno.map(ass => {
                    const teacher = data.teachers.find(t => String(t.id) === String(ass.teacherId));
                    const subject = data.subjects.find(s => String(s.id) === String(ass.subjectId));
                    const cls = data.classes.find(c => String(c.id) === String(ass.classId));

                    return (
                      <tr key={ass.id} className="hover:bg-slate-50/30 group transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 font-black text-[10px]">T</div>
                            <span className="font-black text-slate-700 text-xs uppercase">{teacher?.name || '---'}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-xs font-bold text-slate-500 uppercase">{subject?.name || '---'}</span>
                        </td>
                        <td className="px-8 py-5">
                          <span className="px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl text-[10px] font-black uppercase shadow-sm">
                            {cls?.name || '---'}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <button
                            onClick={() => setDeleteConfirm({
                              id: ass.id,
                              type: 'assignments',
                              label: `aula de ${subject?.name} para ${teacher?.name}`
                            })}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="Remover Atribuição"
                          >
                            <Icon name="trash" className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[120] p-4 text-center">
          <div className="bg-white rounded-[40px] w-full max-sm shadow-2xl overflow-hidden p-12 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 text-4xl shadow-inner border border-red-100">
              <Icon name="trash" className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Confirmar Remoção?</h3>
            <p className="text-sm font-medium text-slate-500 mt-3 mb-10 leading-relaxed px-2">
              Deseja realmente remover <strong>{deleteConfirm.label}</strong>?<br />
              Esta ação removerá o registro permanentemente.
            </p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-200">Cancelar</button>
              <button
                onClick={async () => {
                  try {
                    await deleteItem(deleteConfirm.type, deleteConfirm.id);
                    setDeleteConfirm(null);
                  } catch (err) {
                    alert("Erro ao excluir registro. Ele pode estar sendo usado em outra parte do sistema.");
                  }
                }}
                className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-red-100 hover:bg-red-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Teachers;
