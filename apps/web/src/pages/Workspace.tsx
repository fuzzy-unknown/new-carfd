import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";
import { Loader2, Sparkles, Image as ImageIcon, Video, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";

interface Model {
  id: string;
  name: string;
  category: string;
  type: string;
  description: string;
  pricing: {
    inputPrice: number;
    outputPrice?: number;
    inputPrice1080?: number;
    unit: string;
    note?: string;
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
  { id: 'text', name: '文本生成', icon: FileText, color: 'bg-blue-500/10 text-blue-500' },
  { id: 'image', name: '图像生成', icon: ImageIcon, color: 'bg-purple-500/10 text-purple-500' },
  { id: 'video', name: '视频生成', icon: Video, color: 'bg-pink-500/10 text-pink-500' },
] as const;

export function Workspace() {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('video');
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTask, setCurrentTask] = useState<{ taskId: string; status: string } | null>(null);

  useEffect(() => {
    api.bailian.getModels().then(data => {
      setModels(data);
      const categoryModels = data.filter(m => m.category === selectedCategory);
      if (categoryModels.length > 0 && !selectedModel) {
        setSelectedModel(categoryModels[0]);
        initParameters(categoryModels[0]);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    loadRecords();
    const interval = setInterval(loadRecords, 5000);
    return () => clearInterval(interval);
  }, []);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <Badge variant="success" className="gap-1"><CheckCircle2 className="w-3 h-3" />成功</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />失败</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" />处理中</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />等待中</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI 创作工作台</h1>
          <p className="text-muted-foreground mt-1">使用百炼 AI 模型生成内容</p>
        </div>
      </div>

      {/* 模型类别选择 */}
      <div className="flex flex-wrap gap-2">
        {MODEL_CATEGORIES.map(cat => {
          const Icon = cat.icon;
          return (
            <Button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="lg"
              className="gap-2"
            >
              <Icon className="w-4 h-4" />
              {cat.name}
            </Button>
          );
        })}
      </div>

      {selectedModel && (
        <>
          {/* 模型选择和价格信息 */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>选择模型</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedModel.id} onValueChange={handleModelChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredModels.map(model => {
                      const priceLabel = model.category === 'text'
                        ? `${formatPrice(model.pricing.inputPrice)}/万Token`
                        : model.category === 'image'
                        ? `${formatPrice(model.pricing.inputPrice)}/张`
                        : model.category === 'video'
                        ? `¥${model.pricing.inputPrice}/秒`
                        : `${formatPrice(model.pricing.inputPrice)}/${model.pricing.unit}`;
                      return (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name} - {priceLabel}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">{selectedModel.description}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>价格信息</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {selectedModel.category === 'video' ? (
                    <>
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-muted-foreground">720P 价格</span>
                        <span className="font-semibold">{formatPrice(selectedModel.pricing.inputPrice)}/秒</span>
                      </div>
                      {selectedModel.pricing.inputPrice1080 && (
                        <div className="flex items-center justify-between py-2 border-b">
                          <span className="text-muted-foreground">1080P 价格</span>
                          <span className="font-semibold">{formatPrice(selectedModel.pricing.inputPrice1080)}/秒</span>
                        </div>
                      )}
                      {selectedModel.pricing.note && (
                        <div className="py-2 text-sm text-muted-foreground text-center">
                          {selectedModel.pricing.note}
                        </div>
                      )}
                    </>
                  ) : selectedModel.category === 'image' ? (
                    <>
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-muted-foreground">单张价格</span>
                        <span className="font-semibold">{formatPrice(selectedModel.pricing.inputPrice)}/张</span>
                      </div>
                      {selectedModel.pricing.note && (
                        <div className="py-2 text-sm text-muted-foreground text-center">
                          {selectedModel.pricing.note}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-muted-foreground">输入价格</span>
                        <span className="font-semibold">{formatPrice(selectedModel.pricing.inputPrice)}/万Token</span>
                      </div>
                      {selectedModel.pricing.outputPrice && (
                        <div className="flex items-center justify-between py-2 border-b">
                          <span className="text-muted-foreground">输出价格</span>
                          <span className="font-semibold">{formatPrice(selectedModel.pricing.outputPrice)}/万Token</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between py-2">
                        <span className="text-muted-foreground">计费单位</span>
                        <span className="font-semibold">{selectedModel.pricing.unit}</span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 参数控制和生成记录 */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 参数控制 */}
            <Card>
              <CardHeader>
                <CardTitle>参数设置</CardTitle>
                <CardDescription>配置模型生成参数</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {selectedModel.parameters.map(param => (
                  <div key={param.name} className="space-y-2">
                    <Label htmlFor={param.name}>
                      {param.description || param.name}
                      {param.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {param.type === 'text' && (
                      <Textarea
                        id={param.name}
                        value={parameters[param.name] || ''}
                        onChange={(e) => handleParameterChange(param.name, e.target.value)}
                        placeholder={param.description}
                        rows={4}
                      />
                    )}
                    {param.type === 'number' && (
                      <div className="flex items-center gap-3">
                    <input
                      type="number"
                      id={param.name}
                      value={parameters[param.name] || ''}
                      onChange={(e) => handleParameterChange(param.name, Number(e.target.value))}
                      min={param.min}
                      max={param.max}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:outline-none"
                    />
                    {param.min !== undefined && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        最小: {param.min}
                      </span>
                    )}
                    {param.max !== undefined && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        最大: {param.max}
                      </span>
                    )}
                  </div>
                )}
                    {param.type === 'select' && (
                      <Select
                        value={parameters[param.name] || ''}
                        onValueChange={(value) => handleParameterChange(param.name, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={param.description} />
                        </SelectTrigger>
                        <SelectContent>
                          {param.options?.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {param.type === 'boolean' && (
                      <div className="flex items-center gap-3">
                        <Switch
                          id={param.name}
                          checked={parameters[param.name] || false}
                          onCheckedChange={(checked) => handleParameterChange(param.name, checked)}
                        />
                        <Label htmlFor={param.name} className="cursor-pointer">
                          {param.description}
                        </Label>
                      </div>
                    )}
                  </div>
                ))}
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  size="lg"
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      开始生成
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* 生成记录 */}
            <Card>
              <CardHeader>
                <CardTitle>生成记录</CardTitle>
                <CardDescription>查看历史生成记录和花费</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {records.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Clock className="w-12 h-12 text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">暂无生成记录</p>
                    </div>
                  ) : (
                    records.map(record => (
                      <Card key={record.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium truncate">
                                {models.find(m => m.id === record.model)?.name || record.model}
                              </span>
                              {getStatusBadge(record.status)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(record.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {record.cost && (
                          <div className="mt-3 flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="font-normal">
                              花费: ¥{record.cost.totalPrice.toFixed(4)}
                            </Badge>
                            {record.cost.inputTokens && (
                              <span className="text-muted-foreground text-xs">
                                输入: {record.cost.inputTokens} Token
                              </span>
                            )}
                            {record.cost.outputTokens && (
                              <span className="text-muted-foreground text-xs">
                                输出: {record.cost.outputTokens} Token
                              </span>
                            )}
                          </div>
                        )}
                        {record.errorMessage && (
                          <p className="text-sm text-destructive mt-2">{record.errorMessage}</p>
                        )}
                        {record.outputResult?.text && (
                          <p className="text-sm mt-3 line-clamp-3 text-muted-foreground">{record.outputResult.text}</p>
                        )}
                        {record.outputResult?.images && (
                          <div className="flex gap-2 mt-3">
                            {record.outputResult.images.map((img: any, i: number) => (
                              <img key={i} src={img.image} alt="" className="w-20 h-20 object-cover rounded" />
                            ))}
                          </div>
                        )}
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
