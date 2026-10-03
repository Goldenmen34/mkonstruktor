import React, { useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Viewport } from './components/Viewport';
import { LicenseModal } from './components/LicenseModal';
import { KeyGeneratorModal } from './components/KeyGeneratorModal';
import { ProjectSettingsModal } from './components/ProjectSettingsModal';
import { ModuleExplodeModal } from './components/ModuleExplodeModal';
import { SectionEditorModal } from './components/SectionEditorModal';
import { OwnerCabinetModal } from './components/owner/OwnerCabinetModal';
import { SmetaModal } from './components/SmetaModal';
import { BazisIntegrationModal } from './components/BazisIntegrationModal';
import { SceneManager } from './core/3d/SceneManager';
import { usePlannerStore } from './store/usePlannerStore';
import { CATALOG_ITEMS } from './data/catalog';
import { useProjectAutoSave } from './hooks/useProjectAutoSave';

export const App: React.FC = () => {
  useProjectAutoSave();

  const sceneManagerRef = useRef<SceneManager | null>(null);
  const hasInitializedRef = useRef(false);
  const { modules, addModule } = usePlannerStore();

  // Инициализация стартовой кухни только при первом чистом запуске (если проект пуст)
  useEffect(() => {
    const currentModules = usePlannerStore.getState().modules;
    if (!currentModules || currentModules.length === 0) {
      const cornerUnit = CATALOG_ITEMS.find((c) => c.id === 'k_base_corner_blind');
      const drawerUnit = CATALOG_ITEMS.find((c) => c.id === 'k_base_3drawers');
      const doorUnit = CATALOG_ITEMS.find((c) => c.id === 'k_base_1door');

      if (cornerUnit) addModule(cornerUnit);
      if (drawerUnit) addModule(drawerUnit);
      if (doorUnit) addModule(doorUnit);
    }
  }, []);

  const handleCaptureScreenshot = (): string => {
    if (sceneManagerRef.current) {
      return sceneManagerRef.current.captureScreenshot();
    }
    return '';
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Header onCaptureScreenshot={handleCaptureScreenshot} />

      <main className="flex-1 flex overflow-hidden relative">
        <Sidebar />
        <Viewport sceneManagerRef={sceneManagerRef} />
      </main>

      <LicenseModal />
      <KeyGeneratorModal />
      <ProjectSettingsModal />
      <ModuleExplodeModal />
      <SectionEditorModal />
      <OwnerCabinetModal />
      <SmetaModal onCaptureScreenshot={handleCaptureScreenshot} />
      <BazisIntegrationModal />
    </div>
  );
};

export default App;
