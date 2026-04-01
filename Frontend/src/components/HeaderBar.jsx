import { Link } from "react-router-dom";

function HeaderBar({ gateway, setGateway, session, onLogout }) {
  return (
    <header className="topbar">
      <div className="brand">
        <p>CapFinLoan</p>
        <h1>Loan Workflow Portal</h1>
      </div>

      <div className="menu-spacer"></div>

      <div className="menu">
        {!session.token ? (
          <>
            <Link to="/login">Login</Link>
            <Link to="/signup">Signup</Link>
          </>
        ) : (
          <>
            <button type="button" className="ghost-btn" onClick={onLogout}>
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
}

export default HeaderBar;
