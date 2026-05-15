import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import BuildingDetail from './pages/BuildingDetail.jsx';
import BuildingForm from './pages/BuildingForm.jsx';
import ModuleForm from './pages/ModuleForm.jsx';
import Alerts from './pages/Alerts.jsx';
import AdminPanel from './pages/Admin.jsx';

// Guards
function AuthGuard({ children }) {
  const { isLoggedIn } = useAuth();
  const location = useLocation();
  if (!isLoggedIn) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function AdminGuard({ children }) {
  const { isLoggedIn, role } = useAuth();
  const location = useLocation();
  if (!isLoggedIn) return <Navigate to="/login" state={{ from: location }} replace />;
  if (role !== 'ADMIN') {
    return (
      <div className="empty-state">
        <h3>Přístup zamítnut</h3>
        <p>Tato sekce je dostupná pouze uživatelům s rolí ADMIN.</p>
        <p style={{ marginTop: 12, fontSize: '.85rem' }}>Vaše role: <strong>{role}</strong></p>
      </div>
    );
  }
  return children;
}

export default function App() {
  const { isLoggedIn } = useAuth();

  return (
    <div id="app">
      <Navbar />
      <main id="page-content" style={{ padding: '24px', maxWidth: 1280, margin: '0 auto' }}>
        <Routes>
          <Route path="/" element={<Navigate to={isLoggedIn ? '/dashboard' : '/login'} replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/building/:id" element={<AuthGuard><BuildingDetail /></AuthGuard>} />
          <Route path="/alerts" element={<AuthGuard><Alerts /></AuthGuard>} />

          <Route path="/admin" element={<AdminGuard><AdminPanel /></AdminGuard>} />
          <Route path="/building-new" element={<AdminGuard><BuildingForm /></AdminGuard>} />
          <Route path="/building-edit/:id" element={<AdminGuard><BuildingForm /></AdminGuard>} />
          <Route path="/module-new/:buildingId" element={<AdminGuard><ModuleForm /></AdminGuard>} />

          <Route path="*" element={
            <div className="empty-state">
              <h3>404</h3>
              <p>Stránka nenalezena</p>
            </div>
          } />
        </Routes>
      </main>
    </div>
  );
}
