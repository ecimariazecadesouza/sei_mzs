
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  SchoolData, Student, Teacher, Subject, Class,
  Assignment, Grade, FormationType, KnowledgeArea, SubArea, SchoolSettings, AppUser, UserRole, AcademicYearConfig
} from '../types';
import { can, ResourceType } from '../lib/permissions';
import { exportAcademicYear } from '../lib/exportUtils';

const DEFAULT_SCHOOL_LOGO = 'https://i.postimg.cc/1tVz9RY5/Logo-da-Escola-v5-ECIT.png';
const DEFAULT_SYSTEM_LOGO = 'https://i.postimg.cc/Dwznvy86/SEI-V02.png';

export const formatImageUrl = (url: string | null): string => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  return url;
};

const toCamel = (obj: any) => {
  if (!obj) return obj;
  const newObj: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/([-_][a-z])/g, group =>
      group.toUpperCase().replace('-', '').replace('_', '')
    );
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

const toSnake = (obj: any) => {
  if (!obj) return obj;
  const newObj: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    newObj[snakeKey] = obj[key];
  }
  return newObj;
};

const TABLE_MAP: Record<string, string> = {
  students: 'students',
  teachers: 'teachers',
  subjects: 'subjects',
  classes: 'classes',
  assignments: 'assignments',
  grades: 'grades',
  formations: 'formations',
  knowledgeAreas: 'knowledge_areas',
  subAreas: 'sub_areas',
  settings: 'settings',
  users: 'users',
  academicYears: 'academic_years'
};

export interface SchoolContextType {
  data: SchoolData;
  loading: boolean;
  dbError: string | null;
  hasUsers: boolean;
  currentUser: AppUser | null;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  fetchData: (silent?: boolean) => Promise<void>;
  addStudent: (s: any) => Promise<void>;
  updateStudent: (id: string, s: any) => Promise<void>;
  addTeacher: (t: any) => Promise<void>;
  updateTeacher: (id: string, t: any) => Promise<void>;
  addSubject: (s: any) => Promise<void>;
  updateSubject: (id: string, s: any) => Promise<void>;
  addClass: (c: any) => Promise<void>;
  updateClass: (id: string, c: any) => Promise<void>;
  addFormation: (f: any) => Promise<void>;
  updateFormation: (id: string, f: any) => Promise<void>;
  addKnowledgeArea: (a: any) => Promise<void>;
  updateKnowledgeArea: (id: string, a: any) => Promise<void>;
  addSubArea: (s: any) => Promise<void>;
  updateSubArea: (id: string, s: Partial<SubArea>) => Promise<void>;
  assignTeacher: (a: any) => Promise<void>;
  updateGrade: (g: any) => Promise<void>;
  bulkUpdateGrades: (grades: any[]) => Promise<void>;
  deleteItem: (type: keyof SchoolData, id: string) => Promise<void>;
  updateSettings: (s: Partial<SchoolSettings>) => Promise<void>;
  updateAcademicYearConfig: (config: AcademicYearConfig) => Promise<void>;
  exportYear: (year: string) => void;
  cleanEnrollments: (year: string) => Promise<void>;
  addUser: (u: Omit<AppUser, 'id'>) => Promise<void>;
  createFirstAdmin: (u: { name: string, email: string }) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  isSettingPassword: boolean;
  setIsSettingPassword: (v: boolean) => void;
  refreshData: (silent?: boolean) => Promise<void>;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  const [data, setData] = useState<SchoolData>({
    students: [], teachers: [], subjects: [], classes: [],
    assignments: [], grades: [], formations: [], knowledgeAreas: [], subAreas: [],
    users: [],
    academicYears: [],
    settings: {
      schoolLogo: localStorage.getItem('sei_school_logo') || DEFAULT_SCHOOL_LOGO,
      systemLogo: localStorage.getItem('sei_system_logo') || DEFAULT_SYSTEM_LOGO,
      schoolName: localStorage.getItem('sei_school_name') || 'Sistema Escolar Integrado - SEI'
    }
  });

  const [loading, setLoading] = useState(true);
  const [hasUsers, setHasUsers] = useState(true); // Default to true to prevent flickering setup screen
  const [dbError, setDbError] = useState<string | null>(null);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const fetchData = useCallback(async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    setDbError(null);
    const newData: any = { ...data };
    const tables = Object.entries(TABLE_MAP);

    try {
      // Check system initialization status safely via RPC
      const { data: systemHasUsers, error: rpcError } = await supabase.rpc('system_has_users');
      if (!rpcError && systemHasUsers !== null) {
        setHasUsers(systemHasUsers);
      } else {
        // Fallback or error handling
        console.warn("Failed to check system status via RPC, assuming initialized.", rpcError);
        setHasUsers(true);
      }

      const fetchWithTimeout = async (stateKey: string, tableName: string, retries = 3) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            const fetchPromise = supabase.from(tableName).select('*');
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`TIMEOUT`)), 30000)
            );

            const { data: resData, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

            if (error) {
              if (error.code === 'PGRST116' || error.message.includes('not found')) {
                throw new Error(`NOT_FOUND`);
              }
              throw error;
            }
            return { stateKey, data: resData };
          } catch (error: any) {
            if (error.message === 'TIMEOUT' || error.message?.includes('fetch')) {
              if (attempt < retries) {
                console.warn(`Tentativa ${attempt} falhou para ${tableName}. Tentando novamente...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
                continue;
              }
              throw new Error(`Timeout na tabela ${tableName} após ${retries} tentativas.`);
            }
            throw error;
          }
        }
        throw new Error(`Falha ao carregar tabela ${tableName}`);
      };

      const results = await Promise.allSettled(
        tables.map(([stateKey, tableName]) => fetchWithTimeout(stateKey, tableName))
      );

      let foundCriticalError = false;
      let hasConnectionError = false;

      results.forEach((result, index) => {
        const [stateKey, tableName] = tables[index];
        if (result.status === 'fulfilled') {
          const { data: resData } = result.value;
          const items = (resData || []).map(toCamel);
          if (stateKey === 'settings' && items.length > 0) {
            newData.settings = items[0];
          } else {
            newData[stateKey as keyof SchoolData] = items;
          }
        } else {
          const error = result.reason as any;
          console.group(`Erro de Conexão: ${tableName}`);
          console.error("Mensagem:", error.message);
          console.error("Detalhes:", error.details);
          console.groupEnd();

          if (error.message.includes('NOT_FOUND')) {
            if (tableName === 'users') {
              setDbError('MISSING_USERS_TABLE');
              foundCriticalError = true;
            }
          } else if (error.message.includes('Timeout') || error.message.includes('fetch')) {
            hasConnectionError = true;
          }
        }
      });

      if (hasConnectionError && !foundCriticalError) {
        setDbError('CONNECTION_TIMEOUT');
      } else if (!foundCriticalError) {
        setData(newData);
      }
    } catch (error: any) {
      console.error("Critical Fetch Error:", error);
      if (error.message.includes('users')) setDbError('MISSING_USERS_TABLE');
      else setDbError('CONNECTION_TIMEOUT');
    } finally {
      if (!silent) setLoading(false);
      setIsInitialLoad(false);
    }
  }, [data]);

  useEffect(() => {
    // Verificação proativa de link de convite ou recuperação na URL
    const checkForInvite = () => {
      const url = new URL(window.location.href);
      const hash = window.location.hash;
      const searchParams = url.searchParams;

      const isInvite = hash.includes('type=invite') ||
        hash.includes('type=recovery') ||
        hash.includes('access_token=') ||
        searchParams.has('token') ||
        searchParams.get('type') === 'invite';

      if (isInvite) {
        console.log("INVITE DETECTED! Blocking normal flow.");
        setIsSettingPassword(true);
      }
    };

    checkForInvite();

    // Escutar mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("AUTH EVENT:", event, "SESSION:", session?.user?.id);

      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && window.location.hash.includes('type=invite'))) {
        setIsSettingPassword(true);
      }

      if (session?.user) {
        // Buscar dados extras do usuário na tabela public.users
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userData) {
          setCurrentUser(toCamel(userData));
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const login = async (email: string, password?: string): Promise<boolean> => {
    try {
      if (password) {
        // Login Oficial via Supabase Auth
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return true;
      } else {
        // Fallback para o modo Legado (simula login apenas por e-mail se necessário)
        const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (user) {
          setCurrentUser(user);
          return true;
        }
      }
    } catch (error: any) {
      console.error("Login Error:", error.message);
      throw error;
    }
    return false;
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };

  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  };

  const updateProfile = async (name: string) => {
    if (!currentUser) return;
    const formattedName = name.trim().toUpperCase();
    const { error } = await supabase.from('users').update({ name: formattedName }).eq('id', currentUser.id);
    if (error) throw error;

    const updatedUser = { ...currentUser, name: formattedName };
    setCurrentUser(updatedUser);
    localStorage.setItem('sei_session', JSON.stringify(updatedUser));

    // Atualiza também na lista local
    setData(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === currentUser.id ? updatedUser : u)
    }));
  };

  const createFirstAdmin = async (u: { name: string, email: string }) => {
    const payload = { ...u, role: 'admin_ti' as UserRole };
    const { data: res, error } = await supabase.from('users').insert([toSnake(payload)]).select();
    if (error) throw error;
    if (res) {
      const newUser = toCamel(res[0]);
      setData(prev => ({ ...prev, users: [newUser] }));
      setCurrentUser(newUser);
      localStorage.setItem('sei_session', JSON.stringify(newUser));
    }
  };

  const logout = async () => {
    setCurrentUser(null);
    localStorage.removeItem('sei_session');
    await supabase.auth.signOut();
  };

  const updateSettings = async (s: Partial<SchoolSettings>) => {
    if (!currentUser || !can(currentUser.role, 'update', 'settings')) {
      alert('Acesso Negado: Apenas Administradores de TI podem alterar as configurações.');
      return;
    }
    const newSettings = { ...data.settings, ...s };
    setData(prev => ({ ...prev, settings: newSettings }));
    try {
      await supabase.from('settings').upsert({ id: 1, ...toSnake(newSettings) });
    } catch (e) { }
  };

  const updateAcademicYearConfig = async (config: AcademicYearConfig) => {
    // Função para validar se a data é razoável (evita anos como 42026)
    const validateDate = (dateStr: string | null) => {
      if (!dateStr) return null;
      const year = parseInt(dateStr.split('-')[0]);
      if (year < 2000 || year > 2100) return null;
      return dateStr;
    };

    const sanitizedConfig = {
      year: config.year,
      b1End: validateDate(config.b1End),
      b2End: validateDate(config.b2End),
      b3End: validateDate(config.b3End),
      b4End: validateDate(config.b4End),
      recStart: validateDate(config.recStart),
      recEnd: validateDate(config.recEnd),
    };

    if (!currentUser || !can(currentUser.role, 'update', 'academic_years')) {
      alert('Acesso Negado: Apenas Administradores de TI podem alterar o calendário.');
      return;
    }

    console.log("Saving sanitized config:", sanitizedConfig);

    const { error } = await supabase
      .from('academic_years')
      .upsert(toSnake(sanitizedConfig), { onConflict: 'year' });

    if (error) {
      console.group("Erro ao Salvar Calendário");
      console.error("Payload:", sanitizedConfig);
      console.error("Erro:", error);
      console.groupEnd();
      throw error;
    }

    setData(prev => {
      const exists = prev.academicYears.find(y => y.year === config.year);
      if (exists) {
        return {
          ...prev,
          academicYears: prev.academicYears.map(y => y.year === config.year ? sanitizedConfig : y)
        } as SchoolData;
      }
      return {
        ...prev,
        academicYears: [...prev.academicYears, sanitizedConfig]
      } as SchoolData;
    });
  };

  const genericAdd = async (tableKey: keyof SchoolData, item: any) => {
    if (!currentUser || !can(currentUser.role, 'create', tableKey as ResourceType)) {
      alert('Acesso Negado: Você não tem permissão para realizar esta ação.');
      return;
    }
    const { data: res, error } = await supabase.from(TABLE_MAP[tableKey]).insert([toSnake(item)]).select();
    if (error) throw error;
    if (res) setData(prev => ({ ...prev, [tableKey]: [...(prev[tableKey] as any[]), toCamel(res[0])] }));
  };

  const genericUpdate = async (tableKey: keyof SchoolData, id: string, item: any) => {
    if (!currentUser || !can(currentUser.role, 'update', tableKey as ResourceType)) {
      alert('Acesso Negado: Você não tem permissão para realizar esta ação.');
      return;
    }
    const { error } = await supabase.from(TABLE_MAP[tableKey]).update(toSnake(item)).eq('id', id);
    if (error) throw error;
    setData(prev => ({
      ...prev,
      [tableKey]: (prev[tableKey] as any[]).map(i => i.id === id ? { ...i, ...item } : i)
    }));
  };

  const addStudent = (s: any) => genericAdd('students', { ...s, registrationNumber: `RA${new Date().getFullYear()}${Math.floor(Math.random() * 1000000)}` });
  const updateStudent = (id: string, s: any) => genericUpdate('students', id, s);
  const addTeacher = (t: any) => genericAdd('teachers', t);
  const updateTeacher = (id: string, t: any) => genericUpdate('teachers', id, t);
  const addSubject = (s: any) => genericAdd('subjects', s);
  const updateSubject = (id: string, s: any) => genericUpdate('subjects', id, s);
  const addClass = (c: any) => genericAdd('classes', c);
  const updateClass = (id: string, c: any) => genericUpdate('classes', id, c);
  const addFormation = (f: any) => genericAdd('formations', f);
  const updateFormation = (id: string, f: any) => genericUpdate('formations', id, f);
  const addKnowledgeArea = (a: any) => genericAdd('knowledgeAreas', a);
  const updateKnowledgeArea = (id: string, a: any) => genericUpdate('knowledgeAreas', id, a);
  const addSubArea = (s: any) => genericAdd('subAreas', s);
  const updateSubArea = (id: string, s: Partial<SubArea>) => genericUpdate('subAreas', id, s);
  const assignTeacher = (a: any) => genericAdd('assignments', a);
  const addUser = (u: any) => genericAdd('users', u);

  const updateGrade = async (g: any) => {
    if (!currentUser || !can(currentUser.role, 'update', 'grades')) {
      alert('Acesso Negado: Você não tem permissão para alterar notas.');
      return;
    }
    await supabase.from('grades').upsert(toSnake(g), { onConflict: 'student_id, subject_id, term' });
    await fetchData(true);
  };

  const bulkUpdateGrades = async (grades: any[]) => {
    if (!currentUser || !can(currentUser.role, 'update', 'grades')) {
      alert('Acesso Negado: Você não tem permissão para alterar notas.');
      return;
    }
    await supabase.from('grades').upsert(grades.map(toSnake), { onConflict: 'student_id, subject_id, term' });
    await fetchData(true);
  };

  const deleteItem = async (type: keyof SchoolData, id: string) => {
    if (!currentUser || !can(currentUser.role, 'delete', type as ResourceType)) {
      alert('Acesso Negado: Você não tem permissão para excluir este registro.');
      return;
    }
    const { error } = await supabase.from(TABLE_MAP[type]).delete().eq('id', id);
    if (error) {
      console.error(`Error deleting from ${type}:`, error);
      throw error;
    }
    setData(prev => ({ ...prev, [type]: (prev[type] as any[]).filter(i => i.id !== id) }));
  };

  const exportYear = (year: string) => {
    if (!currentUser || !can(currentUser.role, 'update', 'settings')) {
      alert('Acesso Negado: Você não tem permissão para exportar dados.');
      return;
    }
    const academicConfig = data.academicYears.find(y => y.year === year);
    exportAcademicYear({ year, data, academicConfig });
  };

  const cleanEnrollments = async (year: string) => {
    if (!currentUser || !can(currentUser.role, 'update', 'settings')) {
      alert('Acesso Negado: Apenas Administradores TI podem limpar matrículas.');
      return;
    }

    try {
      // 1. Exportar automaticamente antes de excluir
      console.log('📦 Gerando backup automático...');
      const academicConfig = data.academicYears.find(y => y.year === year);
      exportAcademicYear({ year, data, academicConfig });

      // 2. Buscar todos os alunos do ano
      const studentsInYear = data.students.filter(s =>
        data.classes.some(c => c.id === s.classId && c.year === year)
      );

      if (studentsInYear.length === 0) {
        alert('Nenhum aluno encontrado para este ano letivo.');
        return;
      }

      const studentIds = studentsInYear.map(s => s.id);

      // 3. Excluir notas dos alunos
      console.log(`🗑️ Excluindo notas de ${studentIds.length} alunos...`);
      const { error: gradesError } = await supabase
        .from('grades')
        .delete()
        .in('student_id', studentIds);

      if (gradesError) throw gradesError;

      // 4. Excluir alunos
      console.log(`🗑️ Excluindo ${studentIds.length} alunos...`);
      const { error: studentsError } = await supabase
        .from('students')
        .delete()
        .in('id', studentIds);

      if (studentsError) throw studentsError;

      // 5. Atualizar estado local
      setData(prev => ({
        ...prev,
        students: prev.students.filter(s => !studentIds.includes(s.id)),
        grades: prev.grades.filter(g => !studentIds.includes(g.studentId)),
      }));

      alert(`✅ Limpeza concluída!\n\n${studentIds.length} alunos e suas notas foram removidos do ano ${year}.\n\nUm backup foi gerado automaticamente.`);
    } catch (error: any) {
      console.error('❌ Erro ao limpar matrículas:', error);
      alert(`Erro ao limpar matrículas: ${error.message || 'Erro desconhecido'}`);
      throw error;
    }
  };

  const value = useMemo(() => ({
    data, loading, dbError, hasUsers, currentUser, login, logout, updateProfile, fetchData,
    addStudent, updateStudent, addTeacher, updateTeacher,
    addSubject, updateSubject, addClass, updateClass,
    addFormation, updateFormation, addKnowledgeArea, updateKnowledgeArea,
    addSubArea, updateSubArea, assignTeacher, updateGrade, bulkUpdateGrades,
    deleteItem, updateSettings, updateAcademicYearConfig, exportYear, cleanEnrollments, addUser, createFirstAdmin,
    updatePassword, requestPasswordReset, isSettingPassword, setIsSettingPassword,
    isInitialLoad,
    refreshData: fetchData
  }), [data, loading, dbError, currentUser, isSettingPassword, isInitialLoad]);

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
};

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (context === undefined) throw new Error('useSchool deve ser usado dentro de um SchoolProvider');
  return context;
};
