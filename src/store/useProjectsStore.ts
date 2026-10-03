import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SavedProject, SavedProjectData } from '../types/savedProject';
export type { SavedProject, SavedProjectData };
import { usePlannerStore } from './usePlannerStore';
import { useRoomStore } from './useRoomStore';
import { useHistoryStore } from './useHistoryStore';
import { clearMaterialCache } from '../core/3d/materials';

export function formatProjectDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

export function generateDefaultProjectName(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `Проект от ${day}.${month}.${year} ${hours}:${minutes}`;
}

function captureCurrentProjectData(): SavedProjectData {
  const plannerState = usePlannerStore.getState();
  const roomState = useRoomStore.getState();

  return {
    modules: plannerState.modules,
    projectSettings: plannerState.projectSettings,
    globalMaterials: plannerState.globalMaterials,
    roomData: roomState.room,
    roomConfig: plannerState.room,
    customTemplates: plannerState.customTemplates,
  };
}

function applyProjectData(data: SavedProjectData) {
  if (!data) return;

  usePlannerStore.setState({
    modules: data.modules || [],
    projectSettings: data.projectSettings || usePlannerStore.getState().projectSettings,
    globalMaterials: data.globalMaterials || usePlannerStore.getState().globalMaterials,
    room: data.roomConfig || usePlannerStore.getState().room,
    customTemplates: data.customTemplates || usePlannerStore.getState().customTemplates,
    selectedModuleId: null,
  });

  if (data.roomData) {
    useRoomStore.setState({
      room: data.roomData,
      wallResizeDirection: 'both',
    });
  }

  useHistoryStore.getState().clearHistory();
  clearMaterialCache();
}

async function syncProjectToDisk(project: SavedProject) {
  try {
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    });
  } catch {}
}

async function removeProjectFromDisk(id: string) {
  try {
    await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
    });
  } catch {}
}

interface ProjectsStoreState {
  // Список всех проектов в локальной папке "Проекты"
  projects: SavedProject[];

  // Идентификатор и название активного проекта
  currentProjectId: string | null;
  currentProjectName: string;

  // Статус автосохранения: 'saved' (сохранено), 'saving' (в процессе), 'unsaved' (есть несохранённые изменения)
  saveStatus: 'saved' | 'saving' | 'unsaved';
  lastSavedAt: string | null;

  setSaveStatus: (status: 'saved' | 'saving' | 'unsaved') => void;

  // Модальные окна
  isSaveModalOpen: boolean;
  openSaveModal: () => void;
  closeSaveModal: () => void;

  isProjectsListModalOpen: boolean;
  openProjectsListModal: () => void;
  closeProjectsListModal: () => void;

  // Основные операции с проектами
  createNewProject: (customName?: string) => string;
  loadProject: (id: string) => boolean;
  saveCurrentProject: (options?: { newName?: string; saveAsNew?: boolean }) => string;
  deleteProject: (id: string) => void;
  renameProject: (id: string, newName: string) => void;
  duplicateProject: (id: string) => string;
  exportProjectToJson: (id: string) => string | null;
  importProjectFromJson: (jsonStr: string) => SavedProject | null;
  syncFromDisk: () => Promise<void>;
  openFolderOnDisk: () => Promise<void>;
}

export const useProjectsStore = create<ProjectsStoreState>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProjectId: null,
      currentProjectName: generateDefaultProjectName(),

      saveStatus: 'saved',
      lastSavedAt: null,

      setSaveStatus: (status) => set({ saveStatus: status }),

      isSaveModalOpen: false,
      openSaveModal: () => set({ isSaveModalOpen: true }),
      closeSaveModal: () => set({ isSaveModalOpen: false }),

      isProjectsListModalOpen: false,
      openProjectsListModal: () => set({ isProjectsListModalOpen: true }),
      closeProjectsListModal: () => set({ isProjectsListModalOpen: false }),

      /**
       * 1. Создание нового проекта:
       * - Создаёт запись в папке "Проекты" с шаблонным именем
       * - Задаёт его как активный
       */
      createNewProject: (customName?: string) => {
        const name = customName?.trim() || generateDefaultProjectName();
        const id = 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const now = new Date().toISOString();

        const currentData = captureCurrentProjectData();
        const totalPrice = usePlannerStore.getState().calculateTotalPrice().grandTotal;
        const modulesCount = currentData.modules.length;

        const newProject: SavedProject = {
          id,
          name,
          createdAt: now,
          updatedAt: now,
          totalPrice,
          modulesCount,
          data: currentData,
        };

        set((state) => ({
          projects: [newProject, ...state.projects],
          currentProjectId: id,
          currentProjectName: name,
          saveStatus: 'saved',
          lastSavedAt: now,
        }));

        syncProjectToDisk(newProject);
        return id;
      },

      /**
       * 2. Загрузка проекта из папки:
       * - Применяет модули, настройки и помещение в 3D сцену
       */
      loadProject: (id: string) => {
        const { projects } = get();
        const project = projects.find((p) => p.id === id);
        if (!project) return false;

        applyProjectData(project.data);

        set({
          currentProjectId: project.id,
          currentProjectName: project.name,
          saveStatus: 'saved',
          lastSavedAt: project.updatedAt,
        });

        return true;
      },

      /**
       * 3. Сохранение текущего проекта:
       * - Если saveAsNew = true: создаёт новую отдельную копию в папке проектов
       * - Иначе: обновляет существующий открытый проект
       */
      saveCurrentProject: (options) => {
        const { projects, currentProjectId, currentProjectName } = get();
        const now = new Date().toISOString();
        const currentData = captureCurrentProjectData();
        const totalPrice = usePlannerStore.getState().calculateTotalPrice().grandTotal;
        const modulesCount = currentData.modules.length;

        const targetName = options?.newName?.trim() || currentProjectName || generateDefaultProjectName();
        const shouldCreateNew = Boolean(
          options?.saveAsNew || !currentProjectId || !projects.some((p) => p.id === currentProjectId)
        );

        if (shouldCreateNew) {
          const newId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
          const newProject: SavedProject = {
            id: newId,
            name: targetName,
            createdAt: now,
            updatedAt: now,
            totalPrice,
            modulesCount,
            data: currentData,
          };

          set((state) => ({
            projects: [newProject, ...state.projects],
            currentProjectId: newId,
            currentProjectName: targetName,
            saveStatus: 'saved',
            lastSavedAt: now,
          }));

          syncProjectToDisk(newProject);
          return newId;
        } else {
          // Перезапись существующего проекта
          const existing = projects.find((p) => p.id === currentProjectId);
          const updatedProject: SavedProject = {
            ...(existing || { id: currentProjectId!, createdAt: now }),
            id: currentProjectId!,
            name: targetName,
            updatedAt: now,
            totalPrice,
            modulesCount,
            data: currentData,
          };

          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProjectId ? updatedProject : p
            ),
            currentProjectName: targetName,
            saveStatus: 'saved',
            lastSavedAt: now,
          }));

          syncProjectToDisk(updatedProject);
          return currentProjectId!;
        }
      },

      /**
       * 4. Удаление проекта из папки
       */
      deleteProject: (id: string) => {
        removeProjectFromDisk(id);
        set((state) => {
          const nextProjects = state.projects.filter((p) => p.id !== id);
          let nextCurrentId = state.currentProjectId;
          let nextCurrentName = state.currentProjectName;

          if (state.currentProjectId === id) {
            if (nextProjects.length > 0) {
              nextCurrentId = nextProjects[0].id;
              nextCurrentName = nextProjects[0].name;
            } else {
              nextCurrentId = null;
              nextCurrentName = generateDefaultProjectName();
            }
          }

          return {
            projects: nextProjects,
            currentProjectId: nextCurrentId,
            currentProjectName: nextCurrentName,
          };
        });
      },

      /**
       * 5. Переименование проекта
       */
      renameProject: (id: string, newName: string) => {
        const trimmed = newName.trim();
        if (!trimmed) return;

        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, name: trimmed, updatedAt: new Date().toISOString() } : p
          ),
          currentProjectName: state.currentProjectId === id ? trimmed : state.currentProjectName,
        }));
      },

      /**
       * 6. Дублирование проекта
       */
      duplicateProject: (id: string) => {
        const { projects } = get();
        const target = projects.find((p) => p.id === id);
        if (!target) return '';

        const newId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const now = new Date().toISOString();
        const clonedProject: SavedProject = {
          ...target,
          id: newId,
          name: `${target.name} (Копия)`,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          projects: [clonedProject, ...state.projects],
        }));

        return newId;
      },

      /**
       * 7. Экспорт проекта в JSON для скачивания
       */
      exportProjectToJson: (id: string) => {
        const { projects } = get();
        const project = projects.find((p) => p.id === id);
        if (!project) return null;

        const payload = {
          version: '2.0',
          type: 'mkonstruktor_project',
          id: project.id,
          name: project.name,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          totalPrice: project.totalPrice,
          modulesCount: project.modulesCount,
          ...project.data,
        };

        return JSON.stringify(payload, null, 2);
      },

      /**
       * 8. Импорт проекта из JSON файла
       */
      importProjectFromJson: (jsonStr: string) => {
        try {
          const parsed = JSON.parse(jsonStr);
          const now = new Date().toISOString();
          const newId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
          const name = parsed.name || `Импортированный проект от ${formatProjectDate(now)}`;

          const projectData: SavedProjectData = {
            modules: parsed.modules || [],
            projectSettings: parsed.projectSettings || usePlannerStore.getState().projectSettings,
            globalMaterials: parsed.globalMaterials || usePlannerStore.getState().globalMaterials,
            roomData: parsed.roomData || useRoomStore.getState().room,
            roomConfig: parsed.room || parsed.roomConfig || usePlannerStore.getState().room,
            customTemplates: parsed.customTemplates || [],
          };

          const newProject: SavedProject = {
            id: newId,
            name,
            createdAt: parsed.createdAt || now,
            updatedAt: now,
            totalPrice: parsed.totalPrice || 0,
            modulesCount: projectData.modules.length,
            data: projectData,
          };

          set((state) => ({
            projects: [newProject, ...state.projects],
          }));

          return newProject;
        } catch (err) {
          console.error('Ошибка при импорте JSON проекта:', err);
          return null;
        }
      },

      /**
       * 9. Синхронизация с физической папкой projects/ на сервере/диске
       */
      syncFromDisk: async () => {
        try {
          const res = await fetch('/api/projects');
          if (res.ok) {
            const diskProjects = await res.json();
            if (Array.isArray(diskProjects) && diskProjects.length > 0) {
              set((state) => {
                const map = new Map<string, SavedProject>();
                diskProjects.forEach((p: SavedProject) => {
                  if (p && p.id) map.set(p.id, p);
                });
                state.projects.forEach((p) => {
                  if (!map.has(p.id)) {
                    map.set(p.id, p);
                    syncProjectToDisk(p);
                  }
                });
                const merged = Array.from(map.values()).sort(
                  (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
                );
                return { projects: merged };
              });
            } else {
              // Если на диске пока нет файлов, синхронизируем имеющиеся проекты из хранилища на диск
              const { projects } = get();
              for (const p of projects) {
                syncProjectToDisk(p);
              }
            }
          }
        } catch (err) {
          console.warn('Could not sync projects from disk:', err);
        }
      },

      /**
       * 10. Открытие физической папки на диске в Проводнике Windows
       */
      openFolderOnDisk: async () => {
        try {
          await fetch('/api/projects/open-folder', { method: 'POST' });
        } catch (err) {
          console.warn('Could not open folder on disk:', err);
        }
      },
    }),
    {
      name: 'biplaner_saved_projects_folder',
      partialize: (state) => ({
        projects: state.projects,
        currentProjectId: state.currentProjectId,
        currentProjectName: state.currentProjectName,
        lastSavedAt: state.lastSavedAt,
      }),
    }
  )
);
