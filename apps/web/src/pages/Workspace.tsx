import { useState, useEffect } from "react";
import { api } from "../lib/api";

interface Model {
  id: string;
  name: string;
  category: string;
  type: string;
  description: string;
  pricing: {
    inputPrice: number;
    outputPrice?: number;
    unit: string;
  };
  parameters: Array<{
    name: string;
    type: string;
    description?: string;
    required?: boolean;
    defaultValue?: any;
    options?: { label: string; value: any }[];
    min?: number;
    max?: number;
  }>;
}

interface GenerationRecord {
  id: number;
  taskId: string;
  model: string;
  category: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  inputParams: Record<string, any>;
  outputResult: any;
  cost: {
    inputTokens?: number;
    outputTokens?: number;
    totalPrice: number;
  } | null;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
}

const MODEL_CATEGORIES = [
  { id: 'text', name: '文本生成', icon: '📝' },
  { id: 'image', name: '图像生成', icon: '🖼️' },
  { id: 'video', name: '视频生成', icon: '🎬' },
] as const;

export function Workspace() {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('text');
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTask, setCurrentTask] = useState<{ taskId: string; status: string } | null>(null);

  // 加载模型列表
  useEffect(() => {
    api.bailian.getModels().then(setModels).catch(console.error);
  }, []);

  // 加载生成记录
  useEffect(() => {
    loadRecords();
    const interval = setInterval(loadRecords, 5000); // 每5秒刷新记录
    return () => clearInterval(interval);
  }, []);

  // 轮询当前任务状态
  useEffect(() => {
    if (currentTask && (currentTask.status === 'pending' || currentTask.status === 'processing')) {
      const interval = setInterval(() => {
        loadRecords();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [currentTask]);

  const loadRecords = async () => {
    try {
      const data = await api.bailian.getRecords();
      setRecords(data);
      // 更新当前任务状态
      if (currentTask) {
        const updated = data.find(r => r.taskId === currentTask.taskId);
        if (updated) {
          setCurrentTask({ taskId: updated.taskId, status: updated.status });
          if (updated.status === 'succeeded' || updated.status === 'failed') {
            setIsGenerating(false);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load records:', error);
    }
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    const categoryModels = models.filter(m => m.category === category);
    if (categoryModels.length > 0) {
      setSelectedModel(categoryModels[0]);
      initParameters(categoryModels[0]);
    }
  };

  const handleModelChange = (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    if (model) {
      setSelectedModel(model);
      initParameters(model);
    }
  };

  const initParameters = (model: Model) => {
    const params: Record<string, any> = {};
    model.parameters.forEach(param => {
      if (param.defaultValue !== undefined) {
        params[param.name] = param.defaultValue;
      } else if (param.type === 'boolean') {
        params[param.name] = false;
      } else if (param.type === 'number') {
        params[param.name] = param.min || 0;
      } else {
        params[param.name] = '';
      }
    });
    setParameters(params);
  };

  const handleParameterChange = (paramName: string, value: any) => {
    setParameters(prev => ({ ...prev, [paramName]: value }));
  };

  const handleGenerate = async () => {
    if (!selectedModel || isGenerating) return;

    setIsGenerating(true);
    try {
      const result = await api.bailian.generate({
        model: selectedModel.id,
        parameters,
      });
      setCurrentTask({ taskId: result.taskId, status: result.status });
      await loadRecords();
    } catch (error: any) {
      console.error('Generation failed:', error);
      alert(`生成失败: ${error.message || '未知错误'}`);
      setIsGenerating(false);
    }
  };

  const filteredModels = models.filter(m => m.category === selectedCategory);
  const formatPrice = (price: number) => `¥${price.toFixed(4)}`;

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI 创作工作台</h1>
        <p className="text-muted-foreground mt-1">使用百炼 AI 模型生成内容</p>
      </div>

      {/* 模型类别和选择器 */}
      <div className="space-y-4">
        <div className="flex gap-2">
          {MODEL_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {selectedModel && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* 模型选择 */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">选择模型</h3>
              <select
                value={selectedModel.id}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full px-3 py-2 rounded-md border bg-background"
              >
                {filteredModels.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {formatPrice(model.pricing.inputPrice)}/{model.pricing.unit === 'token' ? '万Token' : '次'}
                  </option>
                ))}
              </select>
              <p className="text-sm text-muted-foreground mt-2">{selectedModel.description}</p>
            </div>

            {/* 价格信息 */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">价格信息</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">输入价格</span>
                  <span className="font-medium">{formatPrice(selectedModel.pricing.inputPrice)}/万Token</span>
                </div>
                {selectedModel.pricing.outputPrice && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">输出价格</span>
                    <span className="font-medium">{formatPrice(selectedModel.pricing.outputPrice)}/万Token</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">计费单位</span>
                  <span className="font-medium">{selectedModel.pricing.unit}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 参数控制和生成记录 */}
      {selectedModel && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左侧：参数控制 */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">参数设置</h3>
            <div className="space-y-4">
              {selectedModel.parameters.map(param => (
                <div key={param.name}>
                  <label className="block text-sm font-medium mb-2">
                    {param.description || param.name}
                    {param.required && <span className="text-destructive ml-1">*</span>}
                  </label>
                  {param.type === 'text' && (
                    <textarea
                      value={parameters[param.name] || ''}
                      onChange={(e) => handleParameterChange(param.name, e.target.value)}
                      placeholder={param.description}
                      rows={4}
                      className="w-full px-3 py-2 rounded-md border bg-background resize-none"
                    />
                  )}
                  {param.type === 'number' && (
                    <input
                      type="number"
                      value={parameters[param.name] || ''}
                      onChange={(e) => handleParameterChange(param.name, Number(e.target.value))}
                      min={param.min}
                      max={param.max}
                      className="w-full px-3 py-2 rounded-md border bg-background"
                    />
                  )}
                  {param.type === 'select' && (
                    <select
                      value={parameters[param.name] || ''}
                      onChange={(e) => handleParameterChange(param.name, e.target.value)}
                      className="w-full px-3 py-2 rounded-md border bg-background"
                    >
                      {param.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {param.type === 'boolean' && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={parameters[param.name] || false}
                        onChange={(e) => handleParameterChange(param.name, e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{param.description}</span>
                    </label>
                  )}
                </div>
              ))}
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? '生成中...' : '开始生成'}
              </button>
            </div>
          </div>

          {/* 右侧：生成记录 */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">生成记录</h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {records.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">暂无生成记录</p>
              ) : (
                records.map(record => (
                  <div key={record.id} className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium">{models.find(m => m.id === record.model)?.name || record.model}</p>
                        <p className="text-xs text-muted-foreground">{new Date(record.createdAt).toLocaleString()}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        record.status === 'succeeded' ? 'bg-green-100 text-green-700' :
                        record.status === 'failed' ? 'bg-red-100 text-red-700' :
                        record.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {record.status === 'succeeded' ? '成功' :
                         record.status === 'failed' ? '失败' :
                         record.status === 'processing' ? '处理中' : '等待中'}
                      </span>
                    </div>
                    {record.cost && (
                      <p className="text-sm text-muted-foreground">
                        花费: ¥{record.cost.totalPrice.toFixed(4)}
                        {record.cost.inputTokens && ` · 输入: ${record.cost.inputTokens}Token`}
                        {record.cost.outputTokens && ` · 输出: ${record.cost.outputTokens}Token`}
                      </p>
                    )}
                    {record.errorMessage && (
                      <p className="text-sm text-destructive mt-1">{record.errorMessage}</p>
                    )}
                    {record.outputResult?.text && (
                      <p className="text-sm mt-2 line-clamp-3">{record.outputResult.text}</p>
                    )}
                    {record.outputResult?.images && (
                      <div className="flex gap-2 mt-2">
                        {record.outputResult.images.map((img: any, i: number) => (
                          <img key={i} src={img.image} alt="" className="w-20 h-20 object-cover rounded" />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
