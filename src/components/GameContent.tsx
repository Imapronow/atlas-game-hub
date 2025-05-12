// src/components/GameContent.tsx
import { useEffect, useRef, useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import DinoGame from "./DinoGame";
import { ReplayModal } from "./ReplayModal";
import { UserWatcherModal } from "./UserWatcherModal";
import { toast } from "sonner";

export function GameContent() {
  const comments    = useQuery(api.comments.listComments) || [];
  const sendComment = useMutation(api.comments.sendComment);

  const rawScores = useQuery(api.gameSessions.topScores) || [];
  const topScores = useMemo(() => {
    const map = new Map<string, typeof rawScores[0]>();
    for (const s of rawScores) {
      const existing = map.get(s.createdBy);
      if (!existing || (s.finalScore! > existing.finalScore!)) {
        map.set(s.createdBy, s);
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.finalScore! - a.finalScore!
    );
  }, [rawScores]);

  const activeSessions = useQuery(api.gameSessions.listActiveSessions) || [];
  const activeUserIds  = useMemo(
    () => new Set(activeSessions.map((s) => s.createdBy)),
    [activeSessions]
  );

  const [replayId,  setReplayId]  = useState<string | null>(null);
  const [watchUser, setWatchUser] = useState<string | null>(null);

  const [newComment, setNewComment] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [comments]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await sendComment({ content: newComment.trim() });
      setNewComment("");
    } catch {
      toast.error("Failed to send message");
    }
  };

  return (
    <>
      {replayId && (
        <ReplayModal sessionId={replayId} onClose={() => setReplayId(null)} />
      )}
      {watchUser && (
        <UserWatcherModal
          userId={watchUser}
          onClose={() => setWatchUser(null)}
        />
      )}

      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1 flex flex-col">
          <DinoGame />

          <section className="mt-4 bg-gray-800 p-4 rounded-lg">
            <h2 className="text-2xl font-bold mb-4 text-purple-400">
              Top Scores
            </h2>
            <div className="space-y-2">
              {topScores.map((s, i) => {
                const isActive = activeUserIds.has(s.createdBy);
                return (
                  <ScoreRow
                    key={s.createdBy}
                    rank={i + 1}
                    userId={s.createdBy}
                    score={s.finalScore!}
                    isActive={isActive}
                    onReplay={() => setReplayId(s.sessionId)}
                    onWatchUser={() =>
                      isActive && setWatchUser(s.createdBy)
                    }
                  />
                );
              })}
            </div>
          </section>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg flex flex-col h-[800px]">
          <h2 className="text-2xl font-bold mb-4 text-purple-400">Chat</h2>
          <div
            ref={chatRef}
            className="flex-1 overflow-y-auto mb-4 space-y-2 scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-700"
          >
            {comments.map((c) => {
              const isActive = activeUserIds.has(c.userId);
              return (
                <div
                  key={c._id}
                  className="bg-gray-700 p-2 rounded flex items-center gap-2"
                >
                  {isActive && (
                    <span
                      className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse cursor-pointer"
                      title="Watch this user live"
                      onClick={() => setWatchUser(c.userId)}
                    />
                  )}
                  <span className="text-purple-300 font-bold">
                    {c.username}:
                  </span>
                  <span className="text-gray-100">{c.content}</span>
                </div>
              );
            })}
          </div>
          <form onSubmit={send} className="flex gap-2">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1 p-2 rounded bg-gray-700 border border-purple-500 text-white"
              placeholder="Type a message..."
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

function ScoreRow({
  rank,
  userId,
  score,
  isActive,
  onReplay,
  onWatchUser,
}: {
  rank: number;
  userId: string;
  score: number;
  isActive: boolean;
  onReplay: () => void;
  onWatchUser: () => void;
}) {
  const username =
    useQuery(api.profiles.getUsername, {
      userId: userId as Id<"users">,
    }) || "Unknown";

  return (
    <button
      onClick={onReplay}
      className="flex w-full justify-between items-center bg-gray-700 p-2 rounded hover:bg-gray-600"
    >
      <div className="flex items-center gap-2">
        {isActive && (
          <span
            className="w-2 h-2 bg-green-400 rounded-full animate-pulse cursor-pointer"
            title="Watch this user live"
            onClick={(e) => {
              e.stopPropagation();
              onWatchUser();
            }}
          />
        )}
        <span className="text-yellow-400 font-bold">#{rank}</span>
        <span className="text-purple-300">{username}</span>
      </div>
      <span className="text-yellow-400 font-bold">{score}</span>
    </button>
  );
}
