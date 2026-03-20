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

  if (loading) return <div className="text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tasks</h1>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No tasks yet.</p>
          <Link href="/" className="mt-2 inline-block text-sm text-primary hover:underline">
            Upload a video to get started
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} {...task} />
          ))}
        </div>
      )}
    </div>
  );
}
