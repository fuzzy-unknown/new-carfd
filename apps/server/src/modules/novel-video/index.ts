import Elysia from "elysia";
import { novelVideoService } from "./service";

export const novelVideoRoute = new Elysia({ prefix: "/novel-video" })

  // ===== Projects =====
  .get("/projects", async () => {
    const projects = await novelVideoService.listProjects();
    return { data: projects, timestamp: new Date().toISOString() };
  })

  .post("/projects", async ({ body }) => {
    const { title, storyText, autoGenerate } = body as { title?: string; storyText: string; autoGenerate?: boolean };
    if (!storyText?.trim()) {
      throw new Error("故事文本不能为空");
    }
    const project = await novelVideoService.createProject({ title, storyText, autoGenerate });
    return { data: project, timestamp: new Date().toISOString() };
  })

  .get("/projects/:id", async ({ params: { id } }) => {
    const project = await novelVideoService.getProject(Number(id));
    if (!project) {
      throw new Error("项目不存在");
    }
    return { data: project, timestamp: new Date().toISOString() };
  })

  // ===== Pipeline Steps =====
  .post("/projects/:id/analyze", async ({ params: { id } }) => {
    const project = await novelVideoService.analyzeProject(Number(id));
    return { data: project, timestamp: new Date().toISOString() };
  })

  .post("/projects/:id/characters/generate", async ({ params: { id } }) => {
    const project = await novelVideoService.generateCharacters(Number(id));
    return { data: project, timestamp: new Date().toISOString() };
  })

  .post("/projects/:id/locations/generate", async ({ params: { id } }) => {
    const project = await novelVideoService.generateLocations(Number(id));
    return { data: project, timestamp: new Date().toISOString() };
  })

  .post("/projects/:id/storyboard/generate", async ({ params: { id } }) => {
    const project = await novelVideoService.generateStoryboard(Number(id));
    return { data: project, timestamp: new Date().toISOString() };
  })

  .post("/projects/:id/continuity/check", async ({ params: { id } }) => {
    const result = await novelVideoService.checkContinuity(Number(id));
    return { data: result, timestamp: new Date().toISOString() };
  })

  .post("/projects/:id/prompts/rebuild", async ({ params: { id } }) => {
    const project = await novelVideoService.rebuildShotPrompts(Number(id));
    return { data: project, timestamp: new Date().toISOString() };
  })

  // ===== Patch Endpoints =====
  .patch("/characters/:id", async ({ params: { id }, body }) => {
    const patch = body as Record<string, any>;
    const character = await novelVideoService.updateCharacter(Number(id), patch);
    return { data: character, timestamp: new Date().toISOString() };
  })

  .patch("/locations/:id", async ({ params: { id }, body }) => {
    const patch = body as Record<string, any>;
    const location = await novelVideoService.updateLocation(Number(id), patch);
    return { data: location, timestamp: new Date().toISOString() };
  })

  .post("/locations/:id/generate-reference", async ({ params: { id } }) => {
    const location = await novelVideoService.generateLocationReference(Number(id));
    return { data: location, timestamp: new Date().toISOString() };
  })

  .patch("/shots/:id", async ({ params: { id }, body }) => {
    const patch = body as Record<string, any>;
    const shot = await novelVideoService.updateShot(Number(id), patch);
    return { data: shot, timestamp: new Date().toISOString() };
  })

  // ===== Shot Video Generation =====
  .post("/shots/:id/generate", async ({ params: { id }, body }) => {
    const options = (body as Record<string, any>) || {};
    const shot = await novelVideoService.generateShotVideo(Number(id), {
      resolution: options.resolution,
      duration: options.duration,
    });
    return { data: shot, timestamp: new Date().toISOString() };
  })

  // ===== Character Reference =====
  .post("/characters/:id/generate-reference", async ({ params: { id } }) => {
    const character = await novelVideoService.generateCharacterReference(Number(id));
    return { data: character, timestamp: new Date().toISOString() };
  })

  .post("/characters/:id/upload-reference", async ({ params: { id }, request }) => {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      throw new Error("请上传图片文件");
    }
    const character = await novelVideoService.uploadCharacterReference(Number(id), file);
    return { data: character, timestamp: new Date().toISOString() };
  })

  // ===== Error Handler =====
  .onError(({ error, set }) => {
    const message = error instanceof Error ? error.message : "未知错误";
    console.error("[novel-video]", message);
    set.status = 400;
    return { error: message, timestamp: new Date().toISOString() };
  });
