
import { UserRole } from '../types';

/**
 * Definição central de quem pode acessar o quê.
 * Se você criar um menu novo, adicione a rota aqui e defina os cargos.
 */
export const MENU_PERMISSIONS: Record<string, UserRole[]> = {
  '/': ['admin_ti', 'admin_dir', 'coord', 'prof', 'sec', 'guest'],
  '/curriculum': ['admin_ti', 'admin_dir', 'coord'],
  '/subjects': ['admin_ti', 'admin_dir', 'coord'],
  '/classes': ['admin_ti', 'admin_dir', 'coord', 'sec'],
  '/teachers': ['admin_ti', 'admin_dir', 'coord'],
  '/students': ['admin_ti', 'admin_dir', 'coord', 'prof', 'sec'],
  '/grades': ['admin_ti', 'admin_dir', 'coord', 'prof', 'sec'],
  '/council': ['admin_ti', 'admin_dir', 'coord', 'prof'],
  '/analytics': ['admin_ti', 'admin_dir', 'coord', 'prof', 'sec', 'guest'],
  '/reports': ['admin_ti', 'admin_dir', 'coord', 'prof', 'sec'],
  '/users': ['admin_ti'],
  '/settings': ['admin_ti', 'admin_dir', 'coord', 'prof', 'sec'],
};

/**
 * Verifica se um cargo específico tem acesso a uma rota
 */
export const hasPermission = (role: UserRole, path: string): boolean => {
  const allowedRoles = MENU_PERMISSIONS[path];
  if (!allowedRoles) return true; // Se não estiver no mapa, é público para logados
  return allowedRoles.includes(role);
};

export type ActionType = 'create' | 'update' | 'delete';
export type ResourceType = 'students' | 'classes' | 'grades' | 'settings' | 'users' | 'academic_years' | 'subjects' | 'teachers' | 'assignments' | 'formations' | 'knowledge_areas' | 'sub_areas' | 'council';

export const can = (role: UserRole, action: ActionType, resource: ResourceType): boolean => {
  if (role === 'admin_ti') return true; // Admin TI pode tudo

  switch (resource) {
    case 'students':
    case 'classes':
    case 'subjects':
    case 'teachers':
    case 'formations':
    case 'knowledge_areas':
    case 'sub_areas':
    case 'users':
      // Apenas Admin TI pode criar ou excluir estes recursos estruturais
      if (action === 'create' || action === 'delete') return false;
      // Admin Dir e Coord podem editar
      return ['admin_dir', 'coord'].includes(role);

    case 'grades':
    case 'assignments':
      // Professores, Dir e Coord podem lançar/alterar notas
      // Secretária NÃO pode alterar notas
      if (role === 'sec') return false;
      return ['prof', 'admin_dir', 'coord'].includes(role);

    case 'settings':
    case 'academic_years':
      // Apenas Admin TI mexe em configurações globais e calendário
      return false;

    case 'council':
      // Alterações no conselho: Admin TI, Dir e Coord
      return ['admin_dir', 'coord'].includes(role);

    default:
      return false;
  }
};
