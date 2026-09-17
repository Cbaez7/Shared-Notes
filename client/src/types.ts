export type SyncState = 'synced' | 'saving' | 'offline';

export interface Note {
  id: string;
  folder_id: string | null;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  dirty: boolean;
}

export interface User { id: string; email: string; }

export interface Folder { id: string; name: string; created_at: string; updated_at: string; deleted_at: string | null; dirty: boolean; }
export interface Task { id: string; folder_id: string | null; note_id: string | null; title: string; completed: boolean; subtasks: Array<{ id: string; title: string; completed: boolean }>; created_at: string; updated_at: string; deleted_at: string | null; dirty: boolean; }
