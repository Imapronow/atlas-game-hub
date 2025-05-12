// src/components/DinoGame.tsx
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

// Simple particle system for effects
class Particle {
  x: number; y: number; size: number; speedX: number;
  speedY: number; color: string; opacity: number; ttl: number;
  constructor(x: number, y: number, color: string) {
    this.x = x; this.y = y;
    this.size = Math.random() * 4 + 1;
    this.speedX = Math.random() * 6 - 3;
    this.speedY = Math.random() * -4 - 1;
    this.color = color; this.opacity = 1;
    this.ttl = 30 + Math.random() * 20;
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.speedY += 0.1;
    this.ttl -= 1;
    this.opacity = this.ttl / 50;
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.shadowBlur = 5; ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Parallax cloud
class Cloud {
  x: number; y: number; speed: number; size: number;
  constructor(canvasWidth: number) {
    this.x = canvasWidth + Math.random() * 200;
    this.y = 50 + Math.random() * 100;
    this.speed = 0.2 + Math.random() * 0.3;
    this.size = 30 + Math.random() * 50;
  }
  update(canvasWidth: number) {
    this.x -= this.speed;
    if (this.x < -this.size) this.x = canvasWidth + this.size;
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.size, this.size * 0.6, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }
}

export default function DinoGame() {
  const startSession = useMutation(api.gameSessions.startSession);
  const logEvent      = useMutation(api.gameSessions.logEvent);
  const endSession    = useMutation(api.gameSessions.endSession);

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const idxRef       = useRef(0);
  const startMsRef   = useRef(0);
  const startedRef   = useRef(false);
  const particlesRef = useRef<Particle[]>([]);
  const bgOffsetRef  = useRef(0);

  const [started, setStarted]     = useState(false);
  const [paused, setPaused]       = useState(false);
  const [gameOver, setGameOver]   = useState(false);
  const [score, setScore]         = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const stored = localStorage.getItem("dinoHighScore");
    return stored ? parseInt(stored) : 0;
  });

  // pause/resume on blur/focus
  useEffect(() => {
    const onBlur = () => setPaused(true);
    const onFocus = () => setPaused(false);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

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

  const createExplosion = (
    x: number,
    y: number,
    color: string,
    count = 10
  ) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push(new Particle(x, y, color));
    }
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
    let lastJump = 0;
    let difficulty = 0;

    // clouds
    const clouds = Array.from({ length: 5 }, () => new Cloud(canvas.width));

    // spawn timing
    let lastSpawn = Date.now();
    let spawnInterval = 1200 + Math.random() * 1300; // ms

    const spawnGroup = async () => {
      const clusterCount = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 2) : 1;
      for (let i = 0; i < clusterCount; i++) {
        const obs = createObstacle(canvas.width + i * 60);
        applyEvent("spawn", dino, obstacles, obs);
        obstacles.push(obs);
        createExplosion(obs.x, canvas.height - obs.h / 2, "#f0f", 5);
        await emit("spawn", { ...obs } as any);
      }
    };

    const loop = () => {
      if (!running) return;

      // ramp difficulty [0–1]
      if (startedRef.current && difficulty < 1) difficulty += 0.0005;

      // compute speed like Chrome dino
      const speed = 6 * (1 + difficulty); // base 6px/frame
      bgOffsetRef.current += speed * 0.5;
      if (bgOffsetRef.current > 1000) bgOffsetRef.current = 0;

      // particles
      particlesRef.current.forEach(p => p.update());
      particlesRef.current = particlesRef.current.filter(p => p.ttl > 0);

      // clouds
      clouds.forEach(c => c.update(canvas.width));

      if (startedRef.current && !paused) {
        // time-based spawn
        if (Date.now() - lastSpawn > spawnInterval) {
          void spawnGroup();
          lastSpawn = Date.now();
          spawnInterval = 1200 + Math.random() * 1300;
        }

        // physics step
        step(dino, obstacles);
        // adjust obstacles to match `speed` if OBSTACLE_SPEED differs
        const delta = speed - OBSTACLE_SPEED;
        if (delta !== 0) obstacles.forEach(o => (o.x -= delta));

        // landing effect
        if (
          dino.y === canvas.height - 60 &&
          dino.vy === 0 &&
          Date.now() - lastJump > 500
        ) {
          createExplosion(dino.x + 20, dino.y + 60, "#0ff", 3);
        }

        // collision
        const hit = obstacles.some(
          o =>
            dino.x < o.x + o.w &&
            dino.x + 40 > o.x &&
            dino.y + 60 > canvas.height - o.h
        );
        if (hit) {
          running = false;
          const final = Math.floor(frameScore);
          if (sessionIdRef.current) {
            endSession({ sessionId: sessionIdRef.current, finalScore: final });
          }
          createExplosion(dino.x + 20, dino.y + 30, "#f0f", 30);
          if (final > highScore) {
            setHighScore(final);
            localStorage.setItem("dinoHighScore", final.toString());
          }
          setGameOver(true);
          return;
        }

        // scoring
        frameScore += speed;
        setScore(Math.floor(frameScore));
      }

      // --- DRAW ---
      // 1) gradient
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, "#000011");
      grad.addColorStop(1, "#000044");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2) grid
      ctx.save();
      ctx.strokeStyle = "rgba(138, 43, 226, 0.3)";
      ctx.lineWidth = 1;
      const spacing = 50;
      const off = bgOffsetRef.current % spacing;
      for (let x = -off; x < canvas.width; x += spacing) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 50; y < canvas.height; y += spacing) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
      ctx.restore();

      // 3) clouds draw
      clouds.forEach(c => c.draw(ctx));

      // 4) sun/moon
      const glow = 15 + Math.sin(Date.now() / 500) * 5;
      ctx.save();
      ctx.shadowBlur = glow; ctx.shadowColor = "#FF1493";
      ctx.fillStyle = "#FF1493";
      ctx.beginPath();
      ctx.arc(canvas.width - 80, 60, 30, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      // 5) particles
      particlesRef.current.forEach(p => p.draw(ctx));

      // 6) ground
      ctx.save();
      ctx.shadowBlur = 10 + Math.sin(Date.now() / 300) * 5;
      ctx.shadowColor = "#8e44ad";
      ctx.fillStyle = "#8e44ad";
      ctx.fillRect(0, canvas.height - 4, canvas.width, 4);
      ctx.restore();

      // 7) obstacles bounce & glow
      for (const o of obstacles) {
        const bounce = Math.sin(Date.now() / 200 + o.x) * 5;
        const h = o.h + bounce;
        const pulse = 15 + Math.sin(Date.now() / 400 + o.x) * 5;
        ctx.save();
        ctx.shadowBlur = pulse; ctx.shadowColor = "#f0f";
        ctx.fillStyle = "#f0f";
        ctx.beginPath();
        ctx.moveTo(o.x, canvas.height);
        ctx.lineTo(o.x, canvas.height - h);
        ctx.lineTo(o.x + o.w / 2, canvas.height - h - 10);
        ctx.lineTo(o.x + o.w, canvas.height - h);
        ctx.lineTo(o.x + o.w, canvas.height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 8) dino trail
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#0ff";
      ctx.fillRect(dino.x - 5, dino.y + 10, 5, 40);
      ctx.restore();

      // 9) dino glow & shape
      ctx.save();
      const dp = 15 + Math.sin(Date.now() / 200) * 5;
      ctx.shadowBlur = dp; ctx.shadowColor = "#0ff"; ctx.fillStyle = "#0ff";
      if (dino.vy !== 0) {
        ctx.beginPath();
        ctx.moveTo(dino.x, dino.y + 60);
        ctx.lineTo(dino.x + 15, dino.y);
        ctx.lineTo(dino.x + 40, dino.y + 20);
        ctx.lineTo(dino.x + 40, dino.y + 60);
        ctx.closePath();
        ctx.fill();
      } else {
        const frame = Math.floor(Date.now() / 100) % 2;
        if (frame === 0) {
          ctx.fillRect(dino.x, dino.y, 40, 60);
        } else {
          ctx.beginPath();
          ctx.moveTo(dino.x, dino.y);
          ctx.lineTo(dino.x + 40, dino.y + 10);
          ctx.lineTo(dino.x + 40, dino.y + 60);
          ctx.lineTo(dino.x, dino.y + 60);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.fillStyle = "#000";
      ctx.fillRect(dino.x + 30, dino.y + 10, 5, 5);
      ctx.fillStyle = "#fff";
      ctx.fillRect(dino.x + 31, dino.y + 11, 2, 2);
      ctx.restore();

      // 10) scanlines
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      for (let i = 0; i < canvas.height; i += 4) {
        ctx.fillRect(0, i, canvas.width, 1);
      }
      ctx.restore();

      rafId = requestAnimationFrame(loop);
    };

    const onKey = async (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "ArrowUp") return;
      if (!startedRef.current) {
        await beginSession();
        startedRef.current = true;
        setStarted(true);
      }
      if (dino.y === canvas.height - 60) {
        lastJump = Date.now();
        createExplosion(dino.x + 20, dino.y + 60, "#0ff", 15);
      }
      applyEvent("jump", dino, obstacles);
      await emit("jump", { playerId: "self" });
    };

    const onTouch = async () => {
      if (!startedRef.current) {
        await beginSession();
        startedRef.current = true;
        setStarted(true);
      }
      if (dino.y === canvas.height - 60) {
        lastJump = Date.now();
        createExplosion(dino.x + 20, dino.y + 60, "#0ff", 15);
      }
      applyEvent("jump", dino, obstacles);
      await emit("jump", { playerId: "self" });
    };

    document.addEventListener("keydown", onKey);
    canvas.addEventListener("touchstart", onTouch);
    loop();

    return () => {
      document.removeEventListener("keydown", onKey);
      canvas.removeEventListener("touchstart", onTouch);
      cancelAnimationFrame(rafId);
    };
  }, [highScore, paused]);

  return (
    <div className="relative glow">
      <canvas
        ref={canvasRef}
        width={800}
        height={300}
        className="w-full rounded-lg bg-black"
      />

      {/* Score HUD */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end space-y-2">
        <div className="neon-text text-neon-cyan font-bold text-xl px-3 py-1 bg-black bg-opacity-50 rounded">
          Score: {score}
        </div>
        {highScore > 0 && (
          <div className="neon-text text-neon-magenta font-bold text-sm px-3 py-1 bg-black bg-opacity-50 rounded">
            High Score: {highScore}
          </div>
        )}
      </div>

      {/* Start Screen */}
      {!started && !gameOver && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-lg neon-text text-neon-cyan bg-black bg-opacity-70 rounded-lg">
          <div className="text-3xl mb-6 animate-pulse">CYBER DINO RUN</div>
          <div>Press Space / ↑ or Tap Screen to Start</div>
        </div>
      )}

      {/* Paused */}
      {paused && started && !gameOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="text-3xl neon-text text-neon-cyan bg-black bg-opacity-70 px-4 py-2 rounded">
            PAUSED
          </div>
        </div>
      )}

      {/* Game Over */}
      {gameOver && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80">
          <div className="text-3xl mb-4 neon-text text-neon-magenta">GAME OVER</div>
          <div className="mb-6 neon-text text-neon-cyan">Final Score: {score}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 neon-text bg-neon-magenta text-white rounded glow"
          >
            Play Again
          </button>
        </div>
      )}

      {/* CRT Overlay */}
      <div className="crt-overlay absolute inset-0 pointer-events-none rounded-lg opacity-30 z-0"></div>
    </div>
  );
}
