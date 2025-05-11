import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Dino,
  Obstacle,
  step,
  applyEvent,
  JUMP_VY,
} from "../gameLogic";

interface Props {
  sessionId: string;
  onClose: () => void;
}

export function SpectatorModal({ sessionId, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg p-4 shadow-xl max-w-3xl w-full relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white"
        >
          ✕
        </button>
        <SpectatorCanvas sessionId={sessionId} />
      </div>
    </div>
  );
}

function SpectatorCanvas({ sessionId }: { sessionId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 1) session doc for finalScore & createdBy
  const session = useQuery(api.gameSessions.getSession, { sessionId });
  // 2) look up username
  const username = useQuery(api.profiles.getUsername, {
    userId: session?.createdBy!,
  });

  const runningRef = useRef(true);
  useEffect(() => {
    if (session?.finalScore != null) {
      runningRef.current = false;
    }
  }, [session?.finalScore]);

  // 3) event stream
  const [afterIdx, setAfterIdx] = useState(-1);
  const batch =
    useQuery(api.gameSessions.eventsSince, {
      sessionId,
      afterIdx,
      limit: 512,
    }) || [];

  const bufRef = useRef<typeof batch>([]);
  useEffect(() => {
    if (batch.length) {
      bufRef.current.push(...batch);
      setAfterIdx(batch[batch.length - 1].idx);
    }
  }, [batch]);

  // 4) simulation + draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const dino: Dino = { x: 50, y: canvas.height - 60, vy: 0 };
    let obstacles: Obstacle[] = [];
    let cursor = 0;

    const loop = () => {
      if (!runningRef.current) return;

      // apply events
      const buf = bufRef.current;
      while (cursor < buf.length) {
        const ev = buf[cursor++];
        applyEvent(
          ev.type as "jump" | "spawn",
          dino,
          obstacles,
          ev.data as Obstacle
        );
      }

      step(dino, obstacles);

      // draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#6b7280";
      ctx.fillRect(0, canvas.height - 2, canvas.width, 2);
      ctx.fillStyle = "#ff2d75";
      for (const o of obstacles) {
        ctx.fillRect(o.x, canvas.height - o.h, o.w, o.h);
      }
      ctx.fillStyle = "#fff";
      ctx.fillRect(dino.x, dino.y, 40, 60);

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }, []); // mount only

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        width={800}
        height={300}
        className="w-full rounded bg-gray-800"
      />
      {session?.finalScore != null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
          <div className="text-2xl font-bold mb-2">Game Ended</div>
          <div>Player: {username || "Unknown"}</div>
          <div className="mt-1">Final Score: {session.finalScore}</div>
        </div>
      )}
    </div>
  );
}
