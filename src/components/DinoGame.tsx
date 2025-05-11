import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  createObstacle,
  step,
  applyEvent,
  OBSTACLE_SPEED,
  Dino,
  Obstacle,
} from "../gameLogic";
import { v4 as uuid } from "uuid";

export default function DinoGame() {
  const startSession = useMutation(api.gameSessions.startSession);
  const logEvent     = useMutation(api.gameSessions.logEvent);
  const endSession   = useMutation(api.gameSessions.endSession);

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const idxRef       = useRef(0);
  const startMsRef   = useRef(0);

  const startedRef   = useRef(false);

  const [started,  setStarted]  = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score,    setScore]    = useState(0);

  const emit = async (
    type: "jump" | "spawn",
    data: Record<string, unknown> = {}
  ) => {
    if (!sessionIdRef.current) return;
    await logEvent({
      sessionId: sessionIdRef.current,
      idx: ++idxRef.current,
      t: Date.now() - startMsRef.current,
      type,
      data,
    });
  };

  const beginSession = async () => {
    if (sessionIdRef.current) return;
    const id = uuid();
    sessionIdRef.current = id;
    startMsRef.current   = Date.now();
    await startSession({ sessionId: id, config: {} });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const dino: Dino = { x: 50, y: canvas.height - 60, vy: 0 };
    let obstacles: Obstacle[] = [];
    let running = true;
    let frameScore = 0;
    let rafId: number;

    const spawn = async () => {
      const obs = createObstacle(canvas.width);
      applyEvent("spawn", dino, obstacles, obs);
      await emit("spawn", obs as unknown as Record<string, unknown>);
    };

    const loop = () => {
      if (!running) return;

      if (startedRef.current) {
        const lastX = obstacles.length ? obstacles[obstacles.length - 1].x : -Infinity;
        if (canvas.width - lastX >= 500) {
          void spawn();
        }

        step(dino, obstacles);

        const hit = obstacles.some(
          (o) =>
            dino.x < o.x + o.w &&
            dino.x + 40 > o.x &&
            dino.y + 60 > canvas.height - o.h
        );
        if (hit) {
          running = false;
          const final = Math.floor(frameScore);               // use frameScore
          if (sessionIdRef.current) {
            endSession({
              sessionId: sessionIdRef.current,
              finalScore: final,
            });
          }
          setGameOver(true);
          return;
        }

        frameScore += OBSTACLE_SPEED;
        setScore(Math.floor(frameScore));
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#6b7280";
      ctx.fillRect(0, canvas.height - 2, canvas.width, 2);
      ctx.fillStyle = "#ff2d75";
      for (const o of obstacles) {
        ctx.fillRect(o.x, canvas.height - o.h, o.w, o.h);
      }
      ctx.fillStyle = "#fff";
      ctx.fillRect(dino.x, dino.y, 40, 60);

      rafId = requestAnimationFrame(loop);
    };

    const onKey = async (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "ArrowUp") return;
      if (!startedRef.current) {
        await beginSession();
        startedRef.current = true;
        setStarted(true);
      }
      applyEvent("jump", dino, obstacles);
      await emit("jump", { playerId: "self" });
    };

    document.addEventListener("keydown", onKey);
    loop();
    return () => {
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(rafId);
    };
  }, []); // run only once on mount

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={800}
        height={300}
        className="bg-gray-900 rounded-lg w-full"
      />
      <div className="absolute top-4 right-4 text-white font-bold">
        Score: {score}
      </div>
      {!started && !gameOver && (
        <div className="absolute inset-0 flex items-center justify-center text-lg text-white pointer-events-none">
          Press Space / ↑ to start
        </div>
      )}
      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-purple-600 rounded"
          >
            Play again
          </button>
        </div>
      )}
    </div>
  );
}
