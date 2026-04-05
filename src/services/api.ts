// src/services/api.ts   (or src/lib/api.ts)
const API_BASE = '/api';

export const api = {
  async get<T = any>(endpoint: string): Promise<T> {
    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(errorText || `HTTP error! status: ${res.status}`);
    }

    return res.json();
  },

  async post<T = any>(endpoint: string, data: any): Promise<T> {
    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(errorText || `HTTP error! status: ${res.status}`);
    }

    return res.json();
  },

  async put<T = any>(endpoint: string, data: any): Promise<T> {
    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    const res = await fetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(errorText || `HTTP error! status: ${res.status}`);
    }

    return res.json();
  },

  async delete<T = any>(endpoint: string): Promise<T> {
    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    const res = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(errorText || `HTTP error! status: ${res.status}`);
    }

    return res.json();
  },

  async upload(file: File): Promise<{ success: boolean; url: string }> {
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(errorText || `Upload failed: ${res.status}`);
    }

    return res.json();
  },
};
