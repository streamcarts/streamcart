import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth, AppRole } from "@/lib/auth";
import { Loader2 } from "lucide-react";

type RoleProp = AppRole | AppRole[] | "team";

export const RequireAuth = ({ children, role }: { children: ReactNode; role?: RoleProp }) => {
  const { user, roles, isTeam, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to={`/auth?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (role) {
    if (role === "team") {
      if (!isTeam) return <Navigate to="/" replace />;
    } else {
      const allowed = Array.isArray(role) ? role : [role];
      // Treat "admin" requirement as satisfied by any team role (page-level granularity is enforced inside)
      const ok = allowed.some((r) => {
        if (r === "admin") return isTeam;
        return roles.includes(r);
      });
      if (!ok) return <Navigate to="/" replace />;
    }
  }
  return <>{children}</>;
};
