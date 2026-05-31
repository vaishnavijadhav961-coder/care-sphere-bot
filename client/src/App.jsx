
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/AuthContext';
import { ThemeProvider } from './hooks/ThemeContext';
import ChatWidget from './components/ChatWidget';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Register from './pages/Register';
import './App.css';

import ProductGrid from './pages/ProductGrid';
import ProductPage from './pages/ProductPage';
import Compare     from './pages/Compare';
import Track       from './pages/Track';
import Coupons     from './pages/Coupons';
import Checkout    from './pages/Checkout';
import Orders      from './pages/Orders';

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

function ProtectedAdmin({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Sora, sans-serif' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isAdmin) return <Navigate to="/products" replace />;
  return children;
}

function AlreadyAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/products" replace />;
  return children;
}

function ProtectedUser({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Sora, sans-serif' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <ChatWidget initialProductContext={null} />

          <Routes>
            <Route path="/"                 element={<Navigate to="/products" replace />} />
            <Route path="/products"         element={<ProductGrid />} />
            <Route path="/products/:id"     element={<ProductPage />} />
            <Route path="/compare"          element={<Compare />} />
            <Route path="/track/:orderId"   element={<Track />} />
            <Route path="/coupons"          element={<Coupons />} />
            <Route path="/login"            element={<AlreadyAuth><Login /></AlreadyAuth>} />
            <Route path="/register"         element={<AlreadyAuth><Register /></AlreadyAuth>} />
            <Route path="/checkout"         element={<Checkout />} />
            <Route path="/orders"           element={<ProtectedUser><Orders /></ProtectedUser>} />
            <Route path="/admin"            element={<ProtectedAdmin><Admin /></ProtectedAdmin>} />
            <Route path="*"                 element={<NotFound />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
