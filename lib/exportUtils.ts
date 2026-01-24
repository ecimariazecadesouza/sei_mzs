import * as XLSX from 'xlsx';
import { SchoolData, Student, Grade, Teacher, Subject, Class, Assignment, AcademicYearConfig } from '../types';

interface ExportData {
    year: string;
    data: SchoolData;
    academicConfig?: AcademicYearConfig;
}

/**
 * Exporta todos os dados de um ano letivo específico para uma planilha Excel
 */
export const exportAcademicYear = ({ year, data, academicConfig }: ExportData): void => {
    try {
        // Criar novo workbook
        const wb = XLSX.utils.book_new();

        // 1. ABA: RESUMO
        const summaryData = createSummarySheet(year, data, academicConfig);
        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumo');

        // 2. ABA: ALUNOS
        const studentsData = createStudentsSheet(data.students, data.classes, year);
        const studentsWs = XLSX.utils.json_to_sheet(studentsData);
        XLSX.utils.book_append_sheet(wb, studentsWs, 'Alunos');

        // 3. ABA: NOTAS
        const gradesData = createGradesSheet(data.grades, data.students, data.subjects, data.classes, year);
        const gradesWs = XLSX.utils.json_to_sheet(gradesData);
        XLSX.utils.book_append_sheet(wb, gradesWs, 'Notas');

        // 4. ABA: PROFESSORES
        const teachersData = createTeachersSheet(data.teachers, data.assignments, data.subjects, data.classes, year);
        const teachersWs = XLSX.utils.json_to_sheet(teachersData);
        XLSX.utils.book_append_sheet(wb, teachersWs, 'Professores');

        // 5. ABA: TURMAS E DISCIPLINAS
        const classesData = createClassesSheet(data.classes, data.subjects, year);
        const classesWs = XLSX.utils.json_to_sheet(classesData);
        XLSX.utils.book_append_sheet(wb, classesWs, 'Turmas');

        // 6. ABA: CALENDÁRIO
        if (academicConfig) {
            const calendarData = createCalendarSheet(academicConfig);
            const calendarWs = XLSX.utils.aoa_to_sheet(calendarData);
            XLSX.utils.book_append_sheet(wb, calendarWs, 'Calendário');
        }

        // Gerar arquivo e fazer download
        const fileName = `Ano_Letivo_${year}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);

        console.log(`✅ Exportação concluída: ${fileName}`);
    } catch (error) {
        console.error('❌ Erro ao exportar ano letivo:', error);
        throw new Error('Falha ao gerar planilha de exportação');
    }
};

/**
 * Cria a aba de resumo com informações gerais
 */
const createSummarySheet = (year: string, data: SchoolData, config?: AcademicYearConfig): any[][] => {
    const studentsInYear = data.students.filter(s =>
        data.classes.some(c => c.id === s.classId && c.year === year)
    );

    const classesInYear = data.classes.filter(c => c.year === year);
    const subjectsInYear = data.subjects.filter(s => s.year === year);

    const activeStudents = studentsInYear.filter(s => s.status === 'Cursando').length;
    const transferredStudents = studentsInYear.filter(s => s.status === 'Transferência').length;
    const droppedStudents = studentsInYear.filter(s => s.status === 'Evasão').length;

    return [
        ['RESUMO DO ANO LETIVO', year],
        [],
        ['Data de Exportação:', new Date().toLocaleDateString('pt-BR')],
        ['Hora de Exportação:', new Date().toLocaleTimeString('pt-BR')],
        [],
        ['ESTATÍSTICAS GERAIS'],
        ['Total de Alunos:', studentsInYear.length],
        ['  - Cursando:', activeStudents],
        ['  - Transferidos:', transferredStudents],
        ['  - Evasão:', droppedStudents],
        ['Total de Turmas:', classesInYear.length],
        ['Total de Disciplinas:', subjectsInYear.length],
        ['Total de Professores:', data.teachers.length],
        [],
        ['CALENDÁRIO ACADÊMICO'],
        ['Fim do 1º Bimestre:', config?.b1End ? formatDate(config.b1End) : 'Não definido'],
        ['Fim do 2º Bimestre:', config?.b2End ? formatDate(config.b2End) : 'Não definido'],
        ['Fim do 3º Bimestre:', config?.b3End ? formatDate(config.b3End) : 'Não definido'],
        ['Fim do 4º Bimestre:', config?.b4End ? formatDate(config.b4End) : 'Não definido'],
        ['Início da Recuperação:', config?.recStart ? formatDate(config.recStart) : 'Não definido'],
        ['Fim da Recuperação:', config?.recEnd ? formatDate(config.recEnd) : 'Não definido'],
    ];
};

/**
 * Cria a aba de alunos
 */
const createStudentsSheet = (students: Student[], classes: Class[], year: string): any[] => {
    const studentsInYear = students.filter(s =>
        classes.some(c => c.id === s.classId && c.year === year)
    );

    return studentsInYear.map(student => {
        const studentClass = classes.find(c => c.id === student.classId);
        return {
            'Matrícula': student.registrationNumber,
            'Nome': student.name,
            'Turma': studentClass?.name || 'N/A',
            'Turno': studentClass?.shift || 'N/A',
            'Modalidade': studentClass?.enrollmentType || 'N/A',
            'Status': student.status,
        };
    });
};

/**
 * Cria a aba de notas com cálculos completos
 */
const createGradesSheet = (
    grades: Grade[],
    students: Student[],
    subjects: Subject[],
    classes: Class[],
    year: string
): any[] => {
    const studentsInYear = students.filter(s =>
        classes.some(c => c.id === s.classId && c.year === year)
    );

    const gradesData: any[] = [];

    studentsInYear.forEach(student => {
        const studentClass = classes.find(c => c.id === student.classId);
        const studentGrades = grades.filter(g => g.studentId === student.id);

        // Agrupar notas por disciplina
        const subjectGrades = new Map<string, { [key: number]: number }>();

        studentGrades.forEach(grade => {
            if (!subjectGrades.has(grade.subjectId)) {
                subjectGrades.set(grade.subjectId, {});
            }
            subjectGrades.get(grade.subjectId)![grade.term] = grade.value;
        });

        // Criar linha para cada disciplina do aluno
        subjectGrades.forEach((termGrades, subjectId) => {
            const subject = subjects.find(s => s.id === subjectId);
            const b1 = termGrades[1] ?? null;
            const b2 = termGrades[2] ?? null;
            const b3 = termGrades[3] ?? null;
            const b4 = termGrades[4] ?? null;

            // CÁLCULOS
            // PTS - Pontos totais (soma dos 4 bimestres)
            const validGrades = [b1, b2, b3, b4].filter(g => g !== null) as number[];
            const pts = validGrades.length > 0
                ? validGrades.reduce((sum, g) => sum + g, 0)
                : null;

            // MG - Média Geral (PTS ÷ 4)
            const mg = pts !== null && validGrades.length === 4
                ? pts / 4
                : null;

            // PRECISA - Pontos necessários para aprovação (24 pontos = média 6.0)
            const precisa = pts !== null && pts < 24
                ? 24 - pts
                : 0;

            // RF - Recuperação Final (nota necessária)
            // Fórmula: Para média final 6.0 → (MG + RF) / 2 = 6.0 → RF = 12 - MG
            let rf: number | string = '-';
            if (mg !== null) {
                if (mg < 3.0) {
                    rf = '-'; // Reprovado direto, não faz RF
                } else if (mg < 6.0) {
                    rf = 12 - mg; // Nota necessária na RF
                } else {
                    rf = '-'; // Aprovado, não precisa de RF
                }
            }

            // MF - Média Final
            // Se houver nota de recuperação (Termo 5), recalcula a média
            const rfGrade = termGrades[5] ?? null;
            let mf = mg;

            if (mg !== null && mg < 6.0 && rfGrade !== null) {
                // Cálculo da Média Final com Recuperação
                // Considerando a regra (MG + RF) / 2 para atingir 6.0
                mf = (mg + rfGrade) / 2;
            }

            // SITUAÇÃO
            let situacao = 'Pendente';
            if (mf !== null) {
                if (mf >= 6.0) {
                    situacao = 'Aprovado';
                } else if (mf < 3.0) {
                    situacao = 'Reprovado';
                } else {
                    situacao = 'Recuperação';
                }
            }

            // DESEMPENHO
            let desempenho = '-';
            if (mf !== null) {
                if (mf >= 9.0) {
                    desempenho = 'Excelente';
                } else if (mf >= 8.0) {
                    desempenho = 'Ótimo';
                } else if (mf >= 7.0) {
                    desempenho = 'Bom';
                } else if (mf >= 6.0) {
                    desempenho = 'Satisfatório';
                } else {
                    desempenho = 'Insuficiente';
                }
            }

            gradesData.push({
                'Matrícula': student.registrationNumber,
                'Aluno': student.name,
                'Turma': studentClass?.name || 'N/A',
                'Disciplina': subject?.name || 'N/A',
                '1º BIM': b1 !== null ? b1.toFixed(1) : '-',
                '2º BIM': b2 !== null ? b2.toFixed(1) : '-',
                '3º BIM': b3 !== null ? b3.toFixed(1) : '-',
                '4º BIM': b4 !== null ? b4.toFixed(1) : '-',
                'PTS': pts !== null ? pts.toFixed(1) : '-',
                'MG': mg !== null ? mg.toFixed(1) : '-',
                'PRECISA': precisa > 0 ? precisa.toFixed(1) : '-',
                'RF': typeof rf === 'number' ? rf.toFixed(1) : rf,
                'MF': mf !== null ? mf.toFixed(1) : '-',
                'SITUAÇÃO': situacao,
                'DESEMPENHO': desempenho,
            });
        });
    });

    return gradesData;
};

/**
 * Cria a aba de professores
 */
const createTeachersSheet = (
    teachers: Teacher[],
    assignments: Assignment[],
    subjects: Subject[],
    classes: Class[],
    year: string
): any[] => {
    const teachersData: any[] = [];

    teachers.forEach(teacher => {
        const teacherAssignments = assignments.filter(a => a.teacherId === teacher.id);

        // Filtrar apenas atribuições do ano selecionado
        const yearAssignments = teacherAssignments.filter(a => {
            const assignmentClass = classes.find(c => c.id === a.classId);
            return assignmentClass?.year === year;
        });

        if (yearAssignments.length === 0) return; // Pular professores sem atribuições neste ano

        yearAssignments.forEach(assignment => {
            const subject = subjects.find(s => s.id === assignment.subjectId);
            const assignmentClass = classes.find(c => c.id === assignment.classId);

            teachersData.push({
                'Professor': teacher.name,
                'Email': teacher.email,
                'Disciplina': subject?.name || 'N/A',
                'Turma': assignmentClass?.name || 'N/A',
                'Turno': assignmentClass?.shift || 'N/A',
            });
        });
    });

    return teachersData;
};

/**
 * Cria a aba de turmas e disciplinas
 */
const createClassesSheet = (classes: Class[], subjects: Subject[], year: string): any[] => {
    const classesInYear = classes.filter(c => c.year === year);

    return classesInYear.map(classItem => {
        const classSubjects = subjects.filter(s => classItem.subjectIds.includes(s.id));

        return {
            'Turma': classItem.name,
            'Modalidade': classItem.enrollmentType,
            'Turno': classItem.shift,
            'Ano Letivo': classItem.year,
            'Total de Disciplinas': classSubjects.length,
            'Disciplinas': classSubjects.map(s => s.name).join(', '),
        };
    });
};

/**
 * Cria a aba de calendário acadêmico
 */
const createCalendarSheet = (config: AcademicYearConfig): any[][] => {
    return [
        ['CALENDÁRIO ACADÊMICO', config.year],
        [],
        ['Evento', 'Data'],
        ['Fim do 1º Bimestre', formatDate(config.b1End)],
        ['Fim do 2º Bimestre', formatDate(config.b2End)],
        ['Fim do 3º Bimestre', formatDate(config.b3End)],
        ['Fim do 4º Bimestre', formatDate(config.b4End)],
        [],
        ['RECUPERAÇÃO FINAL'],
        ['Início', formatDate(config.recStart)],
        ['Término', formatDate(config.recEnd)],
    ];
};

/**
 * Formata data ISO para formato brasileiro
 */
const formatDate = (isoDate: string | null): string => {
    if (!isoDate) return 'Não definido';
    try {
        const date = new Date(isoDate);
        return date.toLocaleDateString('pt-BR');
    } catch {
        return 'Data inválida';
    }
};
