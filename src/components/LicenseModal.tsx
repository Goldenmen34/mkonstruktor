import React, { useState } from 'react';
import { KeyRound, X, CheckCircle, ShieldCheck, Sparkles, Crown } from 'lucide-react';
import { useLicenseStore } from '../store/useLicenseStore';

export const LicenseModal: React.FC = () => {
  const { isKeyModalOpen, closeKeyModal, license, activateKey, openKeygen } = useLicenseStore();
  const [inputKey, setInputKey] = useState('');
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  if (!isKeyModalOpen) return null;

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;

    const res = activateKey(inputKey);
    setFeedback(res);
  };

  const handleQuickFill = (key: string) => {
    setInputKey(key);
    const res = activateKey(key);
    setFeedback(res);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Заголовок */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Активация Лицензии SaaS</h3>
              <p className="text-xs text-slate-400">Управление подпиской и доступом к конструктору</p>
            </div>
          </div>

          <button
            onClick={closeKeyModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Текущий статус */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs">
            <div>
              <div className="text-slate-400">Текущий тариф:</div>
              <div className="text-sm font-bold text-white capitalize mt-0.5">
                {license.tier === 'demo' ? 'Демо-доступ (до 8 секций)' : license.clientName}
              </div>
            </div>
            <div className="text-right">
              <div className="text-slate-400">Срок действия:</div>
              <div className="text-xs font-semibold text-emerald-400 mt-0.5">
                {license.expiresAt
                  ? new Date(license.expiresAt).toLocaleDateString('ru-RU')
                  : 'Бессрочный (Демо)'}
              </div>
            </div>
          </div>

          {/* Форма ввода ключа */}
          <form onSubmit={handleActivate} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                Введите лицензионный ключ:
              </label>
              <input
                type="text"
                placeholder="BPL-XXXX-YYYY-ZZZZ"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono tracking-wider"
              />
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  feedback.success
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                }`}
              >
                {feedback.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
                <span>{feedback.message}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              Активировать подписку
            </button>
          </form>

          {/* Тестовые ключи для демонстрации заказчикам */}
          <div className="pt-2 border-t border-slate-800">
            <div className="text-[11px] text-slate-400 mb-2 flex items-center gap-1 font-medium">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Тестовые ключи для демонстрации работы:
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => handleQuickFill('BPL-VIP-2026')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono text-slate-300 transition-colors"
              >
                BPL-VIP-2026 (Все модули на 1 год)
              </button>
              <button
                onClick={() => handleQuickFill('BPL-KITCHEN-PRO')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono text-slate-300 transition-colors"
              >
                BPL-KITCHEN-PRO (Кухни)
              </button>
              <button
                onClick={() => handleQuickFill('BPL-WARDROBE-PRO')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono text-slate-300 transition-colors"
              >
                BPL-WARDROBE-PRO (Шкафы)
              </button>
            </div>
          </div>

          {/* Панель владельца: Генератор ключей */}
          <div className="pt-3 border-t border-slate-800">
            <button
              onClick={() => {
                closeKeyModal();
                openKeygen();
              }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600/20 via-blue-600/20 to-amber-600/20 hover:from-amber-600/30 hover:to-blue-600/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Crown className="w-4 h-4 text-amber-400" />
              Открыть Генератор Ключей (Панель владельца)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
