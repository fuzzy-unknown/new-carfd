export type ProjectStatus =
  | "draft"
  | "analyzed"
  | "characters_ready"
  | "scenes_ready"
  | "storyboard_ready"
  | "continuity_checked"
  | "generating"
  | "completed"
  | "failed";

export type ShotStatus =
  | "draft"
  | "ready"
  | "generating"
  | "completed"
  | "failed";

export interface NovelAnalysis {
  summary: string;
  mainConflict: string;
  timeline: string[];
  characterNames: string[];
  sceneNames: string[];
}

export interface CharacterProfile {
  name: string;
  role: "protagonist" | "supporting" | "villain" | "background";
  age: string;
  gender: string;
  bodyShape: string;
  height: string;
  face: {
    shape: string;
    eyes: string;
    eyebrows: string;
    nose: string;
    mouth: string;
    skin: string;
  };
  hair: {
    color: string;
    style: string;
    length: string;
  };
  costume: {
    mainColor: string;
    style: string;
    material: string;
    details: string[];
  };
  accessories: string[];
  identityPrompt: string;
  negativePrompt: string;
}

export interface SceneProfile {
  name: string;
  type: "interior" | "exterior" | "mixed";
  location: string;
  era: string;
  atmosphere: string;
  visualRules: {
    colorPalette: string[];
    lighting: string;
    architecture: string;
    floor: string;
    backgroundElements: string[];
  };
  cameraRules: {
    axisDirection: string;
    allowedAngles: string[];
    forbiddenAngles: string[];
  };
  scenePrompt: string;
  negativePrompt: string;
}

export interface ShotDraft {
  shotIndex: number;
  duration: number;
  sceneId: number;
  characterIds: number[];
  narrative: string;
  camera: {
    shotSize: "wide" | "medium" | "close_up" | "extreme_close_up";
    angle: "front" | "side" | "over_shoulder" | "low_angle" | "high_angle";
    movement: "static" | "push_in" | "pull_out" | "pan_left" | "pan_right" | "tracking" | "slow dolly in" | "slow dolly out" | "orbit shot" | "crane shot";
    lens: string;
  };
  continuity: {
    screenDirection: "left_to_right" | "right_to_left" | "front" | "back";
    characterFacing: Record<string, "left" | "right" | "front" | "back">;
    actionStart: string;
    actionEnd: string;
    emotionStart: string;
    emotionEnd: string;
  };
  timeline?: Array<{ time: string; action: string }>;
  environment?: {
    backgroundMotion?: string;
    lighting?: string;
    mood?: string;
    style?: string;
  };
  prompt?: {
    videoPrompt?: string;
    negativePrompt?: string;
  };
}

export interface ContinuityIssue {
  severity: "error" | "warning";
  shotId?: number;
  shotIndex?: number;
  code:
    | "ACTION_MISMATCH"
    | "EMOTION_MISMATCH"
    | "FACING_CHANGE"
    | "MISSING_SCENE"
    | "MISSING_CHARACTER"
    | "FORBIDDEN_CAMERA_ANGLE";
  message: string;
  suggestion?: string;
}
