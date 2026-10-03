import React from 'react';
import {
  X,
  Calculator,
  Download,
  Check,
  Truck,
  Wrench,
  Package,
  Layers,
  Sparkles,
  ArrowUpCircle,
  Scissors,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { usePlannerStore } from '../store/usePlannerStore';
import { useMaterialsStore } from '../store/useMaterialsStore';
import { useLicenseStore } from '../store/useLicenseStore';
import { generateQuotationPDF } from '../utils/pdfExport';

interface SmetaModalProps {
  onCaptureScreenshot?: () => string;
}

export const SmetaModal: React.FC<SmetaModalProps> = ({ onCaptureScreenshot }) => {
  const {
    isSmetaOpen,
    closeSmeta,
    modules,
    room,
    globalMaterials,
    projectSettings,
    smetaServices,
    updateSmetaServices,
    calculateTotalPrice,
  } = usePlannerStore();

  const { getItemById } = useMaterialsStore();
  const { license } = useLicenseStore();

  if (!isSmetaOpen) return null;

  const pricing = calculateTotalPrice();

  const facadeItem = getItemById(globalMaterials.facade);
  const carcassItem = getItemById(globalMaterials.carcass);
  const ctItem = getItemById(globalMaterials.countertop);
  const handleItem = getItemById(globalMaterials.handle || projectSettings.defaultHandle || 'hw_boyard_handle_123');

  const defaultHingesItem = getItemById(projectSettings.defaultHinges || 'hw_boyard_neo_overlay_h301');
  const defaultDrawersItem = getItemById(projectSettings.defaultDrawers || 'hw_boyard_bslide_500');

  const handleExportPDF = () => {
    const screenshot = onCaptureScreenshot ? onCaptureScreenshot() : '';
    generateQuotationPDF({
      clientName: license.clientName,
      room,
      modules,
      pricing,
      screenshotDataUrl: screenshot,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Шапка модального окна */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide uppercase">
                  Смета проекта
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  {modules.length} {modules.length === 1 ? 'модуль' : modules.length < 5 ? 'модуля' : 'модулей'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Заказчик: <span className="text-slate-200 font-medium">{license.clientName || 'Частный заказчик'}</span> • Дата: {new Date().toLocaleDateString('ru-RU')}
              </p>
            </div>
          </div>

          <button
            onClick={closeSmeta}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Прокручиваемое содержимое сметы */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-sm">
          {/* БЛОК 1: МАТЕРИАЛЫ И МЕБЕЛЬНЫЕ КОМПЛЕКТУЮЩИЕ */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                1. Мебель и материалы
              </span>
              <span className="font-mono text-white text-sm">
                {(pricing.modulesTotal + pricing.countertopTotal + pricing.apronTotal).toLocaleString('ru-RU')} ₽
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between py-1 text-xs border-b border-slate-700/40">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  <span className="text-slate-200">Корпуса и фасады гарнитура:</span>
                  <span className="text-slate-400 truncate max-w-[280px]">
                    {facadeItem?.name || 'Фасады'} / {carcassItem?.name || 'Корпус'}
                  </span>
                </div>
                <span className="font-mono font-bold text-slate-100 shrink-0">
                  {pricing.modulesTotal.toLocaleString('ru-RU')} ₽
                </span>
              </div>

              {pricing.countertopTotal > 0 && (
                <div className="flex items-center justify-between py-1 text-xs border-b border-slate-700/40">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-slate-200">Столешница и влагостойкая кромка:</span>
                    <span className="text-slate-400 truncate max-w-[280px]">
                      {ctItem?.name || 'Столешница'}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-100 shrink-0">
                    {pricing.countertopTotal.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              )}

              {pricing.apronTotal > 0 && (
                <div className="flex items-center justify-between py-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="text-slate-200">Стеновая панель (фартук):</span>
                  </div>
                  <span className="font-mono font-bold text-slate-100 shrink-0">
                    {pricing.apronTotal.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* БЛОК 2: ФУРНИТУРА И МЕХАНИЗМЫ */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
              <span className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                2. Фурнитура и механизмы
              </span>
              <span className="font-mono text-white text-sm">
                {pricing.hardwareTotal.toLocaleString('ru-RU')} ₽
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40 flex items-center justify-between">
                <div>
                  <div className="text-slate-200 font-medium">Петли с доводчиком:</div>
                  <div className="text-[11px] text-slate-400">
                    {defaultHingesItem?.name || 'Boyard Neo'} ({pricing.hardwareBreakdown.hingesCount} шт.)
                  </div>
                </div>
                <span className="font-mono font-bold text-amber-300">
                  {pricing.hardwareBreakdown.hingesTotal.toLocaleString('ru-RU')} ₽
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40 flex items-center justify-between">
                <div>
                  <div className="text-slate-200 font-medium">Выкатные ящики:</div>
                  <div className="text-[11px] text-slate-400">
                    {defaultDrawersItem?.name || 'Boyard B-Slide'} ({pricing.hardwareBreakdown.drawersCount} шт.)
                  </div>
                </div>
                <span className="font-mono font-bold text-amber-300">
                  {pricing.hardwareBreakdown.drawersTotal.toLocaleString('ru-RU')} ₽
                </span>
              </div>

              {pricing.hardwareBreakdown.liftsCount > 0 && (
                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40 flex items-center justify-between">
                  <div>
                    <div className="text-slate-200 font-medium">Подъемные механизмы:</div>
                    <div className="text-[11px] text-slate-400">
                      ({pricing.hardwareBreakdown.liftsCount} шт.)
                    </div>
                  </div>
                  <span className="font-mono font-bold text-amber-300">
                    {pricing.hardwareBreakdown.liftsTotal.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              )}

              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40 flex items-center justify-between">
                <div>
                  <div className="text-slate-200 font-medium">Мебельные ручки:</div>
                  <div className="text-[11px] text-slate-400">
                    {handleItem?.name || 'Ручка проекта'} ({pricing.hardwareBreakdown.handlesCount} шт.)
                  </div>
                </div>
                <span className="font-mono font-bold text-amber-300">
                  {pricing.hardwareBreakdown.handlesTotal.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>
          </div>

          {/* БЛОК 3: УСЛУГИ, МОНТАЖ И ДОСТАВКА (УПРАВЛЯЕМЫЕ ЧЕКБОКСЫ) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
              <span className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-emerald-400" />
                3. Дополнительные услуги (учитываются по выбору)
              </span>
              <span className="font-mono text-emerald-400 text-sm">
                +{pricing.servicesTotal.toLocaleString('ru-RU')} ₽
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
              {/* 1. Сборка модулей */}
              <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/70 border border-slate-700/50 hover:border-slate-600 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={smetaServices.assembly}
                    onChange={(e) => updateSmetaServices({ assembly: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-600 accent-blue-600"
                  />
                  <div>
                    <div className="text-xs font-semibold text-white">Сборка корпусов в цеху</div>
                    <div className="text-[11px] text-slate-400">
                      Контрольная сборка, упаковка и стяжка секций (1 500 ₽/модуль)
                    </div>
                  </div>
                </div>
                <span className="font-mono font-bold text-slate-200">
                  {smetaServices.assembly ? `${pricing.assemblyTotal.toLocaleString('ru-RU')} ₽` : '0 ₽'}
                </span>
              </label>

              {/* 2. Монтаж кухни */}
              <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/70 border border-slate-700/50 hover:border-slate-600 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={smetaServices.install}
                    onChange={(e) => updateSmetaServices({ install: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-600 accent-blue-600"
                  />
                  <div>
                    <div className="text-xs font-semibold text-white">Монтаж гарнитура «под ключ»</div>
                    <div className="text-[11px] text-slate-400">
                      Установка нижних и верхних баз, столешницы, цоколя и навеска фасадов (10%)
                    </div>
                  </div>
                </div>
                <span className="font-mono font-bold text-slate-200">
                  {smetaServices.install ? `${pricing.installTotal.toLocaleString('ru-RU')} ₽` : '0 ₽'}
                </span>
              </label>

              {/* 3. Доставка */}
              <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-700/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smetaServices.delivery}
                      onChange={(e) => updateSmetaServices({ delivery: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-600 accent-blue-600"
                    />
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <Truck className="w-3.5 h-3.5 text-sky-400" />
                      Доставка до подъезда
                    </div>
                  </label>
                  <span className="font-mono font-bold text-slate-200">
                    {smetaServices.delivery ? `${pricing.deliveryTotal.toLocaleString('ru-RU')} ₽` : '0 ₽'}
                  </span>
                </div>

                {smetaServices.delivery && (
                  <div className="flex items-center gap-2 pl-7 pt-1">
                    <button
                      type="button"
                      onClick={() => updateSmetaServices({ deliveryType: 'city' })}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                        smetaServices.deliveryType === 'city'
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      По городу (2 500 ₽)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSmetaServices({ deliveryType: 'suburb' })}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                        smetaServices.deliveryType === 'suburb'
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      За город / область (4 500 ₽)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSmetaServices({ deliveryType: 'pickup' })}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                        smetaServices.deliveryType === 'pickup'
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Самовывоз (0 ₽)
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Подъем на этаж */}
              <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-700/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smetaServices.floorLift}
                      onChange={(e) => updateSmetaServices({ floorLift: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-600 accent-blue-600"
                    />
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <ArrowUpCircle className="w-3.5 h-3.5 text-indigo-400" />
                      Подъем на этаж в квартиру
                    </div>
                  </label>
                  <span className="font-mono font-bold text-slate-200">
                    {smetaServices.floorLift ? `${pricing.floorLiftTotal.toLocaleString('ru-RU')} ₽` : '0 ₽'}
                  </span>
                </div>

                {smetaServices.floorLift && (
                  <div className="flex items-center gap-3 pl-7 pt-1 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={smetaServices.hasFreightElevator}
                        onChange={(e) => updateSmetaServices({ hasFreightElevator: e.target.checked })}
                        className="rounded accent-blue-600"
                      />
                      <span>Есть грузовой лифт (фикс 1 200 ₽)</span>
                    </label>

                    {!smetaServices.hasFreightElevator && (
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <span>Этаж:</span>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={smetaServices.floorNumber}
                          onChange={(e) => updateSmetaServices({ floorNumber: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-12 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-center font-mono text-white"
                        />
                        <span className="text-[11px] text-slate-400">× 350 ₽/эт.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 5. Дополнительные вырезы цеха */}
              <div className="flex flex-wrap items-center gap-4 pt-1 px-1">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smetaServices.sinkCutout}
                    onChange={(e) => updateSmetaServices({ sinkCutout: e.target.checked })}
                    className="rounded accent-blue-600"
                  />
                  <span>Выпил под мойку (+1 500 ₽)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smetaServices.hobCutout}
                    onChange={(e) => updateSmetaServices({ hobCutout: e.target.checked })}
                    className="rounded accent-blue-600"
                  />
                  <span>Выпил под варочную панель (+1 500 ₽)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Футер модального окна с итоговой стоимостью и печатью */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Итого к оплате:</span>
            <span className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
              {pricing.grandTotal.toLocaleString('ru-RU')} ₽
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleExportPDF}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              Распечатать КП в PDF
            </button>

            <button
              onClick={closeSmeta}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
