/* ------------------------------------------------------------------
   Atlas Gaming Hub – root component
   ------------------------------------------------------------------ */

import {
  Authenticated,
  Unauthenticated,
  useQuery,
  useMutation,
} from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { useState } from "react";
import { LiveGamesSidebar } from "./components/LiveGamesSidebar";
import { GameContent } from "./components/GameContent";
import { Toaster, toast } from "sonner";

export default function App() {
  const profile = useQuery(api.users.getProfile);
  const createProfile = useMutation(api.users.createProfile);
  const [username, setUsername] = useState("");

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createProfile({ username });
      toast.success("Profile created!");
    } catch {
      toast.error("Username taken!");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-white">
      <header className="sticky top-0 z-10 bg-gray-800/80 backdrop-blur-sm p-4 flex justify-between items-center border-b border-purple-500">
        <h1 className="text-xl font-bold text-purple-400">Atlas Gaming Hub</h1>
        <SignOutButton />
      </header>

      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <Authenticated>
            {profile === null ? (
              <form onSubmit={handleCreateProfile} className="max-w-md mx-auto">
                <h2 className="text-2xl font-bold mb-4 text-center text-purple-400">
                  Choose Your Username
                </h2>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-2 rounded bg-gray-800 border border-purple-500 text-white"
                  placeholder="Enter username"
                />
                <button
                  type="submit"
                  className="w-full mt-4 p-2 rounded bg-purple-600 hover:bg-purple-700 transition"
                >
                  Create Profile
                </button>
              </form>
            ) : (
              /* ─── Logged in: sidebar + main area ─── */
              <div className="flex flex-col md:flex-row gap-8">
                <LiveGamesSidebar />
                <GameContent />
              </div>
            )}
          </Authenticated>

          <Unauthenticated>
            <div className="text-center mb-8">
              <h1 className="text-5xl font-bold text-purple-400 mb-4">
                Welcome to Atlas Gaming Hub
              </h1>
              <p className="text-xl text-gray-300">
                Sign in to start playing!
              </p>
            </div>
            <SignInForm />
          </Unauthenticated>
        </div>
      </main>

      <Toaster />
    </div>
  );
}
