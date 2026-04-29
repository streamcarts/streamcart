import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Lightweight device fingerprint stored in localStorage; stable across sessions on the same browser.
function getDeviceFingerprint(): string {
  try {
    const KEY = "sc_device_fp";
    let fp = localStorage.getItem(KEY);
    if (!fp) {
      const seed = [
        navigator.userAgent,
        navigator.language,
        screen.width + "x" + screen.height,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 0,
        Math.random().toString(36).slice(2, 10),
      ].join("|");
      // Simple hash
      let h = 0;
      for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
      fp = "fp_" + Math.abs(h).toString(36) + "_" + Date.now().toString(36);
      localStorage.setItem(KEY, fp);
    }
    return fp;
  } catch {
    return "fp_unknown";
  }
}

export type AppRole = "admin" | "seller" | "buyer" | "super_admin" | "admin_staff" | "support";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  isAdmin: boolean;
  isSeller: boolean;
  isSuperAdmin: boolean;
  isAdminStaff: boolean;
  isSupport: boolean;
  isTeam: boolean;
  canManagePayments: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async (uid: string | undefined) => {
    if (!uid) return setRoles([]);
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setRoles((data ?? []).map((r) => r.role as AppRole));
  };

  useEffect(() => {
    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      setSession(s);
      // Defer Supabase calls
      setTimeout(() => fetchRoles(s?.user?.id), 0);
      // Log device session on sign-in for fraud intelligence
      if (evt === "SIGNED_IN" && s?.user?.id) {
        setTimeout(() => {
          try {
            const fp = getDeviceFingerprint();
            supabase.rpc("log_device_session", {
              _device_fp: fp,
              _ip: "",
              _user_agent: navigator.userAgent.slice(0, 300),
              _event: "login",
            }).then(() => {});
          } catch {}
        }, 0);
      }
    });
    // Then existing session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      fetchRoles(data.session?.user?.id).finally(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Online presence heartbeat — pings every 60s while logged in & tab visible
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    const ping = () => {
      if (document.visibilityState === "visible") {
        supabase.rpc("update_my_presence").then(() => {});
      }
    };
    ping();
    const i = setInterval(ping, 60_000);
    const onVis = () => ping();
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(i); document.removeEventListener("visibilitychange", onVis); };
  }, [session?.user?.id]);

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    roles,
    isAdmin: roles.includes("admin"),
    isSeller: roles.includes("seller"),
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refreshRoles: async () => fetchRoles(session?.user?.id),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Safe fallback (prevents blank screen during HMR remounts).
    return {
      session: null,
      user: null,
      roles: [] as AppRole[],
      isAdmin: false,
      isSeller: false,
      loading: true,
      signOut: async () => {},
      refreshRoles: async () => {},
    } as AuthCtx;
  }
  return ctx;
};
