const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getToken() {
  return localStorage.getItem("pos_token");
}

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  del: (path) => request(path, { method: "DELETE" }),
  uploadProductImage: async (file) => {
    const token = getToken();
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`${BASE_URL}/api/products/upload-image`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data?.error || "Upload failed"), { data });
    return data; // { imageUrl }
  },
  uploadStoreLogo: async (file) => {
    const token = getToken();
    const formData = new FormData();
    formData.append("logo", file);
    const res = await fetch(`${BASE_URL}/api/auth/settings/upload-logo`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data?.error || "Upload failed"), { data });
    return data; // { logoUrl }
  },
};

// Resolve a relative /uploads/... path returned by the API into a full URL for <img src>
export function resolveImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http")) return imageUrl;
  return `${BASE_URL}${imageUrl}`;
}