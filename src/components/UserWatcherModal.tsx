// src/components/UserWatcherModal.tsx

import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Dino, Obstacle, step, applyEvent } from "../gameLogic";

interface Props {
  userId: string;      // the target user’s ID (always non-null here)
  onClose: () => void;
}

interface DMItem {
  _id: any;
  fromUserId: string;
  toUserId: string;
  content: string;
  createdAt: number;
}

export function UserWatcherModal({ userId, onClose }: Props) {
  // ─── viewer’s profile (must exist) ──────────────────────
  const myProfile = useQuery(api.users.getProfile)!;
  const myUserId  = myProfile.userId as Id<"users">;

  // ─── watched user’s username ────────────────────────────
  const username =
    useQuery(api.profiles.getUsername, {
      userId: userId as Id<"users">,
    }) || "Unknown";

  // ─── live session logic (as before) ─────────────────────
  const activeSessions = useQuery(api.gameSessions.listActiveSessions) || [];
  const userSessions = useMemo(
    () => activeSessions.filter((s) => s.createdBy === userId),
    [activeSessions, userId]
  );
  const latest = useMemo(
    () =>
      userSessions.length
        ? [...userSessions].sort((a, b) => b.startedAt - a.startedAt)[0]
        : null,
    [userSessions]
  );
  const sessionId = latest!.sessionId;  // assert it’s defined when you draw the canvas

  // ─── incremental event buffering ────────────────────────
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

  // ─── simulation loop ────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(true);
  useEffect(() => {
    runningRef.current = true;
    if (!sessionId) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const dino: Dino = { x: 50, y: canvas.height - 60, vy: 0 };
    let obstacles: Obstacle[] = [];
    let cursor = 0;

    const loop = () => {
      if (!runningRef.current) return;
      while (cursor < bufRef.current.length) {
        const ev = bufRef.current[cursor++];
        applyEvent(
          ev.type as "jump" | "spawn",
          dino,
          obstacles,
          ev.data as Obstacle
        );
      }
      step(dino, obstacles);

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

    // reset state for new session
    bufRef.current = [];
    cursor = 0;
    requestAnimationFrame(loop);
    return () => {
      runningRef.current = false;
    };
  }, [sessionId]);

  // ─── direct messages ────────────────────────────────────
  // Query always takes non-null strings, cast to Id<"users">
  const dms = useQuery(api.directMessages.listDirectMessages, {
    userA: myUserId,
    userB: userId as Id<"users">,
  }) as DMItem[] | null;
  const directMsgs = dms || [];

  const sendDM = useMutation(api.directMessages.sendDirectMessage);
  const [newDM, setNewDM] = useState("");
  const dmRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dmRef.current?.scrollTo({ top: dmRef.current.scrollHeight });
  }, [directMsgs]);

  const handleSendDM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDM.trim()) return;
    await sendDM({
      toUserId: userId as Id<"users">,
      content: newDM.trim(),
    });
    setNewDM("");
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4">
      <div className="bg-gray-900 rounded-lg p-4 shadow-xl max-w-3xl w-full relative flex flex-col gap-4">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white"
        >
          ✕
        </button>

        <div className="text-white font-bold text-xl">
          Watching <span className="text-purple-300">{username}</span>
        </div>

        {sessionId ? (
          <canvas
            ref={canvasRef}
            width={800}
            height={300}
            className="w-full rounded bg-gray-800"
          />
        ) : (
          <div className="text-gray-400">User is not currently playing.</div>
        )}

        {/* Direct Messages */}
        <div
          ref={dmRef}
          className="flex-1 overflow-y-auto bg-gray-800 p-3 rounded flex flex-col gap-2"
        >
          {directMsgs.map((m: DMItem) => {
            const fromMe = m.fromUserId === myUserId;
            return (
              <div
                key={m._id.toString()}
                className={`max-w-[60%] p-2 rounded ${
                  fromMe
                    ? "bg-purple-700 self-end"
                    : "bg-gray-700 self-start"
                }`}
              >
                <div className="text-sm text-gray-300">
                  {fromMe ? "You" : username}
                </div>
                <div className="text-white">{m.content}</div>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSendDM} className="flex gap-2">
          <input
            type="text"
            value={newDM}
            onChange={(e) => setNewDM(e.target.value)}
            className="flex-1 p-2 rounded bg-gray-700 border border-purple-500 text-white"
            placeholder="Send a direct message…"
          />
          <button
            type="submit"
            disabled={!newDM.trim()}
            className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
