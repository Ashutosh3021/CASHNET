import { useEffect } from "react";
import { useLocation } from "wouter";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const authData = localStorage.getItem("cashnet_auth");
    if (!authData) {
      setLocation("/login");
    } else {
      try {
        const parsed = JSON.parse(authData);
        if (!parsed.authenticated) {
          setLocation("/login");
        }
      } catch (e) {
        setLocation("/login");
      }
    }
  }, [location, setLocation]);

  const authData = localStorage.getItem("cashnet_auth");
  if (!authData) return null;

  return <>{children}</>;
}
