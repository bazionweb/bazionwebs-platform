/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface ClerkUser {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  imageUrl?: string;
  primaryEmailAddress?: { emailAddress?: string } | null;
  emailAddresses?: Array<{ emailAddress?: string }>;
}

interface ClerkContextValue {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: ClerkUser | null;
  setUser: (u: ClerkUser | null) => void;
  signOut: () => Promise<void>;
  getToken: (options?: { template?: string }) => Promise<string | null>;
}

const defaultUser: ClerkUser = {
  id: "user_hkm_admin_001",
  fullName: "Senior Pastor",
  firstName: "Senior",
  lastName: "Pastor",
  username: "pastor",
  imageUrl: "https://ui-avatars.com/api/?name=Senior+Pastor",
  primaryEmailAddress: { emailAddress: "pastor@hkm.org" },
  emailAddresses: [{ emailAddress: "pastor@hkm.org" }],
};

const ClerkContext = createContext<ClerkContextValue>({
  isLoaded: true,
  isSignedIn: true,
  user: defaultUser,
  setUser: () => {},
  signOut: async () => {},
  getToken: async () => "mock-supabase-clerk-token",
});

export function ClerkProvider({
  children,
  publishableKey: _pk,
  appearance: _app,
}: {
  children?: React.ReactNode;
  publishableKey?: string;
  appearance?: any;
}) {
  const [user, setUser] = useState<ClerkUser | null>(defaultUser);
  const [isLoaded, setIsLoaded] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("hkm_clerk_user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {}
    setIsLoaded(true);
  }, []);

  const signOut = async () => {
    setUser(null);
    try {
      localStorage.removeItem("hkm_clerk_user");
    } catch {}
  };

  const getToken = async (_options?: { template?: string }) => {
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.mock-token";
  };

  return (
    <ClerkContext.Provider
      value={{
        isLoaded,
        isSignedIn: Boolean(user),
        user,
        setUser,
        signOut,
        getToken,
      }}
    >
      {children}
    </ClerkContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(ClerkContext);
  return {
    isLoaded: ctx.isLoaded,
    isSignedIn: ctx.isSignedIn,
    user: ctx.user,
  };
}

export function useAuth() {
  const ctx = useContext(ClerkContext);
  return {
    isLoaded: ctx.isLoaded,
    isSignedIn: ctx.isSignedIn,
    userId: ctx.user?.id || null,
    sessionId: "sess_hkm_001",
    signOut: ctx.signOut,
    getToken: ctx.getToken,
  };
}

export function useSignIn() {
  const ctx = useContext(ClerkContext);
  return {
    isLoaded: true,
    signIn: {
      create: async ({ identifier, password }: any) => {
        const loggedUser: ClerkUser = {
          id: `usr_${identifier.replace(/[^a-zA-Z0-9]/g, "_")}`,
          username: identifier.split("@")[0] || "admin",
          fullName: identifier.split("@")[0] || "Church Admin",
          primaryEmailAddress: { emailAddress: identifier },
          imageUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(identifier)}`,
        };
        ctx.setUser(loggedUser);
        try {
          localStorage.setItem("hkm_clerk_user", JSON.stringify(loggedUser));
        } catch {}
        return { status: "complete" };
      },
    },
  };
}

export function useSignUp() {
  const ctx = useContext(ClerkContext);
  return {
    isLoaded: true,
    signUp: {
      create: async ({ emailAddress }: any) => {
        const newUser: ClerkUser = {
          id: `usr_${Date.now()}`,
          username: emailAddress.split("@")[0] || "member",
          fullName: emailAddress.split("@")[0] || "New Member",
          primaryEmailAddress: { emailAddress },
          imageUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(emailAddress)}`,
        };
        ctx.setUser(newUser);
        try {
          localStorage.setItem("hkm_clerk_user", JSON.stringify(newUser));
        } catch {}
        return { status: "complete" };
      },
    },
  };
}

export function SignIn({
  routing: _r,
  appearance: _a,
}: {
  routing?: string;
  appearance?: any;
}) {
  const [email, setEmail] = useState("admin@hkm.org");
  const [password, setPassword] = useState("••••••••");
  const { signIn } = useSignIn();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn.create({ identifier: email, password });
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4 text-white">
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          required
        />
      </div>
      <button
        type="submit"
        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all"
      >
        Sign In to Church CMS
      </button>
    </form>
  );
}

export function SignUp({
  routing: _r,
  signInUrl: _s,
  unsafeMetadata: _u,
  appearance: _a,
}: {
  routing?: string;
  signInUrl?: string;
  unsafeMetadata?: any;
  appearance?: any;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signUp } = useSignUp();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    await signUp.create({ emailAddress: email, password });
  };

  return (
    <form onSubmit={handleRegister} className="space-y-4 text-white">
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">Choose Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          required
        />
      </div>
      <button
        type="submit"
        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all"
      >
        Create Ministry Account
      </button>
    </form>
  );
}

