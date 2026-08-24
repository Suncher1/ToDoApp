import { useEffect, useMemo, useState } from 'react'
import './App.css'

const routes = {
  home: '#/',
  todos: '#/todos',
  about: '#/about',
}

const initialTasks = [
  {
    id: 1,
    title: 'Map the first real workflow',
    note: 'Capture what the app should help you finish every day.',
    completed: false,
  },
  {
    id: 2,
    title: 'Sketch priority states',
    note: 'Decide what belongs in today, later, and done.',
    completed: false,
  },
  {
    id: 3,
    title: 'Review the skeleton',
    note: 'Try navigation, task entry, completion, and delete.',
    completed: true,
  },
]

function getRouteFromHash() {
  const hash = window.location.hash || routes.home
  return Object.values(routes).includes(hash) ? hash : routes.home
}

function App() {
  const [currentRoute, setCurrentRoute] = useState(getRouteFromHash)
  const [tasks, setTasks] = useState(initialTasks)
  const [draftTask, setDraftTask] = useState('')

  useEffect(() => {
    const handleHashChange = () => setCurrentRoute(getRouteFromHash())

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const openTasks = useMemo(
    () => tasks.filter((task) => !task.completed).length,
    [tasks],
  )

  function addTask(event) {
    event.preventDefault()

    const title = draftTask.trim()
    if (!title) {
      return
    }

    setTasks((currentTasks) => [
      {
        id: Date.now(),
        title,
        note: 'New task',
        completed: false,
      },
      ...currentTasks,
    ])
    setDraftTask('')
  }

  function toggleTask(taskId) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task,
      ),
    )
  }

  function deleteTask(taskId) {
    setTasks((currentTasks) =>
      currentTasks.filter((task) => task.id !== taskId),
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href={routes.home} aria-label="Tasklet home">
          <span className="brand-mark" aria-hidden="true">
            T
          </span>
          <span>Tasklet</span>
        </a>
        <nav className="main-nav" aria-label="Primary navigation">
          <NavLink route={routes.home} currentRoute={currentRoute}>
            Home
          </NavLink>
          <NavLink route={routes.todos} currentRoute={currentRoute}>
            To Dos
          </NavLink>
          <NavLink route={routes.about} currentRoute={currentRoute}>
            About
          </NavLink>
        </nav>
      </header>

      <main className="page-frame">
        {currentRoute === routes.home && <LandingPage openTasks={openTasks} />}
        {currentRoute === routes.todos && (
          <TodoPage
            draftTask={draftTask}
            onAddTask={addTask}
            onDeleteTask={deleteTask}
            onDraftTaskChange={setDraftTask}
            onToggleTask={toggleTask}
            openTasks={openTasks}
            tasks={tasks}
          />
        )}
        {currentRoute === routes.about && <AboutPage />}
      </main>
    </div>
  )
}

function NavLink({ children, currentRoute, route }) {
  return (
    <a
      className={currentRoute === route ? 'nav-link active' : 'nav-link'}
      href={route}
    >
      {children}
    </a>
  )
}

function LandingPage({ openTasks }) {
  return (
    <section className="landing-page page-section">
      <div className="hero-copy">
        <p className="eyebrow">Simple task planning</p>
        <h1>Give today a clear shape.</h1>
        <p className="lead">
          Tasklet is a lightweight to-do skeleton for collecting work, marking
          progress, and leaving space for the app to grow.
        </p>
        <div className="hero-actions">
          <a className="button primary-button" href={routes.todos}>
            Open list
          </a>
          <a className="button secondary-button" href={routes.about}>
            About this app
          </a>
        </div>
      </div>

      <aside className="status-panel" aria-label="Today snapshot">
        <span className="panel-label">Today</span>
        <strong>{openTasks} open tasks</strong>
        <p>Start from the sample list, then add the next thing on your mind.</p>
      </aside>
    </section>
  )
}

function TodoPage({
  draftTask,
  onAddTask,
  onDeleteTask,
  onDraftTaskChange,
  onToggleTask,
  openTasks,
  tasks,
}) {
  return (
    <section className="page-section stack-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Your list</p>
          <h1>To dos</h1>
        </div>
        <div className="task-count">
          <span>{openTasks}</span>
          open
        </div>
      </div>

      <form className="task-form" onSubmit={onAddTask}>
        <label className="sr-only" htmlFor="new-task">
          New task
        </label>
        <input
          id="new-task"
          type="text"
          placeholder="Add a task..."
          value={draftTask}
          onChange={(event) => onDraftTaskChange(event.target.value)}
        />
        <button type="submit">Add task</button>
      </form>

      {tasks.length > 0 ? (
        <ul className="task-list">
          {tasks.map((task) => (
            <li className="task-item" key={task.id}>
              <button
                className={task.completed ? 'check-button done' : 'check-button'}
                type="button"
                onClick={() => onToggleTask(task.id)}
                aria-label={
                  task.completed
                    ? `Mark ${task.title} incomplete`
                    : `Mark ${task.title} complete`
                }
              >
                {task.completed ? '✓' : ''}
              </button>
              <div className="task-content">
                <span className={task.completed ? 'task-title done' : 'task-title'}>
                  {task.title}
                </span>
                <span className="task-note">{task.note}</span>
              </div>
              <button
                className="delete-button"
                type="button"
                onClick={() => onDeleteTask(task.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          <h2>No tasks yet</h2>
          <p>Add your first task to start shaping the day.</p>
        </div>
      )}
    </section>
  )
}

function AboutPage() {
  return (
    <section className="page-section stack-section about-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">About</p>
          <h1>About this app</h1>
        </div>
      </div>
      <p className="lead">
        Tasklet is the first pass at a calm, focused to-do app. This skeleton
        keeps the surface small: a landing page, a working list, and a place to
        describe the app as it evolves.
      </p>
      <div className="feature-grid">
        <article>
          <h2>Now</h2>
          <p>Hash navigation, sample tasks, local state, and basic actions.</p>
        </article>
        <article>
          <h2>Next</h2>
          <p>Persistence, due dates, filtering, and richer task detail.</p>
        </article>
        <article>
          <h2>Goal</h2>
          <p>A practical daily list that stays fast, clear, and easy to trust.</p>
        </article>
      </div>
    </section>
  )
}

export default App
