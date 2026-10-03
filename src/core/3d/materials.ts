import * as THREE from 'three';
import { DEFAULT_MATERIALS } from '../../data/materials';
import { useMaterialsStore } from '../../store/useMaterialsStore';

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

export function clearMaterialCache(): void {
  materialCache.forEach((mat) => mat.dispose());
  materialCache.clear();
}

const LEGACY_ALIASES: Record<string, string> = {
  facade_white_matte: 'agt_3012',
  facade_white_gloss: 'agt_601',
  facade_graphite: 'agt_3022',
  facade_cashmere: 'egger_u702',
  facade_dub_votan: 'egger_h434',
  facade_black_matte: 'agt_3010',
  facade_emerald: 'enamel_ncs_6010',
  ldsp_egger_w980: 'carcass_egger_w980',
  ldsp_egger_u732: 'carcass_grey',
  ldsp_egger_halifax: 'carcass_egger_h1180',
  ct_kedr_votan_38: 'countertop_votan',
  ct_slotex_carrara: 'countertop_marble',
};

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

function getLoadedTexture(url: string, onUpdate?: () => void): THREE.Texture {
  if (textureCache.has(url)) {
    return textureCache.get(url)!;
  }
  const safeUrl = encodeURI(decodeURI(url));
  const tex = textureLoader.load(
    safeUrl,
    () => {
      tex.needsUpdate = true;
      onUpdate?.();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('biplaner:materials-updated'));
      }
    },
    undefined,
    (err) => {
      console.warn('Failed to load texture:', safeUrl, err);
    }
  );
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16; // Максимальная резкость под острыми углами обзора
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  textureCache.set(url, tex);
  return tex;
}

export function getThreeMaterial(materialId: string, isSelected: boolean = false): THREE.MeshStandardMaterial {
  // 1. Сначала ищем напрямую в единой базе материалов собственника
  let ownerItem = useMaterialsStore.getState().getItemById(materialId);
  let resolvedId = ownerItem ? ownerItem.id : (LEGACY_ALIASES[materialId] || materialId);

  if (!ownerItem) {
    ownerItem = useMaterialsStore.getState().getItemById(resolvedId);
  }

  const cacheKey = `${resolvedId}_${isSelected ? 'sel' : 'norm'}`;
  if (materialCache.has(cacheKey)) {
    return materialCache.get(cacheKey)!;
  }

  const def = ownerItem || DEFAULT_MATERIALS.find((m) => m.id === resolvedId);
  const color = def ? def.color : '#E2E8F0';
  const roughness = def?.roughness !== undefined ? def.roughness : 0.7;
  const metalness = def?.metalness !== undefined ? def.metalness : 0.05;
  const effectiveTexUrl = ownerItem?.textureUrl || ownerItem?.imageUrl || (def as any)?.textureUrl;

  const mat = new THREE.MeshStandardMaterial({
    color: effectiveTexUrl ? new THREE.Color(0xffffff) : new THREE.Color(color),
    roughness: roughness,
    metalness: metalness,
    side: THREE.DoubleSide,
  });

  if (effectiveTexUrl) {
    const tex = getLoadedTexture(effectiveTexUrl, () => {
      mat.needsUpdate = true;
    });
    mat.map = tex;

    // PBR микрорельеф для древесных и каменных декоров
    const defCol = (def as any)?.collection || (def as any)?.category || '';
    const isTextured =
      defCol.includes('Feelwood') ||
      defCol.includes('Synchro') ||
      defCol.includes('Древесные') ||
      defCol.includes('Текстурные') ||
      defCol.includes('Материалы') ||
      (def as any)?.section === 'countertop' ||
      (def as any)?.category === 'countertop';

    if (isTextured) {
      mat.bumpMap = tex;
      mat.bumpScale = 0.0022; // тактильная глубина древесных пор и каменных неровностей
    }

    mat.needsUpdate = true;
  }

  if (isSelected) {
    mat.emissive = new THREE.Color('#3B82F6');
    mat.emissiveIntensity = 0.15;
  }

  materialCache.set(cacheKey, mat);
  return mat;
}

export function createEdgeHighlightMaterial(): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color: 0x3B82F6,
    linewidth: 2,
    depthTest: true,
  });
}
