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
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  color: string;
  opacity: number;
  ttl: number;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 4 + 1;
    this.speedX = Math.random() * 6 - 3;
    this.speedY = Math.random() * -4 - 1;
    this.color = color;
    this.opacity = 1;
    this.ttl = 30 + Math.random() * 20;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.speedY += 0.1; // Gravity
    this.ttl -= 1;
    this.opacity = this.ttl / 50;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.shadowBlur = 5;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export default function DinoGame() {
  const startSession = useMutation(api.gameSessions.startSession);
  const logEvent = useMutation(api.gameSessions.logEvent);
  const endSession = useMutation(api.gameSessions.endSession);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const idxRef = useRef(0);
  const startMsRef = useRef(0);
  const startedRef = useRef(false);
  const particlesRef = useRef<Particle[]>([]);
  const bgOffsetRef = useRef(0);

  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const stored = localStorage.getItem("dinoHighScore");
    return stored ? parseInt(stored) : 0;
  });

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
    startMsRef.current = Date.now();
    await startSession({ sessionId: id, config: {} });
  };

  // Create particles at a position
  const createExplosion = (x: number, y: number, color: string, count = 10) => {
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

    const spawn = async () => {
      const obs = createObstacle(canvas.width);
      applyEvent("spawn", dino, obstacles, obs);
      await emit("spawn", obs as unknown as Record<string, unknown>);
      
      // Add spawn effect
      createExplosion(obs.x, canvas.height - obs.h/2, "#f0f", 5);
    };

    const loop = () => {
      if (!running) return;

      // Update background animation
      bgOffsetRef.current += OBSTACLE_SPEED * 0.5;
      if (bgOffsetRef.current > 1000) bgOffsetRef.current = 0;

      // Update particles
      particlesRef.current.forEach(p => p.update());
      particlesRef.current = particlesRef.current.filter(p => p.ttl > 0);

      // Start spawning/stepping once the user has pressed start
      if (startedRef.current) {
        const lastX = obstacles.length
          ? obstacles[obstacles.length - 1].x
          : -Infinity;
        if (canvas.width - lastX >= 500) void spawn();

        // THIS IS THE ORIGINAL GAME LOGIC - DO NOT MODIFY
        step(dino, obstacles);

        // If dino just landed from a jump, add effect
        if (dino.y === canvas.height - 60 && dino.vy === 0 && Date.now() - lastJump > 500) {
          createExplosion(dino.x + 20, dino.y + 60, "#0ff", 3);
        }

        // collision detection - KEEPING ORIGINAL LOGIC
        const hit = obstacles.some(
          (o) =>
            dino.x < o.x + o.w &&
            dino.x + 40 > o.x &&
            dino.y + 60 > canvas.height - o.h
        );
        if (hit) {
          running = false;
          const final = Math.floor(frameScore);
          if (sessionIdRef.current) {
            endSession({
              sessionId: sessionIdRef.current,
              finalScore: final,
            });
          }
          
          // Create explosion effect
          createExplosion(dino.x + 20, dino.y + 30, "#f0f", 30);
          
          // Update high score
          if (final > highScore) {
            setHighScore(final);
            localStorage.setItem("dinoHighScore", final.toString());
          }
          
          setGameOver(true);
          return;
        }

        frameScore += OBSTACLE_SPEED;
        setScore(Math.floor(frameScore));
      }

      // --- DRAWING ---

      // 1) Cyberpunk background
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, "#000011");
      grad.addColorStop(1, "#000044");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // 2) Draw grid lines in background for depth effect
      ctx.save();
      ctx.strokeStyle = "rgba(138, 43, 226, 0.3)";
      ctx.lineWidth = 1;
      
      // Vertical grid lines
      const gridSpacing = 50;
      const offset = bgOffsetRef.current % gridSpacing;
      
      for (let x = -offset; x < canvas.width; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      // Horizontal grid lines
      for (let y = 50; y < canvas.height; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      ctx.restore();
      
      // 3) Draw sun/moon in the background
      const glow = 15 + Math.sin(Date.now() / 500) * 5;
      ctx.save();
      ctx.shadowBlur = glow;
      ctx.shadowColor = "#FF1493";
      ctx.fillStyle = "#FF1493";
      ctx.beginPath();
      ctx.arc(canvas.width - 80, 60, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 4) Draw particles
      particlesRef.current.forEach(p => p.draw(ctx));

      // 5) Neon ground with pulse effect 
      ctx.save();
      ctx.shadowBlur = 10 + Math.sin(Date.now() / 300) * 5;
      ctx.shadowColor = "#8e44ad";
      ctx.fillStyle = "#8e44ad";
      ctx.fillRect(0, canvas.height - 4, canvas.width, 4);
      ctx.restore();

      // 6) Glowing obstacles
      for (const o of obstacles) {
        // Make obstacle glow pulse
        const pulse = 15 + Math.sin(Date.now() / 400 + o.x) * 5;
        
        ctx.save();
        ctx.shadowBlur = pulse;
        ctx.shadowColor = "#f0f";
        ctx.fillStyle = "#f0f";
        
        // Draw a slightly more interesting obstacle shape
        ctx.beginPath();
        ctx.moveTo(o.x, canvas.height);
        ctx.lineTo(o.x, canvas.height - o.h);
        ctx.lineTo(o.x + o.w/2, canvas.height - o.h - 10);
        ctx.lineTo(o.x + o.w, canvas.height - o.h);
        ctx.lineTo(o.x + o.w, canvas.height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 7) Glowing dino with trail effect
      ctx.save();
      
      // Make dino glow pulse
      const dinoPulse = 15 + Math.sin(Date.now() / 200) * 5;
      ctx.shadowBlur = dinoPulse;
      ctx.shadowColor = "#0ff";
      ctx.fillStyle = "#0ff";
      
      // Draw the dino with simple animation
      if (dino.vy !== 0) {
        // Jumping pose
        ctx.beginPath();
        ctx.moveTo(dino.x, dino.y + 60);
        ctx.lineTo(dino.x + 15, dino.y);
        ctx.lineTo(dino.x + 40, dino.y + 20);
        ctx.lineTo(dino.x + 40, dino.y + 60);
        ctx.closePath();
        ctx.fill();
      } else {
        // Running pose (alternate between two frames)
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
      
      // Add eye
      ctx.fillStyle = "#000";
      ctx.fillRect(dino.x + 30, dino.y + 10, 5, 5);
      ctx.fillStyle = "#fff";
      ctx.fillRect(dino.x + 31, dino.y + 11, 2, 2);
      
      ctx.restore();
      
      // 8) Scanlines effect (subtle)
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
      for (let i = 0; i < canvas.height; i += 4) {
        ctx.fillRect(0, i, canvas.width, 1);
      }
      ctx.restore();

      // Schedule next frame
      rafId = requestAnimationFrame(loop);
    };

    const onKey = async (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "ArrowUp") return;
      if (!startedRef.current) {
        await beginSession();
        startedRef.current = true;
        setStarted(true);
      }
      
      // Only create jump effect if on the ground
      if (dino.y === canvas.height - 60) {
        lastJump = Date.now();
        createExplosion(dino.x + 20, dino.y + 60, "#0ff", 15);
      }
      
      // Apply jump using original game logic
      applyEvent("jump", dino, obstacles);
      await emit("jump", { playerId: "self" });
    };
    
    // Handle touch events for mobile
    const onTouch = async () => {
      if (!startedRef.current) {
        await beginSession();
        startedRef.current = true;
        setStarted(true);
      }
      
      // Only create jump effect if on the ground
      if (dino.y === canvas.height - 60) {
        lastJump = Date.now();
        createExplosion(dino.x + 20, dino.y + 60, "#0ff", 15);
      }
      
      // Apply jump using original game logic
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
  }, []);

  return (
    <div className="relative glow">
      <canvas
        ref={canvasRef}
        width={800}
        height={300}
        className="w-full rounded-lg bg-black"
      />
      
      {/* Score display */}
      <div className="absolute top-4 right-4 flex flex-col items-end space-y-2">
        <div className="neon-text text-neon-cyan font-bold text-xl px-3 py-1 bg-black bg-opacity-50 rounded">
          Score: {score}
        </div>
        {highScore > 0 && (
          <div className="neon-text text-neon-magenta font-bold text-sm px-3 py-1 bg-black bg-opacity-50 rounded">
            High Score: {highScore}
          </div>
        )}
      </div>
      
      {/* Start game instructions */}
      {!started && !gameOver && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-lg neon-text text-neon-cyan bg-black bg-opacity-70 rounded-lg">
          <div className="text-3xl mb-6 animate-pulse">CYBER DINO RUN</div>
          <div>Press Space / ↑ or Tap Screen to Start</div>
        </div>
      )}
      
      {/* Game over screen */}
      {gameOver && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
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
      
      {/* CRT scan effect */}
      <div className="crt-overlay absolute inset-0 pointer-events-none rounded-lg opacity-30"></div>
    </div>
  );
}