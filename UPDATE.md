````md
# AI 短剧连续性生成系统方案

技术栈：

- Bun
- TypeScript
- React / Vite
- 百炼 API
- bun：sqlite 均可
- Redis 可选

目标：

解决 AI 视频生成中常见的断裂问题：

- 人物不一致
- 服装不一致
- 朝向不一致
- 场景不一致
- 镜头运动不一致
- 动作衔接不一致
- 多段视频像独立片段拼接

核心思路：

不要直接从小说生成视频，而是增加“连续性引擎”。

整体链路：

小说文本
 ↓
剧情解析
 ↓
角色库生成
 ↓
场景库生成
 ↓
分镜生成
 ↓
镜头规划
 ↓
连续性检查
 ↓
Prompt 生成
 ↓
图片 / 视频生成
 ↓
视频拼接

---

## 1. 系统模块设计

推荐后端目录结构：

```txt
apps/
  web/
    src/
      pages/
      components/
      services/

  api/
    src/
      index.ts
      routes/
      services/
      modules/
      utils/

packages/
  shared/
    src/
      types/
      constants/

  ai/
    src/
      bailian.ts
      prompt.ts

  continuity/
    src/
      character.ts
      scene.ts
      shot.ts
      timeline.ts
      validator.ts
````

---

## 2. 后端核心模块

```txt
modules/
  novel/
    novel.service.ts
    novel.controller.ts

  character/
    character.service.ts
    character.schema.ts

  scene/
    scene.service.ts
    scene.schema.ts

  storyboard/
    storyboard.service.ts
    storyboard.schema.ts

  shot/
    shot.service.ts
    shot.schema.ts

  continuity/
    continuity.service.ts
    continuity.validator.ts

  generation/
    prompt-generator.service.ts
    video-generator.service.ts
    image-generator.service.ts

  project/
    project.service.ts
```

---

## 3. 数据结构设计

### Project

```ts
export interface Project {
  id: string
  title: string
  type: 'novel_to_video' | 'script_to_video'
  status: 'draft' | 'generating' | 'completed' | 'failed'
  createdAt: string
  updatedAt: string
}
```

---

### Novel

```ts
export interface Novel {
  id: string
  projectId: string
  title: string
  content: string
  summary?: string
  createdAt: string
}
```

---

### Character

角色必须固定，不能每个镜头重新描述。

```ts
export interface Character {
  id: string
  projectId: string
  name: string
  role: 'protagonist' | 'supporting' | 'villain' | 'background'

  age: string
  gender: string
  bodyShape: string
  height: string

  face: {
    shape: string
    eyes: string
    eyebrows: string
    nose: string
    mouth: string
    skin: string
  }

  hair: {
    color: string
    style: string
    length: string
  }

  costume: {
    mainColor: string
    style: string
    material: string
    details: string[]
  }

  accessories: string[]

  identityPrompt: string
  negativePrompt: string

  referenceImages?: {
    front?: string
    side?: string
    back?: string
    portrait?: string
  }
}
```

---

### Scene

```ts
export interface Scene {
  id: string
  projectId: string
  name: string
  type: 'interior' | 'exterior'

  location: string
  era: string
  atmosphere: string

  visualRules: {
    colorPalette: string[]
    lighting: string
    architecture: string
    floor: string
    backgroundElements: string[]
  }

  cameraRules: {
    axisDirection: string
    allowedAngles: string[]
    forbiddenAngles: string[]
  }

  scenePrompt: string
  negativePrompt: string
}
```

---

### Storyboard

```ts
export interface Storyboard {
  id: string
  projectId: string
  episodeIndex: number
  title: string
  summary: string
  shots: Shot[]
}
```

---

### Shot

这是最关键的数据结构。

```ts
export interface Shot {
  id: string
  projectId: string
  storyboardId: string

  shotIndex: number
  duration: number

  sceneId: string
  characterIds: string[]

  narrative: string

  camera: {
    shotSize: 'wide' | 'medium' | 'close_up' | 'extreme_close_up'
    angle: 'front' | 'side' | 'over_shoulder' | 'low_angle' | 'high_angle'
    movement: 'static' | 'push_in' | 'pull_out' | 'pan_left' | 'pan_right' | 'tracking'
    lens: string
  }

  continuity: {
    screenDirection: 'left_to_right' | 'right_to_left' | 'front' | 'back'
    characterFacing: Record<string, 'left' | 'right' | 'front' | 'back'>
    actionStart: string
    actionEnd: string
    emotionStart: string
    emotionEnd: string
    previousShotId?: string
    nextShotId?: string
  }

  prompt: {
    imagePrompt?: string
    videoPrompt?: string
    negativePrompt?: string
  }

  assets?: {
    startFrame?: string
    endFrame?: string
    videoUrl?: string
  }
}
```

---

## 4. 核心生成流程

不要直接：

```txt
小说 → 视频
```

而是：

```txt
小说
 ↓
提取角色
 ↓
生成角色卡
 ↓
提取场景
 ↓
生成场景卡
 ↓
拆分剧情
 ↓
生成分镜
 ↓
连续性修正
 ↓
生成图片首帧
 ↓
生成视频
 ↓
拼接
```

---

## 5. Step 1：剧情解析

输入：

```ts
{
  projectId: string
  novelContent: string
}
```

输出：

```ts
{
  summary: string
  mainConflict: string
  timeline: string[]
  characters: string[]
  scenes: string[]
}
```

Prompt：

```txt
你是一个短剧编剧和分镜导演。

请分析下面的小说内容，输出结构化 JSON。

要求：
1. 提取主要人物
2. 提取主要场景
3. 提取剧情时间线
4. 不要生成视频 prompt
5. 不要发挥不存在的剧情
6. 输出严格 JSON

小说内容：
{{novelContent}}

输出格式：
{
  "summary": "",
  "mainConflict": "",
  "characters": [],
  "scenes": [],
  "timeline": []
}
```

---

## 6. Step 2：角色库生成

每个角色都必须生成固定设定。

Prompt：

```txt
你是影视角色设定师。

请根据小说内容，为角色生成稳定的视觉设定。

重要规则：
1. 每个角色必须有固定脸型、发型、服装、配饰
2. 后续所有镜头都必须保持一致
3. 不要使用模糊词，例如“帅气”“漂亮”
4. 必须使用可视觉化描述
5. 输出严格 JSON

角色名称：
{{characterName}}

小说上下文：
{{novelSummary}}

输出格式：
{
  "name": "",
  "age": "",
  "gender": "",
  "bodyShape": "",
  "height": "",
  "face": {
    "shape": "",
    "eyes": "",
    "eyebrows": "",
    "nose": "",
    "mouth": "",
    "skin": ""
  },
  "hair": {
    "color": "",
    "style": "",
    "length": ""
  },
  "costume": {
    "mainColor": "",
    "style": "",
    "material": "",
    "details": []
  },
  "accessories": [],
  "identityPrompt": "",
  "negativePrompt": ""
}
```

角色 identityPrompt 示例：

```txt
同一个角色，28岁男性，修长挺拔身形，冷白皮肤，长脸轮廓，剑眉，细长深黑眼睛，高鼻梁，薄唇，黑色长发束起，佩戴青玉冠，穿墨绿色古代朝服，宽袖，暗金云纹刺绣，白色内衬，腰间黑色革带，始终保持同一张脸、同一发型、同一服装、同一配饰
```

角色 negativePrompt 示例：

```txt
不同人物，换脸，发型变化，衣服变化，颜色变化，年龄变化，现代服装，错误配饰，模糊五官，脸部变形，多余人物
```

---

## 7. Step 3：角色参考图生成

每个主要角色先生成：

* 正面
* 侧面
* 背面
* 半身肖像
* 角色卡

Prompt 模板：

```txt
生成专业影视角色设计参考图。

角色设定：
{{character.identityPrompt}}

画面要求：
- 白色或浅灰纯色背景
- 角色三视图：正面、侧面、背面
- 同一个角色
- 同一张脸
- 同一套服装
- 同一发型
- 同一配饰
- 全身站姿
- 手臂自然下垂
- 适合后续 AI 视频生成作为角色参考
- 高清，干净，细节清楚

禁止：
{{character.negativePrompt}}
```

保存为：

```ts
character.referenceImages.front
character.referenceImages.side
character.referenceImages.back
character.referenceImages.portrait
```

---

## 8. Step 4：场景库生成

Prompt：

```txt
你是影视美术指导。

请根据小说内容，为场景生成稳定的视觉设定。

重要规则：
1. 每个场景必须固定建筑、光线、色彩、空间结构
2. 后续所有镜头都必须保持一致
3. 不要使用模糊词
4. 输出严格 JSON

场景名称：
{{sceneName}}

小说上下文：
{{novelSummary}}

输出格式：
{
  "name": "",
  "type": "",
  "location": "",
  "era": "",
  "atmosphere": "",
  "visualRules": {
    "colorPalette": [],
    "lighting": "",
    "architecture": "",
    "floor": "",
    "backgroundElements": []
  },
  "cameraRules": {
    "axisDirection": "",
    "allowedAngles": [],
    "forbiddenAngles": []
  },
  "scenePrompt": "",
  "negativePrompt": ""
}
```

场景 scenePrompt 示例：

```txt
古代皇宫朝堂，宽阔对称空间，深红色蟠龙柱，黑色金纹石砖地面，远处金色龙椅，晨光从高窗斜射进入，空气中有轻微尘埃，整体色彩为墨绿、暗金、深红、黑石色，庄严压抑，建筑结构始终保持一致
```

---

## 9. Step 5：分镜生成

分镜不是直接生成 prompt，而是先生成结构化镜头。

Prompt：

```txt
你是短剧导演。

请根据剧情，将内容拆分为连续镜头。

重要规则：
1. 每个镜头 3-5 秒
2. 镜头之间动作必须连续
3. 人物朝向不能乱变
4. 同一场景必须保持空间关系
5. 不要跨越 180 度轴线
6. 输出严格 JSON
7. 不要直接生成视频 prompt

剧情：
{{plotSegment}}

角色库：
{{characters}}

场景库：
{{scenes}}

输出格式：
[
  {
    "shotIndex": 1,
    "duration": 4,
    "sceneId": "",
    "characterIds": [],
    "narrative": "",
    "camera": {
      "shotSize": "",
      "angle": "",
      "movement": "",
      "lens": ""
    },
    "continuity": {
      "screenDirection": "",
      "characterFacing": {},
      "actionStart": "",
      "actionEnd": "",
      "emotionStart": "",
      "emotionEnd": ""
    }
  }
]
```

---

## 10. Step 6：连续性引擎

连续性引擎负责检查分镜是否断裂。

检查内容：

```txt
1. 同一角色是否保持相同服装
2. 同一角色是否保持相同发型
3. 同一角色是否保持相同朝向
4. 上一镜头 actionEnd 是否等于下一镜头 actionStart
5. 上一镜头 emotionEnd 是否等于下一镜头 emotionStart
6. 同一场景是否跨轴
7. 镜头运动是否突兀
8. 光线是否突然变化
9. 人物位置是否突然跳跃
```

TypeScript 示例：

```ts
export function validateShotContinuity(shots: Shot[]) {
  const issues: string[] = []

  for (let i = 1; i < shots.length; i++) {
    const prev = shots[i - 1]
    const curr = shots[i]

    if (prev.sceneId === curr.sceneId) {
      for (const characterId of curr.characterIds) {
        const prevFacing = prev.continuity.characterFacing[characterId]
        const currFacing = curr.continuity.characterFacing[characterId]

        if (prevFacing && currFacing && prevFacing !== currFacing) {
          issues.push(
            `镜头 ${curr.shotIndex}: 角色 ${characterId} 朝向从 ${prevFacing} 变为 ${currFacing}`
          )
        }
      }

      if (prev.continuity.actionEnd !== curr.continuity.actionStart) {
        issues.push(
          `镜头 ${curr.shotIndex}: 动作不连续，上一镜头结束为「${prev.continuity.actionEnd}」，当前镜头开始为「${curr.continuity.actionStart}」`
        )
      }

      if (prev.continuity.emotionEnd !== curr.continuity.emotionStart) {
        issues.push(
          `镜头 ${curr.shotIndex}: 情绪不连续，上一镜头结束为「${prev.continuity.emotionEnd}」，当前镜头开始为「${curr.continuity.emotionStart}」`
        )
      }
    }
  }

  return issues
}
```

---

## 11. Step 7：连续性修正 Prompt

如果发现问题，不要直接生成视频，先让模型修分镜。

```txt
你是影视连续性 감독。

下面的分镜存在连续性问题，请你修正。

修正要求：
1. 不改变剧情
2. 不新增角色
3. 不新增场景
4. 保持人物朝向统一
5. 保持动作首尾衔接
6. 保持情绪递进
7. 避免跨越 180 度轴线
8. 输出修正后的完整 JSON

原始分镜：
{{shots}}

连续性问题：
{{issues}}

角色库：
{{characters}}

场景库：
{{scenes}}
```

---

## 12. Step 8：Prompt 生成器

最终视频 prompt 由系统拼接，而不是让 AI 随便写。

结构：

```txt
[角色固定描述]
[场景固定描述]
[镜头描述]
[动作连续性]
[摄影机描述]
[风格描述]
[负面约束]
```

TypeScript：

```ts
export function buildVideoPrompt(
  shot: Shot,
  characters: Character[],
  scene: Scene
) {
  const characterPrompts = shot.characterIds
    .map(id => characters.find(c => c.id === id)?.identityPrompt)
    .filter(Boolean)
    .join('\n')

  const negativePrompts = shot.characterIds
    .map(id => characters.find(c => c.id === id)?.negativePrompt)
    .filter(Boolean)
    .join(', ')

  return `
角色一致性：
${characterPrompts}

场景一致性：
${scene.scenePrompt}

当前镜头：
${shot.narrative}

动作连续性：
镜头开始：${shot.continuity.actionStart}
镜头结束：${shot.continuity.actionEnd}

情绪连续性：
开始情绪：${shot.continuity.emotionStart}
结束情绪：${shot.continuity.emotionEnd}

人物朝向：
${JSON.stringify(shot.continuity.characterFacing)}

摄影机：
${shot.camera.shotSize}，${shot.camera.angle}，${shot.camera.movement}，${shot.camera.lens}

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

负面约束：
${negativePrompts}
${scene.negativePrompt}
`
}
```

---

## 13. Step 9：首帧 / 尾帧机制

不要直接生成视频。

推荐流程：

```txt
镜头 1 首帧
镜头 1 尾帧

镜头 2 首帧 = 镜头 1 尾帧
镜头 2 尾帧

镜头 3 首帧 = 镜头 2 尾帧
镜头 3 尾帧
```

这样视频会更连贯。

Shot 增加：

```ts
assets: {
  startFrame?: string
  endFrame?: string
  videoUrl?: string
}
```

生成规则：

```txt
第一个镜头：
使用角色参考图 + 场景参考图生成首帧

后续镜头：
使用上一镜头尾帧作为当前镜头首帧
```

---

## 14. Step 10：视频生成策略

推荐分两种模式。

### 快速模式

适合成本低：

```txt
角色设定 + 场景设定 + 镜头 prompt → 文生视频
```

缺点：

一致性一般。

---

### 高质量模式

适合短剧成片：

```txt
角色参考图
 ↓
场景参考图
 ↓
镜头首帧
 ↓
图生视频
 ↓
尾帧保存
 ↓
下一镜头继续
```

优点：

一致性明显更好。

---

## 15. 百炼 API 封装

建议统一封装：

```ts
export class BailianClient {
  constructor(private apiKey: string) {}

  async chatJSON<T>(prompt: string): Promise<T> {
    // 调用百炼大模型
    // 要求模型返回 JSON
    throw new Error('not implemented')
  }

  async generateImage(prompt: string, options?: any) {
    // 调用图片生成模型
    throw new Error('not implemented')
  }

  async generateVideo(prompt: string, options?: any) {
    // 调用视频生成模型
    throw new Error('not implemented')
  }

  async generateVideoFromImage(imageUrl: string, prompt: string, options?: any) {
    // 调用图生视频模型
    throw new Error('not implemented')
  }
}
```

---

## 16. OpenAI 兼容调用示例

```ts
export async function bailianChatJSON<T>(prompt: string): Promise<T> {
  const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.BAILIAN_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen-plus',
      messages: [
        {
          role: 'system',
          content: '你是一个严谨的 JSON 生成器，只输出合法 JSON，不输出 markdown。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3
    })
  })

  if (!res.ok) {
    throw new Error(`Bailian API error: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  const content = data.choices[0].message.content

  return JSON.parse(content) as T
}
```

---

## 17. 生成任务状态

```ts
export type GenerationStatus =
  | 'pending'
  | 'analyzing_novel'
  | 'creating_characters'
  | 'creating_scenes'
  | 'creating_storyboard'
  | 'checking_continuity'
  | 'generating_prompts'
  | 'generating_frames'
  | 'generating_videos'
  | 'stitching'
  | 'completed'
  | 'failed'
```

---

## 18. 数据库表建议

### projects

```sql
CREATE TABLE projects (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(64) NOT NULL,
  status VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### novels

```sql
CREATE TABLE novels (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  title VARCHAR(255),
  content TEXT NOT NULL,
  summary TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### characters

```sql
CREATE TABLE characters (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(64),
  data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### scenes

```sql
CREATE TABLE scenes (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### shots

```sql
CREATE TABLE shots (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  storyboard_id VARCHAR(64),
  shot_index INT NOT NULL,
  scene_id VARCHAR(64),
  data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### generation_jobs

```sql
CREATE TABLE generation_jobs (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  status VARCHAR(64) NOT NULL,
  progress INT DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 19. API 路由设计

```txt
POST /api/projects
创建项目

POST /api/projects/:id/novel
提交小说

POST /api/projects/:id/analyze
解析小说

POST /api/projects/:id/characters
生成角色库

POST /api/projects/:id/scenes
生成场景库

POST /api/projects/:id/storyboard
生成分镜

POST /api/projects/:id/continuity/check
检查连续性

POST /api/projects/:id/continuity/fix
修正连续性

POST /api/projects/:id/prompts
生成镜头 prompt

POST /api/projects/:id/generate
开始生成视频

GET /api/projects/:id
获取项目详情

GET /api/projects/:id/shots
获取分镜列表
```

---

## 20. 推荐 Bun + Elysia API 示例

```ts
import { Elysia } from 'elysia'

const app = new Elysia()

app.post('/api/projects/:id/analyze', async ({ params, body }) => {
  const { id } = params

  // 1. 获取小说
  // 2. 调用剧情解析
  // 3. 保存 summary / timeline
  // 4. 返回结果

  return {
    projectId: id,
    status: 'analyzed'
  }
})

app.post('/api/projects/:id/continuity/check', async ({ params }) => {
  const { id } = params

  // 1. 获取 shots
  // 2. validateShotContinuity
  // 3. 返回问题

  return {
    projectId: id,
    issues: []
  }
})

app.listen(3000)
```

---

## 21. 前端页面建议

需要四个核心页面：

```txt
1. 项目创建页
2. 小说输入页
3. 角色 / 场景确认页
4. 分镜编辑页
5. 视频生成页
```

---

## 22. 分镜编辑页必须支持

```txt
- 查看每个镜头
- 修改镜头时长
- 修改人物朝向
- 修改动作开始
- 修改动作结束
- 修改情绪开始
- 修改情绪结束
- 重新检查连续性
- 重新生成当前镜头
- 锁定角色
- 锁定场景
```

---

## 23. 角色锁定机制

每个角色提供一个开关：

```ts
locked: boolean
```

如果 locked 为 true：

后续 prompt 禁止修改：

```txt
- 脸
- 发型
- 年龄
- 服装
- 配饰
- 身材
```

---

## 24. 场景锁定机制

每个场景提供一个开关：

```ts
locked: boolean
```

如果 locked 为 true：

后续 prompt 禁止修改：

```txt
- 建筑结构
- 光线方向
- 色彩
- 主要道具
- 空间关系
```

---

## 25. 镜头连续性规则

建议内置这些规则：

```ts
export const continuityRules = {
  sameCharacterMustKeepIdentity: true,
  sameSceneMustKeepLighting: true,
  sameSceneMustKeepAxis: true,
  nextShotStartActionShouldMatchPrevShotEndAction: true,
  nextShotStartEmotionShouldMatchPrevShotEndEmotion: true,
  avoidSuddenCameraDirectionChange: true,
  avoidSuddenCostumeChange: true,
  avoidSuddenTimeChange: true
}
```

---

## 26. 生成 Prompt 示例

```txt
角色一致性：
同一个角色，28岁男性，修长挺拔身形，冷白皮肤，长脸轮廓，剑眉，细长深黑眼睛，高鼻梁，薄唇，黑色长发束起，佩戴青玉冠，穿墨绿色古代朝服，宽袖，暗金云纹刺绣，白色内衬，腰间黑色革带。

场景一致性：
古代皇宫朝堂，宽阔对称空间，深红色蟠龙柱，黑色金纹石砖地面，远处金色龙椅，晨光从高窗斜射进入。

当前镜头：
男主站在朝堂中央，缓慢抬头看向皇帝，眼神从克制变为坚定。

动作连续性：
镜头开始：男主低头站立，双手垂在袖中。
镜头结束：男主完全抬头，目光直视前方。

人物朝向：
男主始终面向画面右侧。

摄影机：
中近景，轻微推进，50mm 镜头，稳定机位。

重要要求：
保持同一个人物，同一张脸，同一发型，同一服装，同一玉冠，同一场景结构，不要改变朝向，不要新增人物，不要跨轴。

负面约束：
换脸，换衣服，换发型，现代服装，不同年龄，五官变化，场景变化，光线突变，多余人物，镜头跳跃。
```

---

## 27. Claude 执行任务拆分

可以让 Claude 按下面顺序开发：

### 第一阶段：基础类型与目录

```txt
1. 创建 monorepo 目录
2. 创建 shared types
3. 创建 Project / Novel / Character / Scene / Shot 类型
4. 创建 continuity validator
```

---

### 第二阶段：百炼 API 封装

```txt
1. 创建 BailianClient
2. 实现 chatJSON
3. 实现 JSON 自动修复
4. 实现错误重试
5. 实现日志记录
```

---

### 第三阶段：AI 结构化生成

```txt
1. 实现 novel analyze
2. 实现 character generate
3. 实现 scene generate
4. 实现 storyboard generate
5. 实现 continuity fix
```

---

### 第四阶段：Prompt 生成器

```txt
1. 实现 buildImagePrompt
2. 实现 buildVideoPrompt
3. 实现 buildNegativePrompt
4. 实现 buildShotPrompt
```

---

### 第五阶段：接口

```txt
1. POST /projects
2. POST /projects/:id/novel
3. POST /projects/:id/analyze
4. POST /projects/:id/characters
5. POST /projects/:id/scenes
6. POST /projects/:id/storyboard
7. POST /projects/:id/continuity/check
8. POST /projects/:id/continuity/fix
9. POST /projects/:id/prompts
```

---

### 第六阶段：前端

```txt
1. 小说输入页面
2. 角色确认页面
3. 场景确认页面
4. 分镜编辑页面
5. 连续性问题提示
6. 视频生成页面
```

---

## 28. 最小可行版本 MVP

不要一开始做完整系统。

MVP 只需要：

```txt
1. 输入小说
2. 生成角色库
3. 生成场景库
4. 生成分镜
5. 检查连续性
6. 生成每个镜头 prompt
```

先不生成视频。

先把 prompt 稳定下来。

因为只要 prompt 不稳定，视频一定不稳定。

---

## 29. MVP 成功标准

```txt
同一个角色在 10 个镜头中：
- 姓名一致
- 年龄一致
- 发型一致
- 服装一致
- 配饰一致
- 朝向一致

同一个场景在 10 个镜头中：
- 建筑一致
- 光线一致
- 色彩一致
- 空间关系一致

连续镜头中：
- 上一镜头结束动作 = 下一镜头开始动作
- 上一镜头结束情绪 = 下一镜头开始情绪
```

---

## 30. 最重要的一句话

不要把视频生成当成“一次 prompt 生成一个片段”。

要把它当成：

```txt
连续镜头资产生产系统
```

你的系统真正的核心不是“视频生成”，而是：

```txt
角色库 + 场景库 + 分镜库 + 连续性引擎
```

视频模型只是最后的渲染器。

```
```
