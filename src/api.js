const DEFAULT_API_BASE_URL = 'https://folder-todo-nest.lovable.app'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || DEFAULT_API_BASE_URL

class FoldertaskApiError extends Error {
  constructor(message, { status, details } = {}) {
    super(message)
    this.name = 'FoldertaskApiError'
    this.status = status
    this.details = details
  }
}

function unwrapData(payload) {
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data
  }

  return payload
}

function buildQuery(params = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  })

  const queryString = query.toString()
  return queryString ? `?${queryString}` : ''
}

async function parseResponse(response) {
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    const apiMessage =
      payload?.error?.message || payload?.message || response.statusText

    throw new FoldertaskApiError(apiMessage, {
      status: response.status,
      details: payload,
    })
  }

  return payload
}

export function createFoldertaskClient(apiKey) {
  async function request(path, options = {}) {
    if (!apiKey) {
      throw new FoldertaskApiError('Enter an API key to connect Foldertask.', {
        status: 401,
      })
    }

    const headers = new Headers(options.headers)
    headers.set('X-API-Key', apiKey)

    if (options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json')
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    })

    return parseResponse(response)
  }

  function jsonRequest(path, method, body) {
    return request(path, {
      method,
      body: JSON.stringify(body),
    }).then(unwrapData)
  }

  return {
    async listFolders(params = {}) {
      const payload = await request(
        `/api/public/v1/folders${buildQuery(params)}`,
      )
      return unwrapData(payload) || []
    },

    createFolder(input) {
      return jsonRequest('/api/public/v1/folders', 'POST', input)
    },

    updateFolder(id, input) {
      return jsonRequest(`/api/public/v1/folders/${id}`, 'PATCH', input)
    },

    deleteFolder(id) {
      return request(`/api/public/v1/folders/${id}`, {
        method: 'DELETE',
      }).then(unwrapData)
    },

    async listTasks(params = {}) {
      const payload = await request(`/api/public/v1/tasks${buildQuery(params)}`)
      return {
        tasks: payload?.data || [],
        pagination: payload?.pagination || null,
      }
    },

    createTask(input) {
      return jsonRequest('/api/public/v1/tasks', 'POST', input)
    },

    updateTask(id, input) {
      return jsonRequest(`/api/public/v1/tasks/${id}`, 'PATCH', input)
    },

    deleteTask(id) {
      return request(`/api/public/v1/tasks/${id}`, {
        method: 'DELETE',
      }).then(unwrapData)
    },

    uploadTaskImage(id, image) {
      const body = new FormData()
      body.set('image', image)

      return request(`/api/public/v1/tasks/${id}/image`, {
        method: 'POST',
        body,
      }).then(unwrapData)
    },

    removeTaskImage(id) {
      return request(`/api/public/v1/tasks/${id}/image`, {
        method: 'DELETE',
      }).then(unwrapData)
    },
  }
}

export { FoldertaskApiError }
