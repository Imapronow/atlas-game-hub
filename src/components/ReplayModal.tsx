// src/components/ReplayModal.tsx
import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Dino,
  Obstacle,
  step,
  applyEvent,
} from "../gameLogic";

interface Props {
  sessionId: string;
  onClose: () => void;
}

export function ReplayModal({ sessionId, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg p-4 shadow-xl max-w-3xl w-full relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white"
        >
          ✕
        </button>
        <ReplayCanvas sessionId={sessionId} />
      </div>
    </div>
  );
}

function ReplayCanvas({ sessionId }: { sessionId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 1) load session meta (finalScore + createdBy)
  const session = useQuery(api.gameSessions.getSession, { sessionId });
  // 2) look up username
  const username = useQuery(api.profiles.getUsername, {
    userId: session?.createdBy!,
  }) || "Unknown";

  // 3) preload ALL events in one shot
  const events =
    useQuery(api.gameSessions.eventsSince, {
      sessionId,
      afterIdx: -1,
      limit: 10000,
    }) || [];

  // ready when both session + events are loaded
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready && session && events) {
      setReady(true);
    }
  }, [session, events, ready]);

  // replay state
  const cursorRef    = useRef(0);
  const dinoRef      = useRef<Dino>({ x: 50, y: 240, vy: 0 });
  const obstaclesRef = useRef<Obstacle[]>([]);
  const startTimeRef = useRef(0);
  const [ended, setEnded] = useState(false);

  // single frame function
  const frame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const elapsed = performance.now() - startTimeRef.current;

    // apply events up to current time
    while (
      cursorRef.current < events.length &&
      events[cursorRef.current].t <= elapsed
    ) {
      const ev = events[cursorRef.current++];
      applyEvent(ev.type as "jump" | "spawn", dinoRef.current!, obstaclesRef.current, ev.data as Obstacle);
    }

    // physics + move
    step(dinoRef.current!, obstaclesRef.current);

    // draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#6b7280";
    ctx.fillRect(0, canvas.height - 2, canvas.width, 2);

    ctx.fillStyle = "#ff2d75";
    for (const o of obstaclesRef.current) {
      ctx.fillRect(o.x, canvas.height - o.h, o.w, o.h);
    }

    ctx.fillStyle = "#fff";
    ctx.fillRect(dinoRef.current!.x, dinoRef.current!.y, 40, 60);

    // continue or end
    if (cursorRef.current < events.length) {
      requestAnimationFrame(frame);
    } else {
      setEnded(true);
    }
  };

  // start or restart the replay
  const startReplay = () => {
    cursorRef.current = 0;
    obstaclesRef.current = [];
    const canvas = canvasRef.current!;
    dinoRef.current = { x: 50, y: canvas.height - 60, vy: 0 };
    startTimeRef.current = performance.now();
    setEnded(false);
    requestAnimationFrame(frame);
  };

  // kick off first replay when ready
  useEffect(() => {
    if (ready) {
      startReplay();
    }
  }, [ready]);

  return (
    <div className="relative w-full">
      {/* Player name always top-left */}
      <div className="absolute top-2 left-2 text-white font-bold">
        Player: {username}
      </div>
      {/* Final score top-right, only after end */}
      {ended && session?.finalScore != null && (
        <div className="absolute top-2 right-2 text-white font-bold">
          Score: {session.finalScore}
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={800}
        height={300}
        className="w-full rounded bg-gray-800"
      />
      {/* Replay button bottom-center */}
      {ended && (
        <button
          onClick={startReplay}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Replay
        </button>
      )}
    </div>
  );
}
