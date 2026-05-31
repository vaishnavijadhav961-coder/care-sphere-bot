import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const isAdmin = await login(email, password);
      navigate(isAdmin ? '/admin' : '/products');
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    }
    setBusy(false);
  };

  return (
    <div className="auth-page">
      <style>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0B0F19 0%, #1a1f2e 100%);
          font-family: 'Sora', sans-serif;
          padding: 2rem;
        }
        .auth-card {
          background: #fff;
          border-radius: 20px;
          padding: 2.5rem;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .auth-card h1 {
          font-size: 1.75rem;
          font-weight: 700;
          color: #111827;
          margin: 0 0 0.25rem;
        }
        .auth-card p {
          color: #6B7280;
          font-size: 0.875rem;
          margin: 0 0 1.5rem;
        }
        .auth-field {
          margin-bottom: 1rem;
        }
        .auth-field label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          color: #374151;
          margin-bottom: 0.3rem;
        }
        .auth-field input {
          width: 100%;
          padding: 0.65rem 0.75rem;
          border: 1.5px solid #E5E7EB;
          border-radius: 10px;
          font-family: 'Sora', sans-serif;
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .auth-field input:focus { border-color: #2563EB; }
        .auth-btn {
          width: 100%;
          padding: 0.75rem;
          background: #2563EB;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-family: 'Sora', sans-serif;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          margin-top: 0.5rem;
        }
        .auth-btn:hover { background: #1D4ED8; }
        .auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .auth-error {
          background: #FEF2F2;
          color: #DC2626;
          font-size: 0.8rem;
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          margin-bottom: 1rem;
        }
        .auth-footer {
          text-align: center;
          margin-top: 1.25rem;
          font-size: 0.85rem;
          color: #6B7280;
        }
        .auth-footer a { color: #2563EB; text-decoration: none; font-weight: 600; }
        .auth-footer a:hover { text-decoration: underline; }
        .auth-logo {
          text-align: center;
          margin-bottom: 1.5rem;
        }
        .auth-logo a {
          font-size: 1.5rem;
          font-weight: 700;
          color: #2563EB;
          text-decoration: none;
          letter-spacing: -0.03em;
        }
        .auth-logo a span { color: #10B981; }
      `}</style>
      <div className="auth-card">
        <div className="auth-logo">
          <Link to="/">Care<span>Sphere</span></Link>
        </div>
        <h1>Welcome back</h1>
        <p>Sign in to your account</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="auth-btn" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account? <Link to="/register">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
