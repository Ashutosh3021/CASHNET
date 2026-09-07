import { Redirect } from "wouter";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const authData = localStorage.getItem("cashnet_auth");

  let isAuthenticated = false;
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      isAuthenticated = !!parsed.authenticated;
    } catch (e) {
      // Ignore parse error
    }
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" replace />;
  }

  return <>{children}</>;
}
