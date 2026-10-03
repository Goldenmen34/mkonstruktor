import * as THREE from 'three';
import { RoomData, WallSegment, WallVertex, ArchitecturalColumn, WallOpening, WallUtility } from '../../types/room';
import {
  buildVertexMap,
  getWallLength,
  getWallMidpoint,
  getWallAngle,
  getInwardWallNormal,
  getOutwardWallNormal,
} from '../../utils/roomGeometry';

export class RoomBuilder {
  /**
   * Создает холщовую размерную плашку для стены или колонны (текстовый спрайт)
   */
  private static createWallDimensionBadge(text: string, isSelected: boolean, wallId?: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 70;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Sprite();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Фон плашки
    ctx.fillStyle = isSelected ? '#0284c7' : 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(10, 8, 280, 54, 8);
    ctx.fill();

    // Обводка
    ctx.strokeStyle = isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Текст размера
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 150, 36);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.55, 0.13, 1);
    if (wallId) {
      sprite.userData = { type: 'wall', wallId, isBadge: true };
    }
    return sprite;
  }

  /**
   * Создает размерную плашку для окна или двери
   */
  private static createOpeningDimensionBadge(text: string, isSelected: boolean): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Sprite();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = isSelected ? '#0284c7' : 'rgba(30, 41, 59, 0.9)';
    ctx.beginPath();
    ctx.roundRect(8, 6, 264, 48, 6);
    ctx.fill();

    ctx.strokeStyle = isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 140, 30);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.48, 0.11, 1);
    sprite.raycast = () => {};
    return sprite;
  }

  /**
   * Создает детальную 3D-модель окна (рама ПВХ, двойной стеклопакет, подоконник с выносом, плашка)
   */
  private static createWindowMesh(
    opening: WallOpening,
    wall: WallSegment,
    vMap: Record<string, WallVertex>,
    room: RoomData,
    mode: '2D' | '3D' = '3D'
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = `opening_${opening.id}`;

    const v1 = vMap[wall.startVertexId];
    const v2 = vMap[wall.endVertexId];
    if (!v1 || !v2) return group;

    const lenMm = getWallLength(wall, vMap);
    const angle = getWallAngle(wall, vMap);
    const inNorm = getInwardWallNormal(wall, vMap, room.vertices);
    const outNorm = getOutwardWallNormal(wall, vMap, room.vertices);

    const isSelected = room.selectedOpeningId === opening.id;

    const dx = v2.x - v1.x;
    const dz = v2.z - v1.z;
    const dirX = dx / lenMm;
    const dirZ = dz / lenMm;

    const u = opening.offsetFromStart;
    const wallThickM = wall.thickness / 1000;
    const openWM = opening.width / 1000;
    const openHM = opening.height / 1000;
    const sillHM = opening.sillHeight / 1000;

    const posX = (v1.x + u * dirX + outNorm.nx * (wall.thickness / 2)) / 1000;
    const posZ = (v1.z + u * dirZ + outNorm.nz * (wall.thickness / 2)) / 1000;
    const posY = sillHM + openHM / 2;

    group.position.set(posX, posY, posZ);
    group.rotation.y = -angle;

    // Материалы
    const frameColor = isSelected ? 0x38bdf8 : 0xf8fafc;
    const frameMat = new THREE.MeshStandardMaterial({
      color: frameColor,
      roughness: 0.35,
      metalness: 0.05,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const sillMat = new THREE.MeshStandardMaterial({
      color: isSelected ? 0x38bdf8 : 0xffffff,
      roughness: 0.25,
      metalness: 0.05,
    });

    const edgeLineMat = new THREE.LineBasicMaterial({
      color: isSelected ? 0x0284c7 : 0x475569,
      linewidth: isSelected ? 2 : 1,
    });

    const frameThick = 0.06;
    const frameDepth = Math.min(wallThickM, 0.075);

    // 1. Внешняя рама окна
    const horizRailGeo = new THREE.BoxGeometry(openWM, frameThick, frameDepth);
    const topRail = new THREE.Mesh(horizRailGeo, frameMat);
    topRail.position.set(0, openHM / 2 - frameThick / 2, 0);
    topRail.userData = { type: 'opening', openingId: opening.id, wallId: wall.id };
    group.add(topRail);

    const bottomRail = new THREE.Mesh(horizRailGeo, frameMat);
    bottomRail.position.set(0, -openHM / 2 + frameThick / 2, 0);
    bottomRail.userData = { type: 'opening', openingId: opening.id, wallId: wall.id };
    group.add(bottomRail);

    const vertRailGeo = new THREE.BoxGeometry(frameThick, openHM - frameThick * 2, frameDepth);
    const leftRail = new THREE.Mesh(vertRailGeo, frameMat);
    leftRail.position.set(-openWM / 2 + frameThick / 2, 0, 0);
    leftRail.userData = { type: 'opening', openingId: opening.id, wallId: wall.id };
    group.add(leftRail);

    const rightRail = new THREE.Mesh(vertRailGeo, frameMat);
    rightRail.position.set(openWM / 2 - frameThick / 2, 0, 0);
    rightRail.userData = { type: 'opening', openingId: opening.id, wallId: wall.id };
    group.add(rightRail);

    // Центральный импост и стекло
    if (opening.width >= 900) {
      const mullionGeo = new THREE.BoxGeometry(frameThick * 0.9, openHM - frameThick * 2, frameDepth * 0.95);
      const mullion = new THREE.Mesh(mullionGeo, frameMat);
      mullion.position.set(0, 0, 0);
      mullion.userData = { type: 'opening', openingId: opening.id, wallId: wall.id };
      group.add(mullion);

      const paneW = (openWM - frameThick * 3) / 2;
      const paneH = openHM - frameThick * 2;
      const paneGeo = new THREE.BoxGeometry(paneW, paneH, 0.012);

      const glass1 = new THREE.Mesh(paneGeo, glassMat);
      glass1.position.set(-paneW / 2 - frameThick / 2, 0, 0);
      glass1.userData = { type: 'opening', openingId: opening.id, wallId: wall.id };
      group.add(glass1);

      const glass2 = new THREE.Mesh(paneGeo, glassMat);
      glass2.position.set(paneW / 2 + frameThick / 2, 0, 0);
      glass2.userData = { type: 'opening', openingId: opening.id, wallId: wall.id };
      group.add(glass2);
    } else {
      const paneW = openWM - frameThick * 2;
      const paneH = openHM - frameThick * 2;
      const paneGeo = new THREE.BoxGeometry(paneW, paneH, 0.012);
      const glass = new THREE.Mesh(paneGeo, glassMat);
      glass.position.set(0, 0, 0);
      glass.userData = { type: 'opening', openingId: opening.id, wallId: wall.id };
      group.add(glass);
    }

    // 2. Подоконник (выступает строго внутрь комнаты, рама остается внутри стены)
    const dotIn = inNorm.nx * (-Math.sin(angle)) + inNorm.nz * Math.cos(angle);
    const dirIn = dotIn >= 0 ? 1 : -1;

    if (opening.hasSill !== false) {
      const sillOverhangW = 0.08;
      const sillThick = 0.032;
      const overhangRoom = 0.05; // 50 мм выступ подоконника в комнату
      const sillDepth = wallThickM + overhangRoom;
      const sillGeo = new THREE.BoxGeometry(openWM + sillOverhangW, sillThick, sillDepth);
      const sillMesh = new THREE.Mesh(sillGeo, sillMat);
      // Центр подоконника смещен так, чтобы он выступал на 50 мм в сторону комнаты
      sillMesh.position.set(0, -openHM / 2 - sillThick / 2, dirIn * (overhangRoom / 2));
      sillMesh.userData = { type: 'opening', openingId: opening.id, wallId: wall.id };

      const sillEdges = new THREE.LineSegments(new THREE.EdgesGeometry(sillGeo), edgeLineMat);
      sillEdges.raycast = () => {};
      sillMesh.add(sillEdges);
      group.add(sillMesh);
    }

    // 3. Размерная плашка - только в режиме 2D плана
    if (mode === '2D') {
      const badgeText = `${opening.width}×${opening.height} мм`;
      const badge = RoomBuilder.createOpeningDimensionBadge(badgeText, isSelected);
      badge.position.set(0, openHM / 2 + 0.12, 0);
      group.add(badge);
    }

    return group;
  }

  /**
   * Создает 3D-модель межкомнатной двери (коробка, полотно с ручкой, 2D дуга открывания)
   */
  private static createDoorMesh(
    opening: WallOpening,
    wall: WallSegment,
    vMap: Record<string, WallVertex>,
    room: RoomData,
    mode: '2D' | '3D' = '3D'
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = `opening_${opening.id}`;

    const v1 = vMap[wall.startVertexId];
    const v2 = vMap[wall.endVertexId];
    if (!v1 || !v2) return group;

    const lenMm = getWallLength(wall, vMap);
    const angle = getWallAngle(wall, vMap);
    const inNorm = getInwardWallNormal(wall, vMap, room.vertices);
    const outNorm = getOutwardWallNormal(wall, vMap, room.vertices);

    const isSelected = room.selectedOpeningId === opening.id;

    const dx = v2.x - v1.x;
    const dz = v2.z - v1.z;
    const dirX = dx / lenMm;
    const dirZ = dz / lenMm;

    const u = opening.offsetFromStart;
    const wallThickM = wall.thickness / 1000;
    const openWM = opening.width / 1000;
    const openHM = opening.height / 1000;

    const posX = (v1.x + u * dirX + outNorm.nx * (wall.thickness / 2)) / 1000;
    const posZ = (v1.z + u * dirZ + outNorm.nz * (wall.thickness / 2)) / 1000;
    const posY = openHM / 2;

    group.position.set(posX, posY, posZ);
    group.rotation.y = -angle;

    // Материалы
    const frameColor = isSelected ? 0x38bdf8 : 0xe2e8f0;
    const frameMat = new THREE.MeshStandardMaterial({
      color: frameColor,
      roughness: 0.45,
      metalness: 0.05,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      color: isSelected ? 0xbae6fd : 0xf8fafc,
      roughness: 0.4,
      metalness: 0.05,
    });
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.2,
    });

    const edgeLineMat = new THREE.LineBasicMaterial({
      color: isSelected ? 0x0284c7 : 0x475569,
      linewidth: isSelected ? 2 : 1,
    });

    const jambThick = 0.045; // 45 мм ширина коробки

    // 1. Дверная коробка
    const vertJambGeo = new THREE.BoxGeometry(jambThick, openHM, wallThickM);
    const leftJamb = new THREE.Mesh(vertJambGeo, frameMat);
    leftJamb.position.set(-openWM / 2 + jambThick / 2, 0, 0);
    leftJamb.userData = { type: 'opening', openingId: opening.id, wallId: wall.id };
    group.add(leftJamb);

    const rightJamb = new THREE.Mesh(vertJambGeo, frameMat);
    rightJamb.position.set(openWM / 2 - jambThick / 2, 0, 0);
    rightJamb.userData = { type: 'opening', openingId: opening.id, wallId: wall.id };
    group.add(rightJamb);

    const topJambGeo = new THREE.BoxGeometry(openWM, jambThick, wallThickM);
    const topJamb = new THREE.Mesh(topJambGeo, frameMat);
    topJamb.position.set(0, openHM / 2 - jambThick / 2, 0);
    topJamb.userData = { type: 'opening', openingId: opening.id, wallId: wall.id };
    group.add(topJamb);

    // 2. Дверное полотно (приоткрытое в сторону комнаты)
    const dotIn = inNorm.nx * (-Math.sin(angle)) + inNorm.nz * Math.cos(angle);
    const dirIn = dotIn >= 0 ? 1 : -1;

    const leafW = openWM - jambThick * 2;
    const leafH = openHM - jambThick;
    const leafT = 0.04;

    const isLeft = opening.doorSwing !== 'right';
    const hingeX = isLeft ? -openWM / 2 + jambThick : openWM / 2 - jambThick;

    const hingeGroup = new THREE.Group();
    hingeGroup.position.set(hingeX, -openHM / 2, dirIn * (wallThickM / 2));

    const swingSign = isLeft ? -1 : 1;
    hingeGroup.rotation.y = swingSign * dirIn * ((35 * Math.PI) / 180);

    const leafGeo = new THREE.BoxGeometry(leafW, leafH, leafT);
    const leafMesh = new THREE.Mesh(leafGeo, leafMat);
    const leafOffsetSign = isLeft ? 1 : -1;
    leafMesh.position.set(leafOffsetSign * (leafW / 2), leafH / 2, 0);
    leafMesh.userData = { type: 'opening', openingId: opening.id, wallId: wall.id };

    const leafEdges = new THREE.LineSegments(new THREE.EdgesGeometry(leafGeo), edgeLineMat);
    leafEdges.raycast = () => {};
    leafMesh.add(leafEdges);
    hingeGroup.add(leafMesh);

    // Ручка
    const handleGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 12);
    const handleMesh = new THREE.Mesh(handleGeo, handleMat);
    handleMesh.rotation.z = Math.PI / 2;
    const handleX = isLeft ? leafW - 0.08 : -leafW + 0.08;
    handleMesh.position.set(handleX, 1.0, dirIn * 0.035);
    hingeGroup.add(handleMesh);

    group.add(hingeGroup);

    // 3. Дуга открывания двери (CAD-план на полу)
    const arcRadius = leafW;
    const arcSegments = 16;
    const arcPoints: THREE.Vector3[] = [];
    const maxAngle = (90 * Math.PI) / 180;
    for (let i = 0; i <= arcSegments; i++) {
      const a = (i / arcSegments) * maxAngle;
      const arcX = hingeX + Math.cos(a) * arcRadius * (isLeft ? 1 : -1);
      const arcZ = dirIn * (wallThickM / 2) + Math.sin(a) * arcRadius * dirIn;
      arcPoints.push(new THREE.Vector3(arcX, -openHM / 2 + 0.002, arcZ));
    }
    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
    const arcLineMat = new THREE.LineBasicMaterial({
      color: isSelected ? 0x38bdf8 : 0x94a3b8,
      linewidth: 1.5,
    });
    const arcLine = new THREE.Line(arcGeo, arcLineMat);
    arcLine.raycast = () => {};
    group.add(arcLine);

    // 4. Размерная плашка - только в режиме 2D плана
    if (mode === '2D') {
      const badgeText = `${opening.width}×${opening.height} мм`;
      const badge = RoomBuilder.createOpeningDimensionBadge(badgeText, isSelected);
      badge.position.set(0, openHM / 2 + 0.12, 0);
      group.add(badge);
    }

    return group;
  }

  /**
   * Создает 3D-модель технического элемента (розетки, выводы воды, газ, котел, радиатор)
   */
  private static createUtilityMesh(
    utility: WallUtility,
    wall: WallSegment,
    vMap: Record<string, WallVertex>,
    room: RoomData
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = `utility_${utility.id}`;

    const v1 = vMap[wall.startVertexId];
    const v2 = vMap[wall.endVertexId];
    if (!v1 || !v2) return group;

    const lenMm = getWallLength(wall, vMap);
    const angle = getWallAngle(wall, vMap);
    const inNorm = getInwardWallNormal(wall, vMap, room.vertices);
    const outNorm = getOutwardWallNormal(wall, vMap, room.vertices);

    const isSelected = room.selectedUtilityId === utility.id;

    const dx = v2.x - v1.x;
    const dz = v2.z - v1.z;
    const dirX = dx / lenMm;
    const dirZ = dz / lenMm;

    const u = utility.offsetFromStart;
    const wallThickM = wall.thickness / 1000;
    const wM = utility.width / 1000;
    const hM = utility.height / 1000;
    const dM = utility.depth / 1000;

    const dotIn = inNorm.nx * (-Math.sin(angle)) + inNorm.nz * Math.cos(angle);
    const dirIn = dotIn >= 0 ? 1 : -1;

    const posX = (v1.x + u * dirX + outNorm.nx * (wall.thickness / 2)) / 1000;
    const posZ = (v1.z + u * dirZ + outNorm.nz * (wall.thickness / 2)) / 1000;
    const posY = (utility.elevationFromFloor + utility.height / 2) / 1000;

    group.position.set(posX, posY, posZ);
    group.rotation.y = -angle;

    const innerFaceZ = dirIn * (wallThickM / 2 + dM / 2);

    if (utility.category === 'electrical') {
      const frameGeo = new THREE.BoxGeometry(wM, hM, dM);
      const frameMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0x38bdf8 : 0xf1f5f9,
        roughness: 0.3,
        metalness: 0.1,
      });
      const frameMesh = new THREE.Mesh(frameGeo, frameMat);
      frameMesh.position.set(0, 0, innerFaceZ);
      frameMesh.userData = { type: 'utility', utilityId: utility.id, wallId: wall.id };
      group.add(frameMesh);

      const count = utility.subType === 'socket_triple' ? 3 : utility.subType === 'socket_double' ? 2 : 1;
      const socketSpacing = wM / count;
      const holeMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
      const holeGeo = new THREE.CylinderGeometry(0.015, 0.015, dM * 1.05, 16);
      holeGeo.rotateX(Math.PI / 2);

      for (let i = 0; i < count; i++) {
        const hx = -wM / 2 + socketSpacing * (i + 0.5);
        const hole = new THREE.Mesh(holeGeo, holeMat);
        hole.position.set(hx, 0, innerFaceZ);
        group.add(hole);
      }
    } else if (utility.category === 'plumbing') {
      if (utility.subType === 'water_drain') {
        const pipeGeo = new THREE.CylinderGeometry(wM / 2, wM / 2, dM, 16);
        pipeGeo.rotateX(Math.PI / 2);
        const pipeMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5 });
        const pipe = new THREE.Mesh(pipeGeo, pipeMat);
        pipe.position.set(0, 0, innerFaceZ);
        pipe.userData = { type: 'utility', utilityId: utility.id, wallId: wall.id };
        group.add(pipe);
      } else {
        const stubR = 0.018;
        const stubGeo = new THREE.CylinderGeometry(stubR, stubR, dM, 16);
        stubGeo.rotateX(Math.PI / 2);

        const hotMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });
        const coldMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 });

        const hotStub = new THREE.Mesh(stubGeo, hotMat);
        hotStub.position.set(-wM / 4, 0, innerFaceZ);
        hotStub.userData = { type: 'utility', utilityId: utility.id, wallId: wall.id };
        group.add(hotStub);

        const coldStub = new THREE.Mesh(stubGeo, coldMat);
        coldStub.position.set(wM / 4, 0, innerFaceZ);
        coldStub.userData = { type: 'utility', utilityId: utility.id, wallId: wall.id };
        group.add(coldStub);
      }
    } else if (utility.subType === 'gas_boiler') {
      const boilerGeo = new THREE.BoxGeometry(wM, hM, dM);
      const boilerMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0x38bdf8 : 0xffffff,
        roughness: 0.25,
        metalness: 0.1,
      });
      const boilerMesh = new THREE.Mesh(boilerGeo, boilerMat);
      boilerMesh.position.set(0, 0, innerFaceZ);
      boilerMesh.userData = { type: 'utility', utilityId: utility.id, wallId: wall.id };

      const panelGeo = new THREE.BoxGeometry(wM * 0.8, hM * 0.15, 0.005);
      const panelMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.set(0, -hM * 0.3, dirIn * (dM / 2 + 0.003));
      boilerMesh.add(panel);

      group.add(boilerMesh);
    } else if (utility.subType === 'radiator') {
      const radGeo = new THREE.BoxGeometry(wM, hM, dM);
      const radMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0x38bdf8 : 0xf8fafc,
        roughness: 0.3,
        metalness: 0.1,
      });
      const radMesh = new THREE.Mesh(radGeo, radMat);
      radMesh.position.set(0, 0, innerFaceZ);
      radMesh.userData = { type: 'utility', utilityId: utility.id, wallId: wall.id };
      group.add(radMesh);
    } else {
      const genGeo = new THREE.BoxGeometry(wM, hM, dM);
      const genMat = new THREE.MeshStandardMaterial({
        color: 0xeab308,
        roughness: 0.4,
        metalness: 0.2,
      });
      const genMesh = new THREE.Mesh(genGeo, genMat);
      genMesh.position.set(0, 0, innerFaceZ);
      genMesh.userData = { type: 'utility', utilityId: utility.id, wallId: wall.id };
      group.add(genMesh);
    }

    return group;
  }

  /**
   * Генерирует 3D-представление помещения (пол-полигон, стены со смещением наружу,
   * колонны/венткоробы, узловые маркеры и CAD-линейки)
   */
  public static buildRoom(room: RoomData, mode: '2D' | '3D' = '3D'): THREE.Group {
    const group = new THREE.Group();
    group.name = 'room_group';

    const vMap = buildVertexMap(room.vertices);

    // 1. Пол помещения (Полигон THREE.ShapeGeometry по замкнутому контуру вершин)
    if (room.vertices.length >= 3) {
      const shape = new THREE.Shape();
      const firstV = room.vertices[0];
      shape.moveTo(firstV.x / 1000, -firstV.z / 1000);

      for (let i = 1; i < room.vertices.length; i++) {
        const v = room.vertices[i];
        shape.lineTo(v.x / 1000, -v.z / 1000);
      }
      shape.closePath();

      const floorGeo = new THREE.ShapeGeometry(shape);
      const floorMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(room.floorColor),
        roughness: 0.6,
        metalness: 0.05,
      });

      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.y = 0;
      floorMesh.receiveShadow = true;
      floorMesh.name = 'floor_mesh';
      group.add(floorMesh);

      // Контур пола
      const floorEdgeMat = new THREE.LineBasicMaterial({ color: 0x475569, linewidth: 1.5 });
      const floorEdges = new THREE.LineSegments(new THREE.EdgesGeometry(floorGeo), floorEdgeMat);
      floorEdges.rotation.x = -Math.PI / 2;
      floorEdges.position.y = 0.001;
      floorEdges.raycast = () => {};
      group.add(floorEdges);

      // Вспомогательная координатная сетка
      const grid = new THREE.GridHelper(10, 20, 0x0284c7, 0x1e293b);
      grid.position.y = 0.001;
      group.add(grid);

      // Узловые маркеры вершин (для четкого отображения стыков и разбитых стен)
      const jointGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.005, 16);
      const jointMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      room.vertices.forEach((v) => {
        const jointMesh = new THREE.Mesh(jointGeo, jointMat);
        jointMesh.position.set(v.x / 1000, 0.002, v.z / 1000);
        jointMesh.raycast = () => {};
        group.add(jointMesh);
      });
    }

    // 2. Стены помещения (Призмы со СМЕЩЕНИЕМ ТОЛЩИНЫ НАРУЖУ)
    // Внутренняя грань каждой стены идеально совпадает с линией пола
    const baseboardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const bH = 0.08;   // 80 мм высота плинтуса
    const bT = 0.016;  // 16 мм глубина плинтуса

    room.walls.forEach((wall) => {
      const v1 = vMap[wall.startVertexId];
      const v2 = vMap[wall.endVertexId];
      if (!v1 || !v2) return;

      const lenMm = getWallLength(wall, vMap);
      if (lenMm <= 0) return;

      const len = lenMm / 1000;
      const height = wall.height / 1000;
      const thickness = wall.thickness / 1000;
      const angle = getWallAngle(wall, vMap);
      const mid = getWallMidpoint(wall, vMap);

      const inNorm = getInwardWallNormal(wall, vMap, room.vertices);
      const outNorm = getOutwardWallNormal(wall, vMap, room.vertices);

      const isSelected = mode === '2D' && room.selectedWallId === wall.id;

      const wallMat = new THREE.MeshStandardMaterial({
        color: isSelected
          ? new THREE.Color('#38bdf8')
          : new THREE.Color(wall.color || room.wallColor),
        roughness: 0.75,
        metalness: 0.0,
        transparent: true,
        opacity: 1.0,
      });

      const edgeLineMat = new THREE.LineBasicMaterial({
        color: isSelected ? 0x0284c7 : 0x475569,
        linewidth: isSelected ? 2.5 : 1.2,
      });

      const dx = v2.x - v1.x;
      const dz = v2.z - v1.z;
      const dirX = dx / lenMm;
      const dirZ = dz / lenMm;

      // Смещаем центр стены НАРУЖУ на half-thickness, чтобы внутренняя грань оставалась строго на контуре пола
      const wallCenterX = (mid.x + outNorm.nx * (wall.thickness / 2)) / 1000;
      const wallCenterZ = (mid.z + outNorm.nz * (wall.thickness / 2)) / 1000;

      // Находим все проёмы для данной стены
      const wallOpenings = (room.openings || []).filter((o) => o.wallId === wall.id);

      if (wallOpenings.length === 0) {
        // Сплошная стена без проёмов
        const wallGeo = new THREE.BoxGeometry(len, height, thickness);
        const wallMesh = new THREE.Mesh(wallGeo, wallMat);
        wallMesh.position.set(wallCenterX, height / 2, wallCenterZ);
        wallMesh.rotation.y = -angle;
        wallMesh.receiveShadow = true;
        wallMesh.castShadow = true;
        wallMesh.userData = {
          type: 'wall',
          wallId: wall.id,
          midPoint: { x: mid.x / 1000, z: mid.z / 1000 },
          outwardNormal: { nx: outNorm.nx, nz: outNorm.nz },
          inwardNormal: { nx: inNorm.nx, nz: inNorm.nz },
          defaultColor: wall.color || room.wallColor,
        };

        const wallEdges = new THREE.LineSegments(new THREE.EdgesGeometry(wallGeo), edgeLineMat);
        wallEdges.raycast = () => {};
        wallMesh.add(wallEdges);
        group.add(wallMesh);

        // Плинтус вдоль всей стены
        const plinthGeo = new THREE.BoxGeometry(len, bH, bT);
        const plinthMesh = new THREE.Mesh(plinthGeo, baseboardMat);
        plinthMesh.position.set(
          mid.x / 1000 + inNorm.nx * (bT / 2),
          bH / 2,
          mid.z / 1000 + inNorm.nz * (bT / 2)
        );
        plinthMesh.rotation.y = -angle;
        plinthMesh.raycast = () => {};
        plinthMesh.userData = {
          type: 'wallPlinth',
          wallId: wall.id,
        };
        group.add(plinthMesh);
      } else {
        // Стена с проёмами (окнами / дверями): составная геометрия из монолитных блоков
        const sortedOpenings = [...wallOpenings].sort((a, b) => a.offsetFromStart - b.offsetFromStart);

        interface WallBlock {
          u1: number;
          u2: number;
          y1: number;
          y2: number;
        }

        const blocks: WallBlock[] = [];
        const plinthIntervals: { u1: number; u2: number }[] = [];

        let prevU = 0;

        for (const op of sortedOpenings) {
          const uCenter = Math.max(op.width / 2 + 50, Math.min(lenMm - op.width / 2 - 50, op.offsetFromStart));
          const uStart = Math.max(0, uCenter - op.width / 2);
          const uEnd = Math.min(lenMm, uCenter + op.width / 2);

          const sillY = Math.max(0, op.sillHeight);
          const topY = Math.min(wall.height, op.sillHeight + op.height);

          // 1. Блок стены слева от проёма
          if (uStart > prevU + 5) {
            blocks.push({ u1: prevU, u2: uStart, y1: 0, y2: wall.height });
            plinthIntervals.push({ u1: prevU, u2: uStart });
          }

          // 2. Блок под проёмом (подоконная часть)
          if (sillY > 10) {
            blocks.push({ u1: uStart, u2: uEnd, y1: 0, y2: sillY });
            plinthIntervals.push({ u1: uStart, u2: uEnd });
          }

          // 3. Блок над проёмом (надоконная / наддверная перемычка)
          if (wall.height - topY > 10) {
            blocks.push({ u1: uStart, u2: uEnd, y1: topY, y2: wall.height });
          }

          prevU = uEnd;
        }

        // 4. Блок стены после последнего проёма
        if (lenMm > prevU + 5) {
          blocks.push({ u1: prevU, u2: lenMm, y1: 0, y2: wall.height });
          plinthIntervals.push({ u1: prevU, u2: lenMm });
        }

        // Создаем блоки стены
        blocks.forEach((blk) => {
          const bW = (blk.u2 - blk.u1) / 1000;
          const bH = (blk.y2 - blk.y1) / 1000;
          if (bW <= 0.005 || bH <= 0.005) return;

          const uMid = (blk.u1 + blk.u2) / 2;
          const yMid = (blk.y1 + blk.y2) / 2;

          const bX = (v1.x + uMid * dirX + outNorm.nx * (wall.thickness / 2)) / 1000;
          const bZ = (v1.z + uMid * dirZ + outNorm.nz * (wall.thickness / 2)) / 1000;
          const bY = yMid / 1000;

          const bGeo = new THREE.BoxGeometry(bW, bH, thickness);
          const bMesh = new THREE.Mesh(bGeo, wallMat);
          bMesh.position.set(bX, bY, bZ);
          bMesh.rotation.y = -angle;
          bMesh.receiveShadow = true;
          bMesh.castShadow = true;
          bMesh.userData = {
            type: 'wall',
            wallId: wall.id,
            midPoint: { x: mid.x / 1000, z: mid.z / 1000 },
            outwardNormal: { nx: outNorm.nx, nz: outNorm.nz },
            inwardNormal: { nx: inNorm.nx, nz: inNorm.nz },
            defaultColor: wall.color || room.wallColor,
          };

          const bEdges = new THREE.LineSegments(new THREE.EdgesGeometry(bGeo), edgeLineMat);
          bEdges.raycast = () => {};
          bMesh.add(bEdges);
          group.add(bMesh);
        });

        // Создаем плинтус (прерывается на дверях, продолжается под окнами)
        plinthIntervals.forEach((pi) => {
          const pLen = (pi.u2 - pi.u1) / 1000;
          if (pLen <= 0.01) return;
          const uMid = (pi.u1 + pi.u2) / 2;

          const pX = (v1.x + uMid * dirX + inNorm.nx * (bT / 2)) / 1000;
          const pZ = (v1.z + uMid * dirZ + inNorm.nz * (bT / 2)) / 1000;

          const pGeo = new THREE.BoxGeometry(pLen, bH, bT);
          const pMesh = new THREE.Mesh(pGeo, baseboardMat);
          pMesh.position.set(pX, bH / 2, pZ);
          pMesh.rotation.y = -angle;
          pMesh.raycast = () => {};
          pMesh.userData = {
            type: 'wallPlinth',
            wallId: wall.id,
          };
          group.add(pMesh);
        });

        // Создаем детальные 3D-модели окон и дверей
        sortedOpenings.forEach((op) => {
          if (op.type === 'window') {
            const winMesh = RoomBuilder.createWindowMesh(op, wall, vMap, room, mode);
            winMesh.userData = {
              type: 'wallOpening',
              wallId: wall.id,
            };
            group.add(winMesh);
          } else {
            const doorMesh = RoomBuilder.createDoorMesh(op, wall, vMap, room, mode);
            doorMesh.userData = {
              type: 'wallOpening',
              wallId: wall.id,
            };
            group.add(doorMesh);
          }
        });
      }

      // Размерная плашка над стеной (в мм) - только в режиме 2D плана
      if (mode === '2D') {
        const badgeText = `${lenMm.toLocaleString('ru-RU')} мм`;
        const badge = this.createWallDimensionBadge(badgeText, isSelected, wall.id);
        badge.position.set(wallCenterX, height + 0.18, wallCenterZ);
        group.add(badge);
      }
    });

    // 3. Архитектурные элементы (Венткоробы / Колонны)
    if (room.columns && room.columns.length > 0) {
      room.columns.forEach((col) => {
        const cW = col.width / 1000;
        const cD = col.depth / 1000;
        const cH = room.height / 1000;
        const isColSelected = room.selectedColumnId === col.id;

        const colGeo = new THREE.BoxGeometry(cW, cH, cD);
        const colMat = new THREE.MeshStandardMaterial({
          color: isColSelected ? new THREE.Color('#38bdf8') : new THREE.Color(col.color || '#cbd5e1'),
          roughness: 0.7,
          metalness: 0.05,
        });

        const colMesh = new THREE.Mesh(colGeo, colMat);
        colMesh.position.set(col.x / 1000, cH / 2, col.z / 1000);
        colMesh.rotation.y = (col.rotation * Math.PI) / 180;
        colMesh.receiveShadow = true;
        colMesh.castShadow = true;
        colMesh.userData = {
          type: 'column',
          columnId: col.id,
        };

        // CAD-контуры колонны
        const colEdgeMat = new THREE.LineBasicMaterial({
          color: isColSelected ? 0x0284c7 : 0x334155,
          linewidth: isColSelected ? 2.5 : 1.5,
        });
        const colEdges = new THREE.LineSegments(new THREE.EdgesGeometry(colGeo), colEdgeMat);
        colEdges.raycast = () => {};
        colMesh.add(colEdges);

        // Размерная плашка над коробом - только в режиме 2D плана
        if (mode === '2D') {
          const badgeText = `${col.name} (${col.width}×${col.depth})`;
          const badge = this.createWallDimensionBadge(badgeText, isColSelected);
          badge.position.set(0, cH / 2 + 0.15, 0);
          colMesh.add(badge);
        }

        group.add(colMesh);
      });
    }

    // 4. Технические коммуникации на стенах (розетки, выводы воды, газ, радиаторы)
    if (room.utilities && room.utilities.length > 0) {
      room.utilities.forEach((util) => {
        const wall = room.walls.find((w) => w.id === util.wallId);
        if (!wall) return;
        const utilMesh = RoomBuilder.createUtilityMesh(util, wall, vMap, room);
        group.add(utilMesh);
      });
    }

    return group;
  }
}
