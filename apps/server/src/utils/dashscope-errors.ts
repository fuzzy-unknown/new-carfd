const DASHSCOPE_ERROR_MESSAGES: Record<string, string> = {
  // ==== 认证/授权错误 ====
  Arrearage: "账号欠费，请前往阿里云控制台充值后重试",
  InvalidApiKey: "API Key 无效，请在 .env 中检查 DASHSCOPE_API_KEY 配置",
  invalid_api_key: "API Key 无效，请在 .env 中检查 DASHSCOPE_API_KEY 配置",
  "AccessDenied": "无权限访问该模型，可能需在百炼控制台申请模型权限",
  "Model.AccessDenied": "无权限调用该模型，请检查模型是否已开通",
  "App.AccessDenied": "应用访问被拒绝，请检查应用 ID 和 API Key",
  "Workspace.AccessDenied": "工作空间无权限，请使用主账号 API Key",

  // ==== 模型错误 ====
  ModelNotFound: "模型不存在或已下线，请检查模型名称",
  model_not_found: "模型不存在或已下线，请检查模型名称",
  model_not_supported: "该模型不支持当前调用方式",

  // ==== 限流错误 ====
  Throttling: "请求过于频繁，请稍后重试",
  "Throttling.RateQuota": "请求频率超限（RPS），请稍后重试",
  "Throttling.BurstRate": "请求频率增长过快，请平滑增加请求",
  "Throttling.AllocationQuota": "Token 消耗超限（TPM），请稍后重试",
  limit_requests: "请求频率超限，请稍后重试",
  limit_burst_rate: "请求增长过快，请放缓请求速度",
  insufficient_quota: "配额不足，请稍后重试",

  // ==== 内容审核 ====
  DataInspectionFailed: "输入或输出内容不合规，请修改后重试",
  data_inspection_failed: "输入或输出内容不合规，请修改后重试",
  "DataInspectionFailed.Input": "输入内容可能包含敏感信息，请修改后重试",
  "DataInspectionFailed.Output": "生成内容不合规，请调整提示词后重试",

  // ==== 参数错误 ====
  InvalidParameter: "请求参数有误，请检查输入参数",
  "InvalidParameter.DataInspection": "媒体资源下载失败，请检查 URL 是否可访问",
  "BadRequestException": "请求格式错误，请检查请求参数",
  "BadRequest.EmptyInput": "缺少必要参数 input",
  "BadRequest.EmptyParameters": "缺少必要参数 parameters",
  "BadRequest.EmptyModel": "缺少必要参数 model",

  // ==== 通用 400 ====
  InvalidURL: "提供的 URL 无效或无法访问",
  "InvalidURL.Timeout": "下载资源超时，请检查网络连接",
  "InvalidURL.ConnectionRefused": "资源服务器拒绝连接，请检查 URL",

  // ==== 服务端错误 ====
  InternalError: "百炼服务内部错误，请稍后重试",
  internal_error: "百炼服务内部错误，请稍后重试",
  "InternalError.Timeout": "异步任务超时（超过 3 小时），请重试",
  "InternalError.Algo": "模型推理异常，请稍后重试",
  "InternalError.FileUpload": "文件上传失败，请检查存储配置",
  RequestTimeOut: "请求超时，请检查网络或简化输入内容后重试",
  ResponseTimeout: "服务响应超时，请稍后重试",
  ModelUnavailable: "模型暂时不可用，请稍后重试",
  "500": "服务内部错误，请稍后重试",
  "503": "服务暂时不可用，请稍后重试",

  // ==== 文件错误 ====
  "InvalidFile.Size": "文件大小不符合要求",
  "InvalidFile.Format": "文件格式不支持",
  "InvalidFile.Duration": "文件时长不符合要求",
  "InvalidFile.Resolution": "文件分辨率不符合要求",
  "InvalidImage.ImageSize": "图片大小超出限制",
  "InvalidImageResolution": "图片分辨率不符合要求",
  "InvalidImageFormat": "图片格式不支持",

  // ==== 音频错误 ====
  "Audio.AudioShortError": "音频有效时长过短",
  "Audio.AudioSilentError": "音频文件为静音或有效语音过短",
  "Audio.DecoderError": "音频解码失败，文件可能损坏",
  "Audio.DurationLimitError": "音频时长超出限制",
};

export function getDashScopeErrorMessage(code: string, fallback: string): string {
  return DASHSCOPE_ERROR_MESSAGES[code] || fallback;
}

export function parseDashScopeError(response: any): string {
  // DashScope error format: { code: "...", message: "..." }
  if (response?.code) {
    return getDashScopeErrorMessage(response.code, response.message || "未知错误");
  }

  // OpenAI-compatible error format: { error: { code: "...", message: "..." } }
  if (response?.error?.code) {
    return getDashScopeErrorMessage(response.error.code, response.error.message || "未知错误");
  }

  // OpenAI-compatible simple format: { error: { message: "..." } }
  if (response?.error?.message) {
    return response.error.message;
  }

  // DashScope task error format: { output: { task_status: "FAILED", message: "..." } }
  if (response?.output?.message) {
    return getDashScopeErrorMessage(
      response.output.task_status || "",
      response.output.message
    );
  }

  return "未知错误";
}
