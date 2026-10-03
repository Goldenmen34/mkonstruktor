import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LicenseStatus } from '../types';
import { verifyAndDecodeLicenseKey } from '../utils/licenseManager';

interface LicenseStore {
  license: LicenseStatus;
  isKeyModalOpen: boolean;
  isKeygenOpen: boolean;
  openKeyModal: () => void;
  closeKeyModal: () => void;
  openKeygen: () => void;
  closeKeygen: () => void;
  activateKey: (keyString: string) => { success: boolean; message: string };
  activateDeveloperVip: () => { success: boolean; message: string };
  resetToDemo: () => void;
  isModuleLimitReached: (currentCount: number) => boolean;
}

const DEFAULT_DEMO_LICENSE: LicenseStatus = {
  key: 'DEMO-MODE',
  isValid: true,
  tier: 'demo',
  expiresAt: null,
  clientName: 'Демо доступ',
  maxModules: 8,
};

export const useLicenseStore = create<LicenseStore>()(
  persist(
    (set, get) => ({
      license: DEFAULT_DEMO_LICENSE,
      isKeyModalOpen: false,
      isKeygenOpen: false,

      openKeyModal: () => set({ isKeyModalOpen: true }),
      closeKeyModal: () => set({ isKeyModalOpen: false }),

      openKeygen: () => set({ isKeygenOpen: true }),
      closeKeygen: () => set({ isKeygenOpen: false }),

      activateKey: (keyString: string) => {
        const trimmed = keyString.trim().toUpperCase();
        if (!trimmed) {
          return { success: false, message: 'Пожалуйста, введите лицензионный ключ.' };
        }

        const verification = verifyAndDecodeLicenseKey(trimmed);
        if (verification.isValid) {
          const newLicense: LicenseStatus = {
            key: trimmed,
            isValid: true,
            tier: verification.tier,
            expiresAt: verification.expiresAt,
            clientName: verification.clientName,
            maxModules: 9999,
            issuedAt: new Date().toISOString(),
          };

          set({ license: newLicense, isKeyModalOpen: false });
          return {
            success: true,
            message: verification.message,
          };
        }

        return {
          success: false,
          message: verification.message || 'Неверный лицензионный ключ. Проверьте правильность ввода.',
        };
      },

      /**
       * Мгновенная активация бессрочной VIP лицензии разработчика
       */
      activateDeveloperVip: () => {
        const newLicense: LicenseStatus = {
          key: 'MK-PRO-LIFETIME',
          isValid: true,
          tier: 'all_inclusive',
          expiresAt: null,
          clientName: 'Разработчик / Владелец МКонструктор (VIP Бессрочно)',
          maxModules: 9999,
          issuedAt: new Date().toISOString(),
        };
        set({ license: newLicense, isKeyModalOpen: false, isKeygenOpen: false });
        return {
          success: true,
          message: 'Пожизненная VIP-лицензия успешно активирована! Демо-режим выключен навсегда.',
        };
      },

      /**
       * Сброс в демо-режим (для демонстрации клиентам)
       */
      resetToDemo: () => {
        set({ license: DEFAULT_DEMO_LICENSE });
      },

      isModuleLimitReached: (currentCount: number) => {
        const { license } = get();
        if (license.tier === 'demo' && currentCount >= license.maxModules) {
          return true;
        }
        return false;
      },
    }),
    {
      name: 'biplaner_license_storage',
      partialize: (state) => ({
        license: state.license,
      }),
    }
  )
);
