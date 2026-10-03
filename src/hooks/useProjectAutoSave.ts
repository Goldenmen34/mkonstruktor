import { useEffect, useRef } from 'react';
import { usePlannerStore } from '../store/usePlannerStore';
import { useRoomStore } from '../store/useRoomStore';
import { useProjectsStore } from '../store/useProjectsStore';

/**
 * Вспомогательная функция для сериализации актуального состояния сцены
 */
function getSceneSnapshot(): string {
  try {
    const planner = usePlannerStore.getState();
    const room = useRoomStore.getState();
    return JSON.stringify({
      modules: planner.modules,
      projectSettings: planner.projectSettings,
      globalMaterials: planner.globalMaterials,
      roomData: room.room,
      roomConfig: planner.room,
      customTemplates: planner.customTemplates,
    });
  } catch {
    return '';
  }
}

/**
 * Хук фонового автосохранения проекта:
 * - Работает полностью бесшумно в фоне без морганий и без лишних перерисовок интерфейса
 * - Сравнивает снимок состояния и сохраняет только при реальных изменениях
 * - Интервал debounce: 5 секунд после завершения действий дизайнера
 * - Синхронно и гарантированно сохраняет проект при закрытии вкладки / браузера
 */
export function useProjectAutoSave() {
  const modules = usePlannerStore((state) => state.modules);
  const projectSettings = usePlannerStore((state) => state.projectSettings);
  const globalMaterials = usePlannerStore((state) => state.globalMaterials);
  const plannerRoom = usePlannerStore((state) => state.room);
  const roomData = useRoomStore((state) => state.room);

  const {
    currentProjectId,
    createNewProject,
    saveCurrentProject,
  } = useProjectsStore();

  const isInitializedRef = useRef(false);
  const lastSavedSnapshotRef = useRef<string>('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Инициализация при первом старте приложения: синхронизация с диском
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      useProjectsStore
        .getState()
        .syncFromDisk()
        .finally(() => {
          const currentList = useProjectsStore.getState().projects;
          const currentId = useProjectsStore.getState().currentProjectId;

          if (currentList.length === 0) {
            createNewProject();
          } else if (!currentId) {
            useProjectsStore.setState({
              currentProjectId: currentList[0].id,
              currentProjectName: currentList[0].name,
            });
          }
          // Фиксируем исходный снимок, чтобы не считать его "изменением"
          lastSavedSnapshotRef.current = getSceneSnapshot();
        });
    }
  }, [createNewProject]);

  // 2. Фоновое автосохранение при реальных изменениях (5 сек debounce)
  useEffect(() => {
    if (!isInitializedRef.current) return;

    const currentSnapshot = getSceneSnapshot();
    if (!currentSnapshot || currentSnapshot === lastSavedSnapshotRef.current) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const latest = getSceneSnapshot();
      if (latest && latest !== lastSavedSnapshotRef.current) {
        saveCurrentProject({ saveAsNew: false });
        lastSavedSnapshotRef.current = latest;
      }
    }, 5000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [modules, projectSettings, globalMaterials, plannerRoom, roomData, saveCurrentProject]);

  // 3. Гарантированное сохранение при закрытии вкладки или браузера
  useEffect(() => {
    const handleClose = () => {
      const latest = getSceneSnapshot();
      if (latest && latest !== lastSavedSnapshotRef.current) {
        saveCurrentProject({ saveAsNew: false });
        lastSavedSnapshotRef.current = latest;
      }
    };

    window.addEventListener('beforeunload', handleClose);
    window.addEventListener('pagehide', handleClose);

    return () => {
      window.removeEventListener('beforeunload', handleClose);
      window.removeEventListener('pagehide', handleClose);
    };
  }, [saveCurrentProject]);
}
