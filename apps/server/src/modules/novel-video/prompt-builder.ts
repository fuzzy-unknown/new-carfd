import type { NormalizedShot, NormalizedCharacter, NormalizedLocation } from "./continuity";

/**
 * Parse time range like "0s-5s" and return start and end seconds
 */
function parseTimeRange(timeRange: string): { start: number; end: number } {
  const match = timeRange.match(/(\d+)s-(\d+)s/);
  if (!match) return { start: 0, end: 5 };
  return { start: parseInt(match[1]), end: parseInt(match[2]) };
}

/**
 * Expand timeline into per-second action descriptions
 * Takes timeline entries like "0s-5s: 人物站立" and expands them into:
 * 0s-1s: 人物站立
 * 1s-2s: 人物站立
 * 2s-3s: 人物站立
 * 3s-4s: 人物站立
 * 4s-5s: 人物站立
 */
function expandTimelineToPerSecond(timeline: Array<{ time: string; action: string }>): Array<{ time: string; action: string }> {
  const perSecond: Array<{ time: string; action: string }> = [];

  for (const entry of timeline) {
    const { start, end } = parseTimeRange(entry.time);
    const action = entry.action;

    // Generate per-second entries
    for (let second = start; second < end; second++) {
      perSecond.push({
        time: `${second}s-${second + 1}s`,
        action: action,
      });
    }
  }

  return perSecond;
}

/**
 * Build a detailed timeline section with per-second action descriptions
 */
function buildTimelineSection(
  timeline: Array<{ time: string; action: string }>,
  actionStart: string,
  actionEnd: string,
  emotionStart: string,
  emotionEnd: string,
  duration: number
): string {
  if (timeline && timeline.length > 0) {
    // Expand to per-second granularity
    const perSecondTimeline = expandTimelineToPerSecond(timeline);

    let sections: string[] = [];

    // Group consecutive seconds with same action for readability
    let currentAction = perSecondTimeline[0]?.action || "";
    let startTime = 0;
    let endTime = 0;

    for (let i = 0; i < perSecondTimeline.length; i++) {
      const entry = perSecondTimeline[i];
      if (entry.action !== currentAction || i === perSecondTimeline.length - 1) {
        // Add accumulated section
        if (currentAction) {
          if (startTime === endTime) {
            sections.push(`  ${startTime}s-${startTime + 1}s: ${currentAction}`);
          } else {
            sections.push(`  ${startTime}s-${endTime + 1}s: ${currentAction}`);
          }
        }
        // Start new section
        currentAction = entry.action;
        startTime = parseInt(entry.time.split("-")[0]);
        endTime = startTime;
      } else {
        endTime = parseInt(entry.time.split("-")[0]);
      }
    }

    return sections.join("\n");
  }

  // Fallback: create per-second timeline from start/end actions
  let fallback: string[] = [];
  const totalSeconds = Math.floor(duration);

  for (let second = 0; second < totalSeconds; second++) {
    // Interpolate between start and end
    const progress = second / totalSeconds;
    let action = actionStart;

    // Simple interpolation for emotion/action changes
    if (second === 0) {
      action = actionStart;
    } else if (second === totalSeconds - 1) {
      action = actionEnd;
    } else {
      // Middle seconds - maintain action
      action = actionStart;
    }

    fallback.push(`  ${second}s-${second + 1}s: ${action}`);
  }

  return fallback.join("\n");
}

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

  // Build detailed timeline section with per-second granularity
  const duration = shot.duration || 5;
  const timelineSection = buildTimelineSection(
    timeline || [],
    shot.continuity.actionStart,
    shot.continuity.actionEnd,
    shot.continuity.emotionStart,
    shot.continuity.emotionEnd,
    duration
  );

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

Frame-by-frame timeline (total ${duration}s):
${timelineSection}

Emotion continuity:
  Start emotion: ${shot.continuity.emotionStart}
  End emotion: ${shot.continuity.emotionEnd}

Character facing:
${facingSection}

${environmentSection ? `Environment:\n${environmentSection}\n` : ""}Camera:
${cameraSection}

Important requirements for high-coherence AI video:
- Each second must have explicit, meaningful action
- No static frames - continuous motion required
- Smooth transitions between consecutive seconds
- Maintain character appearance consistency across all frames
- Maintain costume and hairstyle consistency
- Keep scene structure and lighting consistent
- Do not cross the 180-degree axis
- Do not suddenly change character facing direction
- Do not suddenly change lighting or mood
- Do not introduce new characters mid-shot
- No background music or sound effects
- Natural, realistic human movements
- Cinematic quality with professional framing`;

  // Build negative prompt from characters + location
  const charNegatives = characters
    .map((c) => c.negativePrompt || "")
    .filter(Boolean)
    .join(", ");

  const negativePrompt = [
    charNegatives,
    location.negativePrompt || "",
    "blurry, low quality, distorted faces, extra limbs, watermark, text overlay, motion blur, camera shake, static pose, frozen frame, sudden movement changes",
  ]
    .filter(Boolean)
    .join(", ");

  return { videoPrompt, negativePrompt };
}
