import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FolderUp,
  X,
  Search,
  Check,
  Folder,
  FolderOpen,
  Sparkles,
  Layers,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckSquare,
  Square,
  ArrowRight,
  RefreshCw,
  Sliders,
  ShieldAlert,
} from 'lucide-react';
import { useMaterialsStore } from '../../store/useMaterialsStore';
import { MaterialSection, PriceUnit, SECTION_LABELS, UNIT_LABELS } from '../../types/ownerMaterials';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ScannedItem {
  id: string;
  fileName: string;
  cleanName: string;
  article: string;
  textureCode: string;
  category: string;
  fullPath: string;
  size: number;
  roughness: number;
  metalness: number;
  color?: string;
  previewUrl?: string;
}

interface PresetFolder {
  name: string;
  path: string;
  fileCount: number;
}

export const BatchImportMaterialsModal: React.FC<BatchImportModalProps> = ({ isOpen, onClose }) => {
  const { batchImportMaterials } = useMaterialsStore();

  // Состояния шагов и пресетов
  const [presets, setPresets] = useState<PresetFolder[]>([]);
  const [folderPath, setFolderPath] = useState<string>('C:\\Users\\User\\Documents\\Bazis11\\Текстуры\\EGGER');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Результаты сканирования
  const [brand, setBrand] = useState<string>('EGGER');
  const [scannedCategories, setScannedCategories] = useState<string[]>([]);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Фильтрация и поиск при предпросмотре
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Настройки ценообразования и разделов
  const [selectedSections, setSelectedSections] = useState<MaterialSection[]>(['ldsp', 'facade']);
  const [costPrice, setCostPrice] = useState<number>(3800);
  const [markupMultiplier, setMarkupMultiplier] = useState<number>(1.8);
  const [unit, setUnit] = useState<PriceUnit>('sheet');

  // Процесс импорта
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSuccess, setImportSuccess] = useState<{ count: number; brand: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Загружаем автоопределенные пресеты Базиса при открытии
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/materials/check-presets')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.presets)) {
          setPresets(data.presets);
          const eggerPreset = data.presets.find((p: PresetFolder) => p.name.toUpperCase() === 'EGGER');
          if (eggerPreset) {
            setFolderPath(eggerPreset.path);
          }
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Запуск сканирования папки
  const handleScan = async (pathToScan?: string) => {
    const targetPath = (pathToScan || folderPath).trim();
    if (!targetPath) return;

    setIsScanning(true);
    setScanError(null);
    setImportSuccess(null);

    try {
      const res = await fetch('/api/materials/scan-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: targetPath }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось просканировать указанную папку');
      }

      setBrand(data.brand || 'EGGER');
      setScannedCategories(data.categories || []);
      setScannedItems(data.items || []);
      // По умолчанию выбираем все найденные декоры
      setSelectedIds(new Set(data.items.map((it: ScannedItem) => it.id)));
      setActiveCategory('all');
    } catch (err: any) {
      setScanError(err.message || 'Ошибка доступа к папке');
      setScannedItems([]);
      setSelectedIds(new Set());
    } finally {
      setIsScanning(false);
    }
  };

  // Выбор пресета в 1 клик
  const handleSelectPreset = (preset: PresetFolder) => {
    setFolderPath(preset.path);
    handleScan(preset.path);
  };

  // Переключение выбора одного декора
  const toggleItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Выбрать все / снять выделение
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      const next = new Set(selectedIds);
      filteredItems.forEach((it) => next.delete(it.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filteredItems.forEach((it) => next.add(it.id));
      setSelectedIds(next);
    }
  };

  // Переключение раздела назначения (Корпус, Фасады и т.д.)
  const toggleSection = (section: MaterialSection) => {
    if (selectedSections.includes(section)) {
      if (selectedSections.length > 1) {
        setSelectedSections(selectedSections.filter((s) => s !== section));
      }
    } else {
      setSelectedSections([...selectedSections, section]);
    }
  };

  // Фильтрованные декоры по поиску и подкатегории
  const filteredItems = useMemo(() => {
    return scannedItems.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          item.cleanName.toLowerCase().includes(q) ||
          item.article.toLowerCase().includes(q) ||
          item.fileName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [scannedItems, activeCategory, searchQuery]);

  // Запуск физического импорта и сохранения в базу
  const handleExecuteImport = async () => {
    const itemsToImport = scannedItems.filter((it) => selectedIds.has(it.id));
    if (itemsToImport.length === 0) {
      alert('Пожалуйста, выберите хотя бы один декор для импорта.');
      return;
    }
    if (selectedSections.length === 0) {
      alert('Выберите хотя бы один раздел (Корпус, Фасады и т.д.).');
      return;
    }

    setIsImporting(true);

    try {
      const res = await fetch('/api/materials/import-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath,
          brand: brand.trim() || 'EGGER',
          sections: selectedSections,
          costPrice: Number(costPrice) || 3800,
          markupMultiplier: Number(markupMultiplier) || 1.8,
          unit,
          selectedItems: itemsToImport,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при импорте файлов');
      }

      // Добавляем новые материалы в Zustand store
      batchImportMaterials({
        brand: data.brand || brand,
        sections: selectedSections,
        categories: scannedCategories,
        items: data.items,
      });

      setImportSuccess({
        count: itemsToImport.length,
        brand: data.brand || brand,
      });
    } catch (err: any) {
      alert(`Ошибка при сохранении: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-[#0A0D14] border border-[#1E2536] rounded-2xl w-full max-w-5xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col text-slate-200 font-sans">
        {/* Шапка модального окна */}
        <div className="px-6 py-4 border-b border-[#1E2536] bg-[#0E131F]/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
              <FolderUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Массовый импорт декоров
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40">
                  Базис-Мебельщик / Текстуры
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Автоматическое считывание папок, распознавание артикулов и интеграция в базу
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Тело модального окна */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {importSuccess ? (
            /* Сообщение об успешном импорте */
            <div className="py-12 text-center space-y-4 max-w-md mx-auto animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                <Check className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Импорт успешно завершён!
                </h3>
                <p className="text-xs text-slate-300 mt-1.5">
                  В базу добавлено <strong>{importSuccess.count}</strong> декоров бренда{' '}
                  <strong>«{importSuccess.brand}»</strong>. Текстуры скопированы и сразу доступны дизайнеру в каскадном меню и 3D-сцене.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-900/30 transition-all active:scale-95"
                >
                  Перейти к материалам
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ===================================================================
                  ШАГ 1: ВЫБОР ПАПКИ-ИСТОЧНИКА
                 =================================================================== */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <span>1. Выбор папки с декорами</span>
                  </div>
                </div>

                {/* Быстрые пресеты из Базис11 */}
                {presets.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-slate-400 font-medium">
                      Обнаруженные папки Базис-Мебельщик на вашем компьютере:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {presets.map((p) => {
                        const isSelected = folderPath.toLowerCase() === p.path.toLowerCase();
                        return (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() => handleSelectPreset(p)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all ${
                              isSelected
                                ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold shadow-sm'
                                : 'bg-[#121826] hover:bg-[#1A2234] border-slate-700/80 text-slate-300 hover:text-white'
                            }`}
                          >
                            <Folder className="w-3.5 h-3.5 text-amber-400" />
                            <span>{p.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                              {p.fileCount} шт.
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Поле ручного ввода пути */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={folderPath}
                      onChange={(e) => setFolderPath(e.target.value)}
                      placeholder="Например: C:\Users\User\Documents\Bazis11\Текстуры\EGGER"
                      className="w-full px-3.5 py-2.5 bg-[#121826] border border-slate-700/80 focus:border-amber-500/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleScan()}
                    disabled={isScanning || !folderPath.trim()}
                    className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-amber-900/20 active:scale-95 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>{isScanning ? 'Сканирование...' : 'Сканировать папку'}</span>
                  </button>
                </div>

                {scanError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{scanError}</span>
                  </div>
                )}
              </div>

              {/* ===================================================================
                  ШАГ 2: НАЗНАЧЕНИЕ РАЗДЕЛОВ И ЦЕН (ЕСЛИ СКАНИРОВАНИЕ ВЫПОЛНЕНО)
                 =================================================================== */}
              {scannedItems.length > 0 && (
                <div className="p-4 bg-[#121826] border border-slate-700/80 rounded-2xl space-y-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    2. Назначение разделов и ценообразование
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Разделы назначения */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-300">
                        Куда применить импортируемые декоры:
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['ldsp', 'facade', 'countertop', 'apron'] as MaterialSection[]).map((sec) => {
                          const isChecked = selectedSections.includes(sec);
                          return (
                            <button
                              key={sec}
                              type="button"
                              onClick={() => toggleSection(sec)}
                              className={`p-2 rounded-xl border text-xs font-medium text-left flex items-center gap-2 transition-all ${
                                isChecked
                                  ? 'bg-blue-600/20 border-blue-500/80 text-white font-semibold'
                                  : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                                  isChecked
                                    ? 'bg-blue-600 border-blue-500 text-white'
                                    : 'border-slate-600 bg-slate-800'
                                }`}
                              >
                                {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <span>{SECTION_LABELS[sec]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Параметры цены */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-300">
                        Базовая цена закупки и наценка:
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-[10px] text-slate-400 mb-1">Закупка (руб):</div>
                          <input
                            type="number"
                            value={costPrice}
                            onChange={(e) => setCostPrice(Math.max(0, Number(e.target.value)))}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 mb-1">Ед. изм.:</div>
                          <select
                            value={unit}
                            onChange={(e) => setUnit(e.target.value as PriceUnit)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                          >
                            <option value="sheet">лист</option>
                            <option value="m2">м²</option>
                            <option value="linear_meter">пог. м</option>
                            <option value="piece">шт.</option>
                          </select>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 mb-1">Наценка (коэф.):</div>
                          <input
                            type="number"
                            step="0.1"
                            value={markupMultiplier}
                            onChange={(e) => setMarkupMultiplier(Math.max(1, Number(e.target.value)))}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                          />
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                        <span>Расчетная цена для клиента:</span>
                        <strong className="text-emerald-400 font-mono text-xs">
                          {Math.round(costPrice * markupMultiplier).toLocaleString('ru-RU')} ₽ / {UNIT_LABELS[unit]}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===================================================================
                  ШАГ 3: ПРЕДПРОСМОТР И ВЫБОР ДЕКОРОВ
                 =================================================================== */}
              {scannedItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                      <span>3. Предпросмотр декоров</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
                        Выбрано: {selectedIds.size} из {scannedItems.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium py-1 px-2.5 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        {selectedIds.size === filteredItems.length && filteredItems.length > 0
                          ? 'Снять выбор'
                          : 'Выбрать все в списке'}
                      </button>
                    </div>
                  </div>

                  {/* Вкладки по подкатегориям (Древесные, Фантазийные, Цветные) */}
                  <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-2">
                    <button
                      type="button"
                      onClick={() => setActiveCategory('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        activeCategory === 'all'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                          : 'bg-[#121826] hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Все ({scannedItems.length})
                    </button>
                    {scannedCategories.map((cat) => {
                      const count = scannedItems.filter((i) => i.category === cat).length;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setActiveCategory(cat)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            activeCategory === cat
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                              : 'bg-[#121826] hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {cat} ({count})
                        </button>
                      );
                    })}

                    <div className="relative flex-1 min-w-[180px] ml-auto">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Поиск по названию или коду..."
                        className="w-full pl-8 pr-3 py-1.5 bg-[#121826] border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Сетка карточек декоров */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[360px] overflow-y-auto p-1 custom-scrollbar">
                    {filteredItems.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleItem(item.id)}
                          className={`p-2.5 rounded-xl border cursor-pointer select-none flex items-center gap-3 transition-all ${
                            isSelected
                              ? 'bg-amber-950/20 border-amber-500/70 shadow-sm'
                              : 'bg-[#121826]/70 border-slate-800 hover:border-slate-700 opacity-60'
                          }`}
                        >
                          {/* Чекбокс */}
                          <div
                            className={`w-4 h-4 rounded shrink-0 flex items-center justify-center border transition-colors ${
                              isSelected
                                ? 'bg-amber-500 border-amber-400 text-black font-bold'
                                : 'border-slate-600 bg-slate-800'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>

                          {/* Превью текстуры и цвета */}
                          <div
                            className="w-10 h-10 rounded-lg border border-slate-700/80 shrink-0 overflow-hidden shadow-inner flex items-center justify-center bg-cover bg-center"
                            style={{
                              backgroundColor: item.color || '#334155',
                              backgroundImage: item.previewUrl ? `url("${encodeURI(item.previewUrl)}")` : undefined,
                            }}
                          />

                          {/* Инфо декора */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {item.article && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 font-semibold border border-slate-700">
                                  {item.article}
                                </span>
                              )}
                              <span className="text-xs font-semibold text-white truncate" title={item.cleanName}>
                                {item.cleanName}
                              </span>
                            </div>

                            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                              <span>{item.category}</span>
                              {item.textureCode && (
                                <span className="text-slate-500 font-mono">
                                  структура {item.textureCode}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Подвал с кнопкой действия */}
        {!importSuccess && (
          <div className="px-6 py-4 border-t border-[#1E2536] bg-[#0E131F]/90 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
            >
              Отмена
            </button>

            {scannedItems.length > 0 && (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isImporting || selectedIds.size === 0}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-900/30 transition-all active:scale-95"
              >
                <FolderUp className={`w-4 h-4 ${isImporting ? 'animate-bounce' : ''}`} />
                <span>
                  {isImporting
                    ? 'Копирование и добавление...'
                    : `Импортировать ${selectedIds.size} декоров в базу`}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
