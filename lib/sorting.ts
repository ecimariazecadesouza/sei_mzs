
/**
 * Ordem prioritária das disciplinas conforme solicitado pelo usuário.
 */
export const SUBJECT_ORDER = [
    'ARTE',
    'BIOLOGIA',
    'ED. FÍSICA',
    'EDUCAÇÃO FÍSICA',
    'ESPANHOL',
    'FILOSOFIA',
    'FÍSICA',
    'GEOGRAFIA',
    'HISTÓRIA',
    'INGLÊS',
    'MATEMÁTICA',
    'PORTUGUÊS',
    'LÍNGUA PORTUGUESA',
    'QUÍMICA',
    'SOCIOLOGIA'
];

/**
 * Normaliza o nome da disciplina para comparação.
 */
const normalize = (name: string) => name.trim().toUpperCase();

/**
 * Função de comparação para ordenar disciplinas.
 * Prioriza a lista em SUBJECT_ORDER e depois segue ordem alfabética.
 */
export const sortSubjects = (a: { name: string }, b: { name: string }) => {
    const nameA = normalize(a.name);
    const nameB = normalize(b.name);

    const indexA = SUBJECT_ORDER.indexOf(nameA);
    const indexB = SUBJECT_ORDER.indexOf(nameB);

    // Se ambos estão na lista de prioridade
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;

    // Se apenas A está na lista
    if (indexA !== -1) return -1;

    // Se apenas B está na lista
    if (indexB !== -1) return 1;

    // Se nenhum está na lista, ordem alfabética
    return nameA.localeCompare(nameB, 'pt-BR');
};

/**
 * Função de comparação para ordenar turmas alfabeticamente.
 */
export const sortClasses = (a: { name: string }, b: { name: string }) => {
    return a.name.localeCompare(b.name, 'pt-BR', { numeric: true });
};

/**
 * Função de comparação para ordenar professores alfabeticamente.
 */
export const sortTeachers = (a: { name: string }, b: { name: string }) => {
    return a.name.localeCompare(b.name, 'pt-BR');
};
