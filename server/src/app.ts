import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { SqliteDatabase } from './database.js';

const authSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(8).max(128) });
const noteSchema = z.object({ title: z.string().max(500), body: z.string().max(500_000), folder_id: z.string().uuid().nullable().default(null), updated_at: z.string().datetime({ offset: true }) });
const deleteSchema = z.object({ updated_at: z.string().datetime({ offset: true }) });
const folderSchema = z.object({ name: z.string().trim().min(1).max(120), updated_at: z.string().datetime({ offset: true }) });
const taskSchema = z.object({ title: z.string().trim().min(1).max(500), completed: z.boolean(), folder_id: z.string().uuid().nullable(), note_id: z.string().uuid().nullable().default(null), subtasks: z.array(z.object({ id: z.string().uuid(), title: z.string().min(1).max(500), completed: z.boolean() })).max(100), updated_at: z.string().datetime({ offset: true }) });
const jwtSecret = process.env.JWT_SECRET ?? 'development-only-change-this-secret';
const cookieName = 'sharednotes_session';

type UserRow = { id: string; email: string; password_hash: string; created_at: string };
type NoteRow = { id: string; user_id: string; folder_id: string | null; title: string; body: string; created_at: string; updated_at: string; deleted_at: string | null };
type FolderRow = { id: string; user_id: string; name: string; created_at: string; updated_at: string; deleted_at: string | null };
type TaskRow = { id: string; user_id: string; folder_id: string | null; note_id: string | null; title: string; completed: number; subtasks: string; created_at: string; updated_at: string; deleted_at: string | null };
type JwtPayload = { sub: string };

declare global { namespace Express { interface Request { userId?: string; } } }

function publicUser(user: UserRow): { id: string; email: string } { return { id: user.id, email: user.email }; }
function publicNote(note: NoteRow): Omit<NoteRow, 'user_id'> { const { user_id: _userId, ...data } = note; return data; }
function publicFolder(folder: FolderRow): Omit<FolderRow, 'user_id'> { const { user_id: _userId, ...data } = folder; return data; }
function publicTask(task: TaskRow): Omit<TaskRow, 'user_id' | 'completed' | 'subtasks'> & { completed: boolean; subtasks: Array<{ id: string; title: string; completed: boolean }> } { const { user_id: _userId, completed, subtasks, ...data } = task; return { ...data, completed: Boolean(completed), subtasks: z.array(z.object({ id: z.string(), title: z.string(), completed: z.boolean() })).parse(JSON.parse(subtasks)) }; }
function now(): string { return new Date().toISOString(); }

function sendCookie(response: Response, userId: string): void {
  response.cookie(cookieName, jwt.sign({ sub: userId }, jwtSecret, { expiresIn: '30d' }), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
}

export function createApp(db: SqliteDatabase): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') ?? true, credentials: true }));
  app.use(express.json({ limit: '600kb' }));
  app.use(cookieParser());
  const router = express.Router();
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many authentication attempts. Try again later.' } });
  const requireUser = (request: Request, response: Response, next: NextFunction): void => {
    const token = request.cookies[cookieName] as string | undefined;
    if (!token) { response.status(401).json({ error: 'Authentication required' }); return; }
    try { request.userId = (jwt.verify(token, jwtSecret) as JwtPayload).sub; next(); }
    catch { response.clearCookie(cookieName, { path: '/' }).status(401).json({ error: 'Session expired' }); }
  };

  router.post('/auth/register', authLimiter, async (request, response, next) => {
    try {
      const input = authSchema.parse(request.body);
      const email = input.email.toLowerCase();
      if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) { response.status(409).json({ error: 'An account already exists for that email.' }); return; }
      const user: UserRow = { id: randomUUID(), email, password_hash: await bcrypt.hash(input.password, 12), created_at: now() };
      db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run(user.id, user.email, user.password_hash, user.created_at);
      sendCookie(response, user.id); response.status(201).json({ user: publicUser(user) });
    } catch (error) { next(error); }
  });
  router.post('/auth/login', authLimiter, async (request, response, next) => {
    try {
      const input = authSchema.parse(request.body);
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(input.email.toLowerCase()) as UserRow | undefined;
      if (!user || !(await bcrypt.compare(input.password, user.password_hash))) { response.status(401).json({ error: 'Email or password is incorrect.' }); return; }
      sendCookie(response, user.id); response.json({ user: publicUser(user) });
    } catch (error) { next(error); }
  });
  router.post('/auth/logout', (request, response) => { response.clearCookie(cookieName, { path: '/' }).status(204).send(); });
  router.get('/auth/me', requireUser, (request, response) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(request.userId) as UserRow | undefined;
    if (!user) { response.status(401).json({ error: 'Account not found' }); return; }
    response.json({ user: publicUser(user) });
  });
  router.get('/notes', requireUser, (request, response, next) => {
    try {
      const since = typeof request.query.since === 'string' ? z.string().datetime({ offset: true }).parse(request.query.since) : '1970-01-01T00:00:00.000Z';
      const notes = db.prepare('SELECT * FROM notes WHERE user_id = ? AND updated_at > ? ORDER BY updated_at ASC').all(request.userId, since) as NoteRow[];
      response.json({ notes: notes.map(publicNote), server_time: now() });
    } catch (error) { next(error); }
  });
  router.get('/workspace', requireUser, (request, response, next) => {
    try {
      const since = typeof request.query.since === 'string' ? z.string().datetime({ offset: true }).parse(request.query.since) : '1970-01-01T00:00:00.000Z';
      const folders = db.prepare('SELECT * FROM folders WHERE user_id = ? AND updated_at > ? ORDER BY updated_at ASC').all(request.userId, since) as FolderRow[];
      const tasks = db.prepare('SELECT * FROM tasks WHERE user_id = ? AND updated_at > ? ORDER BY updated_at ASC').all(request.userId, since) as TaskRow[];
      response.json({ folders: folders.map(publicFolder), tasks: tasks.map(publicTask), server_time: now() });
    } catch (error) { next(error); }
  });
  router.put('/folders/:id', requireUser, (request, response, next) => {
    try {
      const id = z.string().uuid().parse(request.params.id); const input = folderSchema.parse(request.body);
      const existing = db.prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?').get(id, request.userId) as FolderRow | undefined;
      if (existing && new Date(input.updated_at) < new Date(existing.updated_at)) { response.status(409).json({ error: 'This folder is older than the server copy.', folder: publicFolder(existing) }); return; }
      const updatedAt = now();
      if (existing) db.prepare('UPDATE folders SET name = ?, updated_at = ?, deleted_at = NULL WHERE id = ? AND user_id = ?').run(input.name, updatedAt, id, request.userId);
      else db.prepare('INSERT INTO folders (id, user_id, name, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL)').run(id, request.userId, input.name, updatedAt, updatedAt);
      response.json(publicFolder(db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as FolderRow));
    } catch (error) { next(error); }
  });
  router.put('/tasks/:id', requireUser, (request, response, next) => {
    try {
      const id = z.string().uuid().parse(request.params.id); const input = taskSchema.parse(request.body);
      const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, request.userId) as TaskRow | undefined;
      if (existing && new Date(input.updated_at) < new Date(existing.updated_at)) { response.status(409).json({ error: 'This task is older than the server copy.', task: publicTask(existing) }); return; }
      const updatedAt = now();
      const subtasks = JSON.stringify(input.subtasks);
      if (existing) db.prepare('UPDATE tasks SET title = ?, completed = ?, folder_id = ?, note_id = ?, subtasks = ?, updated_at = ?, deleted_at = NULL WHERE id = ? AND user_id = ?').run(input.title, Number(input.completed), input.folder_id, input.note_id, subtasks, updatedAt, id, request.userId);
      else db.prepare('INSERT INTO tasks (id, user_id, folder_id, note_id, title, completed, subtasks, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)').run(id, request.userId, input.folder_id, input.note_id, input.title, Number(input.completed), subtasks, updatedAt, updatedAt);
      response.json(publicTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow));
    } catch (error) { next(error); }
  });
  router.put('/notes/:id', requireUser, (request, response, next) => {
    try {
      const id = z.string().uuid().parse(request.params.id);
      const input = noteSchema.parse(request.body);
      const existing = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(id, request.userId) as NoteRow | undefined;
      if (existing && new Date(input.updated_at) < new Date(existing.updated_at)) { response.status(409).json({ error: 'This version is older than the server copy.', note: publicNote(existing) }); return; }
      const updatedAt = now();
      if (existing) db.prepare('UPDATE notes SET title = ?, body = ?, folder_id = ?, updated_at = ?, deleted_at = NULL WHERE id = ? AND user_id = ?').run(input.title, input.body, input.folder_id, updatedAt, id, request.userId);
      else db.prepare('INSERT INTO notes (id, user_id, folder_id, title, body, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)').run(id, request.userId, input.folder_id, input.title, input.body, updatedAt, updatedAt);
      const saved = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(id, request.userId) as NoteRow;
      response.json(publicNote(saved));
    } catch (error) { next(error); }
  });
  router.delete('/notes/:id', requireUser, (request, response, next) => {
    try {
      const id = z.string().uuid().parse(request.params.id);
      const input = deleteSchema.parse(request.body);
      const existing = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(id, request.userId) as NoteRow | undefined;
      if (!existing) { response.status(404).json({ error: 'Note not found' }); return; }
      if (new Date(input.updated_at) < new Date(existing.updated_at)) { response.status(409).json({ error: 'This version is older than the server copy.', note: publicNote(existing) }); return; }
      const updatedAt = now();
      db.prepare('UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(updatedAt, updatedAt, id, request.userId);
      const saved = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(id, request.userId) as NoteRow;
      response.json(publicNote(saved));
    } catch (error) { next(error); }
  });
  app.use('/api', router); app.use(router);
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) { response.status(400).json({ error: 'Invalid request', details: error.issues.map((issue) => issue.message) }); return; }
    console.error(error); response.status(500).json({ error: 'Unexpected server error' });
  });
  return app;
}
