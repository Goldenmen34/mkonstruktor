import { create } from 'zustand';
import { FurnitureModule } from '../types';
import { RoomData } from '../types/room';
import { usePlannerStore } from './usePlannerStore';
import { useRoomStore } from './useRoomStore';

export interface HistorySnapshot {
  modules: FurnitureModule[];
  room: RoomData;
  globalMaterials: {
    facade: string;
    carcass: string;
    countertop: string;
  };
}

interface HistoryStoreState {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  pushSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
}

const MAX_HISTORY = 40;

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function captureCurrentState(): HistorySnapshot {
  const pState = usePlannerStore.getState();
  const rState = useRoomStore.getState();

  return {
    modules: deepClone(pState.modules),
    room: deepClone(rState.room),
    globalMaterials: deepClone(pState.globalMaterials),
  };
}

function applySnapshot(snapshot: HistorySnapshot) {
  usePlannerStore.setState({
    modules: deepClone(snapshot.modules),
    globalMaterials: deepClone(snapshot.globalMaterials),
  });

  useRoomStore.setState({
    room: deepClone(snapshot.room),
  });
}

export const useHistoryStore = create<HistoryStoreState>((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  pushSnapshot: () => {
    const current = captureCurrentState();
    const { past } = get();

    const newPast = [...past, current].slice(-MAX_HISTORY);

    set({
      past: newPast,
      future: [],
      canUndo: newPast.length > 0,
      canRedo: false,
    });
  },

  undo: () => {
    const { past, future } = get();
    if (past.length === 0) return;

    const current = captureCurrentState();
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    const newFuture = [current, ...future];

    applySnapshot(previous);

    set({
      past: newPast,
      future: newFuture,
      canUndo: newPast.length > 0,
      canRedo: true,
    });
  },

  redo: () => {
    const { past, future } = get();
    if (future.length === 0) return;

    const current = captureCurrentState();
    const next = future[0];
    const newFuture = future.slice(1);
    const newPast = [...past, current];

    applySnapshot(next);

    set({
      past: newPast,
      future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
    });
  },

  clearHistory: () => {
    set({
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  },
}));
