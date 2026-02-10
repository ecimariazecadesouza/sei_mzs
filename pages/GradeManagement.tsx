
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSchool } from '../context/SchoolContext';
import { Student, AcademicYearConfig } from '../types';
import { can } from '../lib/permissions';
import jsPDF from 'jspdf';
import { sortSubjects, sortClasses } from '../lib/sorting';

// Função para converter links do Google Drive em links diretos de imagem
const formatGoogleDriveLink = (url: string | null): string => {
  if (!url) return '';
  if (url.includes('drive.google.com')) {
    const idMatch = url.match(/\/d\/(.+?)\//) || url.match(/id=(.+?)(&|$)/);
    if (idMatch && idMatch[1]) {
      return `https://docs.google.com/uc?export=download&id=${idMatch[1]}`;
    }
  }
  return url;
};

// --- Tabela PROCV de Referência "Precisa" ---
const PRECIZA_TABLE: Record<string, string> = {
  "10.0": "8.8", "10.1": "8.7", "10.2": "8.7", "10.3": "8.6", "10.4": "8.6", "10.5": "8.6", "10.6": "8.5", "10.7": "8.5", "10.8": "8.5", "10.9": "8.4",
  "11.0": "8.4", "11.1": "8.3", "11.2": "8.3", "11.3": "8.3", "11.4": "8.2", "11.5": "8.2", "11.6": "8.2", "11.7": "8.1", "11.8": "8.1", "11.9": "8.0",
  "12.0": "8.0", "12.1": "8.0", "12.2": "7.9", "12.3": "7.9", "12.4": "7.9", "12.5": "7.8", "12.6": "7.8", "12.7": "7.7", "12.8": "7.7", "12.9": "7.7",
  "13.0": "7.6", "13.1": "7.6", "13.2": "7.6", "13.3": "7.5", "13.4": "7.5", "13.5": "7.4", "13.6": "7.4", "13.7": "7.4", "13.8": "7.3", "13.9": "7.3",
  "14.0": "7.3", "14.1": "7.2", "14.2": "7.2", "14.3": "7.1", "14.4": "7.1", "14.5": "7.1", "14.6": "7.0", "14.7": "7.0", "14.8": "7.0", "14.9": "6.9",
  "15.0": "6.9", "15.1": "6.8", "15.2": "6.8", "15.3": "6.8", "15.4": "6.7", "15.5": "6.7", "15.6": "6.7", "15.7": "6.6", "15.8": "6.6", "15.9": "6.5",
  "16.0": "6.5", "16.1": "6.5", "16.2": "6.4", "16.3": "6.4", "16.4": "6.4", "16.5": "6.3", "16.6": "6.3", "16.7": "6.2", "16.8": "6.2", "16.9": "6.2",
  "17.0": "6.1", "17.1": "6.1", "17.2": "6.1", "17.3": "6.0", "17.4": "6.0", "17.5": "6.0", "17.6": "5.9", "17.7": "5.9", "17.8": "5.8", "17.9": "5.8",
  "18.0": "5.8", "18.1": "5.7", "18.2": "5.7", "18.3": "5.6", "18.4": "5.6", "18.5": "5.6", "18.6": "5.5", "18.7": "5.5", "18.8": "5.5", "18.9": "5.4",
  "19.0": "5.4", "19.1": "5.3", "19.2": "5.3", "19.3": "5.3", "19.4": "5.2", "19.5": "5.2", "19.6": "5.2", "19.7": "5.1", "19.8": "5.1", "19.9": "5.0",
  "20.0": "5.0", "20.1": "5.0", "20.2": "4.9", "20.3": "4.9", "20.4": "4.9", "20.5": "4.8", "20.6": "4.8", "20.7": "4.7", "20.8": "4.7", "20.9": "4.7",
  "21.0": "4.6", "21.1": "4.6", "21.2": "4.6", "21.3": "4.5", "21.4": "4.5", "21.5": "4.4", "21.6": "4.4", "21.7": "4.4", "21.8": "4.3", "21.9": "4.3",
  "22.0": "4.3", "22.1": "4.2", "22.2": "4.2", "22.3": "4.1", "22.4": "4.1", "22.5": "4.1", "22.6": "4.0", "22.7": "4.0", "22.8": "4.0", "22.9": "3.9",
  "23.0": "3.9", "23.1": "3.9", "23.2": "3.8", "23.3": "3.8", "23.4": "3.7", "23.5": "3.7", "23.6": "3.7", "23.7": "3.6", "23.8": "3.6", "23.9": "3.5",
  "24.0": "3.5", "24.1": "3.5", "24.2": "3.4", "24.3": "3.4", "24.4": "3.4", "24.5": "3.3", "24.6": "3.3", "24.7": "3.2", "24.8": "3.2", "24.9": "3.2"
};

interface GradeRow {
  studentId: string;
  studentName: string;
  registrationNumber: string;
  studentStatus: string;
  b1: string; b2: string; b3: string; b4: string;
  recFinal: string;
  isDirty?: boolean;
}

const GradeInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  className?: string;
}> = ({ value, onChange, disabled, className }) => (
  <input
    type="text"
    value={value}
    disabled={disabled}
    onFocus={(e) => !disabled && e.target.select()}
    onChange={(e) => !disabled && onChange(e.target.value)}
    placeholder="-"
    className={`w-full h-full text-center bg-transparent outline-none transition-all font-bold text-slate-700 disabled:opacity-30 ${disabled ? 'cursor-not-allowed' : 'focus:bg-indigo-50/30'} ${className || ''}`}
  />
);

const formatGradeInput = (value: string): string => {
  if (!value) return '';
  let clean = value.replace(',', '.').replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  if (parts.length > 2) clean = parts[0] + '.' + parts.slice(1).join('');
  const num = parseFloat(clean);
  if (!isNaN(num)) {
    if (num > 10) return "10.0";
    return clean;
  }
  return clean;
};

const roundOne = (num: number) => Math.round(num * 10) / 10;

const calculateRowStats = (row: GradeRow, year: string, academicYears: AcademicYearConfig[]) => {
  const config = academicYears.find(y => y.year === year);
  const now = new Date();

  const v1 = parseFloat(row.b1);
  const v2 = parseFloat(row.b2);
  const v3 = parseFloat(row.b3);
  const v4 = parseFloat(row.b4);
  const rf = parseFloat(row.recFinal);
  const validBims = [v1, v2, v3, v4].filter(v => !isNaN(v));
  const points = validBims.reduce((a, b) => a + b, 0);
  const mg = points / 4;
  let precisa = "----";
  if (validBims.length > 0) {
    if (points < 10) precisa = "Inapto";
    else if (points < 24) {
      const key = points.toFixed(1);
      precisa = PRECIZA_TABLE[key] || "----";
    } else precisa = "----";
  }
  let mfValue: number;
  if (mg >= 6.0) mfValue = mg;
  else {
    const notaRec = isNaN(rf) ? 0 : rf;
    mfValue = (mg * 6 + notaRec * 4) / 10;
  }
  const mfString = roundOne(mfValue).toFixed(1);
  const mfNum = parseFloat(mfString);

  // Lógica de Situação Baseada em Prazos
  let situation = "Em curso";
  let sitColor = "bg-slate-100 text-slate-500 border-slate-200";

  const getDeadline = (dateStr: string | undefined) => dateStr ? new Date(dateStr + 'T23:59:59') : null;

  const b1Deadline = getDeadline(config?.b1End);
  const b2Deadline = getDeadline(config?.b2End);
  const b3Deadline = getDeadline(config?.b3End);
  const b4Deadline = getDeadline(config?.b4End);
  const recDeadline = getDeadline(config?.recEnd);

  // Verificação de Bimestres Individuais (Pendente se faltar nota após prazo)
  if (b1Deadline && now > b1Deadline && isNaN(v1)) situation = "Pendente";
  else if (b2Deadline && now > b2Deadline && isNaN(v2)) situation = "Pendente";
  else if (b3Deadline && now > b3Deadline && isNaN(v3)) situation = "Pendente";
  else if (b4Deadline && now > b4Deadline && isNaN(v4)) situation = "Pendente";

  if (situation === "Pendente") {
    sitColor = "bg-orange-50 text-orange-700 border-orange-100";
  } else if (validBims.length === 4) {
    if (mg < 6 && isNaN(rf)) {
      if (recDeadline && now > recDeadline) {
        situation = "Retido";
        sitColor = "bg-red-50 text-red-700 border-red-100";
      } else {
        situation = "Recuperação";
        sitColor = "bg-amber-50 text-amber-700 border-amber-100";
      }
    } else {
      if (mfNum >= 5.0) {
        situation = "Aprovar";
        sitColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
      } else {
        situation = "Retido";
        sitColor = "bg-red-50 text-red-700 border-red-100";
      }
    }
  } else if (b4Deadline && now > b4Deadline && validBims.length < 4) {
    // Se passou do 4º bimestre e ainda faltam notas
    situation = "Retido";
    sitColor = "bg-red-50 text-red-700 border-red-100";
  }

  let performance = "-";
  let perfColor = "text-slate-300";
  if (validBims.length > 0) {
    if (mfNum < 5) { performance = "Insuficiente"; perfColor = "text-red-500"; }
    else if (mfNum < 6) { performance = "Regular"; perfColor = "text-amber-600"; }
    else if (mfNum < 8) { performance = "Bom"; perfColor = "text-blue-500"; }
    else { performance = "Ótimo"; perfColor = "text-emerald-600"; }
  }
  return { points: points.toFixed(1), mg: mg.toFixed(1), precisa, mf: mfString, situation, sitColor, performance, perfColor };
};

const GradeManagement: React.FC = () => {
  const { data, bulkUpdateGrades, loading, refreshData, currentUser } = useSchool();
  const tableRef = useRef<HTMLDivElement>(null);

  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<Student['status'] | 'Todos'>('Cursando');
  const [isExporting, setIsExporting] = useState(false);

  const [gradeRows, setGradeRows] = useState<GradeRow[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchTargetConfig, setBatchTargetConfig] = useState({ b1: true, b2: false, b3: false, b4: false });
  const [batchText, setBatchText] = useState('');

  const selectedClass = data.classes.find(c => String(c.id) === String(selectedClassId));
  const selectedSubject = data.subjects.find(s => String(s.id) === String(selectedSubjectId));

  const schoolLogoFormatted = useMemo(() => formatGoogleDriveLink(data.settings.schoolLogo), [data.settings.schoolLogo]);

  useEffect(() => {
    setSelectedClassId('');
    setSelectedSubjectId('');
    setGradeRows([]);
    setHasUnsavedChanges(false);
    setSaveError(false);
  }, [selectedYear]);

  const filteredClasses = useMemo(() => {
    const classes = data.classes.filter(c => c.year === selectedYear);

    if (currentUser?.role === 'prof') {
      const teacher = data.teachers.find(t => t.email.toLowerCase() === currentUser.email.toLowerCase());
      if (!teacher) return [];

      const myClassIds = new Set(data.assignments
        .filter(a => String(a.teacherId) === String(teacher.id))
        .map(a => String(a.classId))
      );
      return classes.filter(c => myClassIds.has(String(c.id))).sort(sortClasses);
    }

    return classes.sort(sortClasses);
  }, [data.classes, data.assignments, data.teachers, selectedYear, currentUser]);

  const classSubjects = useMemo(() => {
    if (!selectedClass) return [];
    let subjects = data.subjects
      .filter(s => selectedClass.subjectIds?.includes(s.id));

    if (currentUser?.role === 'prof') {
      const teacher = data.teachers.find(t => t.email.toLowerCase() === currentUser.email.toLowerCase());
      if (!teacher) return [];

      const mySubjectIds = new Set(data.assignments
        .filter(a => String(a.teacherId) === String(teacher.id) && String(a.classId) === String(selectedClassId))
        .map(a => a.subjectId)
      );
      subjects = subjects.filter(s => mySubjectIds.has(s.id));
    }

    return subjects.sort(sortSubjects);
  }, [selectedClass, selectedClassId, data.subjects, data.assignments, data.teachers, currentUser]);

  useEffect(() => {
    if (selectedClassId && selectedSubjectId) {
      const studentsInClass = data.students.filter(s => String(s.classId) === String(selectedClassId)).sort((a, b) => a.name.localeCompare(b.name));
      const rows: GradeRow[] = studentsInClass.map(s => {
        const studentGrades = data.grades.filter(g => String(g.studentId) === String(s.id) && String(g.subjectId) === String(selectedSubjectId));
        const getVal = (t: number) => {
          const val = studentGrades.find(g => g.term === t)?.value;
          return val !== undefined && val !== null ? val.toString() : '';
        };
        return { studentId: s.id, studentName: s.name, registrationNumber: s.registrationNumber, studentStatus: s.status || 'Cursando', b1: getVal(1), b2: getVal(2), b3: getVal(3), b4: getVal(4), recFinal: getVal(5), isDirty: false };
      });
      setGradeRows(rows);
      setHasUnsavedChanges(false);
      setSaveError(false);
    }
  }, [selectedClassId, selectedSubjectId, data.students, data.grades]);

  const filteredGradeRows = useMemo(() => {
    if (selectedStatus === 'Todos') return gradeRows;
    return gradeRows.filter(r => r.studentStatus === selectedStatus);
  }, [gradeRows, selectedStatus]);

  const handleFieldChange = useCallback((studentId: string, field: string, value: string) => {
    const cleanValue = formatGradeInput(value);
    setGradeRows(prev => {
      const idx = prev.findIndex(r => r.studentId === studentId);
      if (idx === -1) return prev;
      const newRows = [...prev];
      newRows[idx] = { ...newRows[idx], [field]: cleanValue, isDirty: true };
      return newRows;
    });
    setHasUnsavedChanges(true);
    setSaveError(false);
  }, []);

  const handleSave = async () => {
    if (!selectedSubjectId) return;
    setSaveError(false);
    try {
      const updates: any[] = [];
      for (const row of gradeRows) {
        if (!row.isDirty) continue;
        const bims = [row.b1, row.b2, row.b3, row.b4, row.recFinal];
        bims.forEach((val, i) => {
          const numericValue = val === '' ? null : parseFloat(val);
          updates.push({ studentId: row.studentId, subjectId: selectedSubjectId, term: i + 1, value: numericValue });
        });
      }
      if (updates.length === 0) return;
      await bulkUpdateGrades(updates);
      await refreshData();
      setHasUnsavedChanges(false);
      alert("Diário atualizado com sucesso.");
    } catch (e) {
      console.error(e);
      setSaveError(true);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedSubjectId || !tableRef.current) return;
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 300));

    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
        compress: true
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margins = 20;

      await doc.html(tableRef.current, {
        callback: (pdf) => {
          pdf.save(`Diario_${selectedClass?.name}_${selectedSubject?.name}.pdf`);
          setIsExporting(false);
        },
        x: margins,
        y: margins,
        html2canvas: {
          scale: 0.52, // Ajustado para não cortar colunas em A4 Paisagem
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          onclone: (clonedDoc) => {
            // Estilos forçados para renderização do PDF
            const rows = clonedDoc.querySelectorAll('tr');
            rows.forEach((row: any) => {
              row.style.pageBreakInside = 'avoid';
              row.style.breakInside = 'avoid';
            });

            const stickyElements = clonedDoc.querySelectorAll('.sticky');
            stickyElements.forEach((el: any) => {
              el.style.position = 'static';
              el.style.boxShadow = 'none';
              el.style.backgroundColor = '#ffffff';
            });

            // Garante que o container tenha largura suficiente para não sobrepor texto
            const container = clonedDoc.querySelector('.pdf-container');
            if (container) {
              (container as HTMLElement).style.width = '1500px';
              (container as HTMLElement).style.minWidth = '1500px';
            }
          }
        },
        width: pageWidth - (margins * 2),
        windowWidth: 1500, // Largura virtual ampliada para evitar "aperto" das colunas
        autoPaging: 'text',
        margin: [margins, margins, margins, margins]
      });
    } catch (error) {
      console.error("Erro na exportação:", error);
      alert("Erro ao gerar PDF.");
      setIsExporting(false);
    }
  };

  const processBatchImport = () => {
    if (!batchText.trim()) return;
    const lines = batchText.split('\n');
    const newRows = [...gradeRows];
    let matchedCount = 0;
    lines.forEach(line => {
      const columns = line.split('\t');
      if (columns.length < 2) return;
      const rawName = columns[0].trim().toUpperCase();
      const rowIdx = newRows.findIndex(r => r.studentName.trim().toUpperCase() === rawName);
      if (rowIdx !== -1) {
        matchedCount++;
        let colIdx = 1;
        const updatedRow = { ...newRows[rowIdx], isDirty: true };
        if (batchTargetConfig.b1 && columns[colIdx] !== undefined) { updatedRow.b1 = formatGradeInput(columns[colIdx]); colIdx++; }
        if (batchTargetConfig.b2 && columns[colIdx] !== undefined) { updatedRow.b2 = formatGradeInput(columns[colIdx]); colIdx++; }
        if (batchTargetConfig.b3 && columns[colIdx] !== undefined) { updatedRow.b3 = formatGradeInput(columns[colIdx]); colIdx++; }
        if (batchTargetConfig.b4 && columns[colIdx] !== undefined) { updatedRow.b4 = formatGradeInput(columns[colIdx]); colIdx++; }
        newRows[rowIdx] = updatedRow;
      }
    });
    setGradeRows(newRows);
    setHasUnsavedChanges(true);
    setIsBatchMode(false);
    setBatchText('');
    alert(`Processamento concluído. ${matchedCount} protagonistas atualizados.`);
  };

  return (
    <div className="space-y-6 pb-20 max-w-[1600px] mx-auto font-sans animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        {!isBatchMode ? (
          <>
            <div>
              <h1 className="text-3xl font-black text-[#0A1128] tracking-tight">Lançar Notas</h1>
              <p className="text-slate-500 font-medium tracking-tight">Registro oficial institucional com exportação aprimorada.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportPDF}
                disabled={!selectedSubjectId || isExporting}
                className="bg-white border border-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-30 shadow-sm flex items-center gap-2"
              >
                {isExporting ? 'PREPARANDO PDF...' : 'Exportar Diário (PDF)'}
              </button>
              {currentUser && can(currentUser.role, 'update', 'grades') && (
                <button
                  onClick={() => setIsBatchMode(true)}
                  disabled={!selectedSubjectId}
                  className="bg-indigo-50 text-indigo-600 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all disabled:opacity-30"
                >
                  Importação em Lote
                </button>
              )}
              {currentUser && can(currentUser.role, 'update', 'grades') && (
                <button
                  onClick={handleSave}
                  disabled={!hasUnsavedChanges || loading}
                  className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg ${hasUnsavedChanges ? 'bg-emerald-600 text-white shadow-emerald-100 active:scale-95 hover:bg-emerald-700' : 'bg-slate-100 text-slate-400 shadow-none'}`}
                >
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-xl font-black text-[#0A1128] tracking-tight flex items-center gap-3">
                <span className="w-2 h-6 bg-indigo-600 rounded-full"></span>
                Importar Dados em Lote
              </h1>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">{selectedClass?.name} • {selectedSubject?.name}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsBatchMode(false)} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest">Cancelar</button>
              <button onClick={processBatchImport} className="px-8 py-2.5 bg-[#0A1128] text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all">Processar e Aplicar</button>
            </div>
          </>
        )}
      </div>

      {!isBatchMode ? (
        <>
          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-6 items-end no-print">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ano Letivo</label>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:bg-white transition-all outline-none">
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Turma</label>
              <select value={selectedClassId} onChange={e => { setSelectedClassId(e.target.value); setSelectedSubjectId(''); }} className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:bg-white transition-all outline-none">
                <option value="">Selecione...</option>
                {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Disciplina</label>
              <select value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)} disabled={!selectedClassId} className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 disabled:opacity-50 transition-all outline-none">
                <option value="">Selecione...</option>
                {classSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtro de Status</label>
              <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value as any)} className="w-full h-12 px-4 bg-white border border-indigo-100 text-indigo-700 rounded-xl text-sm font-black focus:ring-2 focus:ring-indigo-500 transition-all outline-none shadow-sm">
                <option value="Cursando">Cursando</option>
                <option value="Transferência">Transferidos</option>
                <option value="Evasão">Evasão</option>
                <option value="Todos">Exibir Todos</option>
              </select>
            </div>
          </div>

          {selectedClassId && selectedSubjectId ? (
            <div ref={tableRef} className="bg-white rounded-[40px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-500 min-w-[1200px] pdf-container">

              {/* Cabeçalho Institucional - Otimizado para PDF */}
              <div className="p-12 border-b border-slate-100 flex justify-between items-center bg-white">
                <div className="flex items-center gap-10">
                  {schoolLogoFormatted && (
                    <img src={schoolLogoFormatted} alt="Logo Escola" className="h-24 w-24 object-contain shadow-sm rounded-xl p-1 border border-slate-50" />
                  )}
                  <div>
                    <h2 className="text-4xl font-black text-[#0A1128] uppercase tracking-tight">Diário Acadêmico Oficial</h2>
                    <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.4em] mt-3 leading-relaxed">
                      Turma: <span className="text-indigo-600">{selectedClass?.name}</span> • Componente: <span className="text-indigo-600">{selectedSubject?.name}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-7xl font-black text-slate-100 leading-none">{selectedYear}</p>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-2">Ano Letivo</p>
                </div>
              </div>

              <div className="px-12 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center no-print">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Total Listados: {filteredGradeRows.length} Protagonistas</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-[#f8fbff] text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-200">
                      <th className="px-12 py-8 text-left bg-white sticky left-0 z-30 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] w-[380px]">Protagonista</th>
                      {['1º Bim', '2º Bim', '3º Bim', '4º Bim'].map(h => <th key={h} className="w-28 border-l border-slate-100 py-4">{h}</th>)}
                      <th className="w-24 bg-slate-50/50 py-4 border-l border-slate-100">Pts</th>
                      <th className="w-24 bg-slate-50/50 py-4 border-l border-slate-100">MG</th>
                      <th className="w-32 bg-amber-50/50 py-4 border-l border-slate-100 text-amber-700 font-black">Precisa</th>
                      <th className="w-32 bg-amber-50 py-4 border-l border-slate-100 text-amber-900 font-black">RF</th>
                      <th className="w-32 bg-indigo-50 py-4 border-l border-slate-100 text-indigo-700 font-black">MF</th>
                      <th className="w-40 py-4 border-l border-slate-100">Situação</th>
                      <th className="px-12 py-4 border-l border-slate-100">Desempenho</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredGradeRows.map((row) => {
                      const stats = calculateRowStats(row, selectedYear, data.academicYears);
                      return (
                        <tr key={row.studentId} className="group hover:bg-slate-50 transition-colors">
                          {/* Protagonista com espaçamento generoso para evitar sobreposição no PDF */}
                          <td className="px-12 py-8 text-left bg-white group-hover:bg-slate-50 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-100">
                            <div className="font-black text-slate-800 text-[13px] uppercase leading-snug tracking-tight mb-3 min-h-[1.4rem]">{row.studentName}</div>
                            <div className="text-[11px] text-slate-400 font-bold tracking-[0.2em] flex items-center gap-2">
                              <span className="opacity-50 uppercase text-[9px]">RA:</span>
                              <span className="font-mono text-slate-500">{row.registrationNumber}</span>
                            </div>
                          </td>
                          <td className="h-20 border-r border-slate-50"><GradeInput value={row.b1} disabled={!currentUser || !can(currentUser.role, 'update', 'grades')} onChange={(v: string) => handleFieldChange(row.studentId, 'b1', v)} /></td>
                          <td className="h-20 border-r border-slate-50"><GradeInput value={row.b2} disabled={!currentUser || !can(currentUser.role, 'update', 'grades')} onChange={(v: string) => handleFieldChange(row.studentId, 'b2', v)} /></td>
                          <td className="h-20 border-r border-slate-50"><GradeInput value={row.b3} disabled={!currentUser || !can(currentUser.role, 'update', 'grades')} onChange={(v: string) => handleFieldChange(row.studentId, 'b3', v)} /></td>
                          <td className="h-20 border-r border-slate-50"><GradeInput value={row.b4} disabled={!currentUser || !can(currentUser.role, 'update', 'grades')} onChange={(v: string) => handleFieldChange(row.studentId, 'b4', v)} /></td>
                          <td className="h-20 bg-slate-50/30 font-black text-slate-700 text-[15px] border-r border-slate-100">{stats.points}</td>
                          <td className="h-20 bg-slate-50/30 font-black text-slate-700 text-[15px] border-r border-slate-100">{stats.mg}</td>
                          <td className="h-20 bg-amber-50/10 font-black text-amber-600 text-[11px] border-r border-slate-100">{stats.precisa}</td>
                          <td className="h-20 bg-amber-50/20 border-r border-slate-100">
                            <GradeInput value={row.recFinal} disabled={!currentUser || !can(currentUser.role, 'update', 'grades') || stats.precisa === '----' || stats.precisa === 'Inapto'} onChange={(v: string) => handleFieldChange(row.studentId, 'recFinal', v)} className="text-amber-900 font-black" />
                          </td>
                          <td className="h-20 bg-indigo-50/40 font-black text-indigo-700 text-[15px] border-r border-slate-100">{stats.mf}</td>
                          <td className="px-8 py-5 border-r border-slate-100">
                            <div className={`px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-wider border text-center shadow-sm ${stats.sitColor}`}>
                              {stats.situation}
                            </div>
                          </td>
                          <td className={`px-12 py-5 text-[12px] font-black uppercase text-center ${stats.perfColor}`}>
                            {stats.performance}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Rodapé institucional para o PDF */}
              <div className="p-10 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center no-print">
                <div className="flex items-center gap-5">
                  <div className="w-10 h-10 bg-[#0A1128] rounded-xl flex items-center justify-center text-white text-[12px] font-black">SEI</div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Sistema Escolar Integrado • Versão Institucional 3.5.2</p>
                </div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Emitido em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-48 bg-white rounded-[40px] border-2 border-dashed border-slate-200 text-center opacity-40">
              <div className="text-7xl mb-8">📂</div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Seleção de Parâmetros</h3>
              <p className="text-base font-medium text-slate-400 mt-3">Escolha Ano, Turma e Disciplina para visualizar o diário acadêmico.</p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white p-12 rounded-[40px] shadow-2xl border border-slate-100 space-y-10 animate-in zoom-in-95 duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4 space-y-8">
              <div className="bg-indigo-50/50 p-8 rounded-[32px] border border-indigo-100 shadow-inner">
                <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-6">1. Colunas de Destino</h4>
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(num => (
                    <button key={num} onClick={() => setBatchTargetConfig(prev => ({ ...prev, [`b${num}`]: !prev[`b${num}` as keyof typeof prev] }))} className={`flex items-center justify-between px-5 py-4 rounded-2xl border-2 transition-all font-black text-[12px] uppercase ${batchTargetConfig[`b${num}` as keyof typeof batchTargetConfig] ? 'bg-white border-indigo-600 text-indigo-600 shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}>
                      <span>{num}º Bim</span>
                      <div className={`w-3.5 h-3.5 rounded-full ${batchTargetConfig[`b${num}` as keyof typeof batchTargetConfig] ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="lg:col-span-8 flex flex-col space-y-5">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] px-3">2. Dados Externos (Copiados da Planilha)</h4>
              <textarea value={batchText} onChange={e => setBatchText(e.target.value)} placeholder="COLE AQUI: NOME COMPLETO [TAB] NOTA..." className="flex-1 w-full h-[450px] p-8 bg-slate-50 border-2 border-slate-100 rounded-[40px] font-mono text-[11px] outline-none focus:bg-white focus:border-indigo-100 transition-all shadow-inner resize-none custom-scrollbar" />
            </div>
          </div>
        </div>
      )}
      {hasUnsavedChanges && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 duration-300 z-[100] border-4 border-white/20 backdrop-blur-sm ${saveError ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
          <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
          <div>
            <p className="font-black text-xs uppercase tracking-widest">{saveError ? 'Erro ao Salvar' : 'Alterações Pendentes'}</p>
            <p className="text-[10px] font-bold opacity-90">{saveError ? 'Verifique sua conexão e tente novamente.' : 'Não esqueça de salvar o diário.'}</p>
          </div>
          <button onClick={handleSave} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-colors ${saveError ? 'bg-white text-red-600 hover:bg-red-50' : 'bg-white text-amber-600 hover:bg-amber-50'}`}>
            {loading ? 'Salvando...' : (saveError ? 'Tentar Novamente' : 'Salvar Agora')}
          </button>
        </div>
      )}
    </div>
  );
};

export default GradeManagement;
