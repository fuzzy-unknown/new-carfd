const API_BASE = "/api";

async function handleResponse(res: Response) {
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "请求失败" }));
    throw new Error(error.message || `请求失败: ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: {
    check: () => fetch(`${API_BASE}/health`).then(handleResponse),
  },

  users: {
    findAll: () => fetch(`${API_BASE}/users`).then(handleResponse),
    findById: (id: number) => fetch(`${API_BASE}/users/${id}`).then(handleResponse),
    create: (data: { name: string; email: string }) =>
      fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(handleResponse),
  },

  bailian: {
    getModels: () => fetch(`${API_BASE}/bailian/models`).then(handleResponse),
    generate: (data: { model: string; parameters: Record<string, any> }) =>
      fetch(`${API_BASE}/bailian/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(handleResponse),
    getRecords: () => fetch(`${API_BASE}/bailian/records`).then(handleResponse),
    getRecordById: (id: number) => fetch(`${API_BASE}/bailian/records/${id}`).then(handleResponse),
    getStatistics: () => fetch(`${API_BASE}/bailian/statistics`).then(handleResponse),
    upload: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return fetch(`${API_BASE}/bailian/upload`, {
        method: 'POST',
        body: formData,
      }).then(handleResponse);
    },
    analyzeStory: (story: string) =>
      fetch(`${API_BASE}/bailian/explore/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story }),
      }).then(handleResponse),
    generateSceneVideo: (sceneId: number, params?: { model?: string; resolution?: string; duration?: number }) =>
      fetch(`${API_BASE}/bailian/explore/scenes/${sceneId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params || {}),
      }).then(handleResponse),
    getProject: (id: number) =>
      fetch(`${API_BASE}/bailian/explore/projects/${id}`).then(handleResponse),
    getProjects: () =>
      fetch(`${API_BASE}/bailian/explore/projects`).then(handleResponse),
    deleteProject: (id: number) =>
      fetch(`${API_BASE}/bailian/explore/projects/${id}/delete`, { method: 'POST' }).then(handleResponse),
    uploadCharacterReference: (characterId: number, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return fetch(`${API_BASE}/bailian/explore/characters/${characterId}/upload`, {
        method: 'POST',
        body: formData,
      }).then(handleResponse);
    },
  },

  novelVideo: {
    listProjects: () =>
      fetch(`${API_BASE}/novel-video/projects`).then(handleResponse),

    createProject: (data: { title?: string; storyText: string }) =>
      fetch(`${API_BASE}/novel-video/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(handleResponse),

    getProject: (id: number) =>
      fetch(`${API_BASE}/novel-video/projects/${id}`).then(handleResponse),

    analyzeProject: (id: number) =>
      fetch(`${API_BASE}/novel-video/projects/${id}/analyze`, {
        method: "POST",
      }).then(handleResponse),

    generateCharacters: (id: number) =>
      fetch(`${API_BASE}/novel-video/projects/${id}/characters/generate`, {
        method: "POST",
      }).then(handleResponse),

    generateLocations: (id: number) =>
      fetch(`${API_BASE}/novel-video/projects/${id}/locations/generate`, {
        method: "POST",
      }).then(handleResponse),

    generateStoryboard: (id: number) =>
      fetch(`${API_BASE}/novel-video/projects/${id}/storyboard/generate`, {
        method: "POST",
      }).then(handleResponse),

    checkContinuity: (id: number) =>
      fetch(`${API_BASE}/novel-video/projects/${id}/continuity/check`, {
        method: "POST",
      }).then(handleResponse),

    rebuildPrompts: (id: number) =>
      fetch(`${API_BASE}/novel-video/projects/${id}/prompts/rebuild`, {
        method: "POST",
      }).then(handleResponse),

    updateCharacter: (id: number, patch: Record<string, any>) =>
      fetch(`${API_BASE}/novel-video/characters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then(handleResponse),

    updateLocation: (id: number, patch: Record<string, any>) =>
      fetch(`${API_BASE}/novel-video/locations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then(handleResponse),

    updateShot: (id: number, patch: Record<string, any>) =>
      fetch(`${API_BASE}/novel-video/shots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then(handleResponse),

    generateShot: (id: number, options?: { resolution?: string; duration?: number }) =>
      fetch(`${API_BASE}/novel-video/shots/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options || {}),
      }).then(handleResponse),

    uploadCharacterReference: (id: number, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return fetch(`${API_BASE}/novel-video/characters/${id}/upload-reference`, {
        method: "POST",
        body: formData,
      }).then(handleResponse);
    },
  },

  assets: {
    getAssets: (params?: { type?: string; source?: string }) => {
      const query = new URLSearchParams();
      if (params?.type) query.set("type", params.type);
      if (params?.source) query.set("source", params.source);
      const qs = query.toString();
      return fetch(`${API_BASE}/assets${qs ? `?${qs}` : ""}`).then(handleResponse);
    },
    getStats: () => fetch(`${API_BASE}/assets/stats`).then(handleResponse),
  },
};
