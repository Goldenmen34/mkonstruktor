import React, { useState } from 'react';
import {
  X,
  FileCode,
  Download,
  Copy,
  Check,
  Upload,
  Cpu,
  Layers,
  Settings,
  AlertCircle,
  HelpCircle,
  PlusCircle,
  FileSpreadsheet,
  PackageCheck,
  CheckCircle2,
} from 'lucide-react';
import { usePlannerStore } from '../store/usePlannerStore';
import {
  generateBazisScript,
  generateBazisCutList,
  formatBazisCutListCsv,
  downloadTextFile,
  BazisExportOptions,
  DEFAULT_BAZIS_OPTIONS,
} from '../utils/bazisExporter';
import { parseBazisB3D, ParsedBazisResult } from '../utils/bazisImporter';

export const BazisIntegrationModal: React.FC = () => {
  const {
    isBazisModalOpen,
    closeBazisModal,
    modules,
    room,
    addModule,
    saveCustomSection,
  } = usePlannerStore();

  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // Параметры экспорта
  const [exportOptions, setExportOptions] = useState<BazisExportOptions>(DEFAULT_BAZIS_OPTIONS);
  const [isCopied, setIsCopied] = useState(false);
  const [showCodePreview, setShowCodePreview] = useState(false);

  // Состояние импорта
  const [isParsing, setIsParsing] = useState(false);
  const [importResult, setImportResult] = useState<ParsedBazisResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importNotification, setImportNotification] = useState<string | null>(null);

  if (!isBazisModalOpen) return null;

  // Расчет деталей для экспорта
  const cutListParts = generateBazisCutList(modules, exportOptions);
  const totalPartsCount = cutListParts.reduce((acc, p) => acc + p.count, 0);

  // Обработчик скачивания JS-скрипта
  const handleDownloadScript = () => {
    const scriptCode = generateBazisScript(modules, room, exportOptions);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Проект_Базис_${dateStr}.js`;
    downloadTextFile(scriptCode, fileName, 'application/javascript;charset=utf-8');
  };

  // Обработчик скачивания CSV раскроя
  const handleDownloadCutList = () => {
    const csvContent = formatBazisCutListCsv(cutListParts);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Раскрой_Базис_${dateStr}.csv`;
    downloadTextFile(csvContent, fileName, 'text/csv;charset=utf-8');
  };

  // Копирование кода скрипта
  const handleCopyCode = () => {
    const scriptCode = generateBazisScript(modules, room, exportOptions);
    navigator.clipboard.writeText(scriptCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Обработка загруженного файла Базиса
  const handleFileProcess = async (file: File) => {
    setIsParsing(true);
    setImportResult(null);
    setImportNotification(null);
    try {
      const res = await parseBazisB3D(file);
      setImportResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsParsing(false);
    }
  };

  // Загрузка встроенного тестового примера (Токарева ванная.b3d)
  const handleLoadSample = async () => {
    setIsParsing(true);
    setImportResult(null);
    setImportNotification(null);
    try {
      const res = await fetch('/api/bazis/sample');
      if (!res.ok) throw new Error('Не удалось загрузить пример из папки');
      const buf = await res.arrayBuffer();
      const parsed = await parseBazisB3D(buf, 'Токарева ванная.b3d');
      setImportResult(parsed);
    } catch (err) {
      console.error(err);
      alert('Ошибка загрузки примера: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsParsing(false);
    }
  };

  // Добавить импортированный модуль на 3D сцену
  const handleAddToScene = () => {
    if (!importResult?.template) return;
    const added = addModule(importResult.template, undefined, importResult.dimensions);
    if (added) {
      setImportNotification(`Секция «${importResult.modelName}» успешно добавлена на сцену!`);
      setTimeout(() => setImportNotification(null), 3500);
    }
  };

  // Сохранить импортированный модуль в каталог
  const handleSaveToCatalog = () => {
    if (!importResult?.template) return;
    saveCustomSection(importResult.template);
    setImportNotification(`Секция «${importResult.modelName}» сохранена в «Мои секции» (Каталог)!`);
    setTimeout(() => setImportNotification(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Шапка модального окна */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-cyan-500/30 text-cyan-400 shadow-inner">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Интеграция с Базис-Мебельщик
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase">
                  Базис 10 / 11 / 12
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Двусторонний обмен: экспорт проекта на производство и импорт готовых секций (.b3d / .fr3)
              </p>
            </div>
          </div>

          <button
            onClick={closeBazisModal}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Вкладки навигации */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 pt-2 gap-3">
          <button
            onClick={() => setActiveTab('export')}
            className={`pb-3 px-3 font-semibold text-xs flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'export'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Экспорт в Базис (на производство)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400">
              {modules.length} мод.
            </span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`pb-3 px-3 font-semibold text-xs flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'import'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Импорт секций из Базиса (.b3d / .fr3)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Zero-Install
            </span>
          </button>
        </div>

        {/* Тело модального окна */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'export' ? (
            /* =============================================================
               ВКЛАДКА ЭКСПОРТА
               ============================================================= */
            <div className="space-y-5">
              {/* Сводная плашка проекта */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/15 text-blue-400">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Модулей на 3D сцене</div>
                    <div className="text-base font-bold text-white">{modules.length} шт.</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Деталей для раскроя</div>
                    <div className="text-base font-bold text-white">{totalPartsCount} шт.</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/15 text-purple-400">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Формат модели</div>
                    <div className="text-base font-bold text-white">Параметрический JS</div>
                  </div>
                </div>
              </div>

              {/* Настройки параметров Базиса */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                  <Settings className="w-4 h-4 text-cyan-400" />
                  <span>Параметры генерации для Базис-Мебельщик</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {/* ЛДСП Корпус */}
                  <div>
                    <label className="block text-slate-400 mb-1">Толщина ЛДСП корпуса:</label>
                    <select
                      value={exportOptions.ldspThickness}
                      onChange={(e) =>
                        setExportOptions((prev) => ({
                          ...prev,
                          ldspThickness: Number(e.target.value) as 16 | 18,
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:border-cyan-500 focus:outline-none"
                    >
                      <option value={16}>16 мм (Стандарт РФ)</option>
                      <option value={18}>18 мм (Евро-стандарт / Egger)</option>
                    </select>
                  </div>

                  {/* Фасады */}
                  <div>
                    <label className="block text-slate-400 mb-1">Толщина фасадов МДФ:</label>
                    <select
                      value={exportOptions.facadeThickness}
                      onChange={(e) =>
                        setExportOptions((prev) => ({
                          ...prev,
                          facadeThickness: Number(e.target.value) as 16 | 19 | 22,
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:border-cyan-500 focus:outline-none"
                    >
                      <option value={16}>16 мм (ЛДСП / Тонкий МДФ)</option>
                      <option value={19}>19 мм (Стандартный МДФ эмаль/пленка)</option>
                      <option value={22}>22 мм (Премиум МДФ)</option>
                    </select>
                  </div>

                  {/* Зазор между фасадами */}
                  <div>
                    <label className="block text-slate-400 mb-1">Зазор между фасадами:</label>
                    <select
                      value={exportOptions.facadeGap}
                      onChange={(e) =>
                        setExportOptions((prev) => ({
                          ...prev,
                          facadeGap: Number(e.target.value),
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:border-cyan-500 focus:outline-none"
                    >
                      <option value={2}>2 мм (Плотный зазор)</option>
                      <option value={2.5}>2.5 мм (Оптимальный)</option>
                      <option value={3}>3 мм (Стандартный)</option>
                      <option value={4}>4 мм (Для Gola / без ручек)</option>
                    </select>
                  </div>

                  {/* Лицевая кромка */}
                  <div>
                    <label className="block text-slate-400 mb-1">Лицевая кромка корпуса:</label>
                    <select
                      value={exportOptions.frontEdgeThickness}
                      onChange={(e) =>
                        setExportOptions((prev) => ({
                          ...prev,
                          frontEdgeThickness: Number(e.target.value) as 1.0 | 2.0,
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:border-cyan-500 focus:outline-none"
                    >
                      <option value={1.0}>1.0 мм (ПВХ тонкая)</option>
                      <option value={2.0}>2.0 мм (ПВХ ударопрочная)</option>
                    </select>
                  </div>
                </div>

                {/* Чекбоксы */}
                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeCountertop}
                      onChange={(e) =>
                        setExportOptions((prev) => ({ ...prev, includeCountertop: e.target.checked }))
                      }
                      className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                    />
                    <span>Включать столешницу со свесом 40 мм</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={exportOptions.includePlinth}
                      onChange={(e) =>
                        setExportOptions((prev) => ({ ...prev, includePlinth: e.target.checked }))
                      }
                      className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                    />
                    <span>Включать цокольные планки 100 мм</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeDrawersBoxes}
                      onChange={(e) =>
                        setExportOptions((prev) => ({ ...prev, includeDrawersBoxes: e.target.checked }))
                      }
                      className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                    />
                    <span>Строить внутренние короба ящиков</span>
                  </label>
                </div>
              </div>

              {/* Кнопки экспорта */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleDownloadScript}
                  disabled={modules.length === 0}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  <span>Скачать скрипт Базис-Мебельщик (.js)</span>
                </button>

                <button
                  onClick={handleDownloadCutList}
                  disabled={modules.length === 0}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Спецификация для Базис-Раскрой (.csv)</span>
                </button>

                <button
                  onClick={handleCopyCode}
                  disabled={modules.length === 0}
                  className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs flex items-center gap-1.5 active:scale-95 transition-all"
                  title="Скопировать исходный JS-код в буфер обмена"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{isCopied ? 'Скопировано!' : 'Копировать код'}</span>
                </button>

                <button
                  onClick={() => setShowCodePreview((prev) => !prev)}
                  className="ml-auto text-xs text-slate-400 hover:text-cyan-400 underline underline-offset-4"
                >
                  {showCodePreview ? 'Скрыть код' : 'Показать предпросмотр кода'}
                </button>
              </div>

              {/* Инструкция запуска в Базисе */}
              <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-cyan-300">
                  <HelpCircle className="w-4 h-4 shrink-0" />
                  <span>Инструкция: как открыть сгенерированный проект в Базис-Мебельщик</span>
                </div>
                <ol className="list-decimal list-inside text-slate-300 space-y-1 pl-1">
                  <li>Запустите программу <b>Базис-Мебельщик</b> на компьютере.</li>
                  <li>В верхнем меню выберите: <b>«Скрипты» → «Выполнить скрипт...»</b> (или нажмите горячие клавиши <code className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-cyan-300 font-mono">Ctrl + F12</code>).</li>
                  <li>Выберите скачанный файл <code className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-cyan-300 font-mono">.js</code> — Базис автоматически построит 3D-модель со всеми панелями и толщинами!</li>
                </ol>
              </div>

              {/* Предпросмотр сгенерированного скрипта */}
              {showCodePreview && (
                <div className="space-y-1 animate-in fade-in">
                  <div className="text-[11px] font-mono text-slate-400">Предпросмотр кода скрипта (первые 40 строк):</div>
                  <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-cyan-300 font-mono overflow-x-auto max-h-56">
                    {generateBazisScript(modules, room, exportOptions).split('\n').slice(0, 45).join('\n')}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            /* =============================================================
               ВКЛАДКА ИМПОРТА
               ============================================================= */
            <div className="space-y-5">
              {/* Зона Drag & Drop */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileProcess(file);
                }}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${
                  isDragging
                    ? 'border-cyan-400 bg-cyan-950/20'
                    : 'border-slate-700 hover:border-slate-500 bg-slate-950/40'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="font-bold text-sm text-white mb-1">
                  Перетащите сюда файл модели Базиса (.b3d) или фрагмента (.fr3)
                </div>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                  МКонструктор напрямую читает файлы Базиса в браузере, извлекает встроенный 3D-эскиз, панели, материалы и фурнитуру
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <label className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs cursor-pointer shadow-lg shadow-cyan-600/20 active:scale-95 transition-all">
                    <span>Выбрать файл на диске...</span>
                    <input
                      type="file"
                      accept=".b3d,.fr3"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileProcess(file);
                      }}
                    />
                  </label>

                  <button
                    onClick={handleLoadSample}
                    disabled={isParsing}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <span>⚡ Загрузить пример (Токарева ванная.b3d)</span>
                  </button>
                </div>
              </div>

              {/* Состояние загрузки */}
              {isParsing && (
                <div className="p-8 text-center space-y-2">
                  <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <div className="text-xs font-medium text-slate-300">
                    Распаковка zlib-потоков и извлечение данных Базиса...
                  </div>
                </div>
              )}

              {/* Уведомление о действии */}
              {importNotification && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{importNotification}</span>
                </div>
              )}

              {/* Результат парсинга файла Базиса */}
              {importResult && importResult.success && (
                <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4 animate-in fade-in zoom-in-95">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {/* Превью (Thumbnail из Базиса) */}
                    <div className="w-28 h-28 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center relative shadow-lg">
                      {importResult.thumbnailUrl ? (
                        <img
                          src={importResult.thumbnailUrl}
                          alt={importResult.modelName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-slate-600 text-[10px] text-center p-2">
                          Нет встроенного превью
                        </div>
                      )}
                      <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-cyan-300">
                        PNG
                      </div>
                    </div>

                    {/* Информация о секции */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-extrabold text-base text-white">
                          {importResult.modelName}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          {importResult.dimensions.width} × {importResult.dimensions.height} × {importResult.dimensions.depth} мм
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-300">
                        <div>
                          <span className="text-slate-500">Материал корпуса: </span>
                          <span className="font-medium text-slate-200">{importResult.carcassMaterialName}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Материал фасада: </span>
                          <span className="font-medium text-slate-200">{importResult.facadeMaterialName}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Найдено панелей: </span>
                          <span className="font-medium text-slate-200">{importResult.parts.length} типов</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Фурнитура: </span>
                          <span className="font-medium text-slate-200">{importResult.hardwareList.length} типов</span>
                        </div>
                      </div>

                      {/* Кромки */}
                      {importResult.edgesList.length > 0 && (
                        <div className="text-[11px] text-slate-400 pt-0.5">
                          <span className="text-slate-500">Кромка: </span>
                          {importResult.edgesList.slice(0, 3).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Кнопки действий с импортированным модулем */}
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800">
                    <button
                      onClick={handleAddToScene}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/20 active:scale-95 transition-all"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Добавить на 3D сцену прямо сейчас</span>
                    </button>

                    <button
                      onClick={handleSaveToCatalog}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 active:scale-95 transition-all"
                    >
                      <PackageCheck className="w-4 h-4 text-emerald-400" />
                      <span>Сохранить в каталог («Мои секции»)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Ошибка парсинга */}
              {importResult && !importResult.success && (
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 text-xs text-rose-300 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                  <div>
                    <div className="font-bold">Не удалось распознать структуру файла Базиса</div>
                    <div className="text-rose-400/80 mt-0.5">{importResult.error}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Подвал модального окна */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Двусторонняя интеграция активна • Базис 10, 11, 12</span>
          </div>

          <button
            onClick={closeBazisModal}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
