// API wrapper with auth token handling

class APIError extends Error {
  constructor(message, status, details, code) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem("modus_auth_token");

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(endpoint, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(
        errorData.error || `Request failed with status ${response.status}`,
        response.status,
        errorData.details,
        errorData.code,
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError("Network error", 0, error.message);
  }
}

export const api = {
  get: (endpoint) => apiCall(endpoint, { method: "GET" }),
  post: (endpoint, data) =>
    apiCall(endpoint, { method: "POST", body: JSON.stringify(data) }),
  put: (endpoint, data) =>
    apiCall(endpoint, { method: "PUT", body: JSON.stringify(data) }),
  delete: (endpoint) => apiCall(endpoint, { method: "DELETE" }),
  deleteWithBody: (endpoint, data) =>
    apiCall(endpoint, { method: "DELETE", body: JSON.stringify(data) }),
};
