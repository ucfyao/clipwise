import fs from "fs";
import path from "path";
import { DATA_DIR } from "./constants";
import { Task } from "./schema";

const TASKS_PATH = path.join(DATA_DIR, "tasks.json");

// Use globalThis to survive Next.js HMR in dev mode
const g = globalThis as typeof globalThis & { __clipwise_tasks?: Task[] };

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadTasks(): Task[] {
  if (g.__clipwise_tasks) return g.__clipwise_tasks;
  ensureDataDir();
  try {
    const raw = fs.readFileSync(TASKS_PATH, "utf-8");
    g.__clipwise_tasks = JSON.parse(raw);
    return g.__clipwise_tasks!;
  } catch {
    g.__clipwise_tasks = [];
    return g.__clipwise_tasks;
  }
}

function saveTasks(tasks: Task[]) {
  ensureDataDir();
  g.__clipwise_tasks = tasks;
  fs.writeFileSync(TASKS_PATH, JSON.stringify(tasks, null, 2));
}

export function listTasks(): Task[] {
  return loadTasks().sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function getTaskById(id: string): Task | undefined {
  return loadTasks().find((t) => t.id === id);
}

export function insertTask(task: Task) {
  const tasks = loadTasks();
  tasks.push(task);
  saveTasks(tasks);
}

export function updateTaskFields(id: string, updates: Partial<Task>) {
  const tasks = loadTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return;
  tasks[idx] = { ...tasks[idx], ...updates, updated_at: new Date().toISOString() };
  saveTasks(tasks);
}

export function deleteTask(id: string) {
  const tasks = loadTasks().filter((t) => t.id !== id);
  saveTasks(tasks);
}
