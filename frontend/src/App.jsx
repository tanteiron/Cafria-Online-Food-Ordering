import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import logo from "./assets/logo.png";



const API = "http://localhost:3001/api";
const money = (amount) => `₱${Number(amount || 0).toFixed(2)}`;


export default function App() {
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [orderType, setOrderType] = useState("Manual");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [activeTab, setActiveTab] = useState("Order Food");
  const [orders, setOrders] = useState([]);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [receiptIsHistory, setReceiptIsHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyPayment, setHistoryPayment] = useState("All");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [mealQty, setMealQty] = useState(1);
  const [mealAddons, setMealAddons] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const addons = [
    { id: "rice", name: "Extra rice", price: 15, emoji: "🍚" },
    { id: "drink", name: "Soft drink", price: 25, emoji: "🥤" },
    { id: "gravy", name: "Extra gravy", price: 10, emoji: "🥣" },
    { id: "egg", name: "Fried egg", price: 18, emoji: "🍳" }
  ];

  async function loadMenu() {
    try {
      const response = await fetch(`${API}/menu`);
      if (!response.ok) throw new Error("Could not load menu");
      setMenu(await response.json());
    } catch {
      setNotice("Cannot connect to the server. Start server.js on port 3001, then refresh.");
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders() {
    try {
      const response = await fetch(`${API}/orders`);
      if (response.ok) setOrders(await response.json());
    } catch {
      // Keep the page usable if the queue is temporarily unavailable.
    }
  }

  useEffect(() => {
    loadMenu();
    loadOrders();
    const timer = window.setInterval(loadOrders, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const categories = ["All", ...new Set(menu.map((item) => item.category))];
  const visibleMenu = menu.filter((item) =>
    (category === "All" || item.category === category) &&
    `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase())
  );

  const cartItems = useMemo(() => menu
    .filter((item) => cart[item.id]?.quantity > 0)
    .map((item) => {
      const entry = cart[item.id];
      const chosenAddons = (entry.addons || []).map((id) => addons.find((a) => a.id === id)).filter(Boolean);
      const unitPrice = item.price + chosenAddons.reduce((sum, a) => sum + a.price, 0);
      return { ...item, quantity: entry.quantity, addons: chosenAddons, unitPrice };
    }), [menu, cart]);
  const total = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  function openMeal(item) {
    setSelectedMeal(item);
    setMealQty(cart[item.id]?.quantity || 1);
    setMealAddons(cart[item.id]?.addons || []);
  }
  function saveMeal() {
    if (!selectedMeal) return;
    setCart((current) => ({ ...current, [selectedMeal.id]: { quantity: mealQty, addons: mealAddons } }));
    setSelectedMeal(null);
  }
  function removeMeal(id) {
    setCart((current) => { const next = { ...current }; delete next[id]; return next; });
  }

  async function placeOrder() {
    if (!cartItems.length) {
      setNotice("Please add food to your order first.");
      return;
    }
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch(`${API}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim() || "Guest",
          orderType,
          paymentMethod,
          items: cartItems.map(({ id, quantity, addons: chosen }) => ({ id, quantity, addons: chosen.map((a) => a.id) }))
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not place order.");
      setReceiptIsHistory(false);
      setReceiptOrder(data);
      setCart({});
      setCustomerName("");
      await loadOrders();
      setNotice(`Order #${data.number} placed successfully.`);
    } catch (error) {
      setNotice(error.message || "Could not place your order. Check that the server is running.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(orderId, status) {
    try {
      const response = await fetch(`${API}/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update order.");
      setOrders((current) => current.map((order) => order.id === orderId ? data : order));
    } catch (error) {
      setNotice(error.message);
    }
  }

  function openReceipt(order) {
    setReceiptIsHistory(true);
    setReceiptOrder(order);
  }

  const receiptHistory = useMemo(() => [...orders]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .filter((order) =>
      (historyPayment === "All" || order.paymentMethod === historyPayment) &&
      `${order.number} ${order.customerName}`.toLowerCase().includes(historySearch.trim().toLowerCase().replace(/^#/, ""))
    ), [orders, historySearch, historyPayment]);
  const historySales = receiptHistory.reduce((sum, order) => sum + Number(order.total || 0), 0);

  const queueColumns = [
    { title: "Confirmed", hint: "New orders", color: "confirmed" },
    { title: "Preparing", hint: "In the kitchen", color: "preparing" },
    { title: "Ready", hint: "Ready to serve", color: "ready" },
    { title: "Completed", hint: "Handed to customer", color: "completed" }
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
       <a
  className="brand"
  href="#"
  onClick={(e) => {
    e.preventDefault();
    setActiveTab("Order Food");
  }}
>
  <span className="brand-mark">
    <img src={logo} alt="Cafria logo" />
  </span>

  <span className="brand-text">
    <strong>
      Cafria<span className="brand-dot">.</span>
    </strong>
    <small>ONLINE FOOD ORDERING</small>
  </span>
</a>
        <nav className="main-nav">
          <button className={activeTab === "Order Food" ? "nav-link active" : "nav-link"} onClick={() => setActiveTab("Order Food")}>Order Food</button>
          <button className={activeTab === "Order Queue" ? "nav-link active" : "nav-link"} onClick={() => { setActiveTab("Order Queue"); loadOrders(); }}>Order Queue <span className="nav-count">{orders.filter((o) => o.status !== "Completed").length}</span></button>
          <button className={activeTab === "Receipts" ? "nav-link active" : "nav-link"} onClick={() => { setActiveTab("Receipts"); loadOrders(); }}>Receipts <span className="nav-count">{orders.length}</span></button>
        </nav>
        <button className="queue-shortcut cart-shortcut" onClick={() => setShowCart(true)}>🛒 Your order <span>{itemCount}</span></button>
      </header>

      <main>
        {activeTab === "Order Food" ? (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow"><span className="eyebrow-dot" /> Across VGH Gym, San Jose, Baggao</span>
                <h1>Cafria.<br /><span>The Coffee Bar.</span></h1>
                <p>Cafria is your favorite cozy cafe in Baggao, Cagayan. Serving quality coffee, refreshing drinks, comfort food and snacks. Perfect for coffee dates, family bonding, catch-ups and hang outs..</p>
                <button className="hero-button" onClick={() => document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" })}>Explore menu <span>↓</span></button>
              </div>
             <div className="hero-art">
              </div>
            </section>

            <section className="menu-section" id="menu">
              <div className="section-heading">
                <div><span className="eyebrow">YOUR NEXT FAVORITE</span><h2>Explore the menu<span className="brand-dot">.</span></h2><p>Something delicious for every craving.</p></div>
                <div className="search-box"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search food..." aria-label="Search food" /></div>
              </div>
              <div className="category-row">
                {categories.map((item) => <button key={item} className={category === item ? "category active" : "category"} onClick={() => setCategory(item)}>{item}</button>)}
              </div>
              {loading ? <div className="empty-state">Loading today's menu…</div> : (
                <div className="food-grid">
                  {visibleMenu.map((item) => (
                    <article className="food-card" key={item.id}>
                     <div className={`food-visual food-${item.id}`}>
  {item.popular && (
    <span className="popular-tag">★ BESTSELLER</span>
  )}

  {item.image && (
    <img
      src={item.image}
      alt={item.name}
      className="food-image"
    />
  )}
</div>

                      <div className="food-details">
                        <div className="food-title-row"><h3>{item.name}</h3><strong>{money(item.price)}</strong></div>
                        <p>{item.description}</p>
                        <div className="food-card-bottom">
                          <span className="food-category">{item.category}</span>
                          <button className="add-button" onClick={() => openMeal(item)} aria-label={`Customize ${item.name}`}>{cart[item.id]?.quantity ? "✎ Edit" : "＋ Customize"}</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {!loading && visibleMenu.length === 0 && <div className="empty-state">No food found. Try another search.</div>}
            </section>


          </>
        ) : activeTab === "Order Queue" ? (
          <section className="queue-page">
            <div className="queue-heading"><div><span className="eyebrow">KITCHEN DISPLAY SYSTEM</span><h1>Order queue<span className="brand-dot">.</span></h1><p>Follow each order from confirmation to completion. Updates refresh automatically.</p></div><button className="refresh-button" onClick={loadOrders}>↻ Refresh</button></div>
            <div className="queue-stats"><div><small>ACTIVE ORDERS</small><strong>{orders.filter((o) => o.status !== "Completed").length}</strong></div><div><small>PREPARING</small><strong>{orders.filter((o) => o.status === "Preparing").length}</strong></div><div><small>READY TO SERVE</small><strong>{orders.filter((o) => o.status === "Ready").length}</strong></div><div><small>COMPLETED</small><strong>{orders.filter((o) => o.status === "Completed").length}</strong></div></div>
            <div className="queue-board">
              {queueColumns.map((column) => {
                const columnOrders = orders.filter((order) => order.status === column.title);
                return <div className="queue-column" key={column.title}>
                  <div className={`column-heading ${column.color}`}><span><b>{column.title}</b><small>{column.hint}</small></span><span className="column-count">{columnOrders.length}</span></div>
                  <div className="column-orders">
                    {columnOrders.map((order) => <article className="order-ticket" key={order.id}>
                      <div className="ticket-top"><span className="ticket-number">#{order.number}</span><span className={`order-type ${order.orderType === "QR Code" ? "qr-type" : ""}`}>{order.orderType}</span></div>
                      <div className="ticket-customer">{order.customerName}</div><div className="ticket-time">{new Date(order.createdAt).toLocaleString()}</div>
                      <div className="ticket-items">{order.items.map((item) => <div className="ticket-item" key={item.id}><span>{item.emoji} {item.name}</span><b>×{item.quantity}</b></div>)}</div>
                      <div className="ticket-total"><span>{order.paymentMethod} · {order.paymentStatus}</span><b>{money(order.total)}</b></div>
                      <div className="ticket-actions">
                        {order.status === "Confirmed" && <button className="status-button start" onClick={() => updateStatus(order.id, "Preparing")}>Start preparing</button>}
                        {order.status === "Preparing" && <button className="status-button ready" onClick={() => updateStatus(order.id, "Ready")}>Mark ready</button>}
                        {order.status === "Ready" && <button className="status-button complete" onClick={() => updateStatus(order.id, "Completed")}>Complete order</button>}
                        {order.status === "Completed" && <span className="completed-label">✓ Completed</span>}
                      </div>
                    </article>)}
                    {columnOrders.length === 0 && <div className="column-empty">No orders here yet.</div>}
                  </div>
                </div>;
              })}
            </div>
          </section>
        ) : (
          <section className="queue-page history-page">
            <div className="queue-heading"><div><span className="eyebrow">ORDER RECEIPTS</span><h1>Receipt history<span className="brand-dot">.</span></h1><p>Every order placed in the system, newest first. Open any receipt to view the full details.</p></div><button className="refresh-button" onClick={loadOrders}>↻ Refresh</button></div>
            <div className="queue-stats"><div><small>RECEIPTS SHOWN</small><strong>{receiptHistory.length}</strong></div><div><small>TOTAL SALES</small><strong>{money(historySales)}</strong></div><div><small>CASH ORDERS</small><strong>{receiptHistory.filter((o) => o.paymentMethod === "Cash").length}</strong></div><div><small>GCASH ORDERS</small><strong>{receiptHistory.filter((o) => o.paymentMethod === "GCash").length}</strong></div></div>
            <div className="history-toolbar">
              <div className="search-box"><span>⌕</span><input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Search order # or customer..." aria-label="Search receipts" /></div>
              <div className="category-row history-filters">{["All", "Cash", "GCash"].map((method) => <button key={method} className={historyPayment === method ? "category active" : "category"} onClick={() => setHistoryPayment(method)}>{method}</button>)}</div>
            </div>
            <div className="history-list">
              {receiptHistory.map((order) => <article className="history-row" key={order.id}>
                <div className="history-main">
                  <span className="ticket-number">#{order.number}</span>
                  <div className="history-meta"><b>{order.customerName}</b><small>{new Date(order.createdAt).toLocaleString()}</small></div>
                </div>
                <div className="history-items">{order.items.map((item) => `${item.emoji} ${item.name} ×${item.quantity}`).join(" · ")}</div>
                <div className="history-pay"><span>{order.paymentMethod} · {order.paymentStatus}</span><span className={`order-type ${order.orderType === "QR Code" ? "qr-type" : ""}`}>{order.orderType}</span></div>
                <div className="history-total"><b>{money(order.total)}</b><span className="status-pill">{order.status}</span></div>
                <button className="secondary-button history-view" onClick={() => openReceipt(order)}>View receipt</button>
              </article>)}
              {receiptHistory.length === 0 && <div className="empty-state">{orders.length ? "No receipts match your search." : "No receipts yet. Placed orders will appear here."}</div>}
            </div>
          </section>
        )}
      </main>

      <footer className="footer"><a className="footer-brand" href="#" onClick={(e) => { e.preventDefault(); setActiveTab("Order Food"); }}>Cafria<span>.</span></a><p>Made with care. Served with a smile.</p><span>ONLINE FOOD ORDERING SYSTEM</span></footer>

      {selectedMeal && <div className="modal-backdrop" onClick={() => setSelectedMeal(null)}>
        <section className="order-modal" role="dialog" aria-modal="true" aria-labelledby="meal-modal-title" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setSelectedMeal(null)}>×</button>
         {selectedMeal.image && (
  <img
    src={selectedMeal.image}
    alt={selectedMeal.name}
    className="food-image modal-food-image"
  />
)}<span className="eyebrow">CUSTOMIZE YOUR MEAL</span>
          <h2 id="meal-modal-title">{selectedMeal.name}</h2><p className="modal-description">{selectedMeal.description}</p>
          <div className="modal-base-price">Base price <strong>{money(selectedMeal.price)}</strong></div>
          <label className="field-label">Quantity</label><div className="modal-quantity"><button onClick={() => setMealQty(q => Math.max(1, q - 1))}>−</button><strong>{mealQty}</strong><button onClick={() => setMealQty(q => Math.min(99, q + 1))}>＋</button></div>
          <label className="field-label">Add-ons (optional)</label><div className="addon-list">
            {addons.filter(a => !((selectedMeal.category === "Snacks" || ["fries", "turon", "lumpia"].includes(selectedMeal.id)) && a.id === "rice")).map(a => <label className="addon-option" key={a.id}>
              <input type="checkbox" checked={mealAddons.includes(a.id)} onChange={e => setMealAddons(cur => e.target.checked ? [...cur, a.id] : cur.filter(id => id !== a.id))} />
              <span>{a.emoji}</span><span className="addon-name">{a.name}<small>Optional extra</small></span><strong>{money(a.price)}</strong>
            </label>)}
          </div>
          <div className="total-row"><span>Subtotal</span><strong>{money((selectedMeal.price + addons.filter(a => mealAddons.includes(a.id)).reduce((n, a) => n + a.price, 0)) * mealQty)}</strong></div>
          <div className="modal-actions"><button className="secondary-button" onClick={() => setSelectedMeal(null)}>Cancel</button><button className="place-order-button" onClick={saveMeal}>Save meal <span>✓</span></button></div>
        </section></div>}

      {showCart && <div className="modal-backdrop" onClick={() => setShowCart(false)}><section className="order-modal cart-modal" role="dialog" aria-modal="true" aria-labelledby="cart-modal-title" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setShowCart(false)}>×</button><span className="eyebrow">YOUR ORDER</span><h2 id="cart-modal-title">Review your basket</h2><p className="modal-description">Cancel items or add another meal before finalizing.</p>
        {cartItems.length ? <div className="cart-list modal-cart-list">{cartItems.map(item => <div className="cart-row" key={item.id}><span className="cart-emoji">{item.emoji}</span><div className="cart-item-name"><b>{item.name} × {item.quantity}</b><small>{item.addons.length ? item.addons.map(a => `${a.name} (+${money(a.price)})`).join(", ") : "No add-ons"}</small></div><strong>{money(item.unitPrice * item.quantity)}</strong><button className="remove-cart-item" onClick={() => removeMeal(item.id)} title="Cancel this item">×</button></div>)}</div> : <div className="cart-empty">No meals in your order yet.</div>}
        <label className="field-label" htmlFor="customerNameModal">Name for the order (optional)</label><input className="text-field" id="customerNameModal" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Enter your name" maxLength={80} />
        <div className="total-row"><span>Total</span><strong>{money(total)}</strong></div><div className="modal-actions">
          <button className="secondary-button" onClick={() => { setShowCart(false); document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" }); }}>＋ Add another meal</button>
          <button className="place-order-button" disabled={!cartItems.length} onClick={() => { setShowCart(false); setShowPayment(true); }}>Finalize order <span>→</span></button>
        </div></section></div>}

      {showPayment && <div className="modal-backdrop" onClick={() => setShowPayment(false)}><section className="order-modal" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setShowPayment(false)}>×</button><span className="eyebrow">LAST STEP</span><h2 id="payment-modal-title">Choose payment</h2><p className="modal-description">Select your payment method to submit the order.</p>
        <div className="payment-grid payment-modal-grid">
          <button className={`payment-choice ${paymentMethod === "Cash" ? "selected" : ""}`} onClick={() => setPaymentMethod("Cash")}><span className="cash-logo">₱</span><span><b>Cash</b><small>Pay at counter</small></span><span className="choice-radio">{paymentMethod === "Cash" ? "●" : ""}</span></button>
          <button className={`payment-choice ${paymentMethod === "GCash" ? "selected" : ""}`} onClick={() => setPaymentMethod("GCash")}><span className="gcash-logo">G</span><span><b>GCash</b><small>Demo selection only</small></span><span className="choice-radio">{paymentMethod === "GCash" ? "●" : ""}</span></button>
        </div>
        {paymentMethod === "GCash" && <p className="payment-note">Demo mode: GCash is recorded as selected; no real payment is processed.</p>}
        <label className="field-label">Ordering ticket</label><div className="choice-grid">
          <button className={`choice-card ${orderType === "Manual" ? "selected" : ""}`} onClick={() => setOrderType("Manual")}><span className="choice-icon">☰</span><span><b>Manual</b><small>Standard order</small></span><span className="choice-radio">{orderType === "Manual" ? "●" : ""}</span></button>
          <button className={`choice-card ${orderType === "QR Code" ? "selected" : ""}`} onClick={() => setOrderType("QR Code")}><span className="choice-icon">▦</span><span><b>QR ticket</b><small>Generate a QR ticket</small></span><span className="choice-radio">{orderType === "QR Code" ? "●" : ""}</span></button>
        </div>
        <div className="total-row"><span>Amount due</span><strong>{money(total)}</strong></div><div className="modal-actions">
          <button className="secondary-button" onClick={() => { setShowPayment(false); setShowCart(true); }}>Back to order</button>
          <button className="place-order-button" disabled={submitting || !cartItems.length} onClick={async () => { await placeOrder(); setShowPayment(false); }}>{submitting ? "Submitting…" : "Confirm order"} <span>✓</span></button>
        </div></section></div>}

      {notice && <div className={`notice ${notice.toLowerCase().includes("cannot") || notice.toLowerCase().includes("could not") ? "notice-error" : ""}`} role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss message">×</button></div>}

      {receiptOrder && <div className="modal-backdrop" onClick={() => setReceiptOrder(null)}>
        <section className="receipt-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="receipt-title">
          <button className="modal-close" onClick={() => setReceiptOrder(null)} aria-label="Close receipt">×</button>
          <div className="print-only receipt-print-head"><strong>Crave.</strong><span>ONLINE FOOD ORDERING SYSTEM</span><small>{new Date(receiptOrder.createdAt).toLocaleString()} · {receiptOrder.customerName}</small></div>
          <div className="receipt-check">✓</div><span className="eyebrow">{receiptIsHistory ? "RECEIPT" : "ORDER RECEIVED"}</span><h2 id="receipt-title">{receiptIsHistory ? `Order #${receiptOrder.number}` : "You're all set!"}</h2><p className="receipt-subtitle">{receiptIsHistory ? "Saved copy of this order's receipt." : "Keep your order number for collection."}</p>
          <div className="receipt-number"><small>YOUR ORDER NUMBER</small><strong>#{receiptOrder.number}</strong><span className="status-pill">{receiptOrder.status}</span></div>
          {receiptOrder.qrCode && <div className="qr-ticket"><img src={receiptOrder.qrCode} alt={`QR code for order ${receiptOrder.number}`} /><p>Scan this QR code to view your order ticket.</p></div>}
          <div className="receipt-lines">{receiptOrder.items.map((item) => <div key={item.id}><span>{item.emoji} {item.name} × {item.quantity}{item.addonNames?.length > 0 && <small className="receipt-addons">+ {item.addonNames.join(", ")}</small>}</span><b>{money(item.price * item.quantity)}</b></div>)}</div>
          <div className="receipt-total"><span>Total</span><strong>{money(receiptOrder.total)}</strong></div>
          <div className="receipt-info">{receiptIsHistory && <><span>Customer</span><b>{receiptOrder.customerName}</b><span>Date</span><b>{new Date(receiptOrder.createdAt).toLocaleString()}</b></>}<span>Ordering method</span><b>{receiptOrder.orderType}</b><span>Payment</span><b>{receiptOrder.paymentMethod}</b><span>Payment status</span><b>{receiptOrder.paymentStatus}</b></div>
          {receiptOrder.paymentMethod === "GCash" && <p className="payment-note">Demo only — no real GCash payment has been sent or confirmed.</p>}
          <div className="print-only receipt-print-foot">Thank you for ordering!<br />Please keep this receipt.</div>
          <button className="secondary-button print-button no-print" onClick={() => window.print()}>🖨 Print receipt</button>
          {receiptIsHistory
            ? <button className="place-order-button no-print" onClick={() => setReceiptOrder(null)}>Back to receipts <span>←</span></button>
            : <button className="place-order-button no-print" onClick={() => { setReceiptOrder(null); setActiveTab("Order Queue"); loadOrders(); }}>View order queue <span>→</span></button>}
        </section>
      </div>}
    </div>
  );
}
