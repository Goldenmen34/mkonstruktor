import { FurnitureModule, ProjectSettings, RoomConfig } from './index';
import { RoomData } from './room';

export interface SavedProjectData {
  modules: FurnitureModule[];
  projectSettings: ProjectSettings;
  globalMaterials: {
    carcass: string;
    facade: string;
    countertop: string;
    handle?: string;
  };
  roomData: RoomData;
  roomConfig: RoomConfig;
  customTemplates?: any[];
}

export interface SavedProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  totalPrice?: number;
  modulesCount?: number;
  data: SavedProjectData;
}
