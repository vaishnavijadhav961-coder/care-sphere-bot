import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { useRealtimeListener } from '../hooks/useRealtimeListener';
import TopNav from '../components/TopNav';

const STATUS_COLORS = {
  Confirmed: '#2563EB',
  Shipped: '#0369A1',
  Delayed: '#D97706',
  'Out for Delivery': '#7C3AED',
  Delivered: '#15803D',
};

export default function Account() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: orders, loading } = useRealtimeListener('orders', 'orderDate', 'desc');

  if (!user) {
    return (
      <>
        <style>{styles}</style>
        <TopNav />
        <div className="ac-page">
          <div className="ac-empty">
            <span style={{ fontSize: '2rem' }}>🔒</span>
            <h2>Sign in to view your account</h2>
            <button className="ac-btn-primary" onClick={() => navigate('/login')}>Sign In</button>
          </div>
        </div>
      </>
    );
  }

  const myOrders = orders.filter((o) => o.customerId === user.uid);

  const formatDate = (iso) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return iso; }
  };

  return (
    <>
      <style>{styles}</style>
      <TopNav />
      <div className="ac-page">
        <div className="ac-container">
          <div className="ac-header">
            <div>
              <h1 className="ac-greeting">Hello, {user.displayName}</h1>
              <p className="ac-email">{user.email}</p>
            </div>
          </div>

          <h2 className="ac-section-title">My Orders</h2>

          {loading ? (
            <div className="ac-loading">
              <div className="ac-spinner" />
              <span>Loading orders...</span>
            </div>
          ) : myOrders.length === 0 ? (
            <div className="ac-empty">
              <span style={{ fontSize: '3rem' }}>📦</span>
              <h2>No orders yet</h2>
              <p>Place your first order to see it here.</p>
              <button className="ac-btn-primary" onClick={() => navigate('/products')}>Browse Products</button>
            </div>
          ) : (
            <div className="ac-orders">
              {myOrders.map((order) => (
                <div
                  key={order.id}
                  className="ac-order-card"
                  onClick={() => navigate(`/track/${order.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/track/${order.id}`)}
                >
                  <div className="ac-order-top">
                    <span className="ac-order-id">{order.id}</span>
                    <span
                      className="ac-order-status"
                      style={{ background: STATUS_COLORS[order.status] || '#6B7280', color: '#fff' }}
                    >
                      {order.status}
                    </span>
                  </div>
                  <div className="ac-order-mid">
                    <span className="ac-order-product">{order.productName}</span>
                  </div>
                  <div className="ac-order-bottom">
                    <span className="ac-order-date">Ordered: {formatDate(order.orderDate)}</span>
                    <span className="ac-order-price">₹{Number(order.price || 0).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  .ac-page {
    min-height: 100vh;
    background: #F9FAFB;
    font-family: 'Sora', sans-serif;
    color: #111827;
  }
  .ac-container {
    max-width: 720px;
    margin: 0 auto;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .ac-header {
    background: #fff;
    border: 1px solid #E5E7EB;
    border-radius: 16px;
    padding: 1.5rem 2rem;
  }
  .ac-greeting {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: #111827;
  }
  .ac-email {
    font-size: 0.85rem;
    color: #6B7280;
    margin: 0.25rem 0 0;
    font-family: 'DM Mono', monospace;
  }
  .ac-section-title {
    font-size: 1rem;
    font-weight: 700;
    margin: 0;
    color: #111827;
  }
  .ac-loading {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 30vh; gap: 1rem; color: #6B7280;
  }
  .ac-spinner {
    width: 36px; height: 36px;
    border: 3px solid #E5E7EB; border-top-color: #2563EB;
    border-radius: 50%; animation: acspin 0.8s linear infinite;
  }
  @keyframes acspin { to { transform: rotate(360deg); } }
  .ac-empty {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 30vh; gap: 0.75rem; text-align: center;
  }
  .ac-empty h2 { margin: 0; font-size: 1.25rem; }
  .ac-empty p { margin: 0; color: #6B7280; }
  .ac-orders {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .ac-order-card {
    background: #fff;
    border: 1px solid #E5E7EB;
    border-radius: 12px;
    padding: 1rem 1.25rem;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .ac-order-card:hover {
    border-color: #2563EB;
    box-shadow: 0 2px 8px rgba(37,99,235,0.08);
  }
  .ac-order-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .ac-order-id {
    font-family: 'DM Mono', monospace;
    font-size: 0.8rem;
    font-weight: 600;
    color: #374151;
  }
  .ac-order-status {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
  }
  .ac-order-mid {
    display: flex;
    align-items: center;
  }
  .ac-order-product {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
  }
  .ac-order-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    color: #6B7280;
    font-family: 'DM Mono', monospace;
  }
  .ac-order-price {
    font-weight: 700;
    color: #111827;
  }
  .ac-btn-primary {
    padding: 0.75rem 1.5rem;
    background: #2563EB;
    color: #fff;
    border: none;
    border-radius: 12px;
    font-family: 'Sora', sans-serif;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .ac-btn-primary:hover { background: #1D4ED8; }
`;
