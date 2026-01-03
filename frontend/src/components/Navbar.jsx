import React from "react";
import { Link } from "react-router-dom";

const Navbar = ({ role }) => {
  return (
    <nav className="navbar">
      <ul>
        <li><Link to="/dashboard">Dashboard</Link></li>
        {role === "admin" && <li><Link to="/users">Users</Link></li>}
        {(role === "admin" || role === "operator") && (
          <li><Link to="/settings">Settings</Link></li>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;
