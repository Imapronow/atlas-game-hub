// src/App.tsx
import "./index.css";
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
    <div className="relative min-h-screen overflow-hidden bg-black">
      <div className="crt-overlay" />

      <header className="sticky top-0 z-20 glow bg-gray-800/80 backdrop-blur-sm p-4 flex justify-between items-center border-b border-neon-purple">
        <h1 className="text-xl neon-text text-neon-purple">Atlas Gaming Hub</h1>
        <SignOutButton/>
      </header>

      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <Authenticated>
            {profile === null ? (
              <form onSubmit={handleCreateProfile} className="max-w-md mx-auto">
                <h2 className="text-2xl font-bold mb-4 neon-text text-neon-purple text-center">
                  Choose Your Username
                </h2>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-2 rounded bg-gray-800 border border-neon-purple text-white"
                  placeholder="Enter username"
                />
                <button
                  type="submit"
                  className="w-full mt-4 p-2 rounded bg-neon-purple hover:bg-neon-magenta transition glow"
                >
                  Create Profile
                </button>
              </form>
            ) : (
              <div className="flex flex-col md:flex-row gap-8">
                <LiveGamesSidebar />
                <GameContent />
              </div>
            )}
          </Authenticated>

          <Unauthenticated>
            <div className="text-center mb-8">
              <h1 className="text-5xl neon-text text-neon-cyan mb-4">
                Welcome to Atlas Gaming Hub
              </h1>
              <p className="text-xl text-gray-300">Sign in to start playing!</p>
            </div>
            <SignInForm />
          </Unauthenticated>
        </div>
      </main>

      <Toaster />
    </div>
  );
}
