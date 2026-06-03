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
};
