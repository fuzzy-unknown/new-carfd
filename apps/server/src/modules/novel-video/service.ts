import { db } from "../../db";
import {
  storyProjects,
  storyCharacters,
  storyScenes,
  storyLocations,
  storyShots,
  continuityReports,
  generationRecords,
} from "../../db/schema";
import { eq, desc, and } from "drizzle-orm";
import { BailianClient } from "../../lib/bailian-client";
import { parseJSON } from "../../lib/json";
import { parseDashScopeError } from "../../utils/dashscope-errors";
import { uploadToOSS, uploadGeneratedToOSS } from "../../lib/oss";
import {
  buildAnalysisPrompt,
  buildCharacterPrompt,
  buildLocationPrompt,
  buildStoryboardPrompt,
} from "./prompts";
import { validateShotContinuity } from "./continuity";
import type { NormalizedShot, NormalizedCharacter, NormalizedLocation } from "./continuity";
import { buildShotVideoPrompt } from "./prompt-builder";
import {
  mapProjectSummary,
  mapCharacter,
  mapLocation,
  mapShot,
  mapContinuityIssues,
  type ProjectSummary,
  type ProjectDetail,
  type CharacterDTO,
  type LocationDTO,
  type ShotDTO,
} from "./mapper";
import type {
  NovelAnalysis,
  CharacterProfile,
  SceneProfile,
  ShotDraft,
  ContinuityIssue,
} from "@angry-mushroom/shared";
import { UPLOADS_DIR } from "../../config/paths";
import { mkdir, writeFile } from "node:fs/promises";
import path from "path";

const client = new BailianClient();

export class NovelVideoService {
  // ===== Project CRUD =====

  async createProject(input: { title?: string; storyText: string }): Promise<ProjectDetail> {
    const [project] = await db
      .insert(storyProjects)
      .values({
        title: input.title || null,
        storyText: input.storyText,
        status: "draft",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .returning();

    return this.getProject(project.id) as Promise<ProjectDetail>;
  }

  async getProject(projectId: number): Promise<ProjectDetail | null> {
    const [project] = await db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.id, projectId))
      .limit(1);

    if (!project) return null;

    const characters = await db
      .select()
      .from(storyCharacters)
      .where(eq(storyCharacters.projectId, projectId));

    const locations = await db
      .select()
      .from(storyLocations)
      .where(eq(storyLocations.projectId, projectId));

    const shots = await db
      .select()
      .from(storyShots)
      .where(eq(storyShots.projectId, projectId))
      .orderBy(storyShots.shotIndex);

    // Get latest continuity report
    const [latestReport] = await db
      .select()
      .from(continuityReports)
      .where(eq(continuityReports.projectId, projectId))
      .orderBy(desc(continuityReports.createdAt))
      .limit(1);

    // Resolve shot video status from generation_records
    const resolvedShots = await Promise.all(
      shots.map(async (shot) => {
        let videoUrl = shot.videoUrl;
        let status = shot.status;
        let errorMessage = shot.errorMessage;

        if (shot.videoTaskId && (status === "generating" || status === "pending" || status === "draft")) {
          const [record] = await db
            .select()
            .from(generationRecords)
            .where(eq(generationRecords.taskId, shot.videoTaskId))
            .limit(1);

          if (record) {
            if (record.status === "succeeded") {
              let outputResult: any = null;
              try { outputResult = record.outputResult ? JSON.parse(record.outputResult) : null; } catch { /* skip */ }
              if (outputResult?.results?.[0]?.video_url) {
                videoUrl = outputResult.results[0].video_url;
                status = "completed";
                errorMessage = null;
                await db
                  .update(storyShots)
                  .set({ videoUrl, status: "completed", errorMessage: null, updatedAt: Date.now() })
                  .where(eq(storyShots.id, shot.id));
              }
            } else if (record.status === "failed") {
              status = "failed";
              errorMessage = record.errorMessage || "视频生成失败";
              await db
                .update(storyShots)
                .set({ status: "failed", errorMessage, updatedAt: Date.now() })
                .where(eq(storyShots.id, shot.id));
            } else if (record.status === "processing" || record.status === "pending") {
              status = "generating";
            }
          }
        }

        return { ...shot, videoUrl, status, errorMessage };
      })
    );

    let analysis: ProjectDetail["analysis"] = null;
    if (project.analysisJson) {
      try {
        analysis = JSON.parse(project.analysisJson);
      } catch {
        /* skip */
      }
    }

    const continuityIssues = latestReport ? mapContinuityIssues(latestReport.issuesJson) : [];

    return {
      id: project.id,
      title: project.title,
      storyText: project.storyText,
      status: project.status,
      analysis,
      characters: characters.map(mapCharacter),
      locations: locations.map(mapLocation),
      shots: resolvedShots.map(mapShot),
      continuityIssues,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const projects = await db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.isDeleted, 0))
      .orderBy(desc(storyProjects.createdAt));

    return projects.map(mapProjectSummary);
  }

  // ===== Pipeline: Analyze =====

  async analyzeProject(projectId: number): Promise<ProjectDetail> {
    const [project] = await db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.id, projectId))
      .limit(1);

    if (!project) throw new Error("项目不存在");

    const { system, prompt } = buildAnalysisPrompt(project.storyText);
    const analysis = await client.chatJSON<NovelAnalysis>({ system, prompt });

    if (!analysis.characterNames || analysis.characterNames.length === 0) {
      throw new Error("剧情解析完成但未检测到角色，请检查故事内容");
    }

    await db
      .update(storyProjects)
      .set({
        analysisJson: JSON.stringify(analysis),
        status: "analyzed",
        updatedAt: Date.now(),
      })
      .where(eq(storyProjects.id, projectId));

    return this.getProject(projectId) as Promise<ProjectDetail>;
  }

  // ===== Pipeline: Generate Characters =====

  async generateCharacters(projectId: number): Promise<ProjectDetail> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error("项目不存在");
    if (!project.analysis) throw new Error("请先完成剧情解析");

    // Get existing characters to check locked ones
    const existingChars = await db
      .select()
      .from(storyCharacters)
      .where(eq(storyCharacters.projectId, projectId));

    const lockedNames = new Set(
      existingChars.filter((c) => c.locked === 1).map((c) => c.name)
    );

    // Delete non-locked characters for regeneration (preserve locked ones with their IDs)
    await db
      .delete(storyCharacters)
      .where(
        and(
          eq(storyCharacters.projectId, projectId),
          eq(storyCharacters.locked, 0),
        )
      );

    // Generate profiles for each character name from analysis
    for (const charName of project.analysis.characterNames) {
      if (lockedNames.has(charName)) continue;

      const { system, prompt } = buildCharacterPrompt(
        project.storyText,
        {
          summary: project.analysis.summary,
          mainConflict: project.analysis.mainConflict,
          timeline: project.analysis.timeline,
        },
        charName
      );

      const profile = await client.chatJSON<CharacterProfile>({
        system,
        prompt,
        model: "qwen3.7-plus",
        maxTokens: 2048,
      });

      if (!profile.identityPrompt) {
        throw new Error(`角色"${charName}"的 identityPrompt 生成失败，请重试`);
      }

      await db.insert(storyCharacters).values({
        projectId,
        name: profile.name || charName,
        description: `${profile.age} ${profile.gender} ${profile.bodyShape}`,
        appearance: profile.identityPrompt,
        role: profile.role,
        profileJson: JSON.stringify(profile),
        identityPrompt: profile.identityPrompt,
        negativePrompt: profile.negativePrompt,
        locked: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    await db
      .update(storyProjects)
      .set({ status: "characters_ready", updatedAt: Date.now() })
      .where(eq(storyProjects.id, projectId));

    return this.getProject(projectId) as Promise<ProjectDetail>;
  }

  // ===== Pipeline: Generate Locations =====

  async generateLocations(projectId: number): Promise<ProjectDetail> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error("项目不存在");
    if (!project.analysis) throw new Error("请先完成剧情解析");

    // Get existing locations to check locked ones
    const existingLocations = await db
      .select()
      .from(storyLocations)
      .where(eq(storyLocations.projectId, projectId));

    const lockedNames = new Set(
      existingLocations.filter((l) => l.locked === 1).map((l) => l.name)
    );

    // Delete non-locked locations (preserve locked ones with their IDs)
    await db
      .delete(storyLocations)
      .where(
        and(
          eq(storyLocations.projectId, projectId),
          eq(storyLocations.locked, 0),
        )
      );

    for (const sceneName of project.analysis.sceneNames) {
      if (lockedNames.has(sceneName)) continue;

      const { system, prompt } = buildLocationPrompt(
        project.storyText,
        {
          summary: project.analysis.summary,
          mainConflict: project.analysis.mainConflict,
          timeline: project.analysis.timeline,
        },
        sceneName
      );

      const profile = await client.chatJSON<SceneProfile>({
        system,
        prompt,
        model: "qwen3.7-plus",
        maxTokens: 2048,
      });

      if (!profile.scenePrompt) {
        throw new Error(`场景"${sceneName}"的 scenePrompt 生成失败，请重试`);
      }

      await db.insert(storyLocations).values({
        projectId,
        name: profile.name || sceneName,
        type: profile.type || "mixed",
        profileJson: JSON.stringify(profile),
        scenePrompt: profile.scenePrompt,
        negativePrompt: profile.negativePrompt || null,
        locked: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    await db
      .update(storyProjects)
      .set({ status: "scenes_ready", updatedAt: Date.now() })
      .where(eq(storyProjects.id, projectId));

    return this.getProject(projectId) as Promise<ProjectDetail>;
  }

  // ===== Pipeline: Generate Storyboard =====

  async generateStoryboard(projectId: number): Promise<ProjectDetail> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error("项目不存在");
    if (!project.analysis) throw new Error("请先完成剧情解析");
    if (project.characters.length === 0) throw new Error("请先生成角色库");
    if (project.locations.length === 0) throw new Error("请先生成场景库");

    // Delete existing shots
    await db
      .delete(storyShots)
      .where(eq(storyShots.projectId, projectId));

    const charSummaries = project.characters.map((c) => ({
      id: c.id,
      name: c.name,
      identityPrompt: c.identityPrompt || c.profile?.identityPrompt || "",
    }));

    const locSummaries = project.locations.map((l) => ({
      id: l.id,
      name: l.name,
      scenePrompt: l.scenePrompt,
    }));

    const { system, prompt } = buildStoryboardPrompt(
      project.storyText,
      {
        summary: project.analysis.summary,
        mainConflict: project.analysis.mainConflict,
        timeline: project.analysis.timeline,
      },
      charSummaries,
      locSummaries
    );

    const shotDrafts = await client.chatJSON<ShotDraft[]>({
      system,
      prompt,
      model: "qwen3.7-plus",
      maxTokens: 4096,
    });

    if (!Array.isArray(shotDrafts) || shotDrafts.length === 0) {
      throw new Error("分镜生成失败：AI 未返回有效分镜数据，请重试");
    }

    // Build a name→id map for characterFacing resolution
    const charNameToId = new Map(project.characters.map((c) => [c.name, c.id]));

    for (const draft of shotDrafts) {
      // Map characterFacing from names to IDs
      const facingById: Record<string, string> = {};
      for (const [name, dir] of Object.entries(draft.continuity.characterFacing)) {
        const cid = charNameToId.get(name);
        if (cid) {
          facingById[String(cid)] = dir;
        }
      }

      await db.insert(storyShots).values({
        projectId,
        shotIndex: draft.shotIndex,
        duration: draft.duration || 5,
        locationId: draft.sceneId || null,
        characterIdsJson: JSON.stringify(draft.characterIds || []),
        narrative: draft.narrative,
        cameraJson: JSON.stringify(draft.camera),
        continuityJson: JSON.stringify({
          ...draft.continuity,
          characterFacing: facingById,
        }),
        status: "draft",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    await db
      .update(storyProjects)
      .set({ status: "storyboard_ready", updatedAt: Date.now() })
      .where(eq(storyProjects.id, projectId));

    return this.getProject(projectId) as Promise<ProjectDetail>;
  }

  // ===== Pipeline: Check Continuity =====

  async checkContinuity(projectId: number): Promise<{ issues: ContinuityIssue[] }> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error("项目不存在");
    if (project.shots.length === 0) throw new Error("请先生成分镜");

    const normalizedShots: NormalizedShot[] = project.shots.map((s) => ({
      id: s.id,
      shotIndex: s.shotIndex,
      locationId: s.locationId || 0,
      characterIds: s.characterIds,
      narrative: s.narrative,
      camera: s.camera,
      continuity: s.continuity,
    }));

    const normalizedChars: NormalizedCharacter[] = project.characters.map((c) => ({
      id: c.id,
      name: c.name,
      identityPrompt: c.identityPrompt || "",
      negativePrompt: c.negativePrompt || "",
    }));

    const normalizedLocations: NormalizedLocation[] = project.locations.map((l) => ({
      id: l.id,
      name: l.name,
      scenePrompt: l.scenePrompt,
      negativePrompt: l.negativePrompt || "",
      cameraRules: l.profile?.cameraRules || {
        axisDirection: "",
        allowedAngles: [],
        forbiddenAngles: [],
      },
    }));

    const issues = validateShotContinuity({
      shots: normalizedShots,
      characters: normalizedChars,
      locations: normalizedLocations,
    });

    // Store report
    await db.insert(continuityReports).values({
      projectId,
      issuesJson: JSON.stringify(issues),
      createdAt: Date.now(),
    });

    // Update project status
    await db
      .update(storyProjects)
      .set({ status: "continuity_checked", updatedAt: Date.now() })
      .where(eq(storyProjects.id, projectId));

    return { issues };
  }

  // ===== Pipeline: Rebuild Prompts =====

  async rebuildShotPrompts(projectId: number): Promise<ProjectDetail> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error("项目不存在");
    if (project.shots.length === 0) throw new Error("请先生成分镜");

    const charMap = new Map(project.characters.map((c) => [c.id, c]));
    const locMap = new Map(project.locations.map((l) => [l.id, l]));

    for (const shot of project.shots) {
      const location = locMap.get(shot.locationId || 0);
      if (!location) continue;

      const shotChars = shot.characterIds
        .map((cid) => charMap.get(cid))
        .filter(Boolean) as CharacterDTO[];

      const { videoPrompt, negativePrompt } = buildShotVideoPrompt({
        shot: {
          id: shot.id,
          shotIndex: shot.shotIndex,
          locationId: shot.locationId || 0,
          characterIds: shot.characterIds,
          narrative: shot.narrative,
          camera: shot.camera,
          continuity: shot.continuity,
        },
        characters: shotChars.map((c) => ({
          id: c.id,
          name: c.name,
          identityPrompt: c.identityPrompt || "",
          negativePrompt: c.negativePrompt || "",
        })),
        location: {
          id: location.id,
          name: location.name,
          scenePrompt: location.scenePrompt,
          negativePrompt: location.negativePrompt || "",
          cameraRules: location.profile?.cameraRules || {
            axisDirection: "",
            allowedAngles: [],
            forbiddenAngles: [],
          },
        },
      });

      await db
        .update(storyShots)
        .set({
          videoPrompt,
          negativePrompt,
          status: "ready",
          updatedAt: Date.now(),
        })
        .where(eq(storyShots.id, shot.id));
    }

    return this.getProject(projectId) as Promise<ProjectDetail>;
  }

  // ===== Update Methods =====

  async updateCharacter(
    characterId: number,
    patch: Partial<CharacterProfile> & { locked?: boolean }
  ): Promise<CharacterDTO> {
    const [existing] = await db
      .select()
      .from(storyCharacters)
      .where(eq(storyCharacters.id, characterId))
      .limit(1);

    if (!existing) throw new Error("角色不存在");

    const updates: Record<string, any> = { updatedAt: Date.now() };

    if (patch.locked !== undefined) {
      updates.locked = patch.locked ? 1 : 0;
    }

    if (patch.name) updates.name = patch.name;
    if (patch.identityPrompt) updates.identityPrompt = patch.identityPrompt;
    if (patch.negativePrompt) updates.negativePrompt = patch.negativePrompt;

    // If full profile provided, merge with existing
    if (patch.face || patch.hair || patch.costume) {
      let existingProfile: CharacterProfile | null = null;
      if (existing.profileJson) {
        try { existingProfile = JSON.parse(existing.profileJson); } catch { /* skip */ }
      }

      const merged = { ...existingProfile, ...patch };
      updates.profileJson = JSON.stringify(merged);
      if (patch.identityPrompt) updates.identityPrompt = patch.identityPrompt;
      if (patch.negativePrompt) updates.negativePrompt = patch.negativePrompt;
    }

    await db
      .update(storyCharacters)
      .set(updates)
      .where(eq(storyCharacters.id, characterId));

    const [updated] = await db
      .select()
      .from(storyCharacters)
      .where(eq(storyCharacters.id, characterId))
      .limit(1);

    return mapCharacter(updated);
  }

  async updateLocation(
    locationId: number,
    patch: Partial<SceneProfile> & { locked?: boolean }
  ): Promise<LocationDTO> {
    const [existing] = await db
      .select()
      .from(storyLocations)
      .where(eq(storyLocations.id, locationId))
      .limit(1);

    if (!existing) throw new Error("场景不存在");

    const updates: Record<string, any> = { updatedAt: Date.now() };

    if (patch.locked !== undefined) {
      updates.locked = patch.locked ? 1 : 0;
    }

    if (patch.name) updates.name = patch.name;
    if (patch.scenePrompt) updates.scenePrompt = patch.scenePrompt;
    if (patch.negativePrompt) updates.negativePrompt = patch.negativePrompt;

    if (patch.visualRules || patch.cameraRules || patch.type) {
      let existingProfile: SceneProfile | null = null;
      if (existing.profileJson) {
        try { existingProfile = JSON.parse(existing.profileJson); } catch { /* skip */ }
      }

      const merged = { ...existingProfile, ...patch };
      updates.profileJson = JSON.stringify(merged);
    }

    await db
      .update(storyLocations)
      .set(updates)
      .where(eq(storyLocations.id, locationId));

    const [updated] = await db
      .select()
      .from(storyLocations)
      .where(eq(storyLocations.id, locationId))
      .limit(1);

    return mapLocation(updated);
  }

  async updateShot(shotId: number, patch: Partial<ShotDraft>): Promise<ShotDTO> {
    const [existing] = await db
      .select()
      .from(storyShots)
      .where(eq(storyShots.id, shotId))
      .limit(1);

    if (!existing) throw new Error("镜头不存在");

    const updates: Record<string, any> = { updatedAt: Date.now() };

    if (patch.narrative) updates.narrative = patch.narrative;
    if (patch.duration) updates.duration = patch.duration;
    if (patch.sceneId !== undefined) updates.locationId = patch.sceneId;
    if (patch.characterIds) updates.characterIdsJson = JSON.stringify(patch.characterIds);
    if (patch.camera) updates.cameraJson = JSON.stringify(patch.camera);
    if (patch.continuity) updates.continuityJson = JSON.stringify(patch.continuity);

    await db
      .update(storyShots)
      .set(updates)
      .where(eq(storyShots.id, shotId));

    const [updated] = await db
      .select()
      .from(storyShots)
      .where(eq(storyShots.id, shotId))
      .limit(1);

    return mapShot(updated);
  }

  // ===== Pipeline: Generate Shot Video =====

  async generateShotVideo(
    shotId: number,
    options?: { resolution?: string; duration?: number }
  ): Promise<ShotDTO> {
    const [shot] = await db
      .select()
      .from(storyShots)
      .where(eq(storyShots.id, shotId))
      .limit(1);

    if (!shot) throw new Error("镜头不存在");

    const projectId = shot.projectId;
    const resolution = options?.resolution || "720P";
    const duration = options?.duration || shot.duration || 5;

    // Build video prompt if not present
    let videoPrompt = shot.videoPrompt;
    let negativePrompt = shot.negativePrompt;

    if (!videoPrompt) {
      const project = await this.getProject(projectId);
      if (!project) throw new Error("项目不存在");

      const charMap = new Map(project.characters.map((c) => [c.id, c]));
      const locMap = new Map(project.locations.map((l) => [l.id, l]));

      const location = locMap.get(shot.locationId || 0);
      const shotChars = (JSON.parse(shot.characterIdsJson) as number[])
        .map((cid) => charMap.get(cid))
        .filter(Boolean) as CharacterDTO[];

      if (!location) {
        throw new Error("镜头缺少场景引用，请检查分镜设置");
      }

      const built = buildShotVideoPrompt({
        shot: {
          id: shot.id,
          shotIndex: shot.shotIndex,
          locationId: shot.locationId || 0,
          characterIds: JSON.parse(shot.characterIdsJson),
          narrative: shot.narrative,
          camera: JSON.parse(shot.cameraJson),
          continuity: JSON.parse(shot.continuityJson),
        },
        characters: shotChars.map((c) => ({
          id: c.id,
          name: c.name,
          identityPrompt: c.identityPrompt || "",
          negativePrompt: c.negativePrompt || "",
        })),
        location: {
          id: location.id,
          name: location.name,
          scenePrompt: location.scenePrompt,
          negativePrompt: location.negativePrompt || "",
          cameraRules: location.profile?.cameraRules || {
            axisDirection: "",
            allowedAngles: [],
            forbiddenAngles: [],
          },
        },
      });

      videoPrompt = built.videoPrompt;
      negativePrompt = built.negativePrompt;

      await db
        .update(storyShots)
        .set({
          videoPrompt,
          negativePrompt,
          status: "ready",
          updatedAt: Date.now(),
        })
        .where(eq(storyShots.id, shotId));
    }

    // Decide model: use r2v if characters have reference images
    const charIds: number[] = JSON.parse(shot.characterIdsJson);
    const characters = await db
      .select()
      .from(storyCharacters)
      .where(eq(storyCharacters.projectId, projectId));

    const refChars = characters.filter(
      (c) => charIds.includes(c.id) && (c.turnaroundSheetUrl || c.referenceImageUrl)
    );

    let effectiveModel = "happyhorse-1.0-t2v";
    // DashScope video models have prompt length limits
    const MAX_PROMPT_LEN = 2500;
    const truncatedPrompt = (videoPrompt || "").slice(0, MAX_PROMPT_LEN);
    const input: Record<string, any> = { prompt: truncatedPrompt };
    const parameters: Record<string, any> = { resolution, duration };

    console.log(`[novel-video] generateShotVideo shot=${shotId} model=${effectiveModel} promptLen=${truncatedPrompt.length} hasRefChars=${refChars.length > 0}`);

    if (refChars.length > 0) {
      // Use r2v model with reference images
      // NOTE: DashScope r2v may not accept base64 data URIs in some regions.
      // Fall back to t2v if r2v fails.
      effectiveModel = "happyhorse-1.0-r2v";
      parameters.ratio = "16:9";
      const media: { type: string; url: string }[] = [];
      let enhancedPrompt = "";
      const nameToTag = new Map<string, string>();

      for (let i = 0; i < refChars.length; i++) {
        const c = refChars[i];
        try {
          // Prefer turnaround sheet (三视图) for r2v reference, fall back to portrait
          const refUrl = c.turnaroundSheetUrl || c.referenceImageUrl;
          if (!refUrl) continue;
          const imageUrl = await this.getReferenceUrl(refUrl);
          console.log(`[novel-video] ref image char=${c.name} type=${c.turnaroundSheetUrl ? "turnaround" : "portrait"} urlType=${imageUrl.startsWith("http") ? "OSS" : "dataURI"} urlLen=${imageUrl.length}`);
          if (imageUrl.length > 10 * 1024 * 1024) {
            console.warn(`[novel-video] ref image too large, skipping char=${c.name}`);
            continue;
          }
          media.push({ type: "reference_image", url: imageUrl });
          enhancedPrompt += `[Image ${i + 1}] is ${c.name}. `;
          nameToTag.set(c.name, `[Image ${i + 1}]`);
        } catch (err: any) {
          console.warn(`[novel-video] failed to load ref image for char=${c.name}: ${err.message}`);
        }
      }

      if (media.length > 0) {
        // Replace character names with [Image N] tags
        let replacedPrompt = videoPrompt;
        const sorted = [...nameToTag.entries()].sort((a, b) => b[0].length - a[0].length);
        for (const [name, tag] of sorted) {
          replacedPrompt = replacedPrompt.replace(
            new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
            tag
          );
        }
        const r2vPrompt = enhancedPrompt + replacedPrompt;
        input.prompt = r2vPrompt.slice(0, MAX_PROMPT_LEN);
        input.media = media;
      }
    }

    // Create DashScope video task (with fallback from r2v to t2v)
    let taskResult;
    try {
      taskResult = await client.generateVideoTask({
        model: effectiveModel,
        input,
        parameters,
      });
    } catch (err: any) {
      // If r2v fails (e.g. data URI not accepted), fall back to t2v without media
      if (effectiveModel === "happyhorse-1.0-r2v") {
        console.warn(`[novel-video] r2v failed (${err.message}), falling back to t2v without reference images`);
        effectiveModel = "happyhorse-1.0-t2v";
        delete parameters.ratio;
        input.prompt = truncatedPrompt;
        delete input.media;
        taskResult = await client.generateVideoTask({
          model: effectiveModel,
          input,
          parameters,
        });
      } else {
        throw err;
      }
    }

    // Create internal taskId and generation record
    const taskId = `${effectiveModel}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    await db.insert(generationRecords).values({
      taskId,
      model: effectiveModel,
      category: "video",
      status: "pending",
      inputParams: JSON.stringify({
        prompt: videoPrompt,
        resolution,
        duration,
        _dashscope_task_id: taskResult.dashscopeTaskId,
      }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update shot with task ID
    await db
      .update(storyShots)
      .set({
        videoTaskId: taskId,
        status: "generating",
        errorMessage: null,
        updatedAt: Date.now(),
      })
      .where(eq(storyShots.id, shotId));

    // Update project status
    await db
      .update(storyProjects)
      .set({ status: "generating", updatedAt: Date.now() })
      .where(eq(storyProjects.id, projectId));

    const [updated] = await db
      .select()
      .from(storyShots)
      .where(eq(storyShots.id, shotId))
      .limit(1);

    return mapShot(updated);
  }

  // ===== Generate Character Reference Image =====

  async generateCharacterReference(characterId: number): Promise<CharacterDTO> {
    const [character] = await db
      .select()
      .from(storyCharacters)
      .where(eq(storyCharacters.id, characterId))
      .limit(1);

    if (!character) throw new Error("角色不存在");
    if (!character.identityPrompt) throw new Error("角色缺少 identityPrompt，请先生成角色库");

    const basePrompt = character.identityPrompt;
    const negativePrompt = (character.negativePrompt || "") + ", background, scenery, environment, landscape, indoor, outdoor, lighting effects";

    console.log(`[generateCharacterReference] Generating for character "${character.name}" (id=${characterId})`);

    // 1. Generate portrait (white background, character only)
    const portraitPrompt = `Character portrait, ${basePrompt}. Plain white background, full body or upper body portrait, character standing still facing forward, no background scenery, no environment, studio lighting on white backdrop, character design sheet style.`;

    const portraitUrl = await this.callImageGeneration(
      portraitPrompt,
      negativePrompt,
      `ref-char-${characterId}`,
      "portrait"
    );

    // Upload portrait to OSS
    let portraitFinal = portraitUrl;
    try { portraitFinal = await this.uploadLocalToOSS(portraitUrl, `char/${characterId}-portrait-${Date.now()}`); } catch (err) {
      console.warn("[generateCharacterReference] Portrait OSS upload failed:", err);
    }

    // 2. Generate turnaround sheet (front, side, back)
    const turnaroundPrompt = `Character turnaround reference sheet showing the same character from three views: front view (center), side view (left), and back view (right). ${basePrompt}. The character is shown in a neutral standing pose from each angle. Plain white background, character design turnaround sheet, clean layout, consistent appearance across all three views, no background scenery, no environment.`;

    let turnaroundFinal: string | null = null;
    try {
      const turnaroundUrl = await this.callImageGeneration(
        turnaroundPrompt,
        negativePrompt,
        `ref-char-${characterId}-turnaround`,
        "turnaround"
      );

      try { turnaroundFinal = await this.uploadLocalToOSS(turnaroundUrl, `char/${characterId}-turnaround-${Date.now()}`); } catch (err) {
        console.warn("[generateCharacterReference] Turnaround OSS upload failed:", err);
        turnaroundFinal = turnaroundUrl;
      }
    } catch (err: any) {
      console.warn(`[generateCharacterReference] Turnaround sheet generation failed: ${err.message}`);
      // Non-fatal: portrait alone is still usable
    }

    // Update character with both images
    await db
      .update(storyCharacters)
      .set({
        referenceImageUrl: portraitFinal,
        turnaroundSheetUrl: turnaroundFinal,
        updatedAt: Date.now(),
      })
      .where(eq(storyCharacters.id, characterId));

    const [updated] = await db
      .select()
      .from(storyCharacters)
      .where(eq(storyCharacters.id, characterId))
      .limit(1);

    return mapCharacter(updated);
  }

  /**
   * Call DashScope image generation API, download result, return local URL.
   */
  private async callImageGeneration(
    prompt: string,
    negativePrompt: string,
    taskIdPrefix: string,
    filePrefix: string
  ): Promise<string> {
    const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || "";
    const response = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen-image-2.0-pro",
          input: {
            messages: [
              { role: "user", content: [{ text: prompt }] },
            ],
          },
          parameters: {
            size: "1024*1024",
            n: 1,
            negative_prompt: negativePrompt,
            watermark: false,
            prompt_extend: true,
          },
        }),
      }
    );

    if (!response.ok) {
      let errorBody: any;
      try { errorBody = await response.json(); } catch { /* skip */ }
      throw new Error(`图片生成失败: ${parseDashScopeError(errorBody || {})}`);
    }

    const result = await response.json();

    if (result.code || result.error) {
      throw new Error(`图片生成失败: ${parseDashScopeError(result)}`);
    }

    const images = result.output?.choices?.[0]?.message?.content || [];
    if (!images.length || !images[0].image) {
      throw new Error("图片生成失败：模型未返回图片");
    }

    const taskId = `${taskIdPrefix}-${Date.now()}`;
    return await this.downloadAndSaveFile(images[0].image, taskId, filePrefix);
  }

  /**
   * Upload a local file (from /api/uploads/ path) to OSS, return OSS URL or original.
   */
  private async uploadLocalToOSS(localUrl: string, keyPrefix: string): Promise<string> {
    const relativePath = localUrl.replace("/api/uploads/", "");
    const fullPath = path.join(UPLOADS_DIR, relativePath);
    const file = Bun.file(fullPath);
    if (!(await file.exists())) return localUrl;

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(relativePath).slice(1) || "png";
    const mimeMap: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
    };
    const contentType = mimeMap[ext] || "image/png";
    const ossUrl = await uploadToOSS(buffer, `${keyPrefix}.${ext}`, contentType);
    return ossUrl || localUrl;
  }

  // ===== Generate Location Reference Image =====

  async generateLocationReference(locationId: number): Promise<LocationDTO> {
    const [location] = await db
      .select()
      .from(storyLocations)
      .where(eq(storyLocations.id, locationId))
      .limit(1);

    if (!location) throw new Error("场景不存在");
    if (!location.scenePrompt) throw new Error("场景缺少 scenePrompt，请先生成场景库");

    const prompt = location.scenePrompt;
    const negativePrompt = location.negativePrompt || "";

    console.log(`[generateLocationReference] Generating for location "${location.name}" (id=${locationId})`);

    // Call DashScope image generation API
    const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || "";
    const response = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen-image-2.0-pro",
          input: {
            messages: [
              {
                role: "user",
                content: [{ text: prompt }],
              },
            ],
          },
          parameters: {
            size: "1024*1024",
            n: 1,
            negative_prompt: negativePrompt,
            watermark: false,
            prompt_extend: true,
          },
        }),
      }
    );

    if (!response.ok) {
      let errorBody: any;
      try { errorBody = await response.json(); } catch { /* skip */ }
      throw new Error(`场景图片生成失败: ${parseDashScopeError(errorBody || {})}`);
    }

    const result = await response.json();

    if (result.code || result.error) {
      throw new Error(`场景图片生成失败: ${parseDashScopeError(result)}`);
    }

    const images = result.output?.choices?.[0]?.message?.content || [];
    if (!images.length || !images[0].image) {
      throw new Error("场景图片生成失败：模型未返回图片");
    }

    // Download and save the image
    const remoteUrl = images[0].image;
    const taskId = `ref-loc-${locationId}-${Date.now()}`;
    const localUrl = await this.downloadAndSaveFile(remoteUrl, taskId, "ref");

    // Upload to OSS
    let finalUrl = localUrl;
    try {
      const relativePath = localUrl.replace("/api/uploads/", "");
      const fullPath = path.join(UPLOADS_DIR, relativePath);
      const file = Bun.file(fullPath);
      if (await file.exists()) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = path.extname(relativePath).slice(1) || "png";
        const mimeMap: Record<string, string> = {
          png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
        };
        const contentType = mimeMap[ext] || "image/png";
        const ossUrl = await uploadToOSS(buffer, `loc/${locationId}-ref-${Date.now()}.${ext}`, contentType);
        if (ossUrl) finalUrl = ossUrl;
      }
    } catch (err) {
      console.warn("[generateLocationReference] OSS upload failed, using local URL:", err);
    }

    // Update location
    await db
      .update(storyLocations)
      .set({ referenceImageUrl: finalUrl, updatedAt: Date.now() })
      .where(eq(storyLocations.id, locationId));

    const [updated] = await db
      .select()
      .from(storyLocations)
      .where(eq(storyLocations.id, locationId))
      .limit(1);

    return mapLocation(updated);
  }

  /**
   * Download a remote file and save it locally under uploads.
   */
  private async downloadAndSaveFile(
    remoteUrl: string,
    taskId: string,
    prefix: string
  ): Promise<string> {
    const res = await fetch(remoteUrl);
    if (!res.ok) throw new Error(`下载失败: HTTP ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());

    // Determine extension from content-type or URL
    const contentType = res.headers.get("content-type") || "";
    let ext = "png";
    if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";
    else if (contentType.includes("webp")) ext = "webp";
    else if (contentType.includes("png")) ext = "png";

    const dir = path.join(UPLOADS_DIR, taskId);
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${prefix}.${ext}`);
    await writeFile(filePath, buffer);

    return `/api/uploads/${taskId}/${prefix}.${ext}`;
  }

  // ===== Upload Character Reference =====

  async uploadCharacterReference(
    characterId: number,
    file: File
  ): Promise<CharacterDTO> {
    const [character] = await db
      .select()
      .from(storyCharacters)
      .where(eq(storyCharacters.id, characterId))
      .limit(1);

    if (!character) throw new Error("角色不存在");

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const imageExts = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];
    if (!imageExts.includes(ext)) {
      throw new Error("仅支持图片文件（PNG/JPG/WEBP/BMP/GIF）");
    }

    const fileName = `char/${characterId}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const mimeMap: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
      webp: "image/webp", bmp: "image/bmp", gif: "image/gif",
    };
    const contentType = mimeMap[ext] || "application/octet-stream";

    // Upload to OSS (also saves locally)
    const ossUrl = await uploadToOSS(buffer, fileName, contentType);

    await db
      .update(storyCharacters)
      .set({ referenceImageUrl: ossUrl, updatedAt: Date.now() })
      .where(eq(storyCharacters.id, characterId));

    const [updated] = await db
      .select()
      .from(storyCharacters)
      .where(eq(storyCharacters.id, characterId))
      .limit(1);

    return mapCharacter(updated);
  }

  // ===== Helpers =====

  /**
   * Get a usable URL for a reference image.
   * If it's already an OSS/HTTP URL, return it directly.
   * If it's a local path, convert to base64 data URI.
   */
  private async getReferenceUrl(url: string): Promise<string> {
    // Already a public URL (OSS or other) — return directly
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }

    // Legacy local path — convert to base64 data URI
    const relativePath = url.replace("/api/uploads/", "");
    const fullPath = path.join(UPLOADS_DIR, relativePath);

    const file = Bun.file(fullPath);
    if (!(await file.exists())) {
      throw new Error(`Reference file not found: ${url}`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(fullPath).slice(1).toLowerCase();
    const mimeMap: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      bmp: "image/bmp",
    };
    const mime = mimeMap[ext] || "application/octet-stream";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  }
}

export const novelVideoService = new NovelVideoService();
