import type { NormalizedShot, NormalizedCharacter, NormalizedLocation } from "./continuity";

/**
 * Build a video generation prompt from a shot's structured data,
 * combining character identity, scene settings, narrative, continuity,
 * camera direction, timeline breakdown, and strict consistency constraints.
 */
export function buildShotVideoPrompt(args: {
  shot: NormalizedShot;
  characters: NormalizedCharacter[];
  location: NormalizedLocation;
  timeline?: Array<{ time: string; action: string }>;
  environment?: { backgroundMotion?: string; lighting?: string; mood?: string; style?: string };
}): { videoPrompt: string; negativePrompt: string } {
  const { shot, characters, location, timeline, environment } = args;

  // Build ID→name map for resolving characterFacing keys
  const idToName = new Map(characters.map((c) => [String(c.id), c.name]));

  // Character identity section
  const characterSection = characters
    .map((c) => `Character "${c.name}": ${c.identityPrompt}`)
    .join("\n");

  // Character facing section — resolve IDs to names
  const facingEntries = Object.entries(shot.continuity.characterFacing);
  const facingSection = facingEntries
    .map(([idOrName, dir]) => {
      const name = idToName.get(idOrName) || idOrName;
      return `  ${name}: facing ${dir}`;
    })
    .join("\n");

  // Timeline section (if available)
  const timelineSection = timeline && timeline.length > 0
    ? timeline.map((t) => `  ${t.time}: ${t.action}`).join("\n")
    : `  Shot start: ${shot.continuity.actionStart}\n  Shot end: ${shot.continuity.actionEnd}`;

  // Environment section (if available)
  const environmentSection = environment
    ? `Background motion: ${environment.backgroundMotion || "static"}
Lighting: ${environment.lighting || "natural"}
Mood: ${environment.mood || "neutral"}
Style: ${environment.style || "cinematic"}`
    : "";

  // Camera section
  const cameraSection = [
    `Shot size: ${shot.camera.shotSize}`,
    `Angle: ${shot.camera.angle}`,
    `Movement: ${shot.camera.movement}`,
    `Lens: ${shot.camera.lens}`,
  ].join(", ");

  const videoPrompt = `Character consistency:
${characterSection}

Scene consistency:
${location.scenePrompt}

Current shot:
${shot.narrative}

Timeline:
${timelineSection}

Emotion continuity:
  Start emotion: ${shot.continuity.emotionStart}
  End emotion: ${shot.continuity.emotionEnd}

Character facing:
${facingSection}

${environmentSection ? `Environment:\n${environmentSection}\n` : ""}Camera:
${cameraSection}

Important requirements:
- Maintain same character appearance
- Maintain same costume
- Maintain same hairstyle
- Maintain same accessories
- Keep scene structure consistent
- Do not cross the axis
- Do not suddenly change character facing
- Do not suddenly change lighting
- Do not add new characters
- No background music
- Continuous motion, natural movement
- Cinematic realism`;

  // Build negative prompt from characters + location
  const charNegatives = characters
    .map((c) => c.negativePrompt || "")
    .filter(Boolean)
    .join(", ");

  const negativePrompt = [
    charNegatives,
    location.negativePrompt || "",
    "blurry, low quality, distorted faces, extra limbs, watermark, text overlay, motion blur, camera shake",
  ]
    .filter(Boolean)
    .join(", ");

  return { videoPrompt, negativePrompt };
}
