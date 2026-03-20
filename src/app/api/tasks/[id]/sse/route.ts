import { NextRequest } from "next/server";
import { addSSEListener, removeSSEListener, getTask } from "@/services/task-manager";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = getTask(id);
  if (!task) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(task)}\n\n`));

      if (task.status === "completed" || task.status === "failed") {
        controller.close();
        return;
      }

      const listener = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
          if (data.includes('"completed"') || data.includes('"failed"')) {
            removeSSEListener(id, listener);
            controller.close();
          }
        } catch {
          removeSSEListener(id, listener);
        }
      };

      addSSEListener(id, listener);

      req.signal.addEventListener("abort", () => {
        removeSSEListener(id, listener);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
