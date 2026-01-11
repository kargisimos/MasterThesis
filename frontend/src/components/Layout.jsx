import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import "./Layout.css";

const Layout = ({ children }) => {
  const { userRole, logout } = useAuth();

  return (
    <div className="dashboard-container">
      <aside className="dashboard-sidebar">
        <h2 className="dashboard-logo">Network Device Monitoring System</h2>
        <ul className="dashboard-menu">
          <li><Link to="/dashboard">Dashboard</Link></li>
          {(userRole === "admin" || userRole === "operator") && <li><Link to="/devices">Devices</Link></li>}
          {userRole === "admin" && <li><Link to="/users">Users</Link></li>}
          {userRole === "admin" && <li><Link to="/auditlogs">Audit Logs</Link></li>}
          <li><Link to="/settings">Settings</Link></li>
          <li><button className="logout-button" onClick={logout}>Logout</button></li>
        </ul>
      </aside>

      <main className="dashboard-main">
        {children}
      </main>
    </div>
  );
};

export default Layout;
