/*
BITE TRACKER
- Camera only: no file picker
- Qwen image analysis through Render backend
- Demo Sign Up / Log In using localStorage
- Automatic tracker saving
- Bite Coins
- Bite Coin Shop
- Certificate after collecting every shop item

IMPORTANT:
After you deploy the backend on Render, replace the URL below.
Example:
const BACKEND_URL = "https://bite-tracker-api.onrender.com";
*/


const SHOP_ITEMS = [
  { id: "apple", name: "Apple", emoji: "🍎", price: 5 },
  { id: "banana", name: "Banana", emoji: "🍌", price: 10 },
  { id: "grapes", name: "Grapes", emoji: "🍇", price: 25 },
  { id: "strawberry", name: "Strawberries", emoji: "🍓", price: 50 },
  { id: "blueberries", name: "Blueberries", emoji: "🫐", price: 75 },
  { id: "blackberries", name: "Blackberries", emoji: "🫐", price: 100 },
  { id: "pineapple", name: "Pineapple", emoji: "🍍", price: 200 },
  { id: "orange", name: "Orange", emoji: "🍊", price: 500 },
  { id: "muskmelon", name: "Muskmelon", emoji: "🍈", price: 600 },
  { id: "pumpkin", name: "Pumpkin", emoji: "🎃", price: 800 },
  { id: "watermelon", name: "Watermelon", emoji: "🍉", price: 1000 }
];

const camera = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const preview = document.getElementById("preview");
const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const openCameraBtn = document.getElementById("openCameraBtn");
const captureBtn = document.getElementById("captureBtn");
const analyzeBtn = document.getElementById("analyzeBtn");
const analyzeText = document.getElementById("analyzeText");
const spinner = document.getElementById("spinner");
const statusEl = document.getElementById("status");
const emptyResult = document.getElementById("emptyResult");
const resultContent = document.getElementById("resultContent");
const categoryEl = document.getElementById("category");
const foodNameEl = document.getElementById("foodName");
const ratingEl = document.getElementById("rating");
const starsEl = document.getElementById("stars");
const reasonEl = document.getElementById("reason");
const tipEl = document.getElementById("tip");
const rewardBox = document.getElementById("rewardBox");
const savedMessage = document.getElementById("savedMessage");
const historyEl = document.getElementById("history");
const emptyHistory = document.getElementById("emptyHistory");
const averageScore = document.getElementById("averageScore");
const coinCount = document.getElementById("coinCount");
const shopGrid = document.getElementById("shopGrid");
const shopMessage = document.getElementById("shopMessage");
const collectionCount = document.getElementById("collectionCount");
const collectionTotal = document.getElementById("collectionTotal");
const certificateSection = document.getElementById("certificateSection");
const certificateName = document.getElementById("certificateName");
const printCertificateBtn = document.getElementById("printCertificateBtn");
const authButtons = document.getElementById("authButtons");
const userArea = document.getElementById("userArea");
const userName = document.getElementById("userName");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authModal = document.getElementById("authModal");
const closeAuthBtn = document.getElementById("closeAuthBtn");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const nameGroup = document.getElementById("nameGroup");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authMessage = document.getElementById("authMessage");

let cameraStream = null;
let selectedFile = null;
let currentResult = null;
let authMode = "login";

function safeJsonParse(value, fallback) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  try {

    const parsed = JSON.parse(value);

    if (
      parsed === null ||
      parsed === undefined
    ) {
      return fallback;
    }

    return parsed;

  }

  catch (error) {

    console.error(
      "JSON read error:",
      error
    );

    return fallback;

  }

}

function getCurrentUser() {
  return safeJsonParse(localStorage.getItem("biteTrackerCurrentUser"), null);
}

function getAccounts() {
  const newAccounts = safeJsonParse(localStorage.getItem("biteTrackerAccounts"), null);
  if (Array.isArray(newAccounts)) return newAccounts;

  const oldAccount = safeJsonParse(localStorage.getItem("biteTrackerAccount"), null);
  if (oldAccount && oldAccount.email) {
    const migrated = [oldAccount];
    localStorage.setItem("biteTrackerAccounts", JSON.stringify(migrated));
    return migrated;
  }

  return [];
}

function setAccounts(accounts) {
  localStorage.setItem("biteTrackerAccounts", JSON.stringify(accounts));
}

function userKey(suffix) {
  const user = getCurrentUser();
  return user ? `biteTracker_${user.email}_${suffix}` : `biteTracker_guest_${suffix}`;
}

function getEntries() {

  const entries =
    safeJsonParse(
      localStorage.getItem(
        userKey("entries")
      ),
      []
    );

  return Array.isArray(entries)
    ? entries
    : [];

}

function setEntries(entries) {
  localStorage.setItem(userKey("entries"), JSON.stringify(entries));
}

function getCoins() {
  return Number(localStorage.getItem(userKey("coins")) || 0);
}

function setCoins(value) {
  localStorage.setItem(userKey("coins"), String(Math.max(0, value)));
}

function getInventory() {

  const inventory =
    safeJsonParse(
      localStorage.getItem(
        userKey("inventory")
      ),
      {}
    );

  return (
    inventory &&
    typeof inventory === "object" &&
    !Array.isArray(inventory)
  )
    ? inventory
    : {};

}

function setInventory(inventory) {
  localStorage.setItem(userKey("inventory"), JSON.stringify(inventory));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function coinsForRating(rating) {
  const score = Math.round(Number(rating) || 0);
  if (score >= 5) return 3;
  if (score === 4) return 2;
  if (score === 3) return 1;
  return 0;
}

function clearAuthFields() {
  authName.value = "";
  authEmail.value = "";
  authPassword.value = "";
  authMessage.textContent = "";
}

function openAuth(mode) {
  authMode = mode;
  clearAuthFields();

  if (mode === "signup") {
    authTitle.textContent = "Create Account";
    authSubtitle.textContent = "Sign up to start earning Bite Coins.";
    nameGroup.hidden = false;
    authSubmitBtn.textContent = "Sign Up";
    authPassword.autocomplete = "new-password";
  } else {
    authTitle.textContent = "Log In";
    authSubtitle.textContent = "Welcome back to Bite Tracker.";
    nameGroup.hidden = true;
    authSubmitBtn.textContent = "Log In";
    authPassword.autocomplete = "current-password";
  }

  authModal.hidden = false;
}

function closeAuth() {
  authModal.hidden = true;
  authMessage.textContent = "";
}

signupBtn.addEventListener("click", () => openAuth("signup"));
loginBtn.addEventListener("click", () => openAuth("login"));
closeAuthBtn.addEventListener("click", closeAuth);

authModal.addEventListener("click", event => {
  if (event.target === authModal) closeAuth();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeAuth();
});

authSubmitBtn.addEventListener("click", () => {
  const email = authEmail.value.trim().toLowerCase();
  const password = authPassword.value;

  if (!email || !password) {
    authMessage.textContent = "Please enter your email and password.";
    return;
  }

  if (!email.includes("@")) {
    authMessage.textContent = "Please enter a valid email.";
    return;
  }

  if (password.length < 4) {
    authMessage.textContent = "Password must be at least 4 characters.";
    return;
  }

  const accounts = getAccounts();

  if (authMode === "signup") {
    const name = authName.value.trim();
    if (!name) {
      authMessage.textContent = "Please enter your name.";
      return;
    }

    if (accounts.some(account => account.email.toLowerCase() === email)) {
      authMessage.textContent = "This email is already registered. Please log in.";
      return;
    }

    const account = { name, email, password };
    accounts.push(account);
    setAccounts(accounts);
    loginUser(account);
    return;
  }

  const account = accounts.find(
    item => item.email.toLowerCase() === email && item.password === password
  );

  if (!account) {
    authMessage.textContent = "Incorrect email or password.";
    return;
  }

  loginUser(account);
});

function loginUser(account) {
  localStorage.setItem(
    "biteTrackerCurrentUser",
    JSON.stringify({ name: account.name, email: account.email })
  );
  closeAuth();
  refreshUserInterface();
}

logoutBtn.addEventListener("click", () => {
  stopCamera();
  localStorage.removeItem("biteTrackerCurrentUser");
  selectedFile = null;
  currentResult = null;
  preview.hidden = true;
  camera.hidden = true;
  cameraPlaceholder.hidden = false;
  resultContent.hidden = true;
  emptyResult.hidden = false;
  analyzeBtn.disabled = true;
  openCameraBtn.textContent = "📷 Open Camera";
  refreshUserInterface();
});

function requireLogin(message = "Please log in or sign up first.") {
  if (getCurrentUser()) return true;
  statusEl.textContent = message;
  openAuth("login");
  return false;
}

openCameraBtn.addEventListener("click", async () => {
  if (!requireLogin()) return;
  statusEl.textContent = "";

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusEl.textContent = "Camera is not supported. Use HTTPS or localhost.";
    return;
  }

  try {

    stopCamera();

    cameraStream = await navigator.mediaDevices.getUserMedia({

      video: {

        facingMode: {
          exact: "environment"
      },

        width: {
          ideal: 1280
      },

        height: {
         ideal: 720
      }

    },

      audio: false

  });


    camera.srcObject = cameraStream;
    await camera.play();
    camera.hidden = false;
    preview.hidden = true;
    cameraPlaceholder.hidden = true;
    openCameraBtn.hidden = true;
    captureBtn.hidden = false;
    analyzeBtn.disabled = true;
    selectedFile = null;
    currentResult = null;
    savedMessage.hidden = true;
  } catch (error) {
    console.error(error);
    if (error.name === "NotAllowedError") {
      statusEl.textContent = "Camera permission was blocked. Please allow camera access.";
    } else if (error.name === "NotFoundError") {
      statusEl.textContent = "No camera was found on this device.";
    } else {
      statusEl.textContent = "Could not open the camera.";
    }
  }
});

captureBtn.addEventListener("click", () => {
  if (!camera.videoWidth || !camera.videoHeight) {
    statusEl.textContent = "Camera is still loading. Try again.";
    return;
  }

  canvas.width = camera.videoWidth;
  canvas.height = camera.videoHeight;
  const context = canvas.getContext("2d");
  context.drawImage(camera, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(blob => {
    if (!blob) {
      statusEl.textContent = "Could not take the photo.";
      return;
    }

    selectedFile = new File([blob], "bite-photo.jpg", { type: "image/jpeg" });
    preview.src = URL.createObjectURL(blob);
    preview.hidden = false;
    camera.hidden = true;
    stopCamera();
    captureBtn.hidden = true;
    openCameraBtn.hidden = false;
    openCameraBtn.textContent = "📷 Retake Photo";
    analyzeBtn.disabled = false;
    statusEl.textContent = "";
  }, "image/jpeg", 0.88);
});

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  camera.srcObject = null;
}

analyzeBtn.addEventListener("click", async () => {
  if (!requireLogin()) return;
  if (!selectedFile) {
    statusEl.textContent = "Take a food photo first.";
    return;
  }

  analyzeBtn.disabled = true;
  openCameraBtn.disabled = true;
  analyzeText.textContent = "Qwen is checking...";
  spinner.hidden = false;
  statusEl.textContent = "";
  savedMessage.hidden = true;

  const formData = new FormData();
  formData.append("image", selectedFile);

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("The backend returned an invalid response.");
    }

    if (!response.ok) {
      let message = data.error || "Could not analyze the food.";
      if (data.details) {
        if (typeof data.details === "string") message += " " + data.details;
        else if (data.details.message) message += " " + data.details.message;
      }
      throw new Error(message);
    }

    currentResult = data;
    showResult(data);
    saveAnalyzedMeal(data);
  } catch (error) {
    console.error(error);
    statusEl.textContent = error.message || "Something went wrong.";
  } finally {
    analyzeBtn.disabled = false;
    openCameraBtn.disabled = false;
    analyzeText.textContent = "Analyze Again";
    spinner.hidden = true;
  }
});

function showResult(data) {
  emptyResult.hidden = true;
  resultContent.hidden = false;

  const score = Math.max(1, Math.min(5, Math.round(Number(data.rating) || 3)));
  const earnedCoins = coinsForRating(score);

  categoryEl.textContent = data.category || "Other";
  foodNameEl.textContent = data.food || "Food";
  ratingEl.textContent = score;
  starsEl.textContent = "★".repeat(score) + "☆".repeat(5 - score);
  reasonEl.textContent = data.reason || "General estimate from the visible food.";
  tipEl.textContent = data.tip || "Try to make your meal balanced.";

  rewardBox.textContent = earnedCoins > 0
    ? `🪙 Great bite! You earned ${earnedCoins} Bite Coin${earnedCoins === 1 ? "" : "s"}.`
    : "Keep improving! Scores of 3/5 or higher earn Bite Coins.";

  savedMessage.hidden = false;
}

function saveAnalyzedMeal(data) {
  const score = Math.max(1, Math.min(5, Math.round(Number(data.rating) || 3)));
  const earnedCoins = coinsForRating(score);

  // Add Bite Coins first so the reward is never lost if image history storage fills up.
  const newTotal = getCoins() + earnedCoins;
  setCoins(newTotal);
  coinCount.textContent = newTotal;

  try {
    const entries = getEntries();
    entries.unshift({
      id: Date.now(),
      food: data.food || "Food",
      category: data.category || "Other",
      rating: score,
      coins: earnedCoins,
      time: new Date().toISOString(),
      thumb: createThumbnail()
    });
    setEntries(entries.slice(0, 30));
  } catch (error) {
    console.error("History save error:", error);
  }

  renderEverything();
}

function createThumbnail() {
  if (!canvas.width || !canvas.height) return "";
  const thumb = document.createElement("canvas");
  const maxWidth = 160;
  const ratio = canvas.height / canvas.width;
  thumb.width = maxWidth;
  thumb.height = Math.round(maxWidth * ratio);
  thumb.getContext("2d").drawImage(canvas, 0, 0, thumb.width, thumb.height);
  return thumb.toDataURL("image/jpeg", 0.6);
}

function renderHistory() {
  const user = getCurrentUser();
  const entries = getEntries();
  historyEl.innerHTML = "";

  if (!user) {
    emptyHistory.style.display = "block";
    emptyHistory.textContent = "Log in or sign up to start tracking meals.";
    averageScore.textContent = "—";
    return;
  }

  if (!entries.length) {
    emptyHistory.style.display = "block";
    emptyHistory.textContent = "No bites tracked yet. Take your first food photo.";
    averageScore.textContent = "—";
    return;
  }

  emptyHistory.style.display = "none";
  const average = entries.reduce((sum, item) => sum + Number(item.rating || 0), 0) / entries.length;
  averageScore.textContent = average.toFixed(1) + "/5";

  entries.forEach(item => {
    const row = document.createElement("div");
    row.className = "history-row";
    const time = new Date(item.time).toLocaleString([], {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });

    row.innerHTML = `
      ${item.thumb
        ? `<img class="thumb" src="${item.thumb}" alt="Food">`
        : `<div class="thumb" style="display:grid;place-items:center;font-size:24px">🍽️</div>`}
      <div>
        <div class="history-name">${escapeHtml(item.food)}</div>
        <div class="history-meta">${escapeHtml(item.category)} · ${escapeHtml(time)} · +${Number(item.coins || 0)} coin${Number(item.coins || 0) === 1 ? "" : "s"}</div>
      </div>
      <div class="history-score">${Number(item.rating)}/5</div>
      <button class="delete-btn" type="button" aria-label="Delete">✕</button>
    `;

    row.querySelector(".delete-btn").addEventListener("click", () => {
      setEntries(getEntries().filter(entry => entry.id !== item.id));
      renderHistory();
    });

    historyEl.appendChild(row);
  });
}

function renderShop() {
  const user = getCurrentUser();
  const coins = getCoins();
  const inventory = getInventory();

  coinCount.textContent = user ? coins : 0;
  shopGrid.innerHTML = "";

  SHOP_ITEMS.forEach(item => {
    const owned = Boolean(inventory[item.id]);
    const canAfford = coins >= item.price;
    const card = document.createElement("div");
    card.className = `shop-item${owned ? " owned" : ""}`;
    card.innerHTML = `
      <div class="fruit-emoji">${item.emoji}</div>
      <h3>${escapeHtml(item.name)}</h3>
      <div class="price">🪙 ${item.price} Bite Coins</div>
      <button class="buy-btn" type="button" ${!user || owned || !canAfford ? "disabled" : ""}>
        ${owned ? "✓ Collected" : !user ? "Log in first" : canAfford ? "Buy" : "Need more coins"}
      </button>
    `;

    const button = card.querySelector(".buy-btn");
    if (user && !owned && canAfford) {
      button.addEventListener("click", () => purchaseItem(item));
    }
    shopGrid.appendChild(card);
  });

  const ownedCount = SHOP_ITEMS.filter(item => inventory[item.id]).length;
  collectionCount.textContent = ownedCount;
  collectionTotal.textContent = SHOP_ITEMS.length;
  renderCertificate();
}

function purchaseItem(item) {
  if (!requireLogin()) return;

  const coins = getCoins();
  const inventory = getInventory();

  if (inventory[item.id]) {
    shopMessage.textContent = `You already collected ${item.name}.`;
    return;
  }

  if (coins < item.price) {
    shopMessage.textContent = `You need ${item.price - coins} more Bite Coins for ${item.name}.`;
    return;
  }

  setCoins(coins - item.price);
  inventory[item.id] = true;
  setInventory(inventory);
  shopMessage.textContent = `🎉 You collected ${item.emoji} ${item.name}!`;
  renderShop();

  setTimeout(() => { shopMessage.textContent = ""; }, 2500);
}

function renderCertificate() {
  const user = getCurrentUser();
  if (!user) {
    certificateSection.hidden = true;
    return;
  }

  const inventory = getInventory();
  const complete = SHOP_ITEMS.every(item => inventory[item.id]);
  certificateSection.hidden = !complete;
  if (complete) certificateName.textContent = user.name;
}

printCertificateBtn.addEventListener("click", () => window.print());

function refreshUserInterface() {
  const user = getCurrentUser();

  if (user) {
    authButtons.hidden = true;
    userArea.hidden = false;
    userName.textContent = user.name;
  } else {
    authButtons.hidden = false;
    userArea.hidden = true;
  }

  renderEverything();
}

function renderEverything() {
  renderHistory();
  renderShop();
}

window.addEventListener("beforeunload", stopCamera);
refreshUserInterface();
