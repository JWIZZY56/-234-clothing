// Frontend JavaScript: loads products, manages the cart, and sends orders to the backend.
const productGrid = document.querySelector("#product-grid");
const cartDrawer = document.querySelector("#cart-drawer");
const cartOverlay = document.querySelector("#cart-overlay");
const cartItemsEl = document.querySelector("#cart-items");
const cartCountEl = document.querySelector("#cart-count");
const drawerCountEl = document.querySelector("#drawer-count");
const subtotalEl = document.querySelector("#cart-subtotal");
const checkoutModal = document.querySelector("#checkout-modal");
const checkoutMessage = document.querySelector("#checkout-message");

let products = [];
let cart = JSON.parse(localStorage.getItem("234-cart") || "[]");
let activeCategory = "All";
let toastTimer;

const money = (amount) => new Intl.NumberFormat("en-NG", {
  style: "currency", currency: "NGN", maximumFractionDigits: 0
}).format(amount);

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

async function loadProducts() {
  try {
    const response = await fetch("/api/products");
    if (!response.ok) throw new Error("Could not load products");
    products = await response.json();
    renderProducts();
    renderCart();
  } catch (error) {
    productGrid.innerHTML = '<p>Could not load products. Make sure the server is running and refresh the page.</p>';
  }
}

function renderProducts() {
  const visibleProducts = activeCategory === "All"
    ? products
    : products.filter((product) => product.category === activeCategory);

  if (!visibleProducts.length) {
    productGrid.innerHTML = "<p>No products in this category yet.</p>";
    return;
  }

  productGrid.innerHTML = visibleProducts.map((product) => `
    <article class="product-card">
      <div class="product-image">
        <img src="${product.image}" alt="${product.name}" loading="lazy">
        ${product.tag ? `<span class="product-tag">${product.tag}</span>` : ""}
        <button class="add-button" data-add="${product.id}" aria-label="Add ${product.name} to bag">+</button>
      </div>
      <div class="product-info">
        <div><h3>${product.name}</h3><p>${product.category}</p></div>
        <span class="product-price">${money(product.price)}</span>
      </div>
    </article>
  `).join("");
}

function saveCart() {
  localStorage.setItem("234-cart", JSON.stringify(cart));
  renderCart();
}

function addToCart(productId) {
  const existing = cart.find((item) => item.id === productId);
  if (existing) existing.quantity += 1;
  else cart.push({ id: productId, quantity: 1 });
  saveCart();
  showToast("Added to your bag.");
}

function renderCart() {
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartCountEl.textContent = totalQuantity;
  drawerCountEl.textContent = `(${totalQuantity})`;

  const rows = cart.map((item) => {
    const product = products.find((p) => p.id === item.id);
    if (!product) return "";
    return `
      <div class="cart-row">
        <img src="${product.image}" alt="">
        <div>
          <h3>${product.name}</h3>
          <p>${money(product.price)}</p>
          <div class="quantity-controls">
            <button data-quantity="${product.id}" data-change="-1" aria-label="Decrease quantity">−</button>
            <span>${item.quantity}</span>
            <button data-quantity="${product.id}" data-change="1" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <button class="remove-item" data-remove="${product.id}">Remove</button>
      </div>
    `;
  }).join("");

  cartItemsEl.innerHTML = rows || '<p class="empty-cart">Your bag is empty. Go find your fit.</p>';
  const total = cart.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.id);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);
  subtotalEl.textContent = money(total);
}

function openCart() {
  cartDrawer.classList.add("open");
  cartDrawer.setAttribute("aria-hidden", "false");
  cartOverlay.hidden = false;
}
function closeCart() {
  cartDrawer.classList.remove("open");
  cartDrawer.setAttribute("aria-hidden", "true");
  cartOverlay.hidden = true;
}

productGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (button) addToCart(Number(button.dataset.add));
});

document.querySelector("#filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  document.querySelectorAll(".filter").forEach((filter) => filter.classList.toggle("active", filter === button));
  renderProducts();
});

cartItemsEl.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove]");
  if (removeButton) {
    cart = cart.filter((item) => item.id !== Number(removeButton.dataset.remove));
    saveCart();
    return;
  }
  const quantityButton = event.target.closest("[data-quantity]");
  if (quantityButton) {
    const item = cart.find((entry) => entry.id === Number(quantityButton.dataset.quantity));
    if (!item) return;
    item.quantity += Number(quantityButton.dataset.change);
    if (item.quantity < 1) cart = cart.filter((entry) => entry.id !== item.id);
    if (item.quantity > 20) item.quantity = 20;
    saveCart();
  }
});

document.querySelector("#open-cart").addEventListener("click", openCart);
document.querySelector("#close-cart").addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);

document.querySelector("#checkout-open").addEventListener("click", () => {
  if (!cart.length) return showToast("Your bag is empty.");
  closeCart();
  checkoutMessage.textContent = "";
  checkoutModal.hidden = false;
});
document.querySelector("#close-checkout").addEventListener("click", () => {
  checkoutModal.hidden = true;
});

document.querySelector("#checkout-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!cart.length) return;
  const form = new FormData(event.currentTarget);
  const button = document.querySelector("#place-order");
  button.disabled = true;
  button.textContent = "Saving order…";

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: {
          name: form.get("name"),
          email: form.get("email"),
          address: form.get("address")
        },
        items: cart
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not place order.");

    checkoutMessage.textContent = `${result.message} Your order number is ${result.orderNumber}. Total: ${money(result.total)}.`;
    cart = [];
    saveCart();
    event.currentTarget.reset();
    showToast("Demo order saved.");
  } catch (error) {
    checkoutMessage.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Place demo order";
  }
});

document.querySelector("#newsletter-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const email = document.querySelector("#newsletter-email").value.trim();
  const subscribers = JSON.parse(localStorage.getItem("234-subscribers") || "[]");
  if (!subscribers.includes(email)) subscribers.push(email);
  localStorage.setItem("234-subscribers", JSON.stringify(subscribers));
  document.querySelector("#newsletter-message").textContent = "You're on the list — thanks for joining.";
  event.currentTarget.reset();
});

document.querySelector("#year").textContent = new Date().getFullYear();
loadProducts();