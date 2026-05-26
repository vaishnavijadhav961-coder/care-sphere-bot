import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRealtimeListener } from '../hooks/useRealtimeListener';
import { updateProductStock, addToNotifyList } from '../firebase/products';
import { addToCart } from '../firebase/cart';
import { useAuth } from '../hooks/AuthContext';
import TopNav from '../components/TopNav';

const CATEGORIES = ['All', 'smartphones', 'footwear', 'skincare', 'headphones', 'luggage', 'electronics'];

const CATEGORY_LABELS = {
  All: 'All',
  smartphones: 'Smartphones',
  footwear: 'Footwear',
  skincare: 'Skincare',
  headphones: 'Headphones',
  luggage: 'Luggage',
  electronics: 'Electronics',
};

const CATEGORY_ICONS = {
  All: '✦',
  smartphones: '📱',
  footwear: '👟',
  skincare: '✨',
  headphones: '🎧',
  luggage: '🧳',
  electronics: '💻',
};

function ProductCard({ product, onAskCareSphere, user }) {
  const navigate = useNavigate();
  const [notified, setNotified] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [adding, setAdding] = useState(false);

  const handleAddToCart = async (e) => {
    e.stopPropagation();
    if (!user) { navigate('/login'); return; }
    setAdding(true);
    await addToCart(user.uid, product);
    setAdding(false);
  };
  const discountedPrice = product.discount
    ? Math.round(product.price * (1 - product.discount / 100))
    : null;

  const handleNotify = async (e) => {
    e.stopPropagation();
    setNotifying(true);
    const ok = await addToNotifyList(product.id, 'user123');
    setNotifying(false);
    if (ok) setNotified(true);
  };

  return (
    <div
      className="p2-product-card"
      onClick={() => navigate(`/products/${product.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/products/${product.id}`)}
    >
      {product.discount > 0 && (
        <div className="p2-discount-badge">{product.discount}% OFF</div>
      )}
      {!product.inStock && (
        <div className="p2-oos-badge">Out of Stock</div>
      )}

      <div className="p2-card-img-wrap">
        {product.image ? (
          <img src={product.image} alt={product.name} className="p2-card-img" />
        ) : (
          <div className="p2-card-img-placeholder">
            {CATEGORY_ICONS[product.category] || '📦'}
          </div>
        )}
      </div>

      <div className="p2-card-body">
        <p className="p2-card-category">{CATEGORY_LABELS[product.category] || product.category}</p>
        <h3 className="p2-card-name">{product.name}</h3>
        <div className="p2-card-rating">
          {'★'.repeat(Math.round(product.rating || 0))}{'☆'.repeat(5 - Math.round(product.rating || 0))}
          <span className="p2-rating-val"> {product.rating}</span>
        </div>
        <div className="p2-card-price-row">
          <span className="p2-price-main">₹{(discountedPrice || product.price).toLocaleString()}</span>
          {discountedPrice && (
            <span className="p2-price-original">₹{product.price.toLocaleString()}</span>
          )}
        </div>

        <div className="p2-card-actions" onClick={(e) => e.stopPropagation()}>
          {product.inStock ? (
            <>
              <button
                className="p2-ask-btn"
                onClick={() => onAskCareSphere({ productId: product.id, productName: product.name })}
              >
                ? Ask CareSphere
              </button>
              <button className="p2-cart-btn" onClick={handleAddToCart} disabled={adding}>
                {adding ? 'Adding...' : 'Add to Cart'}
              </button>
            </>
          ) : notified ? (
            <button className="p2-notify-btn p2-notify-done" disabled>✓ You'll be notified</button>
          ) : (
            <button className="p2-notify-btn" onClick={handleNotify} disabled={notifying}>
              {notifying ? 'Saving...' : '🔔 Notify Me'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProductGrid() {
  const { user } = useAuth();
  const { data: products, loading } = useRealtimeListener('products');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState('default');

  const openChatWithContext = (productData) => {
    // P3's ChatWidget exposes this globally or via event
    if (window.openChatWithContext) {
      window.openChatWithContext(productData);
    } else {
      // fallback: dispatch custom event
      window.dispatchEvent(new CustomEvent('caresphere:open', { detail: productData }));
    }
  };

  const filtered = products
    .filter((p) => {
      const matchCat = activeCategory === 'All' || p.category === activeCategory;
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'discount') return (b.discount || 0) - (a.discount || 0);
      return 0;
    });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

        .p2-page {
          min-height: 100vh;
          background: #F9FAFB;
          font-family: 'Sora', sans-serif;
          color: #111827;
        }

        .p2-search-wrap {
          flex: 1;
          max-width: 420px;
          position: relative;
        }
        .p2-search {
          width: 100%;
          padding: 0.5rem 1rem 0.5rem 2.5rem;
          border: 1.5px solid #E5E7EB;
          border-radius: 999px;
          font-size: 0.875rem;
          font-family: 'Sora', sans-serif;
          background: #F9FAFB;
          color: #111827;
          outline: none;
          transition: border-color 0.2s;
        }
        .p2-search:focus { border-color: #2563EB; background: #fff; }
        .p2-search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: #9CA3AF;
          font-size: 0.875rem;
          pointer-events: none;
        }
        .p2-sort-select {
          padding: 0.4rem 0.75rem;
          border: 1.5px solid #E5E7EB;
          border-radius: 8px;
          font-family: 'Sora', sans-serif;
          font-size: 0.8rem;
          color: #374151;
          background: #fff;
          outline: none;
          cursor: pointer;
        }

        /* CATEGORY PILLS */
        .p2-cat-bar {
          background: #fff;
          border-bottom: 1px solid #F3F4F6;
          padding: 0.75rem 2rem;
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .p2-cat-bar::-webkit-scrollbar { display: none; }
        .p2-cat-pill {
          padding: 0.4rem 1rem;
          border-radius: 999px;
          border: 1.5px solid #E5E7EB;
          background: #fff;
          font-family: 'Sora', sans-serif;
          font-size: 0.8rem;
          font-weight: 500;
          color: #6B7280;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }
        .p2-cat-pill:hover { border-color: #2563EB; color: #2563EB; }
        .p2-cat-pill.active {
          background: #2563EB;
          border-color: #2563EB;
          color: #fff;
        }

        /* MAIN CONTENT */
        .p2-main {
          max-width: 1280px;
          margin: 0 auto;
          padding: 2rem;
        }
        .p2-results-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
        }
        .p2-results-count {
          font-size: 0.875rem;
          color: #6B7280;
          font-family: 'DM Mono', monospace;
        }

        /* GRID */
        .p2-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 1.25rem;
        }

        /* PRODUCT CARD */
        .p2-product-card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid #F3F4F6;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .p2-product-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(37,99,235,0.1);
          border-color: #DBEAFE;
        }
        .p2-discount-badge {
          position: absolute;
          top: 0.75rem;
          left: 0.75rem;
          background: #2563EB;
          color: #fff;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
          font-family: 'DM Mono', monospace;
          z-index: 2;
        }
        .p2-oos-badge {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          background: #FEF2F2;
          color: #EF4444;
          font-size: 0.65rem;
          font-weight: 600;
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
          z-index: 2;
        }
        .p2-card-img-wrap {
          background: linear-gradient(135deg, #EFF6FF, #F0FDF4);
          height: 160px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .p2-card-img-placeholder {
          font-size: 3.5rem;
          opacity: 0.85;
        }
        .p2-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .p2-card-body {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          flex: 1;
        }
        .p2-card-category {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #9CA3AF;
          font-family: 'DM Mono', monospace;
          margin: 0;
        }
        .p2-card-name {
          font-size: 0.95rem;
          font-weight: 600;
          color: #111827;
          margin: 0;
          line-height: 1.3;
        }
        .p2-card-rating {
          font-size: 0.75rem;
          color: #F59E0B;
          letter-spacing: 0.05em;
        }
        .p2-rating-val {
          color: #9CA3AF;
          font-family: 'DM Mono', monospace;
        }
        .p2-card-price-row {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          margin-top: 0.25rem;
        }
        .p2-price-main {
          font-size: 1.1rem;
          font-weight: 700;
          color: #111827;
        }
        .p2-price-original {
          font-size: 0.8rem;
          color: #9CA3AF;
          text-decoration: line-through;
          font-family: 'DM Mono', monospace;
        }
        .p2-card-actions {
          margin-top: 0.75rem;
        }
        .p2-ask-btn {
          width: 100%;
          padding: 0.5rem;
          background: #EFF6FF;
          border: 1.5px solid #BFDBFE;
          border-radius: 8px;
          color: #2563EB;
          font-family: 'Sora', sans-serif;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .p2-ask-btn:hover {
          background: #2563EB;
          color: #fff;
          border-color: #2563EB;
        }
        .p2-notify-btn {
          width: 100%;
          padding: 0.5rem;
          background: #FFF7ED;
          border: 1.5px solid #FED7AA;
          border-radius: 8px;
          color: #C2410C;
          font-family: 'Sora', sans-serif;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .p2-notify-btn:hover:not(:disabled) { background: #FFEDD5; }
        .p2-notify-btn:disabled { opacity: 0.7; cursor: default; }
        .p2-notify-done {
          background: #F0FDF4;
          border-color: #BBF7D0;
          color: #15803D;
        }
        .p2-cart-btn {
          width: 100%;
          padding: 0.5rem;
          background: #2563EB;
          border: none;
          border-radius: 8px;
          color: #fff;
          font-family: 'Sora', sans-serif;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
          margin-top: 0.35rem;
        }
        .p2-cart-btn:hover { background: #1D4ED8; }
        .p2-cart-btn:disabled { opacity: 0.7; cursor: default; }

        /* LOADING / EMPTY */
        .p2-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 40vh;
          gap: 1rem;
          color: #9CA3AF;
        }
        .p2-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid #E5E7EB;
          border-top-color: #2563EB;
          border-radius: 50%;
          animation: p2spin 0.8s linear infinite;
        }
        @keyframes p2spin { to { transform: rotate(360deg); } }

        /* RESPONSIVE */
        @media (max-width: 640px) {
          .p2-main { padding: 1rem; }
          .p2-cat-bar { padding: 0.75rem 1rem; }
          .p2-grid { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
          .p2-card-img-wrap { height: 120px; }
          .p2-sort-select { display: none; }
        }
      `}</style>

      <div className="p2-page">
        <TopNav>
          <div className="p2-search-wrap" style={{ flex: 1, maxWidth: 420, position: 'relative' }}>
            <span className="p2-search-icon">🔍</span>
            <input
              className="p2-search"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="p2-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="default">Sort: Default</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="rating">Top Rated</option>
            <option value="discount">Best Deals</option>
          </select>
        </TopNav>

        {/* Category Pills */}
        <div className="p2-cat-bar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`p2-cat-pill ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Main */}
        <main className="p2-main">
          {loading ? (
            <div className="p2-loading">
              <div className="p2-spinner" />
              <span>Loading products...</span>
            </div>
          ) : (
            <>
              <div className="p2-results-bar">
                <span className="p2-results-count">
                  {filtered.length} product{filtered.length !== 1 ? 's' : ''}
                  {activeCategory !== 'All' ? ` in ${CATEGORY_LABELS[activeCategory]}` : ''}
                </span>
              </div>
              {filtered.length === 0 ? (
                <div className="p2-loading">
                  <span style={{ fontSize: '2rem' }}>🔍</span>
                  <span>No products found</span>
                </div>
              ) : (
                <div className="p2-grid">
                  {filtered.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      user={user}
                      onAskCareSphere={openChatWithContext}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
