import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Loader2, Image as ImageIcon, Video, FolderOpen, Layers, X, Download, ExternalLink, Filter } from "lucide-react";
import { cn } from "../lib/utils";

interface AssetItem {
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

interface AssetStats {
  totalImages: number;
  totalVideos: number;
  workspaceImages: number;
  workspaceVideos: number;
  novelVideos: number;
  novelCharacterImages: number;
}

type FilterType = "all" | "image" | "video";
type FilterSource = "all" | "workspace" | "novel";

export function Assets() {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [stats, setStats] = useState<AssetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterSource, setFilterSource] = useState<FilterSource>("all");
  const [previewAsset, setPreviewAsset] = useState<AssetItem | null>(null);

  const loadAssets = useCallback(async () => {
    try {
      setLoading(true);
      const params: { type?: string; source?: string } = {};
      if (filterType !== "all") params.type = filterType;
      if (filterSource !== "all") params.source = filterSource;
      const data = await api.assets.getAssets(params);
      setAssets(data);
    } catch (error) {
      console.error("Failed to load assets:", error);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterSource]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    api.assets.getStats().then(setStats).catch(console.error);
  }, []);

  // 全屏预览 ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewAsset(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const resolveUrl = (url: string) => {
    if (url.startsWith("/api/")) return url;
    if (url.startsWith("/")) return `/api${url}`;
    return url;
  };

  const getSourceLabel = (source: string) =>
    source === "workspace" ? "工作台" : "小说探索";

  const getSourceColor = (source: string) =>
    source === "workspace"
      ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
      : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";

  const FILTER_TABS: { key: FilterType; label: string; icon: typeof Layers }[] = [
    { key: "all", label: "全部", icon: Layers },
    { key: "image", label: "图片", icon: ImageIcon },
    { key: "video", label: "视频", icon: Video },
  ];

  const SOURCE_TABS: { key: FilterSource; label: string }[] = [
    { key: "all", label: "全部来源" },
    { key: "workspace", label: "工作台" },
    { key: "novel", label: "小说探索" },
  ];

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5">
          <FolderOpen className="w-6 h-6 text-amber-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">资产库</h1>
          <p className="text-muted-foreground mt-1">
            查看工作台和小说探索中生成的所有图片与视频
          </p>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setFilterType("all"); setFilterSource("all"); }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">总资产</p>
                  <p className="text-2xl font-bold">{stats.totalImages + stats.totalVideos}</p>
                </div>
                <Layers className="w-8 h-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-purple-500/50 transition-colors" onClick={() => setFilterType("image")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">图片</p>
                  <p className="text-2xl font-bold">{stats.totalImages}</p>
                </div>
                <ImageIcon className="w-8 h-8 text-purple-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-pink-500/50 transition-colors" onClick={() => setFilterType("video")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">视频</p>
                  <p className="text-2xl font-bold">{stats.totalVideos}</p>
                </div>
                <Video className="w-8 h-8 text-pink-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-blue-500/50 transition-colors" onClick={() => setFilterSource("workspace")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">工作台生成</p>
                  <p className="text-2xl font-bold">{stats.workspaceImages + stats.workspaceVideos}</p>
                </div>
                <FolderOpen className="w-8 h-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 筛选器 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 text-sm">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground mr-1">类型:</span>
          {FILTER_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilterType(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filterType === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-border" />
        <div className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground mr-1">来源:</span>
          {SOURCE_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterSource(key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filterSource === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 资产网格 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FolderOpen className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">暂无资产</p>
          <p className="text-sm mt-1">前往工作台或小说探索生成内容</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {assets.map((asset) => (
            <Card
              key={asset.id}
              className="group cursor-pointer overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all"
              onClick={() => setPreviewAsset(asset)}
            >
              <div className="relative aspect-video bg-muted overflow-hidden">
                {asset.type === "image" ? (
                  <img
                    src={resolveUrl(asset.thumbnailUrl || asset.url)}
                    alt={asset.title || "图片资产"}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="relative w-full h-full">
                    {/* 视频缩略图 - 尝试加载视频第一帧 */}
                    <video
                      src={resolveUrl(asset.url)}
                      className="w-full h-full object-cover"
                      preload="metadata"
                      muted
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 text-gray-800 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {/* 来源标签 */}
                <div className="absolute top-2 left-2">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", getSourceColor(asset.source))}>
                    {getSourceLabel(asset.source)}
                  </span>
                </div>

                {/* 类型角标 */}
                <div className="absolute top-2 right-2">
                  {asset.type === "video" ? (
                    <Video className="w-4 h-4 text-white drop-shadow-md" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-white drop-shadow-md" />
                  )}
                </div>
              </div>

              <CardContent className="p-3">
                <p className="text-xs font-medium truncate" title={asset.title}>
                  {asset.title || "未命名资产"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDate(asset.createdAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 全屏预览弹窗 */}
      {previewAsset && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewAsset(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] flex flex-col bg-background rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部信息 */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-lg truncate">{previewAsset.title || "资产预览"}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border", getSourceColor(previewAsset.source))}>
                    {getSourceLabel(previewAsset.source)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {previewAsset.type === "image" ? "图片" : "视频"}
                  </span>
                  {previewAsset.model && (
                    <span className="text-xs text-muted-foreground">
                      · {previewAsset.model}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    · {formatDate(previewAsset.createdAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <a
                  href={resolveUrl(previewAsset.url)}
                  download
                  className="p-2 rounded-md hover:bg-muted transition-colors"
                  title="下载"
                >
                  <Download className="w-4 h-4" />
                </a>
                <a
                  href={resolveUrl(previewAsset.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-md hover:bg-muted transition-colors"
                  title="新窗口打开"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setPreviewAsset(null)}
                  className="p-2 rounded-md hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 预览内容 */}
            <div className="flex-1 flex items-center justify-center p-6 bg-black/5 overflow-auto">
              {previewAsset.type === "image" ? (
                <img
                  src={resolveUrl(previewAsset.url)}
                  alt={previewAsset.title || "预览"}
                  className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
                />
              ) : (
                <video
                  src={resolveUrl(previewAsset.url)}
                  controls
                  autoPlay
                  className="max-w-full max-h-[60vh] rounded-lg shadow-lg"
                />
              )}
            </div>

            {/* Prompt 信息 */}
            {previewAsset.prompt && (
              <div className="px-6 py-3 border-t bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1 font-medium">提示词</p>
                <p className="text-sm text-foreground/80 line-clamp-3">{previewAsset.prompt}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
