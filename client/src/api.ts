import { z } from 'zod';
import type { Folder, Note, Task, User } from './types';

const userSchema = z.object({ id: z.string().uuid(), email: z.string().email() });
const noteSchema = z.object({ id: z.string().uuid(), folder_id: z.string().uuid().nullable(), title: z.string(), body: z.string(), created_at: z.string(), updated_at: z.string(), deleted_at: z.string().nullable() });
const notesSchema = z.object({ notes: z.array(noteSchema), server_time: z.string() });
const folderSchema = z.object({ id: z.string().uuid(), name: z.string(), created_at: z.string(), updated_at: z.string(), deleted_at: z.string().nullable() });
const taskSchema = z.object({ id: z.string().uuid(), folder_id: z.string().uuid().nullable(), note_id: z.string().uuid().nullable(), title: z.string(), completed: z.boolean(), subtasks: z.array(z.object({ id: z.string().uuid(), title: z.string(), completed: z.boolean() })), created_at: z.string(), updated_at: z.string(), deleted_at: z.string().nullable() });
const workspaceSchema = z.object({ folders: z.array(folderSchema), tasks: z.array(taskSchema), server_time: z.string() });
const authSchema = z.object({ user: userSchema });

export class AuthError extends Error {}
export class ConflictError extends Error {
  constructor(message: string, readonly note?: Omit<Note, 'dirty'>) { super(message); }
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`/api${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, ...init });
  if (response.status === 401) throw new AuthError();
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Request failed' })) as { error?: string; note?: unknown };
    if (response.status === 409) {
      const parsedNote = noteSchema.safeParse(payload.note);
      throw new ConflictError(payload.error ?? 'The server has a newer version.', parsedNote.success ? parsedNote.data : undefined);
    }
    throw new Error(payload.error ?? 'Request failed');
  }
  if (response.status === 204) return undefined;
  return response.json();
}

export const api = {
  me: async (): Promise<User> => authSchema.parse(await request('/auth/me')).user,
  register: async (email: string, password: string): Promise<User> => authSchema.parse(await request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) })).user,
  login: async (email: string, password: string): Promise<User> => authSchema.parse(await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })).user,
  logout: async (): Promise<void> => { await request('/auth/logout', { method: 'POST' }); },
  pull: async (since?: string): Promise<{ notes: Omit<Note, 'dirty'>[]; serverTime: string }> => {
    const response = notesSchema.parse(await request(`/notes${since ? `?since=${encodeURIComponent(since)}` : ''}`));
    return { notes: response.notes, serverTime: response.server_time };
  },
  push: async (note: Note): Promise<Omit<Note, 'dirty'>> => noteSchema.parse(await request(`/notes/${note.id}`, { method: 'PUT', body: JSON.stringify({ title: note.title, body: note.body, folder_id: note.folder_id ?? null, updated_at: note.updated_at }) })),
  delete: async (note: Note): Promise<Omit<Note, 'dirty'>> => noteSchema.parse(await request(`/notes/${note.id}`, { method: 'DELETE', body: JSON.stringify({ updated_at: note.updated_at }) }))
  ,workspace: async (since?: string): Promise<{ folders: Omit<Folder, 'dirty'>[]; tasks: Omit<Task, 'dirty'>[]; serverTime: string }> => { const data = workspaceSchema.parse(await request(`/workspace${since ? `?since=${encodeURIComponent(since)}` : ''}`)); return { folders: data.folders, tasks: data.tasks, serverTime: data.server_time }; }
  ,pushFolder: async (folder: Folder): Promise<Omit<Folder, 'dirty'>> => folderSchema.parse(await request(`/folders/${folder.id}`, { method: 'PUT', body: JSON.stringify({ name: folder.name, updated_at: folder.updated_at }) }))
  ,pushTask: async (task: Task): Promise<Omit<Task, 'dirty'>> => taskSchema.parse(await request(`/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify({ title: task.title, completed: task.completed, folder_id: task.folder_id, note_id: task.note_id ?? null, subtasks: task.subtasks, updated_at: task.updated_at }) }))
};
