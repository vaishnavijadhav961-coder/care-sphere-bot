import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleMessage, normalizeHistoryToEscalation, generateSummary } from '../bot/bot';
import { checkExistingFlashDeal, createFlashDealCode } from '../firebase/flashDeals';
import { db } from '../firebase/config';
import { ref, onValue } from 'firebase/database';
import { addMessageToEscalation, resolveEscalation, createEscalation } from '../firebase/escalations';
import { useAuth } from '../hooks/AuthContext';
import { removeFromCart, updateCartQuantity } from '../firebase/cart';
import { getSessions, getSession, saveSession, deleteSession, generateSessionId } from '../firebase/chatSessions';
import './ChatWidget.css';

const QUIZ_CATEGORIES = [
  { label: '📱 Electronics', value: 'electronics' },
  { label: '👟 Footwear', value: 'footwear' },
  { label: '💄 Skincare', value: 'skincare' },
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
  const [sessions, setSessions] = useState([]);
  const [showSessions, setShowSessions] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(() => sessionStorage.getItem('cs_activeSessionId') || null);
  const prevEscalatedRef = useRef(false);
  const escalationCooldownRef = useRef(false);
  const userMsgCountRef = useRef(0);
  const failureCountRef = useRef(0);
  const autoEscalatedRef = useRef(false);
  const lastChatHistoryRef = useRef(null);

  // Gemini conversation history (raw format for API)
  const historyRef = useRef([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const timeoutsRef = useRef([]);
  const saveSessionTimerRef = useRef(null);

  // -------------------------------------------------------------------------
  // Chat session initialization (load saved or show greeting)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!user?.uid) {
      const greeting = productContext
        ? `Hi! 👋 I see you're looking at **${productContext.productName}**. What would you like to know about it?`
        : "Hi there! 👋 I'm CareSphere, your personal shopping assistant. How can I help you today?";
      setMessages([{ role: 'bot', text: greeting, id: Date.now() }]);
      return;
    }

    (async () => {
      const list = await getSessions(user.uid);
      setSessions(list);

      const storedId = sessionStorage.getItem('cs_activeSessionId');
      if (storedId && list.some(s => s.id === storedId)) {
        const data = await getSession(user.uid, storedId);
        if (data && data.messages) {
          historyRef.current = data.messages;
          const msgs = data.messages
            .filter(m => !m.parts?.[0]?.text?.startsWith('[User selected quiz category:'))
            .map((m, i) => ({
            role: m.role === 'user' ? 'user' : 'bot',
            text: m.parts?.[0]?.text || '',
            id: Date.now() + i,
            isAgent: m.role === 'agent',
          }));
          setMessages(msgs);
          setActiveSessionId(storedId);
          return;
        }
      }

      const newId = generateSessionId();
      sessionStorage.setItem('cs_activeSessionId', newId);
      setActiveSessionId(newId);
      const greeting = productContext
        ? `Hi! 👋 I see you're looking at **${productContext.productName}**. What would you like to know about it?`
        : "Hi there! 👋 I'm CareSphere, your personal shopping assistant. How can I help you today?";
      historyRef.current = [{ role: 'model', parts: [{ text: greeting }] }];
      setMessages([{ role: 'bot', text: greeting, id: Date.now() }]);
    })();
  }, [user?.uid, productContext]);

  // -------------------------------------------------------------------------
  // Realtime Escalation Support Sync (Two-Way Chat)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const escalationsRef = ref(db, 'escalations');
    const unsubscribe = onValue(escalationsRef, (snapshot) => {
      const resolvedMsg = { role: 'bot', text: 'The support specialist has resolved this ticket. CareSphere AI is back to help you! 😊', id: Date.now() };

      function handleResolvedTransition() {
        prevEscalatedRef.current = false;
        setEscalated(false);
        setActiveEscalationId(null);
        setMessages((prev) => [...prev, resolvedMsg]);
        const savedHistory = lastChatHistoryRef.current;
        lastChatHistoryRef.current = null;
        if (Array.isArray(savedHistory)) {
          historyRef.current = savedHistory.map(m => ({
            role: m.sender === 'customer' ? 'user' : (m.sender === 'agent' ? 'agent' : 'model'),
            parts: [{ text: m.message || '' }]
          }));
        } else {
          historyRef.current = [];
        }
        historyRef.current.push({ role: 'model', parts: [{ text: resolvedMsg.text }] });
        userMsgCountRef.current = 0;
        failureCountRef.current = 0;
        autoEscalatedRef.current = false;
        escalationCooldownRef.current = true;
        const sessionId = sessionStorage.getItem('cs_activeSessionId');
        if (user?.uid && sessionId) {
          saveSession(user.uid, sessionId, historyRef.current).then(() => {
            getSessions(user.uid).then(setSessions);
          });
        }
      }

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

                if (m.role && m.parts) {
                  role = m.role === 'user' ? 'user' : 'bot';
                  if (Array.isArray(m.parts)) {
                    text = m.parts.map(p => p.text || '').join('\n');
                  } else {
                    text = m.parts || '';
                  }
                  if (role === 'bot') {
                    text = text.replace(/<response>([\s\S]*?)<\/response>/i, '$1')
                               .replace(/\[FLASH_DEAL\]/g, '')
                               .replace(/\[ESCALATE\]/g, '')
                               .replace(/\[REDIRECT:\s*[^\]]+\]/gi, '')
                               .replace(/\[CART_REMOVE:\s*[^\]]+\]/gi, '')
                               .trim();
                  }
                } else {
                  if (m.sender === 'customer') role = 'user';
                  else if (m.sender === 'agent') isAgent = true;
                  text = m.message || '';
                }

                return { role, text, id: m.timestamp || idx, isAgent };
              });
            setMessages(mappedMessages);
            lastChatHistoryRef.current = activeEsc.chatHistory;
          }
        } else if (prevEscalatedRef.current) {
          handleResolvedTransition();
        } else {
          setEscalated(false);
          setActiveEscalationId(null);
        }
      } else if (prevEscalatedRef.current) {
        handleResolvedTransition();
      } else {
        setEscalated(false);
        setActiveEscalationId(null);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Cleanup save session debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveSessionTimerRef.current) clearTimeout(saveSessionTimerRef.current);
    };
  }, []);

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
  }, [user?.uid]);

  // -------------------------------------------------------------------------
  // Out of Stock Notifications (Realtime Database)
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
  }, [user?.uid]);

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

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, []);

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
      // Sanitize history: convert 'agent' role to 'model' for Gemini API
      const sanitizedHistory = historyRef.current.map(m => ({
        ...m,
        role: m.role === 'agent' ? 'model' : m.role,
      }));
      const result = await handleMessage(text, sanitizedHistory, {
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

      // Persist chat session (debounced)
      if (user?.uid && activeSessionId) {
        if (saveSessionTimerRef.current) clearTimeout(saveSessionTimerRef.current);
        saveSessionTimerRef.current = setTimeout(async () => {
          await saveSession(user.uid, activeSessionId, historyRef.current);
          const updated = await getSessions(user.uid);
          setSessions(updated);
          saveSessionTimerRef.current = null;
        }, 1500);
      }

      setIsTyping(false);

      // Execute cart removals from [CART_REMOVE] tag (detected from raw reply)
      if (result.cartRemoveIds && user?.uid) {
        for (const prodId of result.cartRemoveIds) {
          await removeFromCart(user.uid, prodId);
        }
      }

      // Execute cart quantity updates from [CART_UPDATE] tag
      if (result.cartUpdate && user?.uid) {
        await updateCartQuantity(user.uid, result.cartUpdate.productId, result.cartUpdate.quantity);
      }

      // Track [FAILURE] tag for auto-escalation
      if (result.failureDetected) {
        failureCountRef.current += 1;
      }

      const botMsg = { role: 'bot', text: result.reply, id: Date.now() + 1 };
      setMessages((prev) => [...prev, botMsg]);

      if (!isOpen) setHasUnread(true);

      // Handle Auto-Navigation / Website Control
      if (result.redirectPath) {
        const t = setTimeout(() => navigate(result.redirectPath), 1000);
        timeoutsRef.current.push(t);
      }

      // Handle Flash Deal
      if (result.showFlashDeal && !quizAnswered) {
        // Check if customer already has an active deal
        const existing = user?.uid ? await checkExistingFlashDeal(user.uid) : null;
        if (!existing) {
          setShowQuiz(true);
        }
      }

      // Track user message count for auto-escalation
      userMsgCountRef.current += 1;

      // Clear escalation cooldown after first post-resolution exchange
      if (escalationCooldownRef.current) {
        escalationCooldownRef.current = false;
      }

      // Handle Escalation — bot-triggered or auto-detected (failures or message count)
      const botRequestedEsc = result.escalated && !escalationCooldownRef.current;
      const autoEscalation = !escalated && !autoEscalatedRef.current && userMsgCountRef.current >= 4 && failureCountRef.current >= 3;
      const shouldEscalate = botRequestedEsc || autoEscalation;
      let escalateReason = '';
      if (result.escalated) {
        escalateReason = 'Bot requested human handoff';
      } else if (failureCountRef.current >= 3) {
        escalateReason = `Bot failed to answer ${failureCountRef.current} queries — handing off to human agent`;
        // Insert a bot message explaining the handoff before creating the escalation
        setMessages((prev) => [
          ...prev,
          { role: 'bot', text: "I'm having trouble finding the information you need. Let me connect you with a human agent who can help.", id: Date.now() + 2 },
        ]);
      } else {
        escalateReason = `Customer sent ${userMsgCountRef.current} messages without resolution`;
      }

      if (shouldEscalate) {
        setShowQuiz(false);
        autoEscalatedRef.current = true;

        try {
          const chatHistory = normalizeHistoryToEscalation(historyRef.current);
          const summary = await generateSummary(historyRef.current);

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
  }, [inputText, isTyping, escalated, activeSessionId, activeEscalationId, mode, productContext, quizAnswered, isOpen, navigate]);

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
  // Chat session management
  // -------------------------------------------------------------------------
  const handleNewSession = async () => {
    if (!user?.uid || escalated || isTyping) return;
    const newId = generateSessionId();
    sessionStorage.setItem('cs_activeSessionId', newId);
    setActiveSessionId(newId);
    setShowSessions(false);
    setQuizAnswered(false);
    setShowQuiz(false);
    userMsgCountRef.current = 0;
    failureCountRef.current = 0;
    autoEscalatedRef.current = false;
    const greeting = "Hi there! 👋 I'm CareSphere, your personal shopping assistant. How can I help you today?";
    historyRef.current = [{ role: 'model', parts: [{ text: greeting }] }];
    setMessages([{ role: 'bot', text: greeting, id: Date.now() }]);
    const updated = await getSessions(user.uid);
    setSessions(updated);
  };

  const handleLoadSession = async (sessionId) => {
    if (!user?.uid || !sessionId || isTyping) return;
    const data = await getSession(user.uid, sessionId);
    if (!data || !data.messages) return;
    sessionStorage.setItem('cs_activeSessionId', sessionId);
    setActiveSessionId(sessionId);
    setShowSessions(false);
    setQuizAnswered(false);
    setShowQuiz(false);
    historyRef.current = data.messages;
    let msgs = data.messages
      .filter(m => !m.parts?.[0]?.text?.startsWith('[User selected quiz category:'))
      .map((m, i) => ({
      role: m.role === 'user' ? 'user' : 'bot',
      text: m.parts?.[0]?.text || '',
      id: Date.now() + i,
      isAgent: m.role === 'agent',
    }));
    // Prepend bot greeting if first stored message is from user (old sessions without greeting)
    if (msgs.length > 0 && msgs[0].role === 'user') {
      msgs = [{ role: 'bot', text: "Hi there! 👋 I'm CareSphere, your personal shopping assistant. How can I help you today?", id: Date.now() - 1, isAgent: false }, ...msgs];
    }
    setMessages(msgs);
    userMsgCountRef.current = 0;
    failureCountRef.current = 0;
  };

  const handleDeleteSession = async (sessionId) => {
    if (!user?.uid || !sessionId) return;
    await deleteSession(user.uid, sessionId);
    const updated = await getSessions(user.uid);
    setSessions(updated);
    if (sessionId === activeSessionId) {
      handleNewSession();
    }
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
      await createFlashDealCode(user?.uid || 'anonymous', code, 15, category);
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

    if (user?.uid && activeSessionId) {
      saveSession(user.uid, activeSessionId, historyRef.current);
    }

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
            </div>
          </div>
          <div className="cw-header__controls">
            {user?.uid && !escalated && (
              <button
                className={`cw-mode-btn ${showSessions ? 'cw-mode-btn--active' : ''}`}
                onClick={async () => {
                  const list = await getSessions(user.uid);
                  setSessions(list);
                  setShowSessions(v => !v);
                }}
                title="Chat history"
                id="chat-history-btn"
              >
                📋
              </button>
            )}
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

        {/* Sessions panel overlay */}
        {showSessions && (
          <div className="cw-sessions">
            <div className="cw-sessions__header">
              <span>Chat History</span>
              <button className="cw-sessions__new-btn" onClick={handleNewSession} id="chat-new-session-btn">
                + New Chat
              </button>
            </div>
            <div className="cw-sessions__list">
              {sessions.length === 0 && (
                <div className="cw-sessions__empty">No previous chats</div>
              )}
              {sessions.map(s => (
                <div key={s.id} className={`cw-sessions__item ${s.id === activeSessionId ? 'cw-sessions__item--active' : ''}`}>
                  <button
                    className="cw-sessions__item-btn"
                    onClick={() => handleLoadSession(s.id)}
                    title={s.preview}
                  >
                    <span className="cw-sessions__item-preview">{s.preview || 'Empty chat'}</span>
                    <span className="cw-sessions__item-time">{s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : ''}</span>
                  </button>
                  <button
                    className="cw-sessions__del-btn"
                    onClick={() => handleDeleteSession(s.id)}
                    title="Delete"
                    id={`del-session-${s.id}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
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
