import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";
import { Loader2, Sparkles, Image as ImageIcon, Video, FileText, CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { PromptEditor } from "../components/PromptEditor";
import { ReferenceUploadZone, type ReferenceMedia } from "../components/ReferenceUploadZone";

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
  const [error, setError] = useState<string | null>(null);
  const [regeneratingIds, setRegeneratingIds] = useState<Set<number>>(new Set());
  const [referenceMedia, setReferenceMedia] = useState<ReferenceMedia[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'video' | null>(null);
  const recordsRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(false);

  const isReferenceModel = selectedModel?.id === 'happyhorse-1.0-r2v' || selectedModel?.id === 'wan2.7-r2v';

  // Auto-scroll to bottom when a new generation is triggered
  useEffect(() => {
    if (!shouldAutoScrollRef.current || !recordsRef.current) return;

    const el = recordsRef.current;
    const doScroll = () => { el.scrollTop = el.scrollHeight; };

    // Immediate scroll
    doScroll();
    // Re-scroll on next frame (catches layout shifts from media loading)
    const rafId = requestAnimationFrame(() => doScroll());
    // Final scroll after media has had time to load, then clear flag
    const timeoutId = setTimeout(() => {
      doScroll();
      shouldAutoScrollRef.current = false;
    }, 500);

    return () => { cancelAnimationFrame(rafId); clearTimeout(timeoutId); };
  }, [records]);

  useEffect(() => {
    api.bailian.getModels().then((data: Model[]) => {
      setModels(data);
      const categoryModels = data.filter(m => m.category === selectedCategory);
      if (categoryModels.length > 0 && !selectedModel) {
        setSelectedModel(categoryModels[0]);
        initParameters(categoryModels[0]);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    shouldAutoScrollRef.current = true;
    loadRecords();
    const interval = setInterval(loadRecords, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadRecords = async () => {
    try {
      const data = await api.bailian.getRecords();
      setRecords(data);
    } catch (error) {
      console.error('Failed to load records:', error);
    }
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setReferenceMedia([]);
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
      setReferenceMedia([]);
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
    if (!selectedModel) return;

    setError(null);
    shouldAutoScrollRef.current = true;
    try {
      await api.bailian.generate({
        model: selectedModel.id,
        parameters: {
          ...parameters,
          ...(isReferenceModel && referenceMedia.length > 0 && {
            ref_media: referenceMedia.map(ref => ({
              type: ref.type === 'video' ? 'reference_video' : 'reference_image',
              url: ref.url,
            })),
          }),
        },
      });
      await loadRecords();
    } catch (err: any) {
      console.error('Generation failed:', err);
      setError(err.message || '生成失败，请重试');
    }
  };

  const handleRegenerate = async (record: GenerationRecord) => {
    setRegeneratingIds(prev => new Set(prev).add(record.id));
    setError(null);
    shouldAutoScrollRef.current = true;
    try {
      await api.bailian.generate({
        model: record.model,
        parameters: record.inputParams,
      });
      await loadRecords();
    } catch (err: any) {
      console.error('Regeneration failed:', err);
      setError(err.message || '重新生成失败，请重试');
    } finally {
      setRegeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
    }
  };

  const getCategoryInfo = (category: string) => {
    switch (category) {
      case 'text':
        return { label: '文生文本', icon: FileText, color: 'text-blue-500' };
      case 'image':
        return { label: '文生图', icon: ImageIcon, color: 'text-purple-500' };
      case 'video':
        return { label: '文生视频', icon: Video, color: 'text-pink-500' };
      default:
        return { label: category, icon: FileText, color: 'text-muted-foreground' };
    }
  };

  const getParamSummary = (record: GenerationRecord): string => {
    const params = record.inputParams;
    const parts: string[] = [];
    if (params.size) parts.push(params.size);
    if (params.resolution) parts.push(params.resolution);
    if (params.ratio) parts.push(params.ratio);
    if (params.duration) parts.push(`${params.duration}秒`);
    if (params.n) parts.push(`${params.n}张`);
    if (params.negative_prompt) parts.push('含反向提示词');
    return parts.join(' | ');
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
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 左列 */}
            <div className="space-y-6">
              {/* 选择模型（含价格信息） */}
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
                  {/* 价格信息 */}
                  <div className="border-t pt-3 space-y-2">
                    {selectedModel.category === 'video' ? (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">720P 价格</span>
                          <span className="font-medium">{formatPrice(selectedModel.pricing.inputPrice)}/秒</span>
                        </div>
                        {selectedModel.pricing.inputPrice1080 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">1080P 价格</span>
                            <span className="font-medium">{formatPrice(selectedModel.pricing.inputPrice1080)}/秒</span>
                          </div>
                        )}
                      </>
                    ) : selectedModel.category === 'image' ? (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">价格</span>
                        <span className="font-medium">{formatPrice(selectedModel.pricing.inputPrice)}/张</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">输入价格</span>
                          <span className="font-medium">{formatPrice(selectedModel.pricing.inputPrice)}/万Token</span>
                        </div>
                        {selectedModel.pricing.outputPrice && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">输出价格</span>
                            <span className="font-medium">{formatPrice(selectedModel.pricing.outputPrice)}/万Token</span>
                          </div>
                        )}
                      </>
                    )}
                    {selectedModel.pricing.note && (
                      <p className="text-xs text-muted-foreground text-center pt-1">{selectedModel.pricing.note}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 参数设置 */}
              <Card>
                <CardHeader>
                  <CardTitle>参数设置</CardTitle>
                  <CardDescription>配置模型生成参数</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {isReferenceModel && (
                    <ReferenceUploadZone
                      modelId={selectedModel.id}
                      references={referenceMedia}
                      onAdd={(ref) => setReferenceMedia(prev => [...prev, ref])}
                      onRemove={(id) => setReferenceMedia(prev => prev.filter(r => r.id !== id))}
                    />
                  )}
                  {selectedModel.parameters.map(param => (
                    <div key={param.name} className="space-y-2">
                      <Label htmlFor={param.name}>
                        {param.description || param.name}
                        {param.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      {param.type === 'text' && param.name === 'prompt' && isReferenceModel ? (
                        <PromptEditor
                          references={referenceMedia}
                          modelId={selectedModel.id}
                          value={parameters[param.name] || ''}
                          onChange={(val) => handleParameterChange(param.name, val)}
                          placeholder={param.description}
                        />
                      ) : param.type === 'text' && (
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
                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                      <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                  <Button
                    onClick={handleGenerate}
                    size="lg"
                    className="w-full"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    开始生成
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* 右列 - 生成记录 */}
            <Card>
              <CardHeader>
                <CardTitle>生成记录</CardTitle>
                <CardDescription>查看历史生成记录和花费</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 overflow-y-auto pr-2 max-h-[calc(100vh-320px)]" ref={recordsRef}>
                  {records.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Clock className="w-12 h-12 text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">暂无生成记录</p>
                    </div>
                  ) : (
                    records.map(record => {
                      const CatIcon = getCategoryInfo(record.category).icon;
                      return (
                      <Card key={record.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {models.find(m => m.id === record.model)?.name || record.model}
                              </span>
                              {getStatusBadge(record.status)}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <CatIcon className="w-3.5 h-3.5" />
                              <span>{getCategoryInfo(record.category).label}</span>
                              <span>·</span>
                              <span>{new Date(record.createdAt).toLocaleString()}</span>
                            </div>
                            {record.inputParams?.prompt && (
                              <p className="text-sm mt-1.5 line-clamp-2 text-foreground/80 bg-muted/50 rounded px-2 py-1">
                                {record.inputParams.prompt}
                              </p>
                            )}
                            {(() => {
                              const summary = getParamSummary(record);
                              return summary ? (
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {summary.split(' | ').map((part, i) => (
                                    <Badge key={i} variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                                      {part}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null;
                            })()}
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
                          <div className="flex items-start gap-2 mt-2">
                            <p className="text-sm text-destructive flex-1">{record.errorMessage}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRegenerate(record)}
                              disabled={regeneratingIds.has(record.id)}
                              className="shrink-0 gap-1.5"
                            >
                              {regeneratingIds.has(record.id) ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                              )}
                              重新生成
                            </Button>
                          </div>
                        )}
                        {record.outputResult?.text && (
                          <p className="text-sm mt-3 line-clamp-3 text-muted-foreground">{record.outputResult.text}</p>
                        )}
                        {record.outputResult?.images && (
                          <div className="flex gap-2 mt-3">
                            {record.outputResult.images.map((img: any, i: number) => (
                              <img
                                key={i}
                                src={img.image}
                                alt=""
                                className="w-20 h-20 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => { setPreviewUrl(img.image); setPreviewType('image'); }}
                                onLoad={() => {
                                  if (shouldAutoScrollRef.current && recordsRef.current) {
                                    recordsRef.current.scrollTop = recordsRef.current.scrollHeight;
                                  }
                                }}
                              />
                            ))}
                          </div>
                        )}
                        {record.outputResult?.results?.[0]?.video_url && (
                          <video
                            src={record.outputResult.results[0].video_url}
                            controls
                            className="w-full max-w-xs mt-3 rounded cursor-pointer"
                            onClick={() => { setPreviewUrl(record.outputResult.results[0].video_url); setPreviewType('video'); }}
                            onLoadedMetadata={() => {
                              if (shouldAutoScrollRef.current && recordsRef.current) {
                                recordsRef.current.scrollTop = recordsRef.current.scrollHeight;
                              }
                            }}
                          />
                        )}
                      </Card>
                    )
                  })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Fullscreen preview overlay — no close button, no keyboard nav, click mask to close */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => { setPreviewUrl(null); setPreviewType(null); }}
        >
          {previewType === 'image' ? (
            <img
              src={previewUrl}
              alt=""
              className="max-w-[90vw] max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <video
              src={previewUrl}
              controls
              autoPlay
              className="max-w-[90vw] max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
}
