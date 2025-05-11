/* ──────────────────────────────────────────────────────────
   Shared deterministic logic used by both DinoGame and the
   Spectator — the ONLY source of truth for physics.
   ────────────────────────────────────────────────────────── */

export const GRAVITY = 0.8;
export const JUMP_VY = -15;
export const OBSTACLE_SPEED = 3;            // px per frame (constant)

export interface Dino {
  x: number;
  y: number;
  vy: number;
}

export interface Obstacle {
  x: number;
  w: number;
  h: number;
}

/* Create a new cactus at the right edge of a canvas */
export function createObstacle(canvasWidth: number): Obstacle {
  return {
    x: canvasWidth,
    w: 18,
    h: 25 + Math.random() * 25,
  };
}

/* Mutate dino + obstacles for one frame */
export function step(dino: Dino, obstacles: Obstacle[]) {
  // gravity
  dino.vy += GRAVITY;
  dino.y += dino.vy;
  if (dino.y > 240) {          // 300-canvas minus 60-dino height
    dino.y = 240;
    dino.vy = 0;
  }
  // move obstacles
  for (const o of obstacles) o.x -= OBSTACLE_SPEED;
}

/* Apply an event */
export function applyEvent(
  type: "jump" | "spawn",
  dino: Dino,
  obstacles: Obstacle[],
  payload?: Obstacle
) {
  if (type === "jump" && dino.vy === 0) {
    dino.vy = JUMP_VY;
  } else if (type === "spawn" && payload) {
    obstacles.push({ ...payload });
  }
}
