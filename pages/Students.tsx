
import React, { useState, useMemo, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { Student } from '../types';
import { can } from '../lib/permissions';
import { Pencil, Trash2 } from 'lucide-react';
import { sortClasses } from '../lib/sorting';

const Students: React.FC = () => {
  const { data, addStudent, updateStudent, deleteItem, currentUser } = useSchool();

  // UI States
  const [filterYear, setFilterYear] = useState('2026');
  const [filterClassId, setFilterClassId] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States (Contexto de criação)
  const [formYear, setFormYear] = useState('2026');
  const [name, setName] = useState('');
  const [batchNames, setBatchNames] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState<Student['status']>('Cursando');

  // Edit States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRA, setEditingRA] = useState('');

  // Confirmation States
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null);

  // Sincroniza o ano do formulário com o filtro da página ao abrir para novo cadastro
  useEffect(() => {
    if (isFormOpen && !editingId) {
      setFormYear(filterYear);
    }
  }, [isFormOpen, editingId, filterYear]);

  // Limpa a turma selecionada se o ano mudar no formulário
  useEffect(() => {
    if (!editingId) setClassId('');
  }, [formYear, editingId]);

  const filteredStudents = useMemo(() => {
    return data.students.filter(s => {
      const cls = data.classes.find(c => String(c.id) === String(s.classId));

      // Filtro de Ano (Obrigatório)
      if (cls?.year !== filterYear) return false;

      // Filtro de Turma
      if (filterClassId !== 'all' && String(s.classId) !== filterClassId) return false;

      // Filtro de Busca (Nome ou RA)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return s.name.toLowerCase().includes(term) || s.registrationNumber?.toLowerCase().includes(term);
      }

      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [data.students, data.classes, filterYear, filterClassId, searchTerm]);

  const handleExportCSV = () => {
    const headers = ['Matrícula', 'Nome do Protagonista', 'Turma', 'Situação'];
    const rows = filteredStudents.map(s => {
      const cls = data.classes.find(c => String(c.id) === String(s.classId));
      return [
        s.registrationNumber || '',
        s.name,
        cls?.name || 'Sem Turma',
        s.status || 'Cursando'
      ];
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\n');

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Protagonistas_${filterYear}.csv`;
    link.click();
  };

  const classesForForm = useMemo(() => {
    return data.classes
      .filter(c => c.year === formYear)
      .sort(sortClasses);
  }, [data.classes, formYear]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!classId) {
      alert('Por favor, selecione uma turma.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isBatchMode && !editingId) {
        const namesArray = batchNames.split('\n').map(n => n.trim()).filter(n => n !== '');
        if (namesArray.length === 0) {
          alert('Insira ao menos um nome.');
          setIsSubmitting(false);
          return;
        }
        for (const studentName of namesArray) {
          await addStudent({ name: studentName, classId, status });
        }
      } else {
        if (!name.trim()) {
          alert('Insira o nome do protagonista.');
          setIsSubmitting(false);
          return;
        }
        const payload = { name: name.trim(), classId, status };
        if (editingId) {
          await updateStudent(editingId, payload);
        } else {
          await addStudent(payload);
        }
      }
      resetForm();
      setIsFormOpen(false);
    } catch (error: any) {
      alert(`Erro ao salvar: ${error.message || 'Tente novamente.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setBatchNames('');
    setClassId('');
    setStatus('Cursando');
    setEditingId(null);
    setEditingRA('');
    setIsBatchMode(false);
  };

  const startEdit = (std: Student) => {
    const stdClass = data.classes.find(c => String(c.id) === String(std.classId));
    setEditingId(std.id);
    setName(std.name);
    setFormYear(stdClass?.year || filterYear);
    setClassId(String(std.classId));
    setStatus(std.status || 'Cursando');
    setEditingRA(std.registrationNumber);
    setIsBatchMode(false);
    setIsFormOpen(true);
  };

  const getStatusBadge = (status: Student['status']) => {
    const styles: Record<string, string> = {
      'Cursando': 'bg-emerald-50 text-emerald-700 border-emerald-100',
      'Transferência': 'bg-blue-50 text-blue-700 border-blue-100',
      'Evasão': 'bg-red-50 text-red-700 border-red-100',
      'Outro': 'bg-slate-50 text-slate-700 border-slate-100'
    };
    return (
      <span className={`px-3 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider ${styles[status] || styles['Outro']}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-[#0A1128] tracking-tight">Protagonistas</h1>
          <p className="text-slate-500 font-medium">Gestão centralizada de alunos por ano letivo.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative group">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <span className="text-slate-400">🔍</span>
              </div>
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou RA..."
                className="pl-10 pr-4 py-2 bg-transparent outline-none text-sm font-bold text-slate-700 w-48 focus:w-64 transition-all placeholder:text-slate-400"
              />
            </div>
            <div className="w-px h-6 bg-slate-200"></div>
            <select
              value={filterClassId}
              onChange={e => setFilterClassId(e.target.value)}
              className="bg-transparent outline-none text-xs font-black text-slate-600 uppercase tracking-wide cursor-pointer hover:text-indigo-600 transition-colors max-w-[120px]"
            >
              <option value="all">Todas as Turmas</option>
              {data.classes
                .filter(c => c.year === filterYear)
                .sort(sortClasses)
                .map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
            <div className="w-px h-6 bg-slate-200"></div>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="bg-transparent outline-none text-xs font-black text-slate-600 uppercase tracking-wide cursor-pointer hover:text-indigo-600 transition-colors pr-2">
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
          </div>

          <button
            onClick={handleExportCSV}
            className="bg-white border border-slate-200 text-slate-600 w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-slate-50 shadow-sm transition-all"
            title="Exportar CSV"
          >
            <span className="text-lg">📥</span>
          </button>
          {currentUser && can(currentUser.role, 'create', 'students') && (
            <button
              onClick={() => { resetForm(); setIsFormOpen(true); }}
              className="bg-[#0A1128] text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-xl hover:bg-slate-800 transition-all active:scale-95"
            >
              <span>+ Novo Cadastro</span>
            </button>
          )}
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  {editingId ? 'Editar Registro' : 'Cadastro de Protagonista'}
                </h3>
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mt-1">Configure o ano e a turma de destino</p>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-800 transition-all shadow-sm">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-10 space-y-8">
              {!editingId && (
                <div className="bg-indigo-50/50 border border-indigo-100 p-6 rounded-3xl flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 text-2xl">📥</div>
                    <div>
                      <p className="font-black text-slate-800 text-sm">Modo de Importação em Lote</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Criação múltipla de alunos</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={isBatchMode} onChange={e => setIsBatchMode(e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Ano Letivo *</label>
                  <select
                    required
                    value={formYear}
                    onChange={e => setFormYear(e.target.value)}
                    className="w-full p-4 border border-slate-200 rounded-2xl outline-none bg-slate-50 focus:bg-white transition-all font-black text-slate-700 shadow-inner"
                  >
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Turma de Destino *</label>
                  <select
                    required
                    value={classId}
                    onChange={e => setClassId(e.target.value)}
                    className="w-full p-4 border border-slate-200 rounded-2xl outline-none bg-slate-50 focus:bg-white transition-all font-bold text-slate-700 shadow-inner"
                  >
                    <option value="">Selecione...</option>
                    {classesForForm.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {isBatchMode && !editingId ? (
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nomes (um por linha) *</label>
                  <textarea
                    required
                    value={batchNames}
                    onChange={e => setBatchNames(e.target.value)}
                    placeholder="FULANO DE TAL&#10;BELTRANO SILVA..."
                    className="w-full h-40 p-5 border border-slate-200 rounded-[32px] outline-none bg-slate-50 focus:bg-white transition-all font-mono text-xs resize-none shadow-inner"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nome Completo *</label>
                  <input
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full p-4 border border-slate-200 rounded-2xl outline-none bg-slate-50 focus:bg-white transition-all font-bold text-slate-700 shadow-inner uppercase"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Situação Cadastral</label>
                  <select
                    required
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full p-4 border border-slate-200 rounded-2xl outline-none bg-slate-50 focus:bg-white transition-all font-bold text-slate-700 shadow-inner"
                  >
                    <option value="Cursando">Cursando</option>
                    <option value="Transferência">Transferência</option>
                    <option value="Evasão">Evasão</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">RA (Identificador)</label>
                  <input
                    disabled
                    value={editingId ? editingRA : "Será gerado pelo sistema"}
                    className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-100 text-slate-400 font-bold italic"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-6">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-8 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-12 py-4 bg-indigo-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Confirmar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#f8fbff] border-b border-slate-100 text-slate-500 uppercase text-[10px] font-black tracking-widest">
              <tr>
                <th className="px-10 py-6">Matrícula</th>
                <th className="px-10 py-6">Nome do Protagonista</th>
                <th className="px-10 py-6">Turma</th>
                <th className="px-10 py-6 text-center">Situação</th>
                <th className="px-10 py-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredStudents.map(std => {
                const cls = data.classes.find(c => String(c.id) === String(std.classId));
                return (
                  <tr key={std.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-10 py-5 font-mono text-[11px] font-bold text-slate-400 uppercase tracking-tighter">
                      <span className="bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/50">{std.registrationNumber}</span>
                    </td>
                    <td className="px-10 py-5">
                      <div className="font-black text-slate-800 text-sm uppercase tracking-tight">{std.name}</div>
                    </td>
                    <td className="px-10 py-5">
                      <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100 uppercase">
                        {cls?.name || 'S/ Turma'}
                      </span>
                    </td>
                    <td className="px-10 py-5 text-center">{getStatusBadge(std.status || 'Cursando')}</td>
                    <td className="px-10 py-5 text-right space-x-2">
                      {currentUser && can(currentUser.role, 'update', 'students') && (
                        <button
                          onClick={() => startEdit(std)}
                          className="p-3 text-indigo-500 hover:bg-indigo-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100 bg-white border border-slate-100 shadow-sm"
                          title="Editar"
                        >
                          <Pencil size={18} />
                        </button>
                      )}
                      {currentUser && can(currentUser.role, 'delete', 'students') && (
                        <button
                          onClick={() => setDeleteConfirm({ id: std.id, name: std.name })}
                          className="p-3 text-red-500 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100 bg-white border border-slate-100 shadow-sm"
                          title="Remover"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-10 py-32 text-center">
                    <div className="flex flex-col items-center opacity-30">
                      <div className="text-6xl mb-4">🎓</div>
                      <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-sm">Nenhum registro em {filterYear}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[110] p-4 text-center">
          <div className="bg-white rounded-[40px] w-full max-w-sm shadow-2xl overflow-hidden p-12 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 text-4xl shadow-inner border border-red-100">⚠️</div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Remover Protagonista?</h3>
            <p className="text-sm font-medium text-slate-500 mt-3 mb-10 leading-relaxed">
              Você está removendo <strong className="text-slate-800">{deleteConfirm.name}</strong>. Todas as notas vinculadas serão perdidas.
            </p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl text-[10px] uppercase tracking-widest">Cancelar</button>
              <button
                onClick={async () => {
                  await deleteItem('students', deleteConfirm.id);
                  setDeleteConfirm(null);
                }}
                className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-red-100"
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

export default Students;
