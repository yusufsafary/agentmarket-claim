// Agent Market claim page v4: live countdown for the presale claim, the
// EARLY holder claim on its own contract (AgentMarketClaim, open now, fixed
// 0.000241 BNB fee forwarded to the project wallet), the presale claim
// buttons, calculator slider, and the read-only checker for other wallets.
const { ethCall, asUint, asBool, padAddr, fmt, toast, friendlyError } = window.AMW;

const STALL = "0xE3dE7fD0d12cFF4a46d8Bf702Ab593B6f921b308";
const PRESALE = "0xA6Ef01e926eFbD35661e7B1d3E1CBeE360750b16";
const HOLDER_CLAIM = "0xf40c9345D8EccA7B437c45e5DabADb0Ed8cdd209"; // AgentMarketClaim (early holder claim)
const PER_STALL = 25000n;
const HOLDER_FEE_FALLBACK = 240545538036624n; // dibaca ulang dari kontrak (claimFee)

const SEL = {
  balanceOf: "0x70a08231", startTime: "0x78e97925", endTime: "0x3197cbb6",
  bought: "0x667022fd", claimable: "0x402914f5",
  presaleClaimed: "0xf9765bc1", holderClaimed: "0xdd6f5c53",
  hClaim: "0x4e71d92d", hClaimOpen: "0x4b8bcb58", hClaimed: "0xc884ef83",
  hClaimableFor: "0xee8ad528", hClaimFee: "0x99d32fc4",
};
const $ = (id) => document.getElementById(id);
const set = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
const tok = (wei) => fmt(wei / 10n ** 18n);

const s = {
  started: false, ended: false, endTime: 0,
  stalls: null, boughtW: 0n, claimableW: 0n, pc: false, hc: false,
  hOpen: false, hClaimed: false, hClaimable: 0n, hFee: HOLDER_FEE_FALLBACK,
  busyP: false, busyH: false,
};

// ---- Status + countdown ------------------------------------------------------
function tick() {
  if (!s.started) { set("cl-countdown", "Presale not started"); return; }
  const left = s.endTime - Math.floor(Date.now() / 1000);
  if (left <= 0) { set("cl-status", "OPEN"); set("cl-countdown", "Claims are open"); return; }
  const dd = Math.floor(left / 86400), hh = Math.floor((left % 86400) / 3600), mm = Math.floor((left % 3600) / 60), ss = left % 60;
  set("cl-countdown", `${dd}d ${String(hh).padStart(2, "0")}h ${String(mm).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`);
}

async function refreshStatus() {
  try {
    const [start, end] = await Promise.all([
      ethCall(PRESALE, SEL.startTime).then(asUint),
      ethCall(PRESALE, SEL.endTime).then(asUint),
    ]);
    if (start === 0n) {
      s.started = false; s.ended = false;
      set("cl-status", "NOT OPEN YET");
      set("cl-countdown", "Presale not started");
    } else {
      s.started = true;
      s.endTime = Number(end);
      s.ended = Math.floor(Date.now() / 1000) >= s.endTime;
      set("cl-status", s.ended ? "OPEN" : "OPENS AT PRESALE END");
      tick();
    }
  } catch {}
  renderClaims();
}

// ---- Connected wallet allocation ---------------------------------------------
async function refreshAlloc() {
  const st = window.AMW.state;
  if (!st.address) { s.stalls = null; renderClaims(); return; }
  try {
    const pa = padAddr(st.address);
    const [stalls, bought, claimable, pc, hc] = await Promise.all([
      ethCall(STALL, SEL.balanceOf + pa).then(asUint),
      ethCall(PRESALE, SEL.bought + pa).then(asUint),
      ethCall(PRESALE, SEL.claimable + pa).then(asUint),
      ethCall(PRESALE, SEL.presaleClaimed + pa).then(asBool),
      ethCall(PRESALE, SEL.holderClaimed + pa).then(asBool),
    ]);
    s.stalls = stalls; s.boughtW = bought; s.claimableW = claimable; s.pc = pc; s.hc = hc;
  } catch {}
  renderClaims();
}

// ---- Early holder claim (AgentMarketClaim) -------------------------------------
async function refreshHolder() {
  try {
    const [open, fee] = await Promise.all([
      ethCall(HOLDER_CLAIM, SEL.hClaimOpen).then(asBool),
      ethCall(HOLDER_CLAIM, SEL.hClaimFee).then(asUint),
    ]);
    s.hOpen = open;
    if (fee > 0n) s.hFee = fee;
  } catch {}
  const st = window.AMW.state;
  if (st.address) {
    try {
      const pa = padAddr(st.address);
      const [hcd, hcf] = await Promise.all([
        ethCall(HOLDER_CLAIM, SEL.hClaimed + pa).then(asBool),
        ethCall(HOLDER_CLAIM, SEL.hClaimableFor + pa).then(asUint),
      ]);
      s.hClaimed = hcd; s.hClaimable = hcf;
    } catch {}
  } else {
    s.hClaimed = false; s.hClaimable = 0n;
  }
  renderClaims();
}

function renderClaims() {
  const st = window.AMW.state;
  set("held", s.stalls == null ? "–" : String(s.stalls));
  const dotsN = s.stalls == null ? 0 : Math.min(Number(s.stalls), 25);
  $("dots").innerHTML = s.stalls == null ? "" :
    Array.from({ length: dotsN }, () => "<i></i>").join("") +
    (s.stalls > 25n ? `<span>+${s.stalls - 25n}</span>` : "");
  set("r-holder", tok(s.hClaimable) + " AMKT");
  set("r-bought", tok(s.boughtW) + " AMKT");
  set("alloc", tok(s.hClaimable + s.claimableW) + " AMKT");
  const chip = $("clState");
  chip.textContent = s.hOpen ? "Holder claim is open now" : (s.ended ? "Claim is open" : "Not open yet");
  chip.classList.toggle("open", s.hOpen || s.ended);

  renderClaimBtn($("claimPresaleBtn"), "presale");
  renderClaimBtn($("claimHolderBtn"), "holder");

  const note = $("clNote");
  if (!st.connected) note.textContent = "Connect to see how many Stalls this wallet holds.";
  else if (s.hOpen && !s.ended) note.textContent = "The holder claim is open now on its own contract and carries a fixed 0.000241 BNB fee, forwarded to the project wallet in the same transaction. Presale claims open when the presale ends. Gas is paid in BNB.";
  else if (!s.ended) note.textContent = "Claim on BNB Chain. Gas is paid in BNB. Claims open when the presale ends.";
  else if (s.stalls != null && s.stalls === 0n && s.boughtW === 0n) note.textContent = "Nothing to claim in this wallet. Mint a Stall or join the presale first.";
  else note.textContent = "Claim on BNB Chain. Gas is paid in BNB.";
}

function renderClaimBtn(btn, kind) {
  const st = window.AMW.state;
  const isP = kind === "presale";
  const busy = isP ? s.busyP : s.busyH;
  // Presale claim: presale contract, opens at endTime, no fee.
  // Holder claim: AgentMarketClaim contract, open NOW, fixed 0.000241 BNB fee.
  const amount = isP ? s.boughtW : s.hClaimable;
  const used = isP ? s.pc : s.hClaimed;
  const label = isP ? "presale" : "holder";
  if (!st.connected) { btn.disabled = false; btn.textContent = "Connect wallet"; btn.dataset.act = "connect"; return; }
  if (st.chainId !== 56) { btn.disabled = false; btn.textContent = "Switch to BNB Chain"; btn.dataset.act = "switch"; return; }
  if (busy) { btn.disabled = true; btn.textContent = "Confirm in your wallet…"; btn.dataset.act = ""; return; }
  if (isP && !s.ended) { btn.disabled = true; btn.textContent = "Claim opens after the presale"; btn.dataset.act = ""; return; }
  if (!isP && !s.hOpen) { btn.disabled = true; btn.textContent = "Holder claim not open yet"; btn.dataset.act = ""; return; }
  if (used) { btn.disabled = true; btn.textContent = "Claimed"; btn.dataset.act = ""; return; }
  if (amount === 0n) {
    btn.disabled = true;
    btn.textContent = isP ? "No presale purchase" : "No Stalls in this wallet";
    btn.dataset.act = "";
    return;
  }
  btn.disabled = false;
  btn.textContent = `Claim ${tok(amount)} AMKT (${label})`;
  btn.dataset.act = "claim";
}

async function claimClick(kind) {
  const btn = kind === "presale" ? $("claimPresaleBtn") : $("claimHolderBtn");
  const act = btn.dataset.act;
  if (act === "connect") return window.AMW.connect();
  if (act === "switch") {
    try { await window.AMW.ensureBsc(); } catch { toast("Switch to BNB Chain in your wallet."); }
    return;
  }
  if (act !== "claim") return;
  if (kind === "presale") s.busyP = true; else s.busyH = true;
  renderClaims();
  try {
    const hash = await window.AMW.sendTx(kind === "presale"
      ? { to: PRESALE, data: "0x046ef9a5", value: 0n }
      : { to: HOLDER_CLAIM, data: SEL.hClaim, value: s.hFee });
    const line = $("txline");
    line.hidden = false;
    line.innerHTML = `Transaction: <a href="https://bscscan.com/tx/${hash}" target="_blank" rel="noopener">${hash}</a>`;
    toast("Claimed. $AMKT is in your wallet.");
  } catch (e) {
    toast(friendlyError(e));
  }
  if (kind === "presale") s.busyP = false; else s.busyH = false;
  await Promise.all([refreshStatus(), refreshAlloc(), refreshHolder()]);
}
$("claimPresaleBtn").addEventListener("click", () => claimClick("presale"));
$("claimHolderBtn").addEventListener("click", () => claimClick("holder"));

// ---- Calculator slider ----------------------------------------------------------
const calcR = $("calcR");
function renderCalc() {
  set("calcN", calcR.value);
  set("calcV", fmt(BigInt(calcR.value) * PER_STALL));
  calcR.style.setProperty("--p", (Number(calcR.value) / 25) * 100 + "%");
}
calcR.addEventListener("input", renderCalc);
renderCalc();

// ---- Checker for other wallets -----------------------------------------------------
async function checkWallet() {
  const input = $("wallet-input");
  const note = $("check-note");
  const addr = (input.value || "").trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) { note.textContent = "That does not look like a wallet address."; return; }
  note.textContent = "Reading the chain…";
  try {
    const a = padAddr(addr);
    const [stalls, bought, claimable, pc, hc, hOpen2] = await Promise.all([
      ethCall(STALL, SEL.balanceOf + a).then(asUint),
      ethCall(PRESALE, SEL.bought + a).then(asUint),
      ethCall(PRESALE, SEL.claimable + a).then(asUint),
      ethCall(PRESALE, SEL.presaleClaimed + a).then(asBool),
      ethCall(HOLDER_CLAIM, SEL.hClaimed + a).then(asBool),
      ethCall(HOLDER_CLAIM, SEL.hClaimableFor + a).then(asUint),
    ]);
    $("check-rows").hidden = false;
    set("r-stalls", fmt(stalls));
    set("r-holder2", tok(hOpen2) + " AMKT");
    set("r-bought2", tok(bought) + " AMKT");
    set("r-claimable", tok(hOpen2 + claimable) + " AMKT");
    set("r-pc", pc ? "Yes" : "No");
    set("r-hc", hc ? "Yes" : "No");
    note.textContent = "";
  } catch {
    note.textContent = "The chain did not answer. Try again in a moment.";
  }
}
$("check-btn").addEventListener("click", checkWallet);

// ---- Copy prompt ----------------------------------------------------------------------
document.querySelectorAll(".copy-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const src = $(btn.dataset.copy);
    if (!src) return;
    try { await navigator.clipboard.writeText(src.textContent.trim()); btn.textContent = "Copied"; }
    catch { btn.textContent = "Select and copy"; }
    setTimeout(() => (btn.textContent = "Copy prompt"), 1800);
  });
});

// ---- Wallet wiring + boot -----------------------------------------------------------------
let lastAddr = undefined;
window.AMW.onWallet(async (st) => {
  if (st.address !== lastAddr) {
    lastAddr = st.address;
    s.stalls = null;
    await Promise.all([refreshAlloc(), refreshHolder()]);
  } else {
    renderClaims();
  }
});
window.AMW.mountButton($("wallet-slot"));
refreshStatus();
refreshAlloc();
refreshHolder();
setInterval(() => { if (!document.hidden) { refreshStatus(); refreshAlloc(); refreshHolder(); } }, 20000);
setInterval(tick, 1000);
