import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { CatalogItemTemplate } from '../data/catalog';
import { FurnitureModule, ProjectSettings } from '../types';
import { ModuleBuilder } from '../core/3d/ModuleBuilder';
import { usePlannerStore } from '../store/usePlannerStore';

interface ModuleThumbnailProps {
  template: CatalogItemTemplate;
  width?: number;
  className?: string;
}

const thumbnailCache = new Map<string, string>();
let offscreenRenderer: THREE.WebGLRenderer | null = null;

function getOffscreenRenderer(): THREE.WebGLRenderer | null {
  if (typeof window === 'undefined') return null;
  if (!offscreenRenderer) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 340;
      canvas.height = 340;
      offscreenRenderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
      offscreenRenderer.setSize(340, 340);
      offscreenRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      offscreenRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      offscreenRenderer.toneMappingExposure = 1.3;
      offscreenRenderer.shadowMap.enabled = true;
      offscreenRenderer.shadowMap.type = THREE.PCFShadowMap;
    } catch (e) {
      console.warn('Could not init WebGL for thumbnails:', e);
      return null;
    }
  }
  return offscreenRenderer;
}

function generateModule3DThumbnail(
  template: CatalogItemTemplate,
  width: number,
  projectSettings: ProjectSettings
): string | null {
  const cacheKey = `${template.id}_${width}_${template.defaultConfig.handleType}_${template.defaultConfig.golaType}_v3`;
  if (thumbnailCache.has(cacheKey)) {
    return thumbnailCache.get(cacheKey)!;
  }

  const renderer = getOffscreenRenderer();
  if (!renderer) return null;

  const scene = new THREE.Scene();
  scene.background = null;

  // Яркий чистый студийный свет без темных провалов
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 1.4);
  mainLight.position.set(3.2, 4.8, 3.6);
  mainLight.castShadow = false; // Отключаем падающие тени столешницы на фасады
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.75);
  fillLight.position.set(-3.5, 2.5, -2);
  scene.add(fillLight);

  const topLight = new THREE.DirectionalLight(0xffffff, 0.55);
  topLight.position.set(0, 5, 0);
  scene.add(topLight);

  // Модуль в стандартных цветах со скриншота (Дуб Вотан / Дуб Сонома + Светлая столешница + Черные ручки)
  const dummyModule: FurnitureModule = {
    id: 'thumb_' + template.id,
    category: template.category,
    subType: template.subType,
    name: template.name,
    dimensions: {
      width,
      height: template.defaultDimensions.height,
      depth: template.defaultDimensions.depth,
    },
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    config: {
      ...template.defaultConfig,
      isOpen: false,
      isOpenShelf: template.defaultConfig.isOpenShelf ?? false,
      handleType: template.defaultConfig.handleType ?? 'bar',
      golaType: template.defaultConfig.golaType ?? 'type1',
    },
    materials: {
      carcass: 'carcass_dub',
      facade: 'facade_dub_votan',
      countertop: template.defaultConfig.hasCountertop ? 'countertop_marble' : undefined,
      handle: '#1E293B',
    },
    basePrice: template.basePrice,
    catalogId: template.id,
  };

  // Строим реальный 3D-модуль из движка (isThumbnail = true: без размерной плашки, полупрозрачные фасады)
  const group = ModuleBuilder.buildModuleGroup(dummyModule, false, false, false, projectSettings, true);

  // Центрируем 3D-модуль
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  group.position.set(-center.x, -center.y + size.y / 2, -center.z);
  scene.add(group);

  // Мягкая контактная тень на полу
  const shadowGeo = new THREE.PlaneGeometry(
    (width / 1000) * 1.35,
    (template.defaultDimensions.depth / 1000) * 1.35
  );
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x0f172a,
    transparent: true,
    opacity: 0.16,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = -0.002;
  scene.add(shadowMesh);

  // Камера: аксонометрический ракурс строго со скриншота пользователя
  const maxDim = Math.max(size.x, size.y, size.z);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);

  const camDist = maxDim * 2.3;
  camera.position.set(camDist * 0.72, camDist * 0.65, camDist * 1.05);
  camera.lookAt(0, size.y * 0.45, 0);

  // Рендерим и сохраняем DataURL
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL('image/png');
  thumbnailCache.set(cacheKey, dataUrl);

  // Очистка сцены
  scene.remove(group);
  scene.remove(shadowMesh);

  return dataUrl;
}

/**
 * 3D-рендерер миниатюр кухонных модулей.
 * Рендерит реальный 3D-модуль движка в стандартных цветах со скриншота
 * с легкой полупрозрачностью фасадов (видны внутренние полки) и без размерной плашки.
 */
export const ModuleThumbnail: React.FC<ModuleThumbnailProps> = ({ template, width, className = '' }) => {
  const currentWidth = width ?? template.defaultDimensions.width;
  const projectSettings = usePlannerStore((s) => s.projectSettings);
  const [dataUrl, setDataUrl] = useState<string | null>(() => {
    const key = `${template.id}_${currentWidth}_${template.defaultConfig.handleType}_${template.defaultConfig.golaType}_v3`;
    return thumbnailCache.get(key) || null;
  });

  useEffect(() => {
    const key = `${template.id}_${currentWidth}_${template.defaultConfig.handleType}_${template.defaultConfig.golaType}_v3`;
    if (thumbnailCache.has(key)) {
      setDataUrl(thumbnailCache.get(key)!);
    } else {
      const rendered = generateModule3DThumbnail(template, currentWidth, projectSettings);
      if (rendered) {
        setDataUrl(rendered);
      }
    }
  }, [template.id, currentWidth, template.defaultConfig.handleType, template.defaultConfig.golaType, projectSettings]);

  return (
    <div
      className={`relative w-full aspect-square flex items-center justify-center p-1 rounded-xl bg-gradient-to-b from-slate-100 to-slate-200/90 dark:from-slate-800/80 dark:to-slate-900/90 border border-slate-200/80 dark:border-slate-700/60 shadow-inner overflow-hidden select-none ${className}`}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={template.name}
          className="w-full h-full object-contain drop-shadow-md transition-transform duration-300 group-hover:scale-105 pointer-events-none"
        />
      ) : (
        <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      )}
    </div>
  );
};
