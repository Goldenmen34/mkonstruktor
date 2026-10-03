import React, { useRef, useEffect, useState } from 'react';
import {
  Boxes,
  Eye,
  Download,
  KeyRound,
  FolderOpen,
  Folder,
  Save,
  DoorOpen,
  Layers,
  Undo2,
  Redo2,
  Scan,
  FilePlus,
  Sliders,
  Crown,
  ChevronDown,
  Check,
  Ruler,
  EyeOff,
  DollarSign,
  Calculator,
  Cpu,
} from 'lucide-react';
import { usePlannerStore } from '../store/usePlannerStore';
import { useLicenseStore } from '../store/useLicenseStore';
import { useMaterialsStore } from '../store/useMaterialsStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { useProjectsStore } from '../store/useProjectsStore';
import { generateQuotationPDF } from '../utils/pdfExport';
import { NewProjectModal } from './NewProjectModal';
import { SaveProjectModal } from './SaveProjectModal';
import { ProjectsListModal } from './ProjectsListModal';

interface HeaderProps {
  onCaptureScreenshot: () => string;
}

export const Header: React.FC<HeaderProps> = ({ onCaptureScreenshot }) => {
  const {
    mode,
    setMode,
    areDoorsOpen,
    toggleDoors,
    viewDisplayMode,
    setViewDisplayMode,
    calculateTotalPrice,
    room,
    modules,
    exportProjectJson,
    importProjectJson,
    openProjectSettings,
    openSmeta,
    openBazisModal,
  } = usePlannerStore();

  const {
    currentProjectName,
    openSaveModal,
    openProjectsListModal,
  } = useProjectsStore();

  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isCabinetDropdownOpen, setIsCabinetDropdownOpen] = useState(false);

  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const viewDropdownRef = useRef<HTMLDivElement>(null);
  const cabinetDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { license, openKeyModal, openKeygen } = useLicenseStore();
  const { openOwnerCabinet } = useMaterialsStore();
  const { undo, redo, canUndo, canRedo } = useHistoryStore();

  // Единое закрытие всех выпадающих списков при клике вне их области
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(target)) {
        setIsProjectDropdownOpen(false);
      }
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(target)) {
        setIsViewDropdownOpen(false);
      }
      if (cabinetDropdownRef.current && !cabinetDropdownRef.current.contains(target)) {
        setIsCabinetDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pricing = calculateTotalPrice();

  // Глобальные горячие клавиши: Undo/Redo, Сохранение (Ctrl+S), Генератор ключей (Ctrl+Shift+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openKeygen();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        openSaveModal();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, openKeygen, openSaveModal]);

  const handleExportPDF = () => {
    const screenshot = onCaptureScreenshot();
    generateQuotationPDF({
      clientName: license.clientName,
      room,
      modules,
      pricing,
      screenshotDataUrl: screenshot,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importProjectJson(content);
        if (success) {
          alert('Проект успешно загружен!');
        } else {
          alert('Ошибка при чтении файла проекта');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-20 shrink-0 select-none">
      {/* Скрытый input для резервного прямого импорта JSON */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* =====================================================================
          ЛЕВАЯ ЧАСТЬ: ЛОГОТИП + ПЛАШКА "ПРОЕКТ"
         ===================================================================== */}
      <div className="flex items-center gap-4">
        {/* Логотип МКонструктор */}
        <div className="flex items-center gap-2.5 select-none cursor-default">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-cyan-500 p-[1.5px] shadow-lg shadow-blue-500/25 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950/85 backdrop-blur-sm rounded-[10px] flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
                <span className="font-black text-sm tracking-tighter bg-gradient-to-r from-blue-400 via-cyan-300 to-white bg-clip-text text-transparent font-mono drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  МК
                </span>
              </div>
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 border border-slate-900 shadow-sm" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="font-black text-[17px] tracking-tight text-white">
                М<span className="bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent font-extrabold">Конструктор</span>
              </span>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-blue-500/20 text-cyan-300 border border-blue-500/30 tracking-wider">
                3D
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">
              Мебельный Конструктор
            </span>
          </div>
        </div>

        {/* 1. Плашка "Проект": Новый проект, Параметры проекта, Папка проектов, Сохранить */}
        <div className="relative" ref={projectDropdownRef}>
          <button
            onClick={() => {
              setIsProjectDropdownOpen((prev) => !prev);
              setIsViewDropdownOpen(false);
              setIsCabinetDropdownOpen(false);
            }}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 ${
              isProjectDropdownOpen
                ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-900/30'
                : 'bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-slate-200 hover:text-white'
            }`}
            title={`Управление проектом. Текущий: ${currentProjectName}`}
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>Проект</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                isProjectDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isProjectDropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-68 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 border-b border-slate-800 mb-1">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Текущий проект
                </div>
                <div className="text-xs font-bold text-white truncate mt-0.5" title={currentProjectName}>
                  {currentProjectName}
                </div>
              </div>

              {/* Новый проект */}
              <button
                onClick={() => {
                  setIsProjectDropdownOpen(false);
                  setIsNewProjectModalOpen(true);
                }}
                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors"
              >
                <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400">
                  <FilePlus className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-[13px] text-white">Новый проект</div>
                  <div className="text-[10px] text-slate-400">Создать с нуля или по шаблону комнаты</div>
                </div>
              </button>

              {/* Параметры проекта */}
              <button
                onClick={() => {
                  setIsProjectDropdownOpen(false);
                  openProjectSettings();
                }}
                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors"
              >
                <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-[13px] text-white">Параметры проекта</div>
                  <div className="text-[10px] text-slate-400">Толщина ДСП, высоты баз, свесы столешницы</div>
                </div>
              </button>

              <div className="border-t border-slate-800 my-1" />

              {/* Папка проектов / Открыть */}
              <button
                onClick={() => {
                  setIsProjectDropdownOpen(false);
                  openProjectsListModal();
                }}
                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors"
              >
                <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                  <FolderOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-[13px] text-white">Папка проектов...</div>
                  <div className="text-[10px] text-slate-400">Каталог всех сохранённых проектов</div>
                </div>
              </button>

              {/* Открыть физическую папку на диске */}
              <button
                onClick={() => {
                  setIsProjectDropdownOpen(false);
                  useProjectsStore.getState().openFolderOnDisk();
                }}
                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors"
              >
                <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
                  <Folder className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-[13px] text-white">Открыть папку на диске</div>
                  <div className="text-[10px] text-slate-400 font-mono">projects\ (каталог на диске)</div>
                </div>
              </button>

              {/* Сохранить проект */}
              <button
                onClick={() => {
                  setIsProjectDropdownOpen(false);
                  openSaveModal();
                }}
                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors"
              >
                <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400">
                  <Save className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-[13px] text-white flex items-center justify-between">
                    <span>Сохранить проект...</span>
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      Ctrl+S
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Переименовать или сохранить копию</div>
                </div>
              </button>

              <div className="h-px bg-slate-800 my-1" />

              {/* Интеграция с Базис-Мебельщик */}
              <button
                onClick={() => {
                  setIsProjectDropdownOpen(false);
                  openBazisModal();
                }}
                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors"
              >
                <div className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-[13px] text-white flex items-center gap-1.5">
                    <span>Базис-Мебельщик...</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      JS / .b3d
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Экспорт на производство и импорт секций</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          ЦЕНТРАЛЬНАЯ ЧАСТЬ: ИСТОРИЯ + ПЛАШКА "ВИД" (3D/2D, РАЗМЕРЫ, ФАСАДЫ)
         ===================================================================== */}
      <div className="flex items-center gap-3">
        {/* Кнопки истории Undo / Redo */}
        <div className="flex items-center gap-0.5 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Шаг назад (Ctrl+Z)"
            className={`p-1.5 px-2 rounded-md transition-all flex items-center gap-1 text-xs font-medium ${
              canUndo
                ? 'text-slate-200 hover:text-white hover:bg-slate-700 active:scale-95'
                : 'text-slate-600 cursor-not-allowed opacity-50'
            }`}
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px]">Назад</span>
          </button>

          <div className="w-px h-4 bg-slate-700 mx-0.5" />

          <button
            onClick={redo}
            disabled={!canRedo}
            title="Шаг вперед (Ctrl+Y)"
            className={`p-1.5 px-2 rounded-md transition-all flex items-center gap-1 text-xs font-medium ${
              canRedo
                ? 'text-slate-200 hover:text-white hover:bg-slate-700 active:scale-95'
                : 'text-slate-600 cursor-not-allowed opacity-50'
            }`}
          >
            <Redo2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px]">Вперед</span>
          </button>
        </div>

        {/* 2. Плашка "Вид": 3D / 2D, Размеры, Контуры, Открыть/Закрыть фасады */}
        <div className="relative" ref={viewDropdownRef}>
          <button
            onClick={() => {
              setIsViewDropdownOpen((prev) => !prev);
              setIsProjectDropdownOpen(false);
              setIsCabinetDropdownOpen(false);
            }}
            title="Режимы отображения сцены: 3D/2D, размеры, контуры, анимация дверей"
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all shadow-sm active:scale-95 ${
              isViewDropdownOpen
                ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-900/30'
                : viewDisplayMode === 'wireframe'
                ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                : 'bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-slate-200 hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4 text-blue-400" />
            <span>Вид</span>
            <span className="hidden sm:inline text-[11px] font-mono px-1.5 py-0.2 rounded bg-slate-900/80 text-blue-300 font-normal">
              {mode === '2D'
                ? '2D План'
                : viewDisplayMode === 'clean'
                ? '3D Без размеров'
                : viewDisplayMode === 'wireframe'
                ? '3D Рентген'
                : '3D С размерами'}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                isViewDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isViewDropdownOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 mt-1.5 w-72 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
                Проекция
              </div>

              {/* 3D Вид */}
              <button
                onClick={() => {
                  setMode('3D');
                  setIsViewDropdownOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors ${
                  mode === '3D'
                    ? 'bg-blue-500/15 text-blue-300 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${mode === '3D' ? 'bg-blue-500/25 text-blue-400' : 'bg-slate-800 text-slate-400'}`}>
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-[13px]">3D Вид</div>
                    <div className="text-[10px] text-slate-400">Перспективный трёхмерный вид кухни</div>
                  </div>
                </div>
                {mode === '3D' && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
              </button>

              {/* 2D План */}
              <button
                onClick={() => {
                  setMode('2D');
                  setIsViewDropdownOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors ${
                  mode === '2D'
                    ? 'bg-blue-500/15 text-blue-300 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${mode === '2D' ? 'bg-blue-500/25 text-blue-400' : 'bg-slate-800 text-slate-400'}`}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-[13px]">2D План</div>
                    <div className="text-[10px] text-slate-400">Вид сверху, расстановка стен и модулей</div>
                  </div>
                </div>
                {mode === '2D' && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
              </button>

              <div className="border-t border-slate-800 my-1" />
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
                Отображение сцены
              </div>

              {/* Без размеров */}
              <button
                onClick={() => {
                  setViewDisplayMode('clean');
                  setIsViewDropdownOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors ${
                  viewDisplayMode === 'clean'
                    ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${viewDisplayMode === 'clean' ? 'bg-emerald-500/25 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    <EyeOff className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-[13px]">Без размеров</div>
                    <div className="text-[10px] text-slate-400">Чистый вид без плашек над шкафами</div>
                  </div>
                </div>
                {viewDisplayMode === 'clean' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
              </button>

              {/* С размерами */}
              <button
                onClick={() => {
                  setViewDisplayMode('dimensions');
                  setIsViewDropdownOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors ${
                  viewDisplayMode === 'dimensions'
                    ? 'bg-blue-500/15 text-blue-300 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${viewDisplayMode === 'dimensions' ? 'bg-blue-500/25 text-blue-400' : 'bg-slate-800 text-slate-400'}`}>
                    <Ruler className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-[13px]">С размерами</div>
                    <div className="text-[10px] text-slate-400">Габариты и ширина модулей</div>
                  </div>
                </div>
                {viewDisplayMode === 'dimensions' && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
              </button>

              {/* Контуры (Рентген) */}
              <button
                onClick={() => {
                  setViewDisplayMode('wireframe');
                  setIsViewDropdownOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors ${
                  viewDisplayMode === 'wireframe'
                    ? 'bg-sky-500/15 text-sky-300 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${viewDisplayMode === 'wireframe' ? 'bg-sky-500/25 text-sky-400' : 'bg-slate-800 text-slate-400'}`}>
                    <Scan className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-[13px]">Контуры (Рентген)</div>
                    <div className="text-[10px] text-slate-400">Прозрачная мебель, видны розетки и трубы</div>
                  </div>
                </div>
                {viewDisplayMode === 'wireframe' && <Check className="w-4 h-4 text-sky-400 shrink-0" />}
              </button>

              <div className="border-t border-slate-800 my-1" />
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
                Фасады
              </div>

              {/* Открыть/Закрыть фасады */}
              <button
                onClick={() => {
                  toggleDoors();
                  setIsViewDropdownOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-xs flex items-center justify-between text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${areDoorsOpen ? 'bg-amber-500/25 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                    <DoorOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-[13px]">
                      {areDoorsOpen ? 'Закрыть фасады' : 'Открыть фасады'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {areDoorsOpen ? 'Закрыть все створки и ящики' : 'Открыть все створки и выдвинуть ящики'}
                    </div>
                  </div>
                </div>
                {areDoorsOpen && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                    Открыто
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          ПРАВАЯ ЧАСТЬ: ЦЕНА ПРОЕКТА (СМЕТА), PDF, ДОСТУП В КАБИНЕТ
         ===================================================================== */}
      <div className="flex items-center gap-2.5">
        {/* 3. Кнопка "Смета" с ценой проекта */}
        <button
          onClick={openSmeta}
          title="Открыть интерактивную смету и расчет стоимости услуг"
          className="px-3.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 shadow-sm transition-all active:scale-95"
        >
          <Calculator className="w-4 h-4 text-emerald-400" />
          <span>Смета:</span>
          <span className="font-mono text-white text-sm font-bold tracking-tight">
            {pricing.grandTotal.toLocaleString('ru-RU')} ₽
          </span>
        </button>

        {/* Смета в PDF */}
        <button
          onClick={handleExportPDF}
          title="Сформировать коммерческое предложение в PDF"
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Смета в PDF</span>
        </button>

        {/* Кнопка "Базис" */}
        <button
          onClick={openBazisModal}
          title="Интеграция с Базис-Мебельщик: экспорт проекта в .js скрипт и импорт секций .b3d"
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600/30 to-cyan-600/30 hover:from-blue-600/40 hover:to-cyan-600/40 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden md:inline">Базис</span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 font-bold">
            10-12
          </span>
        </button>

        {/* 4. Плашка "Доступ в кабинет" (Кабинет собственника, Лицензия VIP, Ключи) */}
        <div className="relative" ref={cabinetDropdownRef}>
          <button
            onClick={() => {
              setIsCabinetDropdownOpen((prev) => !prev);
              setIsProjectDropdownOpen(false);
              setIsViewDropdownOpen(false);
            }}
            title="Кабинет собственника, лицензия программы и панель ключей"
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 ${
              isCabinetDropdownOpen
                ? 'bg-amber-600 border-amber-500 text-white shadow-md shadow-amber-900/40'
                : 'bg-gradient-to-r from-amber-500/15 to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25 border-amber-500/40 text-amber-300 hover:text-white'
            }`}
          >
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Доступ в кабинет</span>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono font-normal">
              {license.tier === 'demo' ? 'Демо' : !license.expiresAt ? 'VIP' : 'PRO'}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-amber-400/80 transition-transform duration-200 ${
                isCabinetDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isCabinetDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-72 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
                Управление и доступ
              </div>

              {/* Кабинет собственника */}
              <button
                onClick={() => {
                  setIsCabinetDropdownOpen(false);
                  openOwnerCabinet();
                }}
                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors"
              >
                <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-[13px] text-white">Кабинет собственника</div>
                  <div className="text-[10px] text-slate-400">База материалов, текстуры, наценки и цены</div>
                </div>
              </button>

              <div className="border-t border-slate-800 my-1" />

              {/* Лицензия программы */}
              <button
                onClick={() => {
                  setIsCabinetDropdownOpen(false);
                  openKeyModal();
                }}
                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors"
              >
                <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-[13px] text-white flex items-center gap-1.5">
                    Лицензия:
                    <span className="text-amber-300 font-mono">
                      {license.tier === 'demo' ? 'Демо' : !license.expiresAt ? 'VIP (Бессрочно)' : 'PRO'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {license.tier === 'demo'
                      ? `Ограничение: до ${license.maxModules} модулей`
                      : 'Все функции и модули разблокированы'}
                  </div>
                </div>
              </button>

              {/* Генератор ключей */}
              <button
                onClick={() => {
                  setIsCabinetDropdownOpen(false);
                  openKeygen();
                }}
                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors"
              >
                <div className="p-1.5 rounded-lg bg-yellow-500/15 text-yellow-400">
                  <Crown className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-[13px] text-white flex items-center gap-2">
                    <span>Ключи активации</span>
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      Ctrl+Shift+K
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Генератор лицензионных ключей (Владелец)</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно создания нового проекта */}
      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
      />

      {/* Модальное окно сохранения проекта (Ctrl+S / кнопка) */}
      <SaveProjectModal />

      {/* Модальное окно папки проектов / каталога */}
      <ProjectsListModal onOpenNewProject={() => setIsNewProjectModalOpen(true)} />
    </header>
  );
};
