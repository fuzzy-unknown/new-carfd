import type { CharacterProfile, SceneProfile, ShotDraft, ContinuityIssue, ProjectStatus, ShotStatus } from "@angry-mushroom/shared";
import type { StoryProject, StoryCharacter, StoryLocation, StoryShot, ContinuityReport } from "../../db/schema";

// ===== DTO Types =====

export interface ProjectSummary {
  id: number;
  title: string | null;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface CharacterDTO {
  id: number;
  projectId: number;
  name: string;
  role: string | null;
  profile: CharacterProfile | null;
  identityPrompt: string | null;
  negativePrompt: string | null;
  locked: boolean;
  referenceImageUrl: string | null;
  referenceImages: string[] | null;
}

export interface LocationDTO {
  id: number;
  projectId: number;
  name: string;
  type: string;
  profile: SceneProfile | null;
  scenePrompt: string;
  negativePrompt: string | null;
  referenceImageUrl: string | null;
  locked: boolean;
}

export interface ShotDTO {
  id: number;
  projectId: number;
  shotIndex: number;
  duration: number;
  locationId: number | null;
  characterIds: number[];
  narrative: string;
  camera: ShotDraft["camera"];
  continuity: ShotDraft["continuity"];
  videoPrompt: string | null;
  negativePrompt: string | null;
  videoTaskId: string | null;
  videoUrl: string | null;
  status: string;
  errorMessage: string | null;
}

export interface ProjectDetail {
  id: number;
  title: string | null;
  storyText: string;
  status: string;
  analysis: {
    summary: string;
    mainConflict: string;
    timeline: string[];
    characterNames: string[];
    sceneNames: string[];
  } | null;
  characters: CharacterDTO[];
  locations: LocationDTO[];
  shots: ShotDTO[];
  continuityIssues: ContinuityIssue[];
  createdAt: number;
  updatedAt: number;
}

// ===== Mapper Functions =====

export function mapProjectSummary(row: StoryProject): ProjectSummary {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapCharacter(row: StoryCharacter): CharacterDTO {
  let profile: CharacterProfile | null = null;
  if (row.profileJson) {
    try { profile = JSON.parse(row.profileJson); } catch { /* skip */ }
  }

  let referenceImages: string[] | null = null;
  if (row.referenceImagesJson) {
    try { referenceImages = JSON.parse(row.referenceImagesJson); } catch { /* skip */ }
  }

  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    role: row.role,
    profile,
    identityPrompt: row.identityPrompt,
    negativePrompt: row.negativePrompt,
    locked: row.locked === 1,
    referenceImageUrl: row.referenceImageUrl,
    referenceImages,
  };
}

export function mapLocation(row: StoryLocation): LocationDTO {
  let profile: SceneProfile | null = null;
  if (row.profileJson) {
    try { profile = JSON.parse(row.profileJson); } catch { /* skip */ }
  }

  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    type: row.type,
    profile,
    scenePrompt: row.scenePrompt,
    negativePrompt: row.negativePrompt,
    referenceImageUrl: row.referenceImageUrl,
    locked: row.locked === 1,
  };
}

export function mapShot(row: StoryShot): ShotDTO {
  let characterIds: number[] = [];
  try { characterIds = JSON.parse(row.characterIdsJson); } catch { /* skip */ }

  let camera: ShotDraft["camera"] = {
    shotSize: "medium",
    angle: "front",
    movement: "static",
    lens: "35mm",
  };
  try { camera = JSON.parse(row.cameraJson); } catch { /* skip */ }

  let continuity: ShotDraft["continuity"] = {
    screenDirection: "front",
    characterFacing: {},
    actionStart: "",
    actionEnd: "",
    emotionStart: "",
    emotionEnd: "",
  };
  try { continuity = JSON.parse(row.continuityJson); } catch { /* skip */ }

  return {
    id: row.id,
    projectId: row.projectId,
    shotIndex: row.shotIndex,
    duration: row.duration,
    locationId: row.locationId,
    characterIds,
    narrative: row.narrative,
    camera,
    continuity,
    videoPrompt: row.videoPrompt,
    negativePrompt: row.negativePrompt,
    videoTaskId: row.videoTaskId,
    videoUrl: row.videoUrl,
    status: row.status,
    errorMessage: row.errorMessage,
  };
}

export function mapContinuityIssues(issuesJson: string): ContinuityIssue[] {
  try { return JSON.parse(issuesJson); } catch { return []; }
}
