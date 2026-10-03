import React, { useState, useRef } from 'react';
import {
  FolderOpen,
  X,
  Search,
  Plus,
  Download,
  Upload,
  Copy,
  Trash2,
  Edit2,
  Check,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useProjectsStore, formatProjectDate, SavedProject } from '../store/useProjectsStore';
import { usePlannerStore } from '../store/usePlannerStore';

interface ProjectsListModalProps {
  onOpenNewProject: () => void;
}

export const ProjectsListModal: React.FC<ProjectsListModalProps> = ({ onOpenNewProject }) => {
  const {
    projects,
    currentProjectId,
    isProjectsListModalOpen,
    closeProjectsListModal,
    loadProject,
    deleteProject,
    renameProject,
    duplicateProject,
    exportProjectToJson,
    importProjectFromJson,
    openFolderOnDisk,
  } = useProjectsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<SavedProject | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isProjectsListModalOpen) return null;

  const filteredProjects = projects.filter((p) => {
    if (!searchQuery.trim()) return true;
    return p.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

  const handleStartRename = (proj: SavedProject, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(proj.id);
    setEditingName(proj.name);
  };

  const handleSaveRename = (id: string) => {
    if (editingName.trim()) {
      renameProject(id, editingName.trim());
    }
    setEditingId(null);
  };

  const handleLoad = (id: string) => {
    const ok = loadProject(id);
    if (ok) {
      closeProjectsListModal();
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const imported = importProjectFromJson(text);
        if (imported) {
          handleLoad(imported.id);
        } else {
          alert('Не удалось распознать формат файла проекта.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExport = (proj: SavedProject, e: React.MouseEvent) => {
    e.stopPropagation();
    const jsonStr = exportProjectToJson(proj.id);
    if (!jsonStr) return;

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${proj.name.replace(/[/\\?%*:|"<>]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-[#0A0D14] border border-[#1E2536] rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col text-slate-200 font-sans">
        {/* Скрытый input для импорта JSON */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileImport}
          accept=".json"
          className="hidden"
        />

        {/* Шапка модального окна */}
        <div className="px-6 py-4 border-b border-[#1E2536] bg-[#0E131F]/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.2)]">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Папка проектов
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono border border-slate-700">
                  {projects.length}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Локальный каталог всех сохранённых проектов кухни
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                closeProjectsListModal();
                onOpenNewProject();
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Новый проект</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95"
              title="Загрузить сохранённый файл .json с компьютера"
            >
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Импорт .json</span>
            </button>

            <button
              onClick={closeProjectsListModal}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
              title="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Поиск */}
        <div className="p-4 border-b border-[#1E2536] bg-[#0E131F]/40 flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск проекта по названию..."
              className="w-full pl-10 pr-4 py-2 bg-[#121826] border border-[#1E283D] focus:border-blue-500/70 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Список проектов */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 custom-scrollbar">
          {filteredProjects.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-500 mx-auto">
                <FolderOpen className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-slate-400">
                {searchQuery ? 'Проекты по вашему запросу не найдены' : 'В папке пока нет сохранённых проектов'}
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Нажмите «Новый проект» или импортируйте готовый файл .json, чтобы начать работу.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredProjects.map((proj) => {
                const isCurrent = currentProjectId === proj.id;
                const isEditing = editingId === proj.id;
                const modulesCount = proj.modulesCount ?? proj.data?.modules?.length ?? 0;
                const price = proj.totalPrice ?? 0;

                return (
                  <div
                    key={proj.id}
                    onClick={() => handleLoad(proj.id)}
                    className={`group relative p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                      isCurrent
                        ? 'bg-blue-950/30 border-blue-500/70 shadow-lg shadow-blue-950/50 ring-1 ring-blue-500/30'
                        : 'bg-[#0E131F]/70 border-[#1E2536] hover:bg-[#121826] hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {/* Верхняя строка: Название и бейдж активного */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        {isEditing ? (
                          <div
                            className="flex items-center gap-1.5 flex-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(proj.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              className="px-2 py-1 bg-slate-900 border border-blue-500 rounded text-xs text-white outline-none w-full"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveRename(proj.id)}
                              className="p-1 rounded bg-blue-600 text-white hover:bg-blue-500"
                              title="Сохранить имя"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3
                                className="font-bold text-sm text-white group-hover:text-blue-300 transition-colors truncate"
                                title={proj.name}
                              >
                                {proj.name}
                              </h3>
                              <button
                                onClick={(e) => handleStartRename(proj, e)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-white text-slate-500 transition-opacity"
                                title="Переименовать"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}

                        {isCurrent && (
                          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/40 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                            Открыт
                          </span>
                        )}
                      </div>

                      {/* Мета-информация */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-2">
                        <span className="flex items-center gap-1 text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {formatProjectDate(proj.updatedAt)}
                        </span>

                        <span className="flex items-center gap-1 text-[11px]">
                          <Layers className="w-3.5 h-3.5 text-slate-500" />
                          {modulesCount} модулей
                        </span>

                        {price > 0 && (
                          <span className="font-mono font-bold text-emerald-400 text-xs ml-auto">
                            {price.toLocaleString('ru-RU')} ₽
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Нижняя панель действий */}
                    <div className="pt-3 mt-3 border-t border-[#1E2536] flex items-center justify-between">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoad(proj.id);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-semibold transition-all flex items-center gap-1"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Открыть</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateProject(proj.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                          title="Создать копию проекта"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={(e) => handleExport(proj, e)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                          title="Скачать файл проекта (.json)"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToDelete(proj);
                          }}
                          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Удалить проект"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Нижняя информационная строка с путем к физической папке */}
        <div className="px-6 py-3 border-t border-[#1E2536] bg-[#0E131F]/95 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-slate-500 font-medium">Физическая папка на компьютере:</span>
            <code className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-blue-400 font-mono text-[11px] select-all">
              projects\
            </code>
          </div>
          <button
            onClick={() => openFolderOnDisk()}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white font-medium flex items-center gap-1.5 transition-colors shadow-sm active:scale-95"
            title="Открыть папку проектов в Проводнике Windows"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>Открыть в Проводнике Windows</span>
          </button>
        </div>

        {/* Модальное окно подтверждения удаления */}
        {projectToDelete && (
          <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-[#121826] border border-rose-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 text-center shadow-2xl animate-in zoom-in-95">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Удалить проект?</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Вы действительно хотите удалить проект <strong>«{projectToDelete.name}»</strong>? Это действие нельзя отменить.
                </p>
              </div>
              <div className="flex gap-2 justify-center pt-1">
                <button
                  onClick={() => setProjectToDelete(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    deleteProject(projectToDelete.id);
                    setProjectToDelete(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors"
                >
                  Да, удалить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
