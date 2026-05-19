import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Admin from './pages/Admin';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Default Route redirects to Admin Panel for hackathon convenience */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
        
        {/* Admin Dashboard */}
        <Route path="/admin" element={<Admin />} />
        
        {/* Fallback route */}
        <Route path="*" element={
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            fontFamily: 'sans-serif',
            background: '#0B0F19',
            color: 'white',
            gap: '1rem'
          }}>
            <h1 style={{ fontSize: '3rem', margin: 0, color: '#EF4444' }}>404</h1>
            <p style={{ color: '#9CA3AF' }}>Page Lost in Deep Space</p>
            <Link to="/admin" style={{
              background: '#2563EB',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              fontWeight: 'bold',
              transition: 'background 0.2s'
            }}>Return to Cosmic Admin</Link>
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App;
