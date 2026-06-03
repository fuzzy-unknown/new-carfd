import { useState, useRef } from "react";
import { Badge } from "./ui/badge";
import { api } from "../lib/api";
import { Upload, X, Loader2, Video } from "lucide-react";

export interface ReferenceMedia {
  id: string;
  type: "image" | "video";
  url: string;
  name: string;
}

interface Props {
  modelId: string;
  references: ReferenceMedia[];
  onAdd: (ref: ReferenceMedia) => void;
  onRemove: (id: string) => void;
}

export function ReferenceUploadZone({ modelId, references, onAdd, onRemove }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptsVideo = modelId === "wan2.7-r2v";
  const maxFiles = 5;

  const handleFiles = async (files: FileList) => {
    setError(null);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (references.length >= maxFiles) {
        setError(`最多上传 ${maxFiles} 个参考素材`);
        break;
      }
      setUploading(true);
      try {
        const ref = await api.bailian.upload(file);
        onAdd(ref);
      } catch (err: any) {
        setError(err.message || "上传失败");
      } finally {
        setUploading(false);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">参考素材</span>
        <Badge variant="secondary" className="text-xs">
          {references.length}/{maxFiles}
        </Badge>
      </div>

      {/* Uploaded references strip */}
      {references.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {references.map((ref, idx) => (
            <div
              key={ref.id}
              className="relative group w-16 h-16 rounded-lg border overflow-hidden shrink-0"
            >
              {ref.type === "image" ? (
                <img src={ref.url} alt={ref.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <Video className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              {/* Index badge */}
              <div className="absolute top-0.5 left-0.5 bg-black/60 text-white text-[10px] px-1 rounded font-mono">
                {modelId === "wan2.7-r2v" ? `图${idx + 1}` : `#${idx + 1}`}
              </div>
              {/* Remove button */}
              <button
                onClick={() => onRemove(ref.id)}
                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {uploading && (
            <div className="w-16 h-16 rounded-lg border border-dashed flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}

      {/* Upload zone */}
      {references.length < maxFiles && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={handleClick}
          className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <input
            ref={inputRef}
            type="file"
            accept={acceptsVideo ? "image/*,video/mp4,video/mov" : "image/*"}
            multiple
            className="hidden"
            onChange={handleInputChange}
          />
          <Upload className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            点击或拖拽上传{acceptsVideo ? "图片/视频" : "图片"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {acceptsVideo ? "支持 JPG/PNG/MP4，单文件 ≤ 20MB" : "支持 JPG/PNG/WEBP，单文件 ≤ 20MB"}
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
