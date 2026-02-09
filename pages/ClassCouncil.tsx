
import React, { useState, useMemo, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { Subject, Student, Grade, Class } from '../types';
import { can } from '../lib/permissions';
import jsPDF from 'jspdf';
import { sortSubjects, sortClasses } from '../lib/sorting';

// --- Interfaces para cálculos ---
interface SubjectResult {
  mg: number;
  mf: number;
  status: 'Aprovado' | 'Retido' | 'Em Curso';
  isRecovered: boolean;
}

interface StudentCouncilRow {
  student: Student;
  results: Record<string, SubjectResult>;
  mediasAcima5: number;
  mediasAbaixo5: number;
  resultadoGeral: 'Aprovado' | 'Reprovado' | 'Pendente';
  disciplinasRetidas: string[];
}

// --- Icons Component ---
const Icon = ({ name, className = "w-4 h-4" }: { name: string, className?: string }) => {
  const icons: Record<string, React.ReactNode> = {
    clipboard: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 00(2) 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
    filter: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />,
    download: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
    save: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />,
    chevronLeft: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />,
    chevronRight: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />,
    chevronDown: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />,
    expand: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />,
    csv: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  };
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {icons[name] || null}
    </svg>
  );
};

const ClassCouncil: React.FC = () => {
  const { data, loading, currentUser } = useSchool();

  // Filtros
  const [filters, setFilters] = useState({
    year: '2026',
    turmaId: '',
    status: 'Cursando',
    type: 'all',
    areaId: 'all',
    subAreaIds: [] as string[],
    minHigh: '',
    minLow: '',
    referenceTerm: '4' // 1, 2, 3, ou 4 (Padrão 4 para cálculo anual completo)
  });

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Estado local para deliberações
  const [deliberations, setDeliberations] = useState<Record<string, { conselho: string, resultado: string }>>({});

  // Limpar turma ao trocar o ano letivo
  useEffect(() => {
    setFilters(prev => ({ ...prev, turmaId: '' }));
  }, [filters.year]);

  const turmaAtual = useMemo(() =>
    data.classes.find(c => String(c.id) === String(filters.turmaId))
    , [data.classes, filters.turmaId]);

  const classesDoAno = useMemo(() =>
    data.classes.filter(c => c.year === filters.year).sort(sortClasses)
    , [data.classes, filters.year]);

  const filteredKnowledgeAreas = useMemo(() => {
    if (filters.type === 'all') return data.knowledgeAreas;
    return data.knowledgeAreas.filter(a => a.formationTypeId === filters.type);
  }, [data.knowledgeAreas, filters.type]);

  const filteredSubAreas = useMemo(() => {
    if (filters.areaId === 'all') {
      const areaIds = new Set(filteredKnowledgeAreas.map(a => a.id));
      return data.subAreas.filter(s => areaIds.has(s.knowledgeAreaId));
    }
    return data.subAreas.filter(s => s.knowledgeAreaId === filters.areaId);
  }, [data.subAreas, filteredKnowledgeAreas, filters.areaId]);

  const disciplinasTurma = useMemo(() => {
    if (!turmaAtual) return [];
    const ids = (turmaAtual.subjectIds || []).map(id => String(id));
    let subjects = data.subjects.filter(s => ids.includes(String(s.id)));

    if (filters.type !== 'all') {
      subjects = subjects.filter(s => {
        const subArea = data.subAreas.find(sa => String(sa.id) === String(s.subAreaId));
        if (!subArea) return false;
        const area = data.knowledgeAreas.find(a => String(a.id) === String(subArea.knowledgeAreaId));
        return area?.formationTypeId === filters.type;
      });
    }

    if (filters.areaId !== 'all') {
      subjects = subjects.filter(s => {
        const subArea = data.subAreas.find(sa => String(sa.id) === String(s.subAreaId));
        return subArea?.knowledgeAreaId === filters.areaId;
      });
    }

    if (filters.subAreaIds.length > 0) {
      subjects = subjects.filter(s => filters.subAreaIds.includes(String(s.subAreaId)));
    }

    return subjects.sort(sortSubjects);
  }, [turmaAtual, data.subjects, data.subAreas, data.knowledgeAreas, filters.type, filters.areaId, filters.subAreaIds]);

  const rows = useMemo(() => {
    if (!filters.turmaId) return [];

    const alunos = data.students.filter(s => {
      const matchesClass = String(s.classId) === String(filters.turmaId);
      const studentStatus = s.status || 'Cursando';
      const matchesStatus = filters.status === 'all' || studentStatus === filters.status;
      return matchesClass && matchesStatus;
    });

    const termLimit = parseInt(filters.referenceTerm); // 1, 2, 3 ou 4

    return alunos.map(student => {
      const results: Record<string, SubjectResult> = {};
      let mediasAcima5 = 0;
      let mediasAbaixo5 = 0;
      let temPendente = false;
      let reprovadoTotal = false;
      const retidas: string[] = [];

      const config = data.academicYears.find(y => y.year === filters.year);
      const now = new Date();
      const getDeadline = (dateStr: string | undefined) => dateStr ? new Date(dateStr + 'T23:59:59') : null;

      const deadlines = [
        getDeadline(config?.b1End),
        getDeadline(config?.b2End),
        getDeadline(config?.b3End),
        getDeadline(config?.b4End)
      ];
      const recDeadline = getDeadline(config?.recEnd);

      disciplinasTurma.forEach(sub => {
        const grades = data.grades.filter(g =>
          String(g.studentId) === String(student.id) &&
          String(g.subjectId) === String(sub.id)
        );

        let sumPoints = 0;
        let missingGradeInPeriod = false;
        let missingGradeAfterDeadline = false;

        for (let t = 1; t <= termLimit; t++) {
          const g = grades.find(x => x.term === t);
          if (g && g.value !== null) {
            sumPoints += g.value;
          } else {
            missingGradeInPeriod = true;
            const d = deadlines[t - 1];
            if (d && now > d) {
              missingGradeAfterDeadline = true;
            }
          }
        }

        const mg = sumPoints / termLimit;
        let mf = mg;
        let isRecovered = false;

        if (termLimit === 4) {
          const rf = grades.find(g => g.term === 5)?.value;
          if (mg < 6) {
            if (rf != null) {
              mf = (mg * 6 + rf * 4) / 10;
              isRecovered = true;
            } else if (recDeadline && now > recDeadline) {
              // Se passou o prazo da rec e não tem nota, mf continua mg
            }
          }
        }

        // Status "Em Curso" ou "Retido" ou "Aprovado"
        // Se falta nota após o prazo, consideramos como Pendente/Retido
        const isCompleteInPeriod = !missingGradeInPeriod;
        let status: 'Aprovado' | 'Retido' | 'Em Curso' = mf >= 6 ? 'Aprovado' : (isCompleteInPeriod ? 'Retido' : 'Em Curso');

        // Se passar do prazo do 4º bimestre e faltar nota, é retido automaticamente
        if (termLimit === 4 && deadlines[3] && now > deadlines[3] && !isCompleteInPeriod) {
          status = 'Retido';
        }

        if (mf >= 5) {
          mediasAcima5++;
        } else {
          // Se estamos no Final (4) ou se faltou nota após prazo
          if (termLimit === 4 || missingGradeAfterDeadline) {
            mediasAbaixo5++;
            reprovadoTotal = true;
            retidas.push(sub.name);
          }
        }

        if (missingGradeAfterDeadline) {
          temPendente = true;
          retidas.push(`${sub.name} (P)`);
        }

        results[String(sub.id)] = { mg, mf, status, isRecovered };
      });

      const resGeral: 'Aprovado' | 'Reprovado' | 'Pendente' = temPendente ? 'Pendente' : (reprovadoTotal ? 'Reprovado' : 'Aprovado');

      return {
        student,
        results,
        mediasAcima5,
        mediasAbaixo5,
        resultadoGeral: resGeral,
        disciplinasRetidas: retidas
      } as StudentCouncilRow;
    })
      .filter(row => {
        const minH = parseInt(filters.minHigh);
        const minL = parseInt(filters.minLow);
        if (!isNaN(minH) && row.mediasAcima5 < minH) return false;
        if (!isNaN(minL) && row.mediasAbaixo5 < minL) return false;
        return true;
      }).sort((a, b) => a.student.name.localeCompare(b.student.name));
  }, [filters, data.students, data.grades, disciplinasTurma]);

  const totalPages = Math.ceil(rows.length / ITEMS_PER_PAGE);
  const paginatedRows = rows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => setCurrentPage(1), [filters]);

  // --- Função Exportar CSV (Excel) ---
  const handleExportCSV = () => {
    if (!turmaAtual) return;

    const headers = [
      "Nome do Protagonista",
      "RA",
      "Status",
      "Médias >= 5",
      "Médias < 5",
      "Resultado Sistema",
      "Deliberação Conselho",
      "Resultado Final",
      "Disciplinas Retidas / Pendentes"
    ];

    const csvData = rows.map(row => {
      const studentId = String(row.student.id);
      const decisaoConselho = deliberations[studentId]?.conselho || '-';
      const resFinal = deliberations[studentId]?.resultado || row.resultadoGeral;
      const retencoes = row.disciplinasRetidas.length > 0 ? row.disciplinasRetidas.join(', ') : '-';

      return [
        `"${row.student.name}"`, // Aspas para proteger nomes com vírgula
        row.student.registrationNumber,
        row.student.status || 'Cursando',
        row.mediasAcima5,
        row.mediasAbaixo5,
        row.resultadoGeral,
        decisaoConselho,
        resFinal,
        `"${retencoes}"` // Aspas para proteger a lista de disciplinas
      ].join(';'); // Usando ponto e vírgula como separador (padrão Excel BR)
    });

    const csvContent = "\uFEFF" + [headers.join(';'), ...csvData].join('\n'); // \uFEFF para UTF-8 BOM
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Conselho_${turmaAtual.name}_Bimestre${filters.referenceTerm}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Função NATIVA de Geração de PDF (Com quebra de linha) ---
  const handleExportPDF = () => {
    if (!turmaAtual) return;

    // Configuração Inicial
    const doc = new jsPDF('l', 'mm', 'a4'); // Paisagem
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const termLabel = filters.referenceTerm === '4' ? 'Final' : `${filters.referenceTerm}º Bimestre`;

    // Títulos e Cabeçalho
    const drawHeader = (pageNumber: number) => {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(0, 0, pageWidth, 25, 'F');

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`Conselho de Classe - ${termLabel} (Resumo)`, margin, 12);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Turma: ${turmaAtual.name} | Ano: ${filters.year} | Ref: ${termLabel}`, margin, 18);

      doc.text(`Pág ${pageNumber}`, pageWidth - margin - 10, 18);
    };

    // Definição Fixa das Colunas (Layout Resumido)
    const cols = [
      { header: "PROTAGONISTA", width: 90, align: 'left' as 'left' },
      { header: "Mds >= 5", width: 20, align: 'center' as 'center' },
      { header: "Mds < 5", width: 20, align: 'center' as 'center' },
      { header: "RESULTADO GERAL", width: 35, align: 'center' as 'center' },
      { header: "CONSELHO", width: 30, align: 'center' as 'center' },
      { header: "RESULTADO FINAL", width: 35, align: 'center' as 'center' },
      { header: "RETENÇÕES / PENDENTES", width: 47, align: 'left' as 'left' }
    ];

    let currentY = 35;
    let pageCount = 1;

    drawHeader(pageCount);

    // Cabeçalho da Tabela
    const drawTableHead = () => {
      const headerHeight = 10;
      doc.setFillColor(224, 231, 255); // Indigo-100
      doc.rect(margin, currentY, pageWidth - (margin * 2), headerHeight, 'F');

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(55, 65, 81);

      let currentX = margin;

      cols.forEach(col => {
        if (col.align === 'center') {
          doc.text(col.header, currentX + (col.width / 2), currentY + 6, { align: 'center' });
        } else {
          doc.text(col.header, currentX + 2, currentY + 6);
        }
        currentX += col.width;
      });

      currentY += headerHeight;
    };

    drawTableHead();

    rows.forEach((row, index) => {
      // Cálculo de altura dinâmica para o campo de Retenções
      const retencoesText = row.disciplinasRetidas.length > 0 ? row.disciplinasRetidas.join(', ') : '-';
      // Usa splitTextToSize para quebrar o texto na largura da coluna
      const retencoesLines = doc.splitTextToSize(retencoesText, cols[6].width - 4);

      // A altura da linha será baseada no número de linhas de texto (mínimo 1 linha)
      // 5mm por linha de texto + 4mm de padding
      const lineCount = Math.max(1, retencoesLines.length);
      const rowHeight = (lineCount * 4) + 6;

      // Verificar quebra de página
      if (currentY + rowHeight > pageHeight - margin) {
        doc.addPage();
        pageCount++;
        currentY = 35; // Reset Y
        drawHeader(pageCount);
        drawTableHead();
      }

      // Zebra striping
      if (index % 2 !== 0) {
        doc.setFillColor(249, 250, 251); // slate-50
        doc.rect(margin, currentY, pageWidth - (margin * 2), rowHeight, 'F');
      }

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);

      let currentX = margin;
      const textY = currentY + 5; // Posição Y do texto base

      // 1. Protagonista
      const studentName = row.student.name.length > 45 ? row.student.name.substring(0, 42) + '...' : row.student.name;
      doc.text(studentName.toUpperCase(), currentX + 2, textY);
      currentX += cols[0].width;

      // 2. Mds >= 5
      doc.setTextColor(16, 185, 129); // Emerald
      doc.text(String(row.mediasAcima5), currentX + (cols[1].width / 2), textY, { align: 'center' });
      currentX += cols[1].width;

      // 3. Mds < 5
      doc.setTextColor(239, 68, 68); // Red
      doc.text(String(row.mediasAbaixo5), currentX + (cols[2].width / 2), textY, { align: 'center' });
      currentX += cols[2].width;

      // 4. Resultado Geral (Sistema)
      const resGeral = row.resultadoGeral.toUpperCase();
      if (resGeral === 'APROVADO') doc.setTextColor(16, 185, 129);
      else if (resGeral === 'REPROVADO') doc.setTextColor(220, 38, 38);
      else doc.setTextColor(217, 119, 6); // Amber
      doc.text(resGeral, currentX + (cols[3].width / 2), textY, { align: 'center' });
      currentX += cols[3].width;

      // Dados de Deliberação
      const studentId = String(row.student.id);
      const decisaoConselho = deliberations[studentId]?.conselho || '-';
      const resFinal = deliberations[studentId]?.resultado || row.resultadoGeral;

      // 5. Conselho
      doc.setTextColor(30, 41, 59);
      doc.text(decisaoConselho.toUpperCase(), currentX + (cols[4].width / 2), textY, { align: 'center' });
      currentX += cols[4].width;

      // 6. Resultado Final (Deliberado)
      const resFinalText = resFinal.toUpperCase();
      if (resFinalText === 'APROVADO') doc.setTextColor(16, 185, 129);
      else if (resFinalText === 'REPROVADO') doc.setTextColor(220, 38, 38);
      else doc.setTextColor(217, 119, 6); // Amber
      doc.text(resFinalText, currentX + (cols[5].width / 2), textY, { align: 'center' });
      currentX += cols[5].width;

      // 7. Retenções (Com quebra de linha)
      doc.setTextColor(100, 116, 139);
      doc.text(retencoesLines, currentX + 2, textY); // jsPDF renderiza array de strings como linhas múltiplas

      currentY += rowHeight;
    });

    // Rodapé
    doc.setFontSize(6);
    doc.setTextColor(156, 163, 175);
    doc.text(`SEI - Sistema Escolar Integrado - Documento Oficial`, margin, pageHeight - 5);

    doc.save(`Conselho_${termLabel}_${turmaAtual.name.replace(/\s+/g, '_')}.pdf`);
  };

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-bold">Processando dados acadêmicos...</p>
      </div>
    );
  }

  const thStyle = "sticky top-0 z-40 px-1 py-4 text-[10px] uppercase tracking-widest font-black border-b border-r border-slate-200 bg-slate-50 text-slate-500 shadow-[inset_0_-2px_0_rgba(0,0,0,0.05)]";

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <Icon name="clipboard" className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Conselho de Classe</h1>
            <p className="text-slate-500 font-medium">Análise de rendimento e deliberações de encerramento.</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleExportCSV} disabled={!filters.turmaId} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition-all shadow-sm">
            <Icon name="csv" /> Exportar CSV
          </button>
          <button onClick={handleExportPDF} disabled={!filters.turmaId} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-50 transition-all shadow-sm">
            <Icon name="download" /> PDF Nativo
          </button>
          {currentUser && can(currentUser.role, 'update', 'council') && (
            <button onClick={() => alert("Alterações salvas com sucesso.")} disabled={Object.keys(deliberations).length === 0} className="flex items-center gap-2 px-8 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 shadow-lg shadow-emerald-100 disabled:opacity-50 transition-all uppercase tracking-widest">
              <Icon name="save" /> Salvar
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ano Letivo</label>
              <select
                title="Ano Letivo"
                aria-label="Selecionar Ano Letivo"
                value={filters.year}
                onChange={e => setFilters({ ...filters, year: e.target.value })}
                className="w-full h-11 px-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none"
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Turma *</label>
              <select
                title="Turma"
                aria-label="Selecionar Turma"
                value={filters.turmaId}
                onChange={e => setFilters({ ...filters, turmaId: e.target.value })}
                className="w-full h-11 px-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none"
              >
                <option value="">Selecione...</option>
                {classesDoAno.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1">Bimestre de Referência</label>
            <select
              title="Bimestre de Referência"
              aria-label="Selecionar Bimestre de Referência"
              value={filters.referenceTerm}
              onChange={e => setFilters({ ...filters, referenceTerm: e.target.value })}
              className="w-full h-11 px-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-black text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="1">1º Bimestre (Parcial)</option>
              <option value="2">2º Bimestre (Parcial)</option>
              <option value="3">3º Bimestre (Parcial)</option>
              <option value="4">4º Bimestre (Final)</option>
            </select>
            <p className="text-[9px] text-slate-400 leading-tight ml-1">Simula o encerramento do ano letivo considerando apenas até o bimestre selecionado.</p>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Status Protagonista</label>
            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              {['Cursando', 'Todos'].map(opt => (
                <button key={opt} onClick={() => setFilters({ ...filters, status: opt === 'Todos' ? 'all' : opt })} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${((opt === 'Todos' && filters.status === 'all') || filters.status === opt) ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Icon name="filter" className="text-indigo-500 w-5 h-5" />
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight">Filtros Avançados</h3>
            </div>
            <button onClick={() => setIsCollapsed(!isCollapsed)} className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase transition-all ${isCollapsed ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-400'}`}>
              <Icon name="expand" /> {isCollapsed ? "Expandir" : "Recolher"} Notas
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Formação</span>
              <select
                title="Formação"
                aria-label="Selecionar Formação"
                value={filters.type}
                onChange={e => setFilters({ ...filters, type: e.target.value, areaId: 'all', subAreaIds: [] })}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:bg-white transition-all text-slate-700"
              >
                <option value="all">Todas as formações</option>
                {data.formations.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Área de Conhecimento</span>
              <select
                title="Área de Conhecimento"
                aria-label="Selecionar Área de Conhecimento"
                value={filters.areaId}
                onChange={e => setFilters({ ...filters, areaId: e.target.value, subAreaIds: [] })}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:bg-white transition-all text-slate-700"
              >
                <option value="all">Todas as áreas</option>
                {filteredKnowledgeAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Subáreas (Múltipla)</span>
              <div className="relative group/multiselect">
                <div className="min-h-[46px] p-2 bg-slate-50 border border-slate-100 rounded-2xl flex flex-wrap gap-2 transition-all focus-within:bg-white focus-within:border-indigo-200">
                  {filters.subAreaIds.length === 0 ? (
                    <span className="text-xs font-bold text-slate-400 py-1.5 ml-2">Todas as subáreas</span>
                  ) : (
                    filters.subAreaIds.map(id => {
                      const sa = data.subAreas.find(s => s.id === id);
                      return (
                        <span key={id} className="bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl flex items-center gap-2 animate-in zoom-in-95">
                          {sa?.name}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilters({ ...filters, subAreaIds: filters.subAreaIds.filter(x => x !== id) });
                            }}
                            className="hover:text-red-500 transition-colors"
                          >✕</button>
                        </span>
                      );
                    })
                  )}
                  <div className="ml-auto flex items-center pr-2 pointer-events-none">
                    <Icon name="chevronDown" className="w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-[60] max-h-60 overflow-y-auto hidden group-hover/multiselect:block hover:block custom-scrollbar p-2">
                  <div
                    onClick={() => setFilters({ ...filters, subAreaIds: [] })}
                    className="p-3 text-xs font-black uppercase tracking-tight text-slate-500 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors flex justify-between items-center"
                  >
                    <span>Limpar Seleção</span>
                    {filters.subAreaIds.length === 0 && <span className="text-indigo-600">✓</span>}
                  </div>
                  <div className="h-px bg-slate-50 my-2" />
                  {filteredSubAreas.map(sa => {
                    const isSelected = filters.subAreaIds.includes(String(sa.id));
                    return (
                      <div
                        key={sa.id}
                        onClick={() => {
                          const newIds = isSelected
                            ? filters.subAreaIds.filter(x => x !== String(sa.id))
                            : [...filters.subAreaIds, String(sa.id)];
                          setFilters({ ...filters, subAreaIds: newIds });
                        }}
                        className={`p-3 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-between ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span className="uppercase">{sa.name}</span>
                        {isSelected && <span className="font-black">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mínimo Médias ≥ 5</span>
              <input type="number" value={filters.minHigh} onChange={e => setFilters({ ...filters, minHigh: e.target.value })} placeholder="Qtd..." className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:bg-white transition-all" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mínimo Médias &lt; 5</span>
              <input type="number" value={filters.minLow} onChange={e => setFilters({ ...filters, minLow: e.target.value })} placeholder="Qtd..." className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:bg-white transition-all" />
            </div>
          </div>
        </div>
      </div>

      {
        filters.turmaId ? (
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl flex flex-col">
            <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center no-print">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Protagonistas Selecionados: <span className="text-indigo-600">{rows.length}</span>
              </div>
              <div className="flex gap-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Aprovado</span>
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-400"></span> Retido</span>
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span> Em Curso</span>
              </div>
            </div>

            <div className="overflow-auto max-h-[calc(100vh-320px)] custom-scrollbar" id="council-table">
              <table className="w-full text-center border-collapse">
                <thead className="relative">
                  <tr>
                    <th rowSpan={isCollapsed ? 1 : 2} className="sticky left-0 top-0 z-50 bg-white border-r border-b border-slate-200 px-8 py-5 text-left min-w-[280px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                      <span className="text-[11px] uppercase tracking-widest font-black text-slate-800">Protagonista</span>
                    </th>
                    {!isCollapsed && disciplinasTurma.map(sub => (
                      <th key={sub.id} colSpan={2} className={`${thStyle} min-w-[120px]`}>{sub.name}</th>
                    ))}
                    <th rowSpan={isCollapsed ? 1 : 2} className={`${thStyle} bg-emerald-50 text-emerald-800`}>Mds ≥ 5</th>
                    <th rowSpan={isCollapsed ? 1 : 2} className={`${thStyle} bg-red-50 text-red-800`}>Mds &lt; 5</th>
                    <th rowSpan={isCollapsed ? 1 : 2} className={`${thStyle} min-w-[140px]`}>Resultado Geral</th>
                    <th rowSpan={isCollapsed ? 1 : 2} className={`${thStyle} bg-indigo-50 text-indigo-800 min-w-[120px]`}>Conselho</th>
                    <th rowSpan={isCollapsed ? 1 : 2} className={`${thStyle} bg-blue-50 text-blue-800 min-w-[140px]`}>Resultado Final</th>
                    <th rowSpan={isCollapsed ? 1 : 2} className={`${thStyle} bg-purple-50 text-purple-800 min-w-[200px]`}>Retenções / Pendentes</th>
                  </tr>
                  {!isCollapsed && (
                    <tr>
                      {disciplinasTurma.map(sub => (
                        <React.Fragment key={`sub-h-${sub.id}`}>
                          <th className="sticky top-[45px] z-40 py-2 border-r border-slate-100 text-[8px] font-black text-slate-400 bg-slate-50 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">MF</th>
                          <th className="sticky top-[45px] z-40 py-2 border-r border-slate-200 text-[8px] font-black text-slate-400 bg-slate-50 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">ST</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRows.map((item, idx) => {
                    const studentId = String(item.student.id);
                    const decisaoAtual = deliberations[studentId]?.conselho || '-';
                    const resFinalAtual = deliberations[studentId]?.resultado || item.resultadoGeral;

                    return (
                      <tr key={studentId} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'} group hover:bg-indigo-50/10 transition-colors`}>
                        <td className={`sticky left-0 z-10 border-r border-slate-100 px-8 py-5 text-left transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#fbfcff]'} group-hover:bg-indigo-50/30 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]`}>
                          <div className="font-black text-slate-800 text-xs uppercase truncate leading-tight">{item.student.name}</div>
                          <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">RA: {item.student.registrationNumber}</div>
                        </td>
                        {!isCollapsed && disciplinasTurma.map(sub => {
                          const res = item.results[String(sub.id)];
                          if (!res) return (
                            <React.Fragment key={`${studentId}-${sub.id}`}>
                              <td className="p-2 border-r border-slate-50 text-slate-300">-</td>
                              <td className="p-2 border-r border-slate-100 text-slate-300">-</td>
                            </React.Fragment>
                          );
                          return (
                            <React.Fragment key={`${studentId}-${sub.id}`}>
                              <td className={`p-2 border-r border-slate-50 font-black text-[11px] ${res.mf < 6 ? 'text-red-500' : 'text-slate-600'}`}>
                                {res.mf != null ? res.mf.toFixed(1) : '-'}{res.isRecovered && <span className="text-amber-500 ml-0.5">*</span>}
                              </td>
                              <td className="p-2 border-r border-slate-100">
                                <div className={`w-2.5 h-2.5 rounded-full mx-auto shadow-sm ${res.status === 'Aprovado' ? 'bg-emerald-400' : res.status === 'Retido' ? 'bg-red-400' : 'bg-blue-400'}`} />
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td className="bg-emerald-50/10 font-black text-emerald-600 text-base border-r border-slate-50">{item.mediasAcima5}</td>
                        <td className="bg-red-50/10 font-black text-red-500 text-base border-r border-slate-100">{item.mediasAbaixo5}</td>
                        <td className="px-4 py-5">
                          <span className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border shadow-sm ${item.resultadoGeral === 'Aprovado' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            item.resultadoGeral === 'Reprovado' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>{item.resultadoGeral}</span>
                        </td>
                        <td className="bg-indigo-50/20 p-3">
                          <select
                            className="w-full bg-white border border-purple-200 text-purple-700 text-[10px] font-black uppercase rounded-xl p-2 outline-none focus:ring-2 focus:ring-purple-300 shadow-sm disabled:opacity-50"
                            value={decisaoAtual}
                            disabled={!currentUser || !can(currentUser.role, 'update', 'council')}
                            onChange={e => setDeliberations(prev => ({ ...prev, [studentId]: { conselho: e.target.value, resultado: prev[studentId]?.resultado || item.resultadoGeral } }))}
                          >
                            <option value="-">-</option>
                            <option value="Sim">Sim</option>
                          </select>
                        </td>
                        <td className="bg-blue-50/20 p-3 border-l border-indigo-100">
                          {decisaoAtual === 'Sim' ? (
                            <select
                              className="w-full bg-white border border-indigo-300 text-indigo-700 text-[10px] font-black uppercase rounded-xl p-2 outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm disabled:opacity-50"
                              value={resFinalAtual}
                              disabled={!currentUser || !can(currentUser.role, 'update', 'council')}
                              onChange={e => setDeliberations(prev => ({ ...prev, [studentId]: { conselho: prev[studentId]?.conselho || 'Sim', resultado: e.target.value } }))}
                            >
                              <option value="Aprovado">Aprovado</option>
                              <option value="Reprovado">Reprovado</option>
                              <option value="Pendente">Pendente</option>
                            </select>
                          ) : (
                            <span className={`text-[10px] font-black uppercase tracking-widest ${resFinalAtual === 'Aprovado' ? 'text-emerald-600' : resFinalAtual === 'Reprovado' ? 'text-red-500' : 'text-amber-600'}`}>
                              {resFinalAtual}
                            </span>
                          )}
                        </td>
                        <td className="bg-purple-50/20 px-4 py-5 border-l border-slate-100 text-left">
                          <div className="text-[10px] font-bold text-slate-500 leading-snug">
                            {item.disciplinasRetidas.length > 0
                              ? item.disciplinasRetidas.join(', ')
                              : <span className="text-emerald-500 italic font-black uppercase tracking-widest">Nenhuma</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-40 bg-white rounded-[40px] border-2 border-dashed border-slate-200 text-center animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6 border border-slate-100">
              <Icon name="clipboard" className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Seleção de Parâmetros</h3>
            <p className="text-sm text-slate-400 font-medium max-w-sm mx-auto mt-2">Escolha o Ano Letivo e a turma para deliberar o conselho.</p>
          </div>
        )
      }
    </div >
  );
};

export default ClassCouncil;
