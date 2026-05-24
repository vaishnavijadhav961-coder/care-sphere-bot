import React, { useState } from 'react';
import { useRealtimeListener } from '../hooks/useRealtimeListener';
import { updateOrderStatus, seedOrders } from '../firebase/orders';
import { resolveEscalation, createEscalation, seedEscalations, addMessageToEscalation } from '../firebase/escalations';
import { updateProductStock, createProduct, seedProducts } from '../firebase/products';
import { createCoupon, seedCoupons, seedFlashDeals } from '../firebase/coupons';
import '../styles/admin.css';

// Futuristic SaaS Dashboard for COSMIC QUERY (CareSphere AI)
export default function Admin() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('overview');

  // Realtime Database Listeners
  const { data: orders, loading: ordersLoading } = useRealtimeListener('orders', 'orderDate', 'desc');
  const { data: escalations, loading: escalationsLoading } = useRealtimeListener('escalations', 'createdAt', 'desc');
  const { data: products, loading: productsLoading } = useRealtimeListener('products');
  const { data: coupons, loading: couponsLoading } = useRealtimeListener('coupons');
  const { data: flashDeals, loading: flashDealsLoading } = useRealtimeListener('flashDealCodes');

  // Local States for Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('All');
  const [expandedEscalations, setExpandedEscalations] = useState({});
  const [agentReplies, setAgentReplies] = useState({});
  const [theme, setTheme] = useState('dark'); 
  
  // Delay Modal States
  const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);
  const [selectedOrderForDelay, setSelectedOrderForDelay] = useState(null);
  const [delayReason, setDelayReason] = useState('');
  const [newDeliveryDate, setNewDeliveryDate] = useState('');

  // Form States
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    stock: '',
    category: 'Audio',
    description: ''
  });

  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discountPercent: '',
    expiryDate: '',
    isActive: true
  });

  // Seeding Status
  const [seedingStatus, setSeedingStatus] = useState('');

  // Calculate Metrics
  const totalRevenue = orders.reduce((sum, o) => sum + (o.price || 0), 0);
  const activeOrdersCount = orders.filter(o => o.status !== 'Delivered').length;
  const unresolvedEscCount = escalations.filter(e => e.status !== 'resolved').length;
  const lowStockCount = products.filter(p => p.stock <= 5).length;

  // Apply Theme Toggle
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // Set initial theme on mount
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  // Handle Order Status Change Dropdown
  const handleStatusChange = async (orderId, newStatus) => {
    if (newStatus === 'Delayed') {
      const order = orders.find(o => o.id === orderId);
      setSelectedOrderForDelay(order);
      setDelayReason('');
      
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 5);
      setNewDeliveryDate(defaultDate.toISOString().split('T')[0]);
      
      setIsDelayModalOpen(true);
    } else {
      try {
        await updateOrderStatus(orderId, newStatus);
        alert(`Order ${orderId} status successfully updated to ${newStatus}!`);
      } catch (err) {
        alert(`Failed to update order status: ${err.message}`);
      }
    }
  };

  // Submit Delay Modal Form
  const submitDelayDetails = async (e) => {
    e.preventDefault();
    if (!selectedOrderForDelay) return;

    try {
      const formattedDate = new Date(newDeliveryDate).toISOString();
      await updateOrderStatus(selectedOrderForDelay.id, 'Delayed', {
        delayReason,
        estimatedDelivery: formattedDate
      });
      setIsDelayModalOpen(false);
      setSelectedOrderForDelay(null);
      alert(`Order ${selectedOrderForDelay.id} marked as delayed with reason.`);
    } catch (err) {
      alert(`Error updating delay details: ${err.message}`);
    }
  };

  // Toggle Escalation Card Accordion
  const toggleEscalationExpand = (id) => {
    setExpandedEscalations(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Resolve Escalation
  const handleResolveEscalation = async (id) => {
    try {
      await resolveEscalation(id);
      alert(`Escalation ticket ${id} marked as resolved!`);
    } catch (err) {
      alert(`Failed to resolve escalation: ${err.message}`);
    }
  };

  // Send Agent Reply
  const handleSendAgentReply = async (e, escalationId) => {
    e.preventDefault();
    const text = agentReplies[escalationId]?.trim();
    if (!text) return;

    try {
      await addMessageToEscalation(escalationId, 'agent', text);
      setAgentReplies(prev => ({
        ...prev,
        [escalationId]: ''
      }));
    } catch (err) {
      alert(`Failed to send message: ${err.message}`);
    }
  };

  // Adjust Product Stock directly
  const adjustStock = async (productId, currentStock, delta) => {
    const nextStock = Math.max(0, currentStock + delta);
    try {
      await updateProductStock(productId, nextStock);
    } catch (err) {
      alert(`Failed to adjust stock: ${err.message}`);
    }
  };

  // Create Product Form Submission
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price || !newProduct.stock) {
      alert('Please fill out Name, Price and Stock count.');
      return;
    }
    try {
      await createProduct(newProduct);
      setNewProduct({
        name: '',
        price: '',
        stock: '',
        category: 'Audio',
        description: ''
      });
      alert('Cosmic product successfully created!');
    } catch (err) {
      alert(`Failed to create product: ${err.message}`);
    }
  };

  // Create Coupon Form Submission
  const handleCouponSubmit = async (e) => {
    e.preventDefault();
    if (!newCoupon.code || !newCoupon.discountPercent) {
      alert('Please fill out Code and Discount Percent.');
      return;
    }
    try {
      // Set default expiry date to 30 days out if blank
      const finalExpiry = newCoupon.expiryDate 
        ? new Date(newCoupon.expiryDate).toISOString() 
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        
      await createCoupon({
        ...newCoupon,
        expiryDate: finalExpiry
      });
      setNewCoupon({
        code: '',
        discountPercent: '',
        expiryDate: '',
        isActive: true
      });
      alert('Coupon code successfully created!');
    } catch (err) {
      alert(`Failed to create coupon: ${err.message}`);
    }
  };

  // One-Click Hackathon Seeder
  const runDatabaseSeeder = async () => {
    setSeedingStatus('Seeding database... 🛸');
    try {
      // 1. Mock Products — matching AGENTS.md schema
      const mockProducts = [
        { id: 'prod_iphone15', name: 'iPhone 15', price: 79900, stock: 15, discount: 10, rating: 4.5, category: 'smartphones', pageUrl: 'iphone15', inStock: true, description: 'Latest iPhone with A16 Bionic chip and 48MP camera', specs: { processor: 'A16 Bionic', display: '6.1 inch OLED', battery: '20 hours', camera: '48MP' }, notifyList: [] },
        { id: 'prod_samsungs24', name: 'Samsung Galaxy S24', price: 69900, stock: 12, discount: 15, rating: 4.4, category: 'smartphones', pageUrl: 'samsung-s24', inStock: true, description: 'Premium Android with AI features and stunning display', specs: { processor: 'Exynos 2400', display: '6.2 inch AMOLED', battery: '22 hours', camera: '50MP' }, notifyList: [] },
        { id: 'prod_nikeairmax', name: 'Nike Air Max', price: 8999, stock: 20, discount: 25, rating: 4.3, category: 'footwear', pageUrl: 'nike-air-max', inStock: true, description: 'Comfortable running shoes with Air cushioning technology', specs: { sole: 'Rubber', closure: 'Lace-up', weight: '280g' }, notifyList: [] },
        { id: 'prod_adidasultra', name: 'Adidas Ultraboost', price: 11999, stock: 8, discount: 20, rating: 4.6, category: 'footwear', pageUrl: 'adidas-ultraboost', inStock: true, description: 'Ultra-comfortable running shoes with Boost technology', specs: { sole: 'Continental Rubber', closure: 'Lace-up', weight: '260g' }, notifyList: [] },
        { id: 'prod_serum', name: 'Vitamin C Serum', price: 1299, stock: 30, discount: 5, rating: 4.2, category: 'skincare', pageUrl: 'vitamin-c-serum', inStock: true, description: 'Brightening serum with 20% Vitamin C and Hyaluronic Acid', specs: { volume: '30ml', ingredients: 'Vitamin C, HA, Vitamin E', skinType: 'All' }, notifyList: [] },
        { id: 'prod_moisturizer', name: 'Hydra Glow Moisturizer', price: 899, stock: 0, discount: 0, rating: 4.0, category: 'skincare', pageUrl: 'hydra-glow', inStock: false, description: 'Lightweight daily moisturizer with SPF 30', specs: { volume: '50ml', spf: '30', skinType: 'All' }, notifyList: ['user123'] },
        { id: 'prod_samsonite', name: 'Samsonite Lite luggage', price: 5499, stock: 7, discount: 30, rating: 4.7, category: 'luggage', pageUrl: 'samsonite-lite', inStock: true, description: 'Ultra-lightweight hard shell luggage with 4 spinner wheels', specs: { capacity: '60L', weight: '2.5kg', material: 'Polycarbonate' }, notifyList: [] },
        { id: 'prod_sonyxm5', name: 'Sony WH-1000XM5', price: 24990, stock: 5, discount: 12, rating: 4.8, category: 'headphones', pageUrl: 'sony-xm5', inStock: true, description: 'Industry-leading noise cancelling headphones', specs: { driver: '30mm', battery: '30 hours', noiseCancelling: 'Adaptive' }, notifyList: ['user456'] },
        { id: 'prod_airpods', name: 'AirPods Pro 2', price: 19900, stock: 10, discount: 8, rating: 4.6, category: 'headphones', pageUrl: 'airpods-pro-2', inStock: true, description: 'Premium wireless earbuds with active noise cancellation', specs: { chip: 'H2', battery: '6 hours', charging: 'USB-C/MagSafe' }, notifyList: [] },
        { id: 'prod_macbook', name: 'MacBook Air M3', price: 99900, stock: 6, discount: 5, rating: 4.9, category: 'electronics', pageUrl: 'macbook-air-m3', inStock: true, description: 'Ultra-thin laptop with Apple M3 chip and 18-hour battery', specs: { processor: 'Apple M3', ram: '16GB', storage: '256GB', display: '15.3 inch' }, notifyList: [] }
      ];
      await seedProducts(mockProducts);

      // 2. Mock Orders — matching AGENTS.md schema
      const now = new Date();
      const formatDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const fiveDaysAgo = new Date(now - 5 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now + 1 * 24 * 60 * 60 * 1000);
      const nextWeek = new Date(now + 7 * 24 * 60 * 60 * 1000);

      const mockOrders = [
        { id: 'ord_1023', customerId: 'user123', productId: 'prod_nikeairmax', productName: 'Nike Air Max', price: 8999, status: 'Delayed', orderDate: fiveDaysAgo.toISOString(), shippedDate: formatDate(threeDaysAgo), estimatedDelivery: threeDaysAgo.toISOString(), newDate: formatDate(nextWeek), delayReason: 'Weather disruption in transit hub', trackingNumber: 'TRK-NIKE-1023', timeline: [
          { status: 'Confirmed', date: formatDate(fiveDaysAgo), completed: true },
          { status: 'Shipped', date: formatDate(threeDaysAgo), completed: true },
          { status: 'Delayed', date: formatDate(now), completed: false }
        ]},
        { id: 'ord_1024', customerId: 'user123', productId: 'prod_iphone15', productName: 'iPhone 15', price: 79900, status: 'Shipped', orderDate: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), shippedDate: formatDate(new Date(now - 1 * 24 * 60 * 60 * 1000)), estimatedDelivery: tomorrow.toISOString(), newDate: '', delayReason: '', trackingNumber: 'TRK-IPHN-1024', timeline: [
          { status: 'Confirmed', date: formatDate(new Date(now - 2 * 24 * 60 * 60 * 1000)), completed: true },
          { status: 'Shipped', date: formatDate(new Date(now - 1 * 24 * 60 * 60 * 1000)), completed: true }
        ]},
        { id: 'ord_1025', customerId: 'user123', productId: 'prod_sonyxm5', productName: 'Sony WH-1000XM5', price: 24990, status: 'Confirmed', orderDate: now.toISOString(), shippedDate: '', estimatedDelivery: nextWeek.toISOString(), newDate: '', delayReason: '', trackingNumber: '', timeline: [
          { status: 'Confirmed', date: formatDate(now), completed: true }
        ]}
      ];
      await seedOrders(mockOrders);

      // 3. Mock Coupons & Flash Deal Codes — matching AGENTS.md schema
      const mockCoupons = [
        { code: 'SAVE20', discount: '20% off', discountPercent: 20, description: 'Electronics above ₹10,000', applicableOn: 'electronics', validTill: '31st December 2026', expiryDate: '2026-12-31T23:59:59.000Z', isActive: true },
        { code: 'FLEET10', discount: '10% off', discountPercent: 10, description: 'Footwear and accessories', applicableOn: 'footwear', validTill: '30th June 2026', expiryDate: '2026-06-30T23:59:59.000Z', isActive: true },
        { code: 'GLOW15', discount: '15% off', discountPercent: 15, description: 'All skincare products', applicableOn: 'skincare', validTill: '31st July 2026', expiryDate: '2026-07-31T23:59:59.000Z', isActive: true }
      ];
      await seedCoupons(mockCoupons);

      const mockFlashDeals = [
        { code: 'QUIZ15', discountPercent: 15, isActive: true, expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() }
      ];
      await seedFlashDeals(mockFlashDeals);

      // 4. Mock Escalations
      const mockEscalations = [
        {
          id: 'esc_5542',
          customerId: 'user123',
          customerName: 'Major Tom',
          urgency: 'urgent',
          summary: 'Customer claims headset noise-isolation is leaking interstellar background noise.',
          chatHistory: [
            { sender: 'bot', message: 'Hello! How can CareSphere AI assist you today?', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
            { sender: 'customer', message: 'Hi, my Cosmic Voyager headset is emitting weird low-frequency humming when I look towards Orion.', timestamp: new Date(Date.now() - 28 * 60 * 1000).toISOString() },
            { sender: 'bot', message: 'That sounds unusual. I am escalating you to our human specialist queue immediately.', timestamp: new Date(Date.now() - 27 * 60 * 1000).toISOString() }
          ],
          status: 'unresolved',
          createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString()
        },
        {
          id: 'esc_5543',
          customerId: 'user123',
          customerName: 'Stardust Lady',
          urgency: 'unresolved',
          summary: 'Inquiry regarding shipment delay for Cosmic Voyager headset.',
          chatHistory: [
            { sender: 'bot', message: 'Welcome to COSMIC QUERY support. How can I help you?', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
            { sender: 'customer', message: 'My order ord_99827 says shipped but is 2 days past its estimated delivery. Where is it?', timestamp: new Date(Date.now() - 1.9 * 60 * 60 * 1000).toISOString() },
            { sender: 'bot', message: 'Let me fetch our human agent to look deeper into the delivery delay.', timestamp: new Date(Date.now() - 1.8 * 60 * 60 * 1000).toISOString() }
          ],
          status: 'unresolved',
          createdAt: new Date(Date.now() - 1.7 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'esc_5544',
          customerId: 'user123',
          customerName: 'Luke Skywalker',
          urgency: 'resolved',
          summary: 'Difficulty applying coupon code COSMIC20.',
          chatHistory: [
            { sender: 'bot', message: 'Hello! Got coupon issues?', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
            { sender: 'customer', message: 'Yes, COSMIC20 gives me a code error in checkout.', timestamp: new Date(Date.now() - 3.8 * 60 * 60 * 1000).toISOString() },
            { sender: 'bot', message: 'Transferring to human support...', timestamp: new Date(Date.now() - 3.7 * 60 * 60 * 1000).toISOString() },
            { sender: 'agent', message: 'Hi Luke! I refreshed your profile application. You can apply COSMIC20 successfully now.', timestamp: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString() },
            { sender: 'customer', message: 'Awesome, it worked! Thanks!', timestamp: new Date(Date.now() - 3.4 * 60 * 60 * 1000).toISOString() }
          ],
          status: 'resolved',
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
        }
      ];
      await seedEscalations(mockEscalations);

      setSeedingStatus('Seeded successfully! 🌌');
      setTimeout(() => setSeedingStatus(''), 4000);
    } catch (err) {
      setSeedingStatus(`Seeding failed: ${err.message}`);
      setTimeout(() => setSeedingStatus(''), 6000);
    }
  };

  // Realtime Ticket Simulator
  const triggerSimulatorTicket = async (type) => {
    if (type === 'urgent_escalation') {
      const urgentMock = {
        customerId: 'user123',
        customerName: 'Simulated Astronaut',
        urgency: 'urgent',
        summary: 'HELP! Absolute system oxygen readout error simulation! Urgent support.',
        chatHistory: [
          { sender: 'bot', message: 'This is CareSphere AI. Please describe the emergency.', timestamp: new Date().toISOString() },
          { sender: 'customer', message: 'My dashboard is flashing error 8891-COSMIC. What does that mean?', timestamp: new Date().toISOString() },
          { sender: 'bot', message: 'Oxygen sensors should never show that. Escalating instantly to ground control support.', timestamp: new Date().toISOString() }
        ],
        status: 'unresolved'
      };
      try {
        await createEscalation(urgentMock);
        alert('Simulated Live URGENT Escalation Ticket sent! Check queue instantly in realtime.');
      } catch (err) {
        alert(`Failed simulation: ${err.message}`);
      }
    } else if (type === 'delayed_order') {
      const orderMock = [
        {
          id: `ord_${Math.floor(10000 + Math.random() * 90000)}`,
          customerId: 'user123',
          productName: 'Nebula Mouse Pad',
          price: 29.99,
          status: 'Shipped',
          orderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          estimatedDelivery: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          trackingNumber: 'TRK-SIM-DELAY-9901'
        }
      ];
      try {
        await seedOrders(orderMock);
        alert('Simulated Shipped Order (Older than 3 days) added! Great for demo testing.');
      } catch (err) {
        alert(`Failed simulation: ${err.message}`);
      }
    }
  };

  // Filter lists based on user search inputs
  const filteredOrders = orders.filter(order => {
    const s = searchTerm.toLowerCase();
    return (
      order.id.toLowerCase().includes(s) ||
      order.productName.toLowerCase().includes(s) ||
      order.status.toLowerCase().includes(s) ||
      order.customerId.toLowerCase().includes(s)
    );
  });

  const filteredProducts = products.filter(prod => {
    const matchSearch = prod.name.toLowerCase().includes(productSearch.toLowerCase()) || 
                        prod.id.toLowerCase().includes(productSearch.toLowerCase()) ||
                        (prod.description && prod.description.toLowerCase().includes(productSearch.toLowerCase()));
    const matchCategory = productCategoryFilter === 'All' ? true : prod.category === productCategoryFilter;
    return matchSearch && matchCategory;
  });

  // Unique categories for filtering
  const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];

  return (
    <div className="admin-container">
      {/* Header / Top Navigation Bar */}
      <header className="admin-header">
        <div className="brand-section">
          <div className="brand-logo-icon">CQ</div>
          <div>
            <h1 className="brand-title">COSMIC QUERY</h1>
            <p className="brand-tagline">CareSphere AI • Control Deck</p>
          </div>
        </div>
        <div className="header-controls">
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️ Light Deck' : '🌙 Dark Deck'}
          </button>
        </div>
      </header>

      {/* Main Area */}
      <main className="admin-main">
        
        {/* Hero Welcome banner */}
        <section className="admin-hero-banner">
          <h2 className="hero-title">Cosmic Admin Operations Panel</h2>
          <p className="hero-subtitle">
            Welcome, Controller. Monitor orders, update tracking states, adjust live product inventory, and handle human escalations in absolute realtime.
          </p>
        </section>

        {/* Tab Navigation Menu */}
        <div className="tab-navigation">
          <button 
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Support & Overview
          </button>
          <button 
            className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            📦 Orders ({orders.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            🛠️ Products ({products.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'coupons' ? 'active' : ''}`}
            onClick={() => setActiveTab('coupons')}
          >
            🎟️ Coupons & Deals
          </button>
        </div>

        {/* Seeder & Simulator module (Visible on Overview/Support tab) */}
        {activeTab === 'overview' && (
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            <div className="seeder-banner">
              <div className="seeder-header">
                <h3 className="seeder-title">One-Click System Seeder</h3>
                {seedingStatus && <span style={{ fontSize: '0.85rem', color: '#38BDF8' }}>{seedingStatus}</span>}
              </div>
              <p style={{ fontSize: '0.85rem', color: '#94A3B8', margin: 0 }}>
                Instantly populate your empty Realtime Database paths with premium mock products, orders, coupons, flash deal codes, and human escalations.
              </p>
              <div className="seeder-grid">
                <button className="seeder-btn" onClick={runDatabaseSeeder}>
                  🚀 Seed All RTDB Paths
                </button>
              </div>
            </div>

            <div className="simulator-widget" style={{ marginTop: 0 }}>
              <div className="sim-header">
                <span>🔮 Pitch Demo Realtime Simulator</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--subtext)', margin: 0 }}>
                Simulate customer events dynamically in the background to showcase the database's absolute live sync reactivity during the hackathon pitch.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="seeder-btn secondary" onClick={() => triggerSimulatorTicket('urgent_escalation')}>
                  ➕ Live Support Signal
                </button>
                <button className="seeder-btn secondary" onClick={() => triggerSimulatorTicket('delayed_order')}>
                  ➕ Late Shipment Simulation
                </button>
              </div>
            </div>
          </section>
        )}

        {/* TAB CONTENT: 1. OVERVIEW & SUPPORT QUEUE */}
        {activeTab === 'overview' && (
          <>
            {/* Statistics Row */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon-wrap revenue">💰</div>
                <div className="stat-info">
                  <span className="stat-label">Cosmic Revenue</span>
                  <span className="stat-value">${totalRevenue.toFixed(2)}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrap">📦</div>
                <div className="stat-info">
                  <span className="stat-label">Active Transmissions</span>
                  <span className="stat-value">{activeOrdersCount} orders</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrap tickets">🔥</div>
                <div className="stat-info">
                  <span className="stat-label">Unresolved Tickets</span>
                  <span className="stat-value">{unresolvedEscCount} active</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrap inventory">⚠️</div>
                <div className="stat-info">
                  <span className="stat-label">Low Stock Alarms</span>
                  <span className="stat-value">{lowStockCount} items</span>
                </div>
              </div>
            </div>

            {/* Dashboard Grid (Main Overview) */}
            <div className="dashboard-grid">
              {/* Column 1: Order quick summary */}
              <section className="section-panel">
                <div className="section-header">
                  <div className="section-title-wrap">
                    <span className="section-icon">📦</span>
                    <h3 className="section-title">Latest Order Signals</h3>
                  </div>
                  <button className="seeder-btn secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setActiveTab('orders')}>
                    View All
                  </button>
                </div>
                {ordersLoading ? (
                  <div className="empty-state">Loading order signals...</div>
                ) : orders.length === 0 ? (
                  <div className="empty-state">No orders in database. Run the system seeder.</div>
                ) : (
                  <div className="orders-table-container">
                    <table className="orders-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Product</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.slice(0, 5).map(o => (
                          <tr key={o.id}>
                            <td style={{ fontWeight: 'bold' }}>{o.id}</td>
                            <td>{o.productName}</td>
                            <td>
                              <span className={`status-badge ${o.status.toLowerCase()}`}>
                                {o.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Column 2: Escalation Queue */}
              <section className="section-panel">
                <div className="section-header">
                  <div className="section-title-wrap">
                    <span className="section-icon">🔥</span>
                    <h3 className="section-title">Human Escalation Queue</h3>
                  </div>
                  <span className="badge-count">
                    {unresolvedEscCount} unresolved
                  </span>
                </div>

                {escalationsLoading ? (
                  <div className="empty-state">Loading live support signals...</div>
                ) : escalations.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📡</div>
                    <div>Queue is quiet.</div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Use the Realtime Simulator or Seeder to trigger incoming support signals!</div>
                  </div>
                ) : (
                  <div className="escalations-list">
                    {escalations.map((esc) => {
                      const isExpanded = !!expandedEscalations[esc.id];
                      return (
                        <div key={esc.id} className={`escalation-card ${esc.urgency}`}>
                          {/* Accordion Trigger Header */}
                          <div className="escalation-card-header" onClick={() => toggleEscalationExpand(esc.id)}>
                            <div className="escalation-meta">
                              <div className="escalation-customer">
                                {esc.customerName}
                                <span className={`escalation-urgency-badge ${esc.urgency}`}>
                                  {esc.urgency}
                                </span>
                              </div>
                              <span className="escalation-time">
                                Ticket: {esc.id} • {new Date(esc.createdAt).toLocaleTimeString()}
                              </span>
                              {!isExpanded && (
                                <p className="escalation-summary-preview">{esc.summary}</p>
                              )}
                            </div>
                            <span className={`expand-chevron-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
                          </div>

                          {/* Accordion Expandable body */}
                          {isExpanded && (
                            <div className="escalation-card-details">
                              <div>
                                <div className="escalation-section-title">Issue Summary</div>
                                <div className="escalation-summary-full">{esc.summary}</div>
                              </div>

                              <div>
                                <div className="escalation-section-title">CareSphere AI Live Conversation</div>
                                <div className="chat-history-container">
                                  {esc.chatHistory && esc.chatHistory.map((chat, idx) => (
                                    <div key={idx} className={`chat-bubble ${chat.sender}`}>
                                      <div className="bubble-sender">{chat.sender}</div>
                                      <div>{chat.message}</div>
                                      {chat.timestamp && (
                                        <div className="bubble-time">
                                          {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {esc.status !== 'resolved' && (
                                <>
                                  <div className="agent-reply-section" style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', marginBottom: '1rem' }}>
                                    <div className="escalation-section-title">Support Specialist Response</div>
                                    <form onSubmit={(e) => handleSendAgentReply(e, esc.id)} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                      <input
                                        type="text"
                                        className="form-input"
                                        style={{ flex: 1, padding: '0.5rem 1rem', borderRadius: '4px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                                        placeholder="Type reply to customer..."
                                        value={agentReplies[esc.id] || ''}
                                        onChange={(e) => setAgentReplies(prev => ({ ...prev, [esc.id]: e.target.value }))}
                                      />
                                      <button type="submit" className="seeder-btn" style={{ padding: '0.5rem 1rem', borderRadius: '4px' }}>
                                        Send Reply
                                      </button>
                                    </form>
                                  </div>
                                  <button
                                    className="resolve-action-btn"
                                    onClick={() => handleResolveEscalation(esc.id)}
                                  >
                                    ✓ Mark Ticket as Resolved
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        {/* TAB CONTENT: 2. ORDERS MANAGEMENT */}
        {activeTab === 'orders' && (
          <section className="section-panel" style={{ width: '100%' }}>
            <div className="section-header">
              <div className="section-title-wrap">
                <span className="section-icon">📦</span>
                <h3 className="section-title">Order Transmissions</h3>
              </div>
              <span className="badge-count">{filteredOrders.length} orders found</span>
            </div>

            {/* Search filter row */}
            <div className="search-filter-row">
              <div className="search-input-wrap">
                <svg className="search-icon-svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
                </svg>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search orders by ID, product, status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {ordersLoading ? (
              <div className="empty-state">Loading order database...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🛰️</div>
                <div>No orders match query.</div>
              </div>
            ) : (
              <div className="orders-table-container">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Product</th>
                      <th>Placed Date</th>
                      <th>Delivery Date</th>
                      <th>Status Badge</th>
                      <th>Action Selector</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id}>
                        <td style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{order.id}</td>
                        <td>
                          <div>{order.productName}</div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--subtext)' }}>Customer: {order.customerId} • ${Number(order.price || 0).toFixed(2)}</span>
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>{new Date(order.orderDate).toLocaleDateString()}</td>
                        <td style={{ fontSize: '0.8rem' }}>
                          {new Date(order.estimatedDelivery).toLocaleDateString()}
                          {order.status === 'Delayed' && order.delayReason && (
                            <div style={{ color: 'var(--warning)', fontSize: '0.7rem', marginTop: '0.2rem' }}>
                              ⚠️ {order.delayReason}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`status-badge ${order.status.toLowerCase()}`}>
                            {order.status}
                          </span>
                        </td>
                        <td>
                          <div className="status-select-wrapper">
                            <select
                              className="status-select"
                              value={order.status}
                              onChange={(e) => handleStatusChange(order.id, e.target.value)}
                            >
                              <option value="Confirmed">Confirmed</option>
                              <option value="Shipped">Shipped</option>
                              <option value="Delayed">Delayed</option>
                              <option value="Delivered">Delivered</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* TAB CONTENT: 3. PRODUCTS & INVENTORY */}
        {activeTab === 'products' && (
          <div className="products-layout-grid">
            {/* Products grid */}
            <section className="section-panel">
              <div className="section-header">
                <div className="section-title-wrap">
                  <span className="section-icon">🛠️</span>
                  <h3 className="section-title">Live Product Inventory</h3>
                </div>
                <span className="badge-count">{filteredProducts.length} items</span>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="search-input-wrap" style={{ flex: '1 1 200px' }}>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search product inventory..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>
                <div className="status-select-wrapper" style={{ flex: '0 0 auto' }}>
                  <select 
                    className="status-select"
                    style={{ padding: '0.75rem 2rem 0.75rem 1rem' }}
                    value={productCategoryFilter}
                    onChange={(e) => setProductCategoryFilter(e.target.value)}
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {productsLoading ? (
                <div className="empty-state">Loading product assets...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="empty-state">No products found.</div>
              ) : (
                <div className="products-grid">
                    {filteredProducts.map(prod => {
                    const stock = prod.stock || 0;
                    const stockStatus = stock > 5 ? 'healthy' : stock > 0 ? 'low' : 'empty';
                    const discount = prod.discount || 0;
                    return (
                      <div className="product-card" key={prod.id}>
                        <div className="product-header">
                          <span className="product-title">{prod.name}</span>
                          <span className="product-price">₹{Number(prod.price || 0).toLocaleString()}</span>
                        </div>
                        {discount > 0 && <span className="discount-badge">-{discount}%</span>}
                        <p className="product-desc">{prod.description || 'No description provided.'}</p>
                        
                        {prod.specs && Object.keys(prod.specs).length > 0 && (
                          <div className="product-specs">
                            {Object.entries(prod.specs).map(([k, v]) => (
                              <span key={k}>{k}: {v}</span>
                            ))}
                          </div>
                        )}
                        
                        <div className="product-meta-row">
                          <span className="product-category">{prod.category || 'General'}</span>
                          {prod.rating > 0 && <span className="product-rating">★ {prod.rating}</span>}
                          <span className={`product-stock-badge ${prod.inStock ? 'in-stock' : 'out-of-stock'}`}>
                            {prod.inStock ? 'In Stock' : 'Out of Stock'}
                          </span>
                          <div className="product-stock">
                            <span className={`stock-status ${stockStatus}`}></span>
                            <span>Stock: {stock}</span>
                            
                            {/* Stock Adjuster Panel */}
                            <div className="stock-editor-wrap">
                              <button 
                                className="stock-editor-btn"
                                onClick={() => adjustStock(prod.id, stock, -1)}
                              >
                                -
                              </button>
                              <span className="stock-editor-input">{stock}</span>
                              <button 
                                className="stock-editor-btn"
                                onClick={() => adjustStock(prod.id, stock, 1)}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Create Product Form */}
            <section className="form-card">
              <h3 className="form-title">Create Cosmic Product</h3>
              <form onSubmit={handleProductSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Product Name</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Anti-Gravity Boots"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0"
                      className="form-input"
                      placeholder="99.99"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, price: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Initial Stock</label>
                    <input
                      type="number"
                      required
                      min="0"
                      className="form-input"
                      placeholder="10"
                      value={newProduct.stock}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, stock: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-input"
                    value={newProduct.category}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="Audio">Audio</option>
                    <option value="Gear">Gear</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Apparel">Apparel</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-input form-textarea"
                    placeholder="Nebula core magnetic propulsion..."
                    value={newProduct.description}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <button type="submit" className="submit-btn">
                  🛸 Register Product Asset
                </button>
              </form>
            </section>
          </div>
        )}

        {/* TAB CONTENT: 4. COUPON CODES & DISCOUNTS */}
        {activeTab === 'coupons' && (
          <div className="coupons-layout-grid">
            {/* Coupons & Flash Deals lists */}
            <section className="section-panel">
              <div className="section-header">
                <div className="section-title-wrap">
                  <span className="section-icon">🎟️</span>
                  <h3 className="section-title">Discount Tokens</h3>
                </div>
                <span className="badge-count">
                  {(coupons.length + flashDeals.length)} active configurations
                </span>
              </div>

              <div className="coupons-list-wrapper">
                {/* Standard coupons */}
                <div className="coupons-sub-panel">
                  <h4 className="coupons-sub-title">Standard Coupon Codes</h4>
                  {couponsLoading ? (
                    <div className="empty-state">Loading coupons...</div>
                  ) : coupons.length === 0 ? (
                    <div className="empty-state">No active coupons in database.</div>
                  ) : (
                    <div className="coupons-grid">
                      {coupons.map(coup => {
                        const isExpired = new Date(coup.expiryDate) < new Date();
                        const isStatusActive = coup.isActive && !isExpired;
                        return (
                          <div className="coupon-card" key={coup.code}>
                            <span className="coupon-code-label">{coup.code}</span>
                            <span className="coupon-discount">{coup.discountPercent}% OFF</span>
                            <span className="coupon-expiry">Expires: {new Date(coup.expiryDate).toLocaleDateString()}</span>
                            <span className={`coupon-status-pill ${isStatusActive ? 'active' : 'expired'}`}>
                              {isStatusActive ? 'Active' : 'Expired'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Flash Deal Codes */}
                <div className="coupons-sub-panel">
                  <h4 className="coupons-sub-title">Flash Deal Hotlinks</h4>
                  {flashDealsLoading ? (
                    <div className="empty-state">Loading flash deals...</div>
                  ) : flashDeals.length === 0 ? (
                    <div className="empty-state">No flash deals.</div>
                  ) : (
                    <div className="coupons-grid">
                      {flashDeals.map(deal => {
                        const isExpired = new Date(deal.expiresAt) < new Date();
                        const isStatusActive = deal.isActive && !isExpired;
                        return (
                          <div className="coupon-card" key={deal.code} style={{ borderLeft: '3px solid var(--error)' }}>
                            <span className="coupon-code-label" style={{ borderColor: 'var(--error-glow)' }}>{deal.code}</span>
                            <span className="coupon-discount" style={{ color: 'var(--error)' }}>{deal.discountPercent}% OFF</span>
                            <span className="coupon-expiry">Expires: {new Date(deal.expiresAt).toLocaleTimeString()}</span>
                            <span className={`coupon-status-pill ${isStatusActive ? 'active' : 'expired'}`} style={{ color: isStatusActive ? 'var(--error)' : 'var(--subtext)', background: isStatusActive ? 'var(--error-glow)' : 'var(--border)' }}>
                              {isStatusActive ? 'LIVE FLASH' : 'CLOSED'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Create Coupon Form */}
            <section className="form-card">
              <h3 className="form-title">Create Coupon Token</h3>
              <form onSubmit={handleCouponSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Coupon Code</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. MOONSHOT50"
                    style={{ textTransform: 'uppercase' }}
                    value={newCoupon.code}
                    onChange={(e) => setNewCoupon(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Discount Percentage (%)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    className="form-input"
                    placeholder="25"
                    value={newCoupon.discountPercent}
                    onChange={(e) => setNewCoupon(prev => ({ ...prev, discountPercent: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Expiry Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newCoupon.expiryDate}
                    onChange={(e) => setNewCoupon(prev => ({ ...prev, expiryDate: e.target.value }))}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--subtext)' }}>Defaults to 30 days if empty.</span>
                </div>

                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input
                    type="checkbox"
                    id="isActiveCheck"
                    checked={newCoupon.isActive}
                    onChange={(e) => setNewCoupon(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                  <label htmlFor="isActiveCheck" className="form-label" style={{ textTransform: 'none', cursor: 'pointer' }}>Activate coupon instantly</label>
                </div>

                <button type="submit" className="submit-btn">
                  🎫 Inject Coupon Token
                </button>
              </form>
            </section>
          </div>
        )}

      </main>

      {/* Delay Overlay Modal */}
      {isDelayModalOpen && selectedOrderForDelay && (
        <div className="delay-overlay">
          <form className="delay-modal" onSubmit={submitDelayDetails}>
            <div className="modal-header">
              <h3 className="modal-title">Trigger Delay Alert</h3>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => {
                  setIsDelayModalOpen(false);
                  setSelectedOrderForDelay(null);
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ fontSize: '0.85rem', color: 'var(--subtext)' }}>
              Configure delay warning metadata for Order <strong>{selectedOrderForDelay.id}</strong>. CareSphere AI will immediately notify the customer with these parameters.
            </div>

            <div className="form-group">
              <label className="form-label">New Estimated Delivery</label>
              <input
                type="date"
                required
                className="form-input"
                value={newDeliveryDate}
                onChange={(e) => setNewDeliveryDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Delay Reason</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g., Solar flare transit interruption"
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn cancel"
                onClick={() => {
                  setIsDelayModalOpen(false);
                  setSelectedOrderForDelay(null);
                }}
              >
                Cancel
              </button>
              <button type="submit" className="modal-btn submit">
                Update Order Delay
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

