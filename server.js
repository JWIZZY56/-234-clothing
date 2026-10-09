// Simple backend for the +234 clothing store.
// It serves the website, returns products, and saves demo orders to data/orders.json.

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// GET /api/products — send product list to the browser.
app.get("/api/products", (req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  res.json(products);
});

// POST /api/orders — validate and save a demo order.
app.post("/api/orders", (req, res) => {
  const { customer, items } = req.body || {};

  if (!customer || !customer.name || !customer.email || !customer.address) {
    return res.status(400).json({ message: "Please enter your name, email, and delivery address." });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Your cart is empty." });
  }

  const products = readJson(PRODUCTS_FILE, []);
  const orderItems = [];

  for (const item of items) {
    const product = products.find((p) => p.id === Number(item.id));
    const quantity = Number(item.quantity);

    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return res.status(400).json({ message: "One of the cart items is invalid. Please refresh and try again." });
    }

    orderItems.push({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity,
      lineTotal: product.price * quantity
    });
  }

  const total = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const orders = readJson(ORDERS_FILE, []);
  const order = {
    orderNumber: "234-" + Date.now().toString().slice(-8),
    customer: {
      name: String(customer.name).trim(),
      email: String(customer.email).trim(),
      address: String(customer.address).trim()
    },
    items: orderItems,
    total,
    status: "Pending payment",
    createdAt: new Date().toISOString()
  };

  orders.push(order);
  writeJson(ORDERS_FILE, orders);

  res.status(201).json({
    message: "Order saved successfully! This demo does not take real payments.",
    orderNumber: order.orderNumber,
    total: order.total
  });
});

// Friendly fallback: send the home page for the root route.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`+234 store is running at http://localhost:${PORT}`);
});