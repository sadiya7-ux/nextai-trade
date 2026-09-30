
import type { ReactNode } from "react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/supabaseClient";

export interface User {
  name: string;
  email: string;
  avatarColor: string;
  id: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  signUp: (
    name: string,
    email: string,
    password: string,
    remember: boolean
  ) => Promise<{ ok: boolean; error?: string }>;
  signIn: (
    email: string,
    password: string,
    remember: boolean
  ) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (patch: { name?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AVATAR_COLORS = [
  "#E9BC3F",
  "#8FBF6F",
  "#6FA8BF",
  "#BF6F8F",
  "#9F8FBF",
  "#BF9F6F",
];

function convertUser(user: SupabaseUser): User {
  return {
    id: user.id,
    email: user.email ?? "",
    name:
      user.user_metadata?.name ??
      user.email?.split("@")[0] ??
      "Trader",
    avatarColor:
      AVATAR_COLORS[user.id.charCodeAt(0) % AVATAR_COLORS.length],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? convertUser(data.user) : null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? convertUser(session.user) : null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,

      signUp: async (name, email, password) => {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              name: name.trim(),
            },
          },
        });

        if (error) {
          return {
            ok: false,
            error: error.message,
          };
        }

        if (!data.user) {
          return {
            ok: false,
            error: "Could not create your account.",
          };
        }

        return {
          ok: true,
        };
      },

      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (error) {
          return {
            ok: false,
            error: error.message,
          };
        }

        return {
          ok: true,
        };
      },

      signOut: async () => {
        await supabase.auth.signOut();
      },

      updateProfile: async (patch) => {
        if (!user) return;

        const newName = patch.name?.trim() || user.name;

        // Update the user's name in Supabase Auth
        const { error: authError } = await supabase.auth.updateUser({
          data: {
            name: newName,
          },
        });

        if (authError) {
          console.error(
            "Failed to update auth profile:",
            authError
          );
          return;
        }

        // Update the user's name in the profiles table
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            name: newName,
          })
          .eq("id", user.id);

        if (profileError) {
          console.error(
            "Failed to update profiles table:",
            profileError
          );
          return;
        }

        console.log("Profile updated successfully");

        // Update the website immediately
        setUser({
          ...user,
          name: newName,
        });
      },
    }),
    [user, isLoading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return ctx;
}

