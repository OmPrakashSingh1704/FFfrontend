export type PaginatedResponse<T> = {
  results?: T[]
  count?: number
  next?: string | null
  previous?: string | null
}

export function normalizeList<T>(data: T[] | PaginatedResponse<T>): T[] {
  if (Array.isArray(data)) {
    return data
  }
  return data.results ?? []
}
