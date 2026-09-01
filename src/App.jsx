import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_BASE_URL, createFoldertaskClient } from './api.js'
import './App.css'

const API_KEY_STORAGE = 'foldertaskApiKey'
const ROOT_FOLDER = 'all'
const UNFILED_FOLDER = 'unfiled'

const emptyTaskDraft = {
  title: '',
  description: '',
  due_date: '',
  folder_id: '',
}

function App() {
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem(API_KEY_STORAGE) || '',
  )
  const [keyDraft, setKeyDraft] = useState(apiKey)
  const [folders, setFolders] = useState([])
  const [tasks, setTasks] = useState([])
  const [pagination, setPagination] = useState(null)
  const [selectedFolderId, setSelectedFolderId] = useState(ROOT_FOLDER)
  const [statusFilter, setStatusFilter] = useState('open')
  const [dueFilter, setDueFilter] = useState('all')
  const [taskDraft, setTaskDraft] = useState(emptyTaskDraft)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [folderDraft, setFolderDraft] = useState('')
  const [renamingFolderId, setRenamingFolderId] = useState(null)
  const [folderNameDraft, setFolderNameDraft] = useState('')
  const [folderParentDraft, setFolderParentDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const client = useMemo(() => createFoldertaskClient(apiKey), [apiKey])
  const folderTree = useMemo(() => buildFolderTree(folders), [folders])
  const flatFolders = useMemo(() => flattenFolders(folderTree), [folderTree])
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId)
  const filteredTasks = useMemo(
    () => applyDueFilter(tasks, dueFilter),
    [dueFilter, tasks],
  )
  const openTaskCount = tasks.filter((task) => !task.completed).length
  const completedTaskCount = tasks.length - openTaskCount

  const loadData = useCallback(async () => {
    if (!apiKey) {
      setFolders([])
      setTasks([])
      setPagination(null)
      return
    }

    setLoading(true)
    setError('')

    try {
      const taskParams = {
        limit: 100,
        offset: 0,
        completed:
          statusFilter === 'all' ? undefined : statusFilter === 'completed',
        folder_id:
          selectedFolderId === ROOT_FOLDER || selectedFolderId === UNFILED_FOLDER
            ? undefined
            : selectedFolderId,
      }

      const [folderList, taskList] = await Promise.all([
        client.listFolders(),
        client.listTasks(taskParams),
      ])

      const remoteTasks =
        selectedFolderId === UNFILED_FOLDER
          ? taskList.tasks.filter((task) => !task.folder_id)
          : taskList.tasks

      setFolders(folderList)
      setTasks(remoteTasks)
      setPagination(taskList.pagination)
    } catch (apiError) {
      setError(formatApiError(apiError))
    } finally {
      setLoading(false)
    }
  }, [apiKey, client, selectedFolderId, statusFilter])

  useEffect(() => {
    const loadTimer = window.setTimeout(loadData, 0)
    return () => window.clearTimeout(loadTimer)
  }, [loadData])

  function saveApiKey(event) {
    event.preventDefault()
    const trimmedKey = keyDraft.trim()

    if (trimmedKey) {
      localStorage.setItem(API_KEY_STORAGE, trimmedKey)
    } else {
      localStorage.removeItem(API_KEY_STORAGE)
    }

    setApiKey(trimmedKey)
    setNotice(trimmedKey ? 'API key saved.' : 'API key cleared.')
    setError('')
  }

  function clearApiKey() {
    localStorage.removeItem(API_KEY_STORAGE)
    setApiKey('')
    setKeyDraft('')
    setNotice('API key cleared.')
    setError('')
  }

  async function runAction(actionName, action) {
    setSaving(actionName)
    setError('')
    setNotice('')

    try {
      const message = await action()
      if (message) {
        setNotice(message)
      }
      await loadData()
    } catch (apiError) {
      setError(formatApiError(apiError))
      await loadData()
    } finally {
      setSaving('')
    }
  }

  async function createTask(event) {
    event.preventDefault()
    const title = taskDraft.title.trim()

    if (!title) {
      setError('Task title is required.')
      return
    }

    await runAction('create-task', async () => {
      await client.createTask({
        title,
        description: taskDraft.description.trim() || undefined,
        due_date: taskDraft.due_date || undefined,
        folder_id: taskDraft.folder_id || undefined,
        completed: false,
      })
      setTaskDraft(emptyTaskDraft)
      return 'Task created.'
    })
  }

  async function updateTask(event) {
    event.preventDefault()
    const task = tasks.find((item) => item.id === editingTaskId)
    const title = taskDraft.title.trim()

    if (!task || !title) {
      setError('Task title is required.')
      return
    }

    await runAction('update-task', async () => {
      await client.updateTask(task.id, {
        title,
        description: taskDraft.description.trim() || null,
        due_date: taskDraft.due_date || null,
        folder_id: taskDraft.folder_id || null,
        completed: task.completed,
      })
      cancelTaskEdit()
      return 'Task updated.'
    })
  }

  function beginTaskEdit(task) {
    setEditingTaskId(task.id)
    setTaskDraft({
      title: task.title || '',
      description: task.description || '',
      due_date: toDateInputValue(task.due_date),
      folder_id: task.folder_id || '',
    })
  }

  function cancelTaskEdit() {
    setEditingTaskId(null)
    setTaskDraft(emptyTaskDraft)
  }

  async function toggleTask(task) {
    setTasks((currentTasks) =>
      currentTasks.map((item) =>
        item.id === task.id ? { ...item, completed: !item.completed } : item,
      ),
    )

    await runAction(`toggle-${task.id}`, async () => {
      await client.updateTask(task.id, { completed: !task.completed })
      return task.completed ? 'Task reopened.' : 'Task completed.'
    })
  }

  async function deleteTask(task) {
    await runAction(`delete-${task.id}`, async () => {
      await client.deleteTask(task.id)
      if (editingTaskId === task.id) {
        cancelTaskEdit()
      }
      return 'Task deleted.'
    })
  }

  async function uploadTaskImage(task, image) {
    if (!image) {
      return
    }

    await runAction(`image-${task.id}`, async () => {
      await client.uploadTaskImage(task.id, image)
      return 'Image uploaded.'
    })
  }

  async function removeTaskImage(task) {
    await runAction(`remove-image-${task.id}`, async () => {
      await client.removeTaskImage(task.id)
      return 'Image removed.'
    })
  }

  async function createFolder(event) {
    event.preventDefault()
    const name = folderDraft.trim()

    if (!name) {
      setError('Folder name is required.')
      return
    }

    await runAction('create-folder', async () => {
      await client.createFolder({
        name,
        parent_id: selectedFolder?.id || undefined,
      })
      setFolderDraft('')
      return 'Folder created.'
    })
  }

  async function updateFolder(event) {
    event.preventDefault()
    const folder = folders.find((item) => item.id === renamingFolderId)
    const name = folderNameDraft.trim()

    if (!folder || !name) {
      setError('Folder name is required.')
      return
    }

    await runAction('rename-folder', async () => {
      await client.updateFolder(folder.id, {
        name,
        parent_id: folderParentDraft || null,
      })
      setRenamingFolderId(null)
      setFolderNameDraft('')
      setFolderParentDraft('')
      return 'Folder saved.'
    })
  }

  async function deleteFolder(folder) {
    await runAction(`delete-folder-${folder.id}`, async () => {
      await client.deleteFolder(folder.id)
      if (selectedFolderId === folder.id) {
        setSelectedFolderId(ROOT_FOLDER)
      }
      return 'Folder deleted.'
    })
  }

  function beginFolderRename(folder) {
    setRenamingFolderId(folder.id)
    setFolderNameDraft(folder.name || '')
    setFolderParentDraft(folder.parent_id || '')
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand" aria-label="Foldertask todo">
          <span className="brand-mark" aria-hidden="true">
            F
          </span>
          <div>
            <strong>Foldertask</strong>
            <span>{API_BASE_URL.replace(/^https?:\/\//, '')}</span>
          </div>
        </div>

        <form className="key-form" onSubmit={saveApiKey}>
          <label htmlFor="api-key">API key</label>
          <input
            id="api-key"
            type="password"
            value={keyDraft}
            onChange={(event) => setKeyDraft(event.target.value)}
            placeholder="X-API-Key"
            autoComplete="off"
          />
          <button type="submit">{apiKey ? 'Update' : 'Connect'}</button>
          {apiKey ? (
            <button className="ghost-button" type="button" onClick={clearApiKey}>
              Clear
            </button>
          ) : null}
        </form>
      </header>

      <main className="workspace">
        {!apiKey ? (
          <ApiKeyEmptyState />
        ) : (
          <>
            <FolderSidebar
              folderDraft={folderDraft}
              folderTree={folderTree}
              onCreateFolder={createFolder}
              onDeleteFolder={deleteFolder}
              onFolderDraftChange={setFolderDraft}
              onRenameFolder={beginFolderRename}
              onSelectFolder={setSelectedFolderId}
              openTaskCount={openTaskCount}
              renamingFolderId={renamingFolderId}
              selectedFolderId={selectedFolderId}
              saving={saving}
              unfiledCount={tasks.filter((task) => !task.folder_id).length}
            />

            <section className="task-workbench" aria-label="Todo tasks">
              <StatusBar
                completedTaskCount={completedTaskCount}
                error={error}
                loading={loading}
                notice={notice}
                openTaskCount={openTaskCount}
                pagination={pagination}
                selectedFolder={selectedFolder}
                selectedFolderId={selectedFolderId}
              />

              <div className="toolbar">
                <label>
                  Status
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="open">Open</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
                <label>
                  Due
                  <select
                    value={dueFilter}
                    onChange={(event) => setDueFilter(event.target.value)}
                  >
                    <option value="all">Any time</option>
                    <option value="overdue">Overdue</option>
                    <option value="today">Today</option>
                    <option value="upcoming">Upcoming</option>
                  </select>
                </label>
                <button type="button" onClick={loadData} disabled={loading}>
                  {loading ? 'Refreshing' : 'Refresh'}
                </button>
              </div>

              {renamingFolderId ? (
              <FolderEditForm
                  flatFolders={flatFolders}
                  folderNameDraft={folderNameDraft}
                  folderParentDraft={folderParentDraft}
                  onCancel={() => {
                    setRenamingFolderId(null)
                    setFolderParentDraft('')
                  }}
                  onFolderNameDraftChange={setFolderNameDraft}
                  onFolderParentDraftChange={setFolderParentDraft}
                  onUpdateFolder={updateFolder}
                  renamingFolderId={renamingFolderId}
                  saving={saving === 'rename-folder'}
                />
              ) : null}

              <TaskForm
                editingTaskId={editingTaskId}
                flatFolders={flatFolders}
                onCancelEdit={cancelTaskEdit}
                onCreateTask={createTask}
                onDraftChange={setTaskDraft}
                onUpdateTask={updateTask}
                saving={saving}
                selectedFolderId={selectedFolderId}
                taskDraft={taskDraft}
              />

              <TaskList
                flatFolders={flatFolders}
                loading={loading}
                onDeleteTask={deleteTask}
                onEditTask={beginTaskEdit}
                onRemoveTaskImage={removeTaskImage}
                onToggleTask={toggleTask}
                onUploadTaskImage={uploadTaskImage}
                saving={saving}
                tasks={filteredTasks}
              />
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function ApiKeyEmptyState() {
  return (
    <section className="empty-connect">
      <p className="eyebrow">Foldertask API</p>
      <h1>Connect your task workspace.</h1>
      <p className="lead">
        Enter an API key in the header to load folders, tasks, due dates, and
        task images from the Foldertask public API.
      </p>
    </section>
  )
}

function FolderSidebar({
  folderDraft,
  folderTree,
  onCreateFolder,
  onDeleteFolder,
  onFolderDraftChange,
  onRenameFolder,
  onSelectFolder,
  openTaskCount,
  renamingFolderId,
  selectedFolderId,
  saving,
  unfiledCount,
}) {
  return (
    <aside className="folder-sidebar" aria-label="Folders">
      <div className="sidebar-heading">
        <div>
          <span>Folders</span>
          <strong>{openTaskCount} open</strong>
        </div>
      </div>

      <div className="folder-list">
        <button
          className={selectedFolderId === ROOT_FOLDER ? 'folder-row active' : 'folder-row'}
          type="button"
          onClick={() => onSelectFolder(ROOT_FOLDER)}
        >
          <span>All tasks</span>
        </button>
        <button
          className={
            selectedFolderId === UNFILED_FOLDER ? 'folder-row active' : 'folder-row'
          }
          type="button"
          onClick={() => onSelectFolder(UNFILED_FOLDER)}
        >
          <span>Unfiled</span>
          <small>{unfiledCount}</small>
        </button>
        {folderTree.map((folder) => (
          <FolderNode
            folder={folder}
            key={folder.id}
            level={0}
            onDeleteFolder={onDeleteFolder}
            onRenameFolder={onRenameFolder}
            onSelectFolder={onSelectFolder}
            renamingFolderId={renamingFolderId}
            selectedFolderId={selectedFolderId}
          />
        ))}
      </div>

      <form className="folder-form" onSubmit={onCreateFolder}>
        <label htmlFor="new-folder">New folder</label>
        <div>
          <input
            id="new-folder"
            type="text"
            value={folderDraft}
            onChange={(event) => onFolderDraftChange(event.target.value)}
            placeholder="Folder name"
          />
          <button type="submit" disabled={saving === 'create-folder'}>
            Add
          </button>
        </div>
      </form>
    </aside>
  )
}

function FolderNode({
  folder,
  level,
  onDeleteFolder,
  onRenameFolder,
  onSelectFolder,
  renamingFolderId,
  selectedFolderId,
}) {
  return (
    <div>
      <div className="folder-node" style={{ '--level': level }}>
        <button
          className={selectedFolderId === folder.id ? 'folder-row active' : 'folder-row'}
          type="button"
          onClick={() => onSelectFolder(folder.id)}
        >
          <span>{folder.name}</span>
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={() => onRenameFolder(folder)}
          aria-label={`Rename ${folder.name}`}
          title="Rename folder"
        >
          Edit
        </button>
        <button
          className="icon-button danger"
          type="button"
          onClick={() => onDeleteFolder(folder)}
          aria-label={`Delete ${folder.name}`}
          title="Delete folder"
          disabled={renamingFolderId === folder.id}
        >
          Del
        </button>
      </div>
      {folder.children.map((child) => (
        <FolderNode
          folder={child}
          key={child.id}
          level={level + 1}
          onDeleteFolder={onDeleteFolder}
          onRenameFolder={onRenameFolder}
          onSelectFolder={onSelectFolder}
          renamingFolderId={renamingFolderId}
          selectedFolderId={selectedFolderId}
        />
      ))}
    </div>
  )
}

function StatusBar({
  completedTaskCount,
  error,
  loading,
  notice,
  openTaskCount,
  pagination,
  selectedFolder,
  selectedFolderId,
}) {
  const title =
    selectedFolderId === ROOT_FOLDER
      ? 'All tasks'
      : selectedFolderId === UNFILED_FOLDER
        ? 'Unfiled tasks'
        : selectedFolder?.name || 'Folder'

  return (
    <div className="status-bar">
      <div>
        <p className="eyebrow">Todo workspace</p>
        <h1>{title}</h1>
        <p>
          {openTaskCount} open, {completedTaskCount} completed
          {pagination?.total !== undefined ? `, ${pagination.total} total` : ''}
        </p>
      </div>
      <div className="status-messages" aria-live="polite">
        {loading ? <span className="pill">Loading</span> : null}
        {notice ? <span className="pill success">{notice}</span> : null}
        {error ? <span className="pill error">{error}</span> : null}
      </div>
    </div>
  )
}

function FolderEditForm({
  flatFolders,
  folderNameDraft,
  folderParentDraft,
  onCancel,
  onFolderNameDraftChange,
  onFolderParentDraftChange,
  onUpdateFolder,
  renamingFolderId,
  saving,
}) {
  const parentOptions = flatFolders.filter(
    (folder) => folder.id !== renamingFolderId,
  )

  return (
    <form className="inline-editor" onSubmit={onUpdateFolder}>
      <label htmlFor="folder-name">Rename folder</label>
      <input
        id="folder-name"
        type="text"
        value={folderNameDraft}
        onChange={(event) => onFolderNameDraftChange(event.target.value)}
      />
      <label htmlFor="folder-parent">Parent</label>
      <select
        id="folder-parent"
        value={folderParentDraft}
        onChange={(event) => onFolderParentDraftChange(event.target.value)}
      >
        <option value="">Top level</option>
        {parentOptions.map((folder) => (
          <option key={folder.id} value={folder.id}>
            {`${'--'.repeat(folder.level)} ${folder.name}`.trim()}
          </option>
        ))}
      </select>
      <button type="submit" disabled={saving}>
        Save
      </button>
      <button className="ghost-button" type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  )
}

function TaskForm({
  editingTaskId,
  flatFolders,
  onCancelEdit,
  onCreateTask,
  onDraftChange,
  onUpdateTask,
  saving,
  selectedFolderId,
  taskDraft,
}) {
  const isEditing = Boolean(editingTaskId)
  const submitLabel = isEditing ? 'Save task' : 'Add task'

  useEffect(() => {
    if (!isEditing && selectedFolderId !== ROOT_FOLDER) {
      onDraftChange((currentDraft) => ({
        ...currentDraft,
        folder_id: selectedFolderId === UNFILED_FOLDER ? '' : selectedFolderId,
      }))
    }
  }, [isEditing, onDraftChange, selectedFolderId])

  function updateDraft(field, value) {
    onDraftChange((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }))
  }

  return (
    <form
      className="task-form"
      onSubmit={isEditing ? onUpdateTask : onCreateTask}
    >
      <div className="form-grid">
        <label>
          Title
          <input
            type="text"
            value={taskDraft.title}
            onChange={(event) => updateDraft('title', event.target.value)}
            placeholder="What needs doing?"
          />
        </label>
        <label>
          Due date
          <input
            type="date"
            value={taskDraft.due_date}
            onChange={(event) => updateDraft('due_date', event.target.value)}
          />
        </label>
        <label>
          Folder
          <select
            value={taskDraft.folder_id}
            onChange={(event) => updateDraft('folder_id', event.target.value)}
          >
            <option value="">Unfiled</option>
            {flatFolders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {`${'--'.repeat(folder.level)} ${folder.name}`.trim()}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Description
        <textarea
          value={taskDraft.description}
          onChange={(event) => updateDraft('description', event.target.value)}
          placeholder="Optional notes"
        />
      </label>
      <div className="form-actions">
        <button
          type="submit"
          disabled={saving === 'create-task' || saving === 'update-task'}
        >
          {saving === 'create-task' || saving === 'update-task'
            ? 'Saving'
            : submitLabel}
        </button>
        {isEditing ? (
          <button className="ghost-button" type="button" onClick={onCancelEdit}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}

function TaskList({
  flatFolders,
  loading,
  onDeleteTask,
  onEditTask,
  onRemoveTaskImage,
  onToggleTask,
  onUploadTaskImage,
  saving,
  tasks,
}) {
  if (loading && tasks.length === 0) {
    return <div className="empty-state">Loading tasks...</div>
  }

  if (tasks.length === 0) {
    return (
      <div className="empty-state">
        <h2>No tasks here</h2>
        <p>Create a task or adjust your filters to see more work.</p>
      </div>
    )
  }

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskCard
          flatFolders={flatFolders}
          key={task.id}
          onDeleteTask={onDeleteTask}
          onEditTask={onEditTask}
          onRemoveTaskImage={onRemoveTaskImage}
          onToggleTask={onToggleTask}
          onUploadTaskImage={onUploadTaskImage}
          saving={saving}
          task={task}
        />
      ))}
    </ul>
  )
}

function TaskCard({
  flatFolders,
  onDeleteTask,
  onEditTask,
  onRemoveTaskImage,
  onToggleTask,
  onUploadTaskImage,
  saving,
  task,
}) {
  const folder = flatFolders.find((item) => item.id === task.folder_id)
  const dueLabel = formatDueDate(task.due_date)
  const isBusy = saving.endsWith(task.id)

  return (
    <li className={task.completed ? 'task-card completed' : 'task-card'}>
      <div className="task-card-main">
        <button
          className={task.completed ? 'check-button done' : 'check-button'}
          type="button"
          onClick={() => onToggleTask(task)}
          aria-label={
            task.completed
              ? `Mark ${task.title} incomplete`
              : `Mark ${task.title} complete`
          }
          disabled={isBusy}
        >
          {task.completed ? 'Done' : ''}
        </button>
        <div>
          <h2>{task.title}</h2>
          {task.description ? <p>{task.description}</p> : null}
          <div className="meta-row">
            <span>{folder?.name || 'Unfiled'}</span>
            {dueLabel ? <span>{dueLabel}</span> : null}
            <span>{task.completed ? 'Completed' : 'Open'}</span>
          </div>
        </div>
      </div>

      {task.image_url ? (
        <img className="task-image" src={task.image_url} alt="" />
      ) : null}

      <div className="task-actions">
        <label className="file-button">
          Image
          <input
            type="file"
            accept="image/*"
            onChange={(event) => onUploadTaskImage(task, event.target.files[0])}
            disabled={isBusy}
          />
        </label>
        {task.image_url ? (
          <button type="button" onClick={() => onRemoveTaskImage(task)}>
            Remove image
          </button>
        ) : null}
        <button type="button" onClick={() => onEditTask(task)}>
          Edit
        </button>
        <button
          className="danger-button"
          type="button"
          onClick={() => onDeleteTask(task)}
        >
          Delete
        </button>
      </div>
    </li>
  )
}

function buildFolderTree(folders) {
  const byId = new Map(
    folders.map((folder) => [folder.id, { ...folder, children: [] }]),
  )
  const roots = []

  byId.forEach((folder) => {
    if (folder.parent_id && byId.has(folder.parent_id)) {
      byId.get(folder.parent_id).children.push(folder)
    } else {
      roots.push(folder)
    }
  })

  const sortFolders = (items) => {
    items.sort((first, second) => first.name.localeCompare(second.name))
    items.forEach((item) => sortFolders(item.children))
  }

  sortFolders(roots)
  return roots
}

function flattenFolders(folders, level = 0) {
  return folders.flatMap((folder) => [
    { ...folder, level },
    ...flattenFolders(folder.children, level + 1),
  ])
}

function applyDueFilter(tasks, dueFilter) {
  const today = new Date()
  const todayValue = toDateInputValue(today.toISOString())

  if (dueFilter === 'all') {
    return tasks
  }

  return tasks.filter((task) => {
    const dueValue = toDateInputValue(task.due_date)

    if (!dueValue) {
      return false
    }

    if (dueFilter === 'today') {
      return dueValue === todayValue
    }

    if (dueFilter === 'overdue') {
      return dueValue < todayValue && !task.completed
    }

    return dueValue > todayValue
  })
}

function toDateInputValue(value) {
  if (!value) {
    return ''
  }

  return value.slice(0, 10)
}

function formatDueDate(value) {
  const dateValue = toDateInputValue(value)

  if (!dateValue) {
    return ''
  }

  return `Due ${dateValue}`
}

function formatApiError(error) {
  if (error.status === 401) {
    return 'API key is missing, invalid, or revoked.'
  }

  if (error.status === 413) {
    return 'Image is too large for the API.'
  }

  if (error.status === 415) {
    return 'Unsupported image type.'
  }

  return error.message || 'Something went wrong.'
}

export default App
