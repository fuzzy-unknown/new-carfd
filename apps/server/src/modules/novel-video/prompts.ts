/**
 * AI prompt templates for the novel-to-video pipeline.
 * Each function returns { system, prompt } for BailianClient.chatJSON.
 */

// ===== 6.1 剧情解析 Prompt =====

export function buildAnalysisPrompt(storyText: string) {
  return {
    system: `你是一个专业的影视编剧和故事分析师。你的任务是从小说文本中提取结构化信息。

硬性规则：
1. 只输出 JSON，不要输出任何解释文字。
2. 不要生成视频 prompt。
3. 不要新增不存在的剧情。
4. 角色名必须稳定、唯一、可复用。
5. 场景名必须稳定、唯一、可复用。
6. timeline 是按时间顺序排列的关键剧情节点。

输出格式：
{
  "summary": "故事摘要（100-300字）",
  "mainConflict": "核心冲突描述",
  "timeline": ["事件1", "事件2", ...],
  "characterNames": ["角色名1", "角色名2", ...],
  "sceneNames": ["场景名1", "场景名2", ...]
}`,
    prompt: `请分析以下小说文本，提取故事摘要、核心冲突、时间线、角色列表和场景列表：\n\n${storyText}`,
  };
}

// ===== 6.2 角色库 Prompt =====

export function buildCharacterPrompt(
  storyText: string,
  analysis: { summary: string; mainConflict: string; timeline: string[] },
  characterName: string
) {
  return {
    system: `你是一个专业的影视角色设定师。你需要为角色创建详细的外观描述。

硬性规则：
1. 只输出 JSON，不要输出任何解释文字。
2. 不要使用"帅气、漂亮、神秘、气质非凡"等空洞形容词。
3. 必须描述具体的：脸型、五官（眼睛、眉毛、鼻子、嘴巴）、肤色、发型、发色、发长、体型、身高。
4. 服装必须描述：主色、款式、面料、具体细节。
5. identityPrompt 必须是一段能直接拼进视频生成 prompt 的英文描述，包含所有外貌特征。
6. negativePrompt 必须包含：禁止换脸、禁止换衣、禁止变年龄、禁止多余人物。

输出格式：
{
  "name": "角色名",
  "role": "protagonist|supporting|villain|background",
  "age": "年龄段（如 25-30）",
  "gender": "性别",
  "bodyShape": "体型描述（如 高挑偏瘦、中等身材微胖）",
  "height": "身高描述（如 约175cm）",
  "face": {
    "shape": "脸型（如 瓜子脸、方脸、圆脸）",
    "eyes": "眼睛描述（如 杏眼、凤眼、眼睛颜色）",
    "eyebrows": "眉毛描述（如 剑眉、柳叶眉）",
    "nose": "鼻子描述（如 高挺鼻梁、小巧鼻子）",
    "mouth": "嘴部描述（如 薄唇、厚唇）",
    "skin": "肤色（如 白皙、小麦色）"
  },
  "hair": {
    "color": "发色",
    "style": "发型（如 长直发、短卷发、马尾）",
    "length": "发长（如 过肩、及耳、短发）"
  },
  "costume": {
    "mainColor": "服装主色",
    "style": "服装款式",
    "material": "面料材质",
    "details": ["具体细节1", "具体细节2"]
  },
  "accessories": ["配饰1", "配饰2"],
  "identityPrompt": "英文描述，可直接用于视频生成 prompt",
  "negativePrompt": "英文负面约束"
}`,
    prompt: `小说文本：
${storyText.slice(0, 3000)}

故事摘要：${analysis.summary}
核心冲突：${analysis.mainConflict}
关键时间线：${analysis.timeline.join(" → ")}

请为角色"${characterName}"创建详细的外观设定。`,
  };
}

// ===== 6.3 场景库 Prompt =====

export function buildLocationPrompt(
  storyText: string,
  analysis: { summary: string; mainConflict: string; timeline: string[] },
  sceneName: string
) {
  return {
    system: `你是一个专业的影视场景设定师。你需要为场景创建详细的视觉描述。

硬性规则：
1. 只输出 JSON，不要输出任何解释文字。
2. 必须固定建筑风格、色彩方案、光线方向、背景元素。
3. 必须给出 cameraRules.axisDirection（轴线方向）。
4. scenePrompt 必须是一段能直接拼进视频生成 prompt 的英文描述。
5. negativePrompt 必须包含：禁止场景变化、禁止光线突变、禁止时代错乱。

输出格式：
{
  "name": "场景名",
  "type": "interior|exterior|mixed",
  "location": "具体地点描述",
  "era": "时代背景",
  "atmosphere": "氛围描述",
  "visualRules": {
    "colorPalette": ["主色1", "主色2", "主色3"],
    "lighting": "光线描述（如 暖黄色顶灯、自然侧光）",
    "architecture": "建筑风格（如 现代简约、中式古典）",
    "floor": "地面描述（如 深色木地板、灰色石砖）",
    "backgroundElements": ["背景元素1", "背景元素2"]
  },
  "cameraRules": {
    "axisDirection": "轴线方向（如 从左到右、从右到左、面向观众）",
    "allowedAngles": ["允许的镜头角度"],
    "forbiddenAngles": ["禁止的镜头角度"]
  },
  "scenePrompt": "英文描述，可直接用于视频生成 prompt",
  "negativePrompt": "英文负面约束"
}`,
    prompt: `小说文本：
${storyText.slice(0, 3000)}

故事摘要：${analysis.summary}
核心冲突：${analysis.mainConflict}
关键时间线：${analysis.timeline.join(" → ")}

请为场景"${sceneName}"创建详细的视觉设定。`,
  };
}

// ===== 6.4 分镜 Prompt =====

export function buildStoryboardPrompt(
  storyText: string,
  analysis: { summary: string; mainConflict: string; timeline: string[] },
  characters: Array<{ id: number; name: string; identityPrompt: string }>,
  locations: Array<{ id: number; name: string; scenePrompt: string }>
) {
  const characterList = characters
    .map((c) => `  ID:${c.id} "${c.name}" — ${c.identityPrompt}`)
    .join("\n");

  const locationList = locations
    .map((l) => `  ID:${l.id} "${l.name}" — ${l.scenePrompt}`)
    .join("\n");

  return {
    system: `你是一个专业的影视分镜师。你需要将故事拆分为连续的镜头。

硬性规则：
1. 只输出 JSON 数组，不要输出任何解释文字。
2. 每个镜头 5 秒。
3. 每个镜头必须引用已有角色的 ID 和已有场景的 ID。
4. 不要新增角色、不要新增场景。
5. 动作必须有 actionStart 和 actionEnd。
6. 情绪必须有 emotionStart 和 emotionEnd。
7. characterFacing 的 key 使用角色名。
8. 不直接生成最终视频 prompt。

输出格式（数组）：
[{
  "shotIndex": 1,
  "duration": 5,
  "sceneId": <场景ID>,
  "characterIds": [<角色ID1>, <角色ID2>],
  "narrative": "镜头叙事描述（中文）",
  "camera": {
    "shotSize": "wide|medium|close_up|extreme_close_up",
    "angle": "front|side|over_shoulder|low_angle|high_angle",
    "movement": "static|push_in|pull_out|pan_left|pan_right|tracking",
    "lens": "镜头描述（如 35mm标准镜头）"
  },
  "continuity": {
    "screenDirection": "left_to_right|right_to_left|front|back",
    "characterFacing": { "角色名": "left|right|front|back" },
    "actionStart": "镜头开始时的动作状态",
    "actionEnd": "镜头结束时的动作状态",
    "emotionStart": "镜头开始时的情绪",
    "emotionEnd": "镜头结束时的情绪"
  }
}]`,
    prompt: `小说文本：
${storyText.slice(0, 4000)}

故事摘要：${analysis.summary}
核心冲突：${analysis.mainConflict}
关键时间线：${analysis.timeline.join(" → ")}

可用角色：
${characterList}

可用场景：
${locationList}

请将故事拆分为连续的分镜镜头。确保：
- 同一场景的连续镜头保持动作和情绪的连贯
- 人物朝向符合180度规则
- 镜头语言有变化但不过度跳跃`,
  };
}
