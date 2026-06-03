import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Sparkles, Loader2, BookOpen, Play, Clock, CheckCircle2, XCircle, Video, ChevronDown, Upload, Trash2 } from "lucide-react";

interface Scene {
  id: number;
  sceneNumber: number;
  title: string;
  description: string;
  videoPrompt: string;
  characterNames: string[];
  status: "pending" | "generating" | "completed" | "failed";
  videoUrl: string | null;
  errorMessage: string | null;
}

interface Character {
  id: number;
  name: string;
  description: string;
  appearance: string | null;
  referenceImageUrl: string | null;
}

interface Project {
  id: number;
  storyText: string;
  status: string;
  createdAt: number;
  scenes: Scene[];
  characters: Character[];
}

interface ProjectSummary {
  id: number;
  storyText: string;
  status: string;
  createdAt: number;
}

export function Explore() {
  const [story, setStory] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [generatingSceneId, setGeneratingSceneId] = useState<number | null>(null);
  const [pastProjects, setPastProjects] = useState<ProjectSummary[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sceneParams, setSceneParams] = useState<Record<number, { duration: number; resolution: string }>>({});
  const sceneEndRef = useRef<HTMLDivElement>(null);

  // Load past projects on mount
  useEffect(() => {
    api.bailian.getProjects().then(setPastProjects).catch(() => {});
  }, []);

  // Poll project scenes when any scene is generating or pending
  useEffect(() => {
    if (!project) return;
    const hasActive = project.scenes.some(s => s.status === "generating" || s.status === "pending");
    if (!hasActive) return;

    const interval = setInterval(async () => {
      try {
        const updated = await api.bailian.getProject(project.id);
        if (updated) setProject(updated);
      } catch { /* skip */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [project]);

  const handleAnalyze = async () => {
    if (!story.trim()) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    setProject(null);
    try {
      const result = await api.bailian.analyzeStory(story.trim());
      setProject({
        id: result.id,
        storyText: story.trim(),
        status: result.status,
        createdAt: Date.now(),
        scenes: result.scenes.map((s: any) => ({ ...s, status: s.status || "pending" })),
        characters: result.characters || [],
      });
      // Refresh past projects list
      api.bailian.getProjects().then(setPastProjects).catch(() => {});
    } catch (err: any) {
      setAnalyzeError(err.message || "分析失败，请重试");
    } finally {
      setAnalyzing(false);
    }
  };

  const getSceneParams = (sceneId: number) => sceneParams[sceneId] || { duration: 5, resolution: "720P" };

  const updateSceneParam = (sceneId: number, key: "duration" | "resolution", value: number | string) => {
    setSceneParams(prev => ({
      ...prev,
      [sceneId]: { ...getSceneParams(sceneId), [key]: value },
    }));
  };

  const handleGenerateScene = async (scene: Scene) => {
    setGeneratingSceneId(scene.id);
    const params = getSceneParams(scene.id);
    // Optimistically update the scene status
    setProject(prev => prev ? {
      ...prev,
      scenes: prev.scenes.map(s => s.id === scene.id ? { ...s, status: "generating" as const } : s),
    } : null);
    try {
      await api.bailian.generateSceneVideo(scene.id, params);
      // The polling effect will pick up the update
    } catch (err: any) {
      setProject(prev => prev ? {
        ...prev,
        scenes: prev.scenes.map(s => s.id === scene.id ? { ...s, status: "failed" as const, errorMessage: err.message } : s),
      } : null);
    } finally {
      setGeneratingSceneId(null);
    }
  };

  const handleUpdatePrompt = (sceneId: number, prompt: string) => {
    setProject(prev => prev ? {
      ...prev,
      scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, videoPrompt: prompt } : s),
    } : null);
  };

  const handleCharacterUpload = async (characterId: number, file: File) => {
    const result = await api.bailian.uploadCharacterReference(characterId, file);
    setProject(prev => prev ? {
      ...prev,
      characters: prev.characters.map(c =>
        c.id === characterId ? { ...c, referenceImageUrl: result.referenceImageUrl } : c
      ),
    } : null);
  };

  const loadProject = async (id: number) => {
    try {
      const p = await api.bailian.getProject(id);
      if (p) {
        setProject(p);
        setStory(p.storyText);
      }
    } catch { /* skip */ }
  };

  const handleDeleteProject = async (id: number) => {
    try {
      await api.bailian.deleteProject(id);
      setPastProjects(prev => prev.filter(p => p.id !== id));
      if (project?.id === id) setProject(null);
    } catch { /* ignore */ }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="success" className="gap-1"><CheckCircle2 className="w-3 h-3" />已完成</Badge>;
      case "failed":
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />失败</Badge>;
      case "generating":
        return <Badge variant="secondary" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" />生成中</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />未生成</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        {project && (
          <Button variant="ghost" size="icon" onClick={() => { setProject(null); setAnalyzeError(null); }} className="shrink-0">
            <ChevronDown className="w-5 h-5 rotate-90" />
          </Button>
        )}
        <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
          <BookOpen className="w-6 h-6 text-emerald-500" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">探索</h1>
          <p className="text-muted-foreground mt-1">小说转视频工作流 — 输入故事，AI 分解场景并逐段生成视频</p>
        </div>
      </div>

      {/* Step 1: Story Input */}
      <Card>
        <CardHeader>
          <CardTitle>输入故事</CardTitle>
          <CardDescription>粘贴你的小说、故事或想法描述</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder={`例：在一个未来的赛博朋克城市，退役警探林峰发现了一个足以颠覆整个城市权力结构的秘密。他必须在被追捕的同时，决定是否将这个秘密公之于众...`}
            className="min-h-40 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:outline-none resize-y"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{story.length} 字</span>
            <Button onClick={handleAnalyze} disabled={analyzing || !story.trim()} size="lg">
              {analyzing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {analyzing ? "分析中..." : "分析故事"}
            </Button>
          </div>
          {analyzeError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{analyzeError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Character Reference Cards */}
      {project && project.characters && project.characters.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">角色参考</h2>
            <span className="text-sm text-muted-foreground">
              {project.characters.length} 个角色
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {project.characters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                onUpload={handleCharacterUpload}
              />
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Scene List */}
      {project && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">场景列表</h2>
            <span className="text-sm text-muted-foreground">
              共 {project.scenes.length} 个场景
            </span>
          </div>
          {project.scenes.map((scene) => (
            <Card key={scene.id} className="overflow-hidden">
              <div className="flex items-start gap-4 p-5">
                {/* Scene number badge */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                  {scene.sceneNumber}
                </div>

                <div className="flex-1 min-w-0 space-y-3">
                  {/* Title + Status */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="font-medium truncate">{scene.title}</h3>
                      {scene.characterNames && scene.characterNames.length > 0 && (
                        <div className="flex -space-x-1.5 shrink-0">
                          {scene.characterNames.map((name) => {
                            const char = project?.characters.find(c => c.name === name);
                            if (!char) return null;
                            return char.referenceImageUrl ? (
                              <img
                                key={char.id}
                                src={char.referenceImageUrl}
                                alt={char.name}
                                title={char.name}
                                className="w-6 h-6 rounded-full border-2 border-background object-cover"
                              />
                            ) : (
                              <div
                                key={char.id}
                                title={char.name}
                                className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground"
                              >
                                {char.name.charAt(0)}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {getStatusBadge(scene.status)}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground">{scene.description}</p>

                  {/* Editable Video Prompt */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">视频提示词</label>
                    <textarea
                      value={scene.videoPrompt}
                      onChange={(e) => handleUpdatePrompt(scene.id, e.target.value)}
                      className="w-full min-h-[60px] rounded-md border border-input bg-muted/30 px-3 py-2 text-xs font-mono shadow-sm transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:outline-none resize-y"
                      disabled={scene.status === "generating"}
                    />
                  </div>

                  {/* Video result */}
                  {scene.videoUrl && (
                    <div className="mt-2 relative group w-full max-w-sm">
                      <video
                        src={scene.videoUrl}
                        className="w-full rounded-lg border shadow-sm pointer-events-none"
                        preload="metadata"
                      />
                      <div
                        onClick={() => setPreviewUrl(scene.videoUrl)}
                        className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-black/80 transition-colors">
                          <Play className="w-5 h-5 text-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error message */}
                  {scene.errorMessage && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">
                      <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{scene.errorMessage}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {scene.status === "pending" || scene.status === "failed" ? (
                      <>
                        <div className="flex items-center gap-1 mr-1">
                          <select
                            value={getSceneParams(scene.id).resolution}
                            onChange={(e) => updateSceneParam(scene.id, "resolution", e.target.value)}
                            disabled={generatingSceneId === scene.id}
                            className="h-7 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:outline-none"
                          >
                            <option value="720P">720P</option>
                            <option value="1080P">1080P</option>
                          </select>
                          <select
                            value={getSceneParams(scene.id).duration}
                            onChange={(e) => updateSceneParam(scene.id, "duration", Number(e.target.value))}
                            disabled={generatingSceneId === scene.id}
                            className="h-7 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:outline-none"
                          >
                            <option value={5}>5s</option>
                            <option value={10}>10s</option>
                            <option value={15}>15s</option>
                          </select>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleGenerateScene(scene)}
                          disabled={generatingSceneId === scene.id}
                        >
                          {generatingSceneId === scene.id ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Video className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          {scene.status === "failed" ? "重新生成" : "生成视频"}
                        </Button>
                      </>
                    ) : scene.status === "generating" ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>正在生成视频...</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1 mr-1 text-xs text-muted-foreground">
                          <span className="border rounded px-1.5 py-0.5">{getSceneParams(scene.id).resolution}</span>
                          <span className="border rounded px-1.5 py-0.5">{getSceneParams(scene.id).duration}s</span>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setPreviewUrl(scene.videoUrl)} disabled={!scene.videoUrl}>
                          <Play className="w-3.5 h-3.5 mr-1.5" />
                          播放
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
          <div ref={sceneEndRef} />
        </div>
      )}

      {/* Past Projects */}
      {pastProjects.length > 0 && !project && (
        <Card>
          <CardHeader>
            <CardTitle>历史项目</CardTitle>
            <CardDescription>之前分析过的故事项目</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pastProjects.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 w-full p-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <button
                  onClick={() => loadProject(p.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{p.storyText}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(p.createdAt).toLocaleString()}
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => handleDeleteProject(p.id)}
                  className="shrink-0 p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="删除项目"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}

function CharacterCard({ character, onUpload }: { character: Character; onUpload: (charId: number, file: File) => Promise<void> }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(character.id, file);
    } finally {
      setUploading(false);
    }
    e.target.value = "";
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{character.name}</CardTitle>
        <CardDescription>{character.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {character.appearance && (
          <p className="text-xs text-muted-foreground leading-relaxed">{character.appearance}</p>
        )}

        {character.referenceImageUrl ? (
          <div className="relative group">
            <img
              src={character.referenceImageUrl}
              alt={character.name}
              className="w-full h-32 object-cover rounded-lg border"
            />
            <div
              onClick={() => inputRef.current?.click()}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center cursor-pointer"
            >
              <span className="text-white text-xs">更换图片</span>
            </div>
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" />
            ) : (
              <>
                <Upload className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">上传角色参考图</p>
                <p className="text-[10px] text-muted-foreground mt-1">支持 JPG/PNG/WEBP</p>
              </>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </CardContent>
    </Card>
  );
}
