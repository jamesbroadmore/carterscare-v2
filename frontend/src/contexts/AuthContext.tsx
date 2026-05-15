import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

type AppRole = "admin" | "moderator" | "user";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: AppRole | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);

  const fetchRole = async (userId: string) => {
    if (!supabase) {
      console.warn("[Auth] Supabase client not initialized");
      setRole("user");
      return;
    }
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();
      setRole((data?.role as AppRole) ?? "user");
    } catch (err) {
      console.error("[Auth] Failed to fetch role:", err);
      setRole("user");
    }
  };

  useEffect(() => {
    if (!supabase) {
      console.warn("[Auth] Supabase client not initialized, skipping auth setup");
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session?.user) {
          setTimeout(() => fetchRole(session.user.id), 0);
        } else {
          setRole(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      throw new Error("Supabase is not initialized. Please configure your environment variables.");
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    if (!supabase) {
      throw new Error("Supabase is not initialized. Please configure your environment variables.");
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const isAdmin = role === "admin" || role === "moderator";

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, role, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
