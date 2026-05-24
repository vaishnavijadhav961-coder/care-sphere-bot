import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import ChatWidget from './components/ChatWidget';
import Admin from './pages/Admin';
import './App.css';

// ─── Placeholder page factory (used until P2 delivers their pages) ─────────
function PlaceholderPage({ icon, title, note }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0B0F19',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', sans-serif",
      color: '#fff',
      gap: '1rem',
      textAlign: 'center',
      padding: '2rem',
    }}>
      <div style={{ fontSize: '3rem' }}>{icon}</div>
      <h1 style={{ fontSize: '1.5rem', margin: 0, color: '#93c5fd' }}>{title}</h1>
      <p style={{ color: '#6B7280', margin: 0, fontSize: '0.875rem' }}>{note}</p>
      <Link to="/admin" style={{ color: '#2563EB', textDecoration: 'none', fontSize: '0.875rem' }}>
        ← Go to Admin Panel
      </Link>
    </div>
  );
}

// ─── Stub pages (replace with P2's real imports when they deliver) ─────────
import ProductGrid from './pages/ProductGrid';
import ProductPage from './pages/ProductPage';
import Compare     from './pages/Compare';
import Track       from './pages/Track';
import Coupons     from './pages/Coupons';

// ─── 404 ──────────────────────────────────────────────────────────────────
function NotFound() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh',
      fontFamily: "'Inter', sans-serif", background: '#0B0F19', color: '#fff', gap: '1rem',
    }}>
      <h1 style={{ fontSize: '4rem', margin: 0, color: '#EF4444' }}>404</h1>
      <p style={{ color: '#9CA3AF', margin: 0 }}>Page not found</p>
      <Link to="/products" style={{
        background: '#2563EB', color: '#fff', padding: '0.75rem 1.5rem',
        borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600,
      }}>
        Go to Store
      </Link>
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────
function App() {
  return (
    <Router>
      {/*
        ChatWidget is mounted OUTSIDE <Routes> so it persists across all pages.
        P2 can remove this line if they want per-page control, but the
        recommended approach is to keep it here for the demo.
      */}
      <ChatWidget initialProductContext={null} />

      <Routes>
        <Route path="/"                 element={<Navigate to="/products" replace />} />
        <Route path="/products"         element={<ProductGrid />} />
        <Route path="/products/:id"     element={<ProductPage />} />
        <Route path="/compare"          element={<Compare />} />
        <Route path="/track/:orderId"   element={<Track />} />
        <Route path="/coupons"          element={<Coupons />} />
        <Route path="/admin"            element={<Admin />} />
        <Route path="*"                 element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
