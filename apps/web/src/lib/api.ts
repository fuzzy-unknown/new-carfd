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
  },
};
