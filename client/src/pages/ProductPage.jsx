import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRealtimeListener } from '../hooks/useRealtimeListener';
import { addToNotifyList } from '../firebase/products';
import { addToCart } from '../firebase/cart';
import { useAuth } from '../hooks/AuthContext';

const CATEGORY_ICONS = {
  smartphones: '📱', footwear: '👟', skincare: '✨',
  headphones: '🎧', luggage: '🧳', electronics: '💻',
};

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: products, loading } = useRealtimeListener('products');
  const [notified, setNotified] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [adding, setAdding] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const product = products.find((p) => p.id === id);
  const discountedPrice = product?.discount
    ? Math.round(product.price * (1 - product.discount / 100))
    : null;

  const handleAddToCart = async () => {
    if (!user) { navigate('/login'); return; }
    setAdding(true);
    try {
      await addToCart(user.uid, product, quantity);
    } catch (err) {
      alert(err.message);
    }
    setAdding(false);
  };

  const handleBuyNow = () => {
    if (!user) { navigate('/login'); return; }
    navigate(`/checkout?buyNow=${product.id}&qty=${quantity}`);
  };

  const openChatWithContext = () => {
    if (!product) return;
    const data = { productId: product.id, productName: product.name };
    if (window.openChatWithContext) window.openChatWithContext(data);
    else window.dispatchEvent(new CustomEvent('caresphere:open', { detail: data }));
  };

  const handleNotify = async () => {
    setNotifying(true);
    const ok = await addToNotifyList(product.id, user?.uid);
    setNotifying(false);
    if (ok) setNotified(true);
  };

  if (loading) {
    return (
      <>
        <style>{baseStyles}</style>
        <div className="pp-page">
          <div className="pp-loading"><div className="pp-spinner" /><span>Loading product...</span></div>
        </div>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <style>{baseStyles}</style>
        <div className="pp-page">
          <div className="pp-loading">
            <span style={{ fontSize: '2.5rem' }}>🔍</span>
            <h2 style={{ margin: 0 }}>Product not found</h2>
            <button className="pp-back-btn" onClick={() => navigate('/products')}>← Back to Store</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{baseStyles}</style>
      <div className="pp-page">
        {/* Breadcrumb */}
        <div className="pp-breadcrumb">
          <button className="pp-back-link" onClick={() => navigate('/products')}>← CareSphere</button>
          <span className="pp-bc-sep">/</span>
          <span className="pp-bc-current">{product.name}</span>
        </div>

        <div className="pp-container">
          {/* Left: Image */}
          <div className="pp-img-section">
            <div className="pp-img-box">
              {product.image ? (
                <img src={product.image} alt={product.name} className="pp-img" />
              ) : (
                <span className="pp-img-icon">{CATEGORY_ICONS[product.category] || '📦'}</span>
              )}
              {product.discount > 0 && (
                <div className="pp-discount-badge">{product.discount}% OFF</div>
              )}
            </div>
            <div className="pp-img-meta">
              <span className="pp-meta-id">ID: {product.id}</span>
              {product.trackingNumber && <span className="pp-meta-id">#{product.trackingNumber}</span>}
            </div>
          </div>

          {/* Right: Details */}
          <div className="pp-detail-section">
            <span className="pp-category-tag">
              {CATEGORY_ICONS[product.category]} {product.category}
            </span>

            <h1 className="pp-name">{product.name}</h1>

            {/* Rating */}
            <div className="pp-rating-row">
              <span className="pp-stars">{'★'.repeat(Math.round(product.rating || 0))}{'☆'.repeat(5 - Math.round(product.rating || 0))}</span>
              <span className="pp-rating-num">{product.rating} / 5</span>
            </div>

            {/* Price */}
            <div className="pp-price-block">
              <span className="pp-price-main">₹{(discountedPrice || product.price).toLocaleString()}</span>
              {discountedPrice && (
                <>
                  <span className="pp-price-original">₹{product.price.toLocaleString()}</span>
                  <span className="pp-savings-tag">You save ₹{(product.price - discountedPrice).toLocaleString()}</span>
                </>
              )}
            </div>

            {/* Stock badge */}
            <div className={`pp-stock-badge ${product.inStock ? 'in-stock' : 'out-of-stock'}`}>
              {product.inStock ? '✓ In Stock' : '✗ Out of Stock'}
            </div>

            {/* Description */}
            {product.description && (
              <p className="pp-description">{product.description}</p>
            )}

            {/* Specs table */}
            {product.specs && Object.keys(product.specs).length > 0 && (
              <div className="pp-specs-section">
                <h3 className="pp-specs-title">Specifications</h3>
                <table className="pp-specs-table">
                  <tbody>
                    {Object.entries(product.specs).map(([key, val]) => (
                      <tr key={key}>
                        <td className="pp-spec-key">{key.charAt(0).toUpperCase() + key.slice(1)}</td>
                        <td className="pp-spec-val">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Quantity selector */}
            {product.inStock && (
              <div className="pp-qty-row">
                <span className="pp-qty-label">Qty:</span>
                <button className="pp-qty-btn" onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
                <span className="pp-qty-value">{quantity}</span>
                <button className="pp-qty-btn" onClick={() => setQuantity(q => Math.min(product.stock || 99, q + 1))}>+</button>
                <span className="pp-qty-max">max {product.stock}</span>
              </div>
            )}

            {/* Actions */}
            <div className="pp-actions">
              {product.inStock && (
                <>
                  <button className="pp-cart-btn" onClick={handleAddToCart} disabled={adding}>
                    {adding ? 'Adding...' : '🛒 Add to Cart'}
                  </button>
                  <button className="pp-buy-btn" onClick={handleBuyNow}>
                    Buy Now
                  </button>
                </>
              )}
              <button className="pp-ask-btn" onClick={openChatWithContext}>
                ? Ask CareSphere
              </button>
              {!product.inStock && (
                notified ? (
                  <button className="pp-notify-btn pp-notify-done" disabled>✓ We'll notify you</button>
                ) : (
                  <button className="pp-notify-btn" onClick={handleNotify} disabled={notifying}>
                    {notifying ? 'Saving...' : '🔔 Notify me when back'}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const baseStyles = `
  .pp-page {
    min-height: 100vh;
    background: #F9FAFB;
    font-family: 'Sora', sans-serif;
    color: #111827;
  }
  .pp-breadcrumb {
    background: #fff;
    border-bottom: 1px solid #E5E7EB;
    padding: 0.75rem 2rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }
  .pp-back-link {
    background: none;
    border: none;
    color: #2563EB;
    cursor: pointer;
    font-family: 'Sora', sans-serif;
    font-size: 0.85rem;
    padding: 0;
  }
  .pp-back-link:hover { text-decoration: underline; }
  .pp-bc-sep { color: #D1D5DB; }
  .pp-bc-current { color: #6B7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; }

  .pp-container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2.5rem 2rem;
    display: grid;
    grid-template-columns: 420px 1fr;
    gap: 3rem;
    align-items: start;
  }

  /* Image section */
  .pp-img-section { display: flex; flex-direction: column; gap: 1rem; }
  .pp-img-box {
    background: linear-gradient(135deg, #EFF6FF, #F0FDF4);
    border-radius: 20px;
    height: 380px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }
  .pp-img-icon { font-size: 7rem; }
  .pp-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 20px;
  }
  .pp-discount-badge {
    position: absolute;
    top: 1rem;
    left: 1rem;
    background: #2563EB;
    color: #fff;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 0.3rem 0.7rem;
    border-radius: 8px;
    font-family: 'DM Mono', monospace;
  }
  .pp-img-meta { display: flex; gap: 1rem; }
  .pp-meta-id {
    font-family: 'DM Mono', monospace;
    font-size: 0.7rem;
    color: #9CA3AF;
  }

  /* Detail section */
  .pp-detail-section { display: flex; flex-direction: column; gap: 1rem; }
  .pp-category-tag {
    display: inline-block;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #6B7280;
    font-family: 'DM Mono', monospace;
  }
  .pp-name {
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }
  .pp-rating-row { display: flex; align-items: center; gap: 0.5rem; }
  .pp-stars { font-size: 1rem; color: #F59E0B; letter-spacing: 0.05em; }
  .pp-rating-num { font-size: 0.8rem; color: #6B7280; font-family: 'DM Mono', monospace; }

  .pp-price-block {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 1rem;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #F3F4F6;
  }
  .pp-price-main { font-size: 2rem; font-weight: 700; color: #111827; }
  .pp-price-original {
    font-size: 1rem;
    color: #9CA3AF;
    text-decoration: line-through;
    font-family: 'DM Mono', monospace;
  }
  .pp-savings-tag {
    font-size: 0.75rem;
    font-weight: 600;
    color: #10B981;
    background: #F0FDF4;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
  }

  .pp-stock-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.4rem 1rem;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 600;
    width: fit-content;
  }
  .pp-stock-badge.in-stock { background: #F0FDF4; color: #15803D; }
  .pp-stock-badge.out-of-stock { background: #FEF2F2; color: #DC2626; }

  .pp-description {
    font-size: 0.95rem;
    color: #4B5563;
    line-height: 1.7;
    margin: 0;
  }

  .pp-specs-section { display: flex; flex-direction: column; gap: 0.5rem; }
  .pp-specs-title {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #9CA3AF;
    font-family: 'DM Mono', monospace;
    margin: 0;
  }
  .pp-specs-table {
    width: 100%;
    border-collapse: collapse;
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #F3F4F6;
  }
  .pp-specs-table tr { border-bottom: 1px solid #F9FAFB; }
  .pp-specs-table tr:last-child { border-bottom: none; }
  .pp-spec-key {
    padding: 0.6rem 1rem;
    font-size: 0.8rem;
    color: #6B7280;
    font-family: 'DM Mono', monospace;
    width: 40%;
    background: #FAFAFA;
  }
  .pp-spec-val {
    padding: 0.6rem 1rem;
    font-size: 0.85rem;
    color: #111827;
    font-weight: 500;
  }

  .pp-qty-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0; }
  .pp-qty-label { font-size: 0.85rem; font-weight: 600; color: #374151; }
  .pp-qty-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid #D1D5DB; background: #fff; font-size: 1.1rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #374151; transition: all 0.15s; }
  .pp-qty-btn:hover { background: #F3F4F6; border-color: #9CA3AF; }
  .pp-qty-value { font-size: 1rem; font-weight: 700; min-width: 28px; text-align: center; font-family: 'DM Mono', monospace; }
  .pp-qty-max { font-size: 0.7rem; color: #9CA3AF; font-family: 'DM Mono', monospace; }
  .pp-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.5rem; }
  .pp-cart-btn {
    flex: 1;
    min-width: 140px;
    padding: 0.75rem 1.25rem;
    background: #2563EB;
    color: #fff;
    border: none;
    border-radius: 12px;
    font-family: 'Sora', sans-serif;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .pp-cart-btn:hover { background: #1D4ED8; }
  .pp-cart-btn:disabled { opacity: 0.7; cursor: default; }
  .pp-buy-btn {
    flex: 1;
    min-width: 140px;
    padding: 0.75rem 1.25rem;
    background: #F59E0B;
    color: #fff;
    border: none;
    border-radius: 12px;
    font-family: 'Sora', sans-serif;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .pp-buy-btn:hover { background: #D97706; }
  .pp-ask-btn {
    flex: 1;
    min-width: 140px;
    padding: 0.75rem 1.25rem;
    background: #EFF6FF;
    color: #2563EB;
    border: 1.5px solid #BFDBFE;
    border-radius: 12px;
    font-family: 'Sora', sans-serif;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .pp-ask-btn:hover { background: #DBEAFE; }
  .pp-notify-btn {
    flex: 1;
    min-width: 160px;
    padding: 0.75rem 1.25rem;
    background: #FFF7ED;
    border: 1.5px solid #FED7AA;
    border-radius: 12px;
    color: #C2410C;
    font-family: 'Sora', sans-serif;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .pp-notify-btn:hover:not(:disabled) { background: #FFEDD5; }
  .pp-notify-btn:disabled { opacity: 0.7; cursor: default; }
  .pp-notify-done { background: #F0FDF4; border-color: #BBF7D0; color: #15803D; }

  .pp-back-btn {
    padding: 0.6rem 1.25rem;
    background: #2563EB;
    color: #fff;
    border: none;
    border-radius: 10px;
    font-family: 'Sora', sans-serif;
    font-size: 0.9rem;
    cursor: pointer;
    margin-top: 1rem;
  }

  .pp-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 1rem;
    color: #6B7280;
    font-size: 1rem;
  }
  .pp-spinner {
    width: 36px;
    height: 36px;
    border: 3px solid #E5E7EB;
    border-top-color: #2563EB;
    border-radius: 50%;
    animation: ppspin 0.8s linear infinite;
  }
  @keyframes ppspin { to { transform: rotate(360deg); } }

  @media (max-width: 768px) {
    .pp-container {
      grid-template-columns: 1fr;
      padding: 1.25rem 1rem;
      gap: 1.5rem;
    }
    .pp-img-box { height: 240px; }
    .pp-img-icon { font-size: 5rem; }
    .pp-name { font-size: 1.5rem; }
    .pp-price-main { font-size: 1.5rem; }
  }
`;
