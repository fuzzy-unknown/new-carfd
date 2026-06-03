import type { NormalizedShot, NormalizedCharacter, NormalizedLocation } from "./continuity";

/**
 * Build a video generation prompt from a shot's structured data,
 * combining character identity, scene settings, narrative, continuity,
 * camera direction, and strict consistency constraints.
 */
export function buildShotVideoPrompt(args: {
  shot: NormalizedShot;
  characters: NormalizedCharacter[];
  location: NormalizedLocation;
}): { videoPrompt: string; negativePrompt: string } {
  const { shot, characters, location } = args;

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

Action continuity:
  Shot start: ${shot.continuity.actionStart}
  Shot end: ${shot.continuity.actionEnd}

Emotion continuity:
  Start emotion: ${shot.continuity.emotionStart}
  End emotion: ${shot.continuity.emotionEnd}

Character facing:
${facingSection}

Camera:
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
- No background music`;

  // Build negative prompt from characters + location
  const charNegatives = characters
    .map((c) => c.negativePrompt || "")
    .filter(Boolean)
    .join(", ");

  const negativePrompt = [
    charNegatives,
    location.negativePrompt || "",
    "blurry, low quality, distorted faces, extra limbs, watermark, text overlay",
  ]
    .filter(Boolean)
    .join(", ");

  return { videoPrompt, negativePrompt };
}
