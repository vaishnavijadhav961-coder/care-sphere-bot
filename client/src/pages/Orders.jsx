
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { useRealtimeListener } from '../hooks/useRealtimeListener';
import { formatDate } from '../firebase/utils';
import TopNav from '../components/TopNav';

const STATUS_COLORS = {
  Confirmed: '#2563EB',
  Shipped: '#0369A1',
  Delayed: '#D97706',
  'Out for Delivery': '#7C3AED',
  Delivered: '#15803D',
};

export default function Orders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: orders, loading } = useRealtimeListener('orders', 'orderDate', 'desc');

  const myOrders = orders.filter((o) => o.customerId === user?.uid);

  return (
    <>
      <style>{styles}</style>
      <TopNav />
      <div className="ord-page">
        <div className="ord-container">
          <h1 className="ord-title">My Orders</h1>

          {loading ? (
            <div className="ord-loading">
              <div className="ord-spinner" />
              <span>Loading orders...</span>
            </div>
          ) : myOrders.length === 0 ? (
            <div className="ord-empty">
              <span style={{ fontSize: '3rem' }}>📦</span>
              <h2>No orders yet</h2>
              <p>Place your first order to see it here.</p>
              <button className="ord-btn-primary" onClick={() => navigate('/products')}>Browse Products</button>
            </div>
          ) : (
            <div className="ord-list">
              {myOrders.map((order) => (
                <div
                  key={order.id}
                  className="ord-card"
                  onClick={() => navigate(`/track/${order.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/track/${order.id}`)}
                >
                  <div className="ord-card-top">
                    <span className="ord-card-id">{order.id}</span>
                    <span
                      className="ord-card-status"
                      style={{ background: STATUS_COLORS[order.status] || '#6B7280', color: '#fff' }}
                    >
                      {order.status}
                    </span>
                  </div>
                  <div className="ord-card-mid">
                    <span className="ord-card-product">{order.productName}</span>
                    {order.items && order.items.length > 0 && (
                      <span className="ord-card-qty">
                        {order.items.reduce((s, i) => s + (i.quantity || 1), 0)} item{order.items.reduce((s, i) => s + (i.quantity || 1), 0) > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="ord-card-bottom">
                    <span className="ord-card-date">Ordered: {formatDate(order.orderDate)}</span>
                    <span className="ord-card-price">₹{Number(order.price || 0).toLocaleString()}</span>
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
  .ord-page {
    min-height: 100vh;
    background: #F9FAFB;
    font-family: 'Sora', sans-serif;
    color: #111827;
  }
  .ord-container {
    max-width: 720px;
    margin: 0 auto;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .ord-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: #111827;
  }
  .ord-loading {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 30vh; gap: 1rem; color: #6B7280;
  }
  .ord-spinner {
    width: 36px; height: 36px;
    border: 3px solid #E5E7EB; border-top-color: #2563EB;
    border-radius: 50%; animation: ordspin 0.8s linear infinite;
  }
  @keyframes ordspin { to { transform: rotate(360deg); } }
  .ord-empty {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 30vh; gap: 0.75rem; text-align: center;
  }
  .ord-empty h2 { margin: 0; font-size: 1.25rem; }
  .ord-empty p { margin: 0; color: #6B7280; }
  .ord-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .ord-card {
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
  .ord-card:hover {
    border-color: #2563EB;
    box-shadow: 0 2px 8px rgba(37,99,235,0.08);
  }
  .ord-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .ord-card-id {
    font-family: 'DM Mono', monospace;
    font-size: 0.8rem;
    font-weight: 600;
    color: #374151;
  }
  .ord-card-status {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
  }
  .ord-card-mid {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .ord-card-product {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
  }
  .ord-card-qty {
    font-size: 0.75rem;
    color: #6B7280;
    font-family: 'DM Mono', monospace;
    margin-left: auto;
  }
  .ord-card-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    color: #6B7280;
    font-family: 'DM Mono', monospace;
  }
  .ord-card-price {
    font-weight: 700;
    color: #111827;
  }
  .ord-btn-primary {
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
  .ord-btn-primary:hover { background: #1D4ED8; }
`;
