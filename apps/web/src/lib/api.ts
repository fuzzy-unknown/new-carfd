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
};
