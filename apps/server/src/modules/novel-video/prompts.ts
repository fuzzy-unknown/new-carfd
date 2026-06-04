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
    system: `你是一个专业的影视角色设定师。你需要为角色创建简洁自然的外观描述。

硬性规则：
1. 只输出 JSON，不要输出任何解释文字。
2. 不要使用"帅气、漂亮、神秘、气质非凡"等空洞形容词。
3. 必须描述：脸型、五官、肤色、发型发色发长、体型、身高、服装。
4. identityPrompt 是一段简洁的英文外貌描述，只描述人物本身的静态外貌特征，用自然语言像向朋友描述一个人一样。**不要**包含任何场景、背景、灯光、天气、动作、情绪、镜头语言（如 cinematic lighting, rainy night, highly detailed, photorealistic, 8k 等统统不要写）。保持简洁，像在做一个角色的速写描述，100词以内。
5. negativePrompt 必须包含：禁止换脸、禁止换衣、禁止变年龄、禁止多余人物。

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
  "identityPrompt": "简洁的英文外貌描述，100词以内，只描述人物静态外貌，不含场景/灯光/镜头语言",
  "negativePrompt": "英文负面约束"
}`,
    prompt: `小说文本：
${storyText.slice(0, 3000)}

故事摘要：${analysis.summary}
核心冲突：${analysis.mainConflict}
关键时间线：${analysis.timeline.join(" → ")}

请为角色"${characterName}"创建外观设定。identityPrompt 必须简洁自然，只描述人物外貌，不要写任何场景背景、灯光效果或镜头语言。`,
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
    system: `你是一名拥有10年以上经验的电影导演、分镜师、摄影指导和AI视频提示词工程师。

你的任务是：将提供的小说内容拆解为适合 AI 视频模型生成的专业分镜脚本。

生成结果必须保证：
* 人物一致性
* 场景一致性
* 服装一致性
* 发型一致性
* 镜头语言专业
* 动作连续自然
* 可直接用于视频模型生成

# 核心原则

禁止：
❌ 大段文学描写
❌ 心理描写
❌ 抽象形容词（如"很伤心"、"生气"、"看着远方"）
❌ 只描述画面而不描述动作
❌ 动作跳跃
❌ 镜头跳跃
❌ timeline 中出现空泛动作（如"站立"、"坐着"）

必须：
✅ 具体动作（如"缓慢抬头看向远方"、"低头沉默，眼眶逐渐泛红"）
✅ 具体镜头
✅ 具体时间轴（每秒必须有明确事件，不能是空泛描述）
✅ 明确环境动态
✅ 明确人物状态
✅ 单个镜头只表达一个核心动作
✅ timeline 每秒必须是具体、微小、可拍摄的身体动作变化

# Timeline 高连贯性要求

timeline 是整个镜头的核心，必须遵循以下规则：

错误示例：
❌ "0s-5s: 人物站立"  // 空泛，没有具体变化

正确示例：
✅ "0s-1s: 人物站立，双眼微闭"
✅ "1s-2s: 缓慢抬头，眼睛逐渐睁开"
✅ "2s-3s: 眼神聚焦，嘴唇微张"
✅ "3s-4s: 轻微吸气，胸部起伏"
✅ "4s-5s: 保持凝视，手指轻微颤动"

每秒必须包含：
- 具体的身体部位动作（头、眼、嘴、手、身）
- 明确的动作类型（转动、移动、变化、保持）
- 微小的状态变化（即使"保持"也要说明保持的具体状态）

# 镜头规则

优先使用专业术语：
- slow dolly in（缓慢推镜头）
- slow dolly out（缓慢拉镜头）
- tracking shot（跟踪镜头）
- orbit shot（环绕镜头）
- camera pan（摇镜头）
- crane shot（升降镜头）
- over shoulder shot（过肩镜头）
- close up（特写）
- medium shot（中景）
- wide shot（全景）

避免频繁切换镜头。

# Duration 规则

每个镜头的 duration 应根据内容复杂度设定：
- 简单动作：3-5秒
- 中等复杂度：5-8秒
- 复杂动作序列：8-15秒
- 不要所有镜头都是5秒，要根据实际需要调整

# 输出格式（JSON数组）

[{
  "shotIndex": 1,
  "duration": 5,
  "sceneId": <场景ID>,
  "characterIds": [<角色ID1>, <角色ID2>],
  "narrative": "镜头叙事描述（中文，简练）",
  "camera": {
    "shotSize": "wide|medium|close_up|extreme_close_up",
    "angle": "front|side|over_shoulder|low_angle|high_angle",
    "movement": "slow dolly in|slow dolly out|tracking shot|orbit shot|camera pan|crane shot|static",
    "lens": "镜头描述（如 35mm标准镜头）"
  },
  "continuity": {
    "screenDirection": "left_to_right|right_to_left|front|back",
    "characterFacing": { "角色名": "left|right|front|back" },
    "actionStart": "镜头开始时的动作状态",
    "actionEnd": "镜头结束时的动作状态",
    "emotionStart": "镜头开始时的情绪",
    "emotionEnd": "镜头结束时的情绪"
  },
  "timeline": [
    {"time": "0s-1s", "action": "具体身体部位动作描述（如：头部微低，眼神向下）"},
    {"time": "1s-2s", "action": "具体身体部位动作描述（如：缓慢抬头5度，眼睑抬起）"},
    {"time": "2s-3s", "action": "具体身体部位动作描述（如：眼神开始聚焦，嘴唇微张）"},
    {"time": "3s-4s", "action": "具体身体部位动作描述（如：保持注视，呼吸平稳）"},
    {"time": "4s-5s", "action": "具体身体部位动作描述（如：右手指尖轻微颤动，保持姿态）"}
  ],
  ⚠️ 重要：timeline 每秒必须是具体、微小、可拍摄的身体动作变化，不能是空泛描述！
  "environment": {
    "backgroundMotion": "环境动态描述（如远处云层缓慢移动）",
    "lighting": "光线描述（如柔和的午后侧光）",
    "mood": "情绪氛围（如忧郁、沉静）",
    "style": "影视风格（如电影现实主义，4K，cinematic）"
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

请将故事拆分为连续的分镜镜头。要求：
- 同一场景的连续镜头保持动作和情绪的连贯
- 人物朝向符合180度规则
- ⚠️ timeline 每秒必须有具体、微小、可拍摄的身体动作变化，绝不能是空泛描述！
- ⚠️ duration 要根据动作复杂度调整（3-15秒），不要固定5秒
- environment 必须包含背景动态、光线、情绪、风格
- 使用专业镜头术语
- 确保 AI 视频生成时每一秒都有明确的动作指令`
  };
}
