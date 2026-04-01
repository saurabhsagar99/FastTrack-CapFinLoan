import { Navigate } from "react-router-dom";
import { normalizeRole } from "../utils/appUtils";

function Protected({ session, allowedRoles, children }) {
  const role = normalizeRole(session.role);
  if (!session.token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(role)) {
    return <Navigate to={role === "ADMIN" ? "/admin" : "/dashboard"} replace />;
  }

  return children;
}

export default Protected;
