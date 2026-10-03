import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { OwnerMaterialItem, OwnerCategory, MaterialSection, SECTION_LABELS } from '../types/ownerMaterials';
import { INITIAL_CATEGORIES, INITIAL_OWNER_MATERIALS } from '../data/initialOwnerMaterials';
import { clearMaterialCache } from '../core/3d/materials';

// Словарь псевдонимов и совместимости для старых проектов и дефолтных настроек
export const LEGACY_MATERIAL_ALIASES: Record<string, string> = {
  facade_white_matte: 'agt_3012',
  facade_white_gloss: 'agt_601',
  facade_graphite: 'agt_3022',
  facade_cashmere: 'egger_u702',
  facade_dub_votan: 'egger_h434',
  facade_black_matte: 'agt_3010',
  facade_emerald: 'enamel_ncs_6010',
  carcass_white: 'carcass_white',
  carcass_grey: 'carcass_grey',
  carcass_dub: 'carcass_dub',
  ldsp_egger_w980: 'carcass_egger_w980',
  ldsp_egger_u732: 'carcass_grey',
  ldsp_egger_halifax: 'carcass_egger_h1180',
  ct_kedr_votan_38: 'countertop_votan',
  ct_slotex_carrara: 'countertop_marble',
};

interface MaterialsStoreState {
  // Категории и дерево
  categories: OwnerCategory[];

  // База материалов
  items: OwnerMaterialItem[];

  // Состояние веб-кабинета собственника
  isOwnerCabinetOpen: boolean;
  openOwnerCabinet: () => void;
  closeOwnerCabinet: () => void;

  // Защита ПИН-кодом (опционально)
  pinCode: string | null; // null = без пароля
  isPinLocked: boolean;
  authenticatePin: (pin: string) => boolean;
  setPinCode: (pin: string | null) => void;
  unlockWithPin: () => void;
  lockCabinet: () => void;

  // CRUD операции с категориями
  addCategory: (name: string, parentId?: string | null, section?: MaterialSection) => OwnerCategory;
  updateCategory: (id: string, updates: Partial<Pick<OwnerCategory, 'name' | 'parentId' | 'section' | 'order'>>) => void;
  deleteCategory: (id: string) => void;

  // CRUD операции с позициями
  addItem: (item: Omit<OwnerMaterialItem, 'id' | 'updatedAt'>) => OwnerMaterialItem;
  updateItem: (id: string, updates: Partial<OwnerMaterialItem>) => void;
  deleteItem: (id: string) => void;
  toggleItemActive: (id: string) => void;

  // Массовое управление наценками
  updateBrandMultiplier: (brand: string, multiplier: number) => void;
  updateCategoryMultiplier: (categoryId: string, multiplier: number) => void;

  // Экспорт / Импорт / Сброс
  resetToDefaultMaterials: () => void;
  exportMaterialsJson: () => string;
  importMaterialsJson: (jsonStr: string) => boolean;
  batchImportMaterials: (params: {
    brand: string;
    sections: MaterialSection[];
    categories: string[];
    items: Omit<OwnerMaterialItem, 'id' | 'updatedAt' | 'categoryId'>[];
  }) => { importedCount: number };
  repairMissingColors: () => Promise<void>;
  repairCategoriesAndSync: () => void;

  // Хелперы и селекторы
  getCategoryPath: (categoryId: string) => OwnerCategory[];
  getAllSubcategoryIds: (categoryId: string) => string[];
  getItemCountForCategory: (categoryId: string) => number;
  getActiveItems: () => OwnerMaterialItem[];
  getActiveItemsBySection: (section: MaterialSection) => OwnerMaterialItem[];
  getItemById: (id: string) => OwnerMaterialItem | undefined;
}

function inferColorFromName(name: string, category: string = ''): string {
  const n = (name + ' ' + category).toLowerCase();
  if (n.includes('белый') || n.includes('алебастр') || n.includes('платиновый') || n.includes('white') || n.includes('снег') || n.includes('арктика')) return '#F8F9FA';
  if (n.includes('черный') || n.includes('чёрный') || n.includes('black') || n.includes('графит') || n.includes('антрацит')) return '#2B2D42';
  if (n.includes('серый') || n.includes('grey') || n.includes('gray') || n.includes('чипполино') || n.includes('бетон')) return '#9E9E9E';
  if (n.includes('кашемир') || n.includes('крем') || n.includes('ваниль') || n.includes('песок') || n.includes('бежевый') || n.includes('беж') || n.includes('коттон')) return '#E8D8C8';
  if (n.includes('желтый') || n.includes('жёлтый') || n.includes('шафран') || n.includes('карри') || n.includes('кукуруз') || n.includes('бархат') || n.includes('цитрус') || n.includes('бриллиант')) return '#F5C000';
  if (n.includes('зеленый') || n.includes('зелёный') || n.includes('олива') || n.includes('мят')) return '#5C8374';
  if (n.includes('синий') || n.includes('голуб') || n.includes('индиго') || n.includes('морск')) return '#274C77';
  if (n.includes('красный') || n.includes('бордо') || n.includes('терракот')) return '#B83B3B';
  if (n.includes('дуб') || n.includes('ясень') || n.includes('вяз') || n.includes('орех') || n.includes('дерев') || n.includes('древес') || n.includes('сосна') || n.includes('бук') || n.includes('баменда') || n.includes('робиния') || n.includes('лион') || n.includes('тоссини')) return '#B89772';
  if (n.includes('мрамор') || n.includes('каррара') || n.includes('камень') || n.includes('металл') || n.includes('керамо') || n.includes('керамика')) return '#D1D5DB';
  return '#B89772';
}

function notifyMaterialUpdate(): void {
  clearMaterialCache();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('biplaner:materials-updated'));
  }
}

export const useMaterialsStore = create<MaterialsStoreState>()(
  persist(
    (set, get) => ({
      categories: INITIAL_CATEGORIES,
      items: INITIAL_OWNER_MATERIALS,

      isOwnerCabinetOpen: false,
      openOwnerCabinet: () => {
        const { pinCode } = get();
        set({
          isOwnerCabinetOpen: true,
          isPinLocked: Boolean(pinCode && pinCode.trim().length > 0),
        });
      },
      closeOwnerCabinet: () => set({ isOwnerCabinetOpen: false }),

      pinCode: null,
      isPinLocked: false,
      authenticatePin: (pin: string) => {
        const { pinCode } = get();
        if (!pinCode || pin.trim() === pinCode.trim()) {
          set({ isPinLocked: false });
          return true;
        }
        return false;
      },
      setPinCode: (pin: string | null) => {
        const sanitized = pin && pin.trim().length > 0 ? pin.trim() : null;
        set({ pinCode: sanitized, isPinLocked: false });
      },
      unlockWithPin: () => set({ isPinLocked: false }),
      lockCabinet: () => {
        const { pinCode } = get();
        if (pinCode) {
          set({ isPinLocked: true });
        }
      },

      // --- Категории CRUD ---
      addCategory: (name, parentId = null, section) => {
        const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const stateCategories = get().categories && get().categories.length > 0 ? get().categories : INITIAL_CATEGORIES;

        let derivedSection = section;
        if (!derivedSection && parentId) {
          const parent = stateCategories.find((c) => c.id === parentId);
          if (parent?.section) derivedSection = parent.section;
        }

        const newCat: OwnerCategory = {
          id,
          name: name.trim(),
          parentId: parentId || null,
          section: derivedSection || 'other',
          order: stateCategories.length + 1,
        };

        set({
          categories: [...stateCategories, newCat],
        });

        notifyMaterialUpdate();
        return newCat;
      },

      updateCategory: (id, updates) => {
        const stateCategories = get().categories && get().categories.length > 0 ? get().categories : INITIAL_CATEGORIES;
        set({
          categories: stateCategories.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        });
        notifyMaterialUpdate();
      },

      deleteCategory: (id) => {
        const { categories, items, getAllSubcategoryIds } = get();
        const catList = categories && categories.length > 0 ? categories : INITIAL_CATEGORIES;
        const target = catList.find((c) => c.id === id);
        // Защита: корневые системные категории (parentId === null) удалять нельзя
        if (!target || target.parentId === null) {
          console.warn(`[useMaterialsStore] Deletion of root category '${id}' is prohibited.`);
          return;
        }
        const idsToDelete = new Set(getAllSubcategoryIds(id));

        const updatedCategories = catList.filter((c) => !idsToDelete.has(c.id));
        const updatedItems = items.filter((it) => !idsToDelete.has(it.categoryId));

        set({
          categories: updatedCategories,
          items: updatedItems,
        });

        notifyMaterialUpdate();
      },

      // --- Позиции CRUD ---
      addItem: (itemData) => {
        const id = `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const clientPrice = Math.round(itemData.costPrice * itemData.markupMultiplier);

        let itemSection = itemData.section;
        if (!itemSection) {
          const cat = (get().categories || INITIAL_CATEGORIES).find((c) => c.id === itemData.categoryId);
          itemSection = cat?.section || 'other';
        }

        const newItem: OwnerMaterialItem = {
          ...itemData,
          section: itemSection,
          id,
          clientPrice,
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          items: [newItem, ...state.items],
        }));

        notifyMaterialUpdate();
        return newItem;
      },

      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id !== id) return item;
            const updated = { ...item, ...updates, updatedAt: new Date().toISOString() };
            if ('costPrice' in updates || 'markupMultiplier' in updates) {
              const cost = updates.costPrice !== undefined ? updates.costPrice : item.costPrice;
              const mult = updates.markupMultiplier !== undefined ? updates.markupMultiplier : item.markupMultiplier;
              updated.clientPrice = Math.round(cost * mult);
            }
            return updated;
          }),
        }));

        notifyMaterialUpdate();
      },

      deleteItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));

        notifyMaterialUpdate();
      },

      toggleItemActive: (id) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? { ...item, isActive: !item.isActive, updatedAt: new Date().toISOString() }
              : item
          ),
        }));

        notifyMaterialUpdate();
      },

      updateBrandMultiplier: (brand, multiplier) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.brand.toLowerCase() !== brand.toLowerCase()) return item;
            const clientPrice = Math.round(item.costPrice * multiplier);
            return {
              ...item,
              markupMultiplier: multiplier,
              clientPrice,
              updatedAt: new Date().toISOString(),
            };
          }),
        }));

        notifyMaterialUpdate();
      },

      updateCategoryMultiplier: (categoryId, multiplier) => {
        const { getAllSubcategoryIds } = get();
        const categoryIds = new Set(getAllSubcategoryIds(categoryId));

        set((state) => ({
          items: state.items.map((item) => {
            if (!categoryIds.has(item.categoryId)) {
              return item;
            }
            const clientPrice = Math.round(item.costPrice * multiplier);
            return {
              ...item,
              markupMultiplier: multiplier,
              clientPrice,
              updatedAt: new Date().toISOString(),
            };
          }),
        }));

        notifyMaterialUpdate();
      },

      resetToDefaultMaterials: () => {
        set({
          categories: INITIAL_CATEGORIES,
          items: INITIAL_OWNER_MATERIALS,
        });

        notifyMaterialUpdate();
      },

      exportMaterialsJson: () => {
        const { categories, items } = get();
        const exportData = {
          version: '3.0',
          exportedAt: new Date().toISOString(),
          totalCategories: categories.length,
          totalItems: items.length,
          categories,
          items,
        };
        return JSON.stringify(exportData, null, 2);
      },

      importMaterialsJson: (jsonStr: string) => {
        try {
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
            set({ categories: parsed.categories });
          }
          if (Array.isArray(parsed.items) && parsed.items.length > 0) {
            set({ items: parsed.items });
            notifyMaterialUpdate();
            return true;
          }
          if (Array.isArray(parsed) && parsed.length > 0) {
            set({ items: parsed });
            notifyMaterialUpdate();
            return true;
          }
          return false;
        } catch (e) {
          console.error('Ошибка при импорте JSON материалов:', e);
          return false;
        }
      },

      /**
       * Массовый импорт декоров из папки или архива:
       * Создает категории бренда и подкатегорий для каждого выбранного раздела,
       * добавляет декоры и обновляет кеш Three.js.
       */
      batchImportMaterials: (params) => {
        const { brand, sections, categories: categoryNames, items: rawItems } = params;
        const currentCategories = [...get().categories];
        const currentItems = [...get().items];

        const sectionRootDefaults: Record<string, { id: string; name: string }> = {
          ldsp: { id: 'cat_ldsp', name: 'Корпус (ЛДСП)' },
          facade: { id: 'cat_facades', name: 'Фасады' },
          countertop: { id: 'cat_countertops', name: 'Столешницы и стеновые панели' },
          apron: { id: 'cat_aprons', name: 'Фартуки (Стеновые панели)' },
        };

        let addedCount = 0;
        const now = new Date().toISOString();

        for (const section of sections) {
          // 1. Корневая категория раздела
          let rootCat = currentCategories.find(
            (c) => (c.section === section || c.id === sectionRootDefaults[section]?.id) && (!c.parentId || c.parentId === null)
          );
          if (!rootCat) {
            const def = sectionRootDefaults[section] || {
              id: `cat_${section}`,
              name: SECTION_LABELS[section] || section,
            };
            rootCat = {
              id: def.id,
              name: def.name,
              parentId: null,
              section,
              order: currentCategories.length + 1,
            };
            currentCategories.push(rootCat);
          }

          // 2. Умный поиск существующей категории бренда (например "EGGER" -> "Egger" или "Egger Фасады")
          const cleanBrand = brand.trim().toLowerCase();
          let brandCat = currentCategories.find((c) => {
            if (c.parentId !== rootCat!.id) return false;
            const cName = c.name.trim().toLowerCase();
            return (
              cName === cleanBrand ||
              cName.startsWith(cleanBrand + ' ') ||
              cName.startsWith(cleanBrand + ' /') ||
              cleanBrand.startsWith(cName + ' ') ||
              cName.includes(cleanBrand)
            );
          });

          if (!brandCat) {
            brandCat = {
              id: `cat_${section}_${brand.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
              name: brand,
              parentId: rootCat!.id,
              section,
              order: currentCategories.filter((c) => c.parentId === rootCat!.id).length + 1,
            };
            currentCategories.push(brandCat);
          } else {
            // Если категория найдена (например "Egger Фасады"), нормализуем ее отображаемое имя до "Egger"
            if (brandCat.name.toLowerCase().startsWith(cleanBrand)) {
              brandCat.name = brand;
            }
          }

          // 3. Подкатегории: ищем совпадение (например "Древесные" -> "Древесные декоры" или "Древесные Feelwood")
          const subCatMap = new Map<string, string>();
          for (const catName of categoryNames) {
            const cleanCat = catName.trim().toLowerCase();
            let subCat = currentCategories.find((c) => {
              if (c.parentId !== brandCat!.id) return false;
              const cName = c.name.trim().toLowerCase();
              return (
                cName === cleanCat ||
                cName.startsWith(cleanCat + ' ') ||
                cleanCat.startsWith(cName + ' ') ||
                cName.includes(cleanCat)
              );
            });

            if (!subCat) {
              subCat = {
                id: `cat_${section}_${brandCat.id}_${catName.toLowerCase().replace(/[^a-z0-9а-я]/gi, '_')}`,
                name: catName,
                parentId: brandCat.id,
                section,
                order: currentCategories.filter((c) => c.parentId === brandCat!.id).length + 1,
              };
              currentCategories.push(subCat);
            }
            subCatMap.set(catName, subCat.id);
          }

          // 4. Добавляем материалы
          for (const item of rawItems) {
            // Если позиция уже привязана к разделу (например, из import-folder), обрабатываем ее только для этого раздела
            if (item.section && item.section !== section) {
              continue;
            }

            const catId = subCatMap.get(item.category || 'Общие') || brandCat.id;
            const safeArt = (item.article || item.name || '').replace(/[^a-zA-Z0-9_-]/g, '_');
            const itemId = (item as any).id || `mat_${brand.toLowerCase()}_${section}_${safeArt}`;

            const newItem: OwnerMaterialItem = {
              ...item,
              id: itemId,
              categoryId: catId,
              section,
              brand,
              updatedAt: now,
            };

            const existingIdx = currentItems.findIndex((it) => it.id === itemId);
            if (existingIdx >= 0) {
              currentItems[existingIdx] = newItem;
            } else {
              currentItems.push(newItem);
              addedCount++;
            }
          }
        }

        set({
          categories: currentCategories,
          items: currentItems,
        });

        notifyMaterialUpdate();
        return { importedCount: addedCount };
      },

      /**
       * Проверка и автоматическое восстановление целостности дерева категорий:
       * 1. Гарантирует наличие корневых категорий (Фасады, Корпус, Столешницы).
       * 2. Устраняет дубликаты категорий бренда (например, дубль "EGGER" и "Egger").
       * 3. Перепривязывает осиротевшие декоры.
       */
      repairCategoriesAndSync: () => {
        const { categories, items } = get();
        let catList = [...(categories && categories.length > 0 ? categories : INITIAL_CATEGORIES)];
        let itemsList = [...items];
        let hasChanges = false;

        // 1. Приводим имена и порядок системных корневых категорий (Фасады - первые, Корпус - второй)
        catList = catList.map((c) => {
          if (c.id === 'cat_facades') {
            if (c.name !== 'Фасады' || c.order !== 1 || c.parentId !== null) {
              hasChanges = true;
              return { ...c, name: 'Фасады', parentId: null, section: 'facade' as MaterialSection, order: 1 };
            }
          }
          if (c.id === 'cat_ldsp') {
            if (c.name !== 'Корпус (ЛДСП)' || c.order !== 2 || c.parentId !== null) {
              hasChanges = true;
              return { ...c, name: 'Корпус (ЛДСП)', parentId: null, section: 'ldsp' as MaterialSection, order: 2 };
            }
          }
          if (c.id === 'cat_countertops' && c.order !== 3) {
            hasChanges = true;
            return { ...c, order: 3 };
          }
          if (c.id === 'cat_hardware' && c.order !== 4) {
            hasChanges = true;
            return { ...c, order: 4 };
          }
          if (c.id === 'cat_facade_egger' && c.name !== 'Egger') {
            hasChanges = true;
            return { ...c, name: 'Egger' };
          }
          return c;
        });

        // 2. Гарантируем, что корневые категории обязательно присутствуют
        const requiredRoots: { id: string; name: string; section: MaterialSection; order: number }[] = [
          { id: 'cat_facades', name: 'Фасады', section: 'facade', order: 1 },
          { id: 'cat_ldsp', name: 'Корпус (ЛДСП)', section: 'ldsp', order: 2 },
          { id: 'cat_countertops', name: 'Столешницы и стеновые панели', section: 'countertop', order: 3 },
          { id: 'cat_hardware', name: 'Фурнитура и крепеж', section: 'hardware', order: 4 },
        ];

        for (const req of requiredRoots) {
          const exists = catList.some(
            (c) => (c.id === req.id || c.section === req.section) && (!c.parentId || c.parentId === null)
          );
          if (!exists) {
            const defRoot = INITIAL_CATEGORIES.find((c) => c.id === req.id) || {
              id: req.id,
              name: req.name,
              parentId: null,
              section: req.section,
              order: req.order,
            };
            catList.push(defRoot);
            // Добавляем дефолтных детей для восстановленного корня
            const defChildren = INITIAL_CATEGORIES.filter((c) => c.parentId === req.id);
            for (const child of defChildren) {
              if (!catList.some((c) => c.id === child.id)) {
                catList.push(child);
                const subChildren = INITIAL_CATEGORIES.filter((c) => c.parentId === child.id);
                for (const sub of subChildren) {
                  if (!catList.some((c) => c.id === sub.id)) {
                    catList.push(sub);
                  }
                }
              }
            }
            hasChanges = true;
          }
        }

        // 3. Устраняем дубликаты категории бренда EGGER под Фасадами
        const facadeRoot = catList.find(
          (c) => (c.id === 'cat_facades' || c.section === 'facade') && (!c.parentId || c.parentId === null)
        );
        if (facadeRoot) {
          const eggerCats = catList.filter(
            (c) =>
              c.parentId === facadeRoot.id &&
              c.name.trim().toLowerCase().startsWith('egger')
          );
          if (eggerCats.length > 1) {
            // Каноническая категория бренда - cat_facade_egger (или первая)
            let canonical = eggerCats.find((c) => c.id === 'cat_facade_egger') || eggerCats[0];
            canonical.name = 'Egger';

            const duplicates = eggerCats.filter((c) => c.id !== canonical.id);
            for (const dup of duplicates) {
              // Переводим все подкатегории дубликата на canonical
              catList = catList.map((c) => (c.parentId === dup.id ? { ...c, parentId: canonical.id } : c));
              // Переводим позиции на canonical
              itemsList = itemsList.map((it) => (it.categoryId === dup.id ? { ...it, categoryId: canonical.id } : it));
              // Удаляем дубликат бренда
              catList = catList.filter((c) => c.id !== dup.id);
              hasChanges = true;
            }
          }
        }

        // 4. Аналогично устраняем дубликаты под Корпусом (ЛДСП)
        const ldspRoot = catList.find(
          (c) => (c.id === 'cat_ldsp' || c.section === 'ldsp') && (!c.parentId || c.parentId === null)
        );
        if (ldspRoot) {
          const eggerCats = catList.filter(
            (c) =>
              c.parentId === ldspRoot.id &&
              c.name.trim().toLowerCase() === 'egger'
          );
          if (eggerCats.length > 1) {
            let canonical = eggerCats.find((c) => c.id === 'cat_ldsp_egger') || eggerCats[0];
            canonical.name = 'Egger';
            const duplicates = eggerCats.filter((c) => c.id !== canonical.id);
            for (const dup of duplicates) {
              catList = catList.map((c) => (c.parentId === dup.id ? { ...c, parentId: canonical.id } : c));
              itemsList = itemsList.map((it) => (it.categoryId === dup.id ? { ...it, categoryId: canonical.id } : it));
              catList = catList.filter((c) => c.id !== dup.id);
              hasChanges = true;
            }
          }
        }

        // 5. Проверяем материалы: если у декора categoryId указывает на несуществующую категорию,
        // но у него указан section и brand, привязываем его к правильной категории
        const catIdSet = new Set(catList.map((c) => c.id));
        itemsList = itemsList.map((item) => {
          if (!catIdSet.has(item.categoryId)) {
            hasChanges = true;
            if (item.section === 'facade' && facadeRoot) {
              const egger = catList.find((c) => c.parentId === facadeRoot.id && c.name.toLowerCase().includes('egger'));
              return { ...item, categoryId: egger?.id || facadeRoot.id };
            }
            if (item.section === 'ldsp' && ldspRoot) {
              const egger = catList.find((c) => c.parentId === ldspRoot.id && c.name.toLowerCase().includes('egger'));
              return { ...item, categoryId: egger?.id || ldspRoot.id };
            }
          }
          return item;
        });

        if (hasChanges) {
          set({
            categories: catList,
            items: itemsList,
          });
          notifyMaterialUpdate();
        }
      },

      /**
       * Автоматическое восстановление и синхронизация цветов декоров из текстур:
       * Опрашивает сервер /api/materials/all-texture-colors и сопоставляет hex цвета с текстурами,
       * а также устраняет застрявший fallback цвет #C79F70.
       */
      repairMissingColors: async () => {
        try {
          const res = await fetch('/api/materials/all-texture-colors');
          const data = res.ok ? await res.json() : null;
          const colorMap: Record<string, string> = data?.success && data?.colorMap ? data.colorMap : {};

          const currentItems = get().items;
          let changed = false;

          const updatedItems = currentItems.map((item) => {
            const imgPath = item.imageUrl || item.textureUrl;
            let matchedColor: string | undefined;

            if (imgPath) {
              const fileName = decodeURIComponent(imgPath.split('/').pop() || '');
              if (colorMap[fileName]) {
                matchedColor = colorMap[fileName];
              }
            }

            if (!matchedColor && item.name) {
              const cleanItemName = item.name.trim().toLowerCase();
              const decorKey = Object.keys(colorMap).find((k) =>
                k.toLowerCase().includes(cleanItemName)
              );
              if (decorKey) {
                matchedColor = colorMap[decorKey];
              }
            }

            // Если не нашли в текстурах, но цвет дефолтный беж #C79F70
            if (!matchedColor && (item.color === '#C79F70' || !item.color)) {
              matchedColor = inferColorFromName(item.name, item.category);
            }

            if (matchedColor && (item.color !== matchedColor || item.color === '#C79F70' || !item.color)) {
              changed = true;
              return {
                ...item,
                color: matchedColor,
                updatedAt: new Date().toISOString(),
              };
            }

            return item;
          });

          if (changed) {
            set({ items: updatedItems });
            notifyMaterialUpdate();
          }
        } catch {
          // тихо пропускаем в оффлайн режиме
        }
      },

      // --- Хелперы и селекторы ---
      getCategoryPath: (categoryId: string) => {
        const { categories } = get();
        const catList = categories && categories.length > 0 ? categories : INITIAL_CATEGORIES;
        const path: OwnerCategory[] = [];
        let currId: string | null | undefined = categoryId;
        const visited = new Set<string>();

        while (currId && !visited.has(currId)) {
          visited.add(currId);
          const cat = catList.find((c) => c.id === currId);
          if (!cat) break;
          path.unshift(cat);
          currId = cat.parentId;
        }
        return path;
      },

      getAllSubcategoryIds: (categoryId: string) => {
        const { categories } = get();
        const catList = categories && categories.length > 0 ? categories : INITIAL_CATEGORIES;
        const result: string[] = [categoryId];

        const findChildren = (parentId: string) => {
          for (const cat of catList) {
            if (cat.parentId === parentId) {
              result.push(cat.id);
              findChildren(cat.id);
            }
          }
        };
        findChildren(categoryId);
        return result;
      },

      getItemCountForCategory: (categoryId: string) => {
        const { items, getAllSubcategoryIds } = get();
        const subIds = new Set(getAllSubcategoryIds(categoryId));
        return items.filter((it) => subIds.has(it.categoryId)).length;
      },

      getActiveItems: () => {
        return get().items.filter((item) => item.isActive);
      },

      getActiveItemsBySection: (section: MaterialSection) => {
        return get().items.filter((item) => item.section === section && item.isActive);
      },

      getItemById: (id: string) => {
        if (!id) return undefined;
        const { items } = get();

        // 1. Прямой поиск
        let found = items.find((item) => item.id === id);
        if (found) return found;

        // 2. Поиск по алиасам (carcass_white -> krono_0101, facade_white_matte -> agt_3012 и т.д.)
        const aliased = LEGACY_MATERIAL_ALIASES[id];
        if (aliased) {
          found = items.find((item) => item.id === aliased);
          if (found) return found;
        }

        // 3. Поиск с префиксом/без префикса (например egger_w980 <-> ldsp_egger_w980)
        const strippedId = id.replace(/^(ldsp_|carcass_|ct_|hw_|facade_)/, '');
        found = items.find((item) => {
          const itemStripped = item.id.replace(/^(ldsp_|carcass_|ct_|hw_|facade_)/, '');
          return itemStripped === strippedId;
        });

        return found;
      },
    }),
    {
      name: 'biplaner_materials_unified_v5',
      version: 5,
      migrate: (persistedState: any, version: number) => {
        if (version < 5 || !persistedState || !persistedState.items || persistedState.items.length < 90) {
          return {
            ...persistedState,
            categories: INITIAL_CATEGORIES,
            items: INITIAL_OWNER_MATERIALS,
          };
        }
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (!state.items || state.items.length < 90) {
            useMaterialsStore.setState({
              categories: INITIAL_CATEGORIES,
              items: INITIAL_OWNER_MATERIALS,
            });
          }
          // Очистка устаревших ключей из предыдущих тестовых версий
          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              window.localStorage.removeItem('biplaner_owner_materials_storage_v1');
              window.localStorage.removeItem('biplaner_owner_materials_storage_v2');
              window.localStorage.removeItem('biplaner_owner_materials_storage_v3');
            } catch {
              // Игнорируем ограничения доступа к localStorage
            }

            // Фоновое восстановление категорий и синхронизация цветов текстур
            setTimeout(() => {
              useMaterialsStore.getState().repairCategoriesAndSync?.();
              useMaterialsStore.getState().repairMissingColors?.();
            }, 300);
          }
        }
      },
    }
  )
);
