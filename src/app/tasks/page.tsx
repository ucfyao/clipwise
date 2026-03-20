"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TaskCard } from "@/components/task-card";

interface Task {
  id: string;
  filename: string;
  mode: string;
  status: string;
  created_at: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks")
      .then((res) => res.json())
      .then((data) => {
        setTasks(data);
        setLoading(false);
      });
  }, []);

  const handleDelete = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">任务列表</h1>
        <Link
          href="/"
          className="text-sm text-primary hover:underline"
        >
          + 新任务
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">还没有任务</p>
          <Link href="/" className="mt-2 inline-block text-sm text-primary hover:underline">
            上传视频开始使用
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} {...task} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
