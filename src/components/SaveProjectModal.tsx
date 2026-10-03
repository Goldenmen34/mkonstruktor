import React, { useState, useEffect } from 'react';
import {
  Save,
  X,
  FilePlus,
  RefreshCw,
  Download,
  Check,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';
import { useProjectsStore, formatProjectDate } from '../store/useProjectsStore';
import { usePlannerStore } from '../store/usePlannerStore';

export const SaveProjectModal: React.FC = () => {
  const {
    isSaveModalOpen,
    closeSaveModal,
    currentProjectId,
    currentProjectName,
    saveCurrentProject,
    exportProjectToJson,
    lastSavedAt,
  } = useProjectsStore();

  const modules = usePlannerStore((state) => state.modules);
  const calculateTotalPrice = usePlannerStore((state) => state.calculateTotalPrice);

  const [projectName, setProjectName] = useState(currentProjectName);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isSaveModalOpen) {
      setProjectName(currentProjectName);
      setSuccessMessage(null);
    }
  }, [isSaveModalOpen, currentProjectName]);

  if (!isSaveModalOpen) return null;

  const pricing = calculateTotalPrice();

  const handleOverwrite = () => {
    const trimmed = projectName.trim() || currentProjectName;
    saveCurrentProject({ newName: trimmed, saveAsNew: false });
    setSuccessMessage(`Проект «${trimmed}» успешно обновлён!`);
    setTimeout(() => {
      closeSaveModal();
    }, 900);
  };

  const handleSaveAsNew = () => {
    const trimmed = projectName.trim() || `${currentProjectName} (Новый)`;
    saveCurrentProject({ newName: trimmed, saveAsNew: true });
    setSuccessMessage(`Создан новый проект «${trimmed}» в папке проектов!`);
    setTimeout(() => {
      closeSaveModal();
    }, 900);
  };

  const handleExportDisk = () => {
    if (!currentProjectId) {
      handleOverwrite();
    }
    const jsonStr = exportProjectToJson(currentProjectId || '');
    if (!jsonStr) return;

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(projectName.trim() || currentProjectName).replace(/[/\\?%*:|"<>]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0E131F] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-slate-200 font-sans">
        {/* Заголовок */}
        <div className="px-6 py-4 border-b border-slate-800 bg-[#0A0D14]/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
              <Save className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Сохранение проекта
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Управление сохранением в локальной папке «Проекты»
              </p>
            </div>
          </div>

          <button
            onClick={closeSaveModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Тело модального окна */}
        <div className="p-6 space-y-5">
          {successMessage ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto animate-in zoom-in">
                <Check className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-white">{successMessage}</div>
              <div className="text-xs text-slate-400">Проект сохранён в папке «Проекты»</div>
            </div>
          ) : (
            <>
              {/* Поле ввода названия проекта */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Название проекта:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Например: ЖК Ривьера, кв. 42 (Кухня для Анны)"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl text-sm font-medium text-white placeholder-slate-500 outline-none transition-all shadow-inner"
                    autoFocus
                  />
                </div>
              </div>

              {/* Карточка текущей сводки */}
              <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-slate-400 text-[11px]">Модулей</div>
                  <div className="font-bold text-white mt-0.5">{modules.length} шт.</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">Смета кухни</div>
                  <div className="font-bold text-emerald-400 mt-0.5 font-mono">
                    {pricing.grandTotal.toLocaleString('ru-RU')} ₽
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">Автосохранение</div>
                  <div className="font-semibold text-blue-300 mt-0.5 text-[11px]">
                    {lastSavedAt ? formatProjectDate(lastSavedAt).split(' ')[1] : 'активно'}
                  </div>
                </div>
              </div>

              {/* Варианты сохранения */}
              <div className="space-y-2.5 pt-1">
                {/* 1. Обновить текущий проект */}
                <button
                  type="button"
                  onClick={handleOverwrite}
                  className="w-full p-3.5 rounded-xl border border-blue-500/40 bg-blue-600/15 hover:bg-blue-600/25 text-left flex items-start gap-3 transition-all group active:scale-[0.99]"
                >
                  <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors shrink-0 mt-0.5">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-white flex items-center justify-between">
                      <span>Обновить текущий проект</span>
                      <span className="text-[10px] text-blue-300 font-normal">Перезапись</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Перезапишет последние изменения в проекте <strong>«{currentProjectName}»</strong>
                    </div>
                  </div>
                </button>

                {/* 2. Сохранить как отдельный новый проект */}
                <button
                  type="button"
                  onClick={handleSaveAsNew}
                  className="w-full p-3.5 rounded-xl border border-slate-700 bg-slate-850 hover:bg-slate-800 text-left flex items-start gap-3 transition-all group active:scale-[0.99]"
                >
                  <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors shrink-0 mt-0.5">
                    <FilePlus className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-white flex items-center justify-between">
                      <span>Сохранить как новый проект</span>
                      <span className="text-[10px] text-emerald-400 font-normal">+ Создать копию</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Создаст отдельную запись в папке проектов. Прежний проект останется без изменений
                    </div>
                  </div>
                </button>
              </div>

              {/* Разделитель и кнопка экспорта на диск */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleExportDisk}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors py-1 px-2 rounded-lg hover:bg-slate-800"
                  title="Скачать файл .json на компьютер или флешку"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Скачать файл на диск (.json)</span>
                </button>

                <button
                  type="button"
                  onClick={closeSaveModal}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Отмена
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
