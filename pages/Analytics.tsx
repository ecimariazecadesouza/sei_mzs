
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSchool } from '../context/SchoolContext';
import { Download } from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler, ChartDataLabels
);

const StatCard: React.FC<{ title: string; value: string | number; icon: string; color: string; bgColor: string }> = ({ title, value, icon, color, bgColor }) => (
  <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex items-center space-x-6 transition-all hover:shadow-md hover:-translate-y-1 group cursor-default">
    <div className={`w-16 h-16 rounded-2xl ${bgColor} flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform duration-300`}>
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-2">{title}</p>
      <p className={`text-4xl font-black ${color} tracking-tighter leading-none`}>{value}</p>
    </div>
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-64 w-full text-slate-300">
    <span className="text-4xl mb-2">∅</span>
    <p className="text-xs font-bold uppercase tracking-widest">{message}</p>
  </div>
);

// Helpers para conversão segura de ID
const safeId = (id: any) => String(id || '');

const Analytics: React.FC = () => {
  const { data, loading } = useSchool();

  const [filters, setFilters] = useState({
    year: '2026',
    status: 'Cursando',
    term: 'all',
    referenceTerm: '4',
    classId: 'all',
    formationId: 'all',
    areaId: 'all',
    subAreaId: 'all',
    subjectId: 'all'
  });

  // Refs para download dos gráficos
  const evolutionRef = useRef<any>(null);
  const areaRef = useRef<any>(null);
  const subAreaRef = useRef<any>(null);
  const subRef = useRef<any>(null);
  const statusRef = useRef<any>(null);

  const downloadChart = (ref: any, fileName: string) => {
    if (ref.current) {
      const url = ref.current.toBase64Image();
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = url;
      link.click();
    }
  };

  // Resets de cascata
  useEffect(() => { setFilters(f => ({ ...f, areaId: 'all', subAreaId: 'all', subjectId: 'all' })); }, [filters.formationId]);
  useEffect(() => { setFilters(f => ({ ...f, subAreaId: 'all', subjectId: 'all' })); }, [filters.areaId]);
  useEffect(() => { setFilters(f => ({ ...f, subjectId: 'all' })); }, [filters.subAreaId]);

  // --- LÓGICA DE FILTRAGEM DE OPÇÕES ---
  const filteredAreas = useMemo(() => {
    return data.knowledgeAreas.filter(a =>
      filters.formationId === 'all' || safeId(a.formationTypeId) === filters.formationId
    );
  }, [data.knowledgeAreas, filters.formationId]);

  const filteredSubAreas = useMemo(() => {
    return data.subAreas.filter(sa => {
      if (filters.areaId !== 'all') {
        return safeId(sa.knowledgeAreaId) === filters.areaId;
      }
      if (filters.formationId !== 'all') {
        const area = data.knowledgeAreas.find(a => safeId(a.id) === safeId(sa.knowledgeAreaId));
        return area && safeId(area.formationTypeId) === filters.formationId;
      }
      return true;
    });
  }, [data.subAreas, data.knowledgeAreas, filters.areaId, filters.formationId]);

  const filteredSubjects = useMemo(() => {
    return data.subjects.filter(s => {
      // 1. Filtro de Ano (Obrigatório)
      if (safeId(s.year) !== filters.year) return false;

      // Se não há filtro hierárquico específico, mostra tudo do ano
      if (filters.formationId === 'all' && filters.areaId === 'all' && filters.subAreaId === 'all') return true;

      // 2. Filtro por Subárea
      if (filters.subAreaId !== 'all') {
        return safeId(s.subAreaId) === filters.subAreaId;
      }

      // 3. Filtro por Área ou Formação
      // Recupera a subárea da disciplina (se existir)
      const subArea = data.subAreas.find(sa => safeId(sa.id) === safeId(s.subAreaId));

      // Se a disciplina não tem subárea mas estamos filtrando por hierarquia, ela deve ser excluída? 
      // Ou incluída como "Sem Subárea"? Para garantir visibilidade, se o filtro é 'all', permitimos.
      // Mas se o filtro de Área/Formação está ativo, precisamos verificar.

      if (!subArea) return false; // Se não tem subárea, não pertence a nenhuma área/formação

      if (filters.areaId !== 'all') {
        return safeId(subArea.knowledgeAreaId) === filters.areaId;
      }

      if (filters.formationId !== 'all') {
        const area = data.knowledgeAreas.find(a => safeId(a.id) === safeId(subArea.knowledgeAreaId));
        return area && safeId(area.formationTypeId) === filters.formationId;
      }

      return true;
    }).sort((a, b) => {
      // Ordenação Global: Anuais Primeiro, depois Semestrais (A-Z dentro de cada grupo)
      if (a.periodicity === b.periodicity) return a.name.localeCompare(b.name);
      return a.periodicity === 'Anual' ? -1 : 1;
    });
  }, [data.subjects, data.subAreas, data.knowledgeAreas, filters.subAreaId, filters.areaId, filters.formationId, filters.year]);

  // --- ENGINE DE CÁLCULO ---
  const reportData = useMemo(() => {
    // 1. Universo de Disciplinas
    const targetSubjects = filteredSubjects.filter(s => {
      if (filters.subjectId !== 'all') return safeId(s.id) === filters.subjectId;
      return true;
    });
    const targetSubjectIds = new Set(targetSubjects.map(s => safeId(s.id)));

    // 2. Filtro Turmas e Alunos
    const activeClasses = data.classes.filter(c =>
      safeId(c.year) === filters.year &&
      (filters.classId === 'all' || safeId(c.id) === filters.classId)
    );
    const activeClassIds = new Set(activeClasses.map(c => safeId(c.id)));

    const activeStudents = data.students.filter(s =>
      activeClassIds.has(safeId(s.classId)) &&
      (filters.status === 'all' || (s.status || 'Cursando') === filters.status)
    );
    const activeStudentIds = new Set(activeStudents.map(s => safeId(s.id)));

    // 3. Mapa de Notas
    const gradeMap: Record<string, Record<string, Record<number, number>>> = {};
    data.grades.forEach(g => {
      const sId = safeId(g.studentId);
      const subId = safeId(g.subjectId);
      if (activeStudentIds.has(sId) && targetSubjectIds.has(subId)) {
        if (!gradeMap[sId]) gradeMap[sId] = {};
        if (!gradeMap[sId][subId]) gradeMap[sId][subId] = {};
        gradeMap[sId][subId][g.term] = g.value;
      }
    });

    // 4. Agregação
    const areaResults: Record<string, { sum: number, count: number, name: string }> = {};
    const subAreaResults: Record<string, { sum: number, count: number, name: string }> = {};
    const subjectAverages: Record<string, { sum: number, count: number }> = {};

    const performance = activeStudents.map(std => {
      let stdSum = 0;
      let stdCount = 0;

      targetSubjectIds.forEach((subId: string) => {
        const grades = gradeMap[safeId(std.id)]?.[subId];
        if (grades) {
          let val = 0;
          let hasVal = false;

          if (filters.term === 'all') {
            const limit = parseInt(filters.referenceTerm);
            let sum = 0;
            for (let t = 1; t <= limit; t++) sum += (grades[t] || 0);
            const mg = sum / limit;

            if (limit === 4 && mg < 6 && grades[5] !== undefined) {
              val = (mg * 6 + grades[5] * 4) / 10;
            } else {
              val = mg;
            }
            hasVal = true;
          } else {
            const term = parseInt(filters.term);
            if (grades[term] !== undefined) {
              val = grades[term];
              hasVal = true;
            }
          }

          if (hasVal) {
            stdSum += val;
            stdCount++;

            // Por Disciplina
            if (!subjectAverages[subId]) subjectAverages[subId] = { sum: 0, count: 0 };
            subjectAverages[subId].sum += val;
            subjectAverages[subId].count++;

            // Por Hierarquia (com Fallback)
            const sub = targetSubjects.find(s => safeId(s.id) === subId);
            if (sub) {
              const sa = data.subAreas.find(x => safeId(x.id) === safeId(sub.subAreaId));
              const a = sa ? data.knowledgeAreas.find(x => safeId(x.id) === safeId(sa.knowledgeAreaId)) : null;

              // Área
              const aKey = a ? safeId(a.id) : 'unknown';
              const aName = a ? a.name : 'Não Classificado';
              if (!areaResults[aKey]) areaResults[aKey] = { sum: 0, count: 0, name: aName };
              areaResults[aKey].sum += val;
              areaResults[aKey].count++;

              // Subárea
              const saKey = sa ? safeId(sa.id) : 'unknown';
              const saName = sa ? sa.name : 'Geral';
              if (!subAreaResults[saKey]) subAreaResults[saKey] = { sum: 0, count: 0, name: saName };
              subAreaResults[saKey].sum += val;
              subAreaResults[saKey].count++;
            }
          }
        }
      });
      return { avg: stdCount > 0 ? stdSum / stdCount : 0, hasGrades: stdCount > 0 };
    });

    const validResults = performance.filter(p => p.hasGrades);
    const globalAvg = validResults.length > 0 ? validResults.reduce((a, b) => a + b.avg, 0) / validResults.length : 0;
    const passRate = validResults.length > 0 ? (validResults.filter(p => p.avg >= 6).length / validResults.length) * 100 : 0;

    // Formatação
    const subStats = Object.entries(subjectAverages).map(([id, stats]) => {
      const sub = data.subjects.find(s => safeId(s.id) === id);
      return { name: sub?.name || '?', avg: stats.sum / stats.count };
    }).sort((a, b) => b.avg - a.avg).slice(0, 15);

    const areaStats = Object.values(areaResults).map(stats => ({
      name: stats.name, avg: stats.sum / stats.count
    })).sort((a, b) => b.avg - a.avg);

    const subAreaStats = Object.values(subAreaResults).map(stats => ({
      name: stats.name, avg: stats.sum / stats.count
    })).sort((a, b) => b.avg - a.avg).slice(0, 15);

    // Evolução por Turma
    const classEvolution = activeClasses.map(cls => {
      const studentsInCls = activeStudents.filter(s => safeId(s.classId) === safeId(cls.id));
      let hasDataInClass = false;

      const termsAvg = [1, 2, 3, 4].map(t => {
        let tSum = 0, tCount = 0;
        studentsInCls.forEach(std => {
          targetSubjectIds.forEach(subId => {
            const val = gradeMap[safeId(std.id)]?.[subId]?.[t];
            if (val !== undefined && val >= 0) {
              tSum += val;
              tCount++;
              hasDataInClass = true;
            }
          });
        });
        return tCount > 0 ? tSum / tCount : null;
      });

      return { name: cls.name, data: termsAvg, hasData: hasDataInClass };
    })
      .filter(c => c.hasData)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    return { globalAvg, passRate, studentCount: validResults.length, classEvolution, subStats, areaStats, subAreaStats };
  }, [data, filters, filteredSubjects]);

  const barOptions = (showLabels = true) => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: {
        display: showLabels,
        anchor: 'end', align: 'top', offset: 4,
        color: '#64748b', font: { weight: 'bold', size: 10 },
        formatter: (v: number) => v.toFixed(1)
      }
    },
    scales: {
      y: { suggestedMax: 10, grid: { display: false }, ticks: { font: { weight: 'bold' } } },
      x: { grid: { display: false }, ticks: { font: { weight: 'bold', size: 9 }, autoSkip: false, maxRotation: 45, minRotation: 0 } }
    }
  });

  const lineData = {
    labels: ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre'],
    datasets: reportData.classEvolution.map((cls, idx) => ({
      label: cls.name,
      data: cls.data,
      borderColor: `hsl(${(idx * 137) % 360}, 70%, 50%)`,
      backgroundColor: `transparent`,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
      spanGaps: true
    }))
  };

  if (loading) return <div className="p-20 text-center font-black text-slate-400 animate-pulse uppercase tracking-[0.2em]">Sincronizando Base de Dados...</div>;

  return (
    <div className="space-y-10 pb-20 max-w-[1500px] mx-auto animate-in fade-in duration-700 font-sans">

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#0A1128] tracking-tight">Análise de Dados</h1>
          <p className="text-slate-500 font-medium">Extração de inteligência e rendimento acadêmico institucional.</p>
        </div>

        <div className="bg-white p-3 rounded-3xl lg:rounded-full border border-slate-100 shadow-sm flex flex-wrap gap-2 items-center">
          <div className="flex bg-slate-100 p-1 rounded-full mr-2">
            {['2025', '2026'].map(y => (
              <button key={y} onClick={() => setFilters({ ...filters, year: y })} className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${filters.year === y ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>{y}</button>
            ))}
          </div>

          {[
            { key: 'status', options: ['Cursando', 'Transferência', 'Evasão', 'Todos'], label: 'Status' },
            { key: 'term', options: [{ v: 'all', l: 'Média Acumulada' }, { v: '1', l: '1º Bim' }, { v: '2', l: '2º Bim' }, { v: '3', l: '3º Bim' }, { v: '4', l: '4º Bim' }], label: 'Visualização' },
            { key: 'referenceTerm', options: [{ v: '1', l: 'Até 1º Bim' }, { v: '2', l: 'Até 2º Bim' }, { v: '3', l: 'Até 3º Bim' }, { v: '4', l: 'Ano Completo' }], label: 'Ref. Cálculo' },
            { key: 'classId', options: [{ v: 'all', l: 'Todas Turmas' }, ...data.classes.filter(c => safeId(c.year) === filters.year).map(c => ({ v: c.id, l: c.name }))], label: 'Turma' },
            { key: 'formationId', options: [{ v: 'all', l: 'Todas Formações' }, ...data.formations.map(f => ({ v: f.id, l: f.name }))], label: 'Formação' },
            { key: 'areaId', options: [{ v: 'all', l: 'Todas Áreas' }, ...filteredAreas.map(a => ({ v: a.id, l: a.name }))], label: 'Área' },
            { key: 'subAreaId', options: [{ v: 'all', l: 'Todas Subáreas' }, ...filteredSubAreas.map(sa => ({ v: sa.id, l: sa.name }))], label: 'Subárea' },
            { key: 'subjectId', options: [{ v: 'all', l: 'Todas Disciplinas' }, ...filteredSubjects.map(s => ({ v: s.id, l: s.name }))], label: 'Disciplina' }
          ].map((f: any) => {
            const isDisabled = f.key === 'referenceTerm' && filters.term !== 'all';
            return (
              <div key={f.key} className="relative group">
                <select
                  value={(filters as any)[f.key]}
                  disabled={isDisabled}
                  onChange={e => setFilters({ ...filters, [f.key]: e.target.value })}
                  className={`appearance-none bg-white border border-slate-200 rounded-full pl-4 pr-8 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 outline-none hover:border-indigo-400 focus:border-indigo-600 transition-colors cursor-pointer ${isDisabled ? 'opacity-40 cursor-not-allowed bg-slate-50' : ''}`}
                  title={f.label}
                >
                  {f.options.map((opt: any) => (
                    <option key={opt.v || opt} value={opt.v || opt}>{opt.l || opt}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg width="8" height="6" fill="currentColor" viewBox="0 0 8 6"><path d="M4 6L0 0h8L4 6z" /></svg>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatCard title="Alunos Analisados" value={reportData.studentCount} icon="👥" color="text-indigo-600" bgColor="bg-indigo-50" />
        <StatCard title="Média Geral Filtrada" value={reportData.globalAvg.toFixed(1)} icon="📈" color="text-emerald-600" bgColor="bg-emerald-50" />
        <StatCard title="Taxa de Aprovação" value={`${Math.round(reportData.passRate)}%`} icon="✅" color="text-blue-600" bgColor="bg-blue-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        <div className="lg:col-span-12 bg-white p-8 md:p-12 rounded-[48px] border border-slate-100 shadow-sm min-h-[450px]">
          <div className="flex justify-between items-start mb-8">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-3">
              <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
              Evolução das Médias (Filtro Atual)
            </h3>
            <button onClick={() => downloadChart(evolutionRef, 'Evolucao_Medias')} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors" title="Baixar Gráfico">
              <Download size={18} />
            </button>
          </div>
          <div className="h-96 w-full">
            {reportData.classEvolution.length > 0 ? (
              <Line
                ref={evolutionRef}
                data={lineData}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  interaction: { mode: 'index', intersect: false },
                  plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 8, usePointStyle: true, font: { weight: 'bold', size: 10 } } },
                    datalabels: { display: false },
                    tooltip: {
                      backgroundColor: '#1e293b',
                      titleFont: { size: 13 },
                      bodyFont: { size: 12 },
                      padding: 10,
                      cornerRadius: 8,
                      callbacks: { label: (c: any) => `${c.dataset.label}: ${c.raw?.toFixed(1) || '-'}` }
                    }
                  },
                  scales: { y: { suggestedMax: 10, min: 0, ticks: { font: { weight: 'bold' } } }, x: { ticks: { font: { weight: 'bold' } } } }
                } as any}
              />
            ) : <EmptyState message="Nenhuma turma corresponde aos filtros" />}
          </div>
        </div>

        <div className="lg:col-span-6 bg-white p-8 md:p-12 rounded-[48px] border border-slate-100 shadow-sm min-h-[450px]">
          <div className="flex justify-between items-start mb-8">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-3">
              <div className="w-1.5 h-6 bg-purple-600 rounded-full"></div>
              Performance por Área
            </h3>
            <button onClick={() => downloadChart(areaRef, 'Performance_Area')} className="p-2 text-slate-300 hover:text-purple-600 transition-colors" title="Baixar Gráfico">
              <Download size={18} />
            </button>
          </div>
          <div className="h-80 w-full">
            {reportData.areaStats.length > 0 ? (
              <Bar
                data={{
                  labels: reportData.areaStats.map(s => s.name),
                  datasets: [{
                    data: reportData.areaStats.map(s => s.avg),
                    backgroundColor: reportData.areaStats.map((s, i) => `hsla(${(i * 50) % 360}, 70%, 50%, 0.7)`),
                    borderRadius: 8, barThickness: 40
                  }]
                }}
                options={barOptions() as any}
              />
            ) : <EmptyState message="Sem dados de área" />}
          </div>
        </div>

        <div className="lg:col-span-6 bg-white p-8 md:p-12 rounded-[48px] border border-slate-100 shadow-sm min-h-[450px]">
          <div className="flex justify-between items-start mb-8">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-3">
              <div className="w-1.5 h-6 bg-amber-600 rounded-full"></div>
              Performance por Subárea
            </h3>
            <button onClick={() => downloadChart(subAreaRef, 'Performance_SubArea')} className="p-2 text-slate-300 hover:text-amber-600 transition-colors" title="Baixar Gráfico">
              <Download size={18} />
            </button>
          </div>
          <div className="h-80 w-full">
            {reportData.subAreaStats.length > 0 ? (
              <Bar
                data={{
                  labels: reportData.subAreaStats.map(s => s.name),
                  datasets: [{
                    data: reportData.subAreaStats.map(s => s.avg),
                    backgroundColor: reportData.subAreaStats.map((s, i) => `hsla(${(i * 30 + 180) % 360}, 70%, 50%, 0.7)`),
                    borderRadius: 8, barThickness: 30
                  }]
                }}
                options={barOptions() as any}
              />
            ) : <EmptyState message="Sem dados de subárea" />}
          </div>
        </div>

        <div className="lg:col-span-8 bg-white p-8 md:p-12 rounded-[48px] border border-slate-100 shadow-sm min-h-[500px]">
          <div className="flex justify-between items-start mb-8">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-3">
              <div className="w-1.5 h-6 bg-rose-600 rounded-full"></div>
              Top Disciplinas (Filtro Atual)
            </h3>
            <button onClick={() => downloadChart(subRef, 'Top_Disciplinas')} className="p-2 text-slate-300 hover:text-rose-600 transition-colors" title="Baixar Gráfico">
              <Download size={18} />
            </button>
          </div>
          <div className="h-96 w-full">
            {reportData.subStats.length > 0 ? (
              <Bar
                data={{
                  labels: reportData.subStats.map(s => s.name),
                  datasets: [{
                    data: reportData.subStats.map(s => s.avg),
                    backgroundColor: reportData.subStats.map(s => s.avg >= 6 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(244, 63, 94, 0.7)'),
                    borderRadius: 6,
                    barThickness: 40
                  }]
                }}
                options={barOptions() as any}
              />
            ) : <EmptyState message="Sem dados de disciplina" />}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white p-8 md:p-12 rounded-[48px] border border-slate-100 shadow-sm flex flex-col items-center relative">
          <button onClick={() => downloadChart(statusRef, 'Status_Grupo')} className="absolute top-8 right-8 p-2 text-slate-300 hover:text-emerald-600 transition-colors" title="Baixar Gráfico">
            <Download size={18} />
          </button>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] self-start mb-12">Status do Grupo</h3>
          <div className="relative w-full aspect-square max-w-[240px]">
            <Doughnut
              ref={statusRef}
              data={{
                labels: ['Acima da Média', 'Abaixo da Média'],
                datasets: [{
                  data: [reportData.passRate, 100 - reportData.passRate],
                  backgroundColor: ['#10b981', '#f1f5f9'],
                  borderWidth: 0,
                  hoverOffset: 4
                }]
              }}
              options={{
                responsive: true, maintainAspectRatio: false, cutout: '75%',
                plugins: { legend: { display: false }, datalabels: { display: false } }
              } as any}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-5xl font-black text-emerald-600 tracking-tighter">{Math.round(reportData.passRate)}%</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Aprovação</span>
            </div>
          </div>
          <div className="mt-12 space-y-4 w-full">
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aptos Estimados</span>
              <span className="font-black text-emerald-600">{(reportData.passRate * reportData.studentCount / 100).toFixed(0)}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Em Risco</span>
              <span className="font-black text-rose-500">{(reportData.studentCount - (reportData.passRate * reportData.studentCount / 100)).toFixed(0)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Analytics;
