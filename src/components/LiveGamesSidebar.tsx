import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { SpectatorModal } from "./SpectatorModal";

export function LiveGamesSidebar() {
  const sessions = useQuery(api.gameSessions.listActiveSessions) || [];
  const [watchId, setWatchId] = useState<string | null>(null);

  return (
    <>
      <aside className="w-60 shrink-0 border-r border-gray-700 bg-gray-800 p-4 space-y-2">
        <h3 className="text-lg font-bold text-purple-400 mb-2">Live Games</h3>
        {sessions.length === 0 && (
          <p className="text-sm text-gray-400">No active sessions</p>
        )}
        {sessions.map(s => (
          <button
            key={s.sessionId}
            onClick={() => setWatchId(s.sessionId)}
            className="block w-full text-left px-2 py-1 rounded hover:bg-gray-700"
          >
            {s.sessionId.slice(0, 8)}… 
            <span className="text-gray-400 text-xs">
              {Math.floor((Date.now() - s.startedAt) / 1000)} s
            </span>
          </button>
        ))}
      </aside>

      {watchId && (
        <SpectatorModal
          sessionId={watchId}
          onClose={() => setWatchId(null)}
        />
      )}
    </>
  );
}
