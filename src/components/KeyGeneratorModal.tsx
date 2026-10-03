import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  ShieldCheck,
  Copy,
  Check,
  Download,
  Trash2,
  Sparkles,
  Zap,
  Calendar,
  Users,
  FileText,
  RotateCcw,
  CheckCircle2,
  Crown,
} from 'lucide-react';
import { useLicenseStore } from '../store/useLicenseStore';
import { LicenseTier, IssuedLicenseKey } from '../types';
import {
  generateLicenseKey,
  getIssuedKeysFromStorage,
  deleteIssuedKeyFromStorage,
  formatLicenseTextCard,
} from '../utils/licenseManager';

export const KeyGeneratorModal: React.FC = () => {
  const { isKeygenOpen, closeKeygen, license, activateKey, activateDeveloperVip, resetToDemo } = useLicenseStore();

  const [activeTab, setActiveTab] = useState<'generator' | 'registry' | 'quick_unlock'>('generator');

  // Форма генератора
  const [clientName, setClientName] = useState('');
  const [tier, setTier] = useState<LicenseTier>('all_inclusive');
  const [durationDays, setDurationDays] = useState<number>(365);
  const [notes, setNotes] = useState('');

  // Результат генерации
  const [generatedKey, setGeneratedKey] = useState<IssuedLicenseKey | null>(null);
  const [isCopiedKey, setIsCopiedKey] = useState(false);
  const [isCopiedCard, setIsCopiedCard] = useState(false);
  const [activationFeedback, setActivationFeedback] = useState<string | null>(null);

  // Реестр выданных ключей
  const [registryKeys, setRegistryKeys] = useState<IssuedLicenseKey[]>([]);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (isKeygenOpen) {
      setRegistryKeys(getIssuedKeysFromStorage());
      setActivationFeedback(null);
    }
  }, [isKeygenOpen]);

  if (!isKeygenOpen) return null;

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const keyObj = generateLicenseKey({
      clientName: clientName.trim() || 'Клиент сервиса МКонструктор',
      tier,
      durationDays,
      notes: notes.trim(),
    });
    setGeneratedKey(keyObj);
    setRegistryKeys(getIssuedKeysFromStorage());
    setIsCopiedKey(false);
    setIsCopiedCard(false);
  };

  const handleCopyKey = (keyStr: string) => {
    navigator.clipboard.writeText(keyStr);
    setIsCopiedKey(true);
    setTimeout(() => setIsCopiedKey(false), 2000);
  };

  const handleCopyCard = (keyObj: IssuedLicenseKey) => {
    const cardText = formatLicenseTextCard(keyObj);
    navigator.clipboard.writeText(cardText);
    setIsCopiedCard(true);
    setTimeout(() => setIsCopiedCard(false), 2000);
  };

  const handleDownloadTxt = (keyObj: IssuedLicenseKey) => {
    const cardText = formatLicenseTextCard(keyObj);
    const blob = new Blob([cardText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `License_${keyObj.clientName.replace(/\s+/g, '_')}_${keyObj.key}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleActivateThisKey = (keyStr: string) => {
    const res = activateKey(keyStr);
    if (res.success) {
      setActivationFeedback(`Ключ ${keyStr} успешно применен! Демо-лимит снят.`);
      setTimeout(() => setActivationFeedback(null), 4000);
    }
  };

  const handleDeleteFromRegistry = (id: string) => {
    if (confirm('Удалить эту запись из реестра выданных ключей?')) {
      deleteIssuedKeyFromStorage(id);
      setRegistryKeys(getIssuedKeysFromStorage());
    }
  };

  const filteredRegistry = registryKeys.filter(
    (k) =>
      k.clientName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      k.key.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (k.notes && k.notes.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Шапка модального окна */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-blue-500/20 border border-amber-500/30 text-amber-400 shadow-inner">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  МКонструктор KeyGen • Генератор Лицензий SaaS
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                  Панель владельца
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Выпуск персональных лицензионных ключей для клиентов и мгновенная активация PRO
              </p>
            </div>
          </div>

          <button
            onClick={closeKeygen}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Вкладки навигации */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('generator')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'generator'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            Выпуск нового ключа
          </button>

          <button
            onClick={() => setActiveTab('quick_unlock')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'quick_unlock'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            Мгновенный PRO для себя
          </button>

          <button
            onClick={() => setActiveTab('registry')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'registry'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            База выданных ключей ({registryKeys.length})
          </button>
        </div>

        {/* Уведомление об успешной активации */}
        {activationFeedback && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{activationFeedback}</span>
          </div>
        )}

        {/* Тело модального окна со скроллом */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* ВКЛАДКА 1: ГЕНЕРАТОР КЛЮЧЕЙ */}
          {activeTab === 'generator' && (
            <div className="space-y-5">
              <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Имя клиента / Название мебельной фабрики или салона:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Например: Мебельная фабрика «Версаль» или ИП Смирнов"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Тарифный план (Функционал):
                  </label>
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value as LicenseTier)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="all_inclusive">Всё включено (Кухни + Шкафы PRO)</option>
                    <option value="kitchen_pro">Кухни PRO (Только кухни)</option>
                    <option value="wardrobe_pro">Шкафы PRO (Только гардеробы)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Срок действия лицензии:
                  </label>
                  <select
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value={30}>30 дней (Месячная подписка)</option>
                    <option value={90}>90 дней (Квартал)</option>
                    <option value={180}>180 дней (Полгода)</option>
                    <option value={365}>365 дней (1 Год)</option>
                    <option value={9999}>Бессрочно / Пожизненная (Lifetime VIP)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Заметка для внутреннего учета (номер договора, оплата, телефон):
                  </label>
                  <input
                    type="text"
                    placeholder="Например: Оплата 45 000 руб., договор №142 от 02.10.2026"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2 pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300 animate-spin-slow" />
                    Сгенерировать криптографический ключ
                  </button>
                </div>
              </form>

              {/* Блок сгенерированного ключа */}
              {generatedKey && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-blue-500/40 shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Лицензионный ключ успешно создан!
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {generatedKey.durationDays >= 9999 ? 'Бессрочный' : `${generatedKey.durationDays} дн.`}
                    </span>
                  </div>

                  {/* Крупное поле ключа */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="font-mono text-base sm:text-lg font-extrabold text-blue-400 tracking-widest selection:bg-blue-600 selection:text-white">
                      {generatedKey.key}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => handleCopyKey(generatedKey.key)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        {isCopiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {isCopiedKey ? 'Скопировано!' : 'Скопировать ключ'}
                      </button>

                      <button
                        onClick={() => handleActivateThisKey(generatedKey.key)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                        title="Снять демо-режим и активировать этот ключ прямо сейчас"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        Активировать на этом ПК
                      </button>
                    </div>
                  </div>

                  {/* Информация о ключе */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <div className="text-[10px] text-slate-400">Клиент:</div>
                      <div className="font-semibold text-slate-200 truncate mt-0.5">{generatedKey.clientName}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <div className="text-[10px] text-slate-400">Тариф:</div>
                      <div className="font-semibold text-slate-200 capitalize mt-0.5">
                        {generatedKey.tier === 'kitchen_pro'
                          ? 'Кухни PRO'
                          : generatedKey.tier === 'wardrobe_pro'
                          ? 'Шкафы PRO'
                          : 'Всё включено'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <div className="text-[10px] text-slate-400">Лимит модулей:</div>
                      <div className="font-semibold text-emerald-400 mt-0.5">Безлимитный</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <div className="text-[10px] text-slate-400">Действует до:</div>
                      <div className="font-semibold text-amber-300 mt-0.5">
                        {generatedKey.expiresAt
                          ? new Date(generatedKey.expiresAt).toLocaleDateString('ru-RU')
                          : 'Бессрочно'}
                      </div>
                    </div>
                  </div>

                  {/* Кнопки экспорта и передачи клиенту */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => handleCopyCard(generatedKey)}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                    >
                      {isCopiedCard ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileText className="w-3.5 h-3.5" />}
                      {isCopiedCard ? 'Карточка скопирована!' : 'Скопировать текст сертификата для клиента'}
                    </button>

                    <button
                      onClick={() => handleDownloadTxt(generatedKey)}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Скачать файл лицензии (.txt)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ВКЛАДКА 2: МГНОВЕННЫЙ PRO ДЛЯ СЕБЯ */}
          {activeTab === 'quick_unlock' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      Быстрое снятие демо-режима на этом рабочем месте
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Активируйте полнофункциональный режим разработчика без необходимости ввода ключей вручную
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Текущий статус:</div>
                    <div
                      className={`text-xs font-bold mt-0.5 ${
                        license.tier === 'demo' ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {license.tier === 'demo' ? 'Демо-режим (до 8 секций)' : `${license.clientName} (PRO)`}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => {
                      const res = activateDeveloperVip();
                      setActivationFeedback(res.message);
                    }}
                    className="p-4 rounded-xl bg-gradient-to-br from-amber-600/20 to-blue-600/20 hover:from-amber-600/30 hover:to-blue-600/30 border border-amber-500/40 text-left transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <Crown className="w-4 h-4 text-amber-400" />
                        VIP Пожизненный доступ (Навсегда)
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold uppercase">
                        Владелец
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Снимает лимит секций навсегда. Доступны Кухни, Шкафы, неограниченное число модулей на сцене.
                    </p>
                  </button>

                  <button
                    onClick={() => {
                      const res = activateKey('BPL-KITCHEN-PRO');
                      setActivationFeedback(res.message);
                    }}
                    className="p-4 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 text-left transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-blue-400" />
                        Кухни PRO на 90 дней
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold uppercase">
                        Фабрика
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Лицензия на модуль проектирования кухонь со снятым лимитом секций на 3 месяца.
                    </p>
                  </button>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Хотите проверить, как конструктор ведет себя у клиента без ключа?
                  </span>
                  <button
                    onClick={() => {
                      resetToDemo();
                      setActivationFeedback('Конструктор переведён в демонстрационный режим (лимит 8 секций).');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-amber-400 transition-colors flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Включить Демо-режим (для тестов)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ВКЛАДКА 3: РЕЕСТР ВЫДАННЫХ КЛЮЧЕЙ */}
          {activeTab === 'registry' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  placeholder="Поиск по имени клиента, ключу или договору..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />

                <span className="text-xs text-slate-400 font-medium">
                  Найдено: {filteredRegistry.length} из {registryKeys.length}
                </span>
              </div>

              {filteredRegistry.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-950/40 border border-slate-800 text-slate-500 text-xs">
                  {registryKeys.length === 0
                    ? 'Пока не сгенерировано ни одного ключа. Перейдите во вкладку «Выпуск нового ключа».'
                    : 'Ни один ключ не соответствует поисковому запросу.'}
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                  {filteredRegistry.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{item.clientName}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              item.tier === 'all_inclusive'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-blue-500/20 text-blue-300'
                            }`}
                          >
                            {item.tier === 'all_inclusive' ? 'VIP Всё включено' : 'Кухни PRO'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(item.issuedAt).toLocaleDateString('ru-RU')}
                          </span>
                        </div>

                        <div className="font-mono text-xs font-bold text-blue-400 tracking-wider">
                          {item.key}
                        </div>

                        {item.notes && <div className="text-[11px] text-slate-400 italic">{item.notes}</div>}
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <button
                          onClick={() => handleCopyKey(item.key)}
                          title="Скопировать ключ"
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleCopyCard(item)}
                          title="Скопировать текст сертификата"
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleActivateThisKey(item.key)}
                          title="Активировать этот ключ на текущем компьютере"
                          className="p-2 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-colors"
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteFromRegistry(item.id)}
                          title="Удалить из реестра"
                          className="p-2 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Подвал модального окна */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Криптографическая верификация SHA/HMAC • Все сгенерированные ключи валидны локально</span>
          </div>

          <button
            onClick={closeKeygen}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
