import { db } from "../../db";
import { generationRecords, storyShots, storyScenes, storyCharacters, storyProjects } from "../../db/schema";
import { eq, and, desc, sql, notInArray } from "drizzle-orm";

export interface AssetItem {
  id: string;
  type: "image" | "video";
  source: "workspace" | "novel";
  url: string;
  thumbnailUrl?: string;
  title?: string;
  prompt?: string;
  model?: string;
  projectId?: number;
  projectTitle?: string;
  status: string;
  createdAt: number;
}

export interface AssetStats {
  totalImages: number;
  totalVideos: number;
  workspaceImages: number;
  workspaceVideos: number;
  novelVideos: number;
  novelCharacterImages: number;
}

class AssetsService {
  /**
   * 获取所有被 story_shots / story_scenes 引用的 taskId 列表
   * 这些记录应归为"小说探索"来源，不应出现在"工作台"中
   */
  private async getNovelTaskIds(): Promise<Set<string>> {
    const shotTaskIds = await db
      .select({ taskId: storyShots.videoTaskId })
      .from(storyShots)
      .where(sql`${storyShots.videoTaskId} IS NOT NULL AND ${storyShots.videoTaskId} != ''`);

    const sceneTaskIds = await db
      .select({ taskId: storyScenes.videoTaskId })
      .from(storyScenes)
      .where(sql`${storyScenes.videoTaskId} IS NOT NULL AND ${storyScenes.videoTaskId} != ''`);

    const ids = new Set<string>();
    for (const r of shotTaskIds) if (r.taskId) ids.add(r.taskId);
    for (const r of sceneTaskIds) if (r.taskId) ids.add(r.taskId);
    return ids;
  }

  /**
   * 获取所有资产，支持按类型和来源过滤
   */
  async getAssets(type: string = "all", source: string = "all"): Promise<AssetItem[]> {
    const assets: AssetItem[] = [];
    const novelTaskIds = await this.getNovelTaskIds();

    // 1. 工作台生成的资产（排除小说来源的记录）
    if (source === "all" || source === "workspace") {
      const workspaceAssets = await this.getWorkspaceAssets(type, novelTaskIds);
      assets.push(...workspaceAssets);
    }

    // 2. 小说探索生成的资产
    if (source === "all" || source === "novel") {
      const novelAssets = await this.getNovelAssets(type);
      assets.push(...novelAssets);
    }

    // 按创建时间倒序排列
    assets.sort((a, b) => b.createdAt - a.createdAt);

    return assets;
  }

  /**
   * 获取工作台生成的资产（来自 generation_records，排除小说管线产生的记录）
   */
  private async getWorkspaceAssets(type: string, novelTaskIds: Set<string>): Promise<AssetItem[]> {
    const assets: AssetItem[] = [];

    // 构建查询条件
    const conditions = [eq(generationRecords.status, "succeeded")];
    if (type !== "all") {
      conditions.push(eq(generationRecords.category, type));
    } else {
      // 只查 image 和 video
      conditions.push(
        sql`${generationRecords.category} IN ('image', 'video')`
      );
    }

    // 排除被小说管线引用的记录
    if (novelTaskIds.size > 0) {
      const excludeIds = Array.from(novelTaskIds);
      conditions.push(
        notInArray(generationRecords.taskId, excludeIds)
      );
    }

    const records = await db
      .select()
      .from(generationRecords)
      .where(and(...conditions))
      .orderBy(desc(generationRecords.createdAt));

    for (const record of records) {
      const outputResult = record.outputResult ? JSON.parse(record.outputResult) : null;
      const inputParams = record.inputParams ? JSON.parse(record.inputParams) : {};

      if (record.category === "image" && outputResult?.images) {
        for (const img of outputResult.images) {
          if (img.image) {
            assets.push({
              id: `ws-img-${record.id}`,
              type: "image",
              source: "workspace",
              url: img.image,
              thumbnailUrl: img.image,
              title: `图片生成 · ${record.model}`,
              prompt: inputParams.prompt || "",
              model: record.model,
              status: record.status,
              createdAt: record.createdAt,
            });
          }
        }
      } else if (record.category === "video" && outputResult?.results) {
        for (const res of outputResult.results) {
          if (res.video_url) {
            assets.push({
              id: `ws-vid-${record.id}`,
              type: "video",
              source: "workspace",
              url: res.video_url,
              title: `视频生成 · ${record.model}`,
              prompt: inputParams.prompt || "",
              model: record.model,
              status: record.status,
              createdAt: record.createdAt,
            });
          }
        }
      }
    }

    return assets;
  }

  /**
   * 获取小说探索生成的资产（来自 story_shots、story_scenes 和 story_characters）
   */
  private async getNovelAssets(type: string): Promise<AssetItem[]> {
    const assets: AssetItem[] = [];

    // 获取所有项目信息用于标题显示
    const projects = await db.select().from(storyProjects);
    const projectMap = new Map(projects.map(p => [p.id, p.title || `故事项目 #${p.id}`]));

    // 1. 新版分镜视频（story_shots）
    if (type === "all" || type === "video") {
      const shots = await db
        .select()
        .from(storyShots)
        .where(eq(storyShots.status, "completed"))
        .orderBy(desc(storyShots.createdAt));

      for (const shot of shots) {
        if (shot.videoUrl) {
          assets.push({
            id: `novel-shot-${shot.id}`,
            type: "video",
            source: "novel",
            url: shot.videoUrl,
            title: `分镜 #${shot.shotIndex + 1} · ${projectMap.get(shot.projectId) || "未知项目"}`,
            prompt: shot.videoPrompt || shot.narrative || "",
            model: "novel-video-pipeline",
            projectId: shot.projectId,
            projectTitle: projectMap.get(shot.projectId),
            status: shot.status,
            createdAt: shot.createdAt,
          });
        }
      }

      // 2. 旧版场景视频（story_scenes），排除 URL 已出现在 story_shots 中的
      const existingUrls = new Set(assets.map(a => a.url));
      const scenes = await db
        .select()
        .from(storyScenes)
        .where(eq(storyScenes.status, "completed"))
        .orderBy(desc(storyScenes.createdAt));

      for (const scene of scenes) {
        if (scene.videoUrl && !existingUrls.has(scene.videoUrl)) {
          assets.push({
            id: `novel-scene-${scene.id}`,
            type: "video",
            source: "novel",
            url: scene.videoUrl,
            title: `${scene.title || `场景 ${scene.sceneNumber}`} · ${projectMap.get(scene.projectId) || "未知项目"}`,
            prompt: scene.videoPrompt || scene.description || "",
            model: "novel-video-pipeline",
            projectId: scene.projectId,
            projectTitle: projectMap.get(scene.projectId),
            status: scene.status,
            createdAt: scene.createdAt,
          });
          existingUrls.add(scene.videoUrl);
        }
      }
    }

    // 3. 角色参考图片
    if (type === "all" || type === "image") {
      const characters = await db
        .select()
        .from(storyCharacters)
        .orderBy(desc(storyCharacters.createdAt));

      for (const char of characters) {
        // 主参考图片
        if (char.referenceImageUrl) {
          assets.push({
            id: `novel-char-${char.id}`,
            type: "image",
            source: "novel",
            url: char.referenceImageUrl,
            thumbnailUrl: char.referenceImageUrl,
            title: `角色参考 · ${char.name}`,
            prompt: char.identityPrompt || char.appearance || "",
            model: "character-reference",
            projectId: char.projectId,
            projectTitle: projectMap.get(char.projectId),
            status: "succeeded",
            createdAt: char.createdAt,
          });
        }

        // 额外参考图片
        if (char.referenceImagesJson) {
          try {
            const extraImages: string[] = JSON.parse(char.referenceImagesJson);
            for (let i = 0; i < extraImages.length; i++) {
              assets.push({
                id: `novel-char-extra-${char.id}-${i}`,
                type: "image",
                source: "novel",
                url: extraImages[i],
                thumbnailUrl: extraImages[i],
                title: `角色参考 · ${char.name} (${i + 1})`,
                prompt: char.identityPrompt || char.appearance || "",
                model: "character-reference",
                projectId: char.projectId,
                projectTitle: projectMap.get(char.projectId),
                status: "succeeded",
                createdAt: char.createdAt,
              });
            }
          } catch { /* skip invalid JSON */ }
        }
      }
    }

    return assets;
  }

  /**
   * 获取资产统计（去重后的准确数字）
   */
  async getAssetStats(): Promise<AssetStats> {
    const novelTaskIds = await this.getNovelTaskIds();

    // 工作台图片（不会与小说管线重叠，但安全起见也做排除）
    const wsImgConditions = [
      eq(generationRecords.status, "succeeded"),
      eq(generationRecords.category, "image"),
    ];
    if (novelTaskIds.size > 0) {
      wsImgConditions.push(notInArray(generationRecords.taskId, Array.from(novelTaskIds)));
    }
    const workspaceImages = await db
      .select({ count: sql<number>`count(*)` })
      .from(generationRecords)
      .where(and(...wsImgConditions));

    // 工作台视频（排除小说管线生成的）
    const wsVidConditions = [
      eq(generationRecords.status, "succeeded"),
      eq(generationRecords.category, "video"),
    ];
    if (novelTaskIds.size > 0) {
      wsVidConditions.push(notInArray(generationRecords.taskId, Array.from(novelTaskIds)));
    }
    const workspaceVideos = await db
      .select({ count: sql<number>`count(*)` })
      .from(generationRecords)
      .where(and(...wsVidConditions));

    // 小说分镜视频（story_shots 已完成）
    const novelShotVideos = await db
      .select({ count: sql<number>`count(*)` })
      .from(storyShots)
      .where(eq(storyShots.status, "completed"));

    // 小说旧版场景视频（story_scenes 已完成，排除与 story_shots URL 重复的）
    const novelSceneVideos = await db
      .select({ count: sql<number>`count(*)` })
      .from(storyScenes)
      .where(
        and(
          eq(storyScenes.status, "completed"),
          sql`${storyScenes.videoUrl} IS NOT NULL AND ${storyScenes.videoUrl} != ''`
        )
      );

    // 用 URL 去重 story_shots 和 story_scenes 之间的重复
    const shotUrls = await db
      .select({ url: storyShots.videoUrl })
      .from(storyShots)
      .where(eq(storyShots.status, "completed"));
    const shotUrlSet = new Set(shotUrls.map(r => r.url).filter(Boolean));

    const sceneUrls = await db
      .select({ url: storyScenes.videoUrl })
      .from(storyScenes)
      .where(
        and(
          eq(storyScenes.status, "completed"),
          sql`${storyScenes.videoUrl} IS NOT NULL AND ${storyScenes.videoUrl} != ''`
        )
      );
    const novelSceneOnlyCount = sceneUrls.filter(r => r.url && !shotUrlSet.has(r.url)).length;

    const nvShotCount = Number(novelShotVideos[0]?.count || 0);

    // 角色参考图片
    const novelCharacterImages = await db
      .select({ count: sql<number>`count(*)` })
      .from(storyCharacters)
      .where(sql`${storyCharacters.referenceImageUrl} IS NOT NULL AND ${storyCharacters.referenceImageUrl} != ''`);

    const wsImgCount = Number(workspaceImages[0]?.count || 0);
    const wsVidCount = Number(workspaceVideos[0]?.count || 0);
    const nvCharImgCount = Number(novelCharacterImages[0]?.count || 0);

    return {
      totalImages: wsImgCount + nvCharImgCount,
      totalVideos: wsVidCount + nvShotCount + novelSceneOnlyCount,
      workspaceImages: wsImgCount,
      workspaceVideos: wsVidCount,
      novelVideos: nvShotCount + novelSceneOnlyCount,
      novelCharacterImages: nvCharImgCount,
    };
  }
}

export const assetsService = new AssetsService();
