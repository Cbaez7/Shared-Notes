import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCheck, ChevronLeft, ChevronRight, Circle, Clock3, Folder as FolderIcon, FolderOpen, ListTodo, Plus, Search, Settings2, Trash2 } from 'lucide-react';
import { api, AuthError, ConflictError } from './api';
import { localStore } from './db';
import type { Folder, Note, SyncState, Task, User } from './types';

type Theme = 'light' | 'dark';
function preferredTheme(): Theme { return localStorage.getItem('sharednotes-theme') === 'light' ? 'light' : 'dark'; }

const blankNote = (): Note => {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), folder_id: null, title: '', body: '', created_at: now, updated_at: now, deleted_at: null, dirty: true };
};

function noteTitle(note: Note): string { return note.title.trim() || 'Untitled note'; }
function excerpt(note: Note): string { return note.body.trim().replace(/\s+/g, ' ') || 'No additional text'; }
function relativeTime(value: string): string { const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000)); return minutes < 1 ? 'now' : minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.round(minutes / 60)}h` : new Date(value).toLocaleDateString(); }
type NoteTask = { line: number; text: string; done: boolean };
function parseTasks(body: string): NoteTask[] { return body.split('\n').flatMap((text, line) => { const match = text.match(/^- \[([ xX])\] (.+)$/); return match ? [{ line, text: match[2]!, done: match[1]!.toLowerCase() === 'x' }] : []; }); }

function ThemeButton({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return <button className="theme-toggle" onClick={onToggle} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? '◐' : '☼'}</button>;
}

function AuthScreen({ onAuthenticated, theme, onToggleTheme }: { onAuthenticated: (user: User) => void; theme: Theme; onToggleTheme: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setWorking(true); setError('');
    try { onAuthenticated(mode === 'login' ? await api.login(email, password) : await api.register(email, password)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Please try again.'); }
    finally { setWorking(false); }
  }
  return <main className="auth"><ThemeButton theme={theme} onToggle={onToggleTheme} /><section className="auth-card"><div className="brand-mark" aria-hidden="true">S</div><h1>SharedNotes</h1><p>Your writing, available wherever you are.</p><form onSubmit={submit}><label>Email<input required type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Password<input required minLength={8} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></label>{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={working}>{working ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button></form><button className="link-button" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button></section></main>;
}

export default function App() {
  const mobilePreview = new URLSearchParams(window.location.search).has('mobile-preview');
  const [user, setUser] = useState<User | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<'notes' | 'tasks'>('notes');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [taskInput, setTaskInput] = useState('');
  const [taskDetailId, setTaskDetailId] = useState<string | null>(null);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [reminderComposerOpen, setReminderComposerOpen] = useState(false);
  const [reminderTaskInput, setReminderTaskInput] = useState('');
  const [reminderSubtaskInput, setReminderSubtaskInput] = useState('');
  const [reminderDraftSubtasks, setReminderDraftSubtasks] = useState<string[]>([]);
  const [selectedReminderId, setSelectedReminderId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState<Theme>(preferredTheme);
  const [commandOpen, setCommandOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureText, setCaptureText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(() => localStorage.getItem('sharednotes-auto-sync') !== 'false');
  const [status, setStatus] = useState<SyncState>(navigator.onLine ? 'synced' : 'offline');
  const [mobileEditor, setMobileEditor] = useState(false);
  const notesRef = useRef<Note[]>([]);
  const foldersRef = useRef<Folder[]>([]);
  const tasksRef = useRef<Task[]>([]);
  const syncTimer = useRef<number | undefined>();
  const noteBodyRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { foldersRef.current = folders; }, [folders]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('sharednotes-theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('sharednotes-auto-sync', String(syncEnabled)); }, [syncEnabled]);

  const mergeServer = useCallback(async (remote: Omit<Note, 'dirty'>[]) => {
    setNotes((current) => {
      const byId = new Map(current.map((note) => [note.id, note]));
      remote.forEach((received) => {
        const local = byId.get(received.id);
        if (!local || !local.dirty || new Date(received.updated_at) >= new Date(local.updated_at)) byId.set(received.id, { ...received, dirty: false });
      });
      const next = [...byId.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      void Promise.all(next.map((note) => localStore.put(note)));
      return next;
    });
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine || !user) { setStatus('offline'); return; }
    setStatus('saving');
    try {
      const dirty = notesRef.current.filter((note) => note.dirty);
      for (const note of dirty) {
        try {
          const saved = note.deleted_at ? await api.delete(note) : await api.push(note);
          setNotes((current) => { const next = current.map((item) => item.id === saved.id ? { ...saved, dirty: false } : item); void localStore.put({ ...saved, dirty: false }); return next; });
        } catch (reason) {
          if (!(reason instanceof ConflictError) || !reason.note) throw reason;
          const serverNote = { ...reason.note, dirty: false };
          setNotes((current) => { const next = current.map((item) => item.id === serverNote.id ? serverNote : item); void localStore.put(serverNote); return next; });
        }
      }
      for (const folder of foldersRef.current.filter((item) => item.dirty && !item.deleted_at)) { const saved = await api.pushFolder(folder); setFolders((current) => { const next = current.map((item) => item.id === saved.id ? { ...saved, dirty: false } : item); void localStore.putFolder({ ...saved, dirty: false }); return next; }); }
      for (const task of tasksRef.current.filter((item) => item.dirty && !item.deleted_at)) { const saved = await api.pushTask(task); setTasks((current) => { const next = current.map((item) => item.id === saved.id ? { ...saved, dirty: false } : item); void localStore.putTask({ ...saved, dirty: false }); return next; }); }
      const since = await localStore.getMeta('lastSync');
      const delta = await api.pull(since);
      await mergeServer(delta.notes);
      const workspace = await api.workspace(since);
      setFolders((current) => { const byId = new Map(current.map((item) => [item.id, item])); workspace.folders.forEach((item) => { const local = byId.get(item.id); if (!local || !local.dirty || item.updated_at >= local.updated_at) byId.set(item.id, { ...item, dirty: false }); }); const next = [...byId.values()]; void Promise.all(next.map((item) => localStore.putFolder(item))); return next; });
      setTasks((current) => { const byId = new Map(current.map((item) => [item.id, item])); workspace.tasks.forEach((item) => { const local = byId.get(item.id); if (!local || !local.dirty || item.updated_at >= local.updated_at) byId.set(item.id, { ...item, dirty: false }); }); const next = [...byId.values()]; void Promise.all(next.map((item) => localStore.putTask(item))); return next; });
      await localStore.setMeta('lastSync', delta.serverTime);
      setStatus('synced');
    } catch (reason) {
      if (reason instanceof AuthError) setUser(null);
      setStatus(navigator.onLine ? 'offline' : 'offline');
    }
  }, [mergeServer, user]);

  useEffect(() => {
    api.me().then(setUser).catch(() => undefined);
    localStore.list().then((cached) => { const sorted = cached.sort((a, b) => b.updated_at.localeCompare(a.updated_at)); const visible = sorted.filter((note) => !note.deleted_at); setNotes(sorted); setActiveId(visible[0]?.id ?? null); }).catch(() => undefined);
    localStore.listFolders().then(setFolders).catch(() => undefined); localStore.listTasks().then(setTasks).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!user) return;
    void sync();
    const onOnline = () => void sync(); const onFocus = () => void sync();
    window.addEventListener('online', onOnline); window.addEventListener('focus', onFocus);
    const interval = syncEnabled ? window.setInterval(() => void sync(), 30000) : undefined;
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('focus', onFocus); if (interval) window.clearInterval(interval); };
  }, [sync, syncEnabled, user]);
  useEffect(() => () => window.clearTimeout(syncTimer.current), []);

  const visibleNotes = useMemo(() => notes.filter((note) => !note.deleted_at && (!folderId || note.folder_id === folderId) && `${note.title} ${note.body}`.toLowerCase().includes(query.toLowerCase())), [folderId, notes, query]);
  const active = notes.find((note) => note.id === activeId && !note.deleted_at) ?? null;
  useLayoutEffect(() => { const textarea = noteBodyRef.current; if (!textarea) return; textarea.style.height = 'auto'; textarea.style.height = `${textarea.scrollHeight}px`; }, [active?.body]);
  const noteTasks = useMemo(() => active ? parseTasks(active.body) : [], [active]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(true); } if (event.key === 'Escape') setCommandOpen(false); };
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  const saveChange = (patch: Partial<Pick<Note, 'title' | 'body' | 'folder_id'>>) => {
    if (!active) return;
    const changed = { ...active, ...patch, updated_at: new Date().toISOString(), dirty: true };
    setNotes((current) => { const next = current.map((note) => note.id === changed.id ? changed : note).sort((a, b) => b.updated_at.localeCompare(a.updated_at)); void localStore.put(changed); return next; });
    setStatus(navigator.onLine ? 'saving' : 'offline'); window.clearTimeout(syncTimer.current); syncTimer.current = window.setTimeout(() => void sync(), 800);
  };
  const createNote = () => { const note = { ...blankNote(), folder_id: folderId }; setNotes((current) => [note, ...current]); void localStore.put(note); setActiveId(note.id); setMobileEditor(true); setStatus(navigator.onLine ? 'saving' : 'offline'); window.setTimeout(() => void sync(), 0); };
  const deleteActive = () => { if (!active) return; const deleted = { ...active, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), dirty: true }; setNotes((current) => current.map((note) => note.id === deleted.id ? deleted : note)); void localStore.put(deleted); setActiveId(visibleNotes.find((note) => note.id !== active.id)?.id ?? null); setMobileEditor(false); window.setTimeout(() => void sync(), 0); };
  const toggleTheme = () => setTheme((current) => current === 'light' ? 'dark' : 'light');
  const pickCommand = (id: string) => { setActiveId(id); setQuery(''); setMobileEditor(true); setCommandOpen(false); };
  const quickCapture = () => {
    const lines = captureText.trim().split('\n');
    if (!lines[0]) return;
    const now = new Date().toISOString();
    const note: Note = { id: crypto.randomUUID(), folder_id: folderId, title: lines[0], body: lines.slice(1).join('\n').trim(), created_at: now, updated_at: now, deleted_at: null, dirty: true };
    setNotes((current) => [note, ...current]); void localStore.put(note); setActiveId(note.id); setMobileEditor(true); setStatus(navigator.onLine ? 'saving' : 'offline'); setCaptureText(''); setCaptureOpen(false); window.setTimeout(() => void sync(), 800);
  };
  const toggleTask = (line: number) => {
    if (!active) return;
    const body = active.body.split('\n').map((text, index) => index === line ? text.replace(/^- \[([ xX])\]/, (_match, checked: string) => `- [${checked.toLowerCase() === 'x' ? ' ' : 'x'}]`) : text).join('\n');
    saveChange({ body });
  };
  const activeIndex = visibleNotes.findIndex((note) => note.id === activeId);
  const moveNote = (step: number) => { const candidate = visibleNotes[activeIndex + step]; if (candidate) pickCommand(candidate.id); };
  const createFolder = () => { const name = window.prompt('Folder name'); if (!name?.trim()) return; const now = new Date().toISOString(); const folder: Folder = { id: crypto.randomUUID(), name: name.trim(), created_at: now, updated_at: now, deleted_at: null, dirty: true }; setFolders((current) => [...current, folder]); void localStore.putFolder(folder); setFolderId(folder.id); window.setTimeout(() => void sync(), 0); };
  const createTask = () => { if (!taskInput.trim()) return; const now = new Date().toISOString(); const task: Task = { id: crypto.randomUUID(), folder_id: folderId, note_id: null, title: taskInput.trim(), completed: false, subtasks: [], created_at: now, updated_at: now, deleted_at: null, dirty: true }; setTasks((current) => [task, ...current]); void localStore.putTask(task); setTaskInput(''); window.setTimeout(() => void sync(), 0); };
  const updateTask = (task: Task) => { const changed = { ...task, updated_at: new Date().toISOString(), dirty: true }; setTasks((current) => current.map((item) => item.id === changed.id ? changed : item)); void localStore.putTask(changed); window.setTimeout(() => void sync(), 0); };
  const activeTask = tasks.find((task) => task.id === taskDetailId && !task.deleted_at) ?? null;
  const addSubtask = () => { if (!activeTask || !subtaskInput.trim()) return; updateTask({ ...activeTask, subtasks: [...activeTask.subtasks, { id: crypto.randomUUID(), title: subtaskInput.trim(), completed: false }] }); setSubtaskInput(''); };
  const toggleSubtask = (subtaskId: string) => { if (!activeTask) return; updateTask({ ...activeTask, subtasks: activeTask.subtasks.map((subtask) => subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask) }); };
  const removeSubtask = (subtaskId: string) => { if (!activeTask) return; updateTask({ ...activeTask, subtasks: activeTask.subtasks.filter((subtask) => subtask.id !== subtaskId) }); };
  const workspaceTasks = tasks.filter((task) => !task.deleted_at && (!folderId || task.folder_id === folderId) && task.title.toLowerCase().includes(query.toLowerCase()));
  const noteTaskHistory = active ? tasks.filter((task) => !task.deleted_at && task.note_id === active.id) : [];
  const reminderTasks = noteTaskHistory.filter((task) => !task.completed).slice(0, 5);
  const selectedReminder = noteTaskHistory.find((task) => task.id === selectedReminderId) ?? null;
  const addReminderDraft = () => { if (!reminderSubtaskInput.trim()) return; setReminderDraftSubtasks((current) => [...current, reminderSubtaskInput.trim()]); setReminderSubtaskInput(''); };
  const createReminderTask = () => { if (!active || !reminderTaskInput.trim()) return; const now = new Date().toISOString(); const task: Task = { id: crypto.randomUUID(), folder_id: active.folder_id, note_id: active.id, title: reminderTaskInput.trim(), completed: false, subtasks: reminderDraftSubtasks.map((title) => ({ id: crypto.randomUUID(), title, completed: false })), created_at: now, updated_at: now, deleted_at: null, dirty: true }; setTasks((current) => [task, ...current]); void localStore.putTask(task); setReminderTaskInput(''); setReminderSubtaskInput(''); setReminderDraftSubtasks([]); setReminderComposerOpen(false); setSelectedReminderId(task.id); window.setTimeout(() => void sync(), 0); };
  const toggleReminderSubtask = (task: Task, subtaskId: string) => updateTask({ ...task, subtasks: task.subtasks.map((subtask) => subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask) });
  const removeReminderSubtask = (task: Task, subtaskId: string) => updateTask({ ...task, subtasks: task.subtasks.filter((subtask) => subtask.id !== subtaskId) });
  const addReminderSubtask = (task: Task) => { if (!reminderSubtaskInput.trim()) return; updateTask({ ...task, subtasks: [...task.subtasks, { id: crypto.randomUUID(), title: reminderSubtaskInput.trim(), completed: false }] }); setReminderSubtaskInput(''); };
  const openTask = (taskId: string) => { setView('tasks'); setTaskDetailId(taskId); setMobileEditor(true); };
  if (!user) return <AuthScreen onAuthenticated={setUser} theme={theme} onToggleTheme={toggleTheme} />;
  return <main className={`app ${mobileEditor ? 'editor-open' : ''} ${view === 'notes' ? 'notes-view' : ''} ${mobilePreview ? 'mobile-preview' : ''}`}>
    <aside className="sidebar">
      <header className="app-identity"><button className="brand-button" onClick={() => { setView('notes'); setTaskDetailId(null); }}><FolderOpen size={18} /><h1>SharedNotes</h1></button><div className="header-actions"><ThemeButton theme={theme} onToggle={toggleTheme} /><button className="new-button" onClick={createNote} aria-label="Create note"><Plus size={17} /></button><button className="profile-switcher" onClick={() => setSettingsOpen(true)} aria-label={`Open account settings for ${user.email}`} title={user.email}><b>{user.email.slice(0, 1).toUpperCase()}</b></button></div></header>
      <button className="search compact-ask" onClick={() => setCommandOpen(true)} aria-label="Open note search" aria-keyshortcuts="Control+K Meta+K"><Search size={16} /><span className="search-label">Search {view === 'notes' ? 'notes' : 'tasks'}</span><kbd>⌘K</kbd></button>
      <div className="workspace-tabs"><button className={view === 'notes' ? 'active' : ''} onClick={() => { setView('notes'); setTaskDetailId(null); }}><FolderIcon size={14} />Notes</button><button className={view === 'tasks' ? 'active' : ''} onClick={() => { setView('tasks'); setTaskDetailId(null); setFolderId(null); }}><ListTodo size={14} />To-do</button></div>
      <nav className="folder-tree" aria-label="Folders"><div><span>Folders</span><button onClick={createFolder} aria-label="Create folder"><Plus size={14} /></button></div><button className={!folderId ? 'selected' : ''} onClick={() => setFolderId(null)}><FolderIcon size={15} />All {view === 'notes' ? 'notes' : 'tasks'}</button>{folders.filter((folder) => !folder.deleted_at).map((folder) => <button className={folder.id === folderId ? 'selected' : ''} key={folder.id} onClick={() => setFolderId(folder.id)}><FolderIcon size={15} />{folder.name}</button>)}</nav>
      <div className="note-list">{view === 'notes' ? (visibleNotes.length ? visibleNotes.map((note) => <button key={note.id} className={`note-row ${note.id === activeId ? 'selected' : ''}`} onClick={() => { setActiveId(note.id); setMobileEditor(true); }}><strong>{noteTitle(note)}</strong><span>{excerpt(note)}</span><time>{relativeTime(note.updated_at)}</time></button>) : <p className="empty-list">No notes found</p>) : (workspaceTasks.length ? workspaceTasks.map((task) => <button key={task.id} className={`task-row ${task.completed ? 'done' : ''}`} onClick={() => openTask(task.id)}><i>{task.completed ? <Check size={12} /> : <Circle size={13} />}</i><span>{task.title}</span><small>{folders.find((folder) => folder.id === task.folder_id)?.name ?? 'Inbox'}</small></button>) : <p className="empty-list">No tasks here yet</p>)}</div>
    </aside>
    <section className="editor">{view === 'tasks' ? activeTask ? <div className="task-workspace"><header className="editor-head"><button className="back task-back" onClick={() => { setTaskDetailId(null); setMobileEditor(false); }}><ChevronLeft size={17} />To-do</button><span className={`sync mobile-sync ${status}`}><i />{status === 'synced' ? 'Synced' : status === 'saving' ? 'Saving…' : 'Offline'}</span><div className="editor-tools"><button className="tool-button" onClick={() => setTaskDetailId(null)} aria-label="Back to task history"><ChevronLeft size={17} /></button></div></header><article className="task-document"><div className="task-document-meta"><span>{folders.find((folder) => folder.id === activeTask.folder_id)?.name ?? 'Inbox'}</span><span><Clock3 size={13} />Updated {relativeTime(activeTask.updated_at)}</span></div><h2>{activeTask.title}</h2><button className={`task-close ${activeTask.completed ? 'reopen' : ''}`} onClick={() => updateTask({ ...activeTask, completed: !activeTask.completed })}>{activeTask.completed ? <><Circle size={15} />Reopen task</> : <><CheckCheck size={15} />Finish task</>}</button><section className="subtask-section"><div><strong>Subtasks</strong><span>{activeTask.subtasks.filter((subtask) => subtask.completed).length} of {activeTask.subtasks.length} complete</span></div>{activeTask.subtasks.map((subtask) => <div className="subtask-row" key={subtask.id}><label><input type="checkbox" checked={subtask.completed} onChange={() => toggleSubtask(subtask.id)} /><span>{subtask.title}</span></label><button onClick={() => removeSubtask(subtask.id)} aria-label={`Remove ${subtask.title}`}><Trash2 size={15} /></button></div>)}<form onSubmit={(event) => { event.preventDefault(); addSubtask(); }}><input autoFocus value={subtaskInput} onChange={(event) => setSubtaskInput(event.target.value)} placeholder="Add a subtask…" aria-label="Add a subtask" /><button className="primary"><Plus size={15} />Add subtask</button></form></section></article></div> : <div className="task-editor"><span className="eyebrow">TASK HISTORY</span><h2>All to-do</h2><p>Review every open and completed task. Note reminders stay attached to the note where they were created.</p><form onSubmit={(event) => { event.preventDefault(); createTask(); }}><input value={taskInput} onChange={(event) => setTaskInput(event.target.value)} placeholder="Add a standalone task…" aria-label="New task" /><button className="primary"><Plus size={15} />Add task</button></form><div className="task-summary"><strong>{workspaceTasks.filter((task) => !task.completed).length}</strong><span>open tasks</span></div></div> : active ? <>
      <header className="editor-head"><button className="back" onClick={() => setMobileEditor(false)}><ChevronLeft size={17} />Notes</button><span className={`sync mobile-sync ${status}`}><i />{status === 'synced' ? 'Synced' : status === 'saving' ? 'Saving…' : 'Offline'}</span>{status === 'saving' && <span className="arc-spinner" aria-label="Saving changes" />}<div className="editor-tools"><button className="tool-button" onClick={() => setChecklistOpen(true)} aria-label="Open checklist"><ListTodo size={17} /></button><button className="tool-button" onClick={() => setHistoryOpen(true)} aria-label="Open revision history"><Clock3 size={17} /></button><span className="back-next"><button disabled={activeIndex <= 0} onClick={() => moveNote(-1)} aria-label="Previous note"><ChevronLeft size={16} /></button><button disabled={activeIndex < 0 || activeIndex >= visibleNotes.length - 1} onClick={() => moveNote(1)} aria-label="Next note"><ChevronRight size={16} /></button></span><button className="delete" onClick={deleteActive} aria-label="Delete note"><Trash2 size={17} /></button></div></header>
      <div className="note-location"><label>Folder<select value={active.folder_id ?? ''} onChange={(event) => saveChange({ folder_id: event.target.value || null })}><option value="">Inbox</option>{folders.filter((folder) => !folder.deleted_at).map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label></div><input className="title" aria-label="Note title" placeholder="Untitled note" value={active.title} onChange={(e) => saveChange({ title: e.target.value })} /><textarea ref={noteBodyRef} aria-label="Note body" placeholder="Start writing…" value={active.body} onChange={(e) => saveChange({ body: e.target.value })} />
    </> : <div className="empty-editor"><div className="empty-icon"><FolderOpen size={22} /></div><h2>A quieter place to think.</h2><p>Create a note to start capturing what matters.</p><button className="primary" onClick={createNote}><Plus size={15} />Create note</button></div>}{view === 'notes' && <button className="floating-capture" onClick={() => setCaptureOpen(true)} aria-label="Quick capture"><Plus size={16} /><b>Capture</b></button>}</section>
    {view === 'notes' && <aside className="reminders-panel"><header><div><span>Reminders</span><small>{active ? noteTitle(active) : 'Select a note'}</small></div><button onClick={() => { setReminderComposerOpen(true); setSelectedReminderId(null); }} aria-label="Add reminder"><Plus size={18} /></button></header><section><h2>Open tasks</h2>{reminderTasks.length ? reminderTasks.map((task) => <button key={task.id} onClick={() => setSelectedReminderId(task.id)}><Circle size={15} /><span><strong>{task.title}</strong><small>{task.subtasks.length ? `${task.subtasks.filter((subtask) => subtask.completed).length}/${task.subtasks.length} subtasks` : 'No subtasks'}</small></span></button>) : <p>{active ? 'No open tasks for this note.' : 'Select a note to see its reminders.'}</p>}</section>{reminderComposerOpen && active && <form className="reminder-composer" onSubmit={(event) => { event.preventDefault(); createReminderTask(); }}><input autoFocus value={reminderTaskInput} onChange={(event) => setReminderTaskInput(event.target.value)} placeholder="New task" aria-label="New reminder task" /><div className="reminder-subtask-add"><input value={reminderSubtaskInput} onChange={(event) => setReminderSubtaskInput(event.target.value)} placeholder="Add a subtask" aria-label="New reminder subtask" /><button type="button" onClick={addReminderDraft} aria-label="Add subtask"><Plus size={14} /></button></div>{reminderDraftSubtasks.map((subtask, index) => <span className="draft-subtask" key={`${subtask}-${index}`}><Check size={13} />{subtask}<button type="button" onClick={() => setReminderDraftSubtasks((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${subtask}`}><Trash2 size={13} /></button></span>)}<div className="reminder-composer-actions"><button type="button" onClick={() => { setReminderComposerOpen(false); setReminderDraftSubtasks([]); }}>Cancel</button><button className="primary">Save task</button></div></form>}{selectedReminder && <section className="reminder-detail"><div><strong>{selectedReminder.title}</strong><button onClick={() => setSelectedReminderId(null)} aria-label="Close reminder detail">×</button></div><button className={`task-close ${selectedReminder.completed ? 'reopen' : ''}`} onClick={() => updateTask({ ...selectedReminder, completed: !selectedReminder.completed })}>{selectedReminder.completed ? <><Circle size={14} />Reopen</> : <><CheckCheck size={14} />Finish task</>}</button>{selectedReminder.subtasks.map((subtask) => <div className="reminder-subtask" key={subtask.id}><label><input type="checkbox" checked={subtask.completed} onChange={() => toggleReminderSubtask(selectedReminder, subtask.id)} /><span>{subtask.title}</span></label><button onClick={() => removeReminderSubtask(selectedReminder, subtask.id)} aria-label={`Remove ${subtask.title}`}><Trash2 size={13} /></button></div>)}<form onSubmit={(event) => { event.preventDefault(); addReminderSubtask(selectedReminder); }}><input value={reminderSubtaskInput} onChange={(event) => setReminderSubtaskInput(event.target.value)} placeholder="Add a subtask" aria-label="Add reminder subtask" /><button aria-label="Add subtask"><Plus size={14} /></button></form></section>}<footer><span><ListTodo size={15} />{noteTaskHistory.length} task{noteTaskHistory.length === 1 ? '' : 's'} on this note</span></footer></aside>}
    {commandOpen && <div className="command-backdrop" onMouseDown={() => setCommandOpen(false)}><section className="command-dock" role="dialog" aria-modal="true" aria-label="Find a note" onMouseDown={(event) => event.stopPropagation()}><div className="command-search"><span>⌕</span><input autoFocus aria-label="Find a note" placeholder="Find a note…" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>ESC</kbd></div><div className="command-results">{visibleNotes.length ? visibleNotes.map((note) => <button key={note.id} onClick={() => pickCommand(note.id)}><span><strong>{noteTitle(note)}</strong><small>{excerpt(note)}</small></span><time>{relativeTime(note.updated_at)}</time></button>) : <p>No matching notes</p>}</div><footer><span>Jump between notes</span><span>↵ Open</span></footer></section></div>}
    {captureOpen && <div className="command-backdrop" onMouseDown={() => setCaptureOpen(false)}><section className="capture-card" role="dialog" aria-modal="true" aria-label="Quick capture" onMouseDown={(event) => event.stopPropagation()}><span className="capture-eyebrow">QUICK CAPTURE</span><h2>What do you want to remember?</h2><textarea autoFocus value={captureText} onChange={(event) => setCaptureText(event.target.value)} placeholder="Title on the first line, then add any detail…" /><footer><span>Saved locally first</span><button className="primary neon-action" onClick={quickCapture}>Create note <b>↵</b></button></footer></section></div>}
    {reminderComposerOpen && active && <div className="command-backdrop" onMouseDown={() => { setReminderComposerOpen(false); setReminderDraftSubtasks([]); }}><section className="utility-card reminder-composer-card" role="dialog" aria-modal="true" aria-label="Add reminder" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="capture-eyebrow">REMINDER FOR</span><h2>{noteTitle(active)}</h2></div><button className="close-button" onClick={() => { setReminderComposerOpen(false); setReminderDraftSubtasks([]); }}>×</button></header><form className="reminder-composer" onSubmit={(event) => { event.preventDefault(); createReminderTask(); }}><input autoFocus value={reminderTaskInput} onChange={(event) => setReminderTaskInput(event.target.value)} placeholder="New task" aria-label="New reminder task" /><div className="reminder-subtask-add"><input value={reminderSubtaskInput} onChange={(event) => setReminderSubtaskInput(event.target.value)} placeholder="Add a subtask" aria-label="New reminder subtask" /><button type="button" onClick={addReminderDraft} aria-label="Add subtask"><Plus size={14} /></button></div>{reminderDraftSubtasks.map((subtask, index) => <span className="draft-subtask" key={`${subtask}-${index}`}><Check size={13} />{subtask}<button type="button" onClick={() => setReminderDraftSubtasks((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${subtask}`}><Trash2 size={13} /></button></span>)}<div className="reminder-composer-actions"><button type="button" onClick={() => { setReminderComposerOpen(false); setReminderDraftSubtasks([]); }}>Cancel</button><button className="primary">Save task</button></div></form></section></div>}
    {checklistOpen && <div className="command-backdrop" onMouseDown={() => setChecklistOpen(false)}><section className="utility-card" role="dialog" aria-modal="true" aria-label="Checklist" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="capture-eyebrow">TASK LIST</span><h2>{noteTitle(active!)}</h2></div><button className="close-button" onClick={() => setChecklistOpen(false)}>×</button></header>{noteTasks.length ? <div className="task-list">{noteTasks.map((task) => <label key={task.line}><input type="checkbox" checked={task.done} onChange={() => toggleTask(task.line)} /><span>{task.text}</span></label>)}</div> : <p className="utility-empty">Add lines like <code>- [ ] Prepare slides</code> to turn a note into a checklist.</p>}<footer><span>{noteTasks.filter((task) => task.done).length} of {noteTasks.length} complete</span></footer></section></div>}
    {historyOpen && <div className="command-backdrop" onMouseDown={() => setHistoryOpen(false)}><section className="utility-card history-card" role="dialog" aria-modal="true" aria-label="Revision history" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="capture-eyebrow">REVISION TRAIL</span><h2>{noteTitle(active!)}</h2></div><button className="close-button" onClick={() => setHistoryOpen(false)}>×</button></header><div className="activity-thread"><article><i>✦</i><div><strong>Note created</strong><span>{new Date(active!.created_at).toLocaleString()}</span></div></article><article><i>↻</i><div><strong>Last edited</strong><span>{new Date(active!.updated_at).toLocaleString()}</span></div></article><article><i className={status}>●</i><div><strong>{status === 'synced' ? 'Synced to SharedNotes' : status === 'saving' ? 'Saving changes' : 'Waiting for a connection'}</strong><span>Server-aware activity</span></div></article></div></section></div>}
    {settingsOpen && <div className="command-backdrop" onMouseDown={() => setSettingsOpen(false)}><section className="utility-card settings-card" role="dialog" aria-modal="true" aria-label="Settings" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="capture-eyebrow">ACCOUNT & SETTINGS</span><h2>SharedNotes preferences</h2></div><button className="close-button" onClick={() => setSettingsOpen(false)}>×</button></header><div className="settings-group"><span>Signed in as</span><strong>{user.email}</strong></div><div className="settings-row"><div><strong>Appearance</strong><span>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span></div><button className="setting-choice" onClick={toggleTheme}>{theme === 'dark' ? 'Use light' : 'Use dark'}</button></div><div className="settings-row"><div><strong>Background sync</strong><span>Check for changes every 30 seconds</span></div><button className={`switch ${syncEnabled ? 'on' : ''}`} onClick={() => setSyncEnabled((value) => !value)} aria-pressed={syncEnabled}><i /></button></div><footer><button className="signout" onClick={() => api.logout().finally(() => setUser(null))}>Sign out of this account</button></footer></section></div>}
    <nav className="mobile-nav" aria-label="Mobile navigation"><button onClick={() => setSettingsOpen(true)} aria-label="Open account settings"><Settings2 size={18} /><span>Settings</span></button><button onClick={() => setCommandOpen(true)} aria-label="Search notes"><Search size={18} /><span>Search</span></button><button className="mobile-capture" onClick={() => { setView('notes'); setCaptureOpen(true); }}><Plus size={20} /><span>Capture</span></button><button className={view === 'tasks' ? 'active' : ''} onClick={() => { setView('tasks'); setTaskDetailId(null); setMobileEditor(false); }}><ListTodo size={18} /><span>To-do</span></button><button className={view === 'notes' ? 'active' : ''} onClick={() => { setView('notes'); setMobileEditor(false); }}><FolderIcon size={18} /><span>Notes</span></button></nav>
  </main>;
}
