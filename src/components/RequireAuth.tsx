import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth, AppRole } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export const RequireAuth = ({ children, role }: { children: ReactNode; role?: AppRole }) => {
  const { user, roles, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to={`/auth?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (role && !roles.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
};
