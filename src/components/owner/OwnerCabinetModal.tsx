import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Plus,
  Search,
  Upload,
  Download,
  RotateCcw,
  Check,
  Trash2,
  Edit2,
  Layers,
  Lock,
  Unlock,
  KeyRound,
  TrendingUp,
  Package,
  Box,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Folder,
  FolderOpen,
  FolderUp,
  AlertTriangle,
  Sparkles,
  Sliders,
  DollarSign,
  ShieldAlert,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Palette,
} from 'lucide-react';
import { useMaterialsStore } from '../../store/useMaterialsStore';
import {
  MaterialSection,
  PriceUnit,
  OwnerMaterialItem,
  OwnerCategory,
  SECTION_LABELS,
  UNIT_LABELS,
  UNIT_SHORT,
} from '../../types/ownerMaterials';
import { clearMaterialCache } from '../../core/3d/materials';
import { BatchImportMaterialsModal } from './BatchImportMaterialsModal';

export const OwnerCabinetModal: React.FC = () => {
  const {
    categories,
    items,
    isOwnerCabinetOpen,
    closeOwnerCabinet,
    pinCode,
    isPinLocked,
    authenticatePin,
    setPinCode,
    addCategory,
    updateCategory,
    deleteCategory,
    addItem,
    updateItem,
    deleteItem,
    toggleItemActive,
    updateBrandMultiplier,
    updateCategoryMultiplier,
    resetToDefaultMaterials,
    exportMaterialsJson,
    importMaterialsJson,
    repairMissingColors,
    getCategoryPath,
    getAllSubcategoryIds,
    getItemCountForCategory,
  } = useMaterialsStore();

  const [isSyncingColors, setIsSyncingColors] = useState(false);

  // --------------------------------------------------------------------------
  // Состояния фильтрации и навигации
  // --------------------------------------------------------------------------
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // --------------------------------------------------------------------------
  // Модальные окна и формы
  // --------------------------------------------------------------------------
  // Редактирование / добавление категории
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catFormName, setCatFormName] = useState<string>('');
  const [catFormParentId, setCatFormParentId] = useState<string | null>(null);
  const [catFormSection, setCatFormSection] = useState<MaterialSection>('other');

  // Удаление категории с подтверждением
  const [categoryToDelete, setCategoryToDelete] = useState<OwnerCategory | null>(null);

  // Редактирование / добавление позиции
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<OwnerMaterialItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<OwnerMaterialItem | null>(null);

  // Поля формы позиции
  const [formName, setFormName] = useState<string>('');
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formBrand, setFormBrand] = useState<string>('');
  const [formArticle, setFormArticle] = useState<string>('');
  const [formSupplier, setFormSupplier] = useState<string>('');
  const [formUnit, setFormUnit] = useState<PriceUnit>('sheet');
  const [formStock, setFormStock] = useState<number>(100);
  const [formCostPrice, setFormCostPrice] = useState<number>(4100);
  const [formMarkup, setFormMarkup] = useState<number>(1.6);
  const [formClientPrice, setFormClientPrice] = useState<number>(6560);
  const [formColor, setFormColor] = useState<string>('#F4F5F7');
  const [formImageUrl, setFormImageUrl] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  // Массовый импорт декоров из папок / архивов
  const [isBatchImportModalOpen, setIsBatchImportModalOpen] = useState<boolean>(false);

  // Массовая наценка
  const [isBatchMarkupOpen, setIsBatchMarkupOpen] = useState<boolean>(false);
  const [batchTargetType, setBatchTargetType] = useState<'brand' | 'category'>('brand');
  const [batchBrand, setBatchBrand] = useState<string>('');
  const [batchCategoryId, setBatchCategoryId] = useState<string>('');
  const [batchMultiplier, setBatchMultiplier] = useState<number>(1.6);

  // ПИН-код
  const [isPinSettingsOpen, setIsPinSettingsOpen] = useState<boolean>(false);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [newPinInput, setNewPinInput] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonImportRef = useRef<HTMLInputElement>(null);

  // Дерево категорий (parentId -> children)
  const categoryTree = useMemo(() => {
    const map = new Map<string | null, OwnerCategory[]>();
    categories.forEach((cat) => {
      const pId = cat.parentId || null;
      if (!map.has(pId)) {
        map.set(pId, []);
      }
      map.get(pId)!.push(cat);
    });

    // Приоритеты для корневых категорий (Фасады строго на самом верху, затем Корпус, Столешницы, Фурнитура)
    const rootPriority: Record<string, number> = {
      facade: 1,
      ldsp: 2,
      countertop: 3,
      apron: 4,
      hardware: 5,
      edge: 6,
      services: 7,
      glass: 8,
      other: 10,
    };

    // Сортировка по приоритету корня, полю order или имени
    map.forEach((list, parentId) => {
      list.sort((a, b) => {
        if (parentId === null) {
          const isFacadeA = a.id === 'cat_facades' || a.section === 'facade';
          const isFacadeB = b.id === 'cat_facades' || b.section === 'facade';
          if (isFacadeA && !isFacadeB) return -1;
          if (!isFacadeA && isFacadeB) return 1;

          const prioA = rootPriority[a.section || 'other'] ?? (a.order || 99);
          const prioB = rootPriority[b.section || 'other'] ?? (b.order || 99);
          if (prioA !== prioB) return prioA - prioB;
        }
        return (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name);
      });
    });

    return map;
  }, [categories]);

  // Плоский список категорий с путями, строго упорядоченный по иерархии дерева (Фасады наверху)
  const flattenedCategoryOptions = useMemo(() => {
    const result: { id: string; name: string; path: string }[] = [];
    const traverse = (parentId: string | null = null) => {
      const nodes = categoryTree.get(parentId) || [];
      for (const node of nodes) {
        const path = getCategoryPath(node.id).map((p) => p.name).join(' → ');
        result.push({ id: node.id, name: node.name, path: path || node.name });
        traverse(node.id);
      }
    };
    traverse(null);
    return result;
  }, [categoryTree, getCategoryPath]);

  // Список всех доступных брендов
  const allBrands = useMemo(() => {
    const bSet = new Set<string>();
    items.forEach((it) => {
      if (it.brand && it.brand.trim()) bSet.add(it.brand.trim());
    });
    return Array.from(bSet).sort();
  }, [items]);

  // Активная выбранная категория
  const currentCategory = useMemo(() => {
    if (selectedCategoryId === 'all') return null;
    return categories.find((c) => c.id === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  // Фильтрация позиций
  const filteredItems = useMemo(() => {
    let result = items;

    // 1. Фильтр по категории (включая все дочерние подкатегории)
    if (selectedCategoryId !== 'all') {
      const allowedCatIds = new Set(getAllSubcategoryIds(selectedCategoryId));
      result = result.filter((it) => allowedCatIds.has(it.categoryId));
    }

    // 2. Фильтр по бренду
    if (selectedBrand !== 'all') {
      result = result.filter((it) => it.brand.toLowerCase() === selectedBrand.toLowerCase());
    }

    // 3. Поиск (по названию, артикулу, поставщику, бренду)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((it) => {
        const matchName = it.name.toLowerCase().includes(q);
        const matchArticle = (it.article || '').toLowerCase().includes(q);
        const matchSupplier = (it.supplier || '').toLowerCase().includes(q);
        const matchBrand = (it.brand || '').toLowerCase().includes(q);
        return matchName || matchArticle || matchSupplier || matchBrand;
      });
    }

    return result;
  }, [items, selectedCategoryId, selectedBrand, searchQuery, getAllSubcategoryIds]);

  const getAllDescendantCategoryIds = (targetId: string): string[] => {
    const ids: string[] = [];
    const collect = (id: string) => {
      const children = categoryTree.get(id) || [];
      for (const child of children) {
        ids.push(child.id);
        collect(child.id);
      }
    };
    collect(targetId);
    return ids;
  };

  // Переключение раскрытия узла дерева (при закрытии сбрасывает все вложенные ветки)
  const toggleExpand = (catId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedCategories((prev) => {
      const isCurrentlyExpanded = prev[catId] ?? false;
      if (isCurrentlyExpanded) {
        const descendants = getAllDescendantCategoryIds(catId);
        const next = { ...prev, [catId]: false };
        for (const dId of descendants) {
          next[dId] = false;
        }
        return next;
      } else {
        return {
          ...prev,
          [catId]: true,
        };
      }
    });
  };

  // --------------------------------------------------------------------------
  // Действия с категориями
  // --------------------------------------------------------------------------
  const handleOpenAddCategory = (parentId: string | null = null, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingCategoryId(null);
    setCatFormName('');
    setCatFormParentId(parentId);
    const parent = parentId ? categories.find((c) => c.id === parentId) : null;
    setCatFormSection(parent?.section || 'other');
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: OwnerCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCategoryId(cat.id);
    setCatFormName(cat.name);
    setCatFormParentId(cat.parentId || null);
    setCatFormSection(cat.section || 'other');
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catFormName.trim()) return;

    if (editingCategoryId) {
      updateCategory(editingCategoryId, {
        name: catFormName.trim(),
        parentId: catFormParentId,
        section: catFormSection,
      });
    } else {
      const newCat = addCategory(catFormName.trim(), catFormParentId, catFormSection);
      // Раскрываем родителя
      if (catFormParentId) {
        setExpandedCategories((prev) => ({ ...prev, [catFormParentId]: true }));
      }
      setSelectedCategoryId(newCat.id);
    }
    setIsCategoryModalOpen(false);
  };

  const handleConfirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    deleteCategory(categoryToDelete.id);
    if (selectedCategoryId === categoryToDelete.id) {
      setSelectedCategoryId('all');
    }
    setCategoryToDelete(null);
  };

  // --------------------------------------------------------------------------
  // Действия с позициями
  // --------------------------------------------------------------------------
  const handleOpenAddItem = (prefilledCatId?: string) => {
    setEditingItem(null);
    const targetCatId =
      prefilledCatId && prefilledCatId !== 'all'
        ? prefilledCatId
        : selectedCategoryId !== 'all'
        ? selectedCategoryId
        : categories[0]?.id || '';

    const parentCat = categories.find((c) => c.id === targetCatId);

    setFormName('');
    setFormCategoryId(targetCatId);
    setFormBrand(parentCat?.name || 'Egger');
    setFormArticle('');
    setFormSupplier('');
    setFormUnit('sheet');
    setFormStock(100);
    setFormCostPrice(4000);
    setFormMarkup(1.6);
    setFormClientPrice(6400);
    setFormColor('#F4F5F7');
    setFormImageUrl('');
    setFormDescription('');
    setFormIsActive(true);
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item: OwnerMaterialItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategoryId(item.categoryId);
    setFormBrand(item.brand);
    setFormArticle(item.article);
    setFormSupplier(item.supplier || '');
    setFormUnit(item.unit);
    setFormStock(item.stockQuantity ?? 100);
    setFormCostPrice(item.costPrice);
    setFormMarkup(item.markupMultiplier);
    setFormClientPrice(item.clientPrice);
    setFormColor(item.color);
    setFormImageUrl(item.imageUrl || item.textureUrl || '');
    setFormDescription(item.description || '');
    setFormIsActive(item.isActive);
    setIsItemModalOpen(true);
  };

  const handleCostOrMarkupChange = (cost: number, markup: number) => {
    setFormCostPrice(cost);
    setFormMarkup(markup);
    setFormClientPrice(Math.round(cost * markup));
  };

  const handleClientPriceChange = (clientPrice: number) => {
    setFormClientPrice(clientPrice);
    if (formCostPrice > 0) {
      const calculatedMarkup = parseFloat((clientPrice / formCostPrice).toFixed(2));
      setFormMarkup(calculatedMarkup);
    }
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCategoryId) return;

    const cat = categories.find((c) => c.id === formCategoryId);
    const itemData = {
      name: formName.trim(),
      categoryId: formCategoryId,
      section: cat?.section || 'other',
      brand: formBrand.trim() || 'Без бренда',
      category: cat?.name || '',
      article: formArticle.trim(),
      supplier: formSupplier.trim() || undefined,
      costPrice: formCostPrice,
      markupMultiplier: formMarkup,
      clientPrice: formClientPrice,
      unit: formUnit,
      stockQuantity: formStock,
      color: formColor,
      imageUrl: formImageUrl || undefined,
      textureUrl: formImageUrl || undefined,
      description: formDescription.trim() || undefined,
      isActive: formIsActive,
    };

    if (editingItem) {
      updateItem(editingItem.id, itemData);
    } else {
      addItem(itemData);
    }

    clearMaterialCache();
    setIsItemModalOpen(false);
  };

  const handleConfirmDeleteItem = () => {
    if (!itemToDelete) return;
    deleteItem(itemToDelete.id);
    clearMaterialCache();
    setItemToDelete(null);
  };

  // Загрузка фото/текстуры через File input
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormImageUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Экспорт / Импорт
  const handleExportJson = () => {
    const jsonStr = exportMaterialsJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mkonstruktor_materials_db_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          const ok = importMaterialsJson(content);
          if (ok) {
            clearMaterialCache();
            alert('База материалов успешно импортирована!');
          } else {
            alert('Ошибка при импорте JSON: неверный формат файла');
          }
        }
      };
      reader.readAsText(file);
    }
  };

  // Применение массовой наценки
  const handleApplyBatchMarkup = () => {
    if (batchTargetType === 'brand') {
      if (!batchBrand) return;
      updateBrandMultiplier(batchBrand, batchMultiplier);
    } else {
      if (!batchCategoryId) return;
      updateCategoryMultiplier(batchCategoryId, batchMultiplier);
    }
    clearMaterialCache();
    setIsBatchMarkupOpen(false);
  };

  if (!isOwnerCabinetOpen) return null;

  // Экран блокировки ПИН-кодом
  if (isPinLocked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-[#0F141F] border border-amber-500/30 rounded-2xl p-8 shadow-[0_0_40px_rgba(245,158,11,0.15)] text-center">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/40 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-400">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2 tracking-wide">Доступ ограничен</h2>
          <p className="text-sm text-slate-400 mb-6">
            Веб-кабинет защищен ПИН-кодом собственника. Введите пароль для входа:
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const ok = authenticatePin(enteredPin);
              if (!ok) {
                setPinError('Неверный ПИН-код');
              } else {
                setPinError('');
                setEnteredPin('');
              }
            }}
            className="space-y-4"
          >
            <input
              type="password"
              autoFocus
              value={enteredPin}
              onChange={(e) => {
                setEnteredPin(e.target.value);
                setPinError('');
              }}
              placeholder="Введите ПИН-код"
              className="w-full px-4 py-3 bg-[#161D2B] border border-slate-700 focus:border-amber-400 rounded-xl text-center text-xl tracking-widest text-white outline-none transition-all"
            />
            {pinError && <p className="text-sm text-rose-400 font-medium">{pinError}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeOwnerCabinet}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-medium transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all"
              >
                Войти
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Рекурсивный рендер узлов категорий в левом сайдбаре
  // --------------------------------------------------------------------------
  const renderCategoryNodes = (parentId: string | null = null, depth: number = 0) => {
    const nodes = categoryTree.get(parentId) || [];
    if (nodes.length === 0) return null;

    return nodes.map((cat) => {
      const children = categoryTree.get(cat.id) || [];
      const hasChildren = children.length > 0;
      const isExpanded = expandedCategories[cat.id] ?? false;
      const isSelected = selectedCategoryId === cat.id;
      const count = getItemCountForCategory(cat.id);

      return (
        <div key={cat.id} className="select-none">
          <div
            onClick={() => {
              setSelectedCategoryId(cat.id);
              if (hasChildren) {
                toggleExpand(cat.id);
              }
            }}
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
            className={`group relative flex items-center justify-between pr-2.5 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-all ${
              isSelected
                ? 'bg-amber-950/50 border border-amber-500/70 text-amber-300 font-semibold shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => toggleExpand(cat.id, e)}
                  className="p-0.5 hover:text-amber-400 text-slate-400 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-3.5 text-center text-amber-500 text-[10px] leading-none">•</span>
              )}

              <span className="truncate">{cat.name}</span>
            </div>

            <div className="flex items-center gap-1">
              {/* Действия при наведении (добавить подкатегорию, редактировать, удалить) */}
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                <button
                  type="button"
                  title="Добавить подкатегорию внутрь"
                  onClick={(e) => handleOpenAddCategory(cat.id, e)}
                  className="p-1 rounded hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  title="Переименовать категорию"
                  onClick={(e) => handleOpenEditCategory(cat, e)}
                  className="p-1 rounded hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                {cat.parentId !== null && (
                  <button
                    type="button"
                    title="Удалить категорию"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategoryToDelete(cat);
                    }}
                    className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Бейдж количества позиций */}
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-[#182133] text-slate-400 border border-slate-700/60'
                }`}
              >
                {count}
              </span>
            </div>
          </div>

          {/* Рекурсивный рендер потомков */}
          {hasChildren && isExpanded && (
            <div className="mt-0.5">{renderCategoryNodes(cat.id, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="w-full h-full max-w-[1600px] max-h-[96vh] bg-[#0A0D14] border border-[#1E2536] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200 font-sans">
        {/* ====================================================================
            ВЕРХНЯЯ ШАПКА КАБИНЕТА
           ==================================================================== */}
        <header className="h-14 border-b border-[#1E2536] bg-[#0E131F]/90 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white tracking-wide text-sm uppercase">
                  Веб-кабинет собственника
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                  База материалов и цен
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBatchImportModalOpen(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-amber-900/30 transition-all active:scale-95"
              title="Массовый импорт папок декоров и текстур (Базис-Мебельщик, Egger, Kronospan)"
            >
              <FolderUp className="w-3.5 h-3.5" />
              <span>Массовый импорт</span>
            </button>

            <button
              onClick={async () => {
                setIsSyncingColors(true);
                try {
                  await repairMissingColors();
                } finally {
                  setIsSyncingColors(false);
                }
              }}
              disabled={isSyncingColors}
              className="px-3 py-1.5 bg-[#141B2B] hover:bg-[#1D273D] border border-slate-700/70 text-slate-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Автоматически определить точные цвета декоров по файлам текстур"
            >
              <Palette className={`w-3.5 h-3.5 text-violet-400 ${isSyncingColors ? 'animate-spin' : ''}`} />
              <span>{isSyncingColors ? 'Синхронизация...' : 'Цвета из текстур'}</span>
            </button>

            <button
              onClick={() => setIsBatchMarkupOpen(true)}
              className="px-3 py-1.5 bg-[#141B2B] hover:bg-[#1D273D] border border-slate-700/70 text-slate-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              Групповая наценка
            </button>

            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 bg-[#141B2B] hover:bg-[#1D273D] border border-slate-700/70 text-slate-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              Экспорт JSON
            </button>

            <button
              onClick={() => jsonImportRef.current?.click()}
              className="px-3 py-1.5 bg-[#141B2B] hover:bg-[#1D273D] border border-slate-700/70 text-slate-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              Импорт JSON
            </button>
            <input
              type="file"
              ref={jsonImportRef}
              onChange={handleImportJsonFile}
              accept=".json"
              className="hidden"
            />

            <button
              onClick={() => {
                if (
                  confirm(
                    'Сбросить все категории и материалы к заводским настройкам по умолчанию? Ваши изменения будут заменены.'
                  )
                ) {
                  resetToDefaultMaterials();
                  clearMaterialCache();
                  setSelectedCategoryId('all');
                }
              }}
              className="p-2 bg-[#141B2B] hover:bg-[#1D273D] border border-slate-700/70 text-slate-400 hover:text-slate-200 rounded-lg text-xs transition-colors"
              title="Сброс к настройкам по умолчанию"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsPinSettingsOpen(true)}
              className={`p-2 rounded-lg text-xs border transition-colors ${
                pinCode
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
                  : 'bg-[#141B2B] border-slate-700/70 text-slate-400 hover:text-slate-200 hover:bg-[#1D273D]'
              }`}
              title={pinCode ? 'ПИН-код активен (настроить)' : 'Установить ПИН-код'}
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>

            <div className="h-5 w-px bg-slate-800 mx-1" />

            <button
              onClick={closeOwnerCabinet}
              className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 transition-colors"
              title="Закрыть кабинет"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ====================================================================
            ОСНОВНАЯ РАБОЧАЯ ОБЛАСТЬ (2 КОЛОНКИ ПО СКРИНШОТУ)
           ==================================================================== */}
        <div className="flex-1 flex overflow-hidden">
          {/* ------------------------------------------------------------------
              ЛЕВАЯ ПАНЕЛЬ: КАТЕГОРИИ И БРЕНДЫ (ДЕРЕВО С CRUD)
             ------------------------------------------------------------------ */}
          <aside className="w-72 lg:w-80 border-r border-[#1E2536] bg-[#0B0F17] flex flex-col shrink-0">
            {/* Заголовок панели категорий с кнопкой "+ Категория" */}
            <div className="p-3.5 border-b border-[#1E2536] flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 tracking-wider uppercase">
                КАТЕГОРИИ И БРЕНДЫ
              </span>
              <button
                type="button"
                onClick={() => handleOpenAddCategory(null)}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors py-1 px-2 rounded hover:bg-amber-500/10"
              >
                <Plus className="w-3.5 h-3.5" />
                Категория
              </button>
            </div>

            {/* Список дерева категорий */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1 custom-scrollbar">
              {/* Пункт: "Все материалы" */}
              <div
                onClick={() => setSelectedCategoryId('all')}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs font-medium transition-all ${
                  selectedCategoryId === 'all'
                    ? 'bg-amber-950/50 border border-amber-500/70 text-amber-300 font-semibold shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>Все материалы</span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                    selectedCategoryId === 'all'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-[#182133] text-slate-400 border border-slate-700/60'
                  }`}
                >
                  {items.length}
                </span>
              </div>

              {/* Дерево категорий и подкатегорий */}
              <div className="pt-1.5 space-y-0.5">{renderCategoryNodes(null, 0)}</div>
            </div>
          </aside>

          {/* ------------------------------------------------------------------
              ПРАВАЯ ПАНЕЛЬ: ПОИСК, ФИЛЬТР БРЕНДА, ТАБЛИЦА
             ------------------------------------------------------------------ */}
          <main className="flex-1 flex flex-col bg-[#0A0D14] overflow-hidden">
            {/* Верхняя строка поиска и селектора бренда (в точности по скриншоту) */}
            <div className="p-4 border-b border-[#1E2536] bg-[#0E131F]/50 flex flex-col sm:flex-row items-center gap-3">
              {/* Поле поиска */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по декору, артикулу, поставщику..."
                  className="w-full pl-10 pr-4 py-2 bg-[#121826] border border-[#1E283D] focus:border-amber-500/70 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Фильтр бренда */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-400 font-medium">Бренд:</span>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="bg-[#121826] border border-[#1E283D] text-xs text-slate-200 rounded-xl px-3 py-2 outline-none focus:border-amber-500/70 cursor-pointer"
                >
                  <option value="all">Все бренды</option>
                  {allBrands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Заголовок активной категории и кнопка добавления */}
            <div className="px-6 py-3.5 flex items-center justify-between border-b border-[#1E2536] bg-[#0B0F17]/70">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_#F59E0B]" />
                <h2 className="text-base font-bold text-white tracking-wide">
                  {currentCategory ? currentCategory.name : 'Все материалы'}
                </h2>
                <span className="text-xs text-slate-400 font-normal">
                  ({filteredItems.length} поз.)
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleOpenAddItem(selectedCategoryId)}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/50 text-amber-300 font-semibold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.15)] transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                Добавить в эту категорию
              </button>
            </div>

            {/* Таблица позиций */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-[#0E131F] border-b border-[#1E2536] text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-6 font-semibold w-[36%]">НАИМЕНОВАНИЕ</th>
                    <th className="py-3 px-4 font-semibold w-[14%]">БРЕНД / АРТ.</th>
                    <th className="py-3 px-3 font-semibold w-[8%]">ЕД.ИЗМ</th>
                    <th className="py-3 px-4 font-semibold w-[14%]">ОСТАТОК НА СКЛАДЕ</th>
                    <th className="py-3 px-3 font-semibold w-[10%]">ЗАКУПКА (Р)</th>
                    <th className="py-3 px-3 font-semibold w-[6%]">НАЦЕНКА</th>
                    <th className="py-3 px-4 font-semibold w-[11%]">ПРОДАЖА (Р)</th>
                    <th className="py-3 px-3 font-semibold w-[8%] text-center">ДЕЙСТВИЯ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171E2D]/60 text-xs">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 text-sm">
                        В этой категории пока нет позиций.{' '}
                        <button
                          type="button"
                          onClick={() => handleOpenAddItem(selectedCategoryId)}
                          className="text-amber-400 hover:underline font-semibold ml-1"
                        >
                          Добавить позицию
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const categoryPath = getCategoryPath(item.categoryId);
                      const pathString =
                        categoryPath.length > 0
                          ? categoryPath.map((c) => c.name).join(' → ')
                          : item.category || 'Без категории';

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-[#121826]/70 transition-colors group"
                        >
                          {/* 1. НАИМЕНОВАНИЕ */}
                          <td className="py-3 px-6">
                            <div className="flex items-start gap-3">
                              {/* Превью цвета или иконка */}
                              <div
                                className="w-7 h-7 rounded-md border border-slate-700/80 shrink-0 mt-0.5 overflow-hidden shadow-inner flex items-center justify-center"
                                style={{
                                  backgroundColor: item.color || '#334155',
                                  backgroundImage: item.imageUrl ? `url("${encodeURI(decodeURI(item.imageUrl))}")` : undefined,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                }}
                              >
                                {!item.imageUrl && !item.color && (
                                  <Box className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="text-slate-100 font-medium text-xs leading-snug">
                                  {item.name}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  {/* Путь категории (желтый бейдж по образцу) */}
                                  <span className="inline-flex items-center text-[10px] text-amber-300/90 bg-amber-950/30 border border-amber-500/40 px-2 py-0.5 rounded-md font-sans">
                                    {pathString}
                                  </span>

                                  {/* Поставщик */}
                                  {item.supplier && (
                                    <span className="inline-flex items-center text-[10px] text-slate-300 bg-[#161D2B] border border-slate-700/60 px-2 py-0.5 rounded-md">
                                      Поставщик: {item.supplier}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. БРЕНД / АРТ. */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-200">{item.brand}</div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {item.article || '—'}
                            </div>
                          </td>

                          {/* 3. ЕД.ИЗМ */}
                          <td className="py-3 px-3 text-slate-300">
                            {UNIT_LABELS[item.unit] || item.unit}
                          </td>

                          {/* 4. ОСТАТОК НА СКЛАДЕ */}
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 text-xs font-medium">
                              <Package className="w-3.5 h-3.5" />
                              <span>
                                {item.stockQuantity ?? 100} {UNIT_SHORT[item.unit] || 'шт.'}
                              </span>
                              <Box className="w-3 h-3 text-emerald-500/70 ml-0.5" />
                            </span>
                          </td>

                          {/* 5. ЗАКУПКА (Р) */}
                          <td className="py-3 px-3 font-semibold text-slate-200">
                            {item.costPrice.toLocaleString('ru-RU')} ₽
                          </td>

                          {/* 6. НАЦЕНКА */}
                          <td className="py-3 px-3">
                            <span className="inline-block px-2 py-0.5 rounded bg-amber-950/50 border border-amber-500/40 text-amber-300 font-bold text-xs">
                              x{item.markupMultiplier}
                            </span>
                          </td>

                          {/* 7. ПРОДАЖА (Р) */}
                          <td className="py-3 px-4">
                            <span className="text-amber-400 font-bold text-sm tracking-wide">
                              {item.clientPrice.toLocaleString('ru-RU')} ₽
                            </span>
                          </td>

                          {/* 8. ДЕЙСТВИЯ */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                title="Редактировать позицию"
                                onClick={() => handleOpenEditItem(item)}
                                className="p-1.5 rounded-lg border border-slate-700/80 text-slate-400 hover:text-amber-300 hover:border-amber-400/80 hover:bg-amber-500/10 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Удалить позицию"
                                onClick={() => setItemToDelete(item)}
                                className="p-1.5 rounded-lg border border-slate-700/80 text-slate-400 hover:text-rose-400 hover:border-rose-500/80 hover:bg-rose-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </main>
        </div>
      </div>

      {/* ======================================================================
          МОДАЛЬНОЕ ОКНО: СОЗДАНИЕ / РЕДАКТИРОВАНИЕ КАТЕГОРИИ
         ====================================================================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[#0F1420] border border-amber-500/40 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-amber-400" />
                {editingCategoryId ? 'Редактировать категорию' : 'Новая категория / бренд'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Название категории / подкатегории *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={catFormName}
                  onChange={(e) => setCatFormName(e.target.value)}
                  placeholder="Например: Петли, Полуторцевые, Egger, Boyard"
                  className="w-full px-3.5 py-2.5 bg-[#161D2B] border border-slate-700 focus:border-amber-400 rounded-xl text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Родительская категория
                </label>
                <select
                  value={catFormParentId || ''}
                  onChange={(e) => setCatFormParentId(e.target.value ? e.target.value : null)}
                  className="w-full px-3 py-2.5 bg-[#161D2B] border border-slate-700 focus:border-amber-400 rounded-xl text-xs text-slate-200 outline-none"
                >
                  <option value="">(Корневая основная категория)</option>
                  {flattenedCategoryOptions
                    .filter((c) => c.id !== editingCategoryId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.path}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Для создания многоуровневой структуры выберите родительскую позицию (например Boyard → Петли → Полуторцевые).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Раздел материала
                </label>
                <select
                  value={catFormSection}
                  onChange={(e) => setCatFormSection(e.target.value as MaterialSection)}
                  className="w-full px-3 py-2.5 bg-[#161D2B] border border-slate-700 focus:border-amber-400 rounded-xl text-xs text-slate-200 outline-none"
                >
                  {Object.entries(SECTION_LABELS).map(([sec, label]) => (
                    <option key={sec} value={sec}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                >
                  {editingCategoryId ? 'Сохранить изменения' : 'Создать категорию'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================
          ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ КАТЕГОРИИ
         ====================================================================== */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#0F1420] border border-rose-500/40 rounded-2xl p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white text-center mb-2">
              Удалить категорию?
            </h3>
            <p className="text-xs text-slate-300 text-center mb-4">
              Вы уверены, что хотите удалить категорию{' '}
              <span className="font-semibold text-amber-300">«{categoryToDelete.name}»</span>?
              Все вложенные подкатегории и связанные с ними позиции ({getItemCountForCategory(categoryToDelete.id)} шт.) также будут удалены!
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCategory}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-[0_0_15px_rgba(244,63,94,0.3)]"
              >
                Удалить всё
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          МОДАЛЬНОЕ ОКНО: СОЗДАНИЕ / РЕДАКТИРОВАНИЕ ПОЗИЦИИ МАТЕРИАЛА
         ====================================================================== */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-[#0F1420] border border-amber-500/40 rounded-2xl p-6 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 shrink-0">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Box className="w-5 h-5 text-amber-400" />
                {editingItem ? 'Редактировать позицию' : 'Новая позиция материала'}
              </h3>
              <button
                type="button"
                onClick={() => setIsItemModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveItem}
              className="flex-1 overflow-y-auto space-y-4 py-4 pr-1 custom-scrollbar text-xs"
            >
              {/* Категория назначения */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Категория / Подкатегория *
                </label>
                <select
                  required
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#161D2B] border border-slate-700 focus:border-amber-400 rounded-xl text-slate-200 outline-none"
                >
                  {flattenedCategoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.path}
                    </option>
                  ))}
                </select>
              </div>

              {/* Название */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Наименование позиции *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Например: Петля Boyard Clip-on H305A02 полуторцевая с доводчиком"
                  className="w-full px-3 py-2 bg-[#161D2B] border border-slate-700 focus:border-amber-400 rounded-xl text-white outline-none"
                />
              </div>

              {/* 3 колонки: Бренд, Артикул, Поставщик */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Бренд *</label>
                  <input
                    type="text"
                    required
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    placeholder="Boyard, Egger, Blum..."
                    className="w-full px-3 py-2 bg-[#161D2B] border border-slate-700 focus:border-amber-400 rounded-xl text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Артикул / Код</label>
                  <input
                    type="text"
                    value={formArticle}
                    onChange={(e) => setFormArticle(e.target.value)}
                    placeholder="H305A02, EGG-W980..."
                    className="w-full px-3 py-2 bg-[#161D2B] border border-slate-700 focus:border-amber-400 rounded-xl text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Поставщик</label>
                  <input
                    type="text"
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    placeholder="ЕвроХим / МДМ..."
                    className="w-full px-3 py-2 bg-[#161D2B] border border-slate-700 focus:border-amber-400 rounded-xl text-white outline-none"
                  />
                </div>
              </div>

              {/* Единица измерения и складской остаток */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Единица измерения
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value as PriceUnit)}
                    className="w-full px-3 py-2 bg-[#161D2B] border border-slate-700 focus:border-amber-400 rounded-xl text-slate-200 outline-none"
                  >
                    {Object.entries(UNIT_LABELS).map(([unit, label]) => (
                      <option key={unit} value={unit}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Остаток на складе
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formStock}
                    onChange={(e) => setFormStock(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#161D2B] border border-slate-700 focus:border-amber-400 rounded-xl text-white outline-none"
                  />
                </div>
              </div>

              {/* Блок ценообразования: Закупка, Наценка, Продажа */}
              <div className="p-3.5 bg-[#141B2A] border border-amber-500/20 rounded-xl">
                <div className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  Ценообразование позиции
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Закупка (₽)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={formCostPrice}
                      onChange={(e) =>
                        handleCostOrMarkupChange(Number(e.target.value), formMarkup)
                      }
                      className="w-full px-3 py-2 bg-[#0E131F] border border-slate-700 focus:border-amber-400 rounded-xl text-white font-semibold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Коэффициент наценки
                    </label>
                    <input
                      type="number"
                      min="1.0"
                      step="0.05"
                      required
                      value={formMarkup}
                      onChange={(e) =>
                        handleCostOrMarkupChange(formCostPrice, Number(e.target.value))
                      }
                      className="w-full px-3 py-2 bg-[#0E131F] border border-slate-700 focus:border-amber-400 rounded-xl text-amber-300 font-semibold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Продажа клиенту (₽)
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formClientPrice}
                      onChange={(e) => handleClientPriceChange(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-[#0E131F] border border-amber-500/50 focus:border-amber-400 rounded-xl text-amber-400 font-bold outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Визуал: цвет и изображение / текстура */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Цвет (HEX)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-slate-700 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="flex-1 px-3 py-2 bg-[#161D2B] border border-slate-700 focus:border-amber-400 rounded-xl text-white outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Изображение / Текстура
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      placeholder="/textures/wood.jpg или URL"
                      className="flex-1 px-3 py-2 bg-[#161D2B] border border-slate-700 focus:border-amber-400 rounded-xl text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                      title="Загрузить изображение с компьютера"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Описание */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Описание / Характеристики
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Дополнительные свойства, артикулы сопутствующих товаров, примечания..."
                  className="w-full px-3 py-2 bg-[#161D2B] border border-slate-700 focus:border-amber-400 rounded-xl text-white outline-none resize-none"
                />
              </div>

              {/* Статус активности */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="formIsActiveCheckbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer accent-amber-500"
                />
                <label
                  htmlFor="formIsActiveCheckbox"
                  className="font-semibold text-slate-200 cursor-pointer"
                >
                  Позиция активна (доступна дизайнеру в каталоге)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-medium"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                >
                  {editingItem ? 'Сохранить изменения' : 'Создать позицию'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================
          ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ ПОЗИЦИИ
         ====================================================================== */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#0F1420] border border-rose-500/40 rounded-2xl p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white text-center mb-2">Удалить позицию?</h3>
            <p className="text-xs text-slate-300 text-center mb-4">
              Вы действительно хотите удалить позицию{' '}
              <span className="font-semibold text-amber-300">«{itemToDelete.name}»</span>?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteItem}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-[0_0_15px_rgba(244,63,94,0.3)]"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          МОДАЛЬНОЕ ОКНО: МАССОВАЯ НАЦЕНКА
         ====================================================================== */}
      {isBatchMarkupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#0F1420] border border-amber-500/40 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                Групповое изменение наценки
              </h3>
              <button
                type="button"
                onClick={() => setIsBatchMarkupOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 pt-4 text-xs">
              <p className="text-slate-300">
                Позволяет в один клик пересчитать продажные цены для всех позиций выбранного бренда или категории.
              </p>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">Применить к:</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchTargetType('brand')}
                    className={`flex-1 py-2 rounded-xl border font-semibold text-xs transition-colors ${
                      batchTargetType === 'brand'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    По бренду
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchTargetType('category')}
                    className={`flex-1 py-2 rounded-xl border font-semibold text-xs transition-colors ${
                      batchTargetType === 'category'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    По категории
                  </button>
                </div>
              </div>

              {batchTargetType === 'brand' ? (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Выберите бренд</label>
                  <select
                    value={batchBrand}
                    onChange={(e) => setBatchBrand(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#161D2B] border border-slate-700 focus:border-amber-400 rounded-xl text-slate-200 outline-none"
                  >
                    <option value="">-- Выберите бренд --</option>
                    {allBrands.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Выберите категорию
                  </label>
                  <select
                    value={batchCategoryId}
                    onChange={(e) => setBatchCategoryId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#161D2B] border border-slate-700 focus:border-amber-400 rounded-xl text-slate-200 outline-none"
                  >
                    <option value="">-- Выберите категорию --</option>
                    {flattenedCategoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.path}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Новый коэффициент наценки (например: 1.6 или 2.0)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="1.0"
                  value={batchMultiplier}
                  onChange={(e) => setBatchMultiplier(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-[#161D2B] border border-slate-700 focus:border-amber-400 rounded-xl text-amber-300 font-bold text-sm outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBatchMarkupOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleApplyBatchMarkup}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                >
                  Применить ко всем
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          МОДАЛЬНОЕ ОКНО: НАСТРОЙКИ ПИН-КОДА
         ====================================================================== */}
      {isPinSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#0F1420] border border-amber-500/40 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                Защита кабинета ПИН-кодом
              </h3>
              <button
                type="button"
                onClick={() => setIsPinSettingsOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 pt-4 text-xs">
              <p className="text-slate-300">
                {pinCode
                  ? 'Кабинет защищен ПИН-кодом. Вы можете изменить пароль или снять защиту.'
                  : 'Задайте ПИН-код, чтобы дизайнеры или посторонние лица не могли просматривать закупки и менять наценки.'}
              </p>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Новый ПИН-код (оставьте пустым для отключения защиты)
                </label>
                <input
                  type="password"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder={pinCode ? 'Введите новый ПИН или сотрите' : 'Придумайте ПИН-код (напр. 1234)'}
                  className="w-full px-3.5 py-2.5 bg-[#161D2B] border border-slate-700 focus:border-amber-400 rounded-xl text-center text-lg tracking-widest text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPinSettingsOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPinCode(newPinInput);
                    setIsPinSettingsOpen(false);
                    setNewPinInput('');
                  }}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно массового импорта декоров из папок */}
      <BatchImportMaterialsModal
        isOpen={isBatchImportModalOpen}
        onClose={() => setIsBatchImportModalOpen(false)}
      />
    </div>
  );
};
