import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { useRealtimeListener } from '../hooks/useRealtimeListener';
import { clearCart, removeFromCart, updateCartQuantity } from '../firebase/cart';
import { createOrder } from '../firebase/orders';
import { updateProductStock } from '../firebase/products';
import { validateCoupon } from '../firebase/coupons';
import { validateFlashDealCode, markFlashDealUsed } from '../firebase/flashDeals';
import TopNav from '../components/TopNav';

export default function Checkout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const buyNowId = searchParams.get('buyNow');

  const { data: products } = useRealtimeListener('products');
  const cartPath = user ? `carts/${user.uid}` : null;
  const { data: cartItems } = useRealtimeListener(cartPath);

  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [appliedFlashDeal, setAppliedFlashDeal] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponApplying, setCouponApplying] = useState(false);

  const handleRemove = async (productId) => {
    setRemoving(productId);
    await removeFromCart(user.uid, productId);
    setRemoving(null);
  };

  const handleApplyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) return;
    setCouponApplying(true);
    setCouponError('');
    setAppliedCoupon(null);
    setAppliedFlashDeal(null);
    try {
      const coupon = await validateCoupon(code);
      if (coupon) {
        if (coupon.applicableOn) {
          const itemCategories = items.map((item) => {
            const product = products.find((p) => p.id === (item.productId || item.id));
            return product?.category;
          });
          const matches = itemCategories.some((cat) => cat === coupon.applicableOn);
          if (!matches) {
            setCouponError(`This coupon only applies to ${coupon.applicableOn} products.`);
            setCouponApplying(false);
            return;
          }
        }
        setAppliedCoupon(coupon);
        setCouponApplying(false);
        return;
      }
      const flashDeal = await validateFlashDealCode(code, user?.uid);
      if (flashDeal) {
        setAppliedFlashDeal(flashDeal);
        setCouponApplying(false);
        return;
      }
      setCouponError('Invalid or expired coupon code.');
    } catch {
      setCouponError('Failed to validate coupon. Try again.');
    }
    setCouponApplying(false);
  };

  if (!user) {
    return (
      <>
        <style>{styles}</style>
        <TopNav />
        <div className="co-page">
          <div className="co-empty">
            <span style={{ fontSize: '2rem' }}>🔒</span>
            <h2>Sign in to checkout</h2>
            <p>Please sign in to view your cart and place orders.</p>
            <button className="co-btn-primary" onClick={() => navigate('/login')}>Sign In</button>
          </div>
        </div>
      </>
    );
  }

  // For buy now flow: find product and treat as single-item cart
  const buyNowProduct = buyNowId ? products.find((p) => p.id === buyNowId) : null;
  const buyNowQty = Math.max(1, parseInt(searchParams.get('qty')) || 1);
  const items = buyNowProduct
    ? [{ id: buyNowProduct.id, productId: buyNowProduct.id, name: buyNowProduct.name, price: buyNowProduct.price || 0, quantity: buyNowQty, image: buyNowProduct.image || '' }]
    : (cartItems || []);

  const activeDiscount = appliedCoupon || appliedFlashDeal;
  const subtotal = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  const discountPercent = activeDiscount?.discountPercent || 0;
  let discountAmount = 0;
  let discountDetails = [];
  if (activeDiscount?.applicableOn) {
    items.forEach(item => {
      const product = products.find(p => p.id === (item.productId || item.id));
      if (product?.category === activeDiscount.applicableOn) {
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        const saved = Math.round(itemTotal * discountPercent / 100);
        discountAmount += saved;
        discountDetails.push({ name: item.name, saved });
      }
    });
  } else {
    discountAmount = Math.round(subtotal * discountPercent / 100);
  }
  const total = subtotal - discountAmount;

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    setPlacing(true);
    try {
      for (const item of items) {
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        let itemDiscount = 0;
        if (activeDiscount) {
          if (activeDiscount.applicableOn) {
            const product = products.find(p => p.id === (item.productId || item.id));
            if (product?.category === activeDiscount.applicableOn) {
              itemDiscount = Math.round(itemTotal * discountPercent / 100);
            }
          } else {
            itemDiscount = Math.round(itemTotal * discountPercent / 100);
          }
        }
        await createOrder({
          customerId: user.uid,
          items: [item],
          total: itemTotal - itemDiscount,
          couponCode: activeDiscount?.code || '',
          couponDiscount: discountPercent,
        });
        const product = products.find(p => p.id === (item.productId || item.id));
        if (product) {
          const newStock = Math.max(0, (product.stock || 0) - (item.quantity || 1));
          await updateProductStock(item.productId || item.id, newStock);
        }
      }
      if (appliedFlashDeal) {
        await markFlashDealUsed(appliedFlashDeal.id);
      }
      if (!buyNowProduct) {
        await clearCart(user.uid);
      }
      setPlaced(true);
    } catch (err) {
      alert('Failed to place order: ' + err.message);
    }
    setPlacing(false);
  };

  if (placed) {
    return (
      <>
        <style>{styles}</style>
        <TopNav />
        <div className="co-page">
          <div className="co-empty">
            <span style={{ fontSize: '3rem' }}>✅</span>
            <h2>Order Placed Successfully!</h2>
            <p>Your order has been confirmed. You can track it from your account.</p>
            <button className="co-btn-primary" onClick={() => navigate('/orders')}>View My Orders</button>
            <button className="co-btn-secondary" onClick={() => navigate('/products')} style={{ marginLeft: '0.75rem' }}>Continue Shopping</button>
          </div>
        </div>
      </>
    );
  }

  if (!buyNowProduct && !cartItems) {
    return (
      <>
        <style>{styles}</style>
        <TopNav />
        <div className="co-page"><div className="co-loading"><div className="co-spinner" /><span>Loading cart...</span></div></div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <TopNav />
      <div className="co-page">
        <div className="co-container">
          <h1 className="co-title">Checkout</h1>

          {items.length === 0 ? (
            <div className="co-empty">
              <span style={{ fontSize: '3rem' }}>🛒</span>
              <h2>Your cart is empty</h2>
              <p>Add some products before checking out.</p>
              <button className="co-btn-primary" onClick={() => navigate('/products')}>Browse Products</button>
            </div>
          ) : (
            <>
              <div className="co-items">
                {items.map((item) => {
                  const prod = products.find(p => p.id === (item.productId || item.id));
                  const maxStock = prod ? prod.stock : 999;
                  const qty = item.quantity || 1;
                  return (
                  <div key={item.id || item.productId} className="co-item">
                    <div className="co-item-info">
                      <span className="co-item-name">{item.name}</span>
                      {!buyNowProduct ? (
                        <div className="co-qty-row">
                          <button className="co-qty-btn" onClick={() => updateCartQuantity(user.uid, item.productId || item.id, qty - 1)} disabled={qty <= 1}>−</button>
                          <span className="co-qty-value">{qty}</span>
                          <button className="co-qty-btn" onClick={() => updateCartQuantity(user.uid, item.productId || item.id, qty + 1)} disabled={qty >= maxStock}>+</button>
                        </div>
                      ) : (
                        <span className="co-item-qty">Qty: {qty}</span>
                      )}
                    </div>
                    <div className="co-item-right">
                      <span className="co-item-price">₹{((item.price || 0) * qty).toLocaleString()}</span>
                      {!buyNowProduct && (
                        <button
                          className="co-remove-btn"
                          onClick={() => handleRemove(item.productId || item.id)}
                          disabled={removing === (item.productId || item.id)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>

              <div className="co-coupon-section">
                <h3 className="co-pay-title">Coupon Code</h3>
                {appliedCoupon || appliedFlashDeal ? (
                  <div className="co-coupon-applied">
                    <span>✅ {(appliedCoupon || appliedFlashDeal).code} — {(appliedCoupon || appliedFlashDeal).discountPercent}% off</span>
                    <button className="co-coupon-remove" onClick={() => { setAppliedCoupon(null); setAppliedFlashDeal(null); setCouponCode(''); setCouponError(''); }}>✕</button>
                  </div>
                ) : (
                  <div className="co-coupon-input-row">
                    <input
                      className="co-coupon-input"
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value); setCouponError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                    />
                    <button className="co-coupon-apply" onClick={handleApplyCoupon} disabled={couponApplying || !couponCode.trim()}>
                      {couponApplying ? '...' : 'Apply'}
                    </button>
                  </div>
                )}
                {couponError && <div className="co-coupon-error">{couponError}</div>}
              </div>

              <div className="co-payment-section">
                <h3 className="co-pay-title">Payment Method</h3>
                <div className="co-pay-option">
                  <span>💵 Cash on Delivery</span>
                  <span className="co-pay-check">✓</span>
                </div>
              </div>

              <div className="co-total-row" style={{ flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span className="co-total-label">Subtotal</span>
                  <span className="co-total-label" style={{ fontWeight: 700 }}>₹{subtotal.toLocaleString()}</span>
                </div>
                {discountPercent > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span className="co-total-label" style={{ color: '#10B981' }}>
                        Discount ({discountPercent}%){appliedCoupon?.applicableOn ? ` on ${appliedCoupon.applicableOn}` : ''}
                      </span>
                      <span className="co-total-label" style={{ fontWeight: 700, color: '#10B981' }}>-₹{discountAmount.toLocaleString()}</span>
                    </div>
                    {discountDetails.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#10B981', lineHeight: '1.4' }}>
                        {discountDetails.map((d, i) => (
                          <div key={i}>{d.name}: -₹{d.saved.toLocaleString()}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', borderTop: '1px solid #E5E7EB', paddingTop: '0.5rem' }}>
                  <span className="co-total-label" style={{ fontSize: '1rem', fontWeight: 700 }}>Total</span>
                  <span className="co-total-amount">₹{total.toLocaleString()}</span>
                </div>
              </div>

              <button
                className="co-btn-primary co-place-btn"
                onClick={handlePlaceOrder}
                disabled={placing}
              >
                {placing ? 'Placing Order...' : 'Place Order'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  .co-page {
    min-height: 100vh;
    background: #F9FAFB;
    font-family: 'Sora', sans-serif;
    color: #111827;
  }
  .co-container {
    max-width: 640px;
    margin: 0 auto;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .co-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
  }
  .co-loading {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 60vh; gap: 1rem; color: #6B7280;
  }
  .co-spinner {
    width: 36px; height: 36px;
    border: 3px solid #E5E7EB; border-top-color: #2563EB;
    border-radius: 50%; animation: cospin 0.8s linear infinite;
  }
  @keyframes cospin { to { transform: rotate(360deg); } }
  .co-empty {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 50vh; gap: 0.75rem; text-align: center;
  }
  .co-empty h2 { margin: 0; font-size: 1.25rem; }
  .co-empty p { margin: 0; color: #6B7280; }
  .co-items {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .co-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #fff;
    border: 1px solid #E5E7EB;
    border-radius: 12px;
    padding: 1rem 1.25rem;
  }
  .co-item-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .co-item-name {
    font-weight: 600;
    font-size: 0.95rem;
  }
  .co-item-qty {
    font-size: 0.8rem;
    color: #6B7280;
    font-family: 'DM Mono', monospace;
  }
  .co-qty-row { display: flex; align-items: center; gap: 0.35rem; margin-top: 0.25rem; }
  .co-qty-btn { width: 26px; height: 26px; border-radius: 6px; border: 1px solid #D1D5DB; background: #fff; font-size: 0.9rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #374151; padding: 0; line-height: 1; }
  .co-qty-btn:hover:not(:disabled) { background: #F3F4F6; }
  .co-qty-btn:disabled { opacity: 0.3; cursor: default; }
  .co-qty-value { font-size: 0.85rem; font-weight: 700; min-width: 20px; text-align: center; font-family: 'DM Mono', monospace; }
  .co-item-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .co-item-price {
    font-weight: 700;
    font-size: 1rem;
    color: #111827;
  }
  .co-remove-btn {
    background: #FEF2F2;
    border: 1px solid #FECACA;
    color: #EF4444;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 700;
    transition: all 0.15s;
    padding: 0;
  }
  .co-remove-btn:hover { background: #FEE2E2; }
  .co-remove-btn:disabled { opacity: 0.5; cursor: default; }
  .co-total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem;
    background: #fff;
    border: 1px solid #E5E7EB;
    border-radius: 12px;
  }
  .co-total-label {
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
  }
  .co-total-amount {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
  }
  .co-payment-section {
    background: #fff;
    border: 1px solid #E5E7EB;
    border-radius: 12px;
    padding: 1.25rem;
  }
  .co-pay-title {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #9CA3AF;
    font-family: 'DM Mono', monospace;
    margin: 0 0 0.75rem;
  }
  .co-pay-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #F0FDF4;
    border: 1.5px solid #BBF7D0;
    border-radius: 8px;
    font-weight: 600;
    color: #15803D;
  }
  .co-pay-check {
    color: #10B981;
    font-weight: 700;
  }
  .co-coupon-section {
    background: #fff;
    border: 1px solid #E5E7EB;
    border-radius: 12px;
    padding: 1.25rem;
  }
  .co-coupon-input-row {
    display: flex;
    gap: 0.5rem;
  }
  .co-coupon-input {
    flex: 1;
    padding: 0.6rem 1rem;
    border: 1.5px solid #E5E7EB;
    border-radius: 8px;
    font-family: 'Sora', sans-serif;
    font-size: 0.85rem;
    outline: none;
    transition: border-color 0.2s;
    color: #111827;
    background: #fff;
  }
  .co-coupon-input:focus { border-color: #2563EB; }
  .co-coupon-apply {
    padding: 0.6rem 1.25rem;
    background: #2563EB;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-family: 'Sora', sans-serif;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }
  .co-coupon-apply:hover { background: #1D4ED8; }
  .co-coupon-apply:disabled { opacity: 0.6; cursor: default; }
  .co-coupon-applied {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 1rem;
    background: #F0FDF4;
    border: 1.5px solid #BBF7D0;
    border-radius: 8px;
    font-weight: 600;
    color: #15803D;
    font-size: 0.85rem;
  }
  .co-coupon-remove {
    background: transparent;
    border: none;
    color: #EF4444;
    cursor: pointer;
    font-size: 1rem;
    padding: 0.2rem;
  }
  .co-coupon-error {
    font-size: 0.8rem;
    color: #EF4444;
    margin-top: 0.5rem;
  }
  .co-btn-primary {
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
  .co-btn-primary:hover { background: #1D4ED8; }
  .co-btn-primary:disabled { opacity: 0.7; cursor: default; }
  .co-btn-secondary {
    padding: 0.75rem 1.5rem;
    background: #fff;
    color: #374151;
    border: 1.5px solid #E5E7EB;
    border-radius: 12px;
    font-family: 'Sora', sans-serif;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .co-btn-secondary:hover { border-color: #9CA3AF; }
  .co-place-btn {
    width: 100%;
    padding: 1rem;
    font-size: 1.1rem;
  }
`;
