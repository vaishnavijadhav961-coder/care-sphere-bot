import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleMessage, normalizeHistoryToEscalation } from '../bot/bot';
import { checkExistingFlashDeal, createFlashDealCode } from '../firebase/flashDeals';
import { db } from '../firebase/config';
import { ref, onValue } from 'firebase/database';
import { addMessageToEscalation, resolveEscalation, createEscalation } from '../firebase/escalations';
import { useAuth } from '../hooks/AuthContext';
import { removeFromCart } from '../firebase/cart';
import './ChatWidget.css';

const QUIZ_CATEGORIES = [
  { label: '📱 Electronics', value: 'electronics' },
  { label: '👟 Footwear', value: 'footwear' },
  { label: '💄 Skincare', value: 'skincare' },
  { label: '🏠 Home', value: 'home' },
];

function generateCode() {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const suffix = Date.now().toString(36).slice(-3).toUpperCase();
  return 'FLASH' + rand + suffix;
}

export default function ChatWidget({ initialProductContext = null }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [mode, setMode] = useState('human'); // "human" | "direct"
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [activeEscalationId, setActiveEscalationId] = useState(null);
  const [productContext, setProductContext] = useState(initialProductContext);
  const [hasUnread, setHasUnread] = useState(false);
  const prevEscalatedRef = useRef(false);

  // Gemini conversation history (raw format for API)
  const historyRef = useRef([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // -------------------------------------------------------------------------
  // Initial greeting
  // -------------------------------------------------------------------------
  useEffect(() => {
    const greeting = productContext
      ? `Hi! 👋 I see you're looking at **${productContext.productName}**. What would you like to know about it?`
      : "Hi there! 👋 I'm CareSphere, your personal shopping assistant. How can I help you today?";

    setMessages([{ role: 'bot', text: greeting, id: Date.now() }]);
  }, []); // eslint-disable-line

  // -------------------------------------------------------------------------
  // Realtime Escalation Support Sync (Two-Way Chat)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const escalationsRef = ref(db, 'escalations');
    const unsubscribe = onValue(escalationsRef, (snapshot) => {
      if (snapshot.exists()) {
        let activeEsc = null;
        snapshot.forEach((childSnap) => {
          const esc = childSnap.val();
          if (esc && typeof esc === 'object' && esc.customerId === (user?.uid || null) && esc.status === 'open') {
            activeEsc = { id: childSnap.key, ...esc };
          }
        });

        if (activeEsc) {
          setEscalated(true);
          setActiveEscalationId(activeEsc.id);
          prevEscalatedRef.current = true;

          // Sync messages from escalation chatHistory!
          if (activeEsc.chatHistory) {
            const history = Array.isArray(activeEsc.chatHistory)
              ? activeEsc.chatHistory
              : Object.values(activeEsc.chatHistory);

            const mappedMessages = history
              .filter(m => m && typeof m === 'object')
              .map((m, idx) => {
                let role = 'bot';
                let isAgent = false;
                let text = '';

                // Raw Gemini history format fallback: { role, parts: [{ text }] }
                if (m.role && m.parts) {
                  role = m.role === 'user' ? 'user' : 'bot';
                  if (Array.isArray(m.parts)) {
                    text = m.parts.map(p => p.text || '').join('\n');
                  } else {
                    text = m.parts || '';
                  }
                  
                  // Clean tags from bot replies in the client chat feed
                  if (role === 'bot') {
                    text = text.replace(/<response>([\s\S]*?)<\/response>/i, '$1')
                               .replace(/\[FLASH_DEAL\]/g, '')
                               .replace(/\[ESCALATE\]/g, '')
                               .replace(/\[REDIRECT:\s*[^\]]+\]/gi, '')
                               .trim();
                  }
                } 
                // Standardized escalations history format: { sender, message }
                else {
                  if (m.sender === 'customer') role = 'user';
                  else if (m.sender === 'agent') {
                    role = 'bot'; // Map to bot role for layout, but flag as agent
                    isAgent = true;
                  }
                  text = m.message || '';
                }

                return {
                  role,
                  text,
                  id: m.timestamp || idx,
                  isAgent
                };
              });
            setMessages(mappedMessages);
          }
        } else {
          // If was previously escalated and is now resolved, show reset message
          if (prevEscalatedRef.current) {
            prevEscalatedRef.current = false;
            setEscalated(false);
            setActiveEscalationId(null);
            setMessages((prev) => [
              ...prev,
              {
                role: 'bot',
                text: 'The support specialist has resolved this ticket. CareSphere AI is back to help you! 😊',
                id: Date.now()
              }
            ]);
            // Clear raw gemini history so it starts fresh after human handoff
            historyRef.current = [];
          } else {
            setEscalated(false);
            setActiveEscalationId(null);
          }
        }
      } else {
        if (prevEscalatedRef.current) {
          prevEscalatedRef.current = false;
          setEscalated(false);
          setActiveEscalationId(null);
          setMessages((prev) => [
            ...prev,
            {
              role: 'bot',
              text: 'The support specialist has resolved this ticket. CareSphere AI is back to help you! 😊',
              id: Date.now()
            }
          ]);
          historyRef.current = [];
        } else {
          setEscalated(false);
          setActiveEscalationId(null);
        }
      }
    });
    return () => unsubscribe();
  }, [user]);

  // -------------------------------------------------------------------------
  // Proactive Delay Notifications (Realtime Database)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const ordersRef = ref(db, 'orders');
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      if (snapshot.exists()) {
        snapshot.forEach((childSnap) => {
          const order = childSnap.val();
          const orderId = childSnap.key;
          if (order && typeof order === 'object' && order.customerId === (user?.uid || null) && order.status === 'Delayed') {
            // Check if notified in sessionStorage
            const notifiedKey = `notified_delay_${orderId}`;
            const isNotified = sessionStorage.getItem(notifiedKey);
            if (!isNotified) {
              // Mark as notified in sessionStorage
              sessionStorage.setItem(notifiedKey, 'true');

              // Trigger alert toast/message
              const proactiveMsg = `⚠️ **Proactive Shipping Update**: Your order for **${order.productName || 'unknown product'}** (ID: ${orderId}) has been delayed due to *${order.delayReason || 'unforeseen logistical bottlenecks'}*. Estimated delivery is now **${order.estimatedDelivery ? new Date(order.estimatedDelivery).toLocaleDateString() : 'TBD'}**. \n[Track here](/track/${orderId})`;
              
              setMessages((prev) => [
                ...prev,
                {
                  role: 'bot',
                  text: proactiveMsg,
                  id: Date.now()
                }
              ]);
              setHasUnread(true);
            }
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // -------------------------------------------------------------------------
  // Feature 4 — Out of Stock Notifications (Realtime Database)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const productsRef = ref(db, 'products');
    const unsubscribe = onValue(productsRef, (snapshot) => {
      if (snapshot.exists()) {
        snapshot.forEach((childSnap) => {
          const product = childSnap.val();
          const productId = childSnap.key;
          if (product && typeof product === 'object' && product.notifyList && Array.isArray(product.notifyList) && product.notifyList.includes(user?.uid || null)) {
            // Only notify if previously out of stock and now in stock
            const notifiedKey = `notified_instock_${productId}`;
            const wasNotified = sessionStorage.getItem(notifiedKey);
            if (product.inStock === true && !wasNotified) {
              sessionStorage.setItem(notifiedKey, 'true');
              const inStockMsg = `📦 **Good news!** [${product.name}](/products/${productId}) is back in stock! 🎉\nYou asked us to let you know — and it's available now.`;
              setMessages((prev) => [
                ...prev,
                {
                  role: 'bot',
                  text: inStockMsg,
                  id: Date.now()
                }
              ]);
              setHasUnread(true);
            }
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // -------------------------------------------------------------------------
  // Auto-scroll
  // -------------------------------------------------------------------------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, showQuiz]);

  // -------------------------------------------------------------------------
  // Focus input when opened
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setHasUnread(false);
    }
  }, [isOpen]);

  // -------------------------------------------------------------------------
  // Expose global API for P2's "Ask CareSphere" buttons
  // -------------------------------------------------------------------------
  useEffect(() => {
    window.openChatWithContext = (productData) => {
      setProductContext(productData);
      setIsOpen(true);
      if (productData) {
        const ctxMsg = `Hi! 👋 I see you're looking at **${productData.productName}**. What would you like to know about it?`;
        setMessages([{ role: 'bot', text: ctxMsg, id: Date.now() }]);
        historyRef.current = [];
      }
    };
    return () => { delete window.openChatWithContext; };
  }, []);

  // -------------------------------------------------------------------------
  // Send message
  // -------------------------------------------------------------------------
  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isTyping) return;

    setInputText('');

    // If escalated to human support representative, push directly to RTDB ticket
    if (escalated) {
      if (!activeEscalationId) return;
      try {
        await addMessageToEscalation(activeEscalationId, 'customer', text);
      } catch (err) {
        console.error('Failed to send message to active support ticket:', err);
      }
      return;
    }

    // Add user message to UI
    const userMsg = { role: 'user', text, id: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const customerId = user?.uid || null;
      const result = await handleMessage(text, historyRef.current, {
        mode,
        customerId,
        productContext,
      });

      // Update Gemini history
      historyRef.current = [
        ...historyRef.current,
        { role: 'user', parts: [{ text }] },
        { role: 'model', parts: [{ text: result.reply }] },
      ];

      setIsTyping(false);

      // Add bot reply
      let replyText = result.reply;

      // Parse CART_REMOVE tags
      const cartRemoveMatch = replyText.match(/\[CART_REMOVE:\s*([^\]]+)\]/);
      if (cartRemoveMatch && user?.uid) {
        const ids = cartRemoveMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
        for (const prodId of ids) {
          await removeFromCart(user.uid, prodId);
        }
        replyText = replyText.replace(/\[CART_REMOVE:\s*[^\]]+\]\s*/g, '');
      }

      const botMsg = { role: 'bot', text: replyText, id: Date.now() + 1 };
      setMessages((prev) => [...prev, botMsg]);

      if (!isOpen) setHasUnread(true);

      // Handle Auto-Navigation / Website Control
      if (result.redirectPath) {
        setTimeout(() => {
          navigate(result.redirectPath);
        }, 1000);
      }

      // Handle Flash Deal
      if (result.showFlashDeal && !quizAnswered) {
        // Check if customer already has an active deal
        const existing = user?.uid ? await checkExistingFlashDeal(user.uid) : null;
        if (!existing) {
          setShowQuiz(true);
        }
      }

      // Handle Escalation — immediately transition to human-agent mode
      if (result.escalated) {
        setShowQuiz(false);
        try {
          const chatHistory = normalizeHistoryToEscalation(historyRef.current);
          const lastCustomerMsg = chatHistory.filter(m => m.sender === 'customer').pop();
          const summary = lastCustomerMsg
            ? `Customer: ${lastCustomerMsg.message.slice(0, 100)}`
            : 'Customer requested human agent';
          const escId = await createEscalation({
            customerId: user?.uid || 'anonymous',
            chatHistory,
            summary,
            status: 'open',
            createdAt: new Date().toISOString(),
          });
          setEscalated(true);
          setActiveEscalationId(escId);
        } catch (err) {
          console.error('Failed to create escalation from frontend:', err);
        }
      }
    } catch (err) {
      console.error('sendMessage error:', err);
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: "Sorry, something went wrong. Please try again.",
          id: Date.now() + 2,
        },
      ]);
    }
  }, [inputText, isTyping, escalated, activeEscalationId, mode, productContext, quizAnswered, isOpen, navigate]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // -------------------------------------------------------------------------
  // Mode switch
  // -------------------------------------------------------------------------
  const switchMode = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
  };

  // -------------------------------------------------------------------------
  // Escalation Handoff Resolution (Return to AI Assistant)
  // -------------------------------------------------------------------------
  const handleReturnToAI = async () => {
    if (!activeEscalationId) return;
    try {
      await resolveEscalation(activeEscalationId);
    } catch (err) {
      console.error('Failed to resolve escalation:', err);
    }
  };

  // -------------------------------------------------------------------------
  // Flash Deal quiz answer
  // -------------------------------------------------------------------------
  const handleQuizAnswer = async (category) => {
    setShowQuiz(false);
    setQuizAnswered(true);

    const code = generateCode();
    try {
      await createFlashDealCode(user?.uid || 'anonymous', code, 15);
    } catch (err) {
      console.error('Failed to save flash deal code:', err);
    }

    const dealMsg =
      mode === 'human'
        ? `🎉 You got it! Here's your exclusive code: **${code}**\n15% off on ${category}. Valid for 2 hours — use it before it expires!`
        : `Code: **${code}** — 15% off on ${category}. Expires in 2 hours.`;

    historyRef.current = [
      ...historyRef.current,
      { role: 'user', parts: [{ text: `[User selected quiz category: ${category}]` }] },
      { role: 'model', parts: [{ text: dealMsg }] },
    ];

    setMessages((prev) => [
      ...prev,
      { role: 'bot', text: dealMsg, id: Date.now(), isFlashDeal: true },
    ]);
  };

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
   const renderMessageText = (text) => {
    if (!text || typeof text !== 'string') return '';
    // 0. Split by markdown links [text](url) first
    const linkParts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
    return linkParts.map((part, i) => {
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const linkText = linkMatch[1];
        const linkUrl = linkMatch[2];
        const renderedText = linkText.split(/(\*\*[^*]+\*\*)/g).map((t, ti) =>
          t.startsWith('**') && t.endsWith('**')
            ? <strong key={ti}>{t.slice(2, -2)}</strong>
            : t
        );
        return (
          <button key={i} className="cw-inline-link-btn" onClick={() => navigate(linkUrl)} title={linkUrl}>
            {renderedText}
          </button>
        );
      }
      // 1. Split by bold markdown (**bold**)
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bp, j) => {
        if (bp.startsWith('**') && bp.endsWith('**')) {
          return <strong key={`${i}-${j}`}>{bp.slice(2, -2)}</strong>;
        }
        // 2. Parse paths starting with / (e.g. /products/abc, /track/123, /coupons, /compare?...)
        const subparts = bp.split(/(\/(?:products|track|compare|coupons)(?:\/[\w_-]+)?(?:\?\S+)?)/g);
        return subparts.map((subpart, k) => {
          if (subpart.startsWith('/')) {
            return (
              <button key={`${i}-${j}-${k}`} className="cw-inline-link-btn" onClick={() => navigate(subpart)} title={subpart}>
                {subpart}
              </button>
            );
          }
          return subpart.split('\n').map((line, l, arr) => (
            <React.Fragment key={`${i}-${j}-${k}-${l}`}>
              {line}
              {l < arr.length - 1 && <br />}
            </React.Fragment>
          ));
        });
      });
    });
  };

  // -------------------------------------------------------------------------
  // JSX
  // -------------------------------------------------------------------------
  return (
    <>
      {/* ── Floating bubble ─────────────────────────────────────────── */}
      <button
        className={`cw-bubble ${isOpen ? 'cw-bubble--open' : ''}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Open CareSphere chat"
        id="caresphere-chat-bubble"
      >
        {isOpen ? (
          <span className="cw-bubble__icon">✕</span>
        ) : (
          <>
            <span className="cw-bubble__icon">💬</span>
            {hasUnread && <span className="cw-bubble__badge" />}
          </>
        )}
      </button>

      {/* ── Chat panel ──────────────────────────────────────────────── */}
      <div className={`cw-panel cw-panel--${mode} ${isOpen ? 'cw-panel--open' : ''}`} role="dialog" aria-label="CareSphere Chat">

        {/* Header */}
        <div className="cw-header">
          <div className="cw-header__info">
            <span className="cw-header__avatar">🤖</span>
            <div>
              <div className="cw-header__name">CareSphere</div>
              <div className="cw-header__status">
                {escalated ? '🟡 Human agent connected' : '🟢 Online'}
              </div>
            </div>
          </div>
          <div className="cw-header__controls">
            <div className="cw-mode-toggle" role="group" aria-label="Reply style">
              <button
                className={`cw-mode-btn ${mode === 'human' ? 'cw-mode-btn--active' : ''}`}
                onClick={() => switchMode('human')}
                title="Human Mode — warm and friendly"
                id="chat-mode-human"
              >
                😊
              </button>
              <button
                className={`cw-mode-btn ${mode === 'direct' ? 'cw-mode-btn--active' : ''}`}
                onClick={() => switchMode('direct')}
                title="Direct Mode — short and factual"
                id="chat-mode-direct"
              >
                ⚡
              </button>
            </div>
            <button
              className="cw-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              id="chat-close-btn"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Escalation banner (Pinned) */}
        {escalated && (
          <div className="cw-escalation-banner">
            <span className="cw-escalation-banner__icon">👤</span>
            <div className="cw-escalation-banner__content">
              <span className="cw-escalation-banner__text">
                Connected to a human agent. They've been briefed.
              </span>
              <button 
                className="cw-escalation-banner__btn" 
                onClick={handleReturnToAI}
                id="chat-return-ai-btn"
              >
                Return to AI
              </button>
            </div>
          </div>
        )}

        {/* Message list */}
        <div className="cw-messages" role="log" aria-live="polite">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`cw-msg cw-msg--${msg.role} ${msg.isFlashDeal ? 'cw-msg--flash' : ''} ${msg.isAgent ? 'cw-msg--agent' : ''}`}
            >
              {msg.role === 'bot' && (
                <span className="cw-msg__avatar">{msg.isAgent ? '👤' : '🤖'}</span>
              )}
              <div className="cw-msg__bubble">
                {renderMessageText(msg.text)}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="cw-msg cw-msg--bot">
              <span className="cw-msg__avatar">🤖</span>
              <div className="cw-msg__bubble cw-typing">
                <span /><span /><span />
              </div>
            </div>
          )}

          {/* Flash Deal Quiz */}
          {showQuiz && (
            <div className="cw-quiz">
              <p className="cw-quiz__title">
                🎁 Want an extra 15% off? Answer one quick question!
              </p>
              <div className="cw-quiz__options">
                {QUIZ_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    className="cw-quiz__btn"
                    onClick={() => handleQuizAnswer(cat.value)}
                    id={`quiz-${cat.value}`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          )}



          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="cw-input-area">
          <input
            ref={inputRef}
            className="cw-input"
            type="text"
            placeholder={escalated ? 'Chatting with human agent…' : 'Type your message…'}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
            id="chat-input"
            aria-label="Chat message input"
            maxLength={500}
          />
          <button
            className="cw-send-btn"
            onClick={sendMessage}
            disabled={isTyping || !inputText.trim()}
            id="chat-send-btn"
            aria-label="Send message"
          >
            ➤
          </button>
        </div>
      </div>
    </>
  );
}
