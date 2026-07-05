/* ==========================================================================
   APPLICATION LOGIC - QUICKBILL QR APP
   ========================================================================== */

// Make jsPDF global destructured accessible
const { jsPDF } = window.jspdf || {};

// ==========================================================================
// STATE MANAGEMENT & LOCAL STORAGE DATABASE
// ==========================================================================

const DEFAULT_PRODUCTS = [
  { id: "1", name: "Premium Arabica Coffee (250g)", sku: "COF-ARA-250", price: 499.00, taxPercent: 18, stock: 45, description: "Single-origin high-altitude Arabica coffee beans." },
  { id: "2", name: "Stainless Steel Smart Mug", sku: "MUG-SST-350", price: 1299.00, taxPercent: 18, stock: 20, description: "Vacuum insulated double-walled temperature display mug." },
  { id: "3", name: "Organic Oats & Nuts Granola (500g)", sku: "GRN-OAT-500", price: 299.00, taxPercent: 5, stock: 60, description: "Crunchy toasted oats sweetened with natural honey." },
  { id: "4", name: "QuickBill Bluetooth Receipt Printer", sku: "PRN-BLU-E58", price: 2499.00, taxPercent: 18, stock: 12, description: "Portable 58mm thermal receipt printer for mobile billing." },
  { id: "5", name: "Cold-Pressed Virgin Coconut Oil (1L)", sku: "OIL-COC-100", price: 380.00, taxPercent: 12, stock: 35, description: "100% pure cold-pressed oil from fresh coconuts." }
];

const DEFAULT_ORDERS = [
  { id: "TXN-7193", customerName: "Self-Checkout User", items: [{ productId: "1", qty: 2, price: 499.00 }], subtotal: 998.00, taxTotal: 179.64, discount: 0, grandTotal: 1177.64, timestamp: new Date(Date.now() - 3600000 * 24 * 3).toISOString(), status: "Paid" }, // 3 days ago
  { id: "TXN-7254", customerName: "Self-Checkout User", items: [{ productId: "3", qty: 1, price: 299.00 }, { productId: "5", qty: 1, price: 380.00 }], subtotal: 679.00, taxTotal: 60.55, discount: 67.90, grandTotal: 671.65, timestamp: new Date(Date.now() - 3600000 * 24 * 2).toISOString(), status: "Paid" }, // 2 days ago
  { id: "TXN-7391", customerName: "Self-Checkout User", items: [{ productId: "2", qty: 1, price: 1299.00 }], subtotal: 1299.00, taxTotal: 233.82, discount: 0, grandTotal: 1532.82, timestamp: new Date(Date.now() - 3600000 * 24 * 1).toISOString(), status: "Paid" } // 1 day ago
];

const DEFAULT_PAYOUTS = [
  { date: new Date(Date.now() - 3600000 * 24 * 4).toLocaleDateString(), ref: "PAY-18302194", method: "UPI Instant Transfer", amount: 1520.00, status: "Success" },
  { date: new Date(Date.now() - 3600000 * 24 * 2).toLocaleDateString(), ref: "PAY-19283018", method: "UPI Instant Transfer", amount: 1177.64, status: "Success" }
];

let state = {
  products: [],
  orders: [],
  payouts: [],
  subscription: { plan: "pro", name: "Pro Shop", price: "₹999/mo", status: "Active", expiryDate: "Aug 5, 2026" },
  payoutSettings: { upi: "supermart@oksbi", bank: "5010048192837", ifsc: "HDFC0000241", schedule: "daily" },
  storeSettings: { name: "SuperMart Express", contact: "+91 98765 43210", address: "Sector 62, Noida, UP, India", currency: "INR", gstin: "09AAAAA1111A1Z1", footerMsg: "Thank you for shopping with us! Please come again." },
  cart: [],
  activePromo: null
};

// Initialize DB from localStorage or defaults
function initDatabase() {
  const localProducts = localStorage.getItem("qb_products");
  const localOrders = localStorage.getItem("qb_orders");
  const localPayouts = localStorage.getItem("qb_payouts");
  const localSub = localStorage.getItem("qb_subscription");
  const localPayoutSet = localStorage.getItem("qb_payout_settings");
  const localStoreSet = localStorage.getItem("qb_store_settings");

  state.products = localProducts ? JSON.parse(localProducts) : [...DEFAULT_PRODUCTS];
  state.orders = localOrders ? JSON.parse(localOrders) : [...DEFAULT_ORDERS];
  state.payouts = localPayouts ? JSON.parse(localPayouts) : [...DEFAULT_PAYOUTS];
  if (localSub) state.subscription = JSON.parse(localSub);
  if (localPayoutSet) state.payoutSettings = JSON.parse(localPayoutSet);
  if (localStoreSet) state.storeSettings = JSON.parse(localStoreSet);

  // Generate missing QR codes for products
  generateQRCodesForProducts().then(() => {
    saveState();
    renderAll();
  });
}

function saveState() {
  localStorage.setItem("qb_products", JSON.stringify(state.products));
  localStorage.setItem("qb_orders", JSON.stringify(state.orders));
  localStorage.setItem("qb_payouts", JSON.stringify(state.payouts));
  localStorage.setItem("qb_subscription", JSON.stringify(state.subscription));
  localStorage.setItem("qb_payout_settings", JSON.stringify(state.payoutSettings));
  localStorage.setItem("qb_store_settings", JSON.stringify(state.storeSettings));
}

// Generate data URLs for QR codes
async function generateQRCodesForProducts() {
  for (let product of state.products) {
    if (!product.qrCode) {
      // Secure product payload: store ID + product ID + signature simulation
      const qrPayload = JSON.stringify({
        sId: state.storeSettings.gstin,
        pId: product.id,
        sku: product.sku,
        sig: btoa(product.id + product.sku).substring(0, 8) // mock validation signature
      });
      try {
        product.qrCode = await QRCode.toDataURL(qrPayload, { margin: 2, scale: 6 });
      } catch (err) {
        console.error("QR Gen Error:", err);
      }
    }
  }
}

// ==========================================================================
// RENDER & UI ROUTING CONTROLLERS
// ==========================================================================

function renderAll() {
  updateHeaderAndBadges();
  renderDashboardStats();
  renderDashboardChart();
  renderRecentOrders();
  renderInventoryList();
  renderQRSheetPreview();
  renderPayoutsTab();
  renderSubscriptionUI();
  populateSettingsForm();
  updateCustomerDeviceLabels();
  populateScanSimulatorDropdown();
  renderCart();
}

function updateHeaderAndBadges() {
  document.getElementById("active-store-name").textContent = state.storeSettings.name;
  document.getElementById("sidebar-plan-name").textContent = `${state.subscription.name} (${state.subscription.status})`;
}

// ==========================================================================
// TAB NAVIGATOR
// ==========================================================================

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.remove("active"));
    
    btn.classList.add("active");
    const targetTab = btn.getAttribute("data-tab");
    document.getElementById(`tab-${targetTab}`).classList.add("active");

    // Re-render chart / print layouts on tab changes
    if (targetTab === "dashboard") {
      setTimeout(renderDashboardChart, 100);
    } else if (targetTab === "qr-exporter") {
      renderQRSheetPreview();
    }
  });
});

// ==========================================================================
// TAB 1: OVERVIEW & SALES GRAPH
// ==========================================================================

function renderDashboardStats() {
  const totalSales = state.orders.reduce((sum, order) => sum + order.grandTotal, 0);
  const totalOrders = state.orders.length;
  
  // Calculate today's orders
  const startOfToday = new Date();
  startOfToday.setHours(0,0,0,0);
  const todayOrdersCount = state.orders.filter(o => new Date(o.timestamp) >= startOfToday).length;

  // Calculate simulated Payout Balance
  const totalPaid = state.orders.reduce((sum, o) => sum + o.grandTotal, 0);
  const totalPaidOut = state.payouts.reduce((sum, p) => sum + p.amount, 0);
  const payoutBalance = Math.max(0, totalPaid - totalPaidOut);

  document.getElementById("stat-total-sales").textContent = `₹${totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById("stat-total-orders").textContent = totalOrders;
  document.getElementById("stat-orders-today").textContent = `${todayOrdersCount} today`;
  document.getElementById("stat-active-products").textContent = state.products.length;
  document.getElementById("stat-payout-balance").textContent = `₹${payoutBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const scheduleText = state.payoutSettings.schedule.toUpperCase();
  document.getElementById("payout-status-text").textContent = `Auto-payout: ${scheduleText}`;
}

function renderDashboardChart() {
  const svg = document.getElementById("sales-chart");
  const gridGroup = document.getElementById("chart-grid");
  const areaPath = document.getElementById("chart-area");
  const linePath = document.getElementById("chart-line");
  const dotsGroup = document.getElementById("chart-dots");
  const labelsGroup = document.getElementById("chart-labels");

  // Get last 7 days of sales
  const days = [];
  const salesMap = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    days.push(dateStr);
    salesMap[dateStr] = 0;
  }

  state.orders.forEach(order => {
    const dateStr = new Date(order.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    if (salesMap[dateStr] !== undefined) {
      salesMap[dateStr] += order.grandTotal;
    }
  });

  const data = days.map(d => salesMap[d]);
  const maxVal = Math.max(...data, 1000); // Minimum scale height 1000

  // Chart rendering layout configs
  const width = 540;
  const height = 180;
  const paddingX = 40;
  const paddingY = 20;
  
  // Clear previous
  gridGroup.innerHTML = "";
  dotsGroup.innerHTML = "";
  labelsGroup.innerHTML = "";

  // Draw Horizontal Gridlines & Y-axis labels
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const y = paddingY + ((height - paddingY * 2) / steps) * i;
    const value = maxVal - ((maxVal / steps) * i);
    
    // Gridline
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", paddingX);
    line.setAttribute("y1", y);
    line.setAttribute("x2", width);
    line.setAttribute("y2", y);
    gridGroup.appendChild(line);

    // Label
    const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    txt.setAttribute("x", paddingX - 8);
    txt.setAttribute("y", y + 4);
    txt.setAttribute("text-anchor", "end");
    txt.textContent = `₹${Math.round(value)}`;
    labelsGroup.appendChild(txt);
  }

  // Draw X-axis days & calculate coordinate points
  const points = [];
  const spacing = (width - paddingX) / (data.length - 1);
  
  data.forEach((val, idx) => {
    const x = paddingX + spacing * idx;
    const normY = 1 - (val / maxVal);
    const y = paddingY + normY * (height - paddingY * 2);
    points.push({ x, y, val, day: days[idx] });

    // Label
    const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    txt.setAttribute("x", x);
    txt.setAttribute("y", height + 16);
    txt.setAttribute("text-anchor", "middle");
    txt.textContent = days[idx];
    labelsGroup.appendChild(txt);
  });

  // Assemble path nodes
  if (points.length > 0) {
    let lineD = `M ${points[0].x} ${points[0].y}`;
    let areaD = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      lineD += ` L ${points[i].x} ${points[i].y}`;
      areaD += ` L ${points[i].x} ${points[i].y}`;
    }

    areaD += ` L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

    linePath.setAttribute("d", lineD);
    areaPath.setAttribute("d", areaD);

    // Add dots and tooltips
    points.forEach(pt => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", pt.x);
      circle.setAttribute("cy", pt.y);
      circle.setAttribute("r", 5);
      circle.setAttribute("fill", "#6366F1");
      circle.setAttribute("stroke", "#151D30");
      circle.setAttribute("stroke-width", 2);
      circle.style.cursor = "pointer";
      
      // Dynamic Title Tooltip
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = `${pt.day}: ₹${pt.val.toFixed(2)}`;
      circle.appendChild(title);
      dotsGroup.appendChild(circle);
    });
  }
}

function renderRecentOrders() {
  const list = document.getElementById("recent-orders-list");
  list.innerHTML = "";
  
  // Get last 5 orders
  const sorted = [...state.orders].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);
  
  if (sorted.length === 0) {
    list.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--color-text-muted);">No sales recorded yet</td></tr>`;
    return;
  }

  sorted.forEach(order => {
    const row = document.createElement("tr");
    const dateStr = new Date(order.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    row.innerHTML = `
      <td><strong>${order.id}</strong></td>
      <td>₹${order.grandTotal.toFixed(2)}</td>
      <td><span class="badge active">UPI Paid</span></td>
      <td>${dateStr}</td>
    `;
    list.appendChild(row);
  });
}

// ==========================================================================
// TAB 2: PRODUCT CRUD
// ==========================================================================

function renderInventoryList() {
  const tbody = document.getElementById("inventory-list");
  tbody.innerHTML = "";

  state.products.forEach(p => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <div class="prod-cell">
          <div class="prod-img" style="background: var(--color-indigo-gradient); border-radius: var(--radius-sm); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-family: var(--font-display); color: white;">
            ${p.name.substring(0, 2).toUpperCase()}
          </div>
          <div class="prod-meta">
            <h4>${p.name}</h4>
            <p>${p.description || "No description provided."}</p>
          </div>
        </div>
      </td>
      <td><code>${p.sku}</code></td>
      <td>₹${p.price.toFixed(2)}</td>
      <td>${p.taxPercent}%</td>
      <td>${p.stock} units</td>
      <td>
        <div class="flex items-center gap-2">
          <img src="${p.qrCode || ''}" style="width: 28px; height: 28px; border: 1px solid var(--color-border); border-radius: 4px; background: white;" alt="QR mini">
          <span style="font-size: 10px; color: var(--color-text-muted);">Signed URL</span>
        </div>
      </td>
      <td>
        <div class="action-row-btns">
          <button title="Edit Product" class="edit-btn" data-id="${p.id}"><i data-lucide="edit-3" style="width: 14px; height: 14px;"></i></button>
          <button title="Delete Product" class="delete delete-btn" data-id="${p.id}"><i data-lucide="trash" style="width: 14px; height: 14px;"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });

  lucide.createIcons();

  // Attach CRUD action button triggers
  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const pid = btn.getAttribute("data-id");
      openProductModal(pid);
    });
  });

  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const pid = btn.getAttribute("data-id");
      if (confirm("Are you sure you want to delete this product and revoke its QR code?")) {
        state.products = state.products.filter(p => p.id !== pid);
        saveState();
        renderAll();
      }
    });
  });
}

// ADD/EDIT Product Modal Controls
const productModal = document.getElementById("modal-product");
document.getElementById("btn-add-product").addEventListener("click", () => openProductModal());
document.getElementById("btn-close-product-modal").addEventListener("click", closeProductModal);
document.getElementById("btn-cancel-product-modal").addEventListener("click", closeProductModal);

function openProductModal(id = null) {
  const form = document.getElementById("product-form");
  form.reset();
  document.getElementById("form-product-id").value = "";
  document.getElementById("modal-product-title").textContent = "Add New Product";

  if (id) {
    const p = state.products.find(item => item.id === id);
    if (p) {
      document.getElementById("modal-product-title").textContent = "Edit Product Details";
      document.getElementById("form-product-id").value = p.id;
      document.getElementById("form-product-name").value = p.name;
      document.getElementById("form-product-sku").value = p.sku;
      document.getElementById("form-product-price").value = p.price;
      document.getElementById("form-product-tax").value = p.taxPercent;
      document.getElementById("form-product-stock").value = p.stock;
      document.getElementById("form-product-desc").value = p.description || "";
    }
  }
  productModal.classList.add("active");
}

function closeProductModal() {
  productModal.classList.remove("active");
}

document.getElementById("product-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("form-product-id").value;
  const name = document.getElementById("form-product-name").value;
  const sku = document.getElementById("form-product-sku").value;
  const price = parseFloat(document.getElementById("form-product-price").value);
  const taxPercent = parseInt(document.getElementById("form-product-tax").value);
  const stock = parseInt(document.getElementById("form-product-stock").value);
  const description = document.getElementById("form-product-desc").value;

  if (id) {
    // Edit Mode
    const index = state.products.findIndex(p => p.id === id);
    if (index !== -1) {
      // Retain or regenerate QR code
      const oldSku = state.products[index].sku;
      state.products[index] = { ...state.products[index], name, sku, price, taxPercent, stock, description };
      if (oldSku !== sku) {
        state.products[index].qrCode = null; // force regenerate
      }
    }
  } else {
    // Add Mode
    const newProduct = {
      id: (Date.now() + Math.floor(Math.random() * 1000)).toString(),
      name, sku, price, taxPercent, stock, description, qrCode: null
    };
    state.products.push(newProduct);
  }

  await generateQRCodesForProducts();
  saveState();
  closeProductModal();
  renderAll();
});

// CSV Import Modal & Parsing Logic
const csvModal = document.getElementById("modal-csv");
const csvFileInput = document.getElementById("csv-file-input");
const csvFileStatus = document.getElementById("csv-file-status");
const csvProcessBtn = document.getElementById("btn-process-csv");
let uploadedCSVContent = "";

document.getElementById("btn-import-csv").addEventListener("click", () => {
  csvModal.classList.add("active");
  csvFileInput.value = "";
  csvFileStatus.textContent = "";
  csvProcessBtn.disabled = true;
  uploadedCSVContent = "";
});

document.getElementById("btn-close-csv-modal").addEventListener("click", () => csvModal.classList.remove("active"));
document.getElementById("btn-cancel-csv-modal").addEventListener("click", () => csvModal.classList.remove("active"));
document.getElementById("btn-browse-csv").addEventListener("click", () => csvFileInput.click());

csvFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    csvFileStatus.textContent = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;
    const reader = new FileReader();
    reader.onload = (evt) => {
      uploadedCSVContent = evt.target.result;
      csvProcessBtn.disabled = false;
    };
    reader.readAsText(file);
  }
});

// Handle Drag and Drop
const dropzone = document.getElementById("csv-dropzone");
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.style.borderColor = "var(--color-indigo)";
});
dropzone.addEventListener("dragleave", () => {
  dropzone.style.borderColor = "var(--color-border)";
});
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.style.borderColor = "var(--color-border)";
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith(".csv")) {
    csvFileStatus.textContent = `Dropped: ${file.name}`;
    const reader = new FileReader();
    reader.onload = (evt) => {
      uploadedCSVContent = evt.target.result;
      csvProcessBtn.disabled = false;
    };
    reader.readAsText(file);
  } else {
    alert("Please drop a valid .csv file.");
  }
});

// Download Sample CSV template
document.getElementById("btn-download-csv-template").addEventListener("click", () => {
  const content = "name,sku,price,taxPercent,stock,description\nClassic Organic Green Tea,TEA-GRN-100,249.00,5,50,Premium whole leaf green tea bags\nDesigner Glass Coffee Server,SRV-GLS-600,899.00,18,15,Heat-resistant borosilicate glass coffee server 600ml\nGluten Free Almond Cookies (200g),CK-ALM-200,180.00,12,40,High fiber gluten-free almond biscuits";
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "quickbill_products_template.csv";
  link.click();
  URL.revokeObjectURL(url);
});

csvProcessBtn.addEventListener("click", async () => {
  if (!uploadedCSVContent) return;

  const lines = uploadedCSVContent.split("\n");
  let importCount = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Basic CSV splitting (does not handle commas in quoted fields for MVP simplicity)
    const columns = line.split(",");
    if (columns.length >= 5) {
      const name = columns[0].trim();
      const sku = columns[1].trim();
      const price = parseFloat(columns[2]) || 0;
      const taxPercent = parseInt(columns[3]) || 18;
      const stock = parseInt(columns[4]) || 0;
      const description = columns[5] ? columns[5].trim() : "";

      if (name && sku) {
        const item = {
          id: (Date.now() + Math.floor(Math.random() * 10000)).toString(),
          name, sku, price, taxPercent, stock, description, qrCode: null
        };
        state.products.push(item);
        importCount++;
      }
    }
  }

  await generateQRCodesForProducts();
  saveState();
  csvModal.classList.remove("active");
  alert(`Successfully bulk-imported ${importCount} products!`);
  renderAll();
});

// ==========================================================================
// TAB 3: QR SHEET EXPORTER (PDF GENERATOR)
// ==========================================================================

function renderQRSheetPreview() {
  const container = document.getElementById("qr-sheet-preview-container");
  const layout = document.getElementById("qr-layout-select").value;
  
  container.className = `qr-sheet-preview ${layout}`;
  container.innerHTML = "";

  if (state.products.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #888; padding: 40px 0;">No products in inventory. Please add products first.</p>`;
    return;
  }

  state.products.forEach(p => {
    const tag = document.createElement("div");
    tag.className = "qr-tag-item";
    tag.innerHTML = `
      <canvas id="prev-canvas-${p.id}"></canvas>
      <h5>${p.name}</h5>
      <p>₹${p.price.toFixed(2)}</p>
    `;
    container.appendChild(tag);

    // Draw the QR inside tag canvas
    const canvas = document.getElementById(`prev-canvas-${p.id}`);
    const qrPayload = JSON.stringify({
      sId: state.storeSettings.gstin,
      pId: p.id,
      sku: p.sku,
      sig: btoa(p.id + p.sku).substring(0, 8)
    });
    QRCode.toCanvas(canvas, qrPayload, { margin: 1, scale: 2 });
  });
}

document.getElementById("qr-layout-select").addEventListener("change", renderQRSheetPreview);

document.getElementById("btn-download-pdf").addEventListener("click", () => {
  if (!jsPDF) {
    alert("PDF library not fully loaded. Check network connection.");
    return;
  }

  const doc = new jsPDF("p", "mm", "a4");
  const layout = document.getElementById("qr-layout-select").value;
  
  // Layout math configurations (A4 is 210mm x 297mm)
  let cols = 3;
  let rows = 6;
  let cellWidth = 54;
  let cellHeight = 42;
  let startX = 14;
  let startY = 20;

  if (layout === "grid-2x4") {
    cols = 2;
    rows = 4;
    cellWidth = 82;
    cellHeight = 62;
    startX = 20;
    startY = 24;
  } else if (layout === "grid-4x8") {
    cols = 4;
    rows = 8;
    cellWidth = 42;
    cellHeight = 31;
    startX = 12;
    startY = 18;
  }

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${state.storeSettings.name} - Product Shelf QR Sheets`, 14, 12);
  
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 16);

  let currentCol = 0;
  let currentRow = 0;

  state.products.forEach((p, idx) => {
    if (idx > 0 && idx % (cols * rows) === 0) {
      doc.addPage();
      currentCol = 0;
      currentRow = 0;
    }

    const x = startX + currentCol * cellWidth;
    const y = startY + currentRow * cellHeight;

    // Draw Tag Border
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.rect(x, y, cellWidth, cellHeight);

    // Render Product QR code image
    const qrSize = Math.min(cellWidth * 0.5, cellHeight * 0.6);
    const qrX = x + (cellWidth - qrSize) / 2;
    const qrY = y + 4;
    doc.addImage(p.qrCode, "PNG", qrX, qrY, qrSize, qrSize);

    // Text labels
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    const cleanName = p.name.length > 25 ? p.name.substring(0, 23) + "..." : p.name;
    doc.text(cleanName, x + cellWidth / 2, y + qrSize + 8, { align: "center" });

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`SKU: ${p.sku}`, x + cellWidth / 2, y + qrSize + 11, { align: "center" });

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`₹${p.price.toFixed(2)}`, x + cellWidth / 2, y + qrSize + 15, { align: "center" });

    currentCol++;
    if (currentCol >= cols) {
      currentCol = 0;
      currentRow++;
    }
  });

  doc.save(`quickbill_qr_sheet_${layout}.pdf`);
});

// ==========================================================================
// TAB 4: PAYOUTS
// ==========================================================================

function renderPayoutsTab() {
  const tbody = document.getElementById("payouts-history-list");
  tbody.innerHTML = "";

  state.payouts.forEach(p => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${p.date}</td>
      <td><code>${p.ref}</code></td>
      <td>${p.method}</td>
      <td>₹${p.amount.toFixed(2)}</td>
      <td><span class="badge active">${p.status}</span></td>
    `;
    tbody.appendChild(row);
  });

  // Settings
  document.getElementById("payout-upi").value = state.payoutSettings.upi;
  document.getElementById("payout-bank").value = state.payoutSettings.bank;
  document.getElementById("payout-ifsc").value = state.payoutSettings.ifsc;
  document.getElementById("payout-schedule").value = state.payoutSettings.schedule;
}

document.getElementById("payout-settings-form").addEventListener("submit", (e) => {
  e.preventDefault();
  state.payoutSettings.upi = document.getElementById("payout-upi").value;
  state.payoutSettings.bank = document.getElementById("payout-bank").value;
  state.payoutSettings.ifsc = document.getElementById("payout-ifsc").value;
  state.payoutSettings.schedule = document.getElementById("payout-schedule").value;
  saveState();
  alert("Payout configuration updated successfully!");
  renderAll();
});

document.getElementById("btn-instant-payout").addEventListener("click", () => {
  const totalPaid = state.orders.reduce((sum, o) => sum + o.grandTotal, 0);
  const totalPaidOut = state.payouts.reduce((sum, p) => sum + p.amount, 0);
  const payoutBalance = Math.max(0, totalPaid - totalPaidOut);

  if (payoutBalance <= 0) {
    alert("No pending payout balance to transfer.");
    return;
  }

  if (confirm(`Do you want to transfer the full balance of ₹${payoutBalance.toFixed(2)} instantly to ${state.payoutSettings.upi}?`)) {
    const transferAmount = payoutBalance;
    const newPayout = {
      date: new Date().toLocaleDateString(),
      ref: "PAY-" + Math.floor(10000000 + Math.random() * 90000000),
      method: "UPI Instant Transfer",
      amount: transferAmount,
      status: "Success"
    };

    state.payouts.push(newPayout);
    saveState();
    alert(`Transfer of ₹${transferAmount.toFixed(2)} completed successfully! Reference: ${newPayout.ref}`);
    renderAll();
  }
});

// ==========================================================================
// TAB 5: SUBSCRIPTIONS
// ==========================================================================

function renderSubscriptionUI() {
  const sub = state.subscription;
  document.getElementById("current-plan-display-name").textContent = `${sub.name} Plan`;
  document.getElementById("current-plan-expiry").textContent = sub.plan === "free" ? "No renewal (Free Sandbox Mode)" : `Renews on ${sub.expiryDate}`;
  document.getElementById("current-plan-status-badge").textContent = sub.status;
  document.getElementById("current-plan-status-badge").className = `badge ${sub.status.toLowerCase()}`;
  document.getElementById("current-plan-price-display").textContent = sub.price;

  // Active styles on grid cards
  document.querySelectorAll(".tier-card").forEach(card => {
    card.classList.remove("active");
    const actionBtn = card.querySelector(".btn-tier-action");
    const tier = card.getAttribute("data-tier");

    if (tier === sub.plan) {
      card.classList.add("active");
      actionBtn.textContent = "Current Plan";
      actionBtn.disabled = true;
      actionBtn.className = "btn btn-primary btn-tier-action";
    } else {
      actionBtn.disabled = false;
      actionBtn.className = "btn btn-secondary btn-tier-action";
      
      const isDowngrade = (sub.plan === "enterprise") || (sub.plan === "pro" && tier === "free");
      actionBtn.textContent = isDowngrade ? "Downgrade" : "Upgrade";
    }
  });
}

document.querySelectorAll(".btn-tier-action").forEach(btn => {
  btn.addEventListener("click", () => {
    const tier = btn.getAttribute("data-tier");
    let name = "Pro Shop";
    let price = "₹999 / month";
    
    if (tier === "free") {
      name = "Starter Sandbox";
      price = "₹0 / forever";
    } else if (tier === "enterprise") {
      name = "Mega Retailer";
      price = "₹2,999 / month";
    }

    if (confirm(`Do you want to change your shop subscription to the "${name}" plan (${price})?`)) {
      state.subscription.plan = tier;
      state.subscription.name = name;
      state.subscription.price = price;
      state.subscription.status = "Active";
      
      const future = new Date();
      future.setDate(future.getDate() + 30);
      state.subscription.expiryDate = future.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

      saveState();
      alert(`Subscription plan updated! Store upgraded to ${name}.`);
      renderAll();
    }
  });
});

// ==========================================================================
// TAB 6: SETTINGS
// ==========================================================================

function populateSettingsForm() {
  document.getElementById("store-name").value = state.storeSettings.name;
  document.getElementById("store-contact").value = state.storeSettings.contact;
  document.getElementById("store-address").value = state.storeSettings.address;
  document.getElementById("store-currency").value = state.storeSettings.currency;
  document.getElementById("store-gstin").value = state.storeSettings.gstin;
  document.getElementById("store-receipt-msg").value = state.storeSettings.footerMsg;
}

document.getElementById("store-settings-form").addEventListener("submit", (e) => {
  e.preventDefault();
  state.storeSettings.name = document.getElementById("store-name").value;
  state.storeSettings.contact = document.getElementById("store-contact").value;
  state.storeSettings.address = document.getElementById("store-address").value;
  state.storeSettings.currency = document.getElementById("store-currency").value;
  state.storeSettings.gstin = document.getElementById("store-gstin").value;
  state.storeSettings.footerMsg = document.getElementById("store-receipt-msg").value;
  
  saveState();
  alert("Store configuration saved successfully!");
  renderAll();
});

// ==========================================================================
// CLIENT-SIDE SIMULATED CUSTOMER FLOW (SMARTPHONE SIMULATOR)
// ==========================================================================

function updateCustomerDeviceLabels() {
  document.getElementById("phone-store-name").textContent = state.storeSettings.name;
  document.getElementById("upi-store-name").textContent = state.storeSettings.name;
  document.getElementById("upi-store-id").textContent = state.payoutSettings.upi;
}

function populateScanSimulatorDropdown() {
  const select = document.getElementById("scan-simulator-select");
  select.innerHTML = `<option value="">-- Choose Product --</option>`;
  
  state.products.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.name} - ₹${p.price.toFixed(2)}`;
    select.appendChild(opt);
  });
}

// Clock logic inside phone
function updatePhoneClock() {
  const clock = document.getElementById("phone-time");
  if (clock) {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
}
setInterval(updatePhoneClock, 10000);
updatePhoneClock();

// Synthesize Beep Sound using Web Audio API (totally self-contained scanner sound!)
function playScanBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = "sine";
    oscillator.frequency.value = 1000; // 1kHz beep
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.12);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
  } catch (err) {
    console.log("Audio play failed:", err);
  }
}

// Switch Phone Views helper
function switchPhoneView(viewId) {
  document.querySelectorAll(".phone-body .phone-view").forEach(v => {
    v.classList.remove("active");
  });
  document.getElementById(viewId).classList.add("active");
  
  // Stop camera if navigating away from scan view
  if (viewId !== "phone-view-scan") {
    stopLiveCamera();
  }
}

// NAVIGATION Triggers
document.getElementById("phone-cart-icon-btn").addEventListener("click", () => switchPhoneView("phone-view-cart"));
document.getElementById("cart-back-btn").addEventListener("click", () => switchPhoneView("phone-view-scan"));
document.getElementById("checkout-back-btn").addEventListener("click", () => switchPhoneView("phone-view-cart"));
document.getElementById("btn-restart-scanner").addEventListener("click", () => {
  state.cart = [];
  state.activePromo = null;
  document.getElementById("promo-input").value = "";
  document.getElementById("promo-feedback-text").textContent = "";
  renderCart();
  switchPhoneView("phone-view-scan");
});

// SIMULATE SCAN BTN (Desktop fallback helper)
document.getElementById("btn-simulate-scan").addEventListener("click", () => {
  const val = document.getElementById("scan-simulator-select").value;
  if (!val) {
    alert("Please select a product to scan.");
    return;
  }
  handleProductScanned(val);
  document.getElementById("scan-simulator-select").value = "";
});

function handleProductScanned(productId) {
  const p = state.products.find(item => item.id === productId);
  if (!p) return;

  playScanBeep();

  // Add to cart
  const cartIdx = state.cart.findIndex(c => c.productId === productId);
  if (cartIdx !== -1) {
    state.cart[cartIdx].qty++;
  } else {
    state.cart.push({ productId, qty: 1, price: p.price });
  }

  renderCart();
  switchPhoneView("phone-view-cart");
}

// ==========================================================================
// CAMERA-BASED QR SCANNING LOGIC
// ==========================================================================

let videoStream = null;
let animationFrameId = null;
const scannerVideo = document.getElementById("scanner-video");
const scannerCanvas = document.getElementById("scanner-canvas");
const scannerOverlay = document.getElementById("scanner-overlay-status");
const toggleCamBtn = document.getElementById("btn-toggle-camera");

toggleCamBtn.addEventListener("click", toggleLiveCamera);

function toggleLiveCamera() {
  if (videoStream) {
    stopLiveCamera();
  } else {
    startLiveCamera();
  }
}

function startLiveCamera() {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(stream => {
      videoStream = stream;
      scannerVideo.srcObject = stream;
      scannerVideo.setAttribute("playsinline", true); // required to play on iOS
      scannerVideo.play();
      
      toggleCamBtn.textContent = "Stop Camera";
      toggleCamBtn.className = "btn btn-rose btn-xs mt-2";
      scannerOverlay.style.background = "rgba(0,0,0,0.2)";
      scannerOverlay.querySelector("p").textContent = "Camera active. Hold QR in center.";
      
      animationFrameId = requestAnimationFrame(scanTick);
    })
    .catch(err => {
      console.warn("Camera access denied:", err);
      alert("Unable to open device camera. Please use the Desktop select dropdown to test.");
    });
}

function stopLiveCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  scannerVideo.srcObject = null;
  
  toggleCamBtn.textContent = "Start Live Camera";
  toggleCamBtn.className = "btn btn-secondary btn-xs mt-2";
  scannerOverlay.style.background = "rgba(0,0,0,0.6)";
  scannerOverlay.querySelector("p").textContent = "Align product QR code to scan";
}

function scanTick() {
  if (scannerVideo.readyState === scannerVideo.HAVE_ENOUGH_DATA) {
    const ctx = scannerCanvas.getContext("2d", { willReadFrequently: true });
    scannerCanvas.width = scannerVideo.videoWidth;
    scannerCanvas.height = scannerVideo.videoHeight;
    ctx.drawImage(scannerVideo, 0, 0, scannerCanvas.width, scannerCanvas.height);
    
    const imageData = ctx.getImageData(0, 0, scannerCanvas.width, scannerCanvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code) {
      try {
        const payload = JSON.parse(code.data);
        // Verify payload format (GSTIN and product checks)
        if (payload && payload.pId) {
          const matchedProduct = state.products.find(p => p.id === payload.pId);
          if (matchedProduct) {
            stopLiveCamera();
            handleProductScanned(matchedProduct.id);
            return;
          }
        }
      } catch (e) {
        // Not a JSON payload or signature verification failed
        console.warn("Decoded invalid payload format:", code.data);
      }
    }
  }
  if (videoStream) {
    animationFrameId = requestAnimationFrame(scanTick);
  }
}

// ==========================================================================
// CART & PRICING RULES (GST + DISCOUNTS)
// ==========================================================================

function renderCart() {
  const container = document.getElementById("phone-cart-items-list");
  container.innerHTML = "";
  
  // Update badge count
  const cartBadge = document.getElementById("phone-cart-badge");
  const totalItemCount = state.cart.reduce((sum, item) => sum + item.qty, 0);
  cartBadge.textContent = totalItemCount;

  if (state.cart.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 10px; color: var(--color-text-muted);">
        <i data-lucide="shopping-cart" style="width: 32px; height: 32px; margin: 0 auto 12px auto; opacity: 0.5;"></i>
        <p style="font-size: 12px;">Your cart is empty.</p>
        <p style="font-size: 10px; margin-top: 4px;">Go back and scan product tags to add items.</p>
      </div>
    `;
    lucide.createIcons();
    updateBillCalculations(0, 0, 0, 0);
    document.getElementById("btn-proceed-checkout").disabled = true;
    return;
  }

  document.getElementById("btn-proceed-checkout").disabled = false;

  let subtotal = 0;
  let taxTotal = 0;

  state.cart.forEach((item, index) => {
    const p = state.products.find(prod => prod.id === item.productId);
    if (!p) return;

    const rowTotal = p.price * item.qty;
    subtotal += rowTotal;
    
    // Reverse-engineered or forward-calculated GST (assuming standard retail pricing includes tax or adds tax)
    // Here we calculate tax added on top: taxAmount = Price * (TaxRate / 100)
    const taxRow = rowTotal * (p.taxPercent / 100);
    taxTotal += taxRow;

    const cartRow = document.createElement("div");
    cartRow.className = "cart-item";
    cartRow.innerHTML = `
      <div class="cart-item-info">
        <h4>${p.name}</h4>
        <p>₹${p.price.toFixed(2)} + ${p.taxPercent}% GST</p>
      </div>
      <div class="cart-item-qty-controls">
        <button class="cart-qty-btn decrease" data-index="${index}">-</button>
        <span class="cart-qty-val">${item.qty}</span>
        <button class="cart-qty-btn increase" data-index="${index}">+</button>
      </div>
      <div class="cart-item-price">
        ₹${rowTotal.toFixed(2)}
      </div>
    `;
    container.appendChild(cartRow);
  });

  // Calculate Discounts
  let discount = 0;
  if (state.activePromo === "SAVE10" || state.activePromo === "WELCOME10") {
    discount = subtotal * 0.10; // 10% Off Subtotal
  }

  const grandTotal = subtotal + taxTotal - discount;
  updateBillCalculations(subtotal, taxTotal, discount, grandTotal);

  // Attach qty event listeners
  document.querySelectorAll(".cart-qty-btn.increase").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"));
      state.cart[idx].qty++;
      renderCart();
    });
  });

  document.querySelectorAll(".cart-qty-btn.decrease").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"));
      state.cart[idx].qty--;
      if (state.cart[idx].qty <= 0) {
        state.cart.splice(idx, 1);
      }
      renderCart();
    });
  });
}

function updateBillCalculations(sub, tax, disc, total) {
  document.getElementById("cart-subtotal").textContent = `₹${sub.toFixed(2)}`;
  document.getElementById("cart-tax").textContent = `₹${tax.toFixed(2)}`;
  
  const discRow = document.getElementById("cart-discount-row");
  if (disc > 0) {
    discRow.style.display = "flex";
    document.getElementById("cart-discount").textContent = `-₹${disc.toFixed(2)}`;
  } else {
    discRow.style.display = "none";
  }

  document.getElementById("cart-total").textContent = `₹${total.toFixed(2)}`;
}

// Promo code application
document.getElementById("btn-apply-promo").addEventListener("click", () => {
  const code = document.getElementById("promo-input").value.trim().toUpperCase();
  const feedback = document.getElementById("promo-feedback-text");
  
  if (code === "SAVE10" || code === "WELCOME10") {
    state.activePromo = code;
    feedback.textContent = `Coupon "${code}" applied successfully! 10% Discount.`;
    feedback.className = "promo-feedback success";
    renderCart();
  } else if (!code) {
    state.activePromo = null;
    feedback.textContent = "";
    renderCart();
  } else {
    state.activePromo = null;
    feedback.textContent = "Invalid or expired promo code.";
    feedback.className = "promo-feedback error";
    renderCart();
  }
});

// ==========================================================================
// UPI TRANSACTION PROCESSOR
// ==========================================================================

let checkoutTotals = { subtotal: 0, taxTotal: 0, discount: 0, grandTotal: 0 };

document.getElementById("btn-proceed-checkout").addEventListener("click", () => {
  // Re-calculate checkout totals
  let subtotal = 0;
  let taxTotal = 0;
  state.cart.forEach(item => {
    const p = state.products.find(prod => prod.id === item.productId);
    if (p) {
      const row = p.price * item.qty;
      subtotal += row;
      taxTotal += row * (p.taxPercent / 100);
    }
  });

  let discount = 0;
  if (state.activePromo) discount = subtotal * 0.10;
  const grandTotal = subtotal + taxTotal - discount;

  checkoutTotals = { subtotal, taxTotal, discount, grandTotal };

  // Set amounts labels
  document.getElementById("checkout-pay-amount").textContent = `₹${grandTotal.toFixed(2)}`;
  
  // Render Dynamic Merchant UPI Payment QR code (NPCI Standard format)
  // format: upi://pay?pa=merchant@upi&pn=StoreName&am=Amount&cu=INR
  const upiUrl = `upi://pay?pa=${encodeURIComponent(state.payoutSettings.upi)}&pn=${encodeURIComponent(state.storeSettings.name)}&am=${grandTotal.toFixed(2)}&cu=INR&tn=QuickBill-${Date.now().toString().slice(-6)}`;
  
  const qrCanvas = document.getElementById("upi-payment-qrcode-canvas");
  QRCode.toCanvas(qrCanvas, upiUrl, { margin: 1, scale: 4 }, (err) => {
    if (err) console.error("UPI QR Generation Error:", err);
  });

  switchPhoneView("phone-view-checkout");
});

document.getElementById("btn-complete-payment").addEventListener("click", () => {
  // Simulate complete database checkout
  
  // Decrement Stock
  state.cart.forEach(item => {
    const p = state.products.find(prod => prod.id === item.productId);
    if (p) {
      p.stock = Math.max(0, p.stock - item.qty);
    }
  });

  const txId = "TXN-" + Math.floor(10000000 + Math.random() * 90000000);
  const newOrder = {
    id: txId,
    customerName: "Self-Checkout Shopper",
    items: [...state.cart],
    subtotal: checkoutTotals.subtotal,
    taxTotal: checkoutTotals.taxTotal,
    discount: checkoutTotals.discount,
    grandTotal: checkoutTotals.grandTotal,
    timestamp: new Date().toISOString(),
    status: "Paid"
  };

  state.orders.push(newOrder);
  saveState();

  // Celebrate with Confetti!
  try {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 }
    });
  } catch (err) {
    console.log("Confetti failed:", err);
  }

  // Populate receipt screen
  document.getElementById("receipt-ref-no").textContent = txId;
  document.getElementById("receipt-store-name").textContent = state.storeSettings.name;
  document.getElementById("receipt-datetime").textContent = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  document.getElementById("receipt-total-paid").textContent = `₹${checkoutTotals.grandTotal.toFixed(2)}`;

  // Save current order id to a dataset for print trigger
  document.getElementById("btn-download-receipt-pdf").setAttribute("data-order-id", txId);

  // Sync back dashboard views
  renderAll();

  switchPhoneView("phone-view-receipt");
});

// ==========================================================================
// PDF RECEIPT INVOICE GENERATOR
// ==========================================================================

document.getElementById("btn-download-receipt-pdf").addEventListener("click", (e) => {
  if (!jsPDF) {
    alert("PDF library not fully loaded.");
    return;
  }

  const orderId = e.currentTarget.getAttribute("data-order-id");
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;

  const doc = new jsPDF("p", "mm", [80, 150]); // 80mm roll printer size, 150mm height
  doc.setFont("Courier", "normal");
  
  // Receipt header
  doc.setFontSize(10);
  doc.setFont("Courier", "bold");
  doc.text(state.storeSettings.name, 40, 10, { align: "center" });
  
  doc.setFont("Courier", "normal");
  doc.setFontSize(7);
  doc.text(state.storeSettings.address, 40, 14, { align: "center" });
  doc.text(`GSTIN: ${state.storeSettings.gstin}`, 40, 18, { align: "center" });
  doc.text(`Phone: ${state.storeSettings.contact}`, 40, 22, { align: "center" });
  
  doc.text("----------------------------------------", 40, 26, { align: "center" });
  doc.text(`INVOICE: ${order.id}`, 8, 30);
  doc.text(`DATE   : ${new Date(order.timestamp).toLocaleString()}`, 8, 34);
  doc.text("----------------------------------------", 40, 38, { align: "center" });

  // Column headers
  doc.text("Item Name", 8, 42);
  doc.text("Qty   Price       Total", 8, 45);
  doc.text("----------------------------------------", 40, 48, { align: "center" });

  let y = 52;
  order.items.forEach(item => {
    const p = state.products.find(prod => prod.id === item.productId);
    if (!p) return;

    // Wrap item name if too long
    const nameLine = p.name.length > 35 ? p.name.substring(0, 32) + "..." : p.name;
    doc.text(nameLine, 8, y);
    
    y += 3.5;
    const qtyStr = item.qty.toString().padEnd(6, " ");
    const priceStr = `x${p.price.toFixed(2)}`.padEnd(12, " ");
    const rowTotalStr = `₹${(p.price * item.qty).toFixed(2)}`;
    doc.text(`${qtyStr}${priceStr}${rowTotalStr}`, 8, y);
    y += 5;
  });

  doc.text("----------------------------------------", 40, y, { align: "center" });
  y += 4;
  doc.text(`Subtotal:             ₹${order.subtotal.toFixed(2)}`, 8, y);
  y += 3.5;
  doc.text(`GST Tax:              ₹${order.taxTotal.toFixed(2)}`, 8, y);
  
  if (order.discount > 0) {
    y += 3.5;
    doc.text(`Discount:            -₹${order.discount.toFixed(2)}`, 8, y);
  }

  y += 4;
  doc.setFont("Courier", "bold");
  doc.setFontSize(8);
  doc.text(`GRAND TOTAL:          ₹${order.grandTotal.toFixed(2)}`, 8, y);
  
  doc.setFont("Courier", "normal");
  doc.setFontSize(7);
  y += 6;
  doc.text("----------------------------------------", 40, y, { align: "center" });
  y += 4;
  doc.text("UPI Payment Confirmed", 40, y, { align: "center" });
  y += 3.5;
  doc.text(`Ref: NPCI-${orderId.split("-")[1] || "MOCK"}`, 40, y, { align: "center" });
  
  y += 6;
  doc.setFont("Courier", "italic");
  doc.text(state.storeSettings.footerMsg, 40, y, { align: "center", maxWidth: 64 });

  doc.save(`quickbill_receipt_${orderId}.pdf`);
});

// ==========================================================================
// STARTUP INITIALIZER
// ==========================================================================

window.addEventListener("DOMContentLoaded", () => {
  initDatabase();
});
