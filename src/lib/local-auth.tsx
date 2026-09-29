import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * Local-only mock auth. Keeps the user in localStorage so the session survives
 * reloads ("remember me"). Replace with a real auth provider later; the
 * `useAuth` interface is intentionally small.
 */

export interface User {
  name: string;
  email: string;
  avatarColor: string;
  password?: string; // stored only in this mock layer
}

interface StoredAuth {
  user: User;
  remember: boolean;
}

const USERS_KEY = "nexttrade.users";
const SESSION_KEY = "nexttrade.session";

const AVATAR_COLORS = ["#E9BC3F", "#8FBF6F", "#6FA8BF", "#BF6F8F", "#9F8FBF", "#BF9F6F"];

function readUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as User[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function readSession(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  signUp: (name: string, email: string, password: string, remember: boolean) => { ok: boolean; error?: string };
  signIn: (email: string, password: string, remember: boolean) => { ok: boolean; error?: string };
  signOut: () => void;
  updateProfile: (patch: { name?: string }) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = readSession();
    if (session?.user) setUser(session.user);
    setIsLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const persist = (u: User, remember: boolean) => {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ user: u, remember }));
      setUser(u);
    };

    return {
      user,
      isLoading,
      signUp: (name, email, password, remember) => {
        const users = readUsers();
        const normalized = email.trim().toLowerCase();
        if (users.some((u) => u.email === normalized)) {
          return { ok: false, error: "An account with this email already exists." };
        }
        const newUser: User = {
          name: name.trim() || normalized.split("@")[0],
          email: normalized,
          password,
          avatarColor: AVATAR_COLORS[users.length % AVATAR_COLORS.length],
        };
        writeUsers([...users, newUser]);
        persist(newUser, remember);
        return { ok: true };
      },
      signIn: (email, password, remember) => {
        const normalized = email.trim().toLowerCase();
        const users = readUsers();
        const found = users.find((u) => u.email === normalized);
        if (!found) return { ok: false, error: "No account found for this email. Sign up first." };
        if (found.password && found.password !== password) {
          return { ok: false, error: "Incorrect password." };
        }
        persist(found, remember);
        return { ok: true };
      },
      signOut: () => {
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
      },
      updateProfile: (patch) => {
        if (!user) return;
        const updated = { ...user, ...patch };
        const users = readUsers().map((u) => (u.email === user.email ? updated : u));
        writeUsers(users);
        const session = readSession();
        if (session) persist(updated, session.remember);
        else setUser(updated);
      },
    };
  }, [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
