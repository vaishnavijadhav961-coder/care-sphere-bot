import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { useRealtimeListener } from '../hooks/useRealtimeListener';
import { useTheme } from '../hooks/ThemeContext';

export default function TopNav({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const cartPath = user ? `carts/${user.uid}` : null;
  const { data: cartItems } = useRealtimeListener(cartPath);
  const cartCount = cartItems ? cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0) : 0;

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <>
      <style>{`
        .tn-nav {
          background: #fff;
          border-bottom: 1px solid #E5E7EB;
          padding: 0 2rem;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
          gap: 1rem;
          font-family: 'Sora', sans-serif;
        }
        .tn-logo {
          font-weight: 700;
          font-size: 1.25rem;
          color: #2563EB;
          letter-spacing: -0.03em;
          white-space: nowrap;
          text-decoration: none;
        }
        .tn-logo span { color: #10B981; }
        .tn-center { flex: 1; display: flex; align-items: center; gap: 0.75rem; }
        .tn-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          white-space: nowrap;
        }
        .tn-btn {
          padding: 0.4rem 1rem;
          border-radius: 8px;
          font-family: 'Sora', sans-serif;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.15s;
          border: none;
        }
        .tn-btn-outline {
          background: transparent;
          color: #2563EB;
          border: 1.5px solid #2563EB;
        }
        .tn-btn-outline:hover { background: #EFF6FF; }
        .tn-btn-solid {
          background: #2563EB;
          color: #fff;
        }
        .tn-btn-solid:hover { background: #1D4ED8; }
        .tn-btn-ghost {
          background: transparent;
          color: #374151;
          border: none;
        }
        .tn-btn-ghost:hover { background: #F3F4F6; }
        .tn-cart-btn {
          position: relative;
          background: transparent;
          border: none;
          font-size: 1.3rem;
          cursor: pointer;
          padding: 0.3rem;
          line-height: 1;
          display: flex;
          align-items: center;
        }
        .tn-cart-badge {
          position: absolute;
          top: -4px;
          right: -6px;
          background: #EF4444;
          color: #fff;
          font-size: 0.6rem;
          font-weight: 700;
          min-width: 16px;
          height: 16px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 3px;
          font-family: 'DM Mono', monospace;
        }
        .tn-user-trigger {
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.3rem 0.5rem;
          border-radius: 8px;
          font-family: 'Sora', sans-serif;
          font-size: 0.8rem;
          font-weight: 600;
          color: #374151;
          transition: background 0.15s;
        }
        .tn-user-trigger:hover { background: #F3F4F6; }
        .tn-dropdown-wrap { position: relative; }
        .tn-dropdown {
          position: absolute;
          right: 0;
          top: calc(100% + 6px);
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          min-width: 200px;
          padding: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          z-index: 200;
        }
        .tn-dropdown-header {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid #F3F4F6;
          margin-bottom: 0.25rem;
        }
        .tn-dropdown-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: #111827;
        }
        .tn-dropdown-email {
          font-size: 0.7rem;
          color: #9CA3AF;
          font-family: 'DM Mono', monospace;
        }
        .tn-dropdown-item {
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: transparent;
          border: none;
          font-family: 'Sora', sans-serif;
          transition: background 0.15s;
          width: 100%;
          text-align: left;
        }
        .tn-dropdown-item:hover { background: #F3F4F6; }
        .tn-dropdown-divider {
          height: 1px;
          background: #F3F4F6;
          margin: 0.25rem 0;
        }
        @media (max-width: 640px) {
          .tn-nav { padding: 0 1rem; }
          .tn-btn { font-size: 0.75rem; padding: 0.3rem 0.6rem; }
        }
      `}</style>

      <nav className="tn-nav">
        <Link to="/products" className="tn-logo">Care<span>Sphere</span></Link>

        <div className="tn-center">
          {children}
        </div>

        <div className="tn-right">
          {user && (
            <button className="tn-cart-btn" onClick={() => navigate('/checkout')} title="Cart">
              🛒
              {cartCount > 0 && <span className="tn-cart-badge">{cartCount}</span>}
            </button>
          )}
          {user ? (
            <div className="tn-dropdown-wrap" ref={dropdownRef}>
              <button className="tn-user-trigger" onClick={() => setDropdownOpen((v) => !v)}>
                {user.displayName} {user.isAdmin && <span className="tn-admin-badge" style={{ fontSize: '0.65rem', fontWeight: 600, color: '#F59E0B', background: '#FFFBEB', padding: '0.15rem 0.5rem', borderRadius: 4 }}>Admin</span>}
                <span style={{ fontSize: '0.6rem', marginLeft: '0.25rem' }}>{dropdownOpen ? '▲' : '▼'}</span>
              </button>
              {dropdownOpen && (
                <div className="tn-dropdown">
                  <div className="tn-dropdown-header">
                    <div className="tn-dropdown-name">{user.displayName}</div>
                    <div className="tn-dropdown-email">{user.email}</div>
                  </div>
                  <Link to="/orders" className="tn-dropdown-item" onClick={() => setDropdownOpen(false)}>
                    📋 My Orders
                  </Link>
                  {user.isAdmin && (
                    <Link to="/admin" className="tn-dropdown-item" onClick={() => setDropdownOpen(false)}>
                      🖥 Dashboard
                    </Link>
                  )}
                  <div className="tn-dropdown-divider" />
                  <button className="tn-dropdown-item" onClick={() => { toggleTheme(); setDropdownOpen(false); }}>
                    {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
                  </button>
                  <div className="tn-dropdown-divider" />
                  <button className="tn-dropdown-item" onClick={() => { logout(); setDropdownOpen(false); }} style={{ color: '#EF4444' }}>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button className="tn-btn tn-btn-ghost" onClick={() => navigate('/login')}>Sign In</button>
              <button className="tn-btn tn-btn-solid" onClick={() => navigate('/register')}>Sign Up</button>
            </>
          )}
        </div>
      </nav>
    </>
  );
}
