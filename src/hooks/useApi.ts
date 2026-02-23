// ============================================
// HOOK PARA CONSUMIR LA API
// ============================================

import { useState, useCallback } from 'react';

const API_URL = '/api';

interface UseApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  params?: Record<string, string>;
}

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async <T>(endpoint: string, options: UseApiOptions = {}): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const { method = 'GET', body, params } = options;
      
      let url = `${API_URL}/${endpoint}`;
      if (params) {
        const searchParams = new URLSearchParams(params);
        url += `?${searchParams.toString()}`;
      }

      const config: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (body && method !== 'GET') {
        config.body = JSON.stringify(body);
      }

      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en la solicitud');
      }

      return data as T;
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback(<T>(endpoint: string, params?: Record<string, string>) => {
    return request<T>(endpoint, { method: 'GET', params });
  }, [request]);

  const post = useCallback(<T>(endpoint: string, body: any, params?: Record<string, string>) => {
    return request<T>(endpoint, { method: 'POST', body, params });
  }, [request]);

  const put = useCallback(<T>(endpoint: string, body: any, params?: Record<string, string>) => {
    return request<T>(endpoint, { method: 'PUT', body, params });
  }, [request]);

  const del = useCallback(<T>(endpoint: string, params?: Record<string, string>) => {
    return request<T>(endpoint, { method: 'DELETE', params });
  }, [request]);

  return { loading, error, request, get, post, put, del };
}
