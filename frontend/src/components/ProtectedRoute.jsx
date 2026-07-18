import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Layout from "./Layout.jsx";

export function ProtectedRoute({ children, adminOnly = false }) {
  const { auth } = useAuth();

  if (!auth) return <Navigate to="/login" replace />;
  if (adminOnly && auth.role !== "admin") return <Navigate to="/pos" replace />;

  return <Layout>{children}</Layout>;
}
