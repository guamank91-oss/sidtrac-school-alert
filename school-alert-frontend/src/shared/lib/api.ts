import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('sidtrac_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

const VALIDATION_MESSAGES: Record<string, string> = {
  'String should have at least 5 characters': 'La cédula debe tener al menos 5 caracteres',
  'field required': 'Faltan datos obligatorios',
}

function translateDetail(msg: string, field?: string): string {
  const base = VALIDATION_MESSAGES[msg] ?? msg
  if (field && !VALIDATION_MESSAGES[msg]) {
    return `${field}: ${base}`
  }
  return base
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') {
      return detail
    }
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0]
      const field = Array.isArray(first?.loc) ? first.loc[first.loc.length - 1] : undefined
      if (typeof first?.msg === 'string') {
        return translateDetail(first.msg, typeof field === 'string' ? field : undefined)
      }
    }
    if (error.response?.status === 403) {
      return 'No tiene permisos para realizar esta acción'
    }
  }
  return fallback
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await apiClient.get<T>(url)
  return res.data
}

export async function apiPost<T>(url: string, data?: unknown): Promise<T> {
  const res = await apiClient.post<T>(url, data)
  return res.data
}

export async function apiPut<T>(url: string, data?: unknown): Promise<T> {
  const res = await apiClient.put<T>(url, data)
  return res.data
}
