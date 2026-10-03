import React, { useState, useEffect } from 'react';
import {
  Sliders,
  X,
  RotateCcw,
  Check,
  Info,
  Layers,
  Sparkles,
  ArrowUpDown,
  Maximize2,
  RefreshCw,
  Wrench,
} from 'lucide-react';
import { usePlannerStore } from '../store/usePlannerStore';
import { ProjectSettings, DEFAULT_PROJECT_SETTINGS } from '../types';

export const ProjectSettingsModal: React.FC = () => {
  const {
    isProjectSettingsOpen,
    closeProjectSettings,
    projectSettings,
    updateProjectSettings,
    modules,
  } = usePlannerStore();

  const [form, setForm] = useState<ProjectSettings>(projectSettings);
  const [applyToExisting, setApplyToExisting] = useState<boolean>(true);

  // Синхронизация формы при открытии модального окна
  useEffect(() => {
    if (isProjectSettingsOpen) {
      setForm(projectSettings);
    }
  }, [isProjectSettingsOpen, projectSettings]);

  if (!isProjectSettingsOpen) return null;

  // Рекомендуемые значения по формулам
  const recommendedCountertopDepth =
    form.baseBodyDepth + form.countertopFrontOverhang + form.countertopBackOverhang;

  const effectivePlinth = form.hasPlinth ? form.plinthHeight : 0;
  const recommendedApronStart =
    effectivePlinth + form.baseBodyHeight + form.countertopThickness;

  const recommendedUpperBaseStart = form.apronStartHeight + form.apronHeight;

  // Автоматический пересчёт глубины столешницы при изменении глубины базы или свесов
  const handleBaseBodyDepthChange = (depth: number) => {
    const nextDepth = Math.max(100, depth || 0);
    setForm((prev) => ({
      ...prev,
      baseBodyDepth: nextDepth,
      countertopDepth: nextDepth + prev.countertopFrontOverhang + prev.countertopBackOverhang,
    }));
  };

  const handleFrontOverhangChange = (overhang: number) => {
    const nextOverhang = Math.max(0, overhang || 0);
    setForm((prev) => ({
      ...prev,
      countertopFrontOverhang: nextOverhang,
      countertopDepth: prev.baseBodyDepth + nextOverhang + prev.countertopBackOverhang,
    }));
  };

  const handleBackOverhangChange = (overhang: number) => {
    const nextOverhang = Math.max(0, overhang || 0);
    setForm((prev) => ({
      ...prev,
      countertopBackOverhang: nextOverhang,
      countertopDepth: prev.baseBodyDepth + prev.countertopFrontOverhang + nextOverhang,
    }));
  };

  const handleSave = () => {
    updateProjectSettings(form, applyToExisting);
    closeProjectSettings();
  };

  const handleResetToDefaults = () => {
    setForm(DEFAULT_PROJECT_SETTINGS);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Шапка модального окна */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide uppercase">
                  Параметры проекта
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Кухня
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Базовые параметры проектирования кухонной мебели
              </p>
            </div>
          </div>

          <button
            onClick={closeProjectSettings}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Прокручиваемое тело с настройками */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-sm">
          {/* СЕКЦИЯ 1: ОБЩИЕ НАСТРОЙКИ */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Общие настройки</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-200">
                    Толщина деталей ДСП
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Применяется для расчёта внутренних полок, боковин и зазоров фасадов
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-700/70">
                  {[16, 18, 22, 25].map((thickness) => (
                    <button
                      key={thickness}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, dspThickness: thickness }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        form.dspThickness === thickness
                          ? 'bg-blue-600 text-white shadow-md font-semibold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {thickness} мм
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* СЕКЦИЯ 2: НИЖНИЕ КОРПУСА */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <ArrowUpDown className="w-4 h-4 text-emerald-400" />
              <span>Нижние корпуса</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Высота корпуса (чистовая) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-200">
                      Высота корпуса (чистовая)
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step={10}
                      value={form.baseBodyHeight}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          baseBodyHeight: Math.max(100, parseInt(e.target.value) || 0),
                        }))
                      }
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono pr-10"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400 select-none">
                      мм
                    </span>
                  </div>
                  <div className="flex gap-1.5 mt-1">
                    {[700, 720, 760, 800].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, baseBodyHeight: h }))}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                          form.baseBodyHeight === h
                            ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-bold'
                            : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Глубина корпуса (чистовая) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-200">
                      Глубина корпуса (чистовая)
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step={10}
                      value={form.baseBodyDepth}
                      onChange={(e) => handleBaseBodyDepthChange(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono pr-10"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400 select-none">
                      мм
                    </span>
                  </div>
                  <div className="flex gap-1.5 mt-1">
                    {[500, 510, 530, 560].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleBaseBodyDepthChange(d)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                          form.baseBodyDepth === d
                            ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-bold'
                            : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Цоколь */}
              <div className="pt-3 border-t border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.hasPlinth}
                    onChange={(e) => setForm((prev) => ({ ...prev, hasPlinth: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                  />
                  <div>
                    <span className="text-xs font-medium text-slate-200">
                      С цоколем / ножками
                    </span>
                    <p className="text-[11px] text-slate-400">
                      {form.hasPlinth ? 'Цокольная планка активна' : 'Без цоколя (корпус на полу)'}
                    </p>
                  </div>
                </label>

                {form.hasPlinth && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Высота цоколя:</span>
                    <div className="relative w-28">
                      <input
                        type="number"
                        step={10}
                        value={form.plinthHeight}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            plinthHeight: Math.max(0, parseInt(e.target.value) || 0),
                          }))
                        }
                        className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono pr-8"
                      />
                      <span className="absolute right-2.5 top-1.5 text-xs text-slate-400 select-none">
                        мм
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {[100, 120, 150].map((ph) => (
                        <button
                          key={ph}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, plinthHeight: ph }))}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                            form.plinthHeight === ph
                              ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 font-bold'
                              : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {ph}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Инфо: общая высота базы с цоколем */}
              <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg flex items-center justify-between">
                <span>Итоговая высота нижней базы с цоколем:</span>
                <span className="font-mono font-bold text-emerald-400 text-xs">
                  {form.baseBodyHeight + (form.hasPlinth ? form.plinthHeight : 0)} мм
                </span>
              </div>
            </div>
          </div>

          {/* СЕКЦИЯ 3: СТОЛЕШНИЦА */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Maximize2 className="w-4 h-4 text-amber-400" />
              <span>Столешница</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-4">
              {/* Пресеты свесов столешницы и глубины базы по типу ручек */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 uppercase tracking-wide">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Быстрые преднастройки свесов и базы</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Столешница 600 мм</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Пресет 1: Ручка Gola */}
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        baseBodyDepth: 510,
                        countertopFrontOverhang: 36,
                        countertopBackOverhang: 54,
                        countertopDepth: 600,
                      }));
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      form.baseBodyDepth === 510 &&
                      form.countertopFrontOverhang === 36 &&
                      form.countertopBackOverhang === 54
                        ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-400/50 shadow-md shadow-blue-900/20'
                        : 'bg-slate-800/60 border-slate-700/70 hover:border-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                        Ручка Gola
                        {form.baseBodyDepth === 510 &&
                          form.countertopFrontOverhang === 36 &&
                          form.countertopBackOverhang === 54 && (
                            <Check className="w-3.5 h-3.5 text-blue-400" />
                          )}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-blue-500/20 text-blue-300 font-semibold">
                        36 / 510 / 54
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 font-mono space-y-0.5">
                      <div>• Каркас базы: <span className="text-white font-bold">510 мм</span></div>
                      <div>• Свес спереди: <span className="text-white font-bold">36 мм</span> (добор угла 18 мм)</div>
                      <div>• Свес сзади: <span className="text-white font-bold">54 мм</span> (сантех-зазор)</div>
                    </div>
                  </button>

                  {/* Пресет 2: Накладная ручка */}
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        baseBodyDepth: 510,
                        countertopFrontOverhang: 50,
                        countertopBackOverhang: 40,
                        countertopDepth: 600,
                      }));
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      form.baseBodyDepth === 510 &&
                      form.countertopFrontOverhang === 50 &&
                      form.countertopBackOverhang === 40
                        ? 'bg-amber-600/20 border-amber-500 ring-1 ring-amber-400/50 shadow-md shadow-amber-900/20'
                        : 'bg-slate-800/60 border-slate-700/70 hover:border-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        Накладная ручка
                        {form.baseBodyDepth === 510 &&
                          form.countertopFrontOverhang === 50 &&
                          form.countertopBackOverhang === 40 && (
                            <Check className="w-3.5 h-3.5 text-amber-400" />
                          )}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-amber-500/20 text-amber-300 font-semibold">
                        50 / 510 / 40
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 font-mono space-y-0.5">
                      <div>• Каркас базы: <span className="text-white font-bold">510 мм</span></div>
                      <div>• Свес спереди: <span className="text-white font-bold">50 мм</span> (добор угла 32 мм)</div>
                      <div>• Свес сзади: <span className="text-white font-bold">40 мм</span> (сантех-зазор)</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Толщина столешницы */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-200">
                    Толщина столешницы
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={2}
                      value={form.countertopThickness}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          countertopThickness: Math.max(0, parseInt(e.target.value) || 0),
                        }))
                      }
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono pr-10"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400 select-none">
                      мм
                    </span>
                  </div>
                  <div className="flex gap-1 mt-1">
                    {[28, 38, 40].map((th) => (
                      <button
                        key={th}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, countertopThickness: th }))}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                          form.countertopThickness === th
                            ? 'bg-amber-600/30 border-amber-500 text-amber-300 font-bold'
                            : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {th}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Технологические свесы (фиксированные по фабричному стандарту) */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-slate-200">
                    Технологические свесы (фабричные стандарты)
                  </label>
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/80 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300">
                      Спереди: <strong className="text-amber-400">{form.countertopFrontOverhang} мм</strong> (добор угла {form.countertopFrontOverhang - 18} мм)
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-300">
                      Сзади: <strong className="text-sky-400">{form.countertopBackOverhang} мм</strong> (сантех-зазор)
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Свесы зафиксированы стандартами «Ручка Gola» (36/54) и «Накладная ручка» (50/40) для чистого угла.
                  </div>
                </div>
              </div>

              {/* Глубина по столешнице (расчёт) */}
              <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span>Глубина по столешнице:</span>
                    <span className="text-amber-400 font-mono text-sm">{form.countertopDepth} мм</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Расчёт: база {form.baseBodyDepth} + свес спереди {form.countertopFrontOverhang} + свес сзади {form.countertopBackOverhang} = {recommendedCountertopDepth} мм
                  </div>
                </div>

                {form.countertopDepth !== recommendedCountertopDepth && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, countertopDepth: recommendedCountertopDepth }))
                    }
                    className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-medium flex items-center gap-1 transition-colors self-start sm:self-center"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Привести к {recommendedCountertopDepth} мм
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* СЕКЦИЯ 4: СТЕНОВАЯ ПАНЕЛЬ (ФАРТУК) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Стеновая панель (фартук)</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Высота фартука */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-200">Высота фартука</label>
                  <div className="relative">
                    <input
                      type="number"
                      step={10}
                      value={form.apronHeight}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          apronHeight: Math.max(100, parseInt(e.target.value) || 0),
                        }))
                      }
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono pr-10"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400 select-none">
                      мм
                    </span>
                  </div>
                  <div className="flex gap-1.5 mt-1">
                    {[560, 600].map((ah) => (
                      <button
                        key={ah}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, apronHeight: ah }))}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                          form.apronHeight === ah
                            ? 'bg-purple-600/30 border-purple-500 text-purple-300 font-bold'
                            : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {ah}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Высота начала фартука */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-200">
                      Высота начала фартука
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      реком.: {recommendedApronStart} мм
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step={10}
                      value={form.apronStartHeight}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          apronStartHeight: Math.max(0, parseInt(e.target.value) || 0),
                        }))
                      }
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono pr-10"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400 select-none">
                      мм
                    </span>
                  </div>

                  {form.apronStartHeight !== recommendedApronStart && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, apronStartHeight: recommendedApronStart }))
                      }
                      className="text-[10px] text-purple-300 hover:text-purple-200 underline flex items-center gap-1 mt-1"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      Применить рекомендуемую ({recommendedApronStart} мм)
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* СЕКЦИЯ 5: ВЕРХНИЕ КОРПУСА */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <ArrowUpDown className="w-4 h-4 text-sky-400" />
              <span>Верхние корпуса</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Глубина верхних баз */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-200">
                    Глубина верхних баз
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={10}
                      value={form.upperBodyDepth}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          upperBodyDepth: Math.max(100, parseInt(e.target.value) || 0),
                        }))
                      }
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono pr-10"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400 select-none">
                      мм
                    </span>
                  </div>
                  <div className="flex gap-1.5 mt-1">
                    {[280, 300, 320, 350].map((ud) => (
                      <button
                        key={ud}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, upperBodyDepth: ud }))}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                          form.upperBodyDepth === ud
                            ? 'bg-sky-600/30 border-sky-500 text-sky-300 font-bold'
                            : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {ud}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Высота начала верхних баз */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-200">
                      Высота начала верхних баз
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      реком.: {recommendedUpperBaseStart} мм
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step={10}
                      value={form.upperBaseStartHeight}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          upperBaseStartHeight: Math.max(100, parseInt(e.target.value) || 0),
                        }))
                      }
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono pr-10"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400 select-none">
                      мм
                    </span>
                  </div>

                  {form.upperBaseStartHeight !== recommendedUpperBaseStart && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          upperBaseStartHeight: recommendedUpperBaseStart,
                        }))
                      }
                      className="text-[10px] text-sky-300 hover:text-sky-200 underline flex items-center gap-1 mt-1"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      Применить рекомендуемую ({recommendedUpperBaseStart} мм)
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* СЕКЦИЯ 6: ЗАЗОРЫ И ДОПУСКИ ФАСАДОВ (ФАСАДНАЯ СЕТКА) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Зазоры и допуски фасадов (фасадная сетка)</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-4">
              {/* 1. Нижняя база */}
              <div>
                <h5 className="text-xs font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  Нижняя база (тумбы)
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Боковой зазор от каркаса */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-300">
                      Боковой зазор (с каждой стороны)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={0.5}
                        min={0.5}
                        max={5}
                        value={form.baseFacadeSideGap}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            baseFacadeSideGap: Math.max(0.5, parseFloat(e.target.value) || 1.5),
                          }))
                        }
                        className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono pr-8"
                      />
                      <span className="absolute right-2.5 top-1.5 text-xs text-slate-400 select-none">мм</span>
                    </div>
                    <div className="flex gap-1 mt-1">
                      {[1.5, 2.0, 2.5].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, baseFacadeSideGap: g }))}
                          className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                            form.baseFacadeSideGap === g
                              ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-bold'
                              : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {g} {g === 1.5 ? '(597)' : g === 2.0 ? '(596)' : ''}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Зазор сверху до столешницы */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-300">
                      Зазор сверху (до столешницы)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={0.5}
                        min={1}
                        max={10}
                        value={form.baseFacadeTopGap}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            baseFacadeTopGap: Math.max(1, parseFloat(e.target.value) || 3),
                          }))
                        }
                        className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono pr-8"
                      />
                      <span className="absolute right-2.5 top-1.5 text-xs text-slate-400 select-none">мм</span>
                    </div>
                    <div className="flex gap-1 mt-1">
                      {[3, 4, 5].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, baseFacadeTopGap: g }))}
                          className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                            form.baseFacadeTopGap === g
                              ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-bold'
                              : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {g} мм
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Зазор снизу до цоколя */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-300">
                      Зазор снизу (до цоколя)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={0.5}
                        min={0}
                        max={10}
                        value={form.baseFacadeBottomGap}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            baseFacadeBottomGap: Math.max(0, parseFloat(e.target.value) || 0),
                          }))
                        }
                        className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono pr-8"
                      />
                      <span className="absolute right-2.5 top-1.5 text-xs text-slate-400 select-none">мм</span>
                    </div>
                    <div className="flex gap-1 mt-1">
                      {[0, 2, 3].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, baseFacadeBottomGap: g }))}
                          className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                            form.baseFacadeBottomGap === g
                              ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-bold'
                              : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {g} мм
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Верхняя база */}
              <div className="pt-3 border-t border-slate-700/60">
                <h5 className="text-xs font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  Верхняя база (навесные шкафы)
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Боковой зазор от каркаса */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-300">
                      Боковой зазор (с каждой стороны)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={0.5}
                        min={0.5}
                        max={5}
                        value={form.upperFacadeSideGap}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            upperFacadeSideGap: Math.max(0.5, parseFloat(e.target.value) || 1.5),
                          }))
                        }
                        className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono pr-8"
                      />
                      <span className="absolute right-2.5 top-1.5 text-xs text-slate-400 select-none">мм</span>
                    </div>
                  </div>

                  {/* Зазор сверху */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-300">
                      Зазор сверху (до потолка/карниза)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={0.5}
                        min={0}
                        max={10}
                        value={form.upperFacadeTopGap}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            upperFacadeTopGap: Math.max(0, parseFloat(e.target.value) || 2),
                          }))
                        }
                        className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono pr-8"
                      />
                      <span className="absolute right-2.5 top-1.5 text-xs text-slate-400 select-none">мм</span>
                    </div>
                  </div>

                  {/* Свес фасада вниз для открывания без ручек */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                      Свес фасада вниз (хват без ручек)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={1}
                        min={0}
                        max={50}
                        value={form.upperFacadeBottomOverhang}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            upperFacadeBottomOverhang: Math.max(0, parseInt(e.target.value) || 0),
                          }))
                        }
                        className="w-full bg-slate-900/90 border border-amber-500/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono pr-8"
                      />
                      <span className="absolute right-2.5 top-1.5 text-xs text-slate-400 select-none">мм</span>
                    </div>
                    <div className="flex gap-1 mt-1">
                      {[0, 20, 25, 30].map((oh) => (
                        <button
                          key={oh}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, upperFacadeBottomOverhang: oh }))}
                          className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                            form.upperFacadeBottomOverhang === oh
                              ? 'bg-amber-600/30 border-amber-500 text-amber-300 font-bold'
                              : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {oh === 0 ? 'Вровень (0)' : `${oh} мм`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Межфасадный зазор */}
              <div className="pt-3 border-t border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <label className="text-xs font-medium text-slate-200">
                    Зазор между соседними фасадами (2 двери или между ящиками)
                  </label>
                  <p className="text-[10px] text-slate-400">
                    Технологический межфасадный просвет для свободного открывания
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-24">
                    <input
                      type="number"
                      step={0.5}
                      min={1}
                      max={6}
                      value={form.interFacadeGap}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          interFacadeGap: Math.max(1, parseFloat(e.target.value) || 3),
                        }))
                      }
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500 font-mono pr-7"
                    />
                    <span className="absolute right-2 top-1 text-xs text-slate-400 select-none">мм</span>
                  </div>
                  <div className="flex gap-1">
                    {[2.5, 3.0, 4.0].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, interFacadeGap: g }))}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                          form.interFacadeGap === g
                            ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-bold'
                            : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Примечание по угловому модулю */}
              <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-700/70 text-[11px] text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Угловой модуль:</strong> фальш-панель (550 мм) и стыковочная планка (50 мм) сохраняют строгую фиксацию по каркасу для идеальной стыковки с перпендикулярным рядом 600 мм, а зазоры фасадной сетки применяются к распашной двери 400 мм.
                </span>
              </div>
            </div>
          </div>

          {/* СЕКЦИЯ 6: БАЗОВАЯ ФУРНИТУРА ПРОЕКТА (ПО УМОЛЧАНИЮ) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Wrench className="w-4 h-4 text-blue-400" />
              <span>Базовая фурнитура проекта (по умолчанию)</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-4">
              <p className="text-xs text-slate-400">
                Задаёт базовых производителей фурнитуры для всех шкафов проекта. Для любого отдельного модуля фурнитуру можно переопределить через ПКМ → «Фурнитура модуля».
              </p>

              {/* ПЕТЛИ РАСПАШНЫХ ФАСАДОВ */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                  <span>Петли распашных фасадов:</span>
                  <span className="text-[10px] text-blue-400 font-mono">по умолчанию</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'hw_boyard_neo_overlay_h301', brand: 'Boyard', name: 'Boyard Neo с доводчиком', price: '142 ₽' },
                    { id: 'hw_blum_clip_top_110', brand: 'Blum', name: 'Blum Clip Top Blumotion', price: '558 ₽' },
                    { id: 'hw_hettich_sensys_8645', brand: 'Hettich', name: 'Hettich Sensys 8645i Silent', price: '612 ₽' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, defaultHinges: item.id }))}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        (form.defaultHinges || 'hw_boyard_neo_overlay_h301') === item.id
                          ? 'border-blue-500 bg-blue-600/20 text-white shadow-sm ring-1 ring-blue-500/40'
                          : 'border-slate-700/80 bg-slate-900/60 text-slate-300 hover:bg-slate-800/80 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">{item.brand}</span>
                        {(form.defaultHinges || 'hw_boyard_neo_overlay_h301') === item.id && (
                          <Check className="w-3.5 h-3.5 text-blue-400" />
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-100 mt-1 line-clamp-1">{item.name}</div>
                      <div className="text-[10px] font-mono text-emerald-400 font-bold mt-1">{item.price} / шт.</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* СИСТЕМЫ ВЫДВИЖЕНИЯ (НАПРАВЛЯЮЩИЕ ЯЩИКОВ) */}
              <div className="space-y-1.5 pt-2 border-t border-slate-700/60">
                <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                  <span>Системы выдвижения (направляющие ящиков):</span>
                  <span className="text-[10px] text-blue-400 font-mono">по умолчанию</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'hw_boyard_bslide_500', brand: 'Boyard', name: 'B-Slide скрытого монтажа с доводчиком', price: '1 700 ₽' },
                    { id: 'hw_blum_tandembox_500', brand: 'Blum', name: 'Blum Tandembox Antaro 500мм', price: '5 760 ₽' },
                    { id: 'hw_hettich_innotech_470', brand: 'Hettich', name: 'Hettich InnoTech Atira 470мм', price: '5 100 ₽' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, defaultDrawers: item.id }))}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        (form.defaultDrawers || 'hw_boyard_bslide_500') === item.id
                          ? 'border-blue-500 bg-blue-600/20 text-white shadow-sm ring-1 ring-blue-500/40'
                          : 'border-slate-700/80 bg-slate-900/60 text-slate-300 hover:bg-slate-800/80 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">{item.brand}</span>
                        {(form.defaultDrawers || 'hw_boyard_bslide_500') === item.id && (
                          <Check className="w-3.5 h-3.5 text-blue-400" />
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-100 mt-1 line-clamp-1">{item.name}</div>
                      <div className="text-[10px] font-mono text-emerald-400 font-bold mt-1">{item.price} / компл.</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ПОДЪЕМНЫЕ МЕХАНИЗМЫ */}
              <div className="space-y-1.5 pt-2 border-t border-slate-700/60">
                <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                  <span>Подъемные механизмы верхних шкафов:</span>
                  <span className="text-[10px] text-blue-400 font-mono">по умолчанию</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'hw_boyard_gaslift_80', brand: 'Boyard', name: 'Газлифт автоматический 80N', price: '210 ₽' },
                    { id: 'hw_blum_aventos_hf', brand: 'Blum', name: 'Blum Aventos HF складной', price: '16 100 ₽' },
                    { id: 'hw_hettich_kinvaro', brand: 'Hettich', name: 'Hettich Kinvaro поворотный', price: '4 800 ₽' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, defaultLift: item.id }))}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        (form.defaultLift || 'hw_boyard_gaslift_80') === item.id
                          ? 'border-blue-500 bg-blue-600/20 text-white shadow-sm ring-1 ring-blue-500/40'
                          : 'border-slate-700/80 bg-slate-900/60 text-slate-300 hover:bg-slate-800/80 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">{item.brand}</span>
                        {(form.defaultLift || 'hw_boyard_gaslift_80') === item.id && (
                          <Check className="w-3.5 h-3.5 text-blue-400" />
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-100 mt-1 line-clamp-1">{item.name}</div>
                      <div className="text-[10px] font-mono text-emerald-400 font-bold mt-1">{item.price} / компл.</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* РУЧКИ ПРОЕКТА */}
              <div className="space-y-1.5 pt-2 border-t border-slate-700/60">
                <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                  <span>Базовые ручки / открывание:</span>
                  <span className="text-[10px] text-blue-400 font-mono">по умолчанию</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'hw_boyard_handle_123', brand: 'Boyard', name: 'Ручка-скоба черный мат 160мм', price: '396 ₽' },
                    { id: 'hw_handle_gola', brand: 'Gola', name: 'Интегрированный Gola-профиль', price: '1 250 ₽' },
                    { id: 'hw_handle_pushtoopen', brand: 'Blum / Boyard', name: 'Push-to-Open (без ручек)', price: '480 ₽' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, defaultHandle: item.id }))}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        (form.defaultHandle || 'hw_boyard_handle_123') === item.id
                          ? 'border-blue-500 bg-blue-600/20 text-white shadow-sm ring-1 ring-blue-500/40'
                          : 'border-slate-700/80 bg-slate-900/60 text-slate-300 hover:bg-slate-800/80 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">{item.brand}</span>
                        {(form.defaultHandle || 'hw_boyard_handle_123') === item.id && (
                          <Check className="w-3.5 h-3.5 text-blue-400" />
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-100 mt-1 line-clamp-1">{item.name}</div>
                      <div className="text-[10px] font-mono text-emerald-400 font-bold mt-1">{item.price}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ЧЕКБОКС: ПРИМЕНИТЬ К УЖЕ УСТАНОВЛЕННЫМ МОДУЛЯМ */}
          {modules.length > 0 && (
            <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-start gap-3">
              <input
                type="checkbox"
                id="apply-to-existing"
                checked={applyToExisting}
                onChange={(e) => setApplyToExisting(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
              />
              <label htmlFor="apply-to-existing" className="cursor-pointer select-none">
                <div className="text-xs font-semibold text-blue-200">
                  Обновить размеры уже установленных модулей на сцене ({modules.length} шт.)
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Автоматически скорректирует высоту/глубину нижних корпусов и уровень подвеса верхних шкафов
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Подвал с кнопками действий */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="px-3.5 py-2 rounded-xl border border-slate-700/80 hover:border-slate-600 bg-slate-800/60 hover:bg-slate-800 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-2 transition-all shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Сбросить по умолчанию</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={closeProjectSettings}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-2 shadow-lg shadow-blue-600/30 active:scale-95 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Сохранить параметры</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
