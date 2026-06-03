# 小说生成视频连续性 MVP 实施文档

本文档面向 Claude / Codex / 开发代理执行。目标是在当前项目基础上完成一个可用的“小说生成视频连续性 MVP”，不要推倒重来，不要重命名 `apps/server`，不要把项目迁移到新的框架。

## 0. 当前项目基线

当前仓库是 Bun monorepo：

```txt
apps/web      React + Vite + Tailwind + shadcn/Radix
apps/server   Elysia + Drizzle + SQLite + DashScope/百炼 API
packages/shared
docs
```

当前已有能力：

- `apps/web/src/pages/Workspace.tsx`：通用 AI 创作工作台。
- `apps/web/src/pages/Explore.tsx`：输入故事，分析为场景和角色，逐场景生成视频。
- `apps/web/src/pages/Billing.tsx`：消费统计。
- `apps/server/src/modules/bailian/service.ts`：百炼调用、上传、记录、故事分析、视频生成、视频任务轮询。
- `apps/server/src/db/schema.ts`：`generation_records`、`story_projects`、`story_scenes`、`story_characters` 等表。

MVP 不做这些事：

- 不迁移到 `apps/api`。
- 不引入 Redis。
- 不引入 PostgreSQL/MySQL。
- 不做最终视频拼接。
- 不做自动尾帧提取。
- 不做完整多集短剧系统。
- 不把所有模块提前抽成 packages。

MVP 要做这些事：

- 把“故事直接生成场景视频”升级成“角色库 + 场景库 + 分镜 + 连续性检查 + prompt 生成器 + 单镜头视频生成”。
- 让用户可以编辑并锁定角色、场景、分镜。
- 让生成 prompt 由系统拼接，而不是完全交给模型自由发挥。
- 保持当前百炼生成记录、计费统计、上传机制继续可用。

## 1. MVP 产品目标

用户流程：

```txt
创建 / 输入故事
  ↓
剧情解析
  ↓
生成角色库
  ↓
生成场景库
  ↓
生成分镜
  ↓
检查连续性
  ↓
用户编辑 / 修正
  ↓
逐镜头生成视频
  ↓
查看每个镜头结果
```

MVP 成功标准：

- 同一个角色在所有镜头里使用同一套固定描述。
- 同一个场景在所有镜头里使用同一套固定描述。
- 每个镜头有结构化数据：角色、场景、时长、动作、情绪、人物朝向、镜头语言。
- 连续性检查能指出明显问题。
- 用户可以在前端修改角色设定、场景设定、镜头设定。
- 单个镜头可独立生成、失败重试、查看错误。
- 不影响现有 `Workspace` 和 `Billing`。

## 2. 推荐分支和提交策略

建议新建分支：

```bash
git checkout -b codex/novel-video-continuity-mvp
```

建议按阶段提交：

```txt
1. schema and shared types
2. bailian client and json helpers
3. novel pipeline services
4. continuity validator and prompt builder
5. api routes
6. web explore workflow
7. polish and tests
```

## 3. 数据模型设计

### 3.1 共享类型

新增文件：

```txt
packages/shared/src/novel-video.ts
```

并从 `packages/shared/src/index.ts` 导出。

类型：

```ts
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
    movement: "static" | "push_in" | "pull_out" | "pan_left" | "pan_right" | "tracking";
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
```

### 3.2 数据库 schema

修改：

```txt
apps/server/src/db/schema.ts
```

保留现有表，扩展字段。

`story_projects` 新增：

```ts
title: text("title"),
analysisJson: text("analysis_json"),
```

`story_characters` 新增：

```ts
role: text("role"),
profileJson: text("profile_json"),
identityPrompt: text("identity_prompt"),
negativePrompt: text("negative_prompt"),
locked: integer("locked").notNull().default(0),
referenceImagesJson: text("reference_images_json"),
```

`story_scenes` 当前表示“剧情场景片段”，MVP 建议继续保留兼容旧逻辑，但新增一个独立的“场景库”表：

```ts
export const storyLocations = sqliteTable("story_locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => storyProjects.id),
  name: text("name").notNull(),
  type: text("type").notNull().default("mixed"),
  profileJson: text("profile_json").notNull(),
  scenePrompt: text("scene_prompt").notNull(),
  negativePrompt: text("negative_prompt"),
  locked: integer("locked").notNull().default(0),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Date.now()),
});
```

新增分镜表：

```ts
export const storyShots = sqliteTable("story_shots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => storyProjects.id),
  shotIndex: integer("shot_index").notNull(),
  duration: integer("duration").notNull().default(5),
  locationId: integer("location_id").references(() => storyLocations.id),
  characterIdsJson: text("character_ids_json").notNull().default("[]"),
  narrative: text("narrative").notNull(),
  cameraJson: text("camera_json").notNull(),
  continuityJson: text("continuity_json").notNull(),
  videoPrompt: text("video_prompt"),
  negativePrompt: text("negative_prompt"),
  videoTaskId: text("video_task_id"),
  videoUrl: text("video_url"),
  status: text("status").notNull().default("draft"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Date.now()),
});
```

新增连续性检查结果表：

```ts
export const continuityReports = sqliteTable("continuity_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => storyProjects.id),
  issuesJson: text("issues_json").notNull(),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
});
```

生成迁移：

```bash
bun run --cwd apps/server db:generate
```

应用迁移：

```bash
bun run --cwd apps/server db:push
```

注意：不要删除旧表和旧字段，避免破坏现有数据。

## 4. 后端目录设计

新增：

```txt
apps/server/src/modules/novel-video/
  index.ts
  service.ts
  prompts.ts
  continuity.ts
  prompt-builder.ts
  mapper.ts

apps/server/src/lib/
  bailian-client.ts
  json.ts
```

保留：

```txt
apps/server/src/modules/bailian/
```

MVP 可以先让 `novel-video` 复用 `bailianService` 的视频生成能力，但推荐逐步抽公共客户端。

## 5. 百炼客户端

新增：

```txt
apps/server/src/lib/bailian-client.ts
```

职责：

- 统一读取 `DASHSCOPE_API_KEY`。
- `chatJSON<T>`：调用千问模型并解析 JSON。
- `generateVideoTask`：创建异步视频任务。
- `queryTask`：查询异步任务。
- 统一错误解析 `parseDashScopeError`。
- 简单重试：网络错误最多 2 次。

接口：

```ts
export class BailianClient {
  constructor(private apiKey = process.env.DASHSCOPE_API_KEY || "") {}

  async chatJSON<T>(options: {
    system: string;
    prompt: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<T>;

  async generateVideoTask(options: {
    model: string;
    input: Record<string, any>;
    parameters: Record<string, any>;
  }): Promise<{ dashscopeTaskId: string; raw: any }>;

  async queryTask(taskId: string): Promise<any>;
}
```

JSON 解析辅助：

```txt
apps/server/src/lib/json.ts
```

要求：

- 支持去掉 ```json 代码块。
- 支持从文本中提取第一段 JSON object / array。
- 解析失败要抛出包含原始片段前 500 字的错误。

## 6. AI Prompt 设计

新增：

```txt
apps/server/src/modules/novel-video/prompts.ts
```

### 6.1 剧情解析 Prompt

输入：小说全文。

输出：

```json
{
  "summary": "",
  "mainConflict": "",
  "timeline": [],
  "characterNames": [],
  "sceneNames": []
}
```

约束：

- 不生成视频 prompt。
- 不新增不存在的剧情。
- 角色名必须稳定。
- 场景名必须可复用。
- 只输出 JSON。

### 6.2 角色库 Prompt

输入：小说、剧情解析、角色名。

输出：`CharacterProfile`。

要求：

- 不要“帅气、漂亮、神秘”等空词。
- 必须描述脸型、五官、发型、服装、配饰、体型。
- `identityPrompt` 需要能直接拼进视频 prompt。
- `negativePrompt` 需要禁止换脸、换衣、变年龄、多余人物。

### 6.3 场景库 Prompt

输入：小说、剧情解析、场景名。

输出：`SceneProfile`。

要求：

- 必须固定建筑、色彩、光线方向、背景元素。
- 必须给出 `cameraRules.axisDirection`。
- `scenePrompt` 需要能直接拼进视频 prompt。
- `negativePrompt` 需要禁止场景变化、光线突变、时代错乱。

### 6.4 分镜 Prompt

输入：小说、剧情解析、角色库、场景库。

输出：`ShotDraft[]`。

要求：

- 每个镜头 3-5 秒，MVP 允许 5 秒。
- 每个镜头必须引用已有角色和已有场景。
- 不要新增角色、不要新增场景。
- 动作必须有 `actionStart` 和 `actionEnd`。
- 情绪必须有 `emotionStart` 和 `emotionEnd`。
- `characterFacing` 的 key 先用角色名，保存前映射为角色 ID。
- 不直接生成最终视频 prompt。

## 7. 连续性检查器

新增：

```txt
apps/server/src/modules/novel-video/continuity.ts
```

实现：

```ts
export function validateShotContinuity(args: {
  shots: NormalizedShot[];
  characters: NormalizedCharacter[];
  locations: NormalizedLocation[];
}): ContinuityIssue[];
```

MVP 检查规则：

1. 每个镜头必须有合法场景。
2. 每个镜头必须有合法角色。
3. 同一场景连续镜头中，角色朝向不能无理由突变。
4. 同一场景连续镜头中，上一镜头 `actionEnd` 与下一镜头 `actionStart` 不一致时报警。
5. 同一场景连续镜头中，上一镜头 `emotionEnd` 与下一镜头 `emotionStart` 不一致时报警。
6. 镜头角度如果在该场景 `forbiddenAngles` 中，报错。

不要在 MVP 做复杂空间推理。先做可解释规则。

## 8. Prompt 生成器

新增：

```txt
apps/server/src/modules/novel-video/prompt-builder.ts
```

接口：

```ts
export function buildShotVideoPrompt(args: {
  shot: NormalizedShot;
  characters: NormalizedCharacter[];
  location: NormalizedLocation;
}): { videoPrompt: string; negativePrompt: string };
```

拼接结构：

```txt
角色一致性：
{每个角色 identityPrompt}

场景一致性：
{location.scenePrompt}

当前镜头：
{shot.narrative}

动作连续性：
镜头开始：{actionStart}
镜头结束：{actionEnd}

情绪连续性：
开始情绪：{emotionStart}
结束情绪：{emotionEnd}

人物朝向：
{characterFacing}

摄影机：
{shotSize}, {angle}, {movement}, {lens}

重要要求：
- 保持同一个人物
- 保持同一服装
- 保持同一发型
- 保持同一配饰
- 保持场景结构一致
- 不要跨轴
- 不要突然改变人物朝向
- 不要突然改变光线
- 不要新增人物
- 不要背景音乐

负面约束：
{character negative prompts}
{location negativePrompt}
```

## 9. Novel Video Service

新增：

```txt
apps/server/src/modules/novel-video/service.ts
```

服务方法：

```ts
export class NovelVideoService {
  async createProject(input: { title?: string; storyText: string }): Promise<ProjectDetail>;

  async analyzeProject(projectId: number): Promise<ProjectDetail>;

  async generateCharacters(projectId: number): Promise<ProjectDetail>;

  async generateLocations(projectId: number): Promise<ProjectDetail>;

  async generateStoryboard(projectId: number): Promise<ProjectDetail>;

  async checkContinuity(projectId: number): Promise<{ issues: ContinuityIssue[] }>;

  async rebuildShotPrompts(projectId: number): Promise<ProjectDetail>;

  async updateCharacter(characterId: number, patch: Partial<CharacterProfile> & { locked?: boolean }): Promise<CharacterDTO>;

  async updateLocation(locationId: number, patch: Partial<SceneProfile> & { locked?: boolean }): Promise<LocationDTO>;

  async updateShot(shotId: number, patch: Partial<ShotDraft>): Promise<ShotDTO>;

  async generateShotVideo(shotId: number, options?: { resolution?: string; duration?: number }): Promise<ShotDTO>;

  async getProject(projectId: number): Promise<ProjectDetail | null>;

  async listProjects(): Promise<ProjectSummary[]>;
}
```

`generateShotVideo` 逻辑：

1. 读取 shot、角色、场景。
2. 如果 `videoPrompt` 为空，调用 `buildShotVideoPrompt` 并保存。
3. 如果角色有参考图，优先使用 `happyhorse-1.0-r2v`，把角色参考图转 data URI 放到 `input.media`。
4. 如果没有参考图，使用 `happyhorse-1.0-t2v`。
5. 创建 `generation_records` 记录，复用现有视频 poller。
6. 更新 `story_shots.videoTaskId` 和 `status = generating`。
7. `getProject` 读取生成记录并回填 `story_shots.videoUrl/status/errorMessage`。

MVP 注意：

- 不要直接删除旧 `Explore` 能力，可以改造成新流程。
- 单镜头生成失败要只影响当前 shot。
- 已锁定角色/场景仍允许用户手动编辑，但 AI 重新生成时不能覆盖 locked 数据。

## 10. API 路由

新增：

```txt
apps/server/src/modules/novel-video/index.ts
```

挂载到：

```txt
/api/novel-video
```

并在 `apps/server/src/index.ts` 中 `.use(novelVideoRoute)`。

路由：

```txt
GET    /api/novel-video/projects
POST   /api/novel-video/projects
GET    /api/novel-video/projects/:id
POST   /api/novel-video/projects/:id/analyze
POST   /api/novel-video/projects/:id/characters/generate
POST   /api/novel-video/projects/:id/locations/generate
POST   /api/novel-video/projects/:id/storyboard/generate
POST   /api/novel-video/projects/:id/continuity/check
POST   /api/novel-video/projects/:id/prompts/rebuild
PATCH  /api/novel-video/characters/:id
PATCH  /api/novel-video/locations/:id
PATCH  /api/novel-video/shots/:id
POST   /api/novel-video/shots/:id/generate
POST   /api/novel-video/characters/:id/upload-reference
```

请求体示例：

```ts
POST /projects
{
  "title": "第一集",
  "storyText": "..."
}
```

```ts
POST /shots/:id/generate
{
  "resolution": "720P",
  "duration": 5
}
```

响应统一返回 DTO，不直接返回数据库 JSON 字符串。

## 11. 前端 API

修改：

```txt
apps/web/src/lib/api.ts
```

新增：

```ts
novelVideo: {
  listProjects()
  createProject(data)
  getProject(id)
  analyzeProject(id)
  generateCharacters(id)
  generateLocations(id)
  generateStoryboard(id)
  checkContinuity(id)
  rebuildPrompts(id)
  updateCharacter(id, patch)
  updateLocation(id, patch)
  updateShot(id, patch)
  generateShot(id, options)
  uploadCharacterReference(id, file)
}
```

## 12. 前端页面 MVP

优先改造：

```txt
apps/web/src/pages/Explore.tsx
```

可以拆组件：

```txt
apps/web/src/components/novel-video/
  ProjectSidebar.tsx
  StoryInputStep.tsx
  CharacterLibrary.tsx
  LocationLibrary.tsx
  ShotList.tsx
  ContinuityPanel.tsx
  ShotVideoPreview.tsx
```

页面布局建议：

```txt
顶部：项目标题、状态、刷新按钮
左侧：历史项目列表
主区：步骤 Tabs
  1. 故事
  2. 角色
  3. 场景
  4. 分镜
  5. 连续性
  6. 生成
```

### 12.1 故事步骤

功能：

- 输入故事。
- 创建项目。
- 点击“解析剧情”。
- 显示 summary、mainConflict、timeline、角色名、场景名。

### 12.2 角色库步骤

功能：

- 点击“生成角色库”。
- 每个角色显示：名称、身份、外貌摘要、identityPrompt、negativePrompt。
- 支持编辑。
- 支持 locked switch。
- 支持上传参考图。

### 12.3 场景库步骤

功能：

- 点击“生成场景库”。
- 每个场景显示：地点、时代、氛围、色彩、灯光、建筑、scenePrompt。
- 支持编辑。
- 支持 locked switch。

### 12.4 分镜步骤

功能：

- 点击“生成分镜”。
- 每个 shot 显示：镜头编号、时长、场景、角色、动作开始/结束、情绪开始/结束、人物朝向、摄影机。
- 支持编辑。
- 支持重建 prompt。
- 显示生成后的 `videoPrompt`。

### 12.5 连续性步骤

功能：

- 点击“检查连续性”。
- 显示 issues。
- issue 按 `error/warning` 区分。
- 点击 issue 能定位到 shot。

MVP 可以不做 AI 自动修正，先把检查和手动修正做好。

### 12.6 生成步骤

功能：

- 按镜头列表显示生成状态。
- 每个镜头独立生成。
- 支持失败重试。
- 支持播放视频。
- 每 3 秒轮询项目详情。

## 13. 与现有 poller 的衔接

当前 `bailianService.pollVideoTasks()` 会轮询 `generation_records` 并下载视频。

MVP 可以复用它，但要让 `NovelVideoService.getProject()` 做回填：

- 如果 shot 有 `videoTaskId`。
- 查询 `generation_records.taskId = shot.videoTaskId`。
- 如果 record succeeded，解析 `outputResult.results[0].video_url`，写入 `story_shots.videoUrl`，状态设为 `completed`。
- 如果 record failed，写入 `errorMessage`，状态设为 `failed`。
- 如果 record pending/processing，状态设为 `generating`。

## 14. 错误处理

后端错误要求：

- 百炼错误必须经 `parseDashScopeError`。
- JSON 解析失败必须说明是哪一步失败。
- 创建角色/场景/分镜时，如果 AI 返回空数组，要抛出用户可读错误。
- 单 shot 生成失败不能影响其他 shot。

前端错误要求：

- 每个步骤显示独立错误。
- 生成失败显示在对应 shot 卡片。
- 不要只 `console.error`。

## 15. 测试和验证

必须执行：

```bash
bun run build
```

建议执行：

```bash
bun run --cwd apps/web lint
```

手动验证：

1. 打开前端。
2. 进入“探索”。
3. 创建一个短故事项目。
4. 解析剧情。
5. 生成角色库。
6. 生成场景库。
7. 生成分镜。
8. 检查连续性。
9. 编辑一个 shot 后保存。
10. 生成一个 shot 视频。
11. 轮询后看到视频结果或明确错误。
12. 计费页面仍能显示生成记录消费。

## 16. 实施顺序

严格按下面顺序做：

1. 添加 shared 类型。
2. 扩展 Drizzle schema 并生成迁移。
3. 添加 JSON 解析工具和 BailianClient。
4. 添加 prompts。
5. 添加 continuity validator。
6. 添加 prompt-builder。
7. 添加 NovelVideoService 的读写 DTO 和 create/get/list。
8. 实现 analyzeProject。
9. 实现 generateCharacters。
10. 实现 generateLocations。
11. 实现 generateStoryboard。
12. 实现 checkContinuity。
13. 实现 rebuildShotPrompts。
14. 实现 generateShotVideo。
15. 添加 novel-video API route。
16. 扩展前端 api。
17. 重构 Explore 页面为步骤流。
18. 跑 build，修类型错误。
19. 手动验证主流程。

## 17. 验收标准

代码层面：

- `bun run build` 通过。
- 新增类型没有 `any` 泛滥，AI 返回解析边界可以使用 `unknown` 后校验。
- 数据库迁移文件存在。
- API 返回 DTO，不暴露 JSON 字符串。
- 不破坏 `/api/bailian/*` 现有接口。

产品层面：

- 用户能从故事生成角色库、场景库、分镜。
- 用户能看到连续性问题。
- 用户能生成至少一个分镜视频。
- 生成 prompt 明显包含角色一致性和场景一致性。
- 已锁定角色/场景不会被 AI 重新生成覆盖。

