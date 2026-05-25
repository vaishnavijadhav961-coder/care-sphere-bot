import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRealtimeListener } from '../hooks/useRealtimeListener';

const TIMELINE_STEPS = ['Confirmed', 'Shipped', 'Out for Delivery', 'Delivered'];

function getStepIndex(status) {
  if (status === 'Delivered') return 3;
  if (status === 'Out for Delivery') return 2;
  if (status === 'Shipped' || status === 'Delayed') return 1;
  return 0; // Confirmed
}

export default function Track() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  // useRealtimeListener gives live updates — no refresh needed
  const { data: orders, loading } = useRealtimeListener('orders');

  const order = orders.find((o) => o.id === orderId);
  const isDelayed = order?.status === 'Delayed';
  const currentStep = order ? getStepIndex(order.status) : 0;

  if (loading) {
    return (
      <>
        <style>{styles}</style>
        <div className="trk-page"><div className="trk-loading"><div className="trk-spinner" /><span>Loading tracking info...</span></div></div>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <style>{styles}</style>
        <div className="trk-page">
          <div className="trk-breadcrumb">
            <button className="trk-back-link" onClick={() => navigate('/products')}>← CareSphere</button>
          </div>
          <div className="trk-not-found">
            <span className="trk-nf-icon">🚚</span>
            <h2>Order not found</h2>
            <p>We couldn't find order <code>{orderId}</code>. Double-check your order ID.</p>
            <button className="trk-back-btn" onClick={() => navigate('/products')}>Back to Store</button>
          </div>
        </div>
      </>
    );
  }

  const formatDate = (iso) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return iso; }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="trk-page">
        <div className="trk-breadcrumb">
          <button className="trk-back-link" onClick={() => navigate('/products')}>← CareSphere</button>
          <span className="trk-bc-sep">/</span>
          <span className="trk-bc-current">Track Order</span>
        </div>

        <div className="trk-container">
          {/* Delay banner — most prominent element */}
          {isDelayed && (
            <div className="trk-delay-banner">
              <div className="trk-delay-icon">⚠️</div>
              <div>
                <div className="trk-delay-title">Your order has been delayed</div>
                {order.delayReason && (
                  <div className="trk-delay-reason">Reason: {order.delayReason}</div>
                )}
                {(order.newDate || order.estimatedDelivery) && (
                  <div className="trk-delay-date">
                    New estimated delivery: <strong>{order.newDate || formatDate(order.estimatedDelivery)}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Order Summary card */}
          <div className="trk-summary-card">
            <div className="trk-summary-top">
              <div>
                <p className="trk-order-label">ORDER ID</p>
                <h2 className="trk-order-id">{order.id}</h2>
              </div>
              <span className={`trk-status-badge trk-status-${order.status.toLowerCase()}`}>
                {order.status}
              </span>
            </div>
            <div className="trk-summary-meta">
              <div className="trk-meta-item">
                <span className="trk-meta-label">Product</span>
                <span className="trk-meta-val">{order.productName}</span>
              </div>
              <div className="trk-meta-item">
                <span className="trk-meta-label">Order Date</span>
                <span className="trk-meta-val">{formatDate(order.orderDate) || '—'}</span>
              </div>
              {order.estimatedDelivery && (
                <div className="trk-meta-item">
                  <span className="trk-meta-label">Est. Delivery</span>
                  <span className="trk-meta-val">{formatDate(order.estimatedDelivery)}</span>
                </div>
              )}
              {order.trackingNumber && (
                <div className="trk-meta-item">
                  <span className="trk-meta-label">Tracking #</span>
                  <span className="trk-meta-val trk-tracking-no">{order.trackingNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="trk-timeline-card">
            <h3 className="trk-timeline-title">Delivery Progress</h3>
            <div className="trk-timeline">
              {TIMELINE_STEPS.map((step, i) => {
                const completed = i <= currentStep && order.status !== 'Delayed';
                const isActive = i === currentStep;
                const isDelayStep = isDelayed && i === 1; // Delayed shown at Shipped step
                return (
                  <div key={step} className="trk-step">
                    {/* Connector line before */}
                    {i > 0 && (
                      <div className={`trk-line ${i <= currentStep && !isDelayed ? 'done' : ''}`} />
                    )}
                    <div className={`trk-dot ${completed ? 'done' : ''} ${isDelayStep ? 'delayed' : ''} ${isActive && !isDelayed ? 'active' : ''}`}>
                      {completed ? '✓' : isDelayStep ? '!' : i + 1}
                    </div>
                    <div className="trk-step-info">
                      <div className={`trk-step-label ${completed ? 'done' : ''} ${isDelayStep ? 'delayed-label' : ''}`}>
                        {isDelayStep ? 'Delayed' : step}
                      </div>
                      {/* Show date from timeline array if available */}
                      {order.timeline && order.timeline[i] && (
                        <div className="trk-step-date">{order.timeline[i].date}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Return request button */}
          <div className="trk-actions">
            <button className="trk-return-btn" onClick={() => alert('Return request feature coming soon!')}>
              ↩ Request Return
            </button>
            <button className="trk-ask-btn" onClick={() => {
              const data = { productId: order.productId, productName: order.productName };
              if (window.openChatWithContext) window.openChatWithContext(data);
              else window.dispatchEvent(new CustomEvent('caresphere:open', { detail: data }));
            }}>
              ? Ask CareSphere
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  .trk-page {
    min-height: 100vh;
    background: #F9FAFB;
    font-family: 'Sora', sans-serif;
    color: #111827;
  }
  .trk-breadcrumb {
    background: #fff;
    border-bottom: 1px solid #E5E7EB;
    padding: 0.75rem 2rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }
  .trk-back-link {
    background: none; border: none; color: #2563EB;
    cursor: pointer; font-family: 'Sora', sans-serif; font-size: 0.85rem; padding: 0;
  }
  .trk-back-link:hover { text-decoration: underline; }
  .trk-bc-sep { color: #D1D5DB; }
  .trk-bc-current { color: #6B7280; }

  .trk-container {
    max-width: 680px;
    margin: 0 auto;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* Delay banner */
  .trk-delay-banner {
    background: #FEF2F2;
    border: 1.5px solid #FECACA;
    border-left: 4px solid #EF4444;
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }
  .trk-delay-icon { font-size: 1.5rem; flex-shrink: 0; }
  .trk-delay-title { font-weight: 700; color: #DC2626; font-size: 1rem; }
  .trk-delay-reason { color: #7F1D1D; font-size: 0.875rem; margin-top: 0.25rem; }
  .trk-delay-date { color: #991B1B; font-size: 0.875rem; margin-top: 0.25rem; }

  /* Summary card */
  .trk-summary-card {
    background: #fff;
    border: 1px solid #E5E7EB;
    border-radius: 16px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .trk-summary-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .trk-order-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #9CA3AF;
    font-family: 'DM Mono', monospace;
    margin: 0;
  }
  .trk-order-id {
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
    margin: 0.2rem 0 0;
    font-family: 'DM Mono', monospace;
  }
  .trk-status-badge {
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .trk-status-confirmed { background: #EFF6FF; color: #2563EB; }
  .trk-status-shipped { background: #F0F9FF; color: #0369A1; }
  .trk-status-delayed { background: #FEF3C7; color: #D97706; }
  .trk-status-delivered { background: #F0FDF4; color: #15803D; }

  .trk-summary-meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
    border-top: 1px solid #F3F4F6;
    padding-top: 1rem;
  }
  .trk-meta-item { display: flex; flex-direction: column; gap: 0.2rem; }
  .trk-meta-label { font-size: 0.7rem; color: #9CA3AF; font-family: 'DM Mono', monospace; text-transform: uppercase; letter-spacing: 0.05em; }
  .trk-meta-val { font-size: 0.875rem; font-weight: 500; color: #111827; }
  .trk-tracking-no { font-family: 'DM Mono', monospace; font-size: 0.75rem; }

  /* Timeline card */
  .trk-timeline-card {
    background: #fff;
    border: 1px solid #E5E7EB;
    border-radius: 16px;
    padding: 1.5rem;
  }
  .trk-timeline-title {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #9CA3AF;
    font-family: 'DM Mono', monospace;
    margin: 0 0 1.5rem;
  }
  .trk-timeline {
    display: flex;
    align-items: flex-start;
    position: relative;
    gap: 0;
  }
  .trk-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    position: relative;
    gap: 0.5rem;
  }
  .trk-line {
    position: absolute;
    top: 16px;
    right: 50%;
    left: -50%;
    height: 2px;
    background: #E5E7EB;
    z-index: 0;
  }
  .trk-line.done { background: #10B981; }
  .trk-dot {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid #E5E7EB;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    color: #9CA3AF;
    position: relative;
    z-index: 1;
    flex-shrink: 0;
    transition: all 0.2s;
  }
  .trk-dot.done {
    background: #10B981;
    border-color: #10B981;
    color: #fff;
  }
  .trk-dot.active {
    border-color: #2563EB;
    color: #2563EB;
    box-shadow: 0 0 0 4px #DBEAFE;
  }
  .trk-dot.delayed {
    background: #F59E0B;
    border-color: #F59E0B;
    color: #fff;
    box-shadow: 0 0 0 4px #FEF3C7;
  }
  .trk-step-info { text-align: center; }
  .trk-step-label {
    font-size: 0.72rem;
    font-weight: 500;
    color: #9CA3AF;
  }
  .trk-step-label.done { color: #10B981; font-weight: 600; }
  .trk-step-label.delayed-label { color: #D97706; font-weight: 600; }
  .trk-step-date {
    font-size: 0.65rem;
    color: #9CA3AF;
    font-family: 'DM Mono', monospace;
    margin-top: 0.1rem;
  }

  /* Actions */
  .trk-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .trk-return-btn {
    flex: 1;
    min-width: 140px;
    padding: 0.7rem 1rem;
    background: #fff;
    border: 1.5px solid #E5E7EB;
    border-radius: 12px;
    font-family: 'Sora', sans-serif;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s;
  }
  .trk-return-btn:hover { border-color: #9CA3AF; background: #F9FAFB; }
  .trk-ask-btn {
    flex: 1;
    min-width: 140px;
    padding: 0.7rem 1rem;
    background: #2563EB;
    border: none;
    border-radius: 12px;
    font-family: 'Sora', sans-serif;
    font-size: 0.875rem;
    font-weight: 600;
    color: #fff;
    cursor: pointer;
    transition: background 0.15s;
  }
  .trk-ask-btn:hover { background: #1D4ED8; }

  /* Loading / Not found */
  .trk-loading {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 60vh; gap: 1rem; color: #6B7280;
  }
  .trk-spinner {
    width: 36px; height: 36px;
    border: 3px solid #E5E7EB; border-top-color: #2563EB;
    border-radius: 50%; animation: trkspin 0.8s linear infinite;
  }
  @keyframes trkspin { to { transform: rotate(360deg); } }
  .trk-not-found {
    max-width: 420px; margin: 6rem auto; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 0 2rem;
  }
  .trk-nf-icon { font-size: 3rem; }
  .trk-not-found h2 { margin: 0; font-size: 1.25rem; }
  .trk-not-found p { margin: 0; color: #6B7280; font-size: 0.9rem; }
  .trk-back-btn {
    padding: 0.7rem 1.5rem; background: #2563EB; color: #fff;
    border: none; border-radius: 10px; font-family: 'Sora', sans-serif;
    font-size: 0.9rem; cursor: pointer; margin-top: 0.5rem;
  }

  @media (max-width: 640px) {
    .trk-container { padding: 1rem; }
    .trk-step-label { font-size: 0.62rem; }
    .trk-dot { width: 26px; height: 26px; font-size: 0.65rem; }
  }
`;
