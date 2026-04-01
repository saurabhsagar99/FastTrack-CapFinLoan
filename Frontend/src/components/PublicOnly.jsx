import { Navigate, useLocation } from "react-router-dom";
import { normalizeRole } from "../utils/appUtils";

function PublicOnly({ session, children }) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isLoginAsOther = searchParams.has("as-other");

  if (!session.token) return children;
  if (isLoginAsOther) return children; // Allow login as different user

  const role = normalizeRole(session.role);
  return <Navigate to={role === "ADMIN" ? "/admin" : "/dashboard"} replace />;
}

export default PublicOnly;
