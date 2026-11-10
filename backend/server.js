import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { Redis } from "@upstash/redis";

const app = express();
const PORT = process.env.PORT || 3001;

// Orders are stored in Upstash Redis (Vercel's filesystem is read-only, so orders.json can't be used).
// Vercel's integration sets either the UPSTASH_REDIS_REST_* or the KV_REST_API_* variables.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
});

const ORDERS_KEY = "orders";
const COUNTER_KEY = "order-counter";

app.use(cors());
app.use(express.json());

const MENU = [
  {
    id: "bacon-silog",
    name: "Bacon Silog",
    category: "All Day Breakfast",
    description: "Pinoy-style crispy chicken, perfect with rice",
    price: 125,
    emoji: "🍲",
    image: "/images/bacon-silog.png"
  },
  {
    id: "cheesy-bacon-silog",
    name: "Cheesy Bacon Silog",
    category: "All Day Breakfast",
    description: "Bacon Silog with extra cheese",
    price: 135,
    emoji: "🧀",
    image: "/images/cheesy-bacon-silog.jpg",
    popular: true
  },
  {
    id: "classic-tosilog",
    name: "Classic Tocilog",
    category: "All Day Breakfast",
    description: "Classic tocino with garlic rice and egg",
    price: 125,
    emoji: "🍳",
    image: "/images/classic-tosilog.JPG"
  },
  {
    id: "cheesy-tocilog",
    name: "Cheesy Tocilog",
    category: "All Day Breakfast",
    description: "Classic tocino with garlic rice, egg, and extra cheese",
    price: 135,
    emoji: "🍛",
    image: "/images/cheesy-tocilog.jpg"
  },
  {
    id: "hungarian-silog",
    name: "Hungarian Silog",
    category: "All Day Breakfast",
    description: "Hungarian sausage with garlic rice and egg",
    price: 140,
    emoji: "🍛",
    image: "/images/hungarian-silog.jpg"
  },
  {
    id: "k-pam-silog",
    name: "K-Pam Silog",
    category: "All Day Breakfast",
    description: "K-pam silog wth garlic rice and egg ",
    price: 130,
    emoji: "🍗",
    image: "/images/k-pam-silog.jpg"
  },
  {
    id: "spam-musubi-egg",
    name: "Spam Musubi Egg",
    category: "All Day Breakfast",
    description: "Spam musubi with a fried egg",
    price: 145,
    emoji: "🍳",
    image: "/images/spam-musubi-egg.jpg",
    popular: true
  },
  {
    id: "sweet-ham-silog",
    name: "Sweet Ham Silog",
    category: "All Day Breakfast",
    description: "Sweet ham with garlic rice and egg",
    price: 100,
    emoji: "🍖",
    image: "/images/sweet-ham-silog.jpg"
  },
  {
    id: "cheesy-overload-fries",
    name: "Cheesy Overload Fries",
    category: "Snacks",
    description: "Golden, crispy potato fries with overloaded cheese",
    price: 100,
    emoji: "🍟",
    image: "/images/cheesy-overload-fries.jpg"
  },
  {
    id: "chicken-pop-and-fries",
    name: "Chicken Pop and Fries",
    category: "Snacks",
    description: "Crispy chicken pop with a side of fries",
    price: 120,
    emoji: "🍗",
    image: "/images/chicken-pop-and-fries.jpg"
  },
  {
    id: "chicken-bites",
    name: "Chicken Bites",
    category: "Snacks",
    description: "Crispy chicken bites with a side of fries",
    price: 120,
    emoji: "🍗",
    image: "/images/chicken-bites.jpg"
  },
  {
    id: "chip-and-fries",
    name: "Chip and Fries",
    category: "Snacks",
    description: "Crispy chips with a side of fries",
    price: 220,
    emoji: "🍟",
    image: "/images/chip-and-fries.jpg"
  },
  {
    id: "cheesy-nachos",
    name: "Cheesy Nachos",
    category: "Snacks",
    description: "Crispy tortilla chips with melted cheese",
    price: 250,
    emoji: "🧀",
    image: "/images/cheesy-nachos.jpg"
  },
  {
    id: "snack-trio",
    name: "Snack Trio",
    category: "Snacks",
    description: "Big 3 of the snack world: fries, cheesy nachos, and chicken bites",
    price: 380,
    emoji: "🧋",
    image: "/images/snack-trio.jpg"
  },
  {
    id: "classic-faves",
    name: "Classic Faves",
    category: "Snacks",
    description: "A classic snack combo of fries and chicken bites, and a side juicy hotdog",
    price: 430,
    emoji: "🍨",
    image: "/images/classic-faves.jpg"
  },
  {
    id: "signature-platter",
    name: "Signature Platter",
    category: "Snacks",
    description: "A signature combo of savory fries, chicken pops, cheesy natchos, and a side of juicy hotdog",
    price: 550,
    emoji: "🥗",
    image: "/images/signature-platter.jpg"
  }
];

const ADDON_CATALOG = [
  { id: "rice", name: "Extra rice", price: 15, emoji: "🍚" },
  { id: "drink", name: "Soft drink", price: 25, emoji: "🥤" },
  { id: "gravy", name: "Extra gravy", price: 10, emoji: "🥣" },
  { id: "egg", name: "Fried egg", price: 18, emoji: "🍳" }
];

const VALID_STATUSES = ["Confirmed", "Preparing", "Ready", "Completed"];

// Accepts 09XXXXXXXXX, +639XXXXXXXXX or 639XXXXXXXXX (spaces/dashes allowed) and returns 09XXXXXXXXX.
function normalizePhone(value) {
  const cleaned = String(value || "").replace(/[\s\-()]/g, "");
  const match = cleaned.match(/^(?:\+?63|0)(9\d{9})$/);
  return match ? `0${match[1]}` : null;
}

// Each order is stored as its own entry in a Redis hash, keyed by order id.
async function readOrders() {
  const all = await redis.hgetall(ORDERS_KEY);
  return all ? Object.values(all) : [];
}

async function saveOrder(order) {
  await redis.hset(ORDERS_KEY, { [order.id]: order });
}

async function nextOrderNumber() {
  const n = await redis.incr(COUNTER_KEY);
  return String(n).padStart(4, "0");
}

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "Online Food Ordering System" }));
app.get("/api/menu", (_req, res) => res.json(MENU));

app.get("/api/orders", async (_req, res, next) => {
  try {
    const orders = await readOrders();
    res.json(orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (error) { next(error); }
});

app.post("/api/orders", async (req, res, next) => {
  try {
    const { customerName, items, orderType = "Manual", paymentMethod = "Cash", phoneNumber: rawPhone } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Please add at least one food item." });
    }
    if (!["QR Code", "Manual"].includes(orderType)) {
      return res.status(400).json({ error: "Choose QR Code or Manual ordering." });
    }
    if (!["GCash", "Cash"].includes(paymentMethod)) {
      return res.status(400).json({ error: "Choose GCash or Cash payment." });
    }

    // GCash orders must include a valid Philippine mobile number.
    let phoneNumber = null;
    if (paymentMethod === "GCash") {
      phoneNumber = normalizePhone(rawPhone);
      if (!phoneNumber) {
        return res.status(400).json({ error: "Please enter a valid GCash mobile number (e.g. 09123456789)." });
      }
    }

    const cleanItems = [];
    for (const item of items) {
      const menuItem = MENU.find((food) => food.id === item.id);
      const quantity = Math.floor(Number(item.quantity));
      if (!menuItem || !Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
        return res.status(400).json({ error: "One or more food items are invalid." });
      }
      const requestedAddons = Array.isArray(item.addons) ? item.addons : [];
      const isSnack = menuItem.category === "Snacks" || ["fries", "turon", "lumpia"].includes(menuItem.id);
      const chosenAddons = [...new Set(requestedAddons)]
        .map((addonId) => ADDON_CATALOG.find((a) => a.id === addonId))
        .filter(Boolean)
        .filter((a) => !(isSnack && a.id === "rice"));
      const addonTotal = chosenAddons.reduce((sum, addon) => sum + addon.price, 0);
      cleanItems.push({
        id: menuItem.id,
        name: menuItem.name,
        emoji: menuItem.emoji,
        price: menuItem.price + addonTotal,
        basePrice: menuItem.price,
        addons: chosenAddons.map(({ id, name, price }) => ({ id, name, price })),
        quantity
      });
    }

    const order = {
      id: randomUUID(),
      number: await nextOrderNumber(),
      customerName: String(customerName || "Guest").trim().slice(0, 80) || "Guest",
      ...(phoneNumber && { phoneNumber }),
      items: cleanItems,
      total: cleanItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
      orderType,
      paymentMethod,
      paymentStatus: paymentMethod === "Cash" ? "Pay at counter" : "Awaiting GCash confirmation",
      status: "Confirmed",
      createdAt: new Date().toISOString()
    };

    // This demo records GCash as the chosen payment method; it does not process real payments.
    if (order.orderType === "QR Code") {
      const qrPayload = JSON.stringify({
        type: "food-order",
        orderNumber: order.number,
        customer: order.customerName,
        total: order.total,
        items: order.items.map(({ name, quantity }) => ({ name, quantity }))
      });
      order.qrCode = await QRCode.toDataURL(qrPayload, { width: 280, margin: 2 });
    }

    await saveOrder(order);
    res.status(201).json(order);
  } catch (error) { next(error); }
});

// Customer's phone polls this to find out when the cashier has marked the order as paid.
app.get("/api/orders/:id", async (req, res, next) => {
  try {
    const order = await redis.hget(ORDERS_KEY, req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found." });
    res.json(order);
  } catch (error) { next(error); }
});

// Cashier confirms payment received.
app.patch("/api/orders/:id/pay", async (req, res, next) => {
  try {
    const order = await redis.hget(ORDERS_KEY, req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found." });
    order.paymentStatus = "Paid";
    order.paidAt = new Date().toISOString();
    order.updatedAt = order.paidAt;
    await saveOrder(order);
    res.json(order);
  } catch (error) { next(error); }
});

app.patch("/api/orders/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid order status." });
    }
    const order = await redis.hget(ORDERS_KEY, req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found." });
    order.status = status;
    order.updatedAt = new Date().toISOString();
    await saveOrder(order);
    res.json(order);
  } catch (error) { next(error); }
});

// Delete a receipt/order permanently.
app.delete("/api/orders/:id", async (req, res, next) => {
  try {
    const removed = await redis.hdel(ORDERS_KEY, req.params.id);
    if (!removed) return res.status(404).json({ error: "Order not found." });
    res.json({ ok: true, id: req.params.id });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(PORT, () => {
  console.log(`Online Food Ordering System API running at http://localhost:${PORT}`);
});

export default app;
