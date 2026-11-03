import express from "express";
import cors from "cors";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import QRCode from "qrcode";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, "orders.json");

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
    image: "images/spam-musubi-egg.jpg",
    popular: true
  },

  { id: "sweet-ham-silog",
    name: "Sweet Ham Silog", 
    category: "All Day Breakfast", 
    description: "Sweet ham with garlic rice and egg", 
    price: 100, 
    emoji: "🍖", 
    image: "/images/sweet-ham-silog.jpg" },

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

  { id: "chicken-bites",
    name: "Chicken Bites",
    category: "Snacks",
    description: "Crispy chicken bites with a side of fries",
    price: 120,
    emoji: "�",
    image: "/images/chicken-bites.jpg"
  },

  { id: "chip-and-fries",
    name: "Chip and Fries",
    category: "Snacks",
    description: "Crispy chips with a side of fries",
    price: 220,
    emoji: "🍟",
    image: "/images/chip-and-fries.jpg"
  },

{ id: "cheesy-nachos", 
  name: "Cheesy Nachos", 
  category: "Snacks", 
  description: "Crispy tortilla chips with melted cheese", 
  price: 250, 
  emoji: "�", 
  image: "/images/cheesy-nachos.jpg" },

  { id: "snack-trio", 
    name: "Snack Trio", 
    category: "Snacks", 
    description: "Big 3 of the snack world: fries, cheesy nachos, and chicken bites", 
    price: 380, 
    emoji: "🧋", 
    image: "/images/snack-trio.jpg" },

  { id: "classic-faves", 
    name: "Classic Faves", 
    category: "Snacks", 
    description: "A classic snack combo of fries and chicken bites, and a side juicy hotdog", 
    price: 430, 
    emoji: "🍨",
    image: "/images/classic-faves.jpg" },

    { id: "signature-platter", 
    name: "Signature Platter", 
    category: "Snacks", 
    description: "A signature combo of savory fries, chicken pops, cheesy natchos, and a side of juicy hotdog", 
    price: 550, 
    emoji: "🥗", 
    image: "/images/signature-platter.jpg" }
];

const VALID_STATUSES = ["Confirmed", "Preparing", "Ready", "Completed"];

async function readOrders() {
  try {
    return JSON.parse(await fs.readFile(DB_FILE, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeOrders(orders) {
  await fs.writeFile(DB_FILE, JSON.stringify(orders, null, 2));
}

function nextOrderNumber(orders) {
  const max = orders.reduce((highest, order) => Math.max(highest, Number(order.number) || 0), 0);
  return String(max + 1).padStart(4, "0");
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
    const { customerName, items, orderType = "Manual", paymentMethod = "Cash" } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Please add at least one food item." });
    }
    if (!["QR Code", "Manual"].includes(orderType)) {
      return res.status(400).json({ error: "Choose QR Code or Manual ordering." });
    }
    if (!["GCash", "Cash"].includes(paymentMethod)) {
      return res.status(400).json({ error: "Choose GCash or Cash payment." });
    }

    const cleanItems = [];
    for (const item of items) {
      const menuItem = MENU.find((food) => food.id === item.id);
      const quantity = Math.floor(Number(item.quantity));
      if (!menuItem || !Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
        return res.status(400).json({ error: "One or more food items are invalid." });
      }
      const addonCatalog = [
        { id: "rice", name: "Extra rice", price: 15, emoji: "🍚" },
        { id: "drink", name: "Soft drink", price: 25, emoji: "🥤" },
        { id: "gravy", name: "Extra gravy", price: 10, emoji: "🥣" },
        { id: "egg", name: "Fried egg", price: 18, emoji: "🍳" }
      ];
      const requestedAddons = Array.isArray(item.addons) ? item.addons : [];
      const isSnack = menuItem.category === "Snacks" || ["fries", "turon", "lumpia"].includes(menuItem.id);
      const chosenAddons = [...new Set(requestedAddons)].map((addonId) => addonCatalog.find((a) => a.id === addonId)).filter(Boolean).filter((a) => !(isSnack && a.id === "rice"));
      const addonTotal = chosenAddons.reduce((sum, addon) => sum + addon.price, 0);
      cleanItems.push({
        id: menuItem.id, name: menuItem.name, emoji: menuItem.emoji,
        price: menuItem.price + addonTotal, basePrice: menuItem.price, quantity,
        addons: chosenAddons, addonNames: chosenAddons.map((a) => a.name)
      });
    }

    const orders = await readOrders();
    const order = {
      id: randomUUID(),
      number: nextOrderNumber(orders),
      customerName: String(customerName || "Guest").trim().slice(0, 80) || "Guest",
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
        items: order.items.map(({ name, quantity, addonNames }) => ({ name, quantity, addons: addonNames || [] }))
      });
      order.qrCode = await QRCode.toDataURL(qrPayload, { width: 280, margin: 2 });
    }

    orders.push(order);
    await writeOrders(orders);
    res.status(201).json(order);
  } catch (error) { next(error); }
});

app.patch("/api/orders/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid order status." });
    }
    const orders = await readOrders();
    const order = orders.find((entry) => entry.id === req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found." });
    order.status = status;
    order.updatedAt = new Date().toISOString();
    await writeOrders(orders);
    res.json(order);
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(PORT, () => {
  console.log(`Online Food Ordering System API running at http://localhost:${PORT}`);
});
