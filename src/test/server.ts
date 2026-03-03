import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('http://localhost:8000/api/v1/test/', () => HttpResponse.json({ ok: true })),
]

export const server = setupServer(...handlers)
