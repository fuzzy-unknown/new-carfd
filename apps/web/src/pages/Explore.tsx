import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import {
  Sparkles, Loader2, BookOpen, Play, Clock, CheckCircle2,
  XCircle, Video, ChevronDown, Upload, RefreshCw,
  AlertTriangle, Film, MapPin, Users, Clapperboard,
  Pencil, Save, X, ImageIcon,
} from "lucide-react";

// ===== Types matching backend DTOs =====

interface ContinuityIssue {
  severity: "error" | "warning";
  shotId?: number;
  shotIndex?: number;
  code: string;
  message: string;
  suggestion?: string;
}

interface CharacterDTO {
  id: number;
  projectId: number;
  name: string;
  role: string | null;
  profile: Record<string, any> | null;
  identityPrompt: string | null;
  negativePrompt: string | null;
  locked: boolean;
  referenceImageUrl: string | null;
  turnaroundSheetUrl: string | null;
  referenceImages: string[] | null;
}

interface LocationDTO {
  id: number;
  projectId: number;
  name: string;
  type: string;
  profile: Record<string, any> | null;
  scenePrompt: string;
  negativePrompt: string | null;
  referenceImageUrl: string | null;
  locked: boolean;
}

interface ShotDTO {
  id: number;
  projectId: number;
  shotIndex: number;
  duration: number;
  locationId: number | null;
  characterIds: number[];
  narrative: string;
  camera: {
    shotSize: string;
    angle: string;
    movement: string;
    lens: string;
  };
  continuity: {
    screenDirection: string;
    characterFacing: Record<string, string>;
    actionStart: string;
    actionEnd: string;
    emotionStart: string;
    emotionEnd: string;
  };
  videoPrompt: string | null;
  negativePrompt: string | null;
  videoTaskId: string | null;
  videoUrl: string | null;
  status: string;
  errorMessage: string | null;
}

interface ProjectDetail {
  id: number;
  title: string | null;
  storyText: string;
  status: string;
  analysis: {
    summary: string;
    mainConflict: string;
    timeline: string[];
    characterNames: string[];
    sceneNames: string[];
  } | null;
  characters: CharacterDTO[];
  locations: LocationDTO[];
  shots: ShotDTO[];
  continuityIssues: ContinuityIssue[];
  createdAt: number;
  updatedAt: number;
}

interface ProjectSummary {
  id: number;
  title: string | null;
  status: string;
  createdAt: number;
  updatedAt: number;
}

// ===== Step definitions =====

const STEPS = [
  { key: "story", label: "故事", icon: BookOpen },
  { key: "characters", label: "角色", icon: Users },
  { key: "locations", label: "场景", icon: MapPin },
  { key: "storyboard", label: "分镜", icon: Clapperboard },
  { key: "continuity", label: "连续性", icon: AlertTriangle },
  { key: "generate", label: "生成", icon: Film },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

// ===== Main Component =====

export function Explore() {
  const [story, setStory] = useState("");
  const [title, setTitle] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [activeStep, setActiveStep] = useState<StepKey>("story");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pastProjects, setPastProjects] = useState<ProjectSummary[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [highlightShotIndex, setHighlightShotIndex] = useState<number | null>(null);

  // Load past projects on mount
  useEffect(() => {
    api.novelVideo.listProjects().then((res: any) => setPastProjects(res.data || [])).catch(() => {});
  }, []);

  // Keep project ID in a ref to avoid stale closures in polling
  const projectIdRef = useRef<number | null>(null);
  projectIdRef.current = project?.id ?? null;

  // Auto-poll when shots are generating
  const hasGenerating = project?.shots?.some((s) => s.status === "generating") ?? false;
  useEffect(() => {
    if (!project?.id || !hasGenerating) return;

    const interval = setInterval(async () => {
      const pid = projectIdRef.current;
      if (!pid) return;
      try {
        const res: any = await api.novelVideo.getProject(pid);
        if (res?.data) setProject(res.data);
      } catch { /* skip */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [project?.id, hasGenerating]);

  const refreshProject = useCallback(async () => {
    const pid = projectIdRef.current;
    if (!pid) return;
    try {
      const res: any = await api.novelVideo.getProject(pid);
      if (res?.data) setProject(res.data);
    } catch { /* skip */ }
  }, []);

  const runPipeline = async (fn: () => Promise<any>, step?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await fn();
      if (res?.data) setProject(res.data);
      if (step) setActiveStep(step as StepKey);
    } catch (err: any) {
      setError(err.message || "操作失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndAnalyze = () =>
    runPipeline(
      () => api.novelVideo.createProject({ title: title || undefined, storyText: story.trim(), autoGenerate }).then((res: any) => {
        const projectId = res.data.id;
        // If autoGenerate is enabled, the pipeline runs in background, so we just return the project
        if (autoGenerate) {
          // Start polling for updates immediately
          setProject(res.data);
          setActiveStep("generate");
          return res.data;
        }
        // Otherwise, analyze as usual
        return api.novelVideo.analyzeProject(projectId);
      }),
      autoGenerate ? "generate" : "characters"
    );

  const handleReAnalyze = () =>
    runPipeline(() => api.novelVideo.analyzeProject(project!.id), "story");

  const handleGenerateCharacters = () =>
    runPipeline(() => api.novelVideo.generateCharacters(project!.id), "characters");

  const handleGenerateLocations = () =>
    runPipeline(() => api.novelVideo.generateLocations(project!.id), "locations");

  const handleGenerateStoryboard = () =>
    runPipeline(() => api.novelVideo.generateStoryboard(project!.id), "storyboard");

  const handleCheckContinuity = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await api.novelVideo.checkContinuity(project!.id);
      if (res?.data?.issues) {
        // Merge issues into existing project instead of overwriting
        setProject((prev) =>
          prev ? { ...prev, continuityIssues: res.data.issues } : prev
        );
      }
      setActiveStep("continuity");
      // Also refresh project to get updated status
      await refreshProject();
    } catch (err: any) {
      setError(err.message || "连续性检查失败");
    } finally {
      setLoading(false);
    }
  };

  const handleRebuildPrompts = () =>
    runPipeline(() => api.novelVideo.rebuildPrompts(project!.id), "generate");

  const handleGenerateShot = async (shot: ShotDTO) => {
    setProject((prev) =>
      prev
        ? {
            ...prev,
            shots: prev.shots.map((s) =>
              s.id === shot.id ? { ...s, status: "generating", errorMessage: null } : s
            ),
          }
        : null
    );
    try {
      const res: any = await api.novelVideo.generateShot(shot.id, {
        resolution: "720P",
        duration: shot.duration,
      });
      if (res?.data) {
        setProject((prev) =>
          prev
            ? { ...prev, shots: prev.shots.map((s) => (s.id === shot.id ? res.data : s)) }
            : null
        );
      }
    } catch (err: any) {
      setProject((prev) =>
        prev
          ? {
              ...prev,
              shots: prev.shots.map((s) =>
                s.id === shot.id ? { ...s, status: "failed", errorMessage: err.message } : s
              ),
            }
          : null
      );
    }
  };

  const handleToggleLock = async (type: "character" | "location", id: number, currentLocked: boolean) => {
    const fn = type === "character" ? api.novelVideo.updateCharacter : api.novelVideo.updateLocation;
    await fn(id, { locked: !currentLocked });
    await refreshProject();
  };

  const handleUpdateCharacter = async (id: number, patch: Record<string, any>) => {
    await api.novelVideo.updateCharacter(id, patch);
    await refreshProject();
  };

  const handleUpdateLocation = async (id: number, patch: Record<string, any>) => {
    await api.novelVideo.updateLocation(id, patch);
    await refreshProject();
  };

  const handleUpdateShot = async (id: number, patch: Record<string, any>) => {
    await api.novelVideo.updateShot(id, patch);
    await refreshProject();
  };

  const handleUploadRef = async (characterId: number, file: File) => {
    const res: any = await api.novelVideo.uploadCharacterReference(characterId, file);
    if (res?.data) {
      setProject((prev) =>
        prev
          ? {
              ...prev,
              characters: prev.characters.map((c) =>
                c.id === characterId ? res.data : c
              ),
            }
          : null
      );
    }
  };

  const handleGenerateRef = async (characterId: number) => {
    const res: any = await api.novelVideo.generateCharacterReference(characterId);
    if (res?.data) {
      setProject((prev) =>
        prev
          ? {
              ...prev,
              characters: prev.characters.map((c) =>
                c.id === characterId ? res.data : c
              ),
            }
          : null
      );
    }
  };

  const handleGenerateLocationRef = async (locationId: number) => {
    const res: any = await api.novelVideo.generateLocationReference(locationId);
    if (res?.data) {
      setProject((prev) =>
        prev
          ? {
              ...prev,
              locations: prev.locations.map((l) =>
                l.id === locationId ? res.data : l
              ),
            }
          : null
      );
    }
  };

  const loadProject = async (id: number) => {
    setLoading(true);
    try {
      const res: any = await api.novelVideo.getProject(id);
      if (res?.data) {
        setProject(res.data);
        setStory(res.data.storyText);
        setTitle(res.data.title || "");
        const status = res.data.status as string;
        if (["generating", "completed"].includes(status)) setActiveStep("generate");
        else if (status === "continuity_checked") setActiveStep("continuity");
        else if (status === "storyboard_ready") setActiveStep("storyboard");
        else if (status === "scenes_ready") setActiveStep("locations");
        else if (status === "characters_ready") setActiveStep("characters");
        else setActiveStep("story");
      }
    } catch { /* skip */ }
    setLoading(false);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left sidebar: project list */}
      <aside className="w-64 border-r p-4 overflow-y-auto shrink-0 hidden lg:block">
        <h2 className="font-semibold text-sm mb-3 text-muted-foreground">历史项目</h2>
        <div className="space-y-2">
          {pastProjects.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                project?.id === p.id ? "bg-accent border-primary/30" : "hover:bg-accent"
              }`}
              onClick={() => loadProject(p.id)}
            >
              <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium">{p.title || `项目 #${p.id}`}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
          {pastProjects.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">暂无项目</p>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            {project && (
              <Button variant="ghost" size="icon" onClick={() => { setProject(null); setError(null); }} className="shrink-0">
                <ChevronDown className="w-5 h-5 rotate-90" />
              </Button>
            )}
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
              <BookOpen className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight">探索</h1>
              <p className="text-muted-foreground mt-1">
                小说转视频连续性工作流 — 角色库 + 场景库 + 分镜 + 连续性检查
              </p>
            </div>
            {project && (
              <Button variant="ghost" size="icon" onClick={refreshProject}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">×</button>
            </div>
          )}

          {/* Step Tabs */}
          {project && (
            <div className="flex border-b gap-1 overflow-x-auto">
              {STEPS.map((step) => (
                <button
                  key={step.key}
                  onClick={() => setActiveStep(step.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeStep === step.key
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <step.icon className="w-3.5 h-3.5" />
                  {step.label}
                </button>
              ))}
            </div>
          )}

          {/* Step Content */}
          {!project ? (
            <StoryInputStep
              story={story}
              setStory={setStory}
              title={title}
              setTitle={setTitle}
              autoGenerate={autoGenerate}
              setAutoGenerate={setAutoGenerate}
              loading={loading}
              onSubmit={handleCreateAndAnalyze}
            />
          ) : (
            <>
              {activeStep === "story" && (
                <StoryAnalysisStep
                  project={project}
                  story={story}
                  setStory={setStory}
                  onReAnalyze={handleReAnalyze}
                  loading={loading}
                />
              )}
              {activeStep === "characters" && (
                <CharacterStep
                  project={project}
                  onGenerate={handleGenerateCharacters}
                  onToggleLock={(id, locked) => handleToggleLock("character", id, locked)}
                  onUpdate={handleUpdateCharacter}
                  onUpload={handleUploadRef}
                  onGenerateRef={handleGenerateRef}
                  onImagePreview={setImagePreviewUrl}
                  loading={loading}
                />
              )}
              {activeStep === "locations" && (
                <LocationStep
                  project={project}
                  onGenerate={handleGenerateLocations}
                  onToggleLock={(id, locked) => handleToggleLock("location", id, locked)}
                  onUpdate={handleUpdateLocation}
                  onGenerateRef={handleGenerateLocationRef}
                  onImagePreview={setImagePreviewUrl}
                  loading={loading}
                />
              )}
              {activeStep === "storyboard" && (
                <StoryboardStep
                  project={project}
                  onGenerate={handleGenerateStoryboard}
                  onUpdateShot={handleUpdateShot}
                  highlightShotIndex={highlightShotIndex}
                  onImagePreview={setImagePreviewUrl}
                  loading={loading}
                />
              )}
              {activeStep === "continuity" && (
                <ContinuityStep
                  project={project}
                  onCheck={handleCheckContinuity}
                  onJumpToShot={(shotIndex) => {
                    setHighlightShotIndex(shotIndex);
                    setActiveStep("storyboard");
                  }}
                  loading={loading}
                />
              )}
              {activeStep === "generate" && (
                <GenerateStep
                  project={project}
                  onRebuildPrompts={handleRebuildPrompts}
                  onGenerateShot={handleGenerateShot}
                  onPreview={setPreviewUrl}
                  onImagePreview={setImagePreviewUrl}
                  loading={loading}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Fullscreen video preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setPreviewUrl(null)}
        >
          <video
            src={previewUrl}
            controls
            autoPlay
            className="max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Fullscreen image preview */}
      {imagePreviewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-pointer"
          onClick={() => setImagePreviewUrl(null)}
        >
          <img
            src={imagePreviewUrl}
            alt="预览"
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ===== Step 1: Story Input (no project yet) =====

function StoryInputStep({
  story, setStory, title, setTitle, autoGenerate, setAutoGenerate, loading, onSubmit,
}: {
  story: string;
  setStory: (v: string) => void;
  title: string;
  setTitle: (v: string) => void;
  autoGenerate: boolean;
  setAutoGenerate: (v: boolean) => void;
  loading: boolean;
  onSubmit: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>创建新项目</CardTitle>
        <CardDescription>输入小说或故事文本，系统将自动解析剧情、角色和场景</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>项目标题（可选）</Label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：第一集"
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <Label>故事文本</Label>
          <Textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder={`例：在一个未来的赛博朋克城市，退役警探林峰发现了一个足以颠覆整个城市权力结构的秘密...`}
            className="min-h-48 resize-y"
          />
        </div>
        <div className="flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-3">
            <Switch
              id="auto-generate"
              checked={autoGenerate}
              onCheckedChange={setAutoGenerate}
            />
            <Label htmlFor="auto-generate" className="cursor-pointer">
              <span className="font-medium">自动生成视频</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                开启后将自动完成整个流程并生成所有镜头视频
              </p>
            </Label>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{story.length} 字</span>
          <Button onClick={onSubmit} disabled={loading || !story.trim()} size="lg">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {loading ? "创建中..." : autoGenerate ? "创建并自动生成" : "创建并解析"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Story Analysis Step =====

function StoryAnalysisStep({
  project, story, setStory, onReAnalyze, loading,
}: {
  project: ProjectDetail;
  story: string;
  setStory: (v: string) => void;
  onReAnalyze: () => void;
  loading: boolean;
}) {
  const analysis = project.analysis;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>故事内容</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={story} onChange={(e) => setStory(e.target.value)} className="min-h-32 resize-y" />
          {!analysis && (
            <Button onClick={onReAnalyze} disabled={loading} size="sm">
              {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
              解析剧情
            </Button>
          )}
          {analysis && (
            <Button onClick={onReAnalyze} disabled={loading} variant="outline" size="sm">
              {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              重新解析
            </Button>
          )}
        </CardContent>
      </Card>

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>剧情分析结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">摘要</h4>
              <p className="text-sm">{analysis.summary}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">核心冲突</h4>
              <p className="text-sm">{analysis.mainConflict}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">时间线</h4>
              <ol className="text-sm space-y-1">
                {analysis.timeline.map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{i + 1}.</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">角色</h4>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.characterNames.map((name) => (
                    <Badge key={name} variant="secondary">{name}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">场景</h4>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.sceneNames.map((name) => (
                    <Badge key={name} variant="outline">{name}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===== EditableField helper =====

function EditableField({
  label,
  value,
  multiline = false,
  onSave,
}: {
  label: string;
  value: string | null | undefined;
  multiline?: boolean;
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  if (editing) {
    return (
      <div className="space-y-1">
        <Label className="text-[10px]">{label}</Label>
        {multiline ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="text-xs min-h-[60px] font-mono"
            autoFocus
          />
        ) : (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:border-ring focus-visible:outline-none"
            autoFocus
          />
        )}
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => { onSave(draft); setEditing(false); }}
          >
            <Save className="w-3 h-3 mr-1" /> 保存
          </Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditing(false)}>
            <X className="w-3 h-3 mr-1" /> 取消
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-1">
      <div className="flex-1 min-w-0">
        <Label className="text-[10px] text-muted-foreground">{label}</Label>
        {multiline ? (
          <p className="text-[11px] text-muted-foreground bg-muted/30 rounded p-1.5 max-h-20 overflow-y-auto font-mono leading-relaxed whitespace-pre-wrap">
            {value || "—"}
          </p>
        ) : (
          <p className="text-xs">{value || "—"}</p>
        )}
      </div>
      <button
        onClick={() => { setDraft(value || ""); setEditing(true); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent mt-3"
      >
        <Pencil className="w-3 h-3 text-muted-foreground" />
      </button>
    </div>
  );
}

// ===== Character Step =====

function CharacterStep({
  project, onGenerate, onToggleLock, onUpdate, onUpload, onGenerateRef, onImagePreview, loading,
}: {
  project: ProjectDetail;
  onGenerate: () => void;
  onToggleLock: (id: number, locked: boolean) => void;
  onUpdate: (id: number, patch: Record<string, any>) => void;
  onUpload: (charId: number, file: File) => Promise<void>;
  onGenerateRef: (charId: number) => Promise<void>;
  onImagePreview: (url: string) => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">角色库</h2>
        <Button onClick={onGenerate} disabled={loading} size="sm">
          {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
          {project.characters.length > 0 ? "重新生成（未锁定）" : "生成角色库"}
        </Button>
      </div>

      {project.characters.length === 0 && !loading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            尚未生成角色库，点击上方按钮开始生成
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {project.characters.map((char) => (
          <CharacterCard key={char.id} character={char} onToggleLock={onToggleLock} onUpdate={onUpdate} onUpload={onUpload} onGenerateRef={onGenerateRef} onImagePreview={onImagePreview} />
        ))}
      </div>
    </div>
  );
}

function CharacterCard({
  character, onToggleLock, onUpdate, onUpload, onGenerateRef, onImagePreview,
}: {
  character: CharacterDTO;
  onToggleLock: (id: number, locked: boolean) => void;
  onUpdate: (id: number, patch: Record<string, any>) => void;
  onUpload: (charId: number, file: File) => Promise<void>;
  onGenerateRef: (charId: number) => Promise<void>;
  onImagePreview: (url: string) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { await onUpload(character.id, file); } finally { setUploading(false); }
    e.target.value = "";
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try { await onGenerateRef(character.id); } finally { setGenerating(false); }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{character.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground">锁定</Label>
            <Switch
              checked={character.locked}
              onCheckedChange={() => onToggleLock(character.id, character.locked)}
            />
          </div>
        </div>
        {character.role && <Badge variant="outline" className="w-fit text-[10px]">{character.role}</Badge>}
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Reference image area */}
        {character.referenceImageUrl ? (
          <div className="space-y-2">
            {/* Portrait */}
            <div className="relative group">
              <img
                src={character.referenceImageUrl}
                alt={character.name}
                className="w-full h-28 object-cover rounded-lg border cursor-pointer"
                onClick={() => onImagePreview(character.referenceImageUrl!)}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2 pointer-events-none group-hover:pointer-events-auto">
                <button
                  onClick={() => onImagePreview(character.referenceImageUrl!)}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-white/90 text-xs font-medium hover:bg-white transition-colors pointer-events-auto"
                >
                  <ImageIcon className="w-3 h-3" />
                  查看大图
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-white/90 text-xs font-medium hover:bg-white transition-colors pointer-events-auto"
                >
                  {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  重新生成
                </button>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-white/90 text-xs font-medium hover:bg-white transition-colors pointer-events-auto"
                >
                  <Upload className="w-3 h-3" />
                  换图
                </button>
              </div>
            </div>
            {/* Turnaround sheet (三视图) */}
            {character.turnaroundSheetUrl && (
              <div className="relative group">
                <div className="text-[10px] text-muted-foreground mb-0.5 font-medium">三视图（用于视频生成参考）</div>
                <img
                  src={character.turnaroundSheetUrl}
                  alt={`${character.name} 三视图`}
                  className="w-full h-20 object-cover rounded-lg border cursor-pointer"
                  onClick={() => onImagePreview(character.turnaroundSheetUrl!)}
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center mt-4 pointer-events-none group-hover:pointer-events-auto">
                  <button
                    onClick={() => onImagePreview(character.turnaroundSheetUrl!)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-white/90 text-xs font-medium hover:bg-white transition-colors pointer-events-auto"
                  >
                    <ImageIcon className="w-3 h-3" />
                    查看大图
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="border-2 border-dashed rounded-lg divide-y divide-dashed">
            {/* Primary: generate from prompt */}
            <button
              onClick={handleGenerate}
              disabled={generating || !character.identityPrompt}
              className="w-full p-3 flex flex-col items-center gap-1 hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : (
                <Sparkles className="w-5 h-5 text-primary" />
              )}
              <span className="text-xs font-medium">
                {generating ? "生成中（肖像 + 三视图）..." : "从提示词生成参考图"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                自动生成角色肖像和三视图（正面/侧面/背面）
              </span>
            </button>
            {/* Secondary: upload custom image */}
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="w-full p-3 flex flex-col items-center gap-1 hover:bg-muted/50 transition-colors"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-[10px] text-muted-foreground">
                或上传自定义图片
              </span>
            </button>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        {/* Profile summary */}
        {character.profile && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>{character.profile.age} · {character.profile.gender} · {character.profile.bodyShape}</p>
            <p>{character.profile.hair?.color} {character.profile.hair?.style} {character.profile.hair?.length}</p>
            <p>{character.profile.costume?.mainColor} {character.profile.costume?.style}</p>
          </div>
        )}

        {/* Editable identityPrompt */}
        <EditableField
          label="identityPrompt（角色视觉描述）"
          value={character.identityPrompt}
          multiline
          onSave={(val) => onUpdate(character.id, { identityPrompt: val })}
        />

        {/* Editable negativePrompt */}
        <EditableField
          label="negativePrompt（负面约束）"
          value={character.negativePrompt}
          multiline
          onSave={(val) => onUpdate(character.id, { negativePrompt: val })}
        />
      </CardContent>
    </Card>
  );
}

// ===== Location Step =====

function LocationStep({
  project, onGenerate, onToggleLock, onUpdate, onGenerateRef, onImagePreview, loading,
}: {
  project: ProjectDetail;
  onGenerate: () => void;
  onToggleLock: (id: number, locked: boolean) => void;
  onUpdate: (id: number, patch: Record<string, any>) => void;
  onGenerateRef: (locId: number) => Promise<void>;
  onImagePreview: (url: string) => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">场景库</h2>
        <Button onClick={onGenerate} disabled={loading} size="sm">
          {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
          {project.locations.length > 0 ? "重新生成（未锁定）" : "生成场景库"}
        </Button>
      </div>

      {project.locations.length === 0 && !loading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            尚未生成场景库，点击上方按钮开始生成
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {project.locations.map((loc) => (
          <LocationCard key={loc.id} location={loc} onToggleLock={onToggleLock} onUpdate={onUpdate} onGenerateRef={onGenerateRef} onImagePreview={onImagePreview} />
        ))}
      </div>
    </div>
  );
}

function LocationCard({
  location, onToggleLock, onUpdate, onGenerateRef, onImagePreview,
}: {
  location: LocationDTO;
  onToggleLock: (id: number, locked: boolean) => void;
  onUpdate: (id: number, patch: Record<string, any>) => void;
  onGenerateRef: (locId: number) => Promise<void>;
  onImagePreview: (url: string) => void;
}) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try { await onGenerateRef(location.id); } finally { setGenerating(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{location.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground">锁定</Label>
            <Switch
              checked={location.locked}
              onCheckedChange={() => onToggleLock(location.id, location.locked)}
            />
          </div>
        </div>
        <div className="flex gap-1.5">
          <Badge variant="outline" className="text-[10px]">{location.type}</Badge>
          {location.profile?.era && <Badge variant="outline" className="text-[10px]">{location.profile.era}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Reference image area */}
        {location.referenceImageUrl ? (
          <div className="relative group">
            <img
              src={location.referenceImageUrl}
              alt={location.name}
              className="w-full h-28 object-cover rounded-lg border cursor-pointer"
              onClick={() => onImagePreview(location.referenceImageUrl!)}
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2 pointer-events-none group-hover:pointer-events-auto">
              <button
                onClick={() => onImagePreview(location.referenceImageUrl!)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-white/90 text-xs font-medium hover:bg-white transition-colors pointer-events-auto"
              >
                <ImageIcon className="w-3 h-3" />
                查看大图
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1 px-2 py-1 rounded bg-white/90 text-xs font-medium hover:bg-white transition-colors pointer-events-auto"
              >
                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                重新生成
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={generating || !location.scenePrompt}
            className="w-full border-2 border-dashed rounded-lg p-3 flex flex-col items-center gap-1 hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
              <Sparkles className="w-5 h-5 text-primary" />
            )}
            <span className="text-xs font-medium">
              {generating ? "生成中..." : "从提示词生成参考图"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              基于 scenePrompt 自动生成
            </span>
          </button>
        )}

        {location.profile && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>📍 {location.profile.location}</p>
            <p>🎭 {location.profile.atmosphere}</p>
            <p>💡 {location.profile.visualRules?.lighting}</p>
            <p>🏛️ {location.profile.visualRules?.architecture}</p>
            <p>🧱 {location.profile.visualRules?.floor}</p>
            <p>🎨 {location.profile.visualRules?.colorPalette?.join(" / ")}</p>
            <p>🖼️ {location.profile.visualRules?.backgroundElements?.join("、")}</p>
            {location.profile.cameraRules && (
              <div className="mt-1 border-t pt-1 space-y-0.5">
                <p className="font-medium text-[10px]">📷 摄影机规则</p>
                <p>轴线：{location.profile.cameraRules.axisDirection}</p>
                <p>允许：{location.profile.cameraRules.allowedAngles?.join("、")}</p>
                <p>禁止：{location.profile.cameraRules.forbiddenAngles?.join("、")}</p>
              </div>
            )}
          </div>
        )}

        <EditableField
          label="scenePrompt（场景视觉描述）"
          value={location.scenePrompt}
          multiline
          onSave={(val) => onUpdate(location.id, { scenePrompt: val })}
        />

        <EditableField
          label="negativePrompt（负面约束）"
          value={location.negativePrompt}
          multiline
          onSave={(val) => onUpdate(location.id, { negativePrompt: val })}
        />
      </CardContent>
    </Card>
  );
}

// ===== Storyboard Step =====

function StoryboardStep({
  project, onGenerate, onUpdateShot, highlightShotIndex, onImagePreview, loading,
}: {
  project: ProjectDetail;
  onGenerate: () => void;
  onUpdateShot: (id: number, patch: Record<string, any>) => void;
  highlightShotIndex: number | null;
  onImagePreview: (url: string) => void;
  loading: boolean;
}) {
  const shotRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Scroll to highlighted shot
  useEffect(() => {
    if (highlightShotIndex != null) {
      const el = shotRefs.current.get(highlightShotIndex);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary");
        setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2000);
      }
    }
  }, [highlightShotIndex]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">分镜列表</h2>
        <Button onClick={onGenerate} disabled={loading} size="sm">
          {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
          {project.shots.length > 0 ? "重新生成分镜" : "生成分镜"}
        </Button>
      </div>

      {project.shots.length === 0 && !loading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            尚未生成分镜，请先生成角色库和场景库，然后点击上方按钮
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {project.shots.map((shot) => (
          <ShotCard
            key={shot.id}
            shot={shot}
            project={project}
            onUpdate={onUpdateShot}
            onImagePreview={onImagePreview}
            ref={(el) => { if (el) shotRefs.current.set(shot.shotIndex, el); else shotRefs.current.delete(shot.shotIndex); }}
          />
        ))}
      </div>
    </div>
  );
}

const ShotCard = React.forwardRef<HTMLDivElement, {
  shot: ShotDTO;
  project: ProjectDetail;
  onUpdate: (id: number, patch: Record<string, any>) => void;
  onImagePreview: (url: string) => void;
}>(({ shot, project, onUpdate, onImagePreview }, ref) => {
  const location = project.locations.find((l) => l.id === shot.locationId);
  const locationName = location?.name || "未知场景";
  const shotCharacters = shot.characterIds
    .map((cid) => project.characters.find((c) => c.id === cid))
    .filter(Boolean) as CharacterDTO[];

  const facingEntries = Object.entries(shot.continuity.characterFacing);
  const charMap = new Map(project.characters.map((c) => [String(c.id), c.name]));

  return (
    <Card ref={ref} className="transition-shadow duration-500">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
            {shot.shotIndex}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header with linked refs */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">镜头 {shot.shotIndex}</span>

              {/* Location ref thumbnail */}
              {location?.referenceImageUrl ? (
                <div
                  className="flex items-center gap-1 rounded-md border bg-muted/30 overflow-hidden cursor-pointer hover:ring-1 hover:ring-primary/50 transition-shadow"
                  onClick={() => onImagePreview(location.referenceImageUrl!)}
                >
                  <img src={location.referenceImageUrl} alt={locationName} className="w-5 h-5 object-cover" />
                  <span className="text-[10px] pr-1.5 text-muted-foreground">{locationName}</span>
                </div>
              ) : (
                <Badge variant="outline" className="text-[10px]">📍 {locationName}</Badge>
              )}

              {/* Character ref avatars */}
              {shotCharacters.map((char) => (
                char.referenceImageUrl ? (
                  <div
                    key={char.id}
                    className="flex items-center gap-1 rounded-full border bg-muted/30 overflow-hidden cursor-pointer hover:ring-1 hover:ring-primary/50 transition-shadow"
                    onClick={() => onImagePreview(char.referenceImageUrl!)}
                  >
                    <img src={char.referenceImageUrl} alt={char.name} className="w-5 h-5 object-cover rounded-full" />
                    <span className="text-[10px] pr-1.5 text-muted-foreground">{char.name}</span>
                  </div>
                ) : (
                  <Badge key={char.id} variant="secondary" className="text-[10px]">{char.name}</Badge>
                )
              ))}

              <Badge variant="outline" className="text-[10px]">{shot.duration}s</Badge>
            </div>

            {/* Editable narrative */}
            <EditableField
              label="叙事描述"
              value={shot.narrative}
              multiline
              onSave={(val) => onUpdate(shot.id, { narrative: val })}
            />

            {/* Camera & Continuity */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <div>📷 {shot.camera.shotSize} · {shot.camera.angle} · {shot.camera.movement} · {shot.camera.lens}</div>
              <div>🧭 {shot.continuity.screenDirection}</div>
              <div>🎬 动作：{shot.continuity.actionStart} → {shot.continuity.actionEnd}</div>
              <div>😀 情绪：{shot.continuity.emotionStart} → {shot.continuity.emotionEnd}</div>
            </div>

            {/* Character facing */}
            {facingEntries.length > 0 && (
              <div className="text-[10px] text-muted-foreground">
                朝向：{facingEntries.map(([id, dir]) => `${charMap.get(id) || `#${id}`}: ${dir}`).join(" | ")}
              </div>
            )}

            {/* Video prompt */}
            {shot.videoPrompt && (
              <div className="text-[10px] text-muted-foreground bg-muted/30 rounded p-2 leading-relaxed max-h-24 overflow-y-auto font-mono">
                {shot.videoPrompt.length > 500 ? shot.videoPrompt.slice(0, 500) + "..." : shot.videoPrompt}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

// ===== Continuity Step =====

function ContinuityStep({
  project, onCheck, onJumpToShot, loading,
}: {
  project: ProjectDetail;
  onCheck: () => void;
  onJumpToShot: (shotIndex: number) => void;
  loading: boolean;
}) {
  const issues = project.continuityIssues;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">连续性检查</h2>
        <Button onClick={onCheck} disabled={loading} size="sm">
          {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />}
          检查连续性
        </Button>
      </div>

      {issues.length === 0 && !loading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            {project.shots.length === 0
              ? "请先生成分镜后再检查连续性"
              : "未发现连续性问题，或尚未进行检查"}
          </CardContent>
        </Card>
      )}

      {issues.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>共发现 {issues.length} 个问题</span>
            <Badge variant="destructive" className="text-[10px]">
              {issues.filter((i) => i.severity === "error").length} 错误
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {issues.filter((i) => i.severity === "warning").length} 警告
            </Badge>
          </div>

          {issues.map((issue, idx) => (
            <Card
              key={`${issue.code}-${issue.shotIndex}-${idx}`}
              className={`cursor-pointer transition-colors hover:bg-accent ${
                issue.severity === "error" ? "border-destructive/30" : "border-yellow-500/30"
              }`}
              onClick={() => issue.shotIndex != null && onJumpToShot(issue.shotIndex)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  {issue.severity === "error" ? (
                    <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{issue.code}</Badge>
                      {issue.shotIndex != null && (
                        <span className="text-xs text-muted-foreground">镜头 {issue.shotIndex}</span>
                      )}
                    </div>
                    <p className="text-sm mt-1">{issue.message}</p>
                    {issue.suggestion && (
                      <p className="text-xs text-muted-foreground mt-1">💡 {issue.suggestion}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Generate Step =====

function GenerateStep({
  project, onRebuildPrompts, onGenerateShot, onPreview, onImagePreview, loading,
}: {
  project: ProjectDetail;
  onRebuildPrompts: () => void;
  onGenerateShot: (shot: ShotDTO) => void;
  onPreview: (url: string) => void;
  onImagePreview: (url: string) => void;
  loading: boolean;
}) {
  const completedCount = project.shots.filter((s) => s.status === "completed").length;
  const generatingCount = project.shots.filter((s) => s.status === "generating").length;
  const failedCount = project.shots.filter((s) => s.status === "failed").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">视频生成</h2>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>✅ {completedCount}</span>
            <span>⏳ {generatingCount}</span>
            <span>❌ {failedCount}</span>
            <span>📝 {project.shots.length - completedCount - generatingCount - failedCount}</span>
          </div>
        </div>
        <Button onClick={onRebuildPrompts} disabled={loading} variant="outline" size="sm">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          重建 Prompt
        </Button>
      </div>

      <div className="space-y-3">
        {project.shots.map((shot) => (
          <GenerateShotCard
            key={shot.id}
            shot={shot}
            project={project}
            onGenerate={onGenerateShot}
            onPreview={onPreview}
            onImagePreview={onImagePreview}
          />
        ))}
      </div>

      {project.shots.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            请先生成分镜
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GenerateShotCard({
  shot, project, onGenerate, onPreview, onImagePreview,
}: {
  shot: ShotDTO;
  project: ProjectDetail;
  onGenerate: (shot: ShotDTO) => void;
  onPreview: (url: string) => void;
  onImagePreview: (url: string) => void;
}) {
  const location = project.locations.find((l) => l.id === shot.locationId);
  const locationName = location?.name || "未知场景";
  const shotCharacters = shot.characterIds
    .map((cid) => project.characters.find((c) => c.id === cid))
    .filter(Boolean) as CharacterDTO[];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
            {shot.shotIndex}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">镜头 {shot.shotIndex}</span>

                {/* Location ref thumbnail */}
                {location?.referenceImageUrl ? (
                  <div
                    className="flex items-center gap-1 rounded-md border bg-muted/30 overflow-hidden cursor-pointer hover:ring-1 hover:ring-primary/50 transition-shadow"
                    onClick={() => onImagePreview(location.referenceImageUrl!)}
                  >
                    <img src={location.referenceImageUrl} alt={locationName} className="w-5 h-5 object-cover" />
                    <span className="text-[10px] pr-1.5 text-muted-foreground">{locationName}</span>
                  </div>
                ) : (
                  <Badge variant="outline" className="text-[10px]">📍 {locationName}</Badge>
                )}

                {/* Character ref avatars */}
                {shotCharacters.map((char) => (
                  char.referenceImageUrl ? (
                    <div
                      key={char.id}
                      className="flex items-center gap-1 rounded-full border bg-muted/30 overflow-hidden cursor-pointer hover:ring-1 hover:ring-primary/50 transition-shadow"
                      onClick={() => onImagePreview(char.referenceImageUrl!)}
                    >
                      <img src={char.referenceImageUrl} alt={char.name} className="w-5 h-5 object-cover rounded-full" />
                      <span className="text-[10px] pr-1.5 text-muted-foreground">{char.name}</span>
                    </div>
                  ) : (
                    <Badge key={char.id} variant="secondary" className="text-[10px]">{char.name}</Badge>
                  )
                ))}

                <Badge variant="outline" className="text-[10px]">{shot.duration}s</Badge>
              </div>
              {shot.status === "completed" ? (
                <Badge variant="success" className="gap-1 text-[10px]"><CheckCircle2 className="w-3 h-3" />完成</Badge>
              ) : shot.status === "failed" ? (
                <Badge variant="destructive" className="gap-1 text-[10px]"><XCircle className="w-3 h-3" />失败</Badge>
              ) : shot.status === "generating" ? (
                <Badge variant="secondary" className="gap-1 text-[10px]"><Loader2 className="w-3 h-3 animate-spin" />生成中</Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-[10px]"><Clock className="w-3 h-3" />{shot.status}</Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2">{shot.narrative}</p>

            {/* Video prompt - show when available */}
            {shot.videoPrompt && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-muted-foreground">视频提示词</Label>
                  <span className="text-[10px] text-muted-foreground">{shot.videoPrompt.length} 字符</span>
                </div>
                <div className="text-[11px] text-muted-foreground bg-muted/30 rounded p-2 leading-relaxed max-h-32 overflow-y-auto font-mono">
                  {shot.videoPrompt}
                </div>
              </div>
            )}

            {/* Video preview */}
            {shot.videoUrl && (
              <div className="mt-2 relative group w-full max-w-sm">
                <video src={shot.videoUrl} className="w-full rounded-lg border shadow-sm pointer-events-none" preload="metadata" />
                <div
                  onClick={() => onPreview(shot.videoUrl!)}
                  className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-black/80 transition-colors">
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {shot.errorMessage && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-xs">
                <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{shot.errorMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              {(shot.status === "draft" || shot.status === "ready" || shot.status === "failed") && (
                <Button size="sm" onClick={() => onGenerate(shot)}>
                  {shot.status === "failed" ? (
                    <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />重试</>
                  ) : (
                    <><Video className="w-3.5 h-3.5 mr-1.5" />生成视频</>
                  )}
                </Button>
              )}
              {shot.status === "completed" && shot.videoUrl && (
                <Button size="sm" variant="outline" onClick={() => onPreview(shot.videoUrl!)}>
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  播放
                </Button>
              )}
              {shot.status === "generating" && (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  正在生成...
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

