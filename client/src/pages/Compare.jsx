import React from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useRealtimeListener } from '../hooks/useRealtimeListener';

// Determine which value "wins" for each spec
function getWinner(key, val1, val2) {
  // Price: lower is better
  if (key === 'price') return val1 < val2 ? 1 : val2 < val1 ? 2 : 0;
  // Rating, discount: higher is better
  if (key === 'rating' || key === 'discount') return val1 > val2 ? 1 : val2 > val1 ? 2 : 0;
  // Stock: more is better
  if (key === 'stock') return val1 > val2 ? 1 : val2 > val1 ? 2 : 0;
  // For string specs just call it a tie
  return 0;
}

const COMPARE_ROWS = [
  { key: 'price', label: 'Price', format: (v) => `₹${(v || 0).toLocaleString()}`, numeric: true },
  { key: 'discount', label: 'Discount', format: (v) => v ? `${v}%` : '—', numeric: true },
  { key: 'rating', label: 'Rating', format: (v) => v ? `${v} / 5` : '—', numeric: true },
  { key: 'stock', label: 'Stock', format: (v) => v !== undefined ? `${v} units` : '—', numeric: true },
  { key: 'inStock', label: 'Availability', format: (v) => v ? '✓ In Stock' : '✗ Out of Stock', numeric: false },
  { key: 'category', label: 'Category', format: (v) => v || '—', numeric: false },
];

function SpecsRows({ p1, p2 }) {
  // merge spec keys from both products
  const allSpecKeys = Array.from(new Set([
    ...Object.keys(p1.specs || {}),
    ...Object.keys(p2.specs || {}),
  ]));

  return allSpecKeys.map((key) => {
    const v1 = p1.specs?.[key];
    const v2 = p2.specs?.[key];
    return (
      <tr key={key}>
        <td className="cmp-row-label">{key.charAt(0).toUpperCase() + key.slice(1)}</td>
        <td className="cmp-cell">{v1 || '—'}</td>
        <td className="cmp-cell">{v2 || '—'}</td>
      </tr>
    );
  });
}

export default function Compare() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: products, loading } = useRealtimeListener('products');

  const p1id = params.get('p1');
  const p2id = params.get('p2');

  const p1 = products.find((p) => p.id === p1id);
  const p2 = products.find((p) => p.id === p2id);

  if (loading) {
    return (
      <>
        <style>{styles}</style>
        <div className="cmp-page"><div className="cmp-loading"><div className="cmp-spinner" /><span>Loading comparison...</span></div></div>
      </>
    );
  }

  if (!p1id || !p2id) {
    return (
      <>
        <style>{styles}</style>
        <div className="cmp-page">
          <div className="cmp-error-box">
            <span className="cmp-error-icon">⚖️</span>
            <h2>No products to compare</h2>
            <p>Use the bot to ask "compare iPhone 15 vs Samsung Galaxy S24" — it'll send you the right link automatically.</p>
            <Link to="/products" className="cmp-home-btn">Browse Products</Link>
          </div>
        </div>
      </>
    );
  }

  if (!p1 || !p2) {
    return (
      <>
        <style>{styles}</style>
        <div className="cmp-page">
          <div className="cmp-error-box">
            <span className="cmp-error-icon">⚠️</span>
            <h2>Product not found</h2>
            <p>One or both products don't exist. Try a valid comparison.</p>
            <Link to="/products" className="cmp-home-btn">Browse Products</Link>
          </div>
        </div>
      </>
    );
  }

  if (p1.category !== p2.category) {
    return (
      <>
        <style>{styles}</style>
        <div className="cmp-page">
          <div className="cmp-error-box">
            <span className="cmp-error-icon">🚫</span>
            <h2>Can't compare across categories</h2>
            <p><strong>{p1.name}</strong> is a <em>{p1.category}</em> and <strong>{p2.name}</strong> is a <em>{p2.category}</em>. Comparisons only work within the same category.</p>
            <Link to="/products" className="cmp-home-btn">Browse Products</Link>
          </div>
        </div>
      </>
    );
  }

  // Count wins
  const wins = { p1: 0, p2: 0 };
  COMPARE_ROWS.filter((r) => r.numeric).forEach((row) => {
    const w = getWinner(row.key, p1[row.key], p2[row.key]);
    if (w === 1) wins.p1++;
    if (w === 2) wins.p2++;
  });
  const overallWinner = wins.p1 > wins.p2 ? p1 : wins.p2 > wins.p1 ? p2 : null;

  return (
    <>
      <style>{styles}</style>
      <div className="cmp-page">
        <div className="cmp-breadcrumb">
          <button className="cmp-back-link" onClick={() => navigate('/products')}>← CareSphere</button>
          <span className="cmp-bc-sep">/</span>
          <span className="cmp-bc-current">Compare Products</span>
        </div>

        <div className="cmp-container">
          <h1 className="cmp-title">Product Comparison</h1>
          <p className="cmp-subtitle">Side-by-side specs with winner highlights</p>

          {overallWinner && (
            <div className="cmp-winner-banner">
              🏆 Overall winner: <strong>{overallWinner.name}</strong> — better in {Math.max(wins.p1, wins.p2)} of {wins.p1 + wins.p2 + (wins.p1 === wins.p2 ? 0 : 0)} compared attributes
            </div>
          )}

          <div className="cmp-table-wrap">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th className="cmp-th-label"></th>
                  <th className="cmp-th-product">
                    <div className="cmp-prod-header">
                      <div className="cmp-prod-icon">{p1.category === 'smartphones' ? '📱' : p1.category === 'headphones' ? '🎧' : '📦'}</div>
                      <div>
                        <div className="cmp-prod-name">{p1.name}</div>
                        <div className="cmp-prod-wins">{wins.p1} win{wins.p1 !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  </th>
                  <th className="cmp-th-product">
                    <div className="cmp-prod-header">
                      <div className="cmp-prod-icon">{p2.category === 'smartphones' ? '📱' : p2.category === 'headphones' ? '🎧' : '📦'}</div>
                      <div>
                        <div className="cmp-prod-name">{p2.name}</div>
                        <div className="cmp-prod-wins">{wins.p2} win{wins.p2 !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => {
                  const v1 = p1[row.key];
                  const v2 = p2[row.key];
                  const winner = row.numeric ? getWinner(row.key, v1, v2) : 0;
                  return (
                    <tr key={row.key}>
                      <td className="cmp-row-label">{row.label}</td>
                      <td className={`cmp-cell ${winner === 1 ? 'winner' : ''}`}>
                        {row.format(v1)}
                        {winner === 1 && <span className="cmp-tick">✓</span>}
                      </td>
                      <td className={`cmp-cell ${winner === 2 ? 'winner' : ''}`}>
                        {row.format(v2)}
                        {winner === 2 && <span className="cmp-tick">✓</span>}
                      </td>
                    </tr>
                  );
                })}

                {/* Specs divider */}
                <tr className="cmp-section-row">
                  <td colSpan={3}>Detailed Specifications</td>
                </tr>
                <SpecsRows p1={p1} p2={p2} />
              </tbody>
            </table>
          </div>

          {/* Bottom actions */}
          <div className="cmp-actions">
            <Link to={`/products/${p1.id}`} className="cmp-view-btn">View {p1.name}</Link>
            <Link to={`/products/${p2.id}`} className="cmp-view-btn">View {p2.name}</Link>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  .cmp-page {
    min-height: 100vh;
    background: #F9FAFB;
    font-family: 'Sora', sans-serif;
    color: #111827;
  }
  .cmp-breadcrumb {
    background: #fff;
    border-bottom: 1px solid #E5E7EB;
    padding: 0.75rem 2rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }
  .cmp-back-link {
    background: none; border: none; color: #2563EB;
    cursor: pointer; font-family: 'Sora', sans-serif; font-size: 0.85rem; padding: 0;
  }
  .cmp-back-link:hover { text-decoration: underline; }
  .cmp-bc-sep { color: #D1D5DB; }
  .cmp-bc-current { color: #6B7280; }

  .cmp-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 2.5rem 2rem;
  }
  .cmp-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 0.25rem;
    letter-spacing: -0.02em;
  }
  .cmp-subtitle {
    font-size: 0.875rem;
    color: #6B7280;
    margin: 0 0 1.5rem;
  }
  .cmp-winner-banner {
    background: linear-gradient(135deg, #ECFDF5, #D1FAE5);
    border: 1px solid #6EE7B7;
    border-radius: 12px;
    padding: 0.875rem 1.25rem;
    font-size: 0.9rem;
    color: #065F46;
    margin-bottom: 1.5rem;
  }

  .cmp-table-wrap {
    background: #fff;
    border-radius: 16px;
    border: 1px solid #E5E7EB;
    overflow: hidden;
    overflow-x: auto;
  }
  .cmp-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 560px;
  }
  .cmp-table thead tr {
    background: #F9FAFB;
    border-bottom: 2px solid #E5E7EB;
  }
  .cmp-th-label {
    width: 160px;
    padding: 1rem;
  }
  .cmp-th-product {
    padding: 1rem 1.25rem;
    text-align: left;
  }
  .cmp-prod-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .cmp-prod-icon {
    font-size: 2rem;
    background: #EFF6FF;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cmp-prod-name {
    font-weight: 700;
    font-size: 0.95rem;
    color: #111827;
  }
  .cmp-prod-wins {
    font-size: 0.75rem;
    color: #10B981;
    font-family: 'DM Mono', monospace;
    margin-top: 0.1rem;
  }

  .cmp-table tbody tr {
    border-bottom: 1px solid #F3F4F6;
    transition: background 0.1s;
  }
  .cmp-table tbody tr:hover { background: #FAFAFA; }
  .cmp-row-label {
    padding: 0.7rem 1rem;
    font-size: 0.8rem;
    color: #6B7280;
    font-family: 'DM Mono', monospace;
    background: #FAFAFA;
    width: 160px;
  }
  .cmp-cell {
    padding: 0.7rem 1.25rem;
    font-size: 0.875rem;
    color: #374151;
    font-weight: 500;
  }
  .cmp-cell.winner {
    background: #F0FDF4;
    color: #15803D;
    font-weight: 700;
  }
  .cmp-tick {
    display: inline-block;
    margin-left: 0.4rem;
    font-size: 0.8rem;
    color: #10B981;
  }
  .cmp-section-row td {
    padding: 0.5rem 1rem;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #9CA3AF;
    background: #F9FAFB;
    border-top: 2px solid #E5E7EB;
    font-family: 'DM Mono', monospace;
  }

  .cmp-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
    flex-wrap: wrap;
  }
  .cmp-view-btn {
    flex: 1;
    min-width: 160px;
    padding: 0.75rem 1.25rem;
    background: #2563EB;
    color: #fff;
    border-radius: 12px;
    text-align: center;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.875rem;
    transition: background 0.2s;
  }
  .cmp-view-btn:hover { background: #1D4ED8; }
  .cmp-home-btn {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    background: #2563EB;
    color: #fff;
    border-radius: 12px;
    text-decoration: none;
    font-weight: 600;
    margin-top: 1rem;
  }

  .cmp-error-box {
    max-width: 480px;
    margin: 6rem auto;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 0 2rem;
  }
  .cmp-error-icon { font-size: 3rem; }
  .cmp-error-box h2 { margin: 0; font-size: 1.25rem; color: #111827; }
  .cmp-error-box p { margin: 0; color: #6B7280; font-size: 0.9rem; line-height: 1.6; }

  .cmp-loading {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 60vh; gap: 1rem; color: #6B7280;
  }
  .cmp-spinner {
    width: 36px; height: 36px;
    border: 3px solid #E5E7EB; border-top-color: #2563EB;
    border-radius: 50%; animation: cmpspin 0.8s linear infinite;
  }
  @keyframes cmpspin { to { transform: rotate(360deg); } }

  @media (max-width: 640px) {
    .cmp-container { padding: 1.25rem 1rem; }
    .cmp-title { font-size: 1.35rem; }
  }
`;
