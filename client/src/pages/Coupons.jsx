import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRealtimeListener } from '../hooks/useRealtimeListener';

const CATEGORY_FILTERS = ['All', 'electronics', 'footwear', 'skincare', 'headphones', 'luggage', 'smartphones'];
const CATEGORY_LABELS = {
  All: 'All', electronics: 'Electronics', footwear: 'Footwear',
  skincare: 'Skincare', headphones: 'Headphones', luggage: 'Luggage', smartphones: 'Smartphones',
};
const CATEGORY_ICONS = {
  All: '✦', electronics: '💻', footwear: '👟', skincare: '✨',
  headphones: '🎧', luggage: '🧳', smartphones: '📱',
};

function CouponCard({ coupon }) {
  const [copied, setCopied] = useState(false);
  const isExpired = new Date(coupon.expiryDate) < new Date();

  const handleCopy = () => {
    navigator.clipboard.writeText(coupon.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`coup-card ${isExpired ? 'expired' : ''}`}>
      <div className="coup-card-left">
        <div className="coup-category-icon">{CATEGORY_ICONS[coupon.applicableOn] || '🏷️'}</div>
      </div>
      <div className="coup-card-body">
        <div className="coup-code-row">
          <span className="coup-code">{coupon.code}</span>
          {isExpired ? (
            <span className="coup-pill expired">Expired</span>
          ) : (
            <span className="coup-pill active">Active</span>
          )}
        </div>
        <div className="coup-discount">{coupon.discount || `${coupon.discountPercent}% off`}</div>
        {coupon.description && <p className="coup-desc">{coupon.description}</p>}
        <div className="coup-footer">
          <span className="coup-expiry">Valid till: {coupon.validTill || new Date(coupon.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <button
            className={`coup-copy-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            disabled={isExpired}
          >
            {copied ? '✓ Copied!' : '📋 Copy Code'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Coupons() {
  const navigate = useNavigate();
  const { data: coupons, loading } = useRealtimeListener('coupons');
  const [activeFilter, setActiveFilter] = useState('All');

  const filtered = coupons.filter((c) => {
    if (activeFilter === 'All') return true;
    return c.applicableOn === activeFilter;
  });

  // Sort: active first, then expired
  const sorted = [...filtered].sort((a, b) => {
    const aExp = new Date(a.expiryDate) < new Date();
    const bExp = new Date(b.expiryDate) < new Date();
    return aExp - bExp;
  });

  return (
    <>
      <style>{styles}</style>
      <div className="coup-page">
        {/* Header */}
        <header className="coup-header">
          <button className="coup-back-link" onClick={() => navigate('/products')}>← CareSphere</button>
          <h1 className="coup-header-title">Coupons & Offers</h1>
          <span className="coup-header-count">{filtered.filter(c => new Date(c.expiryDate) >= new Date()).length} active</span>
        </header>

        {/* Category filter */}
        <div className="coup-filter-bar">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat}
              className={`coup-filter-pill ${activeFilter === cat ? 'active' : ''}`}
              onClick={() => setActiveFilter(cat)}
            >
              {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <div className="coup-container">
          {loading ? (
            <div className="coup-loading"><div className="coup-spinner" /><span>Loading coupons...</span></div>
          ) : sorted.length === 0 ? (
            <div className="coup-loading">
              <span style={{ fontSize: '2rem' }}>🏷️</span>
              <span>No coupons found</span>
            </div>
          ) : (
            <div className="coup-grid">
              {sorted.map((coupon) => (
                <CouponCard key={coupon.code} coupon={coupon} />
              ))}
            </div>
          )}

          {/* Info note */}
          <div className="coup-info-note">
            💬 Ask CareSphere to find the best coupon for your cart — the bot automatically matches coupons to products.
          </div>
        </div>
      </div>
    </>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  .coup-page {
    min-height: 100vh;
    background: #F9FAFB;
    font-family: 'Sora', sans-serif;
    color: #111827;
  }

  /* Header */
  .coup-header {
    background: #fff;
    border-bottom: 1px solid #E5E7EB;
    padding: 0 2rem;
    height: 60px;
    display: flex;
    align-items: center;
    gap: 1rem;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .coup-back-link {
    background: none; border: none; color: #2563EB;
    cursor: pointer; font-family: 'Sora', sans-serif; font-size: 0.85rem; padding: 0;
    white-space: nowrap;
  }
  .coup-back-link:hover { text-decoration: underline; }
  .coup-header-title {
    font-size: 1rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
    flex: 1;
  }
  .coup-header-count {
    font-size: 0.75rem;
    font-family: 'DM Mono', monospace;
    color: #10B981;
    background: #F0FDF4;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    white-space: nowrap;
  }

  /* Filter bar */
  .coup-filter-bar {
    background: #fff;
    border-bottom: 1px solid #F3F4F6;
    padding: 0.75rem 2rem;
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .coup-filter-bar::-webkit-scrollbar { display: none; }
  .coup-filter-pill {
    padding: 0.35rem 0.9rem;
    border-radius: 999px;
    border: 1.5px solid #E5E7EB;
    background: #fff;
    font-family: 'Sora', sans-serif;
    font-size: 0.78rem;
    font-weight: 500;
    color: #6B7280;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .coup-filter-pill:hover { border-color: #2563EB; color: #2563EB; }
  .coup-filter-pill.active { background: #2563EB; border-color: #2563EB; color: #fff; }

  /* Container */
  .coup-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .coup-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Coupon card */
  .coup-card {
    background: #fff;
    border: 1.5px solid #E5E7EB;
    border-radius: 16px;
    display: flex;
    overflow: hidden;
    transition: box-shadow 0.15s, transform 0.15s;
  }
  .coup-card:hover {
    box-shadow: 0 4px 20px rgba(37,99,235,0.08);
    transform: translateY(-1px);
  }
  .coup-card.expired {
    opacity: 0.6;
    filter: grayscale(0.4);
  }
  .coup-card-left {
    background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
    width: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 1.75rem;
  }
  .coup-card-body {
    padding: 1rem 1.25rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .coup-code-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .coup-code {
    font-family: 'DM Mono', monospace;
    font-size: 1.1rem;
    font-weight: 700;
    color: #1E40AF;
    letter-spacing: 0.08em;
    background: #EFF6FF;
    padding: 0.1rem 0.5rem;
    border-radius: 6px;
  }
  .coup-pill {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
  }
  .coup-pill.active { background: #F0FDF4; color: #15803D; }
  .coup-pill.expired { background: #FEF2F2; color: #DC2626; }

  .coup-discount {
    font-size: 1rem;
    font-weight: 700;
    color: #10B981;
  }
  .coup-desc {
    margin: 0;
    font-size: 0.825rem;
    color: #6B7280;
    line-height: 1.5;
  }
  .coup-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }
  .coup-expiry {
    font-size: 0.75rem;
    color: #9CA3AF;
    font-family: 'DM Mono', monospace;
  }
  .coup-copy-btn {
    padding: 0.35rem 0.9rem;
    border-radius: 8px;
    border: 1.5px solid #BFDBFE;
    background: #EFF6FF;
    color: #2563EB;
    font-family: 'Sora', sans-serif;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .coup-copy-btn:hover:not(:disabled) { background: #2563EB; color: #fff; border-color: #2563EB; }
  .coup-copy-btn.copied { background: #F0FDF4; border-color: #BBF7D0; color: #15803D; }
  .coup-copy-btn:disabled { opacity: 0.5; cursor: default; }

  /* Info note */
  .coup-info-note {
    background: #FFFBEB;
    border: 1px solid #FDE68A;
    border-radius: 12px;
    padding: 0.875rem 1.25rem;
    font-size: 0.85rem;
    color: #92400E;
    text-align: center;
  }

  /* Loading */
  .coup-loading {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 30vh; gap: 1rem; color: #6B7280;
  }
  .coup-spinner {
    width: 32px; height: 32px;
    border: 3px solid #E5E7EB; border-top-color: #2563EB;
    border-radius: 50%; animation: coupspin 0.8s linear infinite;
  }
  @keyframes coupspin { to { transform: rotate(360deg); } }

  @media (max-width: 640px) {
    .coup-container { padding: 1rem; }
    .coup-filter-bar { padding: 0.75rem 1rem; }
    .coup-header { padding: 0 1rem; }
    .coup-card-left { width: 52px; font-size: 1.3rem; }
  }
`;
