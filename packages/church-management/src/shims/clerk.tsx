/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface ClerkUser {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  imageUrl?: string;
  primaryEmailAddress?: { emailAddress?: string } | null;
  emailAddresses?: Array<{ emailAddress?: string }>;
  organizationRole?: string;
}

interface ClerkContextValue {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: ClerkUser | null;
  setUser: (user: ClerkUser | null) => void;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  refresh: () => Promise<void>;
  getToken: (options?: { template?: string }) => Promise<string | null>;
}

interface HkmIdentity {
  success?: boolean;
  identity?: {
    user: { id: string; email: string; name: string };
    organization?: { role: string } | null;
  };
  error?: string;
  message?: string;
}

function toClerkUser(identity: NonNullable<HkmIdentity["identity"]>): ClerkUser {
  const [firstName, ...lastName] = identity.user.name.split(/\s+/);
  return {
    id: identity.user.id,
    fullName: identity.user.name,
    firstName,
    lastName: lastName.join(" "),
    username: identity.user.email.split("@")[0],
    primaryEmailAddress: { emailAddress: identity.user.email },
    emailAddresses: [{ emailAddress: identity.user.email }],
    organizationRole: identity.organization?.role,
  };
}

async function responseJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? data.error ?? "Authentication failed.");
  return data;
}

const ClerkContext = createContext<ClerkContextValue | null>(null);

export function ClerkProvider({ children }: { children?: React.ReactNode; publishableKey?: string; appearance?: any }) {
  const [user, setUser] = useState<ClerkUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const refresh = async () => {
    try {
      const response = await fetch("/api/church/hkm/admin/session/activate", { credentials: "include", cache: "no-store" });
      if (!response.ok) {
        setUser(null);
        return;
      }
      const result = await responseJson(response) as HkmIdentity;
      setUser(result.identity ? toClerkUser(result.identity) : null);
    } catch {
      setUser(null);
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const signIn = async (email: string, password: string) => {
    const signedIn = await responseJson(await fetch("/api/auth/sign-in/email", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberMe: true }),
    })) as { user?: { id: string; email: string; name: string } };
    if (!signedIn.user) throw new Error("The identity service returned no user session.");
    const active = await responseJson(await fetch("/api/church/hkm/admin/session/activate", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    })) as HkmIdentity;
    if (!active.identity) throw new Error("Your account does not have HKM administrator access.");
    setUser(toClerkUser(active.identity));
    setIsLoaded(true);
  };

  const signOut = async () => {
    try {
      await fetch("/api/auth/sign-out", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    } finally {
      setUser(null);
    }
  };

  return <ClerkContext.Provider value={{ isLoaded, isSignedIn: Boolean(user), user, setUser, signOut, signIn, refresh, getToken: async () => null }}>{children}</ClerkContext.Provider>;
}

function useClerkContext() {
  const context = useContext(ClerkContext);
  if (!context) throw new Error("Authentication hooks must be used inside ClerkAuthProvider.");
  return context;
}

export function useUser() {
  const context = useClerkContext();
  return { isLoaded: context.isLoaded, isSignedIn: context.isSignedIn, user: context.user };
}

export function useAuth() {
  const context = useClerkContext();
  return {
    isLoaded: context.isLoaded,
    isSignedIn: context.isSignedIn,
    userId: context.user?.id ?? null,
    sessionId: null,
    signOut: context.signOut,
    getToken: context.getToken,
  };
}

export function useSignIn() {
  const context = useClerkContext();
  return {
    isLoaded: context.isLoaded,
    signIn: { create: async ({ identifier, password }: { identifier: string; password: string }) => {
      await context.signIn(identifier, password);
      return { status: "complete" as const };
    } },
  };
}

export function useSignUp() {
  return {
    isLoaded: true,
    signUp: { create: async () => { throw new Error("Self-registration is disabled. Ask an HKM tenant administrator for an invitation."); } },
  };
}

export function useClerk() {
  const context = useClerkContext();
  return { signOut: context.signOut };
}

export function SignIn() {
  const { signIn } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError("");
    try { await signIn.create({ identifier: email, password }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to sign in."); setPassword(""); }
    finally { setLoading(false); }
  };
  return <form onSubmit={submit} className="space-y-4 text-white">
    <div><label className="mb-1 block text-xs font-semibold text-slate-300">Email Address</label><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-white" required /></div>
    <div><label className="mb-1 block text-xs font-semibold text-slate-300">Password</label><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-white" required /></div>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    <button type="submit" disabled={loading} className="w-full rounded-xl bg-green-600 py-3 font-bold text-white disabled:opacity-60">{loading ? "Signing in…" : "Sign In to Church CMS"}</button>
  </form>;
}

export function SignUp() {
  return <p className="text-sm text-slate-300">Self-registration is disabled. Ask an HKM tenant administrator for an invitation.</p>;
}
