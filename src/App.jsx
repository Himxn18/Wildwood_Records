import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useContext, useMemo, createContext, memo } from "react";
import myLogo from "./assets/logo.png";
import {
  Sun,Moon,Mail,Phone,Check,ChevronDown,AlertCircle,Apple,Cloud,HeartHandshake,CreditCard,ShieldCheck,Tent,Droplets,HeartPulse,Play,Pause,Menu,X,ArrowRight,ArrowLeft,ArrowUpRight,Disc3,Calendar,MapPin,Ticket,Music2,UploadCloud,Send,Headphones,Mic,Radio,Music,ChevronUp,ListMusic,Search,BadgeCheck,Crown,Sparkles,Users,
  PenTool,SlidersHorizontal,Video,Film,Palette,Image,Globe,Share2,Megaphone,RotateCw,FileText,
  QrCode,Copy,Download,Lock,LogOut,Trash2,FileDown,Filter,ClipboardCheck,BadgeX,Landmark,Loader2
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
/* ============================================================================
   LOCAL DATA LAYER — 100% frontend, no backend.
   ----------------------------------------------------------------------------
   This replaces the old fetch()/BASE_URL API module. Every function below
   keeps the EXACT same name and return shape the rest of the app already
   calls (getSettings, adminLogin, etc.), so not a
   single line of the Relief page, donation form, stats widgets, or admin
   dashboard below had to change — only where the data comes from did.

   Storage: everything lives in localStorage as plain JSON. No fetch, no
   axios, no .env, no server. Payment screenshots are read via FileReader
   and stored as base64 data URLs, so they survive a refresh too.

   ADMIN LOGIN (local-only, not real auth — there is no server to protect):
     email:    admin@wildwoodrecords.com
     password: reliefadmin2026
   Change these via RELIEF_ADMIN_EMAIL / RELIEF_ADMIN_PASSWORD below, or by
   editing the "relief-admin-credentials" key directly in DevTools → Application → Local Storage.
   ============================================================================ */

const LS_DONATIONS = "relief-donations";
const LS_SETTINGS = "relief-settings";
const LS_CREDENTIALS = "relief-admin-credentials";
const ADMIN_TOKEN_KEY = "relief-admin-token";

const RELIEF_ADMIN_EMAIL_DEFAULT = "admin@wildwoodrecords.com";
const RELIEF_ADMIN_PASSWORD_DEFAULT = "reliefadmin2026";

const DEFAULT_SETTINGS = {
  upiId: "shabnamchoudhuryofficial@ybl",
  accountHolderName: "Wildwood Records",
  campaignDescription: "...",
  campaignGoal: 500000,
  qrCodeUrl: "/upi-qr.png", // <--- Points to the file in your public folder
};

/* ---- tiny safe-storage helpers (never let a full/blocked localStorage
   crash the UI — every read/write is wrapped) ---- */
function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    /* most likely QuotaExceededError (storage full, or a huge screenshot) */
    throw new Error("Local storage is full or unavailable — try a smaller screenshot, or clear some space.");
  }
}

function uid() {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readDonations() {
  return lsGet(LS_DONATIONS, []);
}
function writeDonations(list) {
  lsSet(LS_DONATIONS, list);
}

function readSettings() {
  return { ...DEFAULT_SETTINGS, ...lsGet(LS_SETTINGS, {}) };
}
function writeSettings(next) {
  lsSet(LS_SETTINGS, next);
  return next;
}

function readCredentials() {
  return lsGet(LS_CREDENTIALS, { email: RELIEF_ADMIN_EMAIL_DEFAULT, password: RELIEF_ADMIN_PASSWORD_DEFAULT });
}

/* Small artificial delay so loading states / skeletons still get a moment
   on screen — the UI was built assuming a network round trip. */
const settle = (ms = 220) => new Promise((r) => setTimeout(r, ms));

function apiError(message, errors) {
  const e = new Error(message);
  if (errors) e.errors = errors;
  return e;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

/* ---- admin session (localStorage, not a real security boundary — this
   is a frontend-only demo per spec; there is no server to keep secrets
   from) ---- */
function getAdminToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}
function setAdminToken(token) {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* storage unavailable — session just won't persist across reloads */
  }
}

/* ============================== Public API ============================== */

async function getSettings() {
  await settle();
  return readSettings();
}

async function getRecentDonations(limit = 8) {
  await settle();
  const verified = readDonations()
    .filter((d) => d.status === "Verified")
    .sort((a, b) => new Date(b.verifiedAt || b.createdAt) - new Date(a.verifiedAt || a.createdAt))
    .slice(0, limit);
  return { donations: verified };
}

/* ---- Admin ---- */

async function adminLogin(email, password) {
  await settle();
  const creds = readCredentials();
  if (email.trim().toLowerCase() !== creds.email.toLowerCase() || password !== creds.password) {
    throw apiError("Invalid email or password.");
  }
  /* Not a real token — just a local session marker, since there's no
     server to issue or verify one against. */
  return { token: `local-${Date.now()}` };
}

async function adminListDonations({ status = "", search = "", page = 1 } = {}) {
  await settle();
  let list = readDonations();
  if (status) list = list.filter((d) => d.status === status);
  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (d) =>
        d.donorName.toLowerCase().includes(q) ||
        d.phone.toLowerCase().includes(q) ||
        d.transactionId.toLowerCase().includes(q)
    );
  }
  list = list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { donations: list };
}

async function adminVerifyDonation(id) {
  await settle();
  const list = readDonations();
  const next = list.map((d) =>
    d.id === id ? { ...d, status: "Verified", verifiedAt: new Date().toISOString(), verifiedBy: "admin", updatedAt: new Date().toISOString() } : d
  );
  writeDonations(next);
  return { donation: next.find((d) => d.id === id) };
}

async function adminRejectDonation(id, reason = "") {
  await settle();
  const list = readDonations();
  const next = list.map((d) =>
    d.id === id ? { ...d, status: "Rejected", failureReason: reason, updatedAt: new Date().toISOString() } : d
  );
  writeDonations(next);
  return { donation: next.find((d) => d.id === id) };
}

async function adminDeleteDonation(id) {
  await settle();
  writeDonations(readDonations().filter((d) => d.id !== id));
  return { ok: true };
}

async function adminGetSettings() {
  await settle();
  return readSettings();
}

async function adminUpdateSettings(formData) {
  await settle();
  const get = (k) => formData.get(k);
  const current = readSettings();
  const next = {
    ...current,
    upiId: (get("upiId") || current.upiId || "").toString(),
    accountHolderName: (get("accountHolderName") || current.accountHolderName || "").toString(),
    campaignDescription: (get("campaignDescription") || current.campaignDescription || "").toString(),
    campaignGoal: Number(get("campaignGoal")) || current.campaignGoal,
  };
  const qrFile = get("qrCode");
  if (qrFile && typeof qrFile === "object" && qrFile.size > 0) {
    next.qrCodeUrl = await fileToDataUrl(qrFile);
  }
  writeSettings(next);
  return { settings: next };
}

/* CSV export, built and downloaded entirely client-side — no fetch, no
   Authorization header, no server. */
async function adminExportCsv(status = "") {
  await settle();
  let list = readDonations();
  if (status) list = list.filter((d) => d.status === status);

  const cols = ["id", "donorName", "phone", "email", "amount", "transactionId", "status", "anonymous", "message", "createdAt", "verifiedAt"];
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...list.map((d) => cols.map((c) => escape(d[c])).join(","))].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `donations-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
/* ============================ end local data layer ============================ */


/* ================================================================== */
/* THEME SYSTEM — Dark / Light mode                                    */
/* All theme logic lives here at the top of the file:                  */
/*   - ThemeProvider  : owns the theme state, persists explicit        */
/*     choices to localStorage, restores them on the next visit,       */
/*     falls back to the OS preference (prefers-color-scheme) on a     */
/*     first visit, and toggles the "dark" class on <html>.            */
/*   - useTheme()     : hook any component calls for                   */
/*     { theme, isDark, toggleTheme }.                                 */
/*   - <ThemeToggle/> : the animated Sun/Moon navbar button.           */
/* Dark mode keeps the original design 100% untouched; light mode      */
/* swaps in a clean white/off-white palette via conditional Tailwind   */
/* classes throughout the components below. No reloads — the class     */
/* flip + React state make the whole site update instantly.            */
/* ================================================================== */

const THEME_STORAGE_KEY = "wildwood-theme";

const ThemeContext = createContext(null);

/* Resolves the initial theme once, before first paint:
   1. A previously saved choice in localStorage always wins.
   2. Otherwise fall back to the OS preference via matchMedia.
   3. Otherwise default to dark — the label's native look.
   Storage/matchMedia access is wrapped in try/catch so sandboxed or
   privacy-restricted environments degrade gracefully (the toggle still
   works; the choice just is not persisted). */
function getInitialThemeState() {
  if (typeof window === "undefined") return { theme: "dark", explicit: false };
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return { theme: stored, explicit: true };
  } catch (err) { /* storage unavailable — fall through to OS preference */ }
  try {
    if (window.matchMedia) {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) return { theme: "dark", explicit: false };
      if (window.matchMedia("(prefers-color-scheme: light)").matches) return { theme: "light", explicit: false };
    }
  } catch (err) { /* matchMedia unavailable */ }
  return { theme: "dark", explicit: false };
}

function ThemeProvider({ children }) {
  /* Lazily resolve the initial theme exactly once per mount. */
  const initialRef = useRef(null);
  if (initialRef.current === null) initialRef.current = getInitialThemeState();

  const [theme, setTheme] = useState(initialRef.current.theme);
  /* Whether the current theme came from an explicit user choice (saved or
     toggled) vs. the OS default — only explicit choices are persisted, and
     only non-explicit sessions follow live OS-level changes. */
  const explicitChoiceRef = useRef(initialRef.current.explicit);

  /* Keep the "dark" class on <html> in sync before paint — no flash. */
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  /* Persist explicit choices so the site restores them on the next visit. */
  useEffect(() => {
    if (!explicitChoiceRef.current) return;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (err) { /* storage unavailable — theme still works this session */ }
  }, [theme]);

  /* Until the user explicitly picks a theme, follow live OS changes. */
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => {
      if (!explicitChoiceRef.current) setTheme(e.matches ? "dark" : "light");
    };
    if (media.addEventListener) {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    if (media.addListener) {
      media.addListener(onChange); /* Safari < 14 fallback */
      return () => media.removeListener(onChange);
    }
    return undefined;
  }, []);

  const toggleTheme = useCallback(() => {
    explicitChoiceRef.current = true;
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo(
    () => ({ theme, isDark: theme === "dark", toggleTheme }),
    [theme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

/* Animated Sun/Moon toggle used in the navbar (desktop + mobile).
   Both icons are stacked; the active one rotates/fades in while the other
   rotates/fades out, and the button itself scales on hover/press with a
   soft glow — all pure Tailwind transitions, no extra libraries. */
function ThemeToggle({ className = "" }) {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`relative w-10 h-10 shrink-0 rounded-full border flex items-center justify-center overflow-hidden transition-all duration-300 ease-in-out will-change-transform hover:scale-105 active:scale-90 ${
        isDark
          ? "border-white/15 bg-white/5 text-white shadow-[0_0_12px_rgba(255,255,255,0.10)] hover:border-white/40 hover:bg-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.28)]"
          : "border-neutral-300 bg-white text-neutral-900 shadow-[0_0_12px_rgba(0,0,0,0.08)] hover:border-neutral-500 hover:shadow-[0_0_20px_rgba(245,158,11,0.35)]"
      } ${className}`}
    >
      <Sun
        size={17}
        className={`absolute transition-all duration-300 ease-in-out will-change-transform ${
          isDark ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"
        }`}
      />
      <Moon
        size={17}
        className={`absolute transition-all duration-300 ease-in-out will-change-transform ${
          isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50"
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* CONTENT DATA — everything below lives in this one file now.        */
/* To add a new song, artist, event, or partner, scroll to the        */
/* matching array (RELEASES_RAW / ARTISTS_RAW / EVENTS / PARTNERS)    */
/* right here and add a new entry using the same shape as the ones    */
/* around it, then redeploy. No other file needs to change.           */
/* ------------------------------------------------------------------ */
const RELEASES_RAW = [
   {
    "id": "r1",
    "title": "Tumar Smriti",
    "artist": "Debangaraj",
    "composition": "Debangaraj",
    "lyrics": "Debangaraj and Phatik Mohan",
    "coverImg": "/cover/Smriti.webp",
    "type": "Single",
    "year": "2025",
    "duration": "3:17",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/smriti.mpeg"
  },
  {
    "id": "r2",
    "title": "Xihoron",
    "artist": "DHRTX and Ankur Kashyap",
    "composition": "DHRTX and Ankur Kashyap",
    "lyrics": "Ankur Kashyap",
    "coverImg": "/cover/Xihoron.webp",
    "type": "Single",
    "year": "2024",
    "duration": "2:35",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/xihoron.mpeg"
  },

   {
    "id": "r3",
    "title": "Tumi Ahiba Edin Kaxhole",
    "artist": "Rishi Raj Phukan and Ranamit Sarma",
    "composition": "Rishi Raj Phukan",
    "lyrics": "Buddha Jyoti Bezbaruah",
    "coverImg": "/cover/TumiAhiba.webp",
    "type": "Single",
    "year": "2023",
    "duration": "4:15",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/tumiAhiba.mpeg"
  },

    {
    "id": "r4",
    "title": "Abhilaxi",
    "artist": "Debabrata Gogoi and Aarxslan",
    "composition": "Debabrata Gogoi",
    "lyrics": "Mrityunjoy Kakati",
    "coverImg": "/cover/Abhilaxi.webp",
    "type": "Single",
    "year": "2023",
    "duration": "3:39",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/abhilaxi.mpeg"
  },
 {
    "id": "r5",
    "title": "Monore Majote",
    "artist": "Sannidhya Bhuyan and Debangaraj",
    "composition": "Sannidhya Bhuyan",
    "lyrics": "Rajib Bhuyan",
    "coverImg": "/cover/Monore.webp",
    "type": "Single",
    "year": "2022",
    "duration": "2:58",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/monore.mp3"
  },

  {
    "id": "r6",
    "title": "Kinu Xure",
    "artist": "Debangaraj and Dreamy",
    "composition": "Debangaraj",
    "lyrics": "Dikshita Devi",
    "coverImg": "/cover/Kinu.webp",
    "type": "Single",
    "year": "2022",
    "duration": "3:52",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/kinuXure.mpeg"
  },
 
    {
    "id": "r7",
    "title": "Mon Fuloni",
    "artist": "Sannidhya Bhuyan",
    "composition": "Deepak Bhuyan",
    "lyrics": "Deepak Bhuyan",
    "coverImg": "/cover/MonFuloni.webp",
    "type": "Single",
    "year": "2022",
    "duration": "4:11",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/monFuloni.mpeg"
  },
    {
    "id": "r8",
    "title": "Hiyaphool",
    "artist": "Debangaraj",
    "composition": "Debangaraj",
    "lyrics": "Dikshita Devi",
    "coverImg": "/cover/Hiyaphool.webp",
    "type": "Single",
    "year": "2022",
    "duration": "3:42",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/hiyaphool.mpeg"
  },

    {
    "id": "r9",
    "title": "Niraxa",
    "artist": "Debabrata Gogoi and GJay",
    "composition": "Debabrata Gogoi and GJay",
    "lyrics": "Debabrata Gogoi",
    "coverImg": "/cover/Niraxa.webp",
    "type": "Single",
    "year": "2022",
    "duration": "3:20",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/niraxa.mpeg"
  },

     {
    "id": "r10",
    "title": "Prohelika",
    "artist": "Debabrata Gogoi",
    "composition": "Debabrata Gogoi",
    "lyrics": "Debabrata Gogoi",
    "coverImg": "/cover/Prohelika.webp",
    "type": "Single",
    "year": "2021",
    "duration": "3:57",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/prohelika.mpeg"
  },

    {
    "id": "r11",
    "title": "Xopun Xur",
    "artist": "Debashree Sharma,Sannidhya Bhuyan and Phenoxy Music",
    "composition": "Sannidhya Bhuyan",
    "lyrics": "Rajib Bhuyan",
    "coverImg": "/cover/XopunXur.webp",
    "type": "Single",
    "year": "2021",
    "duration": "3:03",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/xopunXur.mpeg"
  },


    {
    "id": "r12",
    "title": "Niyor",
    "artist": "Ranamit Sarma,Ayan Purkayastha",
    "composition": "Rishi Raj Phukan",
    "lyrics": "Mriganka Sarma",
    "coverImg": "/cover/Niyor.webp",
    "type": "Single",
    "year": "2021",
    "duration": "5:27",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/niyor.mpeg"
  },

    {
    "id": "r13",
    "title": "Abhiman",
    "artist": "Debangaraj,Pincool and TYPHOON MUSIC",
    "composition": "Debangaraj",
    "lyrics": "Phatik Mohan",
    "coverImg": "/cover/Abhiman.webp",
    "type": "Single",
    "year": "2021",
    "duration": "4:39",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/Abhiman.mpeg"
  },
    {
    "id": "r14",
    "title": "Xunoyona(Remix)",
    "artist": "Sannidhya Bhuyan and Debabrata Gogoi",
    "composition": "Sannidhya Bhuyan and Debabrata Gogoi",
    "lyrics": "Sannidhya Bhuyan and Debabrata Gogoi",
    "coverImg": "/cover/Xunoy.webp",
    "type": "Single",
    "year": "2020",
    "duration": "3:04",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/xunoyona.mpeg"
  },

    {
    "id": "r15",
    "title": "Premor Sila",
    "artist": "KLANZ and EREKA",
    "composition": "Kalyan Jyoti Kashyap",
    "lyrics": "Suraj Dhimaan and Ankur Jyoti Kalita",
    "coverImg": "/cover/Premor.webp",
    "type": "Single",
    "year": "2020",
    "duration": "3:27",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/premor.mpeg"
  },

    {
    "id": "r16",
    "title": "Boroxa Bristi",
    "artist": "Tridip Kakati,Vicky Kalita and Prasant Das",
    "composition": "Prasant Das",
    "lyrics": "Prasant Das",
    "coverImg": "/cover/Boroxa.webp",
    "type": "Single",
    "year": "2020",
    "duration": "2:47",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/boroxa.mpeg"
  },

    {
    "id": "r17",
    "title": "Boroxa Bristi (Female)",
    "artist": "Stutima Basistha and Tridib Kakati",
    "composition": "Prasant Das",
    "lyrics": "Prasant Das",
    "coverImg": "/cover/boroxaF.webp",
    "type": "Single",
    "year": "2020",
    "duration": "2:47",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/boroxaF.mpeg"
  },

    {
    "id": "r18",
    "title": "Morisika",
    "artist": "Raud and Ranamit Sarma",
    "composition": "Snehshyam Taye",
    "lyrics": "Snehshyam Taye",
    "coverImg": "/cover/Morisika.webp",
    "type": "Single",
    "year": "2020",
    "duration": "5:03",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/morisika.mpeg"
  },

   {
    "id": "r19",
    "title": "Dipto Tora",
    "artist": "Dyou and Jitrz",
    "composition": "Rekib Ahmed",
    "lyrics": "Rekib Ahmed",
    "coverImg": "/cover/Dipto.webp",
    "type": "Single",
    "year": "2020",
    "duration": "3:36",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/dipto.mpeg"
  },
{
    "id": "r20",
    "title": "Upaxona",
    "artist": "Saurav Hazarika and Zenith Gogoi",
    "coverImg": "/cover/Upaxona.webp",
    "type": "Single",
    "year": "2020",
    "duration": "3:45",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/upaxona.mpeg"
  },

    {
    "id": "r21",
    "title": "Xondhyaraag",
    "artist": "Purab Hazarika",
    "coverImg": "/cover/Xondhya.webp",
    "type": "Single",
    "year": "2020",
    "duration": "4:02",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/xondhya.mpeg"
  },
    {
    "id": "r22",
    "title": "Xopun",
    "artist": "Arin Siam,Nibir X and Nikhil",
    "composition": "Chayanika Shristi Borah",
    "lyrics": "Chayanika Shristi Borah",
    "coverImg": "/cover/Xopun.webp",
    "type": "Single",
    "year": "2020",
    "duration": "5:34",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/xopun.mpeg"
  },

    {
    "id": "r23",
    "title": "Kompito",
    "artist": "Tridib Kakati,Nikhil and Prasant Das",
    "composition": "Prasant Das",
    "lyrics": "Prasant Das",
    "coverImg": "/cover/Kompito.webp",
    "type": "Single",
    "year": "2020",
    "duration": "3:22",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/kompito.mpeg"
  },

  {
    "id": "r24",
    "title": "Xuworoni",
    "artist": "Jay Sarma and Bhargov Deka",
    "composition": "Bhargov Deka",
    "lyrics": "Bhargov Deka",
    "coverImg": "/cover/Xuworoni.webp",
    "type": "Single",
    "year": "2020",
    "duration": "2:22",
    "featured": true,
    "credits": "Wildwood Records",
    "audioSrc": "/audio/xuworoni.mpeg"
  }
];

/* Converts follower strings like "112K", "~2,612 ", "24.9k", "" into a
   plain number so artists can be ranked by real popularity, not just
   guessed from prose. Missing/unparseable values become 0 — that means
   "no public follower count on file", not "zero popularity". */
function parseFollowerCount(str) {
  if (!str) return 0;
  const cleaned = str.replace(/[~,\s]/g, "").toUpperCase();
  const match = cleaned.match(/^([\d.]+)(K|M)?$/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  if (isNaN(num)) return 0;
  if (match[2] === "M") return num * 1_000_000;
  if (match[2] === "K") return num * 1_000;
  return num;
}

/* Curated, not auto-computed — these are the label's headline names by
   editorial judgment, kept as an explicit list so the Spotlight never
   silently reshuffles just because someone's follower count changes. */
const SPOTLIGHT_ARTIST_NAMES = ["Debangaraj", "Debabrata Gogoi", "Tridib Kakati", "Sannidhya Bhuyan"];

const ARTISTS_RAW = [

{
    "name": "Vicky Kalita",
    "role": "Featured Vocalist",
    "genre": "Assamese Pop",
    "category": "Vocals",
    "instagram": {
      "handle": "@vickykalita99",
      "url": "https://www.instagram.com/vickykalita99?igsh=d2tmcHhmdjlzamc5",
      "followers": "112K"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/5tgKejc2BMHgeJFhoJb8p6?si=wMYs-t0XRHOTmyIisxayLw",
      "listeners": ""
    },
    "bio": "Featured vocalist on one of the label's most-loved duet reworkings.",
    "releases": [
      "Boroxa Bristi (Vicky's Version)"
    ]
  },

   {
    "name": "KLANZ",
    "role": "Artist",
    "genre": "Assamese Pop",
    "category": "Featured",
    "instagram": {
      "handle": "@klanz_music",
      "url": "https://www.instagram.com/klanz_music?igsh=bjQ5OTdhZ3BnNnNn",
      "followers": "24.9k"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/3FNlGgL5wmBYspQsmwQ158?si=A1u8Ybf0RBeN4AaMfQFscg",
      "listeners": ""
    },
    "bio": "Recurring artist across several of the scene's collaborative singles.",
    "releases": [
      "Premor Sila",
      "Kangkane",
      "Nasoni"
    ]
  },

  {
    "name": "Jay Sarma",
    "role": "Producer / DJ",
    "genre": "Future Bass · Tropical House",
    "category": "Production",
    "instagram": {
      "handle": "",
      "url": "",
      "followers": ""
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/5Ja4ziHgL3e1KBZO2uTzOi?si=Y8-0MiPxTTWQwYYYL9MKVA",
      "listeners": ""
    },
    "bio": "Producer and DJ moving between future bass, tropical house and bass music, releasing through Bass Rebels Recordings and Wildwood Records with a presence on Beatport and SoundCloud.",
    "releases": [
      "Xuworoni"
    ]
  },
  
  {
    "name": "Bhargov Deka",
    "role": "Vocalist",
    "genre": "Future-Bass Vocals",
    "category": "Vocals",
    "instagram": {
      "handle": "@bhargovdekamusic",
      "url": "https://www.instagram.com/bhargovdekamusic?igsh=MW5oOWRvbjVhemNzeA==",
      "followers": "~559"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/442YT6HUoNh8qm8rAVTACl?si=20J9JXD4QN-fH75wJgMm9A",
      "listeners": "46 monthly listener"
    },
    "bio": "Featured vocalist across Jay Sarma's productions, bringing melody to the label's most electronic-leaning cuts.",
    "releases": [
      "Xuworoni",
      "Sayasroyi",
      "Akakh"
    ]
  },
  {
    "name": "Tridib Kakati",
    "role": "Singer",
    "genre": "Indo-Pop · Assamese Pop",
    "category": "Vocals",
    "instagram": {
      "handle": "@who_is_tridib",
      "url": "https://www.instagram.com/who_is_tridib?igsh=MWN2Zm55dHgyand4YQ==",
      "followers": "13.5K"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/4SZLfeKKTLaZvw2IvdislH?si=ZZQIuyLNRC6LXSkd01go7Q",
      "listeners": ""
    },
    "bio": "Prolific vocalist with a run of Wildwood Records singles spanning romantic ballads and upbeat Assamese pop.",
    "releases": [
      "Kompito",
      "Boroxa Bristi",
      "Mon Urise",
      "Ghenta Relationship"
    ]
  },
  {
    "name": "Nikhil",
    "role": "Vocalist",
    "genre": "Assamese Pop",
    "category": "Vocals",
    "instagram": {
      "handle": "",
      "url": "",
      "followers": ""
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/1QhOSKV8LwaBNIRs6ndWoQ?si=95S_V3-GQb-S1z_1T2vhkQ",
      "listeners": ""
    },
    "bio": "Vocalist featured on two of the label's early pop singles.",
    "releases": [
      "Kompito",
      "Xopun"
    ]
  },
  {
    "name": "Prasant Das",
    "role": "Singer / Songwriter",
    "genre": "Assamese Pop",
    "category": "Vocals",
    "instagram": {
      "handle": "",
      "url": "",
      "followers": ""
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/5Q7i1rKFCuvDEHmIgbzsik?si=QNSi9oFeQb2WdFoJEraCfw",
      "listeners": ""
    },
    "bio": "Singer-songwriter who both performs and writes lyrics across the label's pop catalogue.",
    "releases": [
      "Kompito",
      "Xondhyaraag"
    ]
  },

  {
    "name": "Arin Siam",
    "role": "Singer",
    "genre": "Alternative & Indie",
    "category": "Vocals",
    "instagram": {
      "handle": "@arinsongs",
      "url": "https://www.instagram.com/arinsiam?igsh=MWtreXE5MDF2eHU0dw==",
      "followers": "~700"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/5KYzdlurkIjoHO6U1pZBxe?si=a3TjGKqXRs2Izf_dRem7VA",
      "listeners": ""
    },
    "bio": "Alternative/indie artist fronting one of the label's standout singles, building a following one release at a time.",
    "releases": [
      "Xopun"
    ]
  },
  {
    "name": "Nibir X",
    "role": "Singer / Producer",
    "genre": "Pop · Dance · Folk",
    "category": "Production",
    "instagram": {
      "handle": "@nibir.x",
      "url": "https://www.instagram.com/nibir.x?igsh=Zmk2Z3NzZW92cjc2",
      "followers": "~1,778"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/23AWp1LUoBnfgrEsxUs0jh?si=2FvZZtzzSnKYuuTC0LByFA",
      "listeners": ""
    },
    "bio": "Genre-hopping singer-producer releasing solo work alongside label collaborations.",
    "releases": [
      "Xopun",
      "The Lazy Song",
      "Xopunor Aakaxot"
    ]
  },
  {
    "name": "Purab Hazarika",
    "role": "Vocalist / Mix & Master Engineer",
    "genre": "Assamese Pop",
    "category": "Vocals",
    "instagram": {
      "handle": "@purab_hazarika",
      "url": "https://www.instagram.com/purab_hazarika?igsh=cW00Ymt4dGU3bWF5",
      "followers": "~1,095"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/73JnTn8NO5dJlRJgz2yXhV?si=seQuF2VaRUOiRaIUAA7m7w",
      "listeners": ""
    },
    "bio": "Vocalist and engineer who mixed and mastered his own solo single for the label.",
    "releases": [
      "Xondhyaraag"
    ]
  },
  {
    "name": "Saurav Hazarika",
    "role": "Vocalist",
    "genre": "Assamese Pop",
    "category": "Vocals",
    "instagram": {
      "handle": "@sauravrhaz",
      "url": "https://www.instagram.com/sauravrhaz?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==",
      "followers": "~467K"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/5ohbosILxnrYn4kP07YSxj?si=8iSTJXaeQP2ILSUqgarVCA",
      "listeners": ""
    },
    "bio": "Vocalist behind one of the catalogue's more atmospheric pop singles.",
    "releases": [
      "Upaxona"
    ]
  },
  {
    "name": "Zenith Gogoi",
    "role": "Composer / Producer",
    "genre": "Assamese Pop",
    "category": "Production",
    "instagram": {
      "handle": "@zenithgogoi",
      "url": "https://www.instagram.com/zenithgogoi?igsh=NHV1N2d3bjVtNXd1",
      "followers": "~2,467"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/3ZE9JyzcYw2XWLZtW7sMu8?si=Y9AIeGTDRTOQdIPAmc2KIQ",
      "listeners": ""
    },
    "bio": "Composer and producer who shaped the sound of one of the label's mellower releases.",
    "releases": [
      "Upaxona"
    ]
  },
  {
    "name": "Dyou",
    "role": "Vocalist",
    "genre": "Assamese Pop",
    "category": "Vocals",
    "instagram": {
      "handle": "",
      "url": "",
      "followers": ""
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/6f0OZUaCvSTfnaZ4zbpniy?si=8u5cdFY_THSR56TcsAZHdQ",
      "listeners": ""
    },
    "bio": "Lead vocalist on one of the catalogue's more introspective tracks.",
    "releases": [
      "Dipto Tora"
    ]
  },
  {
    "name": "Jitrz",
    "role": "Producer / Keyboardist",
    "genre": "Assamese Pop",
    "category": "Production",
    "instagram": {
      "handle": "@jitrzmusic",
      "url": "https://www.instagram.com/jitrzmusic?igsh=NThvYWE2ZndzM3N3",
      "followers": "~811"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/6cZxSmTVL9ukL0BYtSgTXx?si=Vw-zdH43SmKq0BFwpUiAfw",
      "listeners": ""
    },
    "bio": "Recurring producer-keyboardist whose credits run across several Wildwood releases.",
    "releases": [
      "Dipto Tora",
      "Tumi Aru Moi",
      "Keninu Heral"
    ]
  },
  {
    "name": "Ruad",
    "role": "Singer / Composer",
    "genre": "Assamese Pop",
    "category": "Vocals",
    "instagram": {
      "handle": "",
      "url": "https://www.instagram.com/_ruadkarchang_?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==",
      "followers": "~2100"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/06neqCsgJmQH0VNYGK3QtW?si=te2RQ3CCRdKzBy-EnTNhfg",
      "listeners": ""
    },
    "bio": "Singer-composer collaborating regularly with Ranamit Sarma on the label's romantic pop side.",
    "releases": [
      "Morisika",
      "Tumi Aru Moi"
    ]
  },
  {
    "name": "Ranamit Sarma",
    "role": "Vocalist / Collaborator",
    "genre": "Assamese Pop",
    "category": "Vocals",
    "instagram": {
      "handle": "",
      "url": "",
      "followers": ""
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/3lTFKOnGFnR3YqdFBHneR2?si=YU-TZpYiTTK_nxglTHOZ3Q",
      "listeners": ""
    },
    "bio": "One of the scene's most prolific collaborators, appearing across several of the label's biggest singles.",
    "releases": [
      "Morisika",
      "Niyor",
      "Tumi Ahiba Edin Kaxhole"
    ]
  },
  {
    "name": "Debabrata Gogoi",
    "role": "Vocalist",
    "genre": "Romantic · Melodic Pop",
    "category": "Vocals",
    "instagram": {
      "handle": "@xdebo_",
      "url": "https://instagram.com/xdebo_",
      "followers": "~11.4K"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/4vOn828v65dT85viYmnMzj",
      "listeners": "123.5K monthly listeners"
    },
    "youtube": {
      "url": "https://www.youtube.com/playlist?list=PLpNlOFYgthzS0hs-sGArvZxSaVwCuJe8e",
      "label": "DEBO",
      "probable": true
    },
    "bio": "A prominent figure in the scene, known as \"Debo\" for romantic, melodic pop across multiple label singles.",
    "releases": [
      "Niraxa",
      "Prohelika",
      "Xunoyona (Remix)",
      "Abhilaxi"
    ]
  },
  {
    "name": "Stutima Basistha",
    "role": "Featured Vocalist",
    "genre": "Assamese Pop",
    "category": "Vocals",
    "instagram": {
      "handle": "@sbasistha13",
      "url": "https://www.instagram.com/sbasistha13?igsh=MTVtYmt0eTh5Zjk3bQ==",
      "followers": "~1,243 "
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/59ydiKj1yek3GmRFPTQHb3?si=gs_5C0MrQ5yEU4V3ydUaeQ",
      "listeners": ""
    },
    "bio": "Vocalist behind the female-voiced version of one of the label's signature duets.",
    "releases": [
      "Boroxa Bristi (Female)"
    ]
  },

  {
    "name": "EREKA",
    "role": "Artist",
    "genre": "Assamese Pop",
    "category": "Featured",
    "instagram": {
      "handle": "@ereka.0fficial",
      "url": "https://www.instagram.com/ereka.0fficial?igsh=bDRxMnE5aG55N3Ji",
      "followers": "~7,803 "
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/7znMUo3QX4lNQKb5qdlNzT?si=C9nVI0WnTlSg8GrkjwL10Q",
      "listeners": ""
    },
    "bio": "Collaborative artist with credits spanning multiple producers in the wider scene.",
    "releases": [
      "Premor Sila",
      "Dubori"
    ]
  },
  {
    "name": "Debangaraj",
    "role": "Vocalist",
    "genre": "Romantic · Melodic Pop",
    "category": "Vocals",
    "instagram": {
      "handle": "@debangarajmusic",
      "url": "https://www.instagram.com/debangarajmusic?igsh=MXMzdXJtemdzajk1dw==",
      "followers": "~5,048"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/4Kau7SEZaSNAu4dWcE8vfJ?si=hD5mA2JJTNe4VxDSXYVzDA",
      "listeners": ""
    },
    "bio": "The most-featured voice in the catalogue — five tracks deep — known for melodic, romantic Assamese pop.",
    "releases": [
      "Abhiman",
      "Hiyaphool",
      "Kinu Xure",
      "Monore Majote",
      "Tumar Smriti"
    ]
  },
  {
    "name": "Pincool",
    "role": "Featured Artist",
    "genre": "Assamese Pop",
    "category": "Featured",
    "instagram": {
      "handle": "@pincoolmusic",
      "url": "https://www.instagram.com/pincoolmusic?igsh=djkzaTg1N3BzdXky",
      "followers": "~4,308"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/3sA3DA4cG7nTIvBAuJLS2h?si=OWdrzuqyQGO58raRl1KXGQ",
      "listeners": ""
    },
    "bio": "Featured artist on one of the label's ensemble singles.",
    "releases": [
      "Abhiman"
    ]
  },
  {
    "name": "TYPHOON MUSIC",
    "role": "Featured Artist",
    "genre": "Assamese Pop",
    "category": "Featured",
    "instagram": {
      "handle": "@typhoonmusic",
      "url": "https://www.instagram.com/typhoonmusic?igsh=MWVrcXptY2s4NDlxaQ==",
      "followers": "104K"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/7s3TtN3EOyop1aUdjiSmRn?si=7xHkH_fjRni8WuLH5NUGFg",
      "listeners": ""
    },
    "bio": "Featured artist on one of the label's ensemble singles.",
    "releases": [
      "Abhiman"
    ]
  },
  {
    "name": "Debashree Sharma",
    "role": "Featured Vocalist",
    "genre": "Assamese Pop",
    "category": "Vocals",
    "instagram": {
      "handle": "@debashree_music_08",
      "url": "https://www.instagram.com/debashree_music_08?igsh=MWZyeWx0enc5djlxMg==",
      "followers": "~1,191"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/1AcR1696xGQvp1VjgkZgVx?si=iw4F3bW-QSeyUsAy2lidFA",
      "listeners": ""
    },
    "bio": "Featured vocalist on a collaborative single alongside Sannidhya Bhuyan.",
    "releases": [
      "Xopun Xur"
    ]
  },
  {
    "name": "Sannidhya Bhuyan",
    "role": "Vocalist",
    "genre": "R&B · Indian Classical Fusion",
    "category": "Vocals",
    "instagram": {
      "handle": "@sannidhyabhuyan",
      "url": "https://instagram.com/sannidhyabhuyan",
      "followers": "111K"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/3up6Gqw9IAsQ9KqLzVkyTN",
      "listeners": "305.1K monthly listeners"
    },
    "youtube": {
      "url": "https://www.youtube.com/channel/UCNR3iA52221fCBfQoYVVoBw",
      "label": "Sannidhya Bhuyan"
    },
    "bio": "One of the biggest names in the scene — credited with pioneering the first R&B track in the Assamese language, fusing R&B with Indian classical influences.",
    "releases": [
      "Xopun Xur",
      "Mon Fuloni",
      "Xunoyona (Remix)",
      "Monore Majote"
    ]
  },
  {
    "name": "Ayan Purkayastha",
    "role": "Featured Artist",
    "genre": "Assamese Pop",
    "category": "Featured",
    "instagram": {
      "handle": "@_purkayastha.ayan_",
      "url": "https://www.instagram.com/_purkayastha.ayan_?igsh=MXY3bXAzaG91NzlqeA==",
      "followers": "~4,786"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/20rDPgszVDDEvhCiefU2Tt?si=bO1R9RWDQCuIsHXSDmz9kg",
      "listeners": ""
    },
    "bio": "Featured artist alongside Ranamit Sarma.",
    "releases": [
      "Niyor"
    ]
  },
  
  {
    "name": "GJay",
    "role": "Featured Artist",
    "genre": "Assamese Pop",
    "category": "Featured",
    "instagram": {
      "handle": "@gjaymusic",
      "url": "https://www.instagram.com/gjaymusic?igsh=MW80cGVvY3c3NTZrZg==",
      "followers": "~1,102"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/0jjie1u7ekdpKAozOGFIkM?si=YW1W5r-jRNCLqBgT6BaChw",
      "listeners": ""
    },
    "bio": "Featured artist alongside Debabrata Gogoi.",
    "releases": [
      "Niraxa"
    ]
  },
  {
    "name": "Dreamy",
    "role": "Featured Artist",
    "genre": "Assamese Pop",
    "category": "Featured",
    "instagram": {
      "handle": "@dreamymedhi",
      "url": "https://www.instagram.com/dreamymedhi?igsh=MWU5ZXN1aTg4ZDl0Nw==",
      "followers": "~1,713"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/0PHemcButStIdNqAyRwqy0?si=8kEhW4YuQ0a5fo6930KNNA",
      "listeners": ""
    },
    "bio": "Featured artist alongside Debangaraj.",
    "releases": [
      "Kinu Xure"
    ]
  },
  {
    "name": "Aarxslan",
    "role": "Featured Artist",
    "genre": "Assamese Pop",
    "category": "Featured",
    "instagram": {
      "handle": "",
      "url": "",
      "followers": ""
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/67137rl2C1Z9kPUiLGqNXr?si=_dexIHdxTP-drb9G9gcROQ",
      "listeners": ""
    },
    "bio": "Featured artist with credits across several collaborative singles in the scene.",
    "releases": [
      "Abhilaxi",
      "For A Reason",
      "Sinaki Sinaki"
    ]
  },
  {
    "name": "Rishi Raj Phukan",
    "role": "Vocalist",
    "genre": "Assamese Pop",
    "category": "Vocals",
    "instagram": {
      "handle": "@rishi.rajphukan",
      "url": "https://www.instagram.com/rishiirajphukan?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==",
      "followers": "158K"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/7uiUv5GC87kz3T6CscYSCj",
      "listeners": "57.8K monthly listeners"
    },
    "youtube": {
      "url": "https://www.youtube.com/@RishirajphukanOfficial",
      "label": "Rishi Raj Phukan"
    },
    "bio": "The biggest name on the roster. Guwahati-based, leading one of the catalogue's standout collaborations.",
    "releases": [
      "Tumi Ahiba Edin Kaxhole"
    ]
  },
  {
    "name": "DHRTX",
    "role": "Producer / Mixing Engineer",
    "genre": "Assamese Pop · EDM",
    "category": "Production",
    "instagram": {
      "handle": "@___dhrtx___",
      "url": "https://www.instagram.com/___dhrtx___?igsh=NTdpZnByb3k3dnRr",
      "followers": "~2,612 "
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/5HkDOPNeKbOi4m73KXgWh8?si=2eFFLbd0RQawtwuhZcuVsA",
      "listeners": ""
    },
    "bio": "Extremely active producer and mixing engineer with dozens of credits across the wider Assamese scene.",
    "releases": [
      "Xihoron"
    ]
  },
  {
    "name": "Ankur Kashyap",
    "role": "Composer / Vocalist",
    "genre": "Assamese Pop",
    "category": "Production",
    "instagram": {
      "handle": "@_ankurkashyap__",
      "url": "https://www.instagram.com/_ankurkashyap__?igsh=MWtlcm9qaWpsdWJtcQ==",
      "followers": "~1,252"
    },
    "spotify": {
      "url": "https://open.spotify.com/artist/5ULFWoj12uXPhHmbF0H4Rx?si=Pb_WVaXBQIyiVKk1WRwYNw",
      "listeners": ""
    },
    "bio": "Composer-vocalist and frequent DHRTX collaborator.",
    "releases": [
      "Xihoron"
    ]
  }
];

const EVENTS = [
  {
    "id": "e1",
    "date": "24 JUL",
    "year": "2026",
    "title": "Zubeen Garg Live",
    "city": "Guwahati, IN",
    "venue": "Nehru Stadium",
    "type": "Headline Show"
  },
  {
    "id": "e2",
    "date": "09 AUG",
    "year": "2026",
    "title": "Papon Acoustic Session",
    "city": "Delhi, IN",
    "venue": "Siri Fort Auditorium",
    "type": "Live Set"
  },
  {
    "id": "e3",
    "date": "21 SEP",
    "year": "2026",
    "title": "Wildwood Showcase",
    "city": "Mumbai, IN",
    "venue": "Nita Mukesh Ambani Cultural Centre",
    "type": "Label Tour"
  },
  {
    "id": "e4",
    "date": "03 OCT",
    "year": "2026",
    "title": "Shankuraj Konwar",
    "city": "Bengaluru, IN",
    "venue": "Indiranagar Club",
    "type": "Club Night"
  }
];

const PARTNERS = [
  "Spotify",
  "YouTube Music",
  "Apple Music",
  "SoundCloud",
  "JioSaavn",
  "Amazon Music"
];

/* ------------------------------------------------------------------ */
/* LOCAL SOCIAL & BRAND ICONS                                         */
/* ------------------------------------------------------------------ */

function Instagram({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function Twitter({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 4l7.2 9.6L4.4 20H7l5.6-5.2L17 20h3.6l-7.6-10L20 4h-2.6l-5 4.7L8.6 4H4z" fill="currentColor" />
    </svg>
  );
}

function Youtube({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="5" width="20" height="14" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M10 9l6 3-6 3V9z" fill="currentColor" />
    </svg>
  );
}

function Spotify({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.299 1.021zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.84.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.38 4.32-1.32 11.28-1.02 15.72 1.621.539.3.719 1.02.419 1.56-.299.54-1.02.72-1.559.42z" />
    </svg>
  );
}


/* ------------------------------- MOCK DATA ------------------------------- */

/* RELEASES_RAW is defined near the top of this file. To add, edit, or
   remove a song, add/edit an entry in that array using the same shape
   as the ones around it — no other code needs to change. */

/* Every release currently shares the same cover-gradient treatment, so new
   entries in releases.json don't need to specify one at all — it's applied
   here by default. Set a "gradient" field in the JSON only if a specific
   release ever needs a different Tailwind gradient class. */
const DEFAULT_RELEASE_GRADIENT = "from-[#333333] via-[#1a1a1a] to-black";

const RELEASES = RELEASES_RAW.map((r) => ({
  ...r,
  gradient: r.gradient || DEFAULT_RELEASE_GRADIENT,
  spotifyUrl: r.spotifyUrl || `https://open.spotify.com/search/${encodeURIComponent(` ${r.credits} ${r.title} ${r.artist}`)}`,
  youtubeUrl: r.youtubeUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(`${r.title} ${r.artist}`)}`,
}));

/* ------------------------------------------------------------------ */
/* ARTIST ROSTER DATA                                                  */
/*                                                                      */
/* HOW TO ADD ARTIST PHOTOS:                                          */
/*  1. Create a folder at:  public/artists/                            */
/*  2. Save each photo as:  public/artists/<slug>.jpg                  */
/*     The <slug> is the artist's name, lowercased, with spaces        */
/*     turned into dashes — e.g. "Jay Sarma" -> jay-sarma.jpg          */
/*     "Debabrata Gogoi" -> debabrata-gogoi.jpg                        */
/*  3. Square photos work best (500x500px or larger).                  */
/*  4. Nothing breaks if a photo is missing — the card falls back to   */
/*     a generated monogram avatar automatically (see ArtistAvatar).   */
/* ------------------------------------------------------------------ */

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const ARTIST_GRADIENTS = [
  "from-[#3a2e2e] via-[#201818] to-black",
  "from-[#2e3a38] via-[#182020] to-black",
  "from-[#2e2e3a] via-[#181820] to-black",
  "from-[#3a3a2e] via-[#202018] to-black",
  "from-[#332e3a] via-[#1c1820] to-black",
  "from-[#2e3a2e] via-[#182018] to-black",
];

/* Light-theme counterparts to ARTIST_GRADIENTS — same hue families,
   lifted into soft near-white tints so roster cards keep their per-artist
   color identity on the white theme. Indexed in lockstep with the dark
   array (see the ARTISTS map below). */
const ARTIST_GRADIENTS_LIGHT = [
  "from-[#f3eded] via-[#faf7f7] to-white",
  "from-[#eaf2f0] via-[#f6faf9] to-white",
  "from-[#ededf3] via-[#f7f7fb] to-white",
  "from-[#f2f2e9] via-[#fafaf4] to-white",
  "from-[#f0edf3] via-[#f9f7fb] to-white",
  "from-[#edf2ed] via-[#f7faf7] to-white",
];

/* ARTISTS_RAW is defined near the top of this file. To add, edit, or
   remove an artist, add/edit an entry in that array using the same
   shape as the ones around it — no other code needs to change. */

/* Photo lookup order. Drop a file named <slug>.<ext> into public/artists/
   in ANY of these formats and it will be found — so a .jpg export works
   just as well as a .png, which is the usual reason a photo silently
   fails to appear. If none of them exist, ArtistAvatar falls back to the
   monogram. Add "avif" here if you start exporting that. */
const ARTIST_PHOTO_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

const ARTISTS = ARTISTS_RAW.map((a, i) => {
  const slug = slugify(a.name);
  const searchQuery = encodeURIComponent(`${a.name} Wildwood Records`);
  const hasInstagram = Boolean(a.instagram?.url);
  const hasSpotify = Boolean(a.spotify?.url);

  const followerCount = parseFollowerCount(a.instagram?.followers);
  /* Release count is the primary signal — how much an artist has actually
     built with the label — with real follower numbers breaking ties
     between artists at the same release count. The large multiplier
     keeps release count dominant while followers still matter within a tier. */
  const popularityScore = a.releases.length * 1_000_000 + followerCount;

  return {
    ...a,
    id: `art-${i + 1}`,
    slug,
    followerCount,
    popularityScore,
    gradient: ARTIST_GRADIENTS[i % ARTIST_GRADIENTS.length],
    gradientLight: ARTIST_GRADIENTS_LIGHT[i % ARTIST_GRADIENTS_LIGHT.length],
    photoImg: `/artists/${slug}.png`,
    /* Every candidate path, tried in order by ArtistAvatar. */
    photoCandidates: ARTIST_PHOTO_EXTENSIONS.map((ext) => `/artists/${slug}.${ext}`),
    instagram: hasInstagram ? a.instagram : null,
    verified: hasInstagram,
    spotify: {
      url: hasSpotify ? a.spotify.url : `https://open.spotify.com/search/${searchQuery}`,
      listeners: hasSpotify ? a.spotify.listeners : null,
      confirmed: hasSpotify,
    },
    youtube: {
      url: a.youtube?.url || `https://www.youtube.com/results?search_query=${searchQuery}`,
      label: a.youtube?.label || null,
      probable: Boolean(a.youtube?.probable),
      confirmed: Boolean(a.youtube) && !a.youtube?.probable,
    },
  };
});

/* Roster-wide numbers shown in the stats strip at the top of the Artists page */
const ARTIST_STATS = {
  total: ARTISTS.length,
  verified: ARTISTS.filter((a) => a.verified).length,
  releases: new Set(ARTISTS.flatMap((a) => a.releases)).size,
  genres: new Set(ARTISTS.map((a) => a.genre)).size,
};

/* Category -> accent color, used for the left edge stripe on each artist card */
const CATEGORY_ACCENTS = {
  Vocals: "border-l-emerald-500/60",
  Production: "border-l-sky-500/60",
  Featured: "border-l-amber-500/60",
};

/* Tier badge based on how many tracks an artist appears on — a small, earned
   distinction rather than a decoration, so it only shows up when it means something. */
function getArtistTier(releaseCount) {
  if (releaseCount >= 4) return { label: "Label Cornerstone", Icon: Sparkles };
  if (releaseCount === 3) return { label: "Key Collaborator", Icon: Crown };
  return null;
}

/* EVENTS is defined near the top of this file. To add, edit, or
   remove a show, add/edit an entry in that array. */

/* PARTNERS is defined near the top of this file. To add, edit, or
   remove a streaming partner, add/edit an entry in that array. */

const NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "releases", label: "Releases" },
  { id: "artists", label: "Artists" },
  { id: "about", label: "About" },
  { id: "events", label: "Events" },
  { id: "services", label: "Services" },
  { id: "donateus", label: "Donate Us", accent: true },
  { id: "contact", label: "Contact" },
];

/* ------------------------------------------------------------------ */
/* REAL URL ROUTING                                                    */
/* Every "view" the app already knows about (home, releases, artists,  */
/* about, events, services, donateus, admin, contact, privacy, terms)  */
/* now maps 1:1 onto a real browser URL — wildwoodrecords.in/artists,  */
/* /events, etc. — instead of only ever living at "/" behind a piece   */
/* of React state.                                                     */
/*                                                                      */
/* Deliberately minimal: rather than rewriting every page into         */
/* <Routes>/<Route> elements, AppShell's `view`/`setView` pair is kept */
/* exactly as every component already expects it — only WHERE that     */
/* pair comes from changes, from useState to the real URL via          */
/* react-router's useLocation()/useNavigate(). Nav, Footer, Home, and  */
/* every setView("x") call across the file needed zero changes.        */
/*                                                                      */
/* KNOWN_VIEWS is the single source of truth for which paths are real. */
/* Visiting anything else (a typo, an old bookmark) falls back to the  */
/* home view rather than rendering a blank page.                      */
/* ------------------------------------------------------------------ */
const KNOWN_VIEWS = new Set([
  "home", "releases", "artists", "about", "events", "services",
  "donateus", "admin", "contact", "privacy", "terms",
]);

function pathToView(pathname) {
  const id = pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  if (id === "") return "home";
  return KNOWN_VIEWS.has(id) ? id : "home";
}

function viewToPath(id) {
  return id === "home" ? "/" : `/${id}`;
}

/* ------------------------------------------------------------------ */
/* SERVICES DATA                                                       */
/* Data-driven on purpose: the Services page below only ever maps over */
/* this array, so adding, renaming, or re-ordering an offering never   */
/* touches page markup — just edit the list.                          */
/* ------------------------------------------------------------------ */
const SERVICES = [
  {
    category: "Creative Production",
    items: [
      { icon: Mic, title: "Recording", description: "Professional studio recording sessions with high-end equipment and experienced engineers." },
      { icon: Music2, title: "Music Production", description: "Custom music production, beat creation, arrangement, and sound design tailored to your style." },
      { icon: PenTool, title: "Songwriting", description: "Collaborative songwriting and lyric development to bring your creative vision to life." },
      { icon: SlidersHorizontal, title: "Mixing & Mastering", description: "Industry-standard mixing and mastering for polished, streaming-ready releases." },
      { icon: Video, title: "Music Video Production", description: "Creative concept development, filming, and cinematic music video production." },
      { icon: Film, title: "Video Editing", description: "Professional editing, transitions, visual effects, and final post-production finishing." },
      { icon: Palette, title: "Color Grading", description: "Cinematic color correction and premium visual enhancement for professional-quality videos." },
      { icon: Image, title: "Cover Art", description: "Custom-designed album covers, single artwork, promotional graphics, and digital assets." },
      { icon: BadgeCheck, title: "Artist Branding", description: "Complete artist branding, logo design, visual identity, and creative direction." },
    ],
  },
  {
    category: "Marketing & Growth",
    items: [
      { icon: Globe, title: "Distribution", description: "Worldwide digital music distribution across major streaming platforms." },
      { icon: Share2, title: "Social Media", description: "Content creation, social media strategy, scheduling, and audience engagement." },
      { icon: ListMusic, title: "Playlist Pitching", description: "Professional playlist pitching to increase reach and streaming performance." },
      { icon: Megaphone, title: "PR & Press", description: "Media outreach, press campaigns, interviews, blogs, and promotional coverage." },
    ],
  },
  {
    category: "Artist Business & Management",
    items: [
      { icon: Users, title: "Artist Management", description: "Career planning, bookings, release strategy, artist development, and long-term management." },
      { icon: FileText, title: "Contracts & Royalties", description: "Professional guidance on contracts, publishing, copyrights, licensing, and royalty administration." },
    ],
  },
];

/* ------------------------------- BACKGROUND ------------------------------- */

function FloatKeyframes() {
  return (
    <style>{`
      @keyframes wildwoodFloat {
        0%   { transform: translate3d(0, 0, 0) rotate(0deg); }
        25%  { transform: translate3d(14px, -18px, 0) rotate(3deg); }
        50%  { transform: translate3d(-6px, -30px, 0) rotate(-2deg); }
        75%  { transform: translate3d(-16px, -10px, 0) rotate(2deg); }
        100% { transform: translate3d(0, 0, 0) rotate(0deg); }
      }
      .wildwood-float {
        animation-name: wildwoodFloat;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .wildwood-float { animation: none; }
      }
    `}</style>
  );
}

function GlobalPolishStyles() {
  return (
    <style>{`
      /* THEME: page-level colors are driven by CSS variables that flip
         with the "dark" class on <html> (toggled by ThemeProvider before
         paint). Dark values are identical to the original hardcoded ones. */
      :root {
        --ww-page-bg: #fafafa;
        --ww-scrollbar-thumb: rgba(0, 0, 0, 0.22);
        --ww-scrollbar-thumb-hover: rgba(0, 0, 0, 0.38);
        color-scheme: light;
      }
      html.dark {
        --ww-page-bg: #050505;
        --ww-scrollbar-thumb: rgba(255, 255, 255, 0.16);
        --ww-scrollbar-thumb-hover: rgba(255, 255, 255, 0.28);
        color-scheme: dark;
      }
      html {
        -webkit-text-size-adjust: 100%;
        text-size-adjust: 100%;
        background-color: var(--ww-page-bg);
        height: 100%;
      }
      body {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
        overscroll-behavior-y: none;
        background-color: var(--ww-page-bg);
        min-height: 100%;
      }
      #root {
        background-color: var(--ww-page-bg);
        min-height: 100dvh;
      }
      /* THEME: smooth global cross-fade between themes (global
         transition-all / duration-300 / ease-in-out utilities). Scoped to
         color-ish properties so it can never fight the site's bespoke
         transform/opacity animations — any element- or class-level
         transition rule always wins over this universal one. */
      *, *::before, *::after {
        transition-property: background-color, border-color, color, fill, stroke, box-shadow;
        transition-duration: 300ms;
        transition-timing-function: ease-in-out;
      }
      * {
        -webkit-tap-highlight-color: transparent;
      }
      img {
        -webkit-user-drag: none;
      }

      @keyframes eqBarBounce {
        0%, 100% { transform: scaleY(0.28); }
        50% { transform: scaleY(var(--peak-scale, 0.8)); }
      }
      .eq-bar {
        animation-name: eqBarBounce;
        animation-duration: 0.9s;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
        transform-origin: bottom;
        /* Governs the settle when .is-idle drops the animation. */
        transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
      }
      /* Paused: cancel the keyframes so the transition above can take over,
         and rest at 10% height. transform-only, so it stays on the GPU. */
      .eq-bar.is-idle {
        animation: none;
        transform: scaleY(0.1);
      }
      @media (prefers-reduced-motion: reduce) {
        .eq-bar { animation: none; transition: none; transform: scaleY(0.6); }
        .eq-bar.is-idle { transform: scaleY(0.1); }
      }

      @keyframes particleOut {
        0% { transform: translate(-50%, -50%) translate(0, 0) scale(1); opacity: 0.9; }
        100% { transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
      }

      @keyframes modalIn {
        from { opacity: 0; transform: translateY(28px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .animate-modal-in {
        animation: modalIn 0.4s var(--ease-premium) forwards;
      }
      @media (prefers-reduced-motion: reduce) {
        .animate-modal-in { animation: none; }
      }

      .safe-bottom {
        padding-bottom: env(safe-area-inset-bottom, 0px);
      }

      /* --- Preloader soundwave bars --- */
      @keyframes preloaderBarBounce {
        0%, 100% { transform: scaleY(0.18); opacity: 0.5; }
        50% { transform: scaleY(var(--peak-scale, 1)); opacity: 1; }
      }
      .preloader-bar {
        animation-name: preloaderBarBounce;
        animation-duration: 1.1s;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
        transform-origin: bottom;
      }
      @media (prefers-reduced-motion: reduce) {
        .preloader-bar { animation: none; transform: scaleY(0.7); opacity: 0.8; }
      }

      /* --- Ambient drifting notes --- */
      @keyframes noteDrift {
        0%   { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
        12%  { opacity: 0.5; }
        50%  { transform: translateY(-52vh) translateX(14px) rotate(10deg); }
        88%  { opacity: 0.35; }
        100% { transform: translateY(-105vh) translateX(-12px) rotate(-8deg); opacity: 0; }
      }
      .ambient-note {
        animation-name: noteDrift;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
        will-change: transform, opacity;
      }
      @media (prefers-reduced-motion: reduce) {
        .ambient-note { animation: none; opacity: 0.06; }
      }

      /* ================================================================ */
      /* TYPOGRAPHY SYSTEM                                                 */
      /* Sans + sans pairing: Bricolage Grotesque (expressive grotesque)   */
      /* for headings/display text, Inter (neutral sans) for body copy    */
      /* and UI chrome — a characterful headline face set against a       */
      /* quiet workhorse body face, both sans-serif. Fonts are loaded via */
      /* <link> tags injected by GoogleFontsLoader (see below), since     */
      /* this project has no editable index.html to add them to directly.*/
      /* ================================================================ */
      :root {
        --font-display: "Bricolage Grotesque", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        --font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        /* One shared, premium ease-out curve used across hover/press states
           so every interaction in the site decelerates the same way. */
        --ease-premium: cubic-bezier(0.16, 1, 0.3, 1);
      }
      html {
        scroll-behavior: smooth;
      }
      body {
        font-family: var(--font-body) !important;
        font-size: 17px;
        line-height: 1.65;
      }
      /* Grotesque display family — applied to every heading/logo element
         that already carries the font-display class throughout the site.
         Bricolage Grotesque is a variable font (weight + optical size), so
         it stays crisp from small card titles up to the 100px+ hero. */
      .font-display {
        font-family: var(--font-display) !important;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      /* Fluid, clamp()-based type scale. Sizes flow smoothly between a
         mobile floor and a desktop/ultrawide ceiling instead of jumping
         at fixed Tailwind breakpoints, so the hierarchy stays proportioned
         on everything from a phone to an ultrawide monitor. Sized up a
         notch from a standard scale since the grotesque display face reads
         slightly smaller at a given font-size than the old serif did. */
      .text-hero {
        font-size: clamp(3.25rem, 1.6rem + 5.75vw, 7.75rem);
        line-height: 1.0;
        letter-spacing: -0.035em;
      }
      .text-page-title {
        font-size: clamp(3rem, 1.85rem + 4vw, 6rem);
        line-height: 1.03;
        letter-spacing: -0.025em;
      }
      .text-section-title {
        font-size: clamp(2.25rem, 1.5rem + 2.4vw, 3.5rem);
        line-height: 1.08;
        letter-spacing: -0.015em;
      }
      .text-card-title {
        font-size: clamp(1.5rem, 1.15rem + 1.2vw, 2.25rem);
        line-height: 1.12;
      }

      /* --- Static, minimal scrollbar. No JS, no animation — just a --- */
      /* --- thin, quiet track that matches the rest of the UI.      --- */
      html {
        scrollbar-width: thin;
        scrollbar-color: var(--ww-scrollbar-thumb) transparent;
      }
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background-color: var(--ww-scrollbar-thumb);
        border-radius: 999px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background-color: var(--ww-scrollbar-thumb-hover);
      }

      /* --- Scroll-triggered reveal, used on grids and lists --- */
      .reveal {
        opacity: 0;
        transform: translateY(28px);
        transition: opacity 0.7s var(--ease-premium), transform 0.7s var(--ease-premium);
        will-change: opacity, transform;
      }
      .reveal-in {
        opacity: 1;
        transform: translateY(0);
      }
      @media (max-width: 640px) {
        .reveal { transform: translateY(16px); transition-duration: 0.55s; }
      }
      @media (prefers-reduced-motion: reduce) {
        .reveal { opacity: 1; transform: none; transition: none; }
      }

      /* --- Tactile press feedback for buttons (mobile-friendly) --- */
      /* Single shared curve + slightly quicker timing makes every button, */
      /* card, and link on the site feel like part of the same system      */
      /* instead of a patchwork of separately-tuned transitions.            */
      .press-feedback {
        transition: transform 0.18s var(--ease-premium), box-shadow 0.3s var(--ease-premium), background-color 0.25s var(--ease-premium);
      }
      .press-feedback:active {
        transform: scale(0.96);
      }
        @keyframes vinylCursorSpin { to { transform: rotate(360deg); } }
.vinyl-cursor-spin { animation: vinylCursorSpin 2.6s linear infinite; }
/* THE WOW TOUCH — the record spins up when music is actually playing.
   Only the animation-duration changes, so the disc keeps its exact
   rotational position: it accelerates smoothly rather than snapping back
   to 0deg the way a keyframe swap would. */
.vinyl-cursor-spin.is-spinning { animation-duration: 0.9s; }

/* Ambient blobs "breathe" in time with playback. Scale + opacity only —
   both compositor-friendly — so three 600px blurred gradients can pulse
   without touching layout or costing a single paint. Each blob gets its
   own duration and delay so they swell out of phase, which reads as a
   room responding to sound rather than three lights on one dimmer. */
@keyframes blobBreathe {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(1.14); opacity: 1.35; }
}
.blob-breathe { animation: blobBreathe var(--blob-dur, 4.2s) ease-in-out var(--blob-delay, 0s) infinite; will-change: transform, opacity; }

@media (prefers-reduced-motion: reduce) {
  .vinyl-cursor-spin.is-spinning { animation-duration: 2.6s; }
  .blob-breathe { animation: none; }
}
/* Hide the real cursor while the vinyl disc stands in for it — but keep
   the text beam on anything you can actually type into. */
.vinyl-cursor-active, .vinyl-cursor-active * {
  cursor: none !important;
}
.vinyl-cursor-active input,
.vinyl-cursor-active textarea,
.vinyl-cursor-active select,
.vinyl-cursor-active [contenteditable="true"] {
  cursor: text !important;
}

@media (prefers-reduced-motion: reduce) {
  .vinyl-cursor-active, .vinyl-cursor-active * { cursor: auto !important; }
}

.press-feedback:hover {
  transform: translateY(-1px);
}

@media (prefers-reduced-motion: reduce) {
  .vinyl-cursor-spin { animation: none; }
  .press-feedback:hover { transform: none; }
}
    `}</style>
  );
}

/* ------------------------------------------------------------------ */
/* GOOGLE FONTS LOADER                                                  */
/* Injects the Bricolage Grotesque (sans, display/headings) and Inter   */
/* (sans, body/UI) stylesheets into <head> on mount. This project has   */
/* no editable index.html, so the <link> tags are added programmatically*/
/* instead — functionally identical to putting them in the document    */
/* head directly, just done once when the app first mounts.            */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* CRAFT STYLES — bespoke motion + surface language for the redesigned  */
/* Services grid and the Events empty state. Injected once from         */
/* AppShell, right next to GlobalPolishStyles, so both pages share one  */
/* hand-tuned source of truth for timing curves.                        */
/* ------------------------------------------------------------------ */

function CraftStyles() {
  return (
    <style>{`
      /* ============ BESPOKE CRAFT — Services & Events empty state ============
         Motion philosophy: nothing linear, nothing instant. Two custom curves
         drive every interaction so the section feels hand-tuned, not templated:
           --ease-out-expo : rapid start, long luxurious settle (card lift,
                             icon tilt, arrow nudges)
           --ease-drift    : near-frictionless glide (the watermark's slow
                             pan/zoom — the "camera move" of each card)     */
      :root {
        --ease-out-expo: cubic-bezier(0.22, 1, 0.36, 1);
        --ease-drift: cubic-bezier(0.33, 1, 0.68, 1);
      }

      /* Empty-state ornaments: a 14s halo rotation (slow enough to be felt
         rather than watched) and a soft double ping radiating outward from
         the medallion — the visual of a beacon waiting for the next show. */
      @keyframes svcHalo { to { transform: rotate(360deg); } }
      .svc-halo { animation: svcHalo 14s linear infinite; }
      @keyframes svcPing {
        0%   { transform: scale(0.7); opacity: 0.45; }
        70%  { opacity: 0; }
        100% { transform: scale(1.55); opacity: 0; }
      }
      .svc-ping { animation: svcPing 4.5s var(--ease-out-expo) infinite; }

      /* Respect users who opt out of motion — the design must still hold
         up as a purely static composition. */
      @media (prefers-reduced-motion: reduce) {
        .svc-halo, .svc-ping { animation: none; }
      }

      /* ============ EDITORIAL ABOUT + PARTNER TIER + FOOTER BRANDS ============ */
      :root { --ftr-border: rgba(0, 0, 0, 0.14); --ftr-ink: #737373; --partner-sheen: linear-gradient(105deg, transparent, rgba(0,0,0,0.05), transparent); }
      html.dark { --ftr-border: rgba(255, 255, 255, 0.14); --ftr-ink: #a3a3a3; --partner-sheen: linear-gradient(105deg, transparent, rgba(255,255,255,0.07), transparent); }

      /* Magazine drop cap on the About lede — pure CSS, inherits the
         paragraph's theme color so it flips with the toggle for free. */
      .about-lede::first-letter {
        font-family: "Bricolage Grotesque", serif;
        float: left;
        font-size: 3.4em;
        line-height: 0.82;
        padding: 0.05em 0.14em 0 0;
        font-weight: 500;
      }

      /* Partner tier: a soft light band sweeps across the card on hover —
         the "official sponsor plaque" catching the light. */
      .partner-card { position: relative; overflow: hidden; }
      .partner-sheen {
        position: absolute; top: 0; bottom: 0; width: 45%;
        background: var(--partner-sheen);
        transform: translateX(-160%) skewX(-18deg);
        transition: transform 0.9s var(--ease-out-expo);
        pointer-events: none;
      }
      .partner-card:hover .partner-sheen { transform: translateX(360%) skewX(-18deg); }

      /* Footer socials — AUTHENTIC brand hovers. Technique: the pill's
         background fills with the platform's real brand color (or the
         classic Instagram gradient — gradients can't tween, so the base
         is a flat border that simply swaps for the gradient fill) while
         the icon flips to its on-brand foreground via currentColor.
         Color/border tween on a quick ease; lift + glow ride the longer
         expo curve so the button feels like it floats up into the light. */
      .ftr-social {
        display: inline-flex; align-items: center; justify-content: center;
        width: 2.75rem; height: 2.75rem; border-radius: 9999px;
        border: 1px solid var(--ftr-border); color: var(--ftr-ink);
        transition: color 0.35s ease, border-color 0.35s ease, background 0.35s ease,
                    box-shadow 0.55s var(--ease-out-expo), transform 0.55s var(--ease-out-expo);
      }
      .ftr-social:hover { transform: translateY(-4px); } /* = hover:-translate-y-1 */
      .ftr-social.ftr-ig:hover {
        border-color: transparent; color: #fff;
        background: linear-gradient(120deg, #f9ce34, #ee2a7b, #6228d7);
        box-shadow: 0 10px 28px -6px rgba(238, 42, 123, 0.50);
      }
      .ftr-social.ftr-sp:hover {
        border-color: #1DB954; background: #1DB954; color: #04160b;
        box-shadow: 0 10px 28px -6px rgba(29, 185, 84, 0.50);
      }
      .ftr-social.ftr-yt:hover {
        border-color: #FF0000; background: #FF0000; color: #fff;
        box-shadow: 0 10px 28px -6px rgba(255, 0, 0, 0.45);
      }
      .ftr-social.ftr-email:hover {
        border-color: #737373; background: #737373; color: #fff;
        box-shadow: 0 10px 28px -6px rgba(115, 115, 115, 0.45);
      }

      /* Footer quick links: hairline underline grows from the left. */
      .ftr-link { position: relative; }
      .ftr-link::after {
        content: ""; position: absolute; left: 0; bottom: -3px;
        height: 1px; width: 100%; background: currentColor;
        transform: scaleX(0); transform-origin: left;
        transition: transform 0.5s var(--ease-out-expo);
      }
      .ftr-link:hover::after, .ftr-link:focus-visible::after { transform: scaleX(1); }

      @media (prefers-reduced-motion: reduce) {
        .ftr-social, .partner-sheen, .ftr-link::after { transition: none; }
        .ftr-social:hover { transform: none; }
      }

      /* ============ ASSAM FLOOD RELIEF — fund display ============ */
      :root  { --rlf-track: rgba(0, 0, 0, 0.10); --rlf-glow: rgba(16, 185, 129, 0.30); }
      html.dark { --rlf-track: rgba(255, 255, 255, 0.10); --rlf-glow: rgba(16, 185, 129, 0.45); }

      /* The raised figure glows like a signal, not a dashboard metric. */
      .rlf-stat { text-shadow: 0 0 34px var(--rlf-glow); }

      /* Progress: the fill eases to its width on the expo curve when the
         page mounts, and a soft shine sweeps along it — alive, not busy. */
      .rlf-bar {
        position: relative; height: 0.55rem; border-radius: 9999px;
        background: var(--rlf-track); overflow: hidden;
      }
      .rlf-fill {
        position: absolute; top: 0; bottom: 0; left: 0; border-radius: inherit;
        background: linear-gradient(90deg, #059669, #34d399);
        box-shadow: 0 0 18px var(--rlf-glow);
        transition: width 1.4s var(--ease-out-expo);
      }
      .rlf-fill::after {
        content: ""; position: absolute; inset: 0;
        background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%);
        transform: translateX(-120%);
        animation: rlfShine 3s var(--ease-drift) infinite;
      }
      @keyframes rlfShine {
        65% { transform: translateX(130%); }
        100% { transform: translateX(130%); }
      }
      @media (prefers-reduced-motion: reduce) {
        .rlf-fill { transition: none; }
        .rlf-fill::after { animation: none; }
      }
    `}</style>
  );
}

/* ------------------------------------------------------------------ */
/* SUBMISSION FORM STYLES — theme-aware skin for the full release      */
/* delivery form on the Submit Demo page. Follows the site's CSS-var   */
/* pattern: light values on :root, dark overrides on html.dark (the    */
/* class ThemeProvider toggles), so every control restyles instantly   */
/* with the theme toggle and inherits the global 300ms cross-fade.     */
/* ------------------------------------------------------------------ */

function SubmissionStyles() {
  return (
    <style>{`
      :root {
        --sub-card-bg: rgba(255, 255, 255, 0.82);
        --sub-line: linear-gradient(135deg, rgba(0,0,0,0.16), rgba(0,0,0,0.04) 40%, rgba(0,0,0,0.10));
        --sub-line-lit: linear-gradient(135deg, rgba(0,0,0,0.34), rgba(0,0,0,0.06) 45%, rgba(0,0,0,0.24));
        --sub-card-shadow: 0 24px 70px -34px rgba(0, 0, 0, 0.20);
        --sub-field-bg: #ffffff;
        --sub-field-bg-focus: #fafafa;
        --sub-field-border: rgba(0, 0, 0, 0.16);
        --sub-field-border-focus: #171717;
        --sub-field-ring: rgba(0, 0, 0, 0.06);
        --sub-text: #171717;
        --sub-placeholder: #a3a3a3;
        --sub-label: #737373;
        --sub-hint: #8a8a8a;
        --sub-chip-border: rgba(0, 0, 0, 0.15);
        --sub-chip-bg: rgba(0, 0, 0, 0.03);
        --sub-chip-text: #737373;
        --sub-chip-hover-border: rgba(0, 0, 0, 0.45);
        --sub-chip-hover-text: #171717;
        --sub-chip-on-bg: #171717;
        --sub-chip-on-text: #ffffff;
        --sub-chip-on-glow: rgba(0, 0, 0, 0.20);
        --sub-tile-bg: rgba(0, 0, 0, 0.05);
        --sub-tile-border: rgba(0, 0, 0, 0.10);
      }
      html.dark {
        --sub-card-bg: rgba(12, 12, 13, 0.72);
        --sub-line: linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.10));
        --sub-line-lit: linear-gradient(135deg, rgba(255,255,255,0.40), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0.26));
        --sub-card-shadow: 0 24px 70px -30px rgba(0, 0, 0, 0.9);
        --sub-field-bg: rgba(0, 0, 0, 0.45);
        --sub-field-bg-focus: rgba(255, 255, 255, 0.04);
        --sub-field-border: rgba(255, 255, 255, 0.10);
        --sub-field-border-focus: rgba(255, 255, 255, 0.85);
        --sub-field-ring: rgba(255, 255, 255, 0.06);
        --sub-text: #ffffff;
        --sub-placeholder: #525252;
        --sub-label: #8a8a8a;
        --sub-hint: #6b6b6b;
        --sub-chip-border: rgba(255, 255, 255, 0.12);
        --sub-chip-bg: rgba(255, 255, 255, 0.03);
        --sub-chip-text: #a3a3a3;
        --sub-chip-hover-border: rgba(255, 255, 255, 0.35);
        --sub-chip-hover-text: #ffffff;
        --sub-chip-on-bg: #ffffff;
        --sub-chip-on-text: #000000;
        --sub-chip-on-glow: rgba(255, 255, 255, 0.22);
        --sub-tile-bg: rgba(255, 255, 255, 0.06);
        --sub-tile-border: rgba(255, 255, 255, 0.12);
      }

      /* ---------- glass section cards (mask-trick gradient hairline) ---------- */
      .sub-card {
        position: relative;
        border-radius: 1.75rem;
        background: var(--sub-card-bg);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        box-shadow: var(--sub-card-shadow);
      }
      .sub-card::before, .sub-card::after {
        content: ""; position: absolute; inset: 0; border-radius: inherit;
        padding: 1px; pointer-events: none;
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        mask-composite: exclude;
      }
      .sub-card::before { background: var(--sub-line); }
      .sub-card::after {
        background: var(--sub-line-lit);
        opacity: 0; transition: opacity 0.6s var(--ease-premium);
      }
      /* the card "wakes up" while you're working inside it */
      .sub-card:focus-within::after { opacity: 1; }

      .sub-tile {
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: 1.1rem;
        background: var(--sub-tile-bg);
        border: 1px solid var(--sub-tile-border);
        color: var(--sub-text);
      }

      /* ---------- labels & inputs ---------- */
      .sub-label {
        display: inline-flex; align-items: baseline; gap: 0.3rem;
        font-size: 0.68rem; font-weight: 700; letter-spacing: 0.22em;
        text-transform: uppercase; color: var(--sub-label);
      }
      .sub-req { color: #f59e0b; } /* amber = the site's required marker */
      .sub-hint { font-size: 0.72rem; color: var(--sub-hint); line-height: 1.5; }

      .sub-input {
        width: 100%;
        background: var(--sub-field-bg);
        border: 1px solid var(--sub-field-border);
        border-radius: 1rem;
        padding: 0.95rem 1.15rem;
        color: var(--sub-text); font-size: 0.9rem;
        transition: border-color 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease;
      }
      .sub-input::placeholder { color: var(--sub-placeholder); }
      .sub-input:focus {
        outline: none;
        border-color: var(--sub-field-border-focus);
        background: var(--sub-field-bg-focus);
        box-shadow: 0 0 0 4px var(--sub-field-ring);
      }
      select.sub-input { appearance: none; -webkit-appearance: none; padding-right: 2.8rem; cursor: pointer; }
      html.dark select.sub-input option { background: #0b0b0c; color: #fff; }
      /* native date picker follows the page via color-scheme (GlobalPolishStyles) */
      html.dark input[type="date"].sub-input::-webkit-calendar-picker-indicator {
        filter: invert(1); opacity: 0.55;
      }
      input[type="date"].sub-input::-webkit-calendar-picker-indicator { cursor: pointer; }

      /* ---------- custom chips (native inputs kept, browser UI hidden) ---------- */
      .sub-chip { position: relative; display: inline-block; }
      .sub-chip-input { position: absolute; inset: 0; opacity: 0; pointer-events: none; }
      .sub-chip-face {
        display: inline-flex; align-items: center; gap: 0.6rem;
        padding: 0.72rem 1.15rem; border-radius: 9999px; cursor: pointer;
        border: 1px solid var(--sub-chip-border);
        background: var(--sub-chip-bg);
        color: var(--sub-chip-text); font-size: 0.72rem; font-weight: 700;
        letter-spacing: 0.14em; text-transform: uppercase;
        transition: color 0.3s ease, border-color 0.3s ease, background-color 0.3s ease,
                    box-shadow 0.45s var(--ease-out-expo), transform 0.45s var(--ease-out-expo);
        user-select: none;
      }
      .sub-chip-face:hover {
        color: var(--sub-chip-hover-text);
        border-color: var(--sub-chip-hover-border);
        transform: translateY(-1px);
      }
      .sub-chip-box {
        display: inline-flex; align-items: center; justify-content: center;
        width: 1.05rem; height: 1.05rem; border-radius: 9999px;
        border: 1.5px solid var(--sub-chip-box, currentColor); color: transparent;
        transition: all 0.35s var(--ease-out-expo);
      }
      .sub-chip-input:checked + .sub-chip-face {
        background: var(--sub-chip-on-bg); color: var(--sub-chip-on-text);
        border-color: var(--sub-chip-on-bg);
        box-shadow: 0 0 22px var(--sub-chip-on-glow);
      }
      .sub-chip-input:checked + .sub-chip-face .sub-chip-box {
        border-color: var(--sub-chip-on-text); color: var(--sub-chip-on-text); transform: scale(1.05);
      }
      .sub-chip-input:focus-visible + .sub-chip-face {
        outline: 2px solid var(--sub-field-border-focus); outline-offset: 2px;
      }

      .sub-error {
        display: inline-flex; align-items: center; gap: 0.4rem;
        color: #ef4444; font-size: 0.75rem; font-weight: 500;
      }
      html.dark .sub-error { color: #fca5a5; }

      @media (prefers-reduced-motion: reduce) {
        .sub-chip-face { transition: none; }
      }
    `}</style>
  );
}
function GoogleFontsLoader() {
  useEffect(() => {
    const existing = document.getElementById("wildwood-google-fonts");
    if (existing) return;

    const preconnect1 = document.createElement("link");
    preconnect1.rel = "preconnect";
    preconnect1.href = "https://fonts.googleapis.com";

    const preconnect2 = document.createElement("link");
    preconnect2.rel = "preconnect";
    preconnect2.href = "https://fonts.gstatic.com";
    preconnect2.crossOrigin = "anonymous";

    const fontLink = document.createElement("link");
    fontLink.id = "wildwood-google-fonts";
    fontLink.rel = "stylesheet";
    fontLink.href =
      "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Inter:wght@300;400;500;600;700&display=swap";

    document.head.appendChild(preconnect1);
    document.head.appendChild(preconnect2);
    document.head.appendChild(fontLink);
  }, []);

  return null;
}

/* 20 scattered icons. Declared as data (not 20 hand-written JSX lines) so
   density is a one-line change, and every value is FIXED rather than
   random — random positions would differ between server and client render
   and cause a hydration mismatch, plus they'd reshuffle on every remount.
   Positions are hand-spaced to avoid clustering behind the hero copy. */
const FLOATING_ICONS = [
  { Icon: Disc3,      top: "22%", left: "14%",  size: 64, op: 0.06, dur: "16s", delay: "0s" },
  { Icon: Headphones, top: "62%", left: "18%",  size: 46, op: 0.06, dur: "14s", delay: "1.2s" },
  { Icon: Radio,      top: "78%", left: "76%",  size: 50, op: 0.05, dur: "17s", delay: "2.4s" },
  { Icon: Music2,     top: "6%",  left: "62%",  size: 80, op: 0.03, dur: "19s", delay: "0.6s" },
  { Icon: Disc3,      top: "86%", left: "42%",  size: 30, op: 0.05, dur: "12s", delay: "3.1s" },
  { Icon: Mic,        top: "38%", left: "52%",  size: 34, op: 0.05, dur: "13s", delay: "1.8s" },
  { Icon: Music,      top: "14%", left: "9%",   size: 38, op: 0.05, dur: "12s", delay: "2.9s" },
  { Icon: ListMusic,  top: "30%", left: "84%",  size: 42, op: 0.05, dur: "15s", delay: "0.3s" },
  { Icon: Mic,        top: "8%",  left: "34%",  size: 26, op: 0.04, dur: "18s", delay: "4.2s" },
  { Icon: Headphones, top: "48%", left: "5%",   size: 56, op: 0.04, dur: "20s", delay: "2.1s" },
  { Icon: Music2,     top: "70%", left: "58%",  size: 28, op: 0.05, dur: "11s", delay: "3.7s" },
  { Icon: Disc3,      top: "54%", left: "34%",  size: 44, op: 0.035, dur: "21s", delay: "1.1s" },
  { Icon: Radio,      top: "17%", left: "47%",  size: 32, op: 0.04, dur: "16s", delay: "5.0s" },
  { Icon: Music,      top: "92%", left: "12%",  size: 36, op: 0.05, dur: "13s", delay: "0.9s" },
  { Icon: ListMusic,  top: "82%", left: "90%",  size: 30, op: 0.04, dur: "14s", delay: "2.6s" },
  { Icon: Music2,     top: "44%", left: "68%",  size: 52, op: 0.035, dur: "22s", delay: "3.4s" },
  { Icon: Mic,        top: "66%", left: "92%",  size: 38, op: 0.045, dur: "15s", delay: "1.5s" },
  { Icon: Disc3,      top: "2%",  left: "80%",  size: 34, op: 0.04, dur: "17s", delay: "4.6s" },
  { Icon: Headphones, top: "34%", left: "26%",  size: 24, op: 0.045, dur: "12s", delay: "2.2s" },
  { Icon: Music,      top: "58%", left: "44%",  size: 60, op: 0.03, dur: "23s", delay: "0.4s" },
];

/* `isPlaying` drives THE WOW TOUCH: the three ambient gradient blobs
   breathe in and out while a track runs, so the whole page feels like a
   room reacting to the music. Out-of-phase durations keep it organic. */
const FloatingBackground = memo(function FloatingBackground({ isPlaying = false }) {
  const { isDark } = useTheme();
  const iconTone = isDark ? "text-neutral-300" : "text-neutral-500";
  const breathe = isPlaying ? "blob-breathe" : "";
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <FloatKeyframes />
      <div
        className={`absolute -top-40 left-[8%] w-[560px] h-[560px] rounded-full blur-[10px] ${breathe} ${isDark ? "bg-[radial-gradient(circle,rgba(200,200,205,0.10),transparent_70%)]" : "bg-[radial-gradient(circle,rgba(60,60,70,0.07),transparent_70%)]"}`}
        style={{ "--blob-dur": "4.2s", "--blob-delay": "0s" }}
      />
      <div
        className={`absolute top-[45%] right-[4%] w-[480px] h-[480px] rounded-full blur-[10px] ${breathe} ${isDark ? "bg-[radial-gradient(circle,rgba(180,180,190,0.08),transparent_70%)]" : "bg-[radial-gradient(circle,rgba(60,60,70,0.06),transparent_70%)]"}`}
        style={{ "--blob-dur": "5.6s", "--blob-delay": "0.8s" }}
      />
      <div
        className={`absolute bottom-[-10%] left-[30%] w-[620px] h-[620px] rounded-full blur-[10px] ${breathe} ${isDark ? "bg-[radial-gradient(circle,rgba(160,160,170,0.06),transparent_70%)]" : "bg-[radial-gradient(circle,rgba(60,60,70,0.05),transparent_70%)]"}`}
        style={{ "--blob-dur": "3.4s", "--blob-delay": "1.6s" }}
      />
      <div className={isDark ? "absolute inset-0 opacity-[0.05]" : "absolute inset-0 opacity-[0.06]"} style={{ backgroundImage: isDark ? "radial-gradient(rgba(255,255,255,0.9) 0.6px, transparent 0.6px)" : "radial-gradient(rgba(0,0,0,0.75) 0.6px, transparent 0.6px)", backgroundSize: "26px 26px" }} />
      {FLOATING_ICONS.map(({ Icon, top, left, size, op, dur, delay }, i) => (
        <Icon
          key={i}
          size={size}
          strokeWidth={size > 55 ? 0.5 : 0.75}
          className={`absolute ${iconTone} wildwood-float`}
          style={{ top, left, opacity: op, animationDuration: dur, animationDelay: delay }}
        />
      ))}
    </div>
  );
});

/* Subtle drifting musical notes — a lightweight, CSS-only ambient layer that rises
   and fades behind the content. Positions/durations are fixed (not random) so there's
   no hydration/flicker risk, just gentle, endless variety across the viewport. */
const AMBIENT_NOTES = [
  { left: "4%", size: 20, duration: "24s", delay: "0s", glyph: "\u266A" },
  { left: "13%", size: 14, duration: "19s", delay: "3s", glyph: "\u266B" },
  { left: "27%", size: 24, duration: "27s", delay: "7s", glyph: "\u266A" },
  { left: "41%", size: 16, duration: "21s", delay: "1.5s", glyph: "\u2669" },
  { left: "58%", size: 22, duration: "25s", delay: "5s", glyph: "\u266B" },
  { left: "71%", size: 15, duration: "20s", delay: "9s", glyph: "\u266A" },
  { left: "84%", size: 26, duration: "28s", delay: "2.5s", glyph: "\u2669" },
  { left: "93%", size: 17, duration: "22s", delay: "6.5s", glyph: "\u266B" },
];

const AmbientNotes = memo(function AmbientNotes() {
  const { isDark } = useTheme();
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {AMBIENT_NOTES.map((n, i) => (
        <span
          key={i}
          className={`ambient-note absolute bottom-[-8%] select-none ${isDark ? "text-white" : "text-neutral-900"}`}
          style={{ left: n.left, fontSize: n.size, opacity: 0.12, animationDuration: n.duration, animationDelay: n.delay }}
        >
          {n.glyph}
        </span>
      ))}
    </div>
  );
});

/* ------------------------------- SIGNATURE: EQ BARS ------------------------------- */
const EQBars = memo(function EQBars({ count = 5, className = "", tall = false, onMedia = false, isPlaying = true, color = null }) {
  /* `onMedia` forces the original white bars when they sit on top of cover
     art, where the imagery (not the theme) dictates contrast.

     `isPlaying=false` doesn't freeze or unmount the bars — it drops the
     keyframe animation and lets them ease down to a 10% resting height
     (see .eq-bar / .is-idle in GlobalPolishStyles). Playback pausing then
     reads as the meter settling, the way real hardware decays, instead of
     the UI blinking out. Staggered transition delays make them settle in
     sequence rather than as one block. */
  const { isDark } = useTheme();
  const light = !isDark && !onMedia;
  const peaks = [0.4, 0.8, 0.55, 0.95, 0.65, 0.35, 0.75];
   return (
    <div className={`flex items-end gap-[3px] ${tall ? "h-6" : "h-3.5"} ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full eq-bar will-change-transform ${isPlaying ? "" : "is-idle"} ${
            color ? "" : light ? "bg-neutral-900 shadow-[0_0_6px_1px_rgba(0,0,0,0.28)]" : "bg-white shadow-[0_0_6px_1px_rgba(255,255,255,0.55)]"
          }`}
          style={{
            animationDelay: `${i * 0.14}s`,
            transitionDelay: `${i * 0.05}s`,
            "--peak-scale": peaks[i % peaks.length],
            ...(color ? { backgroundColor: color, boxShadow: `0 0 8px 2px ${color}aa, 0 0 20px 6px ${color}55` } : {}),
          }}
        />
      ))}
    </div>
  );
});

const SERVICE_ACCENTS = {
  "Recording": "#E0524F",              // garnet red
  "Music Production": "#DD8548",       // burnished copper
  "Songwriting": "#D6B24E",            // antique gold
  "Mixing & Mastering": "#9CAE4C",     // olive chartreuse
  "Music Video Production": "#42AD79", // emerald
  "Video Editing": "#31A99C",          // deep teal
  "Color Grading": "#3AA3C4",          // teal-blue
  "Cover Art": "#4A86D6",              // sapphire
  "Artist Branding": "#6E74D9",        // indigo
  "Distribution": "#8B6CDB",           // violet
  "Social Media": "#AD6CD4",           // orchid
  "Playlist Pitching": "#CC62B8",      // magenta
  "PR & Press": "#DB5C8C",             // rose
  "Artist Management": "#D6A03E",      // bronze-amber
  "Contracts & Royalties": "#7C8798",  // slate
};
const getAccent = (title) => SERVICE_ACCENTS[title] || "#10b981";
/* ---------------------------- PAGE TRANSITIONS ----------------------------
   Replaces the CSS-only .view-transition with a Framer Motion presence
   animation, so the OUTGOING page finishes leaving before the next one
   arrives (AnimatePresence mode="wait" — no cross-fade mush).

   The move is deliberately small and expensive-feeling: an 8px rise, a
   0.6% scale-up, and a 6px blur burning off. Blur is the ingredient that
   reads as cinematic — like a lens pulling focus — but it's also the
   costliest to composite, so it only animates on the wrapper (one layer),
   never per-child, and exits faster than it enters (0.28s vs 0.5s) because
   audiences forgive a quick exit but notice a slow one.

   Everything animated here is transform/filter/opacity only: no layout,
   no paint of children, so it stays on the compositor at 60fps. */
/* ---------------------------- PAGE TRANSITIONS ----------------------------
   Cinematic "Rack Focus" transition. Uses a deep 16px blur paired with a 
   subtle Z-axis scale shift to mimic a camera lens pulling focus between 
   scenes, staying entirely on the GPU for 60fps performance. 
-------------------------------------------------------------------------- */
const PAGE_EASE = [0.22, 1, 0.36, 1];

const pageVariants = {
  initial: { 
    opacity: 0, 
    filter: "blur(16px)", 
    scale: 0.95, 
    y: 12 
  },
  animate: {
    opacity: 1, 
    filter: "blur(0px)", 
    scale: 1, 
    y: 0,
    transition: { 
      duration: 0.85, 
      ease: PAGE_EASE, 
      opacity: { duration: 0.5, ease: "linear" },
      filter: { duration: 0.85, ease: "easeOut" }
    },
  },
  exit: {
    opacity: 0, 
    filter: "blur(12px)", 
    scale: 1.03, 
    y: -12,
    transition: { duration: 0.4, ease: [0.4, 0, 1, 1] },
  },
};

/* Respect prefers-reduced-motion: keep the fade (it aids orientation),
   drop the movement and the blur. */
const pageVariantsReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const PageWrapper = memo(function PageWrapper({ children, className = "" }) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.main
      variants={reduced ? pageVariantsReduced : pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      /* Promote to its own layer for the duration of the transition */
      style={{ willChange: "transform, opacity, filter" }}
      className={`relative z-10 pb-16 md:pb-0 ${className}`}
    >
      {children}
    </motion.main>
  );
});
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);
  return reduced;
}

/* ------------------------------- SCROLL REVEAL ------------------------------- */

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(node);
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}

const Reveal = memo(function Reveal({ children, className = "", delay = 0, as: Tag = "div" }) {
  const [ref, inView] = useInView();
  return (
    <Tag
      ref={ref}
      className={`reveal ${inView ? "reveal-in" : ""} ${className}`}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
});

/* ------------------------------- PRELOADER ------------------------------- */

const PRELOADER_PEAKS = [0.5, 0.9, 0.65, 1, 0.6, 0.85, 0.45];

function Preloader({ visible }) {
  const { isDark } = useTheme();
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading Wildwood Records"
      aria-hidden={!visible}
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center ${isDark ? "bg-[#050505]" : "bg-[#fafafa]"} transition-opacity duration-700 ease-out ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="relative mb-8 md:mb-10">
        <div className={`absolute inset-0 rounded-full blur-2xl scale-[2.2] animate-pulse ${isDark ? "bg-white/10" : "bg-neutral-900/10"}`} />
        <img
          src={myLogo}
          alt=""
          className={`relative w-14 h-14 md:w-16 md:h-16 object-contain ${isDark ? "drop-shadow-[0_0_22px_rgba(255,255,255,0.4)]" : "brightness-0 drop-shadow-[0_0_22px_rgba(0,0,0,0.18)]"}`}
        />
      </div>

      <div className="flex items-end gap-[5px] h-9 md:h-10">
        {PRELOADER_PEAKS.map((peak, i) => (
          <span
            key={i}
            className={`w-[4px] md:w-[5px] rounded-full preloader-bar ${isDark ? "bg-white shadow-[0_0_8px_1px_rgba(255,255,255,0.5)]" : "bg-neutral-900 shadow-[0_0_8px_1px_rgba(0,0,0,0.25)]"}`}
            style={{ animationDelay: `${i * 0.09}s`, "--peak-scale": peak }}
          />
        ))}
      </div>

      <p className="mt-7 md:mt-8 text-xs md:text-sm tracking-[0.3em] uppercase text-neutral-500 font-semibold">
        Wildwood Records
      </p>
    </div>
  );
}

/* ------------------------------- SHARED BITS ------------------------------- */

function Eyebrow({ children }) {
  const { isDark } = useTheme();
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className={`w-8 h-px bg-gradient-to-r to-transparent ${isDark ? "from-neutral-300" : "from-neutral-500"}`} />
      <span className={`text-xs sm:text-sm tracking-[0.25em] uppercase font-medium ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>{children}</span>
    </div>
  );
}

/* Pass `href` to render a real anchor (mailto:, tel:, external links) with
   the exact same styling; otherwise it stays a <button>. Using the correct
   element matters: anchors are long-pressable on mobile, announce as links
   to screen readers, and let the OS hand mailto:/tel: to the right app. */
function PrimaryButton({ children, onClick, href, className = "", icon: Icon = ArrowRight }) {
  const { isDark } = useTheme();
  const cls = `group press-feedback inline-flex justify-center items-center gap-2 px-6 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold tracking-wide uppercase rounded-full transition-[background-color,box-shadow] duration-300 ${isDark ? "bg-white text-black hover:bg-neutral-200 hover:shadow-[0_0_24px_rgba(255,255,255,0.25)]" : "bg-neutral-900 text-white hover:bg-black hover:shadow-[0_0_24px_rgba(0,0,0,0.25)]"} ${className}`;
  const inner = (
    <>
      {children}
      <Icon size={16} className="transition-transform duration-300 will-change-transform group-hover:translate-x-0.5" />
    </>
  );
  if (href) return <a href={href} className={cls}>{inner}</a>;
  return <button onClick={onClick} className={cls}>{inner}</button>;
}

function GhostButton({ children, onClick, href, className = "" }) {
  const { isDark } = useTheme();
  const cls = `press-feedback inline-flex justify-center items-center gap-2 border px-6 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold tracking-wide uppercase rounded-full transition-all duration-300 ${isDark ? "border-neutral-700 text-white hover:border-white hover:text-black hover:bg-white" : "border-neutral-300 text-neutral-900 hover:border-neutral-900 hover:text-white hover:bg-neutral-900"} ${className}`;
  if (href) return <a href={href} className={cls}>{children}</a>;
  return <button onClick={onClick} className={cls}>{children}</button>;
}

const NewsletterForm = memo(function NewsletterForm({ compact = false }) {
  const { isDark } = useTheme();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_key: "5c65cafd-afcc-4079-b9c3-59cf1e9d02f9",
          subject: "New Newsletter Signup — Wildwood Records",
          from_name: "Wildwood Records Newsletter",
          email,
          message: `New subscriber: ${email}`,
        }),
      });
      const data = await response.json();

      if (data.success) {
        setSent(true);
        setEmail("");
        setTimeout(() => setSent(false), 3500);
      } else {
        toast.error(data.message || "Couldn't subscribe — please try again.");
      }
    } catch (err) {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={submit} className={`flex ${compact ? "flex-col sm:flex-row" : "flex-col sm:flex-row"} gap-3 w-full relative z-10`}>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        aria-label="Email address"
        disabled={isSending}
        className={`flex-1 backdrop-blur-md border rounded-full px-5 py-3 text-sm focus:outline-none transition-colors duration-300 disabled:opacity-60 ${isDark ? "bg-black/50 border-neutral-700 text-white placeholder-neutral-500 focus:border-white" : "bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 shadow-sm"}`}
      />
      <button
        type="submit"
        disabled={isSending}
        className={`inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold tracking-wide uppercase rounded-full transition-[background-color,box-shadow] duration-300 whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed ${isDark ? "bg-white text-black hover:bg-neutral-200 hover:shadow-[0_0_24px_rgba(255,255,255,0.25)]" : "bg-neutral-900 text-white hover:bg-black hover:shadow-[0_0_24px_rgba(0,0,0,0.25)]"}`}
      >
        {isSending ? "Sending…" : sent ? "Subscribed" : "Subscribe"}
        {!isSending && !sent && <ArrowRight size={15} />}
        {isSending && <Loader2 size={15} className="animate-spin" />}
      </button>
    </form>
  );
});
/* ------------------------------- CLICK BURST HANDLER ------------------------------- */

function ClickBurstProvider({ children }) {
  const { isDark } = useTheme();
  const [particles, setParticles] = useState([]);
  const [rings, setRings] = useState([]);

  const triggerBurst = useCallback((e) => {
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;

    const particleCount = 8;
    const newParticles = Array.from({ length: particleCount }).map((_, i) => {
      const angle = (i / particleCount) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
      const velocity = 50 + Math.random() * 70;
      const size = 2 + Math.random() * 4;
      return { id: `${Date.now()}-${i}-${Math.random()}`, x, y, size, dx: `${Math.cos(angle) * velocity}px`, dy: `${Math.sin(angle) * velocity}px` };
    });

    setParticles((prev) => [...prev, ...newParticles]);
    setTimeout(() => { setParticles((prev) => prev.slice(particleCount)); }, 800);

    const ringId = `${Date.now()}-ring-${Math.random()}`;
    setRings((prev) => [...prev, { id: ringId, x, y }]);
    setTimeout(() => { setRings((prev) => prev.filter((r) => r.id !== ringId)); }, 550);
  }, []);

  return (
    <div onClick={triggerBurst} className="relative w-full min-h-screen">
      <style>{`
        @keyframes clickRingPulse { 0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0.9; } 100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; } }
        @keyframes clickDotPulse { 0% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(0.4); opacity: 0; } }
        button:not(:disabled), a, [role="button"], input[type="submit"], input[type="button"] { cursor: pointer; }
      `}</style>
      {children}
      {rings.map((r) => (
        <span key={r.id} aria-hidden="true" className={`absolute pointer-events-none rounded-full border ${isDark ? "border-white/80" : "border-neutral-900/60"}`} style={{ left: r.x, top: r.y, width: "36px", height: "36px", boxShadow: isDark ? "0 0 16px rgba(255,255,255,0.35)" : "0 0 16px rgba(0,0,0,0.22)", animation: "clickRingPulse 550ms ease-out forwards" }} />
      ))}
      {rings.map((r) => (
        <span key={`${r.id}-dot`} aria-hidden="true" className={`absolute pointer-events-none rounded-full ${isDark ? "bg-white" : "bg-neutral-900"}`} style={{ left: r.x, top: r.y, width: "6px", height: "6px", boxShadow: isDark ? "0 0 10px rgba(255,255,255,0.6)" : "0 0 10px rgba(0,0,0,0.35)", animation: "clickDotPulse 550ms ease-out forwards" }} />
      ))}
      {particles.map((p) => (
        <span key={p.id} className={`click-burst-particle absolute pointer-events-none rounded-full ${isDark ? "bg-white/60 shadow-[0_0_6px_rgba(255,255,255,0.6)]" : "bg-neutral-900/50 shadow-[0_0_6px_rgba(0,0,0,0.35)]"}`} style={{ left: p.x, top: p.y, width: `${p.size}px`, height: `${p.size}px`, "--dx": p.dx, "--dy": p.dy, transform: "translate(-50%, -50%)", animation: "particleOut 0.8s cubic-bezier(0.1, 0.8, 0.3, 1) forwards" }} />
      ))}
    </div>
  );
}

/* ------------------------------- NAV ------------------------------- */

const Nav = memo(function Nav({ view, setView }) {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id) => {
    setView(id);
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-[background-color,border-color] duration-300 ${scrolled ? (isDark ? "bg-black/80 backdrop-blur-xl border-b border-white/10 shadow-[0_1px_0_rgba(255,255,255,0.04)]" : "bg-white/85 backdrop-blur-xl border-b border-neutral-200/90 shadow-[0_1px_0_rgba(0,0,0,0.03)]") : "bg-transparent border-b border-transparent"}`}>
      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-10 flex items-center justify-between h-20">
        
        {/* Logo & Conditional Mobile Back Button */}
        <div className="flex items-center gap-3 min-w-0">
          {view !== "home" && (
            <button
              onClick={() => go("home")}
              className={`lg:hidden flex items-center justify-center w-9 h-9 rounded-full shrink-0 transition-colors ${isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-neutral-900/5 text-neutral-900 hover:bg-neutral-900/10"}`}
              aria-label="Back to home"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <button onClick={() => go("home")} className="flex items-center gap-3 group shrink-0 min-w-0">
            <img src={myLogo} alt="Wildwood Records Logo" className={`w-9 h-9 md:w-10 md:h-10 object-contain shrink-0 transition-transform duration-500 will-change-transform group-hover:scale-95 ${isDark ? "" : "brightness-0"}`} />
            <span className={`font-display text-base sm:text-lg md:text-2xl tracking-wide whitespace-nowrap ${isDark ? "text-white" : "text-neutral-900"}`}>WILDWOOD RECORDS</span>
          </button>
        </div>

        <nav className="hidden lg:flex items-center gap-10">
          {NAV_ITEMS.filter((n) => n.id !== "contact").map((item) => (
            <button key={item.id} onClick={() => go(item.id)} className={`text-sm tracking-wide uppercase transition-colors duration-300 relative pb-1 ${view === item.id ? (isDark ? "text-white" : "text-neutral-900") : isDark ? "text-neutral-400 hover:text-white" : "text-neutral-500 hover:text-neutral-900"}`}>
              {item.label}
              {/* urgency marker: a live emerald ping — quiet but impossible to miss */}
              {item.accent && (
                <span className="absolute -top-0.5 -right-2.5 flex h-1.5 w-1.5" aria-hidden="true">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
              )}
              {/* Shared-layout underline: because every active state renders
                  the SAME layoutId, Framer Motion measures the old and new
                  positions and tweens the element between them — the bar
                  glides across the nav instead of snapping. Spring (not
                  duration) so travel across four links feels as natural as
                  travel across one. */}
              {view === item.id && (
                <motion.span
                  layoutId="nav-indicator"
                  className={`absolute -bottom-[1px] left-0 right-0 h-px bg-gradient-to-r from-transparent to-transparent ${isDark ? "via-white" : "via-neutral-900"}`}
                  transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.8 }}
                />
              )}
            </button>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-4">
          <ThemeToggle />
          <button onClick={() => go("contact")} className={`press-feedback inline-flex items-center gap-2 border px-5 py-2.5 text-xs font-semibold tracking-[0.15em] uppercase rounded-full transition-[background-color,border-color,box-shadow] duration-300 ${isDark ? "border-neutral-700 text-white hover:border-white hover:bg-white hover:text-black hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]" : "border-neutral-300 text-neutral-900 hover:border-neutral-900 hover:bg-neutral-900 hover:text-white hover:shadow-[0_0_20px_rgba(0,0,0,0.2)]"}`}>
            <UploadCloud size={14} /> Submit Demo
          </button>
        </div>

        <div className="lg:hidden flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <button
  onClick={() => setOpen(!open)}
  className={`relative w-9 h-9 -mr-1 flex items-center justify-center ${isDark ? "text-white" : "text-neutral-900"}`}
  aria-label={open ? "Close menu" : "Open menu"}
  aria-expanded={open}
>
  <span aria-hidden="true" className="relative w-6 h-5 block">
    <span className={`absolute left-0 w-6 h-[2px] rounded-full bg-current transition-all duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0 rotate-0"}`} />
    <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-6 h-[2px] rounded-full bg-current transition-all duration-200 ease-out ${open ? "opacity-0 scale-x-0" : "opacity-100 scale-x-100"}`} />
    <span className={`absolute left-0 w-6 h-[2px] rounded-full bg-current transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "bottom-1/2 translate-y-1/2 -rotate-45" : "bottom-0 rotate-0"}`} />
  </span>
</button>
        </div>
      </div>

      <div aria-hidden={!open} className={`lg:hidden absolute top-full left-0 right-0 origin-top backdrop-blur-2xl border-b will-change-transform ${isDark ? "bg-black/95 border-white/10" : "bg-white/95 border-neutral-200"} transition-[opacity,transform,visibility] duration-300 ease-out ${open ? "opacity-100 visible translate-y-0 scale-y-100 pointer-events-auto" : "opacity-0 invisible -translate-y-2 scale-y-95 pointer-events-none"}`}>
        <div className="flex flex-col px-6 py-4 gap-1">
         {NAV_ITEMS.map((item, i) => (
  <button
    key={item.id}
    onClick={() => go(item.id)}
    style={{ transitionDelay: open ? `${60 + i * 35}ms` : "0ms" }}
    className={`text-left py-4 text-sm tracking-wide uppercase border-b last:border-none transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3"} ${isDark ? "border-neutral-900/50" : "border-neutral-200/80"} ${view === item.id ? (isDark ? "text-white font-bold" : "text-neutral-900 font-bold") : isDark ? "text-neutral-400" : "text-neutral-500"}`}>
              {item.label}
              {item.accent && (
                <span className="relative ml-2.5 inline-flex h-1.5 w-1.5 align-middle" aria-hidden="true">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
});


/* ------------------------------- FOOTER ------------------------------- */

/* ------------------------------- FOOTER ------------------------------- */

/* ------------------------------- FOOTER ------------------------------- */

/* ------------------------------------------------------------------ */
/* LOCAL LINKEDIN ICON — same hand-drawn style as the Instagram/       */
/* YouTube/Spotify icons already defined in this file.                 */
/* ------------------------------------------------------------------ */
function LinkedInIcon({ size = 14, className = "", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.44-2.14 2.94v5.66H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zM7.11 20.45H3.56V9h3.55v11.45z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* DEV CREDITS — premium signature badge, tuned to feel alive on touch */
/* devices too. Three layers of "expensive":                           */
/*   1. A slow-rotating conic-gradient hairline traces the pill's edge  */
/*      PERMANENTLY (not just on hover) — the ambient shimmer premium   */
/*      products use, identical on mobile and desktop, no pointer       */
/*      required.                                                       */
/*   2. Each name gets its own soft glow-pulsing dot, staggered by      */
/*      index, so the row visibly breathes with zero interaction.       */
/*   3. Tapping (mobile) or hovering (desktop) a name — driven by BOTH   */
/*      Framer Motion's onHoverStart/End AND onTapStart/onTap, so touch  */
/*      gets the exact same payoff a cursor does — flares to full        */
/*      brightness in that developer's accent color, reveals their       */
/*      LinkedIn glyph, grows an accent-colored underline, and dims      */
/*      the other two names. The tap state auto-releases after a beat    */
/*      so it reads as a deliberate flash, not a stuck toggle.           */
/* ------------------------------------------------------------------ */
const DEV_ACCENTS = ["#34d399", "#38bdf8", "#f472b6"]; // emerald / sky / pink — one per name, cycling

const DevCreditsBadge = memo(function DevCreditsBadge({ developers }) {
  const { isDark } = useTheme();
  const [activeIdx, setActiveIdx] = useState(null);

  return (
    <div className="relative inline-block">
      <style>{`
        @keyframes devBorderSpin { to { transform: rotate(360deg); } }
        .dev-badge-border { animation: devBorderSpin 6s linear infinite; }
        @keyframes devNamePulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.35); }
        }
        .dev-name-pulse { animation: devNamePulse 2.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .dev-badge-border { animation: none; }
          .dev-name-pulse { animation: none; opacity: 0.85; }
        }
      `}</style>

      {/* Layer 1 — the permanent rotating hairline. A conic gradient sits
          behind an opaque glass panel, so only a thin arc of it is ever
          visible at once — the "spinning border" premium badges use,
          built from two stacked layers rather than a border-image hack. */}
      <div
        aria-hidden="true"
        className="dev-badge-border pointer-events-none absolute -inset-px rounded-full opacity-70"
        style={{
          background: `conic-gradient(from 0deg, transparent 0%, ${isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.55)"} 8%, transparent 24%, transparent 100%)`,
        }}
      />

      <div
        className={`relative flex flex-col sm:flex-row items-center justify-center gap-x-6 gap-y-3 px-8 py-4 rounded-full border backdrop-blur-xl transition-all duration-700 ${
          isDark
            ? "bg-black/60 border-white/10 shadow-[0_0_50px_-15px_rgba(255,255,255,0.12)]"
            : "bg-white/70 border-black/10 shadow-[0_0_50px_-15px_rgba(0,0,0,0.1)]"
        }`}
      >
        <span className="text-[10px] tracking-[0.25em] font-bold uppercase text-neutral-500 flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          Engineered &amp; Crafted By
        </span>

        <span className={`hidden sm:block w-px h-4 ${isDark ? "bg-white/20" : "bg-black/20"}`} aria-hidden="true" />

        <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-bold tracking-[0.18em] uppercase">
          {developers.map((dev, i) => {
            const accent = DEV_ACCENTS[i % DEV_ACCENTS.length];
            const isActive = activeIdx === i;
            const isDimmed = activeIdx !== null && !isActive;

            return (
              <React.Fragment key={dev.name}>
                <motion.a
                  href={dev.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onHoverStart={() => setActiveIdx(i)}
                  onHoverEnd={() => setActiveIdx(null)}
                  onTapStart={() => setActiveIdx(i)}
                  onTap={() => setTimeout(() => setActiveIdx((cur) => (cur === i ? null : cur)), 900)}
                  whileTap={{ scale: 0.94 }}
                  animate={{
                    opacity: isDimmed ? 0.35 : 1,
                    scale: isActive ? 1.08 : 1,
                    y: isActive ? -2 : 0,
                  }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="relative inline-flex items-center gap-1.5"
                  style={{ color: isActive ? accent : undefined }}
                >
                  <span
                    className="w-1 h-1 rounded-full dev-name-pulse"
                    style={{
                      backgroundColor: accent,
                      boxShadow: isActive ? `0 0 8px 2px ${accent}` : `0 0 4px 1px ${accent}55`,
                      animationDelay: `${i * 0.4}s`,
                    }}
                    aria-hidden="true"
                  />
                  <span className={isActive ? "" : isDark ? "text-neutral-300" : "text-neutral-700"}>
                    {dev.name}
                  </span>
                  <LinkedInIcon
                    size={11}
                    className="transition-all duration-500"
                    style={{ opacity: isActive ? 1 : 0.35, color: isActive ? accent : undefined }}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-1.5 left-0 h-[1.5px] origin-left transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{
                      width: isActive ? "100%" : "0%",
                      backgroundColor: accent,
                      boxShadow: `0 0 6px ${accent}`,
                    }}
                  />
                </motion.a>

                {i < developers.length - 1 && (
                  <span className={`opacity-30 px-0.5 font-light ${isDark ? "text-white" : "text-black"}`}>&times;</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
});
const Footer = memo(function Footer({ setView }) {
  const { isDark } = useTheme();
  const go = (id) => {
    setView(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const colHead = "text-xs tracking-[0.25em] uppercase text-neutral-500 mb-6 font-semibold";

  // Add your LinkedIn URLs here!
  const developers = [
    { name: "Mayur ", url: "https://www.linkedin.com/in/syed-mayur-haque-b2063a288?utm_source=share_via&utm_content=profile&utm_medium=member_android" },
    { name: "Himan ", url: "https://www.linkedin.com/in/himan-kashyap-1278492a1" },
    { name: "Ihsan", url: "https://www.linkedin.com/in/ihsan-zaman-a8a85433b/" },
  ];

  return (
    <footer className={`relative z-10 mt-24 md:mt-40 backdrop-blur-xl pb-24 lg:pb-0 ${isDark ? "bg-black/60" : "bg-white/70"}`}>
      <div aria-hidden="true" className={`h-px bg-gradient-to-r from-transparent to-transparent ${isDark ? "via-white/20" : "via-black/15"}`} />

      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-16 md:pt-24 pb-10 md:pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-x-8 gap-y-12 md:gap-y-14 mb-14 md:mb-20">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3 mb-6">
              <img src={myLogo} alt="Wildwood Records Logo" className={`w-11 h-11 object-contain ${isDark ? "" : "brightness-0"}`} />
              <span className={`font-display text-2xl tracking-wide ${isDark ? "text-white" : "text-neutral-900"}`}>WILDWOOD RECORDS</span>
            </div>
            <p className={`text-sm max-w-sm leading-[1.8] ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
              An independent record label for the deepest cuts and the finest pressings. We sign a handful of artists a year, on purpose.
            </p>
            <div className="flex flex-col items-start gap-3 mt-7">
              <a href="mailto:contactwwrecords@gmail.com" className={`ftr-link inline-flex items-center gap-2.5 text-sm transition-colors duration-300 ${isDark ? "text-neutral-400 hover:text-white" : "text-neutral-600 hover:text-neutral-900"}`}>
                <Mail size={15} className="shrink-0" aria-hidden="true" />
                contactwwrecords@gmail.com
              </a>
            </div>
            <div className="flex items-center gap-3 mt-8">
              <a href="https://www.instagram.com/wildwood_records" aria-label="Instagram" className="ftr-social ftr-ig"><Instagram size={18} /></a>
              <a href="https://open.spotify.com/playlist/0VcWEPPwzeUP2xUSm5JzY9" aria-label="Spotify" className="ftr-social ftr-sp"><Spotify size={19} /></a>
              <a href="https://youtube.com/@wildwoodrecords" aria-label="YouTube" className="ftr-social ftr-yt"><Youtube size={19} /></a>
            </div>
          </div>

          <nav aria-label="Footer" className="lg:col-span-2">
            <p className={colHead}>Explore</p>
            <div className="flex flex-col items-start gap-4">
              {NAV_ITEMS.map((item) => (
                <button key={item.id} onClick={() => go(item.id)} className={`ftr-link text-left text-sm w-fit transition-colors duration-300 ${isDark ? "text-white/70 hover:text-white" : "text-neutral-600 hover:text-neutral-900"}`}>
                  {item.label}
                </button>
              ))}
            </div>
          </nav>

          <div className="lg:col-span-2">
            <p className={colHead}>Listen On</p>
            <div className="flex flex-col items-start gap-3">
              {/* Spotify Button */}
              <a 
                href="https://open.spotify.com/user/d7q28xhv8u6cw20akhxwh5vz6?si=7ced1bdc4e064fa2" 
                target="_blank" 
                rel="noopener noreferrer" 
                className={`group inline-flex items-center gap-2.5 rounded-full border pl-3 pr-4 py-2.5 text-sm font-medium transition-all duration-300 md:duration-500 hover:-translate-y-0.5 active:scale-95 ${
                  isDark 
                    ? "border-white/12 text-white/80 hover:text-white hover:border-[#1DB954]/60 hover:bg-[#1DB954]/10 active:bg-[#1DB954]/20" 
                    : "border-black/12 text-neutral-700 hover:text-neutral-900 hover:border-[#1DB954]/60 hover:bg-[#1DB954]/10 active:bg-[#1DB954]/20"
                }`}
              >
                <span className="text-[#1DB954] md:text-neutral-500 transition-colors duration-300 group-hover:text-[#1DB954]">
                  <Spotify size={17} />
                </span> 
                Spotify
              </a>

              {/* YouTube Music Button */}
              <a 
                href="https://music.youtube.com/@wildwoodrecords?si=-b6lxhRGayRQVVk5" 
                target="_blank" 
                rel="noopener noreferrer" 
                className={`group inline-flex items-center gap-2.5 rounded-full border pl-3 pr-4 py-2.5 text-sm font-medium transition-all duration-300 md:duration-500 hover:-translate-y-0.5 active:scale-95 ${
                  isDark 
                    ? "border-white/12 text-white/80 hover:text-white hover:border-[#FF0000]/60 hover:bg-[#FF0000]/10 active:bg-[#FF0000]/20" 
                    : "border-black/12 text-neutral-700 hover:text-neutral-900 hover:border-[#FF0000]/60 hover:bg-[#FF0000]/10 active:bg-[#FF0000]/20"
                }`}
              >
                <span className="text-[#FF0000] md:text-neutral-500 transition-colors duration-300 group-hover:text-[#FF0000]">
                  <Youtube size={17} />
                </span> 
                YouTube Music
              </a>
            </div>
          </div>

          <div className="lg:col-span-3">
            <p className={colHead}>The Dispatch</p>
            <NewsletterForm compact />
            <p className={`text-sm mt-4 leading-[1.8] ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
              One email a month. New releases, shows, and the occasional unfinished demo.
            </p>
          </div>
        </div>

        <div className={`pt-8 border-t flex flex-col-reverse lg:flex-row items-center justify-between gap-8 md:gap-4 text-xs ${isDark ? "border-white/10 text-neutral-500" : "border-neutral-200 text-neutral-500"}`}>
          
          {/* LEFT: Copyright */}
          <div className="flex-1 w-full lg:w-auto text-center lg:text-left">
            <span className="font-medium tracking-wide">
              &copy; {new Date().getFullYear()} Wildwood Records. All rights reserved.
            </span>
          </div>

          {/* CENTER: Legal Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-[10px] font-bold tracking-[0.2em] uppercase">
            <button onClick={() => go("privacy")} className={`ftr-link transition-colors duration-500 ${isDark ? "hover:text-white" : "hover:text-neutral-900"}`}>
              Privacy
            </button>
            <button onClick={() => go("terms")} className={`ftr-link transition-colors duration-500 ${isDark ? "hover:text-white" : "hover:text-neutral-900"}`}>
              Terms
            </button>
            <button onClick={() => go("admin")} className={`ftr-link transition-colors duration-500 ${isDark ? "hover:text-white" : "hover:text-neutral-900"}`}>
              Admin
            </button>
          </div>

          {/* RIGHT: Tagline */}
          <div className="flex-1 w-full lg:w-auto flex justify-center lg:justify-end">
            <span className={`inline-flex items-center gap-2 tracking-[0.25em] uppercase text-[10px] font-bold ${isDark ? "text-neutral-400" : "text-neutral-400"}`}>
              Songs from the undergrowth 
              <Sparkles size={12} className={`transition-colors duration-700 ${isDark ? "text-white/30 hover:text-white" : "text-black/30 hover:text-black"}`} aria-hidden="true" />
            </span>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* PREMIUM DEVELOPER CREDITS PILL                                     */}
        {/* ------------------------------------------------------------------ */}
        {/* ------------------------------------------------------------------ */}
        {/* PREMIUM DEVELOPER CREDITS PILL                                     */}
        {/* ------------------------------------------------------------------ */}
        <div className={`mt-14 md:mt-20 pt-10 border-t flex justify-center w-full ${isDark ? "border-white/5" : "border-black/5"}`}>
          <DevCreditsBadge developers={developers} />
        </div>
        {/* ------------------------------------------------------------------ */}

      </div>
    </footer>
  );
});

/* ------------------------------- HOME ------------------------------- */

/* `playing` is the LOADED track id (survives pause) and `isPlaying` is the
   transport state. Keeping them separate is what lets the UI say "this is
   still your track, it's just paused" instead of forgetting it entirely. */
const Home = memo(function Home({ setView, openRelease, playing, isPlaying, togglePlay }) {
  const { isDark } = useTheme();
  const featured = RELEASES.find((r) => r.featured);
  const highlights = RELEASES.slice(0, 4);

  return (
    <div className="relative z-10">
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-5 md:px-8 lg:px-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] md:w-[900px] md:h-[900px] rounded-full blur-[20px] ${isDark ? "bg-[radial-gradient(circle,rgba(200,200,205,0.09),transparent_70%)]" : "bg-[radial-gradient(circle,rgba(60,60,70,0.07),transparent_70%)]"}`} />
        </div>

        <div className="max-w-7xl mx-auto relative">
          {/* HERO LAYOUT: previously a two-column grid (text left, card right
              on desktop, reordered on mobile). Restructured into a single
              centered column so the "Music built for the wild" heading and
              copy always sit directly above the audio/cover card, at every
              breakpoint — mobile, tablet, desktop, and ultrawide alike. The
              max-w-4xl cap keeps it from stretching edge-to-edge on very
              wide monitors, which is what actually makes it feel "premium"
              rather than just "responsive". */}
          <div className="flex flex-col items-center text-center gap-10 md:gap-12 lg:gap-14 max-w-4xl mx-auto">
            <div className="flex flex-col items-center w-full">
              <Eyebrow>Latest Release &mdash; {featured.year}</Eyebrow>
              {/* .text-hero is the fluid clamp()-based size from the new type
                  scale — it flows smoothly from mobile to ultrawide instead
                  of jumping between fixed Tailwind text-* breakpoints. */}
              <h1 className={`font-display text-hero mb-7 ${isDark ? "text-white" : "text-neutral-900"}`}>
                Music built<br className="hidden sm:block"/> for the <span className={`italic ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>wild.</span>
              </h1>
              <p className={`text-sm md:text-base lg:text-lg max-w-xl leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
                Wildwood Records is an independent label for immersive, authentic music &mdash; a deliberate roster of artists crafting records that demand to be heard.
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 mt-8 md:mt-10">
                <PrimaryButton onClick={() => setView("contact")} icon={UploadCloud} className="w-full sm:w-auto">
                  Submit Demo
                </PrimaryButton>
                <GhostButton onClick={() => setView("releases")} className="w-full sm:w-auto">Browse Catalogue</GhostButton>
              </div>
            </div>

            <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg">
              <button
                onClick={() => openRelease(featured)}
                className={`relative w-full aspect-square rounded-3xl md:rounded-2xl overflow-hidden group text-left transition-[transform,box-shadow] duration-500 will-change-transform hover:-translate-y-2 border block ${isDark ? "hover:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] border-white/10 bg-neutral-900" : "hover:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.28)] border-black/10 bg-neutral-200"}`}
              >
                <img src={featured.coverImg} alt={featured.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity duration-300 group-hover:opacity-90" />
                <div className="absolute inset-0 opacity-20 mix-blend-overlay grayscale" style={{ backgroundImage: "radial-gradient(circle at 30% 20%, white, transparent 45%)" }} />
                <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8 flex items-end justify-between">
                  <div>
                    <p className="text-xs md:text-sm tracking-[0.2em] uppercase text-white/70 mb-1 md:mb-2">{featured.type}</p>
                    <p className="font-display text-card-title text-white leading-none drop-shadow-lg">{featured.title}</p>
                    <p className="text-sm md:text-base text-white/80 mt-1 md:mt-2 font-medium">{featured.artist}</p>
                  </div>
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 transition-[background-color,transform,box-shadow] duration-300 will-change-transform group-hover:bg-white group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]">
                    <Play size={20} className="text-white group-hover:text-black ml-1 transition-colors duration-300" fill="currentColor" />
                  </div>
                </div>
                {/* Stays mounted while paused — EQBars eases to its idle
                    10% resting height rather than vanishing. */}
                {playing === featured.id && <EQBars count={7} tall onMedia isPlaying={isPlaying} className="absolute top-6 left-6 md:top-8 md:left-8" />}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={`px-5 md:px-8 lg:px-10 py-16 md:py-28 border-t backdrop-blur-sm ${isDark ? "border-white/5 bg-black/40" : "border-neutral-200 bg-white/60"}`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 md:mb-12 gap-6">
            <div>
              <Eyebrow>Fresh Pressings</Eyebrow>
              <h2 className={`font-display text-section-title ${isDark ? "text-white" : "text-neutral-900"}`}>Recent Releases</h2>
            </div>
            <button onClick={() => setView("releases")} className={`inline-flex items-center gap-2 text-sm font-medium transition-colors duration-300 self-start sm:self-auto ${isDark ? "text-neutral-400 hover:text-white" : "text-neutral-500 hover:text-neutral-900"}`}>
              View full catalogue <ArrowUpRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 will-change-transform [transform:translateZ(0)]">
            {highlights.map((r, i) => (
              <Reveal key={r.id} delay={i * 80}>
                <button onClick={() => openRelease(r)} className="group press-feedback text-left block w-full">
                  <div className={`relative aspect-square rounded-2xl overflow-hidden mb-4 md:mb-5 transition-[transform,box-shadow] duration-500 will-change-transform group-hover:-translate-y-2 border ${isDark ? "group-hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] border-white/10 bg-neutral-900" : "group-hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.22)] border-black/10 bg-neutral-200"}`}>
                    <img src={r.coverImg} alt={r.title} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/10 transition-colors duration-500 group-hover:bg-black/50" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.4)] transform scale-90 group-hover:scale-100 transition-transform duration-300">
                        <Play size={18} className="text-black ml-1" fill="currentColor" />
                      </div>
                    </div>
                    <span className="absolute top-4 left-4 text-sm md:text-xs font-bold tracking-[0.2em] uppercase text-white border border-white/20 rounded-full px-3 py-1.5 backdrop-blur-md bg-black/40 shadow-sm">
                      {r.type}
                    </span>
                  </div>
                  <p className={`font-display text-2xl md:text-3xl leading-none transition-colors duration-300 ${isDark ? "text-white group-hover:text-neutral-300" : "text-neutral-900 group-hover:text-neutral-600"}`}>{r.title}</p>
                  <p className={`text-sm md:text-base mt-2 truncate font-medium ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>{r.artist}</p>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 md:px-8 lg:px-10 pb-20 md:pb-32 pt-16 md:pt-20">
        <div className={`max-w-7xl mx-auto rounded-3xl border backdrop-blur-xl px-6 py-12 md:px-16 md:py-20 relative overflow-hidden ${isDark ? "border-white/10 bg-neutral-900/50 shadow-2xl" : "border-neutral-200 bg-white/85 shadow-[0_25px_70px_-20px_rgba(0,0,0,0.18)]"}`}>
          <div className={`absolute -top-32 -right-32 w-96 h-96 rounded-full blur-[20px] ${isDark ? "bg-[radial-gradient(circle,rgba(200,200,205,0.08),transparent_70%)]" : "bg-[radial-gradient(circle,rgba(60,60,70,0.06),transparent_70%)]"}`} />
          <div className="relative grid lg:grid-cols-[1fr_auto] gap-10 lg:gap-16 items-center">
            <div>
              <Eyebrow>Join the list</Eyebrow>
              <h3 className={`font-display text-section-title max-w-xl leading-[1.05] ${isDark ? "text-white" : "text-neutral-900"}`}>
                Hear it before it's a release.
              </h3>
              <p className={`text-sm md:text-base mt-4 max-w-md leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
                Early streams, show announcements, and the occasional unfinished demo &mdash; straight to your inbox.
              </p>
            </div>
            <div className="w-full lg:w-[400px]">
              <NewsletterForm />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});

/* ------------------------------- RELEASES ------------------------------- */

const Releases = memo(function Releases({ openRelease, playing, isPlaying, togglePlay }) {
  const { isDark } = useTheme();
  return (
    <div className="pt-32 md:pt-44 pb-24 px-5 md:px-8 lg:px-10 relative z-10">
      <div className="max-w-7xl mx-auto">
        <Eyebrow>Catalogue</Eyebrow>
        <h1 className={`font-display text-page-title mb-4 ${isDark ? "text-white" : "text-neutral-900"}`}>Releases</h1>
        <p className={`text-sm md:text-base max-w-lg mb-10 md:mb-16 leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
          Every record we've put out, in one place. Tap a cover to see credits and stream it in full.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 md:gap-8 will-change-transform [transform:translateZ(0)]">
          {RELEASES.map((r, i) => (
            <Reveal key={r.id} delay={(i % 10) * 45} className="group flex flex-col h-full">
              <button onClick={() => openRelease(r)} className="press-feedback block w-full text-left flex-1">
                <div className={`relative aspect-square rounded-2xl overflow-hidden mb-3 md:mb-4 transition-[transform,box-shadow] duration-500 will-change-transform group-hover:-translate-y-1.5 border ${isDark ? "group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8)] border-white/5 bg-neutral-900" : "group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.2)] border-black/10 bg-neutral-200"}`}>
                  <img src={r.coverImg} alt={r.title} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-300" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-black/30 backdrop-blur-[2px]">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white flex items-center justify-center shadow-[0_0_24px_rgba(255,255,255,0.35)] transform scale-90 group-hover:scale-100 transition-transform duration-300">
                      <Play size={18} className="text-black ml-1" fill="currentColor" />
                    </div>
                  </div>
                </div>
                <p className={`font-display text-2xl md:text-3xl leading-none transition-colors duration-300 truncate ${isDark ? "text-white group-hover:text-neutral-300" : "text-neutral-900 group-hover:text-neutral-600"}`}>{r.title}</p>
                <p className={`text-sm md:text-base mt-1 md:mt-1.5 font-medium truncate ${isDark ? "text-neutral-500" : "text-neutral-600"}`}>{r.artist}</p>
              </button>
              <div className={`mt-3 md:mt-4 pt-3 md:pt-4 border-t ${isDark ? "border-white/5" : "border-neutral-200"}`}>
                <button
                  onClick={() => togglePlay(r.id)}
                  className={`press-feedback flex items-center gap-2 text-xs md:text-sm font-bold tracking-widest uppercase transition-colors duration-300 ${isDark ? "text-neutral-400 hover:text-white" : "text-neutral-500 hover:text-neutral-900"}`}
                >
                  {/* Three states, not two: Preview (not loaded) → Playing
                      (loaded + running) → Paused (loaded + stopped). The
                      Paused label with a Play icon is the affordance that
                      tells you this exact track will resume, not restart. */}
                  {playing === r.id && isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  {playing === r.id ? (isPlaying ? "Playing" : "Paused") : "Preview"}
                  {playing === r.id && <EQBars count={3} isPlaying={isPlaying} className="ml-auto" />}
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* ARTISTS PAGE                                                       */
/* ------------------------------------------------------------------ */

/* Circular/square avatar tile with graceful fallback to a monogram when a
   photo hasn't been added yet (see the path instructions near ARTISTS_RAW).
   Pass `cover` to stretch it edge-to-edge for the full-bleed Spotlight cards. */
const ArtistAvatar = memo(function ArtistAvatar({ artist, cover = false }) {
  /* Walk the candidate list on each 404 (png → jpg → jpeg → webp); once
     every format has failed we show the monogram. Falling back per-format
     rather than per-artist means adding a photo in any supported format
     "just works" with no code edit. */
  const candidates = artist.photoCandidates?.length ? artist.photoCandidates : [artist.photoImg];
  const [srcIndex, setSrcIndex] = useState(0);
  const imgFailed = srcIndex >= candidates.length;
  const initials = artist.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const wrapperClass = cover
    ? `absolute inset-0 w-full h-full bg-gradient-to-br ${artist.gradient}`
    : `relative w-full aspect-square rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br ${artist.gradient}`;

  return (
    <div className={wrapperClass}>
      {!imgFailed && (
        <img
          /* key forces a fresh load when we advance to the next format —
             without it React reuses the element and the new src is ignored. */
          key={candidates[srcIndex]}
          src={candidates[srcIndex]}
          alt={artist.name}
          loading="lazy"
          decoding="async"
          onError={() => setSrcIndex((n) => n + 1)}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />
      )}
      {imgFailed && (
        <div className="absolute inset-0 flex items-center justify-center transition-transform duration-700 ease-out group-hover:scale-110">
          <span className={`font-display ${cover ? "text-6xl md:text-7xl" : "text-2xl md:text-3xl"} text-white/80 select-none`}>
            {initials}
          </span>
        </div>
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.12),transparent_60%)]" />
      {!cover && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-70 group-hover:opacity-90 transition-opacity duration-300" />
      )}
      {artist.verified && !cover && (
        <div className="absolute top-1.5 right-1.5 flex items-center justify-center bg-black/70 backdrop-blur-md border border-white/10 rounded-full w-5 h-5">
          <BadgeCheck size={10} className="text-emerald-400" />
        </div>
      )}
    </div>
  );
});

/* One button style for all three platforms. Confirmed real profiles get a solid
   border and fill-on-hover; generated search fallbacks (no verified account
   found) stay dashed and muted so the UI never implies a link is official when
   it's just a best-effort search shortcut. */
function SocialIconButton({ href, icon: Icon, confirmed, title }) {
  const { isDark } = useTheme();
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      title={title}
      aria-label={title}
      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
        confirmed
          ? isDark
            ? "border border-white/15 text-neutral-300 hover:text-black hover:bg-white group-hover:border-white/30"
            : "border border-black/15 text-neutral-500 hover:text-white hover:bg-neutral-900 group-hover:border-black/30"
          : isDark
            ? "border border-dashed border-white/10 text-neutral-600 hover:text-neutral-300 hover:border-white/25"
            : "border border-dashed border-black/10 text-neutral-400 hover:text-neutral-600 hover:border-black/25"
      }`}
    >
      <Icon size={14} />
    </a>
  );
}

const ARTIST_FILTERS = ["All", "Verified", "Vocals", "Production", "Featured"];

const Artists = memo(function Artists() {
  const { isDark } = useTheme();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  // The Spotlight row only appears on the unfiltered, unsearched view — it's a
  // curated highlight, not another filter state to keep in sync.
const showSpotlight = filter === "All" && !query.trim();
  const spotlightArtists = showSpotlight
    ? SPOTLIGHT_ARTIST_NAMES
        .map((name) => ARTISTS.find((a) => a.name === name))
        .filter(Boolean)
        .sort((a, b) => b.popularityScore - a.popularityScore)
    : [];
  const spotlightIds = new Set(spotlightArtists.map((a) => a.id));

  const filtered = ARTISTS.filter((artist) => {
    if (showSpotlight && spotlightIds.has(artist.id)) return false;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      artist.name.toLowerCase().includes(q) ||
      artist.genre.toLowerCase().includes(q) ||
      artist.releases.some((r) => r.toLowerCase().includes(q));
    const matchesFilter =
      filter === "All" ||
      (filter === "Verified" && artist.verified) ||
      artist.category === filter;
    return matchesQuery && matchesFilter;
  }).sort((a, b) => b.popularityScore - a.popularityScore);

  return (
    <div className="pt-32 md:pt-44 pb-24 px-5 md:px-8 lg:px-10 relative z-10">
      <div className="max-w-7xl mx-auto">
        <Eyebrow>Roster &middot; {ARTIST_STATS.total} Artists</Eyebrow>
        <h1 className={`font-display text-page-title mb-4 ${isDark ? "text-white" : "text-neutral-900"}`}>Artists</h1>
        <p className={`text-sm md:text-base max-w-lg mb-8 md:mb-10 leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
          Every voice, producer, and collaborator behind the Wildwood catalogue &mdash; from the label's biggest
          names to the quiet architects working just off stage.
        </p>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-10 md:mb-14">
          <div className={`rounded-2xl border backdrop-blur-md px-4 py-4 md:px-5 md:py-5 ${isDark ? "border-white/10 bg-black/40" : "border-neutral-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)]"}`}>
            <Users size={16} className="text-neutral-500 mb-2" />
            <p className={`font-display text-2xl md:text-3xl leading-none ${isDark ? "text-white" : "text-neutral-900"}`}>{ARTIST_STATS.total}</p>
            <p className="text-xs md:text-sm text-neutral-500 mt-1 tracking-wide uppercase">Artists</p>
          </div>
          <div className={`rounded-2xl border backdrop-blur-md px-4 py-4 md:px-5 md:py-5 ${isDark ? "border-white/10 bg-black/40" : "border-neutral-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)]"}`}>
            <BadgeCheck size={16} className="text-emerald-400 mb-2" />
            <p className={`font-display text-2xl md:text-3xl leading-none ${isDark ? "text-white" : "text-neutral-900"}`}>{ARTIST_STATS.verified}</p>
            <p className="text-xs md:text-sm text-neutral-500 mt-1 tracking-wide uppercase">Verified</p>
          </div>
          <div className={`rounded-2xl border backdrop-blur-md px-4 py-4 md:px-5 md:py-5 ${isDark ? "border-white/10 bg-black/40" : "border-neutral-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)]"}`}>
            <Disc3 size={16} className="text-neutral-500 mb-2" />
            <p className={`font-display text-2xl md:text-3xl leading-none ${isDark ? "text-white" : "text-neutral-900"}`}>{ARTIST_STATS.releases}</p>
            <p className="text-xs md:text-sm text-neutral-500 mt-1 tracking-wide uppercase">Releases</p>
          </div>
          <div className={`rounded-2xl border backdrop-blur-md px-4 py-4 md:px-5 md:py-5 ${isDark ? "border-white/10 bg-black/40" : "border-neutral-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)]"}`}>
            <Music2 size={16} className="text-neutral-500 mb-2" />
            <p className={`font-display text-2xl md:text-3xl leading-none ${isDark ? "text-white" : "text-neutral-900"}`}>{ARTIST_STATS.genres}</p>
            <p className="text-xs md:text-sm text-neutral-500 mt-1 tracking-wide uppercase">Genres</p>
          </div>
        </div>

        {/* Search + category filters */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-10 md:mb-14">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search artists, genres, tracks..."
              aria-label="Search artists"
              className={`w-full backdrop-blur-md border rounded-full pl-10 pr-5 py-3 text-sm focus:outline-none transition-colors duration-300 ${isDark ? "bg-black/50 border-neutral-700 text-white placeholder-neutral-500 focus:border-white" : "bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 shadow-sm"}`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ARTIST_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`press-feedback text-xs md:text-sm font-bold tracking-[0.15em] uppercase px-4 py-2 rounded-full border transition-all duration-300 ${
                  filter === f
                    ? isDark
                      ? "bg-white text-black border-white"
                      : "bg-neutral-900 text-white border-neutral-900"
                    : isDark
                      ? "border-neutral-700 text-neutral-400 hover:text-white hover:border-white"
                      : "border-neutral-300 text-neutral-500 hover:text-neutral-900 hover:border-neutral-900"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Spotlight — the roster's most-featured names, full-bleed and ranked */}
        {showSpotlight && (
          <div className="mb-14 md:mb-20">
            <div className="flex items-center gap-2 mb-5 md:mb-6">
              <Crown size={16} className="text-amber-400" />
              <span className={`text-xs md:text-sm tracking-[0.2em] uppercase font-semibold ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Major Spotlight</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
              {spotlightArtists.map((artist, i) => (
                <Reveal key={artist.id} delay={i * 100}>
                  <div className={`group relative h-72 md:h-80 rounded-3xl overflow-hidden border bg-neutral-900 transition-all duration-500 hover:-translate-y-1 ${isDark ? "border-white/10 hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)]" : "border-black/10 hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.3)]"}`}>
                    <ArtistAvatar artist={artist} cover />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-amber-400/30 rounded-full px-2.5 py-1">
                      <Crown size={11} className="text-amber-400" />
                      <span className="text-sm font-bold tracking-widest uppercase text-amber-300">#{i + 1} Most Featured</span>
                    </div>
                    {artist.verified && (
                      <div className="absolute top-4 right-4 flex items-center justify-center bg-black/60 backdrop-blur-md border border-white/10 rounded-full w-7 h-7">
                        <BadgeCheck size={13} className="text-emerald-400" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <span className="text-sm font-bold tracking-[0.18em] uppercase text-white/60 mb-1 inline-block">{artist.genre}</span>
                      <h3 className="font-display text-2xl md:text-3xl text-white leading-none">{artist.name}</h3>
                      <p className="text-sm text-white/70 mt-1.5 mb-3">{artist.role} &middot; {artist.releases.length} tracks</p>
                      <div className="flex items-center gap-2">
                        <SocialIconButton
                          href={artist.spotify.url}
                          icon={Spotify}
                          confirmed={artist.spotify.confirmed}
                          title={artist.spotify.confirmed ? `Spotify · ${artist.spotify.listeners}` : `Search "${artist.name}" on Spotify`}
                        />
                        <SocialIconButton
                          href={artist.instagram ? artist.instagram.url : `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(artist.name)}`}
                          icon={Instagram}
                          confirmed={Boolean(artist.instagram)}
                          title={artist.instagram ? `Instagram ${artist.instagram.handle}` : `No public Instagram confirmed for ${artist.name}`}
                        />
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        )}

        {/* Full roster grid */}
        {filtered.length === 0 ? (
          <div className={`py-24 text-center border-t ${isDark ? "border-white/10" : "border-neutral-200"}`}>
            <p className="text-neutral-500 text-sm">No artists match &ldquo;{query}&rdquo;. Try a different name, genre, or track.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-7 will-change-transform [transform:translateZ(0)]">
            {filtered.map((artist, i) => {
              const tier = getArtistTier(artist.releases.length);
              const visibleReleases = artist.releases.slice(0, 3);
              const extraCount = artist.releases.length - visibleReleases.length;

              return (
                <Reveal key={artist.id} delay={(i % 12) * 45} className="h-full">
                  <div
                    className={`group relative h-full flex flex-col rounded-3xl border-l-4 ${CATEGORY_ACCENTS[artist.category] || (isDark ? "border-l-white/20" : "border-l-black/15")} border bg-gradient-to-b ${isDark ? `border-white/5 ${artist.gradient} hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] hover:border-white/20` : `border-black/5 ${artist.gradientLight} hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.18)] hover:border-black/15`} overflow-hidden transition-all duration-500 hover:-translate-y-1`}
                  >
                    <div className={`pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[10px] z-20 ${isDark ? "bg-[radial-gradient(circle,rgba(255,255,255,0.10),transparent_70%)]" : "bg-[radial-gradient(circle,rgba(0,0,0,0.05),transparent_70%)]"}`} />

                    {/* Full-bleed photo header — same treatment as the Spotlight
                        cards above: the image fills the top of the card, a
                        bottom-up scrim keeps the type legible over any
                        photograph, and the name/role/genre sit ON the image.
                        Text here stays white in BOTH themes because the
                        photograph (not the page) sets the contrast. */}
                    <div className="relative h-60 md:h-64 shrink-0 overflow-hidden bg-neutral-900">
                      <ArtistAvatar artist={artist} cover />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />

                      <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/55 backdrop-blur-md border border-white/10 rounded-full px-2.5 py-1">
                        <span className="text-xs font-bold tabular-nums text-white/85">{String(i + 1).padStart(2, "0")}</span>
                        {tier && <tier.Icon size={11} className="text-amber-400" />}
                      </div>

                      {artist.verified && (
                        <div className="absolute top-4 right-4 flex items-center justify-center bg-black/55 backdrop-blur-md border border-white/10 rounded-full w-7 h-7">
                          <BadgeCheck size={13} className="text-emerald-400" />
                        </div>
                      )}

                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-white/60 mb-1 inline-block truncate max-w-full">
                          {artist.genre}
                        </span>
                        <h3 className="font-display text-2xl md:text-3xl text-white leading-none truncate">
                          {artist.name}
                        </h3>
                        <p className="text-sm text-white/70 mt-1.5 truncate">{artist.role}</p>
                      </div>
                    </div>

                    {/* Card body — padding moved here now that the photo runs
                        edge to edge above it. */}
                    <div className="relative z-10 flex flex-col flex-1 p-5 md:p-6">
                    <p className={`text-sm md:text-base leading-relaxed mb-4 line-clamp-3 ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
                      {artist.bio}
                    </p>

                    <div className="mt-auto">
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {visibleReleases.map((r) => (
                          <span key={r} className={`text-xs font-medium rounded-full px-2.5 py-1 border ${isDark ? "text-neutral-300 bg-white/5 border-white/10" : "text-neutral-600 bg-black/5 border-black/10"}`}>
                            {r}
                          </span>
                        ))}
                        {extraCount > 0 && (
                          <span className={`text-xs font-medium rounded-full px-2.5 py-1 border ${isDark ? "text-neutral-500 bg-white/5 border-white/10" : "text-neutral-500 bg-black/5 border-black/10"}`}>
                            +{extraCount} more
                          </span>
                        )}
                      </div>

                      <div className={`flex items-center justify-between pt-4 border-t ${isDark ? "border-white/10" : "border-black/10"}`}>
                        <div className="flex items-center gap-2">
                          <SocialIconButton
                            href={artist.spotify.url}
                            icon={Spotify}
                            confirmed={artist.spotify.confirmed}
                            title={artist.spotify.confirmed ? `Spotify · ${artist.spotify.listeners}` : `Search "${artist.name}" on Spotify`}
                          />
                          <SocialIconButton
                            href={artist.instagram ? artist.instagram.url : `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(artist.name)}`}
                            icon={Instagram}
                            confirmed={Boolean(artist.instagram)}
                            title={artist.instagram ? `Instagram ${artist.instagram.handle}` : `No public Instagram confirmed for ${artist.name}`}
                          />
                        </div>
                        <span className={`text-sm font-bold tracking-widest uppercase ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>{artist.category}</span>
                      </div>
                      {artist.instagram && (
                        <p className="mt-2.5 text-xs text-neutral-500">
                          {artist.instagram.handle} &middot; {artist.instagram.followers} followers
                        </p>
                      )}
                    </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* ABOUT PAGE                                                         */
/* ------------------------------------------------------------------ */

/* Icon + descriptor for each strategic partner. Keyed by name so the
   PARTNERS data array stays a simple editable list; unknown names fall
   back to a disc icon and a neutral tag. */
const PARTNER_META = {
  "Spotify": { icon: Spotify, tag: "Streaming" },
  "YouTube Music": { icon: Youtube, tag: "Video & Music" },
  "Apple Music": { icon: Apple, tag: "Streaming" },
  "SoundCloud": { icon: Cloud, tag: "Community & Repost" },
  "JioSaavn": { icon: Radio, tag: "Streaming · India" },
  "Amazon Music": { icon: Headphones, tag: "Streaming" },
};

const About = memo(function About() {
  const { isDark } = useTheme();
  return (
    <div className="pt-32 md:pt-44 pb-24 px-5 md:px-8 lg:px-10 relative z-10">
      <div className="max-w-4xl mx-auto">
        <Eyebrow>Our Story</Eyebrow>
        <h1 className={`font-display text-page-title mb-10 md:mb-14 ${isDark ? "text-white" : "text-neutral-900"}`}>About the Label</h1>

        {/* ---- Editorial body: lede with drop cap → pull quote → close ----
             The lede runs larger in the display face with a CSS ::first-letter
             drop cap; body copy gets long-form leading (1.85) and a measured
             column width — the rhythm of a print feature, not a web page. */}
        <Reveal>
          <p className={`about-lede font-display text-2xl md:text-3xl leading-[1.4] max-w-3xl ${isDark ? "text-neutral-100" : "text-neutral-900"}`}>
            Established with a deep reverence for the pristine soundscapes of the East, Wildwood Records is a home for auditory truth. We operate on a slow-release ecosystem, choosing intentionality over volume.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <figure className="my-14 md:my-20 text-center">
            <div className={`h-px w-24 mx-auto mb-8 bg-gradient-to-r from-transparent to-transparent ${isDark ? "via-white/40" : "via-black/30"}`} aria-hidden="true" />
            <blockquote className={`font-display text-3xl md:text-5xl leading-[1.08] ${isDark ? "text-white" : "text-neutral-900"}`}>
              “Intentionality over volume.”
            </blockquote>
            <figcaption className="mt-6 text-xs tracking-[0.3em] uppercase text-neutral-500 font-semibold">
              The Wildwood Ethos
            </figcaption>
          </figure>
        </Reveal>

        <Reveal delay={120}>
          <p className={`text-lg md:text-xl leading-[1.85] max-w-3xl ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
            Every record under our imprint is treated as an artifact. From analog preservation to cutting-edge production techniques, we bridge the space between generational folk wisdom and raw, contemporary exploration.
          </p>
        </Reveal>

        {/* ---- Strategic partners: official sponsorship tier ----
             Editorial section header (caption / display title / count) over a
             gradient rule, then plaque-style cards: icon coin + name + role,
             with a light sheen that sweeps across on hover (.partner-sheen). */}
        <div className="mt-20 md:mt-32">
          <Reveal>
            <div className="flex items-end justify-between gap-6 mb-4">
              <div>
                <p className="text-xs tracking-[0.25em] uppercase text-neutral-500 mb-3 font-semibold">In Good Company</p>
                <h2 className={`font-display text-section-title leading-none ${isDark ? "text-white" : "text-neutral-900"}`}>Strategic Partners</h2>
              </div>
              <div className={`hidden md:flex items-baseline gap-3 pb-1 shrink-0 text-xs tracking-[0.25em] uppercase font-semibold ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                <span className="font-display normal-case tracking-normal text-base">( {String(PARTNERS.length).padStart(2, "0")} )</span>
                <span>platforms</span>
              </div>
            </div>
            <div className={`h-px mb-10 md:mb-12 bg-gradient-to-r to-transparent ${isDark ? "from-white/25 via-white/10" : "from-black/25 via-black/10"}`} />
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {PARTNERS.map((partner, i) => {
              const meta = PARTNER_META[partner] || { icon: Disc3, tag: "Partner" };
              const PartnerIcon = meta.icon;
              return (
                <Reveal key={partner} delay={i * 70}>
                  <div className={`partner-card group flex items-center gap-4 p-5 md:p-6 rounded-2xl border backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 ${isDark ? "border-white/5 bg-black/40 hover:border-white/20 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.9)]" : "border-neutral-200 bg-white hover:border-neutral-300 shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.22)]"}`}>
                    <span aria-hidden="true" className="partner-sheen" />
                    <span className="sub-tile w-12 h-12 shrink-0 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110 group-hover:-rotate-3">
                      <PartnerIcon size={20} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm md:text-base font-semibold truncate transition-colors duration-300 ${isDark ? "text-neutral-200 group-hover:text-white" : "text-neutral-700 group-hover:text-neutral-900"}`}>{partner}</span>
                      <span className="block text-[10px] tracking-[0.22em] uppercase font-semibold text-neutral-500 mt-1">{meta.tag}</span>
                    </span>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* EVENTS PAGE                                                        */
/* ------------------------------------------------------------------ */

/* Flip to true to preview the designed empty state below without touching
   the EVENTS data — handy while designing or before announcing a season. */
const PREVIEW_EMPTY_EVENTS_STATE = true;

/* Elegant empty state for the tour calendar. Design intent: an off-season
   stage, not an error — a quiet beacon (slow rotating halo + soft radar
   pings around a calendar medallion), a serif headline carrying the news,
   and one confident next step: the Instagram CTA, which borrows the only
   splash of brand color on the whole site (the IG gradient) so it reads
   as unmistakably premium and unmistakably actionable. */
/* ------------------------------------------------------------------ */
/* EVENTS — premium interactive empty state                            */
/*                                                                       */
/* HOW TO INSTALL:                                                     */
/*  1. Add these two icons to your existing lucide-react import line   */
/*     if they aren't already there: Calendar, Sparkles, ArrowUpRight, */
/*     Instagram (the local brand icon already defined in your file).  */
/*  2. Replace your existing `EventsEmptyState` AND `Events` components */
/*     with the two below. Everything else in App.jsx is untouched —   */
/*     this relies only on things already in scope: useTheme(),        */
/*     Eyebrow, Reveal, EVENTS, PREVIEW_EMPTY_EVENTS_STATE, and the     */
/*     .press-feedback / --ease-out-expo tokens from your stylesheets. */
/*  3. No new global CSS is required — the tilt and magnetic effects   */
/*     are driven by refs + inline transforms (see comments below),    */
/*     the same technique your ServiceCard already uses for its cursor */
/*     spotlight, so nothing needs to be added to CraftStyles.         */
/* ------------------------------------------------------------------ */

/* Elegant, interactive empty state for the tour calendar. Three layered
   pieces of "expensive" feel, each doing one job:
     1. A 3D tilt card — the glass panel leans toward the cursor like a
        physical object catching the light, using perspective + rotateX/Y
        written straight to the DOM node (no React state, no re-renders,
        so it tracks the mouse at 60fps).
     2. A pulsing live dot — a small emerald ping paired with "Studio
        Active", signaling the label is working even though the
        calendar is empty.
     3. A magnetic Instagram CTA — the button drifts toward the cursor
        within its hover zone (the classic "magnetic button" feel) and
        swaps to Instagram's real brand gradient on hover/press. */


/* ------------------------------------------------------------------ */
/* EVENTS — "Unclaimed Ticket" empty state                             */
/*                                                                       */
/* CONCEPT: instead of a generic glassmorphism card, the empty state    */
/* IS a physical concert ticket stub — perforated die-cut edges, a      */
/* barcode, a rubber "TBA" stamp — that the visitor can actually FLIP   */
/* over (click/tap) like turning a ticket in their hand, revealing the  */
/* follow CTA on the back. It's tied specifically to what this page is */
/* (ticketing) rather than a reusable "empty state card" template.     */
/*                                                                       */
/* HOW TO INSTALL:                                                     */
/*  1. Add ONE icon to your existing lucide-react import line:         */
/*       RotateCw                                                      */
/*     Everything else it uses (Ticket, MapPin, Calendar, Sparkles,    */
/*     ArrowUpRight, Instagram) is already imported in your file.      */
/*  2. Replace your existing `EventsEmptyState` AND `Events` components */
/*     with the two below.                                             */
/*  3. No new global CSS needed. The perforation notches use            */
/*     `bg-[var(--ww-page-bg)]`, which GlobalPolishStyles already       */
/*     defines for both themes, so the "torn edge" always matches the   */
/*     page background exactly, in light or dark mode.                 */
/* ------------------------------------------------------------------ */

/* Fixed barcode bar-width pattern (not random-per-render — a real
   barcode doesn't reshuffle every time you look at it). Values are
   Tailwind width tokens applied as inline flex-basis percentages. */
/* ------------------------------------------------------------------ */
/* EVENTS — "Marquee Letter Board" empty state                         */
/*                                                                       */
/* CONCEPT: the sign hanging outside a venue between bookings — black   */
/* felt board, white plastic split-flap letters that physically flip   */
/* into place letter-by-letter (like an airport departure board), and  */
/* a chasing string of marquee bulbs along the frame. Tactile, not a   */
/* UI card — the "no shows" state is the sign itself.                  */
/*                                                                       */
/* HOW TO INSTALL:                                                     */
/*  1. No new icon imports needed — this only uses ArrowUpRight and     */
/*     the local Instagram brand icon, both already in your file.       */
/*  2. Replace your existing `EventsEmptyState` AND `Events` components */
/*     with everything below (it also defines two small helpers,        */
/*     `useSplitFlap` and `FlapLetter`, that the empty state needs —    */
/*     paste those in too, right above `EventsEmptyState`).             */
/*  3. No changes to CraftStyles / GlobalPolishStyles are required —    */
/*     the flip and bulb-chase animations are self-contained in a       */
/*     small <style> block inside EventsEmptyState itself.              */
/* ------------------------------------------------------------------ */

/* The line the board spells out, letter by letter. Change this one
   string to change what the sign reads — spaces and the em dash each
   still get their own (blank or animated) slot automatically. */
const MARQUEE_TEXT = "NO SHOWS YET";

const FLAP_POOL = "WILDWOODRECORDS0123456789";

/* Drives one letter's split-flap animation: cycles through a handful of
   random letters, flipping through each on a short timer, before
   settling on the real target character last. `startDelay` staggers
   when each tile begins, so the line reads left-to-right like a real
   departure board updating one column at a time rather than all at once. */
function useSplitFlap(target, startDelay = 0) {
  const [display, setDisplay] = useState(" ");
  const [flipping, setFlipping] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const steps = 7 + Math.floor(Math.random() * 4); // 5–8 random flips before landing
    const seq = Array.from({ length: steps }, () => FLAP_POOL[Math.floor(Math.random() * FLAP_POOL.length)]);
    seq.push(target);

    let i = 0;
    const runStep = () => {
      if (cancelled) return;
      setFlipping(true);
      timeoutRef.current = setTimeout(() => {
        if (cancelled) return;
        setDisplay(seq[i]);
        setFlipping(false);
        i += 1;
        if (i < seq.length) timeoutRef.current = setTimeout(runStep, 55);
      }, 110); // flip duration
    };

    timeoutRef.current = setTimeout(runStep, startDelay);
    return () => {
      cancelled = true;
      clearTimeout(timeoutRef.current);
    };
  }, [target, startDelay]);

  return { display, flipping };
}

/* One physical letter tile. Always rendered dark plastic-on-felt
   regardless of site theme (light/dark) — it's meant to read as a real
   object hanging on the wall, not a themed UI element. A center seam
   line fakes the two-piece hardware of a real split-flap card. */
const FlapLetter = memo(function FlapLetter({ char, index }) {
  const isSpace = char === " ";
  const { display, flipping } = useSplitFlap(char, index * 55);

  if (isSpace) {
    return <div className="shrink-0 w-3 sm:w-4 md:w-6" aria-hidden="true" />;
  }

  return (
    <div className="relative shrink-0 w-[clamp(1.5rem,5.4vw,3.1rem)] aspect-[3/4] [perspective:420px]">
      <div
        style={{
          transition: "transform 0.11s linear",
          transform: flipping ? "rotateX(-90deg)" : "rotateX(0deg)",
        }}
        className="relative w-full h-full rounded-[5px] bg-[#161616] border border-black/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_5px_rgba(0,0,0,0.55)] flex items-center justify-center overflow-hidden"
      >
        <span
          className="font-display font-black text-neutral-50 select-none leading-none text-[clamp(0.95rem,3.6vw,2.1rem)]"
          style={{ textShadow: "0 1px 0 rgba(0,0,0,0.65)" }}
        >
          {display === " " ? "" : display}
        </span>
        {/* physical split-flap seam, dead center of the card */}
        <span className="pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-black/70 shadow-[0_1px_0_rgba(255,255,255,0.05)]" aria-hidden="true" />
      </div>
    </div>
  );
});

/* Chasing marquee bulbs along the frame edge — the classic theater-sign
   light chase, built from fixed-count spans with staggered animation
   delays so the glow visibly travels rather than just pulsing in place. */
const MARQUEE_BULB_COUNT = 28;

function MarqueeBulbs() {
  return (
    <div className="flex items-center justify-between px-3" aria-hidden="true">
      {Array.from({ length: MARQUEE_BULB_COUNT }).map((_, i) => (
        <span
          key={i}
          className="marquee-bulb w-1.5 h-1.5 rounded-full bg-amber-300"
          style={{ animationDelay: `${(i * 1.8) / MARQUEE_BULB_COUNT}s` }}
        />
      ))}
    </div>
  );
}

const EventsEmptyState = memo(function EventsEmptyState() {
  const { isDark } = useTheme();
  const btnRef = useRef(null);

  /* Magnetic pull for the CTA: the button drifts toward the cursor
     within its hover zone. */
  const handleBtnMove = useCallback((e) => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const relX = e.clientX - (r.left + r.width / 2);
    const relY = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${relX * 0.25}px, ${relY * 0.35}px)`;
  }, []);

  const handleBtnLeave = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    el.style.transform = "translate(0px, 0px)";
  }, []);

  return (
    <Reveal>
      <style>{`
        @keyframes marqueeBulbChase {
          0%, 100% { opacity: 0.22; box-shadow: 0 0 2px rgba(251,191,36,0.35); }
          50%      { opacity: 1;    box-shadow: 0 0 9px 2px rgba(251,191,36,0.9); }
        }
        .marquee-bulb { animation: marqueeBulbChase 1.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .marquee-bulb { animation: none; opacity: 0.7; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto">
        {/* ================= THE SIGN ================= */}
        <div
          className={`relative rounded-[1.5rem] p-[3px] ${isDark ? "shadow-[0_30px_80px_-28px_rgba(0,0,0,0.9)]" : "shadow-[0_30px_70px_-30px_rgba(0,0,0,0.28)]"}`}
          style={{ background: "linear-gradient(135deg, #2b2b2b, #0a0a0a 55%, #2b2b2b)" }}
        >
          <div className="rounded-[calc(1.5rem-3px)] overflow-hidden" style={{ backgroundColor: "#0c0c0c" }}>
            <div className="pt-4"><MarqueeBulbs /></div>

            {/* the felt panel */}
            <div
              className="relative px-6 py-10 md:px-12 md:py-16 flex items-center justify-center"
              style={{
                backgroundColor: "#141414",
                backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 0.6px, transparent 0.6px)",
                backgroundSize: "10px 10px",
              }}
            >
              <div className="flex flex-wrap justify-center gap-[3px] sm:gap-[4px] md:gap-[5px]">
                {Array.from(MARQUEE_TEXT).map((ch, i) => (
                  <FlapLetter key={i} char={ch} index={i} />
                ))}
              </div>
            </div>

            <div className="pb-4"><MarqueeBulbs /></div>
          </div>
        </div>

        {/* ================= THE PLACARD BELOW ================= */}
        <div className="text-center mt-10 md:mt-12">
          <div className="flex items-center justify-center gap-2.5 mb-5">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <p className={`text-xs md:text-sm tracking-[0.3em] uppercase font-semibold ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
              Booking In Progress
            </p>
          </div>

          <p className={`text-sm md:text-base leading-relaxed max-w-md mx-auto ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
            We are currently in the studio. Follow Wildwood Records to be the
            first to know about secret drops, pop-up acoustic sessions, and
            upcoming tour dates.
          </p>

          {/* Magnetic Instagram CTA — drifts toward the cursor within its
              hover zone, swaps to Instagram's real brand gradient on hover */}
          <div
            className="relative inline-block mt-8 md:mt-10"
            onMouseMove={handleBtnMove}
            onMouseLeave={handleBtnLeave}
          >
            <a
              ref={btnRef}
              href="https://www.instagram.com/wildwood_records?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
              target="_blank"
              rel="noopener noreferrer"
              style={{ transition: "transform 0.25s cubic-bezier(0.22,1,0.36,1)" }}
              className="press-feedback group/cta relative inline-block rounded-full p-px will-change-transform"
            >
              <span aria-hidden="true" className="absolute -inset-2 rounded-full bg-[linear-gradient(120deg,#f9ce34,#ee2a7b,#6228d7)] opacity-0 group-hover/cta:opacity-45 blur-xl transition-opacity duration-500" />
              <span aria-hidden="true" className={`absolute inset-0 rounded-full transition-opacity duration-500 group-hover/cta:opacity-0 ${isDark ? "bg-white/15" : "bg-black/15"}`} />
              <span aria-hidden="true" className="absolute inset-0 rounded-full bg-[linear-gradient(120deg,#f9ce34,#ee2a7b,#6228d7)] opacity-0 group-hover/cta:opacity-100 transition-opacity duration-500" />
              <span className={`relative z-10 inline-flex items-center gap-3 rounded-full pl-2.5 pr-7 py-2.5 text-xs font-bold tracking-[0.18em] uppercase transition-shadow duration-500 ${isDark ? "bg-[#0b0b0c] text-white" : "bg-white text-neutral-900"} group-hover/cta:shadow-[0_10px_36px_-10px_rgba(238,42,123,0.55)]`}>
                <span className="w-8 h-8 rounded-full bg-[linear-gradient(120deg,#f9ce34,#ee2a7b,#6228d7)] flex items-center justify-center text-white shrink-0 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:rotate-[10deg] group-hover/cta:scale-110">
                  <Instagram size={15} />
                </span>
                Follow @wildwoodrecords
                <ArrowUpRight size={14} className="transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" aria-hidden="true" />
              </span>
            </a>
          </div>
        </div>
      </div>
    </Reveal>
  );
});

/* ==================================================================== */
/* EVENTS — TOUR POSTER ROWS                                            */
/*                                                                      */
/* Each date is a full-width band of type rather than a table row.      */
/* Three things happen on hover, orchestrated together:                 */
/*                                                                      */
/*   1. A "TICKET" sticker materialises and trails the cursor — but      */
/*      ONLY inside this row. Coordinates are read relative to the row's */
/*      own bounding box and pushed into motion values, so the sticker   */
/*      is scoped to the band it belongs to (no page-wide custom cursor  */
/*      hijacking the whole site). A spring gives it real lag/weight     */
/*      instead of gluing it to the pointer.                            */
/*   2. The title slides right and an inverted fill wipes up from the    */
/*      baseline — poster ink hitting paper.                            */
/*   3. Get Tickets slides in from the right edge.                      */
/*                                                                      */
/* Motion values are written imperatively (not React state), so the      */
/* sticker tracks at 60fps without re-rendering the row on every         */
/* mousemove — the single most important detail here. Touch devices get  */
/* the static poster layout with the button always visible.             */
/* ==================================================================== */

const EVENT_EASE = [0.22, 1, 0.36, 1];

const EventRow = memo(function EventRow({ event, index, reduced }) {
  const { isDark } = useTheme();
  const rowRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  /* Raw pointer position within the row … */
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  /* … and the softened version the sticker actually follows. */
  const sx = useSpring(px, { stiffness: 380, damping: 32, mass: 0.55 });
  const sy = useSpring(py, { stiffness: 380, damping: 32, mass: 0.55 });

  const handleMove = useCallback((e) => {
    const el = rowRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    px.set(e.clientX - r.left);
    py.set(e.clientY - r.top);
  }, [px, py]);

  const handleEnter = useCallback((e) => {
    /* Seed the springs at the entry point so the sticker pops in UNDER the
       cursor rather than gliding in from wherever it was last left.
       jump() is framer-motion 11+; the optional call degrades gracefully. */
    handleMove(e);
    sx.jump?.(px.get());
    sy.jump?.(py.get());
    setHovered(true);
  }, [handleMove, px, py, sx, sy]);

  return (
    <motion.div
      ref={rowRef}
      onMouseMove={handleMove}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHovered(false)}
      className={`group relative overflow-hidden border-b ${isDark ? "border-white/10" : "border-black/10"}`}
    >
      {/* Inverted fill wiping up from the baseline. */}
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={{ scaleY: hovered && !reduced ? 1 : 0 }}
        transition={{ duration: 0.55, ease: EVENT_EASE }}
        className={`pointer-events-none absolute inset-0 origin-bottom ${isDark ? "bg-white/[0.045]" : "bg-neutral-900/[0.035]"}`}
      />

      {/* ---- Cursor-following TICKET sticker (desktop only) ---- */}
      <motion.div
        aria-hidden="true"
        style={{ x: sx, y: sy }}
        className="pointer-events-none absolute top-0 left-0 z-30 hidden lg:block"
      >
        <motion.div
          initial={false}
          animate={{
            scale: hovered && !reduced ? 1 : 0,
            opacity: hovered ? 1 : 0,
            rotate: hovered ? -8 : -30,
          }}
          transition={{ duration: 0.4, ease: EVENT_EASE }}
          className={`-translate-x-1/2 -translate-y-1/2 flex items-center gap-2 rounded-full px-4 py-2.5 shadow-2xl ${isDark ? "bg-white text-black" : "bg-neutral-900 text-white"}`}
        >
          <Ticket size={14} />
          <span className="text-[11px] font-bold tracking-[0.22em] uppercase whitespace-nowrap">Get Tickets</span>
        </motion.div>
      </motion.div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] items-start lg:items-center gap-5 lg:gap-10 py-8 md:py-12">
        {/* Date block — poster masthead treatment */}
        <div className="flex flex-row lg:flex-col items-baseline lg:items-start gap-3 lg:gap-0 shrink-0 lg:w-36">
          <span className={`font-display text-4xl md:text-5xl lg:text-6xl leading-none tracking-tight ${isDark ? "text-white" : "text-neutral-900"}`}>
            {event.date.split(" ")[0]}
          </span>
          <div className="flex flex-row lg:flex-col gap-2 lg:gap-0">
            <span className={`font-display text-lg md:text-xl leading-none ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
              {event.date.split(" ")[1]}
            </span>
            <span className="text-[11px] text-neutral-500 tracking-[0.25em] font-bold uppercase lg:mt-1">{event.year}</span>
          </div>
        </div>

        {/* Headline + venue */}
        <motion.div
          animate={{ x: hovered && !reduced ? 16 : 0 }}
          transition={{ duration: 0.6, ease: EVENT_EASE }}
          className="min-w-0"
        >
          <h3 className={`font-display text-3xl sm:text-4xl md:text-6xl lg:text-7xl leading-[0.95] tracking-tight mb-3 ${isDark ? "text-white" : "text-neutral-900"}`}>
            {event.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className={`inline-flex items-center gap-2 text-sm font-medium ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
              <MapPin size={15} />
              {event.venue} &middot; {event.city}
            </span>
            <span className={`inline-block px-3 py-1 rounded-full border text-[10px] tracking-[0.2em] font-bold uppercase ${isDark ? "border-white/15 text-neutral-400" : "border-black/15 text-neutral-500"}`}>
              {event.type}
            </span>
          </div>
        </motion.div>

        {/* Button: slides in from the right on desktop; always present and
            full-width on touch, where there is no hover to reveal it. */}
        <motion.div
          initial={false}
          animate={{
            x: reduced ? 0 : hovered ? 0 : 40,
            opacity: reduced ? 1 : hovered ? 1 : 0,
          }}
          transition={{ duration: 0.5, ease: EVENT_EASE }}
          className="hidden lg:block shrink-0"
        >
          <button className={`press-feedback inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] uppercase px-8 py-3.5 rounded-full transition-colors duration-300 ${isDark ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-900 text-white hover:bg-black"}`}>
            <Ticket size={15} /> Get Tickets
          </button>
        </motion.div>

        <div className="lg:hidden w-full">
          <button className={`press-feedback w-full inline-flex justify-center items-center gap-2 text-xs font-bold tracking-[0.18em] uppercase px-8 py-3.5 rounded-full transition-colors duration-300 ${isDark ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-900 text-white hover:bg-black"}`}>
            <Ticket size={15} /> Get Tickets
          </button>
        </div>
      </div>
    </motion.div>
  );
});

const Events = memo(function Events() {
  const { isDark } = useTheme();
  const reduced = usePrefersReducedMotion();
  /* Single source of truth for what the page shows. When this array is
     empty (or the preview flag is on), the empty state above renders
     instead of the list — no other code paths change. */
  const upcoming = PREVIEW_EMPTY_EVENTS_STATE ? [] : EVENTS;
  return (
    <div className="pt-32 md:pt-44 pb-24 px-5 md:px-8 lg:px-10 relative z-10">
      <div className="max-w-7xl mx-auto">
        <Eyebrow>On Tour</Eyebrow>
        <h1 className={`font-display text-page-title mb-4 ${isDark ? "text-white" : "text-neutral-900"}`}>Live Dates</h1>
        <p className={`text-sm md:text-base max-w-lg mb-10 md:mb-16 leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
          Catch our roster in intimate acoustic chambers and physical arenas.
        </p>

        {upcoming.length === 0 ? (
          <EventsEmptyState />
        ) : (
          <div className={`flex flex-col border-t ${isDark ? "border-white/10" : "border-black/10"}`}>
            {upcoming.map((event, i) => (
              <Reveal key={event.id} delay={i * 90}>
                <EventRow event={event} index={i} reduced={reduced} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
/* ------------------------------------------------------------------ */
/* CONTACT / DEMO SUBMISSION                                          */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* ASSAM FLOOD RELIEF — donation page with QR / UPI verified payments   */
/*                                                                     */
/* Design intent: serious and empathetic without being bleak — the      */
/* site's glass language, lit with emerald (hope/action) and a faint   */
/* warm undertone. Two columns: the situation and where funds go on    */
/* the left; a sticky action rail (fund progress + QR/UPI payment card) */
/* on the right, so the ask is always within reach as you read.        */
/*                                                                     */
/* No payment gateway is used anywhere in this flow. Donors pay via     */
/* their own UPI app, then submit their transaction details below for   */
/* manual admin verification before anything is reflected publicly.     */
/* ------------------------------------------------------------------ */

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });


const RELIEF_ALLOCATIONS = [
  { icon: Tent, title: "Emergency Shelter", copy: "Tarpaulins, dry bedding and relief-camp kits for displaced families." },
  { icon: Droplets, title: "Food & Clean Water", copy: "Ration packs, water purification and daily meals in relief camps." },
  { icon: HeartPulse, title: "Medical Aid", copy: "Mobile health units, medicines and post-flood disease prevention." },
];


/* ---------------------- Payment Card (QR + UPI) ---------------------- */
const ReliefPaymentCard = memo(function ReliefPaymentCard({ settings, loading }) {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);

  const copyUpiId = async () => {
    if (!settings?.upiId) return;
    try {
      await navigator.clipboard.writeText(settings.upiId);
      setCopied(true);
      toast.success("UPI ID copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — please copy it manually.");
    }
  };

  const downloadQr = () => {
    /* qrCodeUrl is a base64 data: URL (stored locally by the admin panel,
       see adminUpdateSettings) — no fetch/network call needed, a plain
       anchor download handles data: URLs directly in every browser. */
    if (!settings?.qrCodeUrl) return;
    try {
      const a = document.createElement("a");
      a.href = settings.qrCodeUrl;
      a.download = "relief-fund-upi-qr.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error("Couldn't download the QR code.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="sub-card p-7 md:p-9 text-center"
    >
      <div className="flex items-center justify-center gap-3 mb-5">
        <span className={`sub-tile w-10 h-10 ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
          <QrCode size={17} aria-hidden="true" />
        </span>
        <p className="text-xs tracking-[0.25em] uppercase text-neutral-500 font-semibold">Scan &amp; Pay via UPI</p>
      </div>

      <div className={`mx-auto mb-6 w-56 h-56 sm:w-64 sm:h-64 rounded-2xl border flex items-center justify-center overflow-hidden ${isDark ? "border-white/10 bg-black/30" : "border-neutral-200 bg-white"}`}>
        {loading ? (
          <Loader2 className={`animate-spin ${isDark ? "text-neutral-600" : "text-neutral-300"}`} size={28} />
        ) : settings?.qrCodeUrl ? (
          <img src={settings.qrCodeUrl} alt="Scan this QR code with any UPI app to donate" className="w-full h-full object-contain p-3" />
        ) : (
          <div className={`text-xs px-6 ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>
            QR code not set up yet — add one from the admin dashboard.
          </div>
        )}
      </div>

      <div className={`rounded-2xl border p-4 mb-3 ${isDark ? "border-white/10 bg-black/20" : "border-neutral-200 bg-neutral-50"}`}>
        <p className={`text-[11px] tracking-[0.2em] uppercase font-semibold mb-1 ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>UPI ID</p>
        <p className={`font-mono text-sm sm:text-base font-semibold break-all ${isDark ? "text-white" : "text-neutral-900"}`}>
          {settings?.upiId || "—"}
        </p>
      </div>

      <div className={`rounded-2xl border p-4 mb-6 ${isDark ? "border-white/10 bg-black/20" : "border-neutral-200 bg-neutral-50"}`}>
        <p className={`text-[11px] tracking-[0.2em] uppercase font-semibold mb-1 ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Account Holder</p>
        <p className={`text-sm sm:text-base font-semibold ${isDark ? "text-white" : "text-neutral-900"}`}>
          {settings?.accountHolderName || "—"}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <button
          type="button"
          onClick={copyUpiId}
          className={`press-feedback flex-1 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-xs font-bold tracking-[0.15em] uppercase border transition-all duration-300 ${isDark ? "border-neutral-700 text-white hover:border-white" : "border-neutral-300 text-neutral-900 hover:border-neutral-900"}`}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy UPI ID"}
        </button>
        <button
          type="button"
          onClick={downloadQr}
          disabled={!settings?.qrCodeUrl}
          className={`press-feedback flex-1 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-xs font-bold tracking-[0.15em] uppercase transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? "bg-emerald-400 text-black hover:bg-emerald-300" : "bg-emerald-600 text-white hover:bg-emerald-500"}`}
        >
          <Download size={15} />
          Download QR
        </button>
      </div>

      <div className={`text-left rounded-2xl border p-5 flex gap-3 ${isDark ? "border-white/5 bg-black/20" : "border-neutral-200 bg-white"}`}>
        <ShieldCheck size={18} className={`shrink-0 mt-0.5 ${isDark ? "text-emerald-300" : "text-emerald-700"}`} aria-hidden="true" />
        <p className={`text-xs leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
          Scan the QR code or pay to the UPI ID above using any UPI app (Google Pay, PhonePe,
          Paytm, BHIM, or your bank's app). Every rupee goes directly to on-ground relief
          operations and verified NGOs in Assam.
        </p>
      </div>
    </motion.div>
  );
});

/* ------------------------- Recent Donations Ticker ------------------------- */
const RecentDonationsWidget = memo(function RecentDonationsWidget() {
  const { isDark } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getRecentDonations(10);
      setItems(data.donations || []);
    } catch {
      /* silent — this is a small ambient widget, not critical path */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // poll for newly-verified donations
    return () => clearInterval(interval);
  }, [load]);

  if (!loading && items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="sub-card p-6 md:p-7"
    >
      <p className="text-xs tracking-[0.25em] uppercase text-neutral-500 font-semibold mb-4">Recent Donations</p>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {items.map((d) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm ${isDark ? "bg-black/20" : "bg-neutral-50"}`}
            >
              <span className={isDark ? "text-neutral-300" : "text-neutral-700"}>
                ❤️ {d.anonymous ? "Anonymous" : d.donorName} donated {inr.format(d.amount)}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

/* ----------------------------- Donate Us Page ----------------------------- */
const DonateUs = memo(function DonateUs() {
  const { isDark } = useTheme();
  const [settings, setSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingSettings(true);
      try {
        setSettings(await getSettings());
      } catch {
        toast.error("Couldn't load campaign details. Please refresh.");
      } finally {
        setLoadingSettings(false);
      }
    })();
  }, []);

  return (
    <div className="pt-32 md:pt-44 pb-24 px-5 md:px-8 lg:px-10 relative z-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={`absolute -top-32 right-[-10%] w-[560px] h-[560px] rounded-full blur-[24px] ${isDark ? "bg-[radial-gradient(circle,rgba(16,185,129,0.12),transparent_70%)]" : "bg-[radial-gradient(circle,rgba(16,185,129,0.10),transparent_70%)]"}`} />
        <div className={`absolute bottom-[-14%] left-[-8%] w-[520px] h-[520px] rounded-full blur-[24px] ${isDark ? "bg-[radial-gradient(circle,rgba(245,158,11,0.07),transparent_70%)]" : "bg-[radial-gradient(circle,rgba(245,158,11,0.06),transparent_70%)]"}`} />
      </div>

      <div className="max-w-7xl mx-auto relative">
        <Reveal>
          <div className="flex items-center gap-3 mb-6">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className={`text-xs sm:text-sm tracking-[0.25em] uppercase font-semibold ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
              Urgent · Assam Flood Relief
            </span>
          </div>
          <h1 className={`font-display text-page-title max-w-3xl mb-6 ${isDark ? "text-white" : "text-neutral-900"}`}>
            When the Brahmaputra rises, we answer.
          </h1>
          <p className={`text-sm md:text-base lg:text-lg max-w-2xl leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
            {settings?.campaignDescription ||
              "Each monsoon, flooding across Assam forces families from their homes, cuts villages off from food and clean water, and washes away livelihoods built over generations. Every rupee you give moves directly to the ground."}
          </p>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mt-12 md:mt-16 items-start">
          {/* --------------------- left: the situation --------------------- */}
          <div className="lg:col-span-6 xl:col-span-7 space-y-6 md:space-y-8">
            <Reveal delay={60}>
              <div className="sub-card p-7 md:p-9">
                <h2 className={`font-display text-2xl md:text-3xl mb-4 ${isDark ? "text-white" : "text-neutral-900"}`}>
                  Where your contribution goes
                </h2>
                <p className={`text-sm md:text-base leading-[1.85] mb-8 ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
                  We work with verified NGOs and volunteer networks operating in the
                  worst-affected districts. Funds are released against on-ground needs
                  — shelter first, then food, water and medical care — and every verified
                  gift below is reflected in the running total in real time.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {RELIEF_ALLOCATIONS.map((item) => (
                    <div key={item.title} className={`rounded-2xl border p-5 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 ${isDark ? "border-white/5 bg-black/30 hover:border-emerald-400/30" : "border-neutral-200 bg-white hover:border-emerald-600/40 shadow-[0_4px_20px_rgba(0,0,0,0.04)]"}`}>
                      <span className={`sub-tile w-11 h-11 mb-4 ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                        <item.icon size={19} aria-hidden="true" />
                      </span>
                      <p className={`text-sm font-semibold mb-1.5 ${isDark ? "text-neutral-200" : "text-neutral-800"}`}>{item.title}</p>
                      <p className="sub-hint">{item.copy}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

          </div>

          {/* ------------------ right: sticky action rail ------------------ */}
          <div className="lg:col-span-6 xl:col-span-5 lg:sticky lg:top-28 space-y-6">
            <ReliefPaymentCard settings={settings} loading={loadingSettings} />
            <RecentDonationsWidget />
          </div>
        </div>
      </div>
    </div>
  );
});

/* ============================== ADMIN AREA ============================== */

const AdminLogin = memo(function AdminLogin({ onLoggedIn }) {
  const { isDark } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Enter your admin email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await adminLogin(email.trim(), password);
      setAdminToken(data.token);
      toast.success("Welcome back.");
      onLoggedIn();
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-32 md:pt-44 pb-24 px-5 flex justify-center relative z-10">
      <form onSubmit={onSubmit} className="sub-card p-8 md:p-10 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <span className={`sub-tile w-10 h-10 ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
            <Lock size={17} aria-hidden="true" />
          </span>
          <h1 className={`font-display text-2xl ${isDark ? "text-white" : "text-neutral-900"}`}>Admin Sign In</h1>
        </div>

        <label className="sub-label" htmlFor="admin-email">Email</label>
        <input id="admin-email" type="email" className="sub-input mb-4" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />

        <label className="sub-label" htmlFor="admin-password">Password</label>
        <input id="admin-password" type="password" className="sub-input mb-4" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />

        {error && <p className="sub-error mb-4"><AlertCircle size={14} /> {error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className={`press-feedback w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-xs font-bold tracking-[0.15em] uppercase transition-all duration-300 disabled:opacity-60 ${isDark ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-900 text-white hover:bg-black"}`}
        >
          {submitting ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
          {submitting ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
});

const STATUS_OPTIONS = ["All", "Pending Verification", "Verified", "Rejected"];

const AdminDashboard = memo(function AdminDashboard() {
  const { isDark } = useTheme();
  const [authed, setAuthed] = useState(!!getAdminToken());
  const [tab, setTab] = useState("donations"); // "donations" | "settings"

  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [settingsForm, setSettingsForm] = useState(null);
  const [qrFile, setQrFile] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadDonations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminListDonations({ status: status === "All" ? "" : status, search });
      setDonations(data.donations || []);
    } catch (err) {
      toast.error(err.message || "Couldn't load donations.");
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  const loadSettings = useCallback(async () => {
    try {
      const s = await adminGetSettings();
      setSettingsForm(s);
    } catch (err) {
      toast.error(err.message || "Couldn't load settings.");
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadDonations();
    loadSettings();
  }, [authed, loadDonations, loadSettings]);

  const handleVerify = async (id) => {
    setBusyId(id);
    try {
      await adminVerifyDonation(id);
      toast.success("Donation verified — now live on the public page.");
      loadDonations();
    } catch (err) {
      toast.error(err.message || "Couldn't verify donation.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id) => {
    setBusyId(id);
    try {
      await adminRejectDonation(id);
      toast.success("Donation rejected.");
      loadDonations();
    } catch (err) {
      toast.error(err.message || "Couldn't reject donation.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this submission permanently?")) return;
    setBusyId(id);
    try {
      await adminDeleteDonation(id);
      toast.success("Submission deleted.");
      loadDonations();
    } catch (err) {
      toast.error(err.message || "Couldn't delete submission.");
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = async () => {
    try {
      await adminExportCsv(status === "All" ? "" : status);
    } catch {
      toast.error("Export failed.");
    }
  };

  const handleSettingsSave = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const fd = new FormData();
      fd.append("upiId", settingsForm.upiId || "");
      fd.append("accountHolderName", settingsForm.accountHolderName || "");
      fd.append("campaignDescription", settingsForm.campaignDescription || "");
      fd.append("campaignGoal", settingsForm.campaignGoal || 0);
      if (qrFile) fd.append("qrCode", qrFile);
      const data = await adminUpdateSettings(fd);
      setSettingsForm(data.settings);
      setQrFile(null);
      toast.success("Settings updated — the public page reflects this instantly.");
    } catch (err) {
      toast.error(err.message || "Couldn't save settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const logout = () => {
    setAdminToken(null);
    setAuthed(false);
  };

  if (!authed) return <AdminLogin onLoggedIn={() => setAuthed(true)} />;

  return (
    <div className="pt-32 md:pt-44 pb-24 px-5 md:px-8 lg:px-10 relative z-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h1 className={`font-display text-3xl md:text-4xl ${isDark ? "text-white" : "text-neutral-900"}`}>Relief Fund Admin</h1>
          <button onClick={logout} className={`press-feedback inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wide border ${isDark ? "border-neutral-700 text-white hover:border-white" : "border-neutral-300 text-neutral-900 hover:border-neutral-900"}`}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>

        <div className="flex gap-2 mb-8">
          {["donations", "settings"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`press-feedback rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wide transition-all ${tab === t ? (isDark ? "bg-emerald-400 text-black" : "bg-emerald-600 text-white") : (isDark ? "border border-neutral-700 text-neutral-400" : "border border-neutral-300 text-neutral-500")}`}
            >
              {t === "donations" ? "Donations" : "Campaign Settings"}
            </button>
          ))}
        </div>

        {tab === "donations" && (
          <>
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search size={15} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? "text-neutral-500" : "text-neutral-400"}`} />
                <input
                  className="sub-input pl-10"
                  placeholder="Search name, phone, or transaction ID"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select className="sub-input sm:w-56" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={loadDonations} className={`press-feedback inline-flex items-center justify-center gap-2 rounded-full px-5 text-xs font-bold uppercase border ${isDark ? "border-neutral-700 text-white" : "border-neutral-300 text-neutral-900"}`}>
                <Filter size={14} /> Apply
              </button>
              <button onClick={handleExport} className={`press-feedback inline-flex items-center justify-center gap-2 rounded-full px-5 text-xs font-bold uppercase ${isDark ? "bg-white text-black" : "bg-neutral-900 text-white"}`}>
                <FileDown size={14} /> Export CSV
              </button>
            </div>

            <div className="overflow-x-auto sub-card p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`text-left text-[11px] uppercase tracking-wide ${isDark ? "text-neutral-500 border-b border-white/10" : "text-neutral-400 border-b border-neutral-200"}`}>
                    <th className="p-4">Donor</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Transaction ID</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Submitted</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={7} className="p-8 text-center text-neutral-500"><Loader2 className="animate-spin inline" size={18} /></td></tr>
                  )}
                  {!loading && donations.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-neutral-500">No submissions match these filters.</td></tr>
                  )}
                  {donations.map((d) => (
                    <tr key={d._id} className={isDark ? "border-b border-white/5" : "border-b border-neutral-100"}>
                      <td className="p-4">{d.anonymous ? `${d.donorName} (Anon)` : d.donorName}</td>
                      <td className="p-4 text-xs">{d.phone}{d.email ? ` · ${d.email}` : ""}</td>
                      <td className="p-4 font-semibold">{inr.format(d.amount)}</td>
                      <td className="p-4 font-mono text-xs">{d.transactionId}</td>
                      <td className="p-4">
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                          d.status === "Verified" ? (isDark ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-600/10 text-emerald-700")
                          : d.status === "Rejected" ? (isDark ? "bg-red-400/15 text-red-300" : "bg-red-600/10 text-red-700")
                          : (isDark ? "bg-amber-400/15 text-amber-300" : "bg-amber-600/10 text-amber-700")
                        }`}>{d.status}</span>
                      </td>
                      <td className="p-4 text-xs">{new Date(d.createdAt).toLocaleDateString("en-IN")}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          {d.status !== "Verified" && (
                            <button disabled={busyId === d._id} onClick={() => handleVerify(d._id)} title="Verify" className="press-feedback p-2 rounded-full bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25">
                              <ClipboardCheck size={15} />
                            </button>
                          )}
                          {d.status !== "Rejected" && (
                            <button disabled={busyId === d._id} onClick={() => handleReject(d._id)} title="Reject" className="press-feedback p-2 rounded-full bg-amber-500/15 text-amber-500 hover:bg-amber-500/25">
                              <BadgeX size={15} />
                            </button>
                          )}
                          <button disabled={busyId === d._id} onClick={() => handleDelete(d._id)} title="Delete" className="press-feedback p-2 rounded-full bg-red-500/15 text-red-500 hover:bg-red-500/25">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "settings" && settingsForm && (
          <form onSubmit={handleSettingsSave} className="sub-card p-7 md:p-9 max-w-2xl space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <span className={`sub-tile w-10 h-10 ${isDark ? "text-emerald-300" : "text-emerald-700"}`}><Landmark size={17} /></span>
              <h2 className={`font-display text-xl ${isDark ? "text-white" : "text-neutral-900"}`}>Campaign Settings</h2>
            </div>

            <div>
              <label className="sub-label">UPI ID</label>
              <input className="sub-input" value={settingsForm.upiId} onChange={(e) => setSettingsForm({ ...settingsForm, upiId: e.target.value })} />
            </div>
            <div>
              <label className="sub-label">Account Holder Name</label>
              <input className="sub-input" value={settingsForm.accountHolderName} onChange={(e) => setSettingsForm({ ...settingsForm, accountHolderName: e.target.value })} />
            </div>
            <div>
              <label className="sub-label">Campaign Goal (₹)</label>
              <input type="number" className="sub-input" value={settingsForm.campaignGoal} onChange={(e) => setSettingsForm({ ...settingsForm, campaignGoal: e.target.value })} />
            </div>
            <div>
              <label className="sub-label">Campaign Description</label>
              <textarea rows={4} className="sub-input resize-none" value={settingsForm.campaignDescription} onChange={(e) => setSettingsForm({ ...settingsForm, campaignDescription: e.target.value })} />
            </div>


            <button
              type="submit"
              disabled={savingSettings}
              className={`press-feedback inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs font-bold uppercase tracking-wide disabled:opacity-60 ${isDark ? "bg-emerald-400 text-black" : "bg-emerald-600 text-white"}`}
            >
              {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {savingSettings ? "Saving…" : "Save Settings"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* SUBMIT DEMO — full release delivery form                            */
/* The old four-field pitch form grew into the label's real intake:    */
/* release metadata, the WAV master, and print-ready artwork, all      */
/* validated client-side. Organized as three numbered glass sections   */
/* so a long form never feels long. Reuses the site's Reveal, Eyebrow, */
/* PrimaryButton/GhostButton and the sub-* skin from SubmissionStyles. */
/* ------------------------------------------------------------------ */

const GENRES = [
  "Pop", "Indie", "Folk", "Hip-Hop / Rap", "Electronic", "Rock",
  "Jazz", "Classical", "Devotional", "Regional / Folk Fusion", "Ambient", "Other",
];

function SubLabel({ children, required, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="sub-label">
      {children}
      {required && <span className="sub-req" aria-hidden="true">*</span>}
    </label>
  );
}

/* Custom-styled choice chips. The native radio/checkbox stays in the DOM
   (keyboard-focusable, screen-reader friendly) but is visually replaced
   by the pill — see .sub-chip-* in SubmissionStyles. */
function ChipGroup({ name, type = "radio", options, value, onChange }) {
  const selected = (v) => (type === "radio" ? value === v : value.includes(v));
  return (
    <div className="flex flex-wrap gap-2" role={type === "radio" ? "radiogroup" : "group"}>
      {options.map((opt) => (
        <span key={opt} className="sub-chip">
          <input
            type={type}
            name={name}
            value={opt}
            checked={selected(opt)}
            onChange={() => onChange(opt)}
            className="sub-chip-input"
          />
          <span className="sub-chip-face" onClick={() => onChange(opt)}>
            <span className="sub-chip-box"><Check size={11} strokeWidth={3.5} /></span>
            {opt}
          </span>
        </span>
      ))}
    </div>
  );
}

function SubSection({ index, icon: Icon, title, subtitle, isDark, children }) {
  return (
    <section className="sub-card p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <span className="sub-tile w-12 h-12 shrink-0">
            <Icon size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className={`font-display text-2xl md:text-3xl leading-none ${isDark ? "text-white" : "text-neutral-900"}`}>{title}</h2>
            {subtitle && <p className="sub-hint mt-1.5">{subtitle}</p>}
          </div>
        </div>
        <span className={`font-display text-lg select-none ${isDark ? "text-white/20" : "text-neutral-900/20"}`} aria-hidden="true">
          ( {index} )
        </span>
      </div>
      {children}
    </section>
  );
}

const Contact = memo(function Contact() {
  const { isDark } = useTheme();

  /* Custom-control state; text/email/date inputs stay uncontrolled and
     lean on native validation — less state, same UX. */
  const [contentType, setContentType] = useState([]);
  const [instrumental, setInstrumental] = useState("");
  const [releaseFormat, setReleaseFormat] = useState("");
  const [version, setVersion] = useState("");
  const [groupErrors, setGroupErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const toggleContent = useCallback((v) => {
    setContentType((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
    setGroupErrors((e) => ({ ...e, contentType: "" }));
  }, []);

  const pick = (setter, key) => (v) => {
    setter(v);
    setGroupErrors((e) => ({ ...e, [key]: "" }));
  };

  /* ------------------------------ submit ------------------------------ */
  
  const [isSending, setIsSending] = useState(false);

const submitDemo = async (e) => {
  e.preventDefault();
  const form = e.currentTarget;

  /* Custom controls first, so every problem is visible at once. */
  const errs = {};
  if (contentType.length === 0) errs.contentType = "Select at least one content type.";
  if (!instrumental) errs.instrumental = "Please choose Yes or No.";
  if (!releaseFormat) errs.releaseFormat = "Please choose a format.";
  if (!version) errs.version = "Please choose Original or Remix.";
  setGroupErrors(errs);

  const nativesOk = form.checkValidity();
  if (!nativesOk) form.reportValidity();
  if (!nativesOk || Object.values(errs).some(Boolean)) return;

  setIsSending(true);
  try {
    const formData = new FormData(form);
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (data.success) {
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      toast.error(data.message || "Something went wrong — please try again.");
    }
  } catch (err) {
    toast.error("Couldn't reach the server. Check your connection and try again.");
  } finally {
    setIsSending(false);
  }
};

  const resetAll = () => {
    setContentType([]); setInstrumental(""); setReleaseFormat(""); setVersion("");
    setGroupErrors({}); setSubmitted(false); setFormKey((k) => k + 1);
  };

  const err = (key) =>
    groupErrors[key] ? (
      <p className="sub-error mt-2.5"><AlertCircle size={14} aria-hidden="true" /> {groupErrors[key]}</p>
    ) : null;

  return (
    <div className="pt-32 md:pt-44 pb-24 px-5 md:px-8 lg:px-10 relative z-10">
      <div className="max-w-4xl mx-auto">
        <Eyebrow>Transmission</Eyebrow>
        <h1 className={`font-display text-page-title mb-4 ${isDark ? "text-white" : "text-neutral-900"}`}>Submit Demo</h1>
        <p className={`text-sm md:text-base max-w-lg mb-10 md:mb-16 leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
          The full delivery — release metadata plus links to your 44.1 kHz WAV
          master and 3000×3000 artwork. We review exactly what you send.
        </p>

        {submitted ? (
          <div className={`p-10 md:p-16 rounded-3xl border backdrop-blur-xl text-center max-w-xl mx-auto ${isDark ? "border-white/10 bg-neutral-900/50 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]" : "border-neutral-200 bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.18)]"}`}>
            <div className={`relative w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isDark ? "bg-white/10" : "bg-neutral-900/5"}`}>
              <span className={`svc-ping absolute inset-0 rounded-full border ${isDark ? "border-white/25" : "border-black/20"}`} aria-hidden="true" />
              <span className={`svc-ping absolute inset-0 rounded-full border ${isDark ? "border-white/25" : "border-black/20"}`} style={{ animationDelay: "1.7s" }} aria-hidden="true" />
              <Send className={isDark ? "text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]" : "text-neutral-900 drop-shadow-[0_0_10px_rgba(0,0,0,0.2)]"} size={32} />
            </div>
            <h3 className={`font-display text-4xl mb-4 ${isDark ? "text-white" : "text-neutral-900"}`}>Demo Received</h3>
            <p className={`text-base leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
              Our small team listens to everything sequentially. If the wavelength aligns, we will be in touch.
            </p>
            <div className="mt-8">
              <GhostButton onClick={resetAll}>Submit Another Release</GhostButton>
            </div>
          </div>
        ) : (
      <form key={formKey} onSubmit={submitDemo} className="space-y-6 md:space-y-8">
    <p className="sub-hint text-right" aria-hidden="true"><span className="sub-req">*</span> required</p>
    
    {/* 1. PUT YOUR ACTUAL KEY HERE */}
    <input type="hidden" name="access_key" value="5c65cafd-afcc-4079-b9c3-59cf1e9d02f9" /> 
    
    {/* 2. REMOVE the hardcoded 'subject' input so the Dashboard takes over! */}
    
    <input type="checkbox" name="botcheck" className="hidden" style={{ display: "none" }} tabIndex={-1} autoComplete="off" />

            {/* ----------------------- 01 · general ----------------------- */}
            <Reveal>
              <SubSection index="01" icon={Mail} title="General Information" subtitle="Where we reply if your track connects." isDark={isDark}>
                <div className="max-w-md">
                  <SubLabel htmlFor="sub-email" required>Email</SubLabel>
                  <input id="sub-email" name="email" type="email" required placeholder="you@example.com" className="sub-input mt-2.5" autoComplete="email" />
                </div>
              </SubSection>
            </Reveal>

            {/* -------------------- 02 · release details -------------------- */}
            <Reveal delay={80}>
              <SubSection index="02" icon={Disc3} title="Release Details" subtitle="Tell us exactly what we're listening to." isDark={isDark}>
                <div className="space-y-7">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <SubLabel required>Content Type</SubLabel>
                      <div className="mt-2.5">
                        <ChipGroup name="contentType" type="checkbox" options={["Audio", "Video"]} value={contentType} onChange={toggleContent} />
                      </div>
                      {err("contentType")}
                    </div>
                    <div>
                      <SubLabel required>Instrumental</SubLabel>
                      <div className="mt-2.5">
                        <ChipGroup name="instrumental" options={["Yes", "No"]} value={instrumental} onChange={pick(setInstrumental, "instrumental")} />
                      </div>
                      {err("instrumental")}
                    </div>
                    <div>
                      <SubLabel required>Format</SubLabel>
                      <div className="mt-2.5">
                        <ChipGroup name="releaseFormat" options={["Single", "Album", "EP"]} value={releaseFormat} onChange={pick(setReleaseFormat, "releaseFormat")} />
                      </div>
                      {err("releaseFormat")}
                    </div>
                    <div>
                      <SubLabel required>Original / Remix</SubLabel>
                      <div className="mt-2.5">
                        <ChipGroup name="version" options={["Original", "Remix"]} value={version} onChange={pick(setVersion, "version")} />
                      </div>
                      {err("version")}
                    </div>
                  </div>

                  <div className={`h-px ${isDark ? "bg-gradient-to-r from-white/15 to-transparent" : "bg-gradient-to-r from-black/15 to-transparent"}`} aria-hidden="true" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                    <div>
                      <SubLabel htmlFor="sub-album" required>Album Name</SubLabel>
                      <input id="sub-album" name="albumName" type="text" required placeholder="For singles, repeat the track title" className="sub-input mt-2.5" />
                    </div>
                    <div>
                      <SubLabel htmlFor="sub-track" required>Track Title</SubLabel>
                      <input id="sub-track" name="trackTitle" type="text" required placeholder="Exactly as it should appear" className="sub-input mt-2.5" />
                    </div>
                    <div>
                      <SubLabel htmlFor="sub-primary" required>Primary Artist</SubLabel>
                      <input id="sub-primary" name="primaryArtist" type="text" required placeholder="Main performing artist" className="sub-input mt-2.5" />
                    </div>
                    <div>
                      <SubLabel htmlFor="sub-feat">Featuring Artist</SubLabel>
                      <input id="sub-feat" name="featuringArtist" type="text" placeholder="Leave blank if none" className="sub-input mt-2.5" />
                    </div>
                    <div>
                      <SubLabel htmlFor="sub-remixer">Re-mixer</SubLabel>
                      <input id="sub-remixer" name="remixer" type="text" placeholder="Only for remixes" className="sub-input mt-2.5" />
                    </div>
                    <div>
                      <SubLabel htmlFor="sub-composer" required>Composer</SubLabel>
                      <input id="sub-composer" name="composer" type="text" required placeholder="Music written by" className="sub-input mt-2.5" />
                    </div>
                    <div>
                      <SubLabel htmlFor="sub-lyricist" required>Lyricist</SubLabel>
                      <input id="sub-lyricist" name="lyricist" type="text" required placeholder="Words written by" className="sub-input mt-2.5" />
                    </div>
                    <div>
                      <SubLabel htmlFor="sub-genre">Genre</SubLabel>
                      <div className="relative mt-2.5">
                        <select id="sub-genre" name="genre" defaultValue="" className="sub-input">
                          <option value="" disabled>Select a genre</option>
                          {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <ChevronDown size={16} className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? "text-neutral-500" : "text-neutral-400"}`} aria-hidden="true" />
                      </div>
                    </div>
                    <div>
                      <SubLabel htmlFor="sub-subgenre">Subgenre</SubLabel>
                      <input id="sub-subgenre" name="subgenre" type="text" placeholder="e.g. Dream Pop, Lo-fi" className="sub-input mt-2.5" />
                    </div>
                    <div>
                      <SubLabel htmlFor="sub-date" required>Original Release Date</SubLabel>
                      <input id="sub-date" name="releaseDate" type="date" required className="sub-input mt-2.5" />
                    </div>
                    <div>
                      <SubLabel htmlFor="sub-crbt" required>Caller Tune Timing (30 sec)</SubLabel>
                      <input id="sub-crbt" name="callerTune" type="text" required placeholder="e.g. 0:45 – 1:15" className="sub-input mt-2.5" />
                      <p className="sub-hint mt-2">The 30-second window that hooks a listener instantly.</p>
                    </div>
                  </div>
                </div>
              </SubSection>
            </Reveal>

            {/* ------------------------ 03 · masters ------------------------
                 Links, not uploads: artists host the master and artwork
                 wherever they already live (Drive, Dropbox, private
                 SoundCloud) and hand us a URL. Nothing large crosses the
                 wire, nothing is stored here, and a 300 MB WAV is no longer
                 a barrier to submitting. type="url" gives us native format
                 validation for free, matching the rest of the form. */}
            <Reveal delay={160}>
              <SubSection index="03" icon={Music2} title="Masters & Artwork" subtitle="Share links to your final files — we review exactly what you send." isDark={isDark}>
                <div className="space-y-6">
                  <div>
                    <SubLabel htmlFor="sub-audio-link" required>Audio Track Link</SubLabel>
                    <input
                      id="sub-audio-link"
                      name="audioLink"
                      type="url"
                      required
                      inputMode="url"
                      placeholder="e.g., Google Drive, Dropbox, or private SoundCloud link"
                      className="sub-input mt-2.5"
                    />
                    <p className="sub-hint mt-2">
                      44.1 kHz &amp; 320 kbps WAV preferred. Please make sure link permissions are
                      set to <span className={isDark ? "text-neutral-300" : "text-neutral-700"}>&ldquo;Anyone with the link can view&rdquo;</span> —
                      we can&rsquo;t review what we can&rsquo;t open.
                    </p>
                  </div>
                  <div>
                    <SubLabel htmlFor="sub-artwork-link" required>Artwork Link</SubLabel>
                    <input
                      id="sub-artwork-link"
                      name="artworkLink"
                      type="url"
                      required
                      inputMode="url"
                      placeholder="e.g., Google Drive or Dropbox link (High-res JPEG)"
                      className="sub-input mt-2.5"
                    />
                    <p className="sub-hint mt-2">
                      Minimum 3000×3000 pixels, JPEG. Same sharing rule — the link must be
                      viewable by anyone who has it.
                    </p>
                  </div>
                </div>
              </SubSection>
            </Reveal>

            {/* ------------------------------ submit ------------------------------ */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-5 pt-2">
              <p className="sub-hint max-w-xs text-center md:text-left">
                By submitting you confirm you own or control all rights to this recording.
              </p>
              <PrimaryButton
  icon={isSending ? Loader2 : ArrowUpRight}
  className={`w-full md:w-auto ${isSending ? "opacity-70 pointer-events-none" : ""}`}
>
  {isSending ? "Sending…" : "Submit Release"}
</PrimaryButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* SERVICES PAGE                                                       */
/* ------------------------------------------------------------------ */

/* ==================================================================== */
/* SERVICES — EDITORIAL LIST                                            */
/*                                                                      */
/* Not a grid of cards. A set of full-bleed typographic rows that behave */
/* like a printed contents page: oversized titles, hairline rules, and   */
/* an index number per line. The interaction does the rest —            */
/*                                                                      */
/*   • Hovering a row expands it (height 0 → auto) to reveal the icon    */
/*     and description. Height is animated by AnimatePresence rather     */
/*     than a max-height hack, so the easing is exact at any length.     */
/*   • Every OTHER row simultaneously drops to opacity 0.3, so attention */
/*     collapses onto one line. This is the whole trick: focus is        */
/*     created by removing, not by adding decoration.                    */
/*   • A hairline wipes in from the left and the title slides a few px   */
/*     right — small tactile cues that the row is "live".                */
/*                                                                      */
/* Everything animated is transform/opacity/height on a single element   */
/* per row, so a 9-item category stays comfortably at 60fps.            */
/* ==================================================================== */

/* One frictionless curve shared by every service interaction — fast to
   start, long luxurious settle. Reused rather than re-declared so the
   whole section moves as one piece. */

/* ==================================================================== */
/* SERVICES — THE MIXING CONSOLE                                        */
/*                                                                      */
/* Concept: services as hardware channel strips on a studio console —  */
/* a knob, a fader that physically rises when selected, a live VU      */
/* meter (reusing EQBars, so it echoes the rest of the site instead of */
/* inventing a new visual language) — instead of another card grid or  */
/* accordion. Selecting a strip updates ONE shared readout panel below,*/
/* the way pulling up a channel on a real console works.               */
/*                                                                      */
/* Mobile-gradient fix: the Email/Instagram buttons no longer rely on  */
/* CSS group-hover (which never reliably fires on touch — there's no   */
/* persistent hover state on a phone). Instead, a small piece of React */
/* state is driven by BOTH desktop hover AND Framer Motion's tap       */
/* events (onTapStart/onTap fire on touch too), with a short hold after*/
/* release so a tap gives a visible confirmation flash instead of      */
/* nothing.                                                            */
/*                                                                      */
/* HOW TO INSTALL: no new imports needed. Replace your ServiceRow /    */
/* ServiceList / Services components with everything below.            */
/* ==================================================================== */

const SERVICE_EASE = [0.22, 1, 0.36, 1];

const SERVICE_CONTACT = {
  email: "contactwwrecords@gmail.com",
  instagram: "https://www.instagram.com/wildwood_records?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==",
};

/* ---------------------------------------------------------------------
   Bespoke icon set — 15 custom line glyphs, one per service, drawn in a
   single consistent hand (24x24, 1.6–1.8 stroke, rounded caps) rather
   than pulled from a generic library. Matched by exact service.title,
   so nothing in the SERVICES data array needs to change.
--------------------------------------------------------------------- */
const svgProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };

const IconMic = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} className={className} {...svgProps}>
    <rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 10v1a7 7 0 0 0 14 0v-1" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" />
  </svg>
);
const IconProduction = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} className={className} {...svgProps}>
    <rect x="3" y="3" width="18" height="18" rx="4" /><path d="M7 13h1.6l1.3-4.5 2 9 1.4-4.5H17" />
  </svg>
);
const IconSongwriting = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} className={className} {...svgProps}>
    <path d="M4 20l4-1 10-10a2 2 0 0 0-3-3L5 16l-1 4z" /><path d="M14 6l3 3" />
  </svg>
);
const IconMixing = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} className={className} {...svgProps}>
    <line x1="6" y1="4" x2="6" y2="20" /><circle cx="6" cy="9" r="2" /><line x1="12" y1="4" x2="12" y2="20" /><circle cx="12" cy="15" r="2" /><line x1="18" y1="4" x2="18" y2="20" /><circle cx="18" cy="7" r="2" />
  </svg>
);
const IconMusicVideo = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} className={className} {...svgProps}>
    <path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" /><path d="M4 8l1.6-4.5h3.4L7.4 8" /><path d="M10.5 8l1.6-4.5h3.4L13.9 8" /><path d="M17 8l1.6-4.5H21L19.4 8" />
  </svg>
);
const IconVideoEdit = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} className={className} {...svgProps}>
    <circle cx="6" cy="6" r="2.1" /><circle cx="6" cy="18" r="2.1" /><path d="M7.6 7.6L19 19" /><path d="M7.6 16.4L19 5" />
  </svg>
);
const IconColorGrade = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} className={className} {...svgProps}>
    <circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
  </svg>
);
const IconCoverArt = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} className={className} {...svgProps}>
    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.7" cy="8.7" r="1.6" /><path d="M21 15.5l-5.2-5.2-9.3 9.3" />
  </svg>
);
const IconBranding = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} className={className} {...svgProps}>
    <circle cx="12" cy="8" r="5" /><path d="M8.3 12.6L7 21l5-3 5 3-1.3-8.4" />
  </svg>
);
const IconDistribution = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} className={className} {...svgProps}>
    <circle cx="12" cy="12" r="8" /><ellipse cx="12" cy="12" rx="8" ry="3.1" /><line x1="12" y1="4" x2="12" y2="20" />
  </svg>
);
const IconSocial = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} className={className} {...svgProps}>
    <circle cx="5.5" cy="12" r="2.2" /><circle cx="18.5" cy="5.5" r="2.2" /><circle cx="18.5" cy="18.5" r="2.2" /><line x1="7.4" y1="11" x2="16.6" y2="6.6" /><line x1="7.4" y1="13" x2="16.6" y2="17.4" />
  </svg>
);
const IconPlaylist = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} className={className} {...svgProps}>
    <line x1="4" y1="6" x2="14" y2="6" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="18" x2="14" y2="18" /><path d="M17 9.3l5 2.7-5 2.7z" fill="currentColor" stroke="none" />
  </svg>
);
const IconPR = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} className={className} {...svgProps}>
    <path d="M3 11v2a1 1 0 0 0 1 1h2l7 4V6l-7 4H4a1 1 0 0 0-1 1z" /><path d="M15.5 9.2a4 4 0 0 1 0 5.6" /><path d="M18.5 6.8a7.7 7.7 0 0 1 0 10.4" />
  </svg>
);
const IconManagement = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} className={className} {...svgProps}>
    <circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.3" /><path d="M15.6 13.2c2.5.4 4.4 2.6 4.4 5.2" />
  </svg>
);
const IconContracts = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} className={className} {...svgProps}>
    <path d="M6 3h9l3 3v15H6z" /><path d="M15 3v3h3" /><circle cx="11.5" cy="14" r="2.6" /><path d="M10.2 16.3L9 20.5l2.5-1.3 2.5 1.3-1.2-4.2" />
  </svg>
);

const SERVICE_GLYPHS = {
  "Recording": IconMic,
  "Music Production": IconProduction,
  "Songwriting": IconSongwriting,
  "Mixing & Mastering": IconMixing,
  "Music Video Production": IconMusicVideo,
  "Video Editing": IconVideoEdit,
  "Color Grading": IconColorGrade,
  "Cover Art": IconCoverArt,
  "Artist Branding": IconBranding,
  "Distribution": IconDistribution,
  "Social Media": IconSocial,
  "Playlist Pitching": IconPlaylist,
  "PR & Press": IconPR,
  "Artist Management": IconManagement,
  "Contracts & Royalties": IconContracts,
};

/* One channel strip: number, knob (rotates on select), fader (rises on
   select), a live VU read (your existing EQBars, reused rather than
   reinvented), and a vertical hardware-style label. */
const ChannelStrip = memo(function ChannelStrip({ service, index, isActive, onSelect, Icon, reduced }) {
  const { isDark } = useTheme();
  const accent = getAccent(service.title);

  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      aria-pressed={isActive}
      aria-label={`${service.title} — view details`}
      className={`group relative shrink-0 w-[64px] sm:w-[78px] flex flex-col items-center pt-4 pb-3 px-2 rounded-2xl border transition-colors duration-400 ${
        isActive
          ? isDark ? "bg-white/[0.07] border-white/25" : "bg-black/[0.045] border-black/20"
          : isDark ? "bg-white/[0.02] border-white/10 hover:border-white/20" : "bg-black/[0.015] border-black/10 hover:border-black/20"
      }`}
      style={isActive ? { borderColor: `${accent}55`, boxShadow: `inset 0 0 24px ${accent}14` } : undefined}
    >
      <span aria-hidden="true" className={`absolute top-2 left-2 w-1 h-1 rounded-full ${isDark ? "bg-white/25" : "bg-black/25"}`} />
      <span aria-hidden="true" className={`absolute top-2 right-2 w-1 h-1 rounded-full ${isDark ? "bg-white/25" : "bg-black/25"}`} />

      {/* Patch-bay LED — small, physical, lights up in the channel's own
          color when active. This is the tell that the console "knows"
          which channel is live, the way real hardware indicates it. */}
      <motion.span
        aria-hidden="true"
        animate={{
          backgroundColor: isActive ? accent : (isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"),
          boxShadow: isActive ? `0 0 6px 2px ${accent}, 0 0 14px 5px ${accent}77` : "none",
        }}
        transition={{ duration: 0.4 }}
        className="w-1.5 h-1.5 rounded-full mb-2.5"
      />

      <span className={`text-[9px] font-mono tracking-widest mb-2.5 transition-colors duration-300`} style={{ color: isActive ? accent : undefined }}>
        <span className={isActive ? "" : isDark ? "text-white/70" : "text-neutral-500"}>{!isActive && `CH${String(index + 1).padStart(2, "0")}`}</span>
        {isActive && `CH${String(index + 1).padStart(2, "0")}`}
      </span>

      <motion.span
        animate={{
          rotate: isActive && !reduced ? 32 : 0,
          borderColor: isActive ? accent : (isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"),
          backgroundColor: isActive ? accent : "transparent",
          boxShadow: isActive ? `0 0 14px 2px ${accent}66` : "none",
        }}
        transition={{ duration: 0.5, ease: SERVICE_EASE }}
        className={`w-9 h-9 rounded-full border flex items-center justify-center mb-4 ${isActive ? "text-black" : isDark ? "text-white/70" : "text-neutral-600"}`}
      >
        <Icon size={16} />
      </motion.span>

      <div className={`relative w-1.5 h-24 sm:h-28 rounded-full mb-3 ${isDark ? "bg-white/10" : "bg-black/10"}`}>
        <motion.span
          animate={{
            bottom: isActive ? "72%" : "8%",
            backgroundColor: isActive ? accent : (isDark ? "#ffffff" : "#171717"),
            boxShadow: isActive ? `0 0 12px 3px ${accent}` : "none",
          }}
          transition={{ duration: reduced ? 0 : 0.5, ease: SERVICE_EASE }}
          className="absolute left-1/2 -translate-x-1/2 w-4 h-2.5 rounded-[3px]"
        />
      </div>

      <EQBars count={3} isPlaying={isActive} color={isActive ? accent : null} className="mb-4" />

      <span
        className="text-[10px] font-bold tracking-wide leading-tight text-center transition-colors duration-300"
        style={{
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          maxHeight: "92px",
          color: isActive ? accent : undefined,
        }}
      >
        <span className={isActive ? "" : isDark ? "text-neutral-500" : "text-neutral-500"}>{service.title}</span>
      </span>
    </button>
  );
});

const CATEGORY_META = {
  "Creative Production": { icon: Music2, blurb: "Recording, production, and post" },
  "Marketing & Growth": { icon: Globe, blurb: "Reach, playlists, and press" },
  "Artist Business & Management": { icon: Users, blurb: "Career, contracts, and royalties" },
};

const ServiceCategoryCard = memo(function ServiceCategoryCard({ group, index, onSelect }) {
  const { isDark } = useTheme();
  const meta = CATEGORY_META[group.category] || { icon: Disc3, blurb: "" };
  const CatIcon = meta.icon;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(index)}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.3, ease: SERVICE_EASE }}
      className={`group relative overflow-hidden rounded-3xl border p-7 md:p-9 text-left w-full ${
        isDark ? "bg-gradient-to-b from-white/[0.04] to-transparent border-white/10 hover:border-white/25" : "bg-gradient-to-b from-black/[0.025] to-transparent border-black/10 hover:border-black/20"
      }`}
    >
      {/* brushed texture + corner screws, same hardware language as the strips */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: isDark ? "repeating-linear-gradient(180deg, rgba(255,255,255,0.7) 0px, transparent 1px, transparent 3px)" : "repeating-linear-gradient(180deg, rgba(0,0,0,0.5) 0px, transparent 1px, transparent 3px)" }}
      />
      <span aria-hidden="true" className={`absolute top-3 left-3 w-1 h-1 rounded-full ${isDark ? "bg-white/25" : "bg-black/25"}`} />
      <span aria-hidden="true" className={`absolute top-3 right-3 w-1 h-1 rounded-full ${isDark ? "bg-white/25" : "bg-black/25"}`} />
      <span aria-hidden="true" className={`absolute bottom-3 left-3 w-1 h-1 rounded-full ${isDark ? "bg-white/25" : "bg-black/25"}`} />
      <span aria-hidden="true" className={`absolute bottom-3 right-3 w-1 h-1 rounded-full ${isDark ? "bg-white/25" : "bg-black/25"}`} />

      <div className="relative flex items-start justify-between mb-6">
        <span className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-colors duration-300 ${isDark ? "border-white/20 text-white group-hover:bg-white group-hover:text-black" : "border-black/20 text-neutral-900 group-hover:bg-neutral-900 group-hover:text-white"}`}>
          <CatIcon size={20} />
        </span>
        <span className={`font-display text-lg select-none ${isDark ? "text-white/20" : "text-neutral-900/20"}`}>
          ( {String(index + 1).padStart(2, "0")} )
        </span>
      </div>

      <h3 className={`font-display text-2xl md:text-3xl leading-tight mb-2 ${isDark ? "text-white" : "text-neutral-900"}`}>
        {group.category}
      </h3>
      <p className={`text-sm mb-6 ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>{meta.blurb}</p>

      <div className="flex items-center justify-between">
  <div className="flex items-center gap-1.5" aria-hidden="true">
    {group.items.slice(0, 6).map((s) => (
      <span key={s.title} className="w-1.5 h-1.5 rounded-full transition-transform duration-300 group-hover:scale-125" style={{ backgroundColor: getAccent(s.title), boxShadow: `0 0 6px ${getAccent(s.title)}aa` }} />
    ))}
  </div>
  <span className={`inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] uppercase ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
    {group.items.length} Channels
    <ArrowUpRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
  </span>
</div>
    </motion.button>
  );
});

/* Shared readout panel: swaps content on selection, glass surface, one
   light sweep on entry. The two contact buttons are the mobile-gradient
   fix — see the component-level comment at the top of this block. */
const ConsoleReadout = memo(function ConsoleReadout({ service }) {
  const { isDark } = useTheme();
  const [litEmail, setLitEmail] = useState(false);
  const [litIG, setLitIG] = useState(false);

  if (!service) {
    return (
      <div className={`rounded-2xl border border-dashed p-8 md:p-10 mt-6 text-center ${isDark ? "border-white/15 text-neutral-500" : "border-black/15 text-neutral-400"}`}>
        <p className="text-xs tracking-[0.25em] uppercase font-semibold">Channel Closed</p>
        <p className="text-sm mt-2">Select a channel above to bring it up on the console.</p>
      </div>
    );
  }

  const Icon = SERVICE_GLYPHS[service.title] || service.icon;
  const accent = getAccent(service.title);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={service.title}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.35, ease: SERVICE_EASE }}
        className={`relative overflow-hidden rounded-2xl border backdrop-blur-2xl p-6 md:p-9 mt-6 ${isDark ? "bg-white/[0.04] border-white/10" : "bg-black/[0.03] border-black/10"}`}
      >
        {/* Subtle color wash — the panel itself takes on a whisper of the
            channel's identity, like light bleeding from a lit fader. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full blur-[50px] opacity-25"
          style={{ background: accent }}
        />
        {/* Top accent line — the channel's "signature" running along the
            panel edge, same idea as the LED but at readout scale. */}
        <div aria-hidden="true" className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

        <div className="relative flex items-center gap-3 mb-4">
          <span
            className="w-10 h-10 rounded-full border flex items-center justify-center shrink-0 transition-colors duration-300"
            style={{ borderColor: `${accent}70`, color: accent, boxShadow: `0 0 16px ${accent}30` }}
          >
            <Icon size={18} />
          </span>
          <h3 className={`font-display text-2xl md:text-3xl ${isDark ? "text-white" : "text-neutral-900"}`}>{service.title}</h3>
        </div>

        <p className={`relative text-sm md:text-lg leading-relaxed max-w-2xl ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
          {service.description}
        </p>

        <div className="relative flex flex-wrap items-center gap-3 mt-6">
          <motion.a
            href={`mailto:${SERVICE_CONTACT.email}?subject=${encodeURIComponent(`Enquiry — ${service.title}`)}`}
            onHoverStart={() => setLitEmail(true)}
            onHoverEnd={() => setLitEmail(false)}
            onTapStart={() => setLitEmail(true)}
            onTap={() => setTimeout(() => setLitEmail(false), 700)}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className={`press-feedback inline-flex items-center gap-2.5 rounded-full pl-4 pr-5 py-2.5 text-xs font-bold tracking-[0.14em] uppercase border transition-colors duration-300 ${
              litEmail
                ? isDark ? "bg-white text-black border-white" : "bg-neutral-900 text-white border-neutral-900"
                : isDark ? "border-white/15 bg-white/5 text-white" : "border-black/15 bg-black/5 text-neutral-900"
            }`}
          >
            <Mail size={15} /> Email Studio
          </motion.a>

          <motion.a
            href={SERVICE_CONTACT.instagram}
            target="_blank"
            rel="noopener noreferrer"
            onHoverStart={() => setLitIG(true)}
            onHoverEnd={() => setLitIG(false)}
            onTapStart={() => setLitIG(true)}
            onTap={() => setTimeout(() => setLitIG(false), 700)}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="press-feedback relative inline-block rounded-full p-px"
          >
            <span aria-hidden="true" className={`absolute -inset-1.5 rounded-full bg-[linear-gradient(120deg,#f9ce34,#ee2a7b,#6228d7)] blur-lg transition-opacity duration-300 ${litIG ? "opacity-45" : "opacity-0"}`} />
            <span aria-hidden="true" className={`absolute inset-0 rounded-full transition-opacity duration-300 ${litIG ? "opacity-0" : "opacity-100"} ${isDark ? "bg-white/15" : "bg-black/15"}`} />
            <span aria-hidden="true" className={`absolute inset-0 rounded-full bg-[linear-gradient(120deg,#f9ce34,#ee2a7b,#6228d7)] transition-opacity duration-300 ${litIG ? "opacity-100" : "opacity-0"}`} />
            <span className={`relative z-10 inline-flex items-center gap-2.5 rounded-full pl-4 pr-5 py-2.5 text-xs font-bold tracking-[0.14em] uppercase ${isDark ? "bg-[#0b0b0c] text-white" : "bg-white text-neutral-900"}`}>
              <Instagram size={15} /> Instagram DM
            </span>
          </motion.a>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

/* One category's console: a horizontally-scrollable strip row (mobile
   snap-scrolls one channel at a time) over a faint brushed-metal texture,
   plus the shared readout below it. */
const ServiceConsoleGroup = memo(function ServiceConsoleGroup({ group, reduced }) {
  const { isDark } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const active = activeIndex !== null ? group.items[activeIndex] : null;
  const accent = active ? getAccent(active.title) : null;

  const toggleChannel = useCallback((i) => {
    setActiveIndex((cur) => (cur === i ? null : i));
  }, []);

  return (
    <div>
      <div className={`relative overflow-hidden rounded-3xl border p-5 md:p-7 ${isDark ? "bg-gradient-to-b from-white/[0.03] to-transparent border-white/10" : "bg-gradient-to-b from-black/[0.02] to-transparent border-black/10"}`}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: isDark ? "repeating-linear-gradient(180deg, rgba(255,255,255,0.7) 0px, transparent 1px, transparent 3px)" : "repeating-linear-gradient(180deg, rgba(0,0,0,0.5) 0px, transparent 1px, transparent 3px)" }}
        />
        {/* Ambient bloom — the whole console housing catches a hint of
            whichever channel is live, like backlighting on real gear.
            Framer interpolates the color itself, so it drifts smoothly
            from one channel's hue to the next rather than snapping. */}
        <motion.div
          aria-hidden="true"
          animate={{ backgroundColor: accent || "transparent", opacity: accent ? 0.10 : 0 }}
          transition={{ duration: 0.6, ease: SERVICE_EASE }}
          className="pointer-events-none absolute -inset-20 blur-[60px]"
        />

        <div className="relative flex gap-2.5 sm:gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <style>{`div::-webkit-scrollbar{display:none}`}</style>
          {group.items.map((service, i) => (
            <div key={service.title} className="snap-start">
              <ChannelStrip
                service={service}
                index={i}
                isActive={activeIndex === i}
                onSelect={toggleChannel}
                Icon={SERVICE_GLYPHS[service.title] || service.icon}
                reduced={reduced}
              />
            </div>
          ))}
        </div>
      </div>
      <ConsoleReadout service={active} />
    </div>
  );
});

const Services = memo(function Services() {
  const { isDark } = useTheme();
  const reduced = usePrefersReducedMotion();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const group = selectedCategory !== null ? SERVICES[selectedCategory] : null;

  return (
    <section id="services" aria-labelledby="services-heading" className="relative z-10">
      <div className="relative pt-32 md:pt-44 pb-12 md:pb-16 px-5 md:px-8 lg:px-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] md:w-[900px] md:h-[900px] rounded-full blur-[20px] ${isDark ? "bg-[radial-gradient(circle,rgba(200,200,205,0.09),transparent_70%)]" : "bg-[radial-gradient(circle,rgba(60,60,70,0.07),transparent_70%)]"}`} />
        </div>
        <div className="max-w-3xl mx-auto text-center relative">
          <Eyebrow>What We Do</Eyebrow>
          <h1 id="services-heading" className={`font-display text-page-title mb-6 ${isDark ? "text-white" : "text-neutral-900"}`}>
            Services
          </h1>
          <p className={`text-sm md:text-base lg:text-lg leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
            Everything an artist needs&mdash;from recording and production to marketing, distribution, branding, and long-term career growth.
          </p>
          <p className={`text-xs mt-4 tracking-[0.2em] uppercase font-semibold ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>
            {group ? "Pull up a channel to hear more" : "Choose a console to open"}
          </p>
        </div>
      </div>

      <div className="px-5 md:px-8 lg:px-10 pb-8">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {group === null ? (
              <motion.div
                key="category-grid"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: SERVICE_EASE }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-7"
              >
                {SERVICES.map((g, i) => (
                  <Reveal key={g.category} delay={i * 80}>
                    <ServiceCategoryCard group={g} index={i} onSelect={setSelectedCategory} />
                  </Reveal>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key={`category-${selectedCategory}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: SERVICE_EASE }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className={`press-feedback inline-flex items-center gap-2 mb-8 rounded-full px-5 py-2.5 text-xs font-bold tracking-[0.15em] uppercase border transition-colors duration-300 ${
                    isDark ? "border-white/15 text-white hover:bg-white hover:text-black" : "border-black/15 text-neutral-900 hover:bg-neutral-900 hover:text-white"
                  }`}
                >
                  <ArrowLeft size={14} /> Back to All Services
                </button>

                <div className="flex items-end justify-between gap-6 mb-5">
                  <h2 className={`font-display text-section-title leading-none ${isDark ? "text-white" : "text-neutral-900"}`}>
                    {group.category}
                  </h2>
                  <div className={`hidden md:flex items-baseline gap-3 pb-1 shrink-0 text-xs tracking-[0.25em] uppercase font-semibold ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                    <span className="font-display normal-case tracking-normal text-base">
                      ( {String(selectedCategory + 1).padStart(2, "0")} )
                    </span>
                    <span>{String(group.items.length).padStart(2, "0")} channels</span>
                  </div>
                </div>

                <ServiceConsoleGroup group={group} reduced={reduced} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="px-5 md:px-8 lg:px-10 pb-20 md:pb-32 pt-16 md:pt-20">
        <div className={`max-w-7xl mx-auto rounded-3xl border backdrop-blur-xl px-6 py-12 md:px-16 md:py-20 relative overflow-hidden text-center ${isDark ? "border-white/10 bg-neutral-900/50 shadow-2xl" : "border-neutral-200 bg-white/85 shadow-[0_25px_70px_-20px_rgba(0,0,0,0.18)]"}`}>
          <div className={`absolute -top-32 -right-32 w-96 h-96 rounded-full blur-[20px] ${isDark ? "bg-[radial-gradient(circle,rgba(200,200,205,0.08),transparent_70%)]" : "bg-[radial-gradient(circle,rgba(60,60,70,0.06),transparent_70%)]"}`} />
          <div className="relative max-w-2xl mx-auto">
            <h2 className={`font-display text-section-title leading-[1.05] mb-4 ${isDark ? "text-white" : "text-neutral-900"}`}>
              Ready to Build Your Career?
            </h2>
            <p className={`text-sm md:text-base leading-relaxed mb-8 md:mb-10 ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
              Whether you're releasing your first single or growing your brand worldwide, Wildwood Records provides everything you need under one roof.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <PrimaryButton href="mailto:contactwwrecords@gmail.com" icon={Mail} className="w-full sm:w-auto">
                Email Us
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
/* ------------------------------- MODAL (ADVANCED PLAYER) ------------------------------- */

function ReleaseModal({ release, onClose, playing, isPlaying: transportPlaying, togglePlay, progressMV, currentTime, onScrub }) {
  const { isDark } = useTheme();
  
  if (!release) return null;
  /* Two distinct questions again: is THIS the loaded track, and is the
     transport running? The progress bar and timestamp key off the former
     so they FREEZE at the paused position instead of snapping to 0:00;
     only the icon and the EQ meter key off the latter. */
  const isCurrentTrack = playing === release.id;
  const isPlaying = isCurrentTrack && transportPlaying;

  return (
    /* No flex/items-end on mobile anymore — the panel below pins itself
       directly to the viewport with `fixed inset-0`, so it doesn't need a
       flex parent to position it. sm: still centers via flex for desktop. */
    <div className="fixed inset-0 z-[100] sm:flex sm:items-center sm:justify-center sm:p-6 overflow-hidden">
      <div className={`fixed inset-0 backdrop-blur-2xl transition-opacity duration-500 ${isDark ? "bg-black/95" : "bg-black/40"}`} onClick={onClose} />

      {/* MOBILE: `fixed inset-0` pins the panel to the actual viewport edges
          (top:0/right:0/bottom:0/left:0). That's not a height value the
          browser has to compute (like h-[100dvh] or h-screen), so there's
          no frame where it renders against a stale viewport height while
          the address bar animates in/out — it's always exactly flush.

          DESKTOP (sm:): `sm:relative sm:inset-auto` cancels the fixed
          pinning, handing sizing back to the parent's flex centering +
          sm:max-h-[85vh], restoring the normal centered dialog. */}
      <div className={`fixed inset-0 sm:relative sm:inset-auto w-full sm:max-w-4xl sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl sm:border overflow-y-auto overscroll-contain animate-modal-in flex flex-col ${isDark ? "bg-[#080808] border-white/10 shadow-[0_40px_120px_-20px_rgba(0,0,0,1)]" : "bg-white border-black/10 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.35)]"}`}>
        
        {/* Sticky Header with Back Option & Close Button */}
        <div className={`sticky top-0 z-30 flex items-center justify-between px-6 py-4 backdrop-blur-xl border-b ${isDark ? "bg-[#080808]/90 border-white/5" : "bg-white/90 border-black/5"}`}>
          <button
            onClick={onClose}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full transition-colors text-xs font-semibold uppercase tracking-wider border ${isDark ? "bg-white/10 text-white hover:bg-white/20 border-white/10" : "bg-neutral-900/5 text-neutral-900 hover:bg-neutral-900/10 border-black/10"}`}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            onClick={onClose}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${isDark ? "text-neutral-400 hover:text-white hover:bg-white/10" : "text-neutral-500 hover:text-neutral-900 hover:bg-black/5"}`}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col md:grid md:grid-cols-[320px_1fr] flex-1">
          <div className={`relative w-full aspect-square md:aspect-auto md:h-full overflow-hidden border-b md:border-b-0 md:border-r bg-neutral-900 ${isDark ? "border-white/5" : "border-black/5"}`}>
            <img
              src={release.coverImg}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40 md:hidden"
            />
            <div className="absolute inset-0 bg-black/40 md:hidden" />
            <img
              src={release.coverImg}
              alt={release.title}
              className="absolute inset-0 w-full h-full object-contain p-5 sm:p-8 md:p-0 md:object-cover drop-shadow-2xl"
            />
            <div className="hidden md:block absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
            <span className="absolute top-4 left-4 md:top-6 md:left-6 text-xs tracking-[0.2em] font-bold uppercase text-white/90 border border-white/20 rounded-full px-3 py-1.5 z-10 backdrop-blur-md bg-black/40 shadow-lg">
              {release.type}
            </span>
          </div>

          <div className="safe-bottom p-6 md:p-10 flex flex-col">
            <p className="text-xs md:text-sm font-bold tracking-[0.2em] uppercase text-neutral-500 mb-2 md:mb-3">{release.artist} &middot; {release.year}</p>
            <h2 className={`font-display text-section-title mb-6 md:mb-8 leading-none ${isDark ? "text-white" : "text-neutral-900"}`}>{release.title}</h2>

            <div className={`backdrop-blur-xl border rounded-2xl p-5 md:p-6 mb-8 shadow-inner ${isDark ? "bg-black/40 border-white/5" : "bg-neutral-100 border-black/5"}`}>
              <div className="flex items-center gap-5 mb-5">
                <button
                  onClick={() => togglePlay(release.id)}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  className={`press-feedback w-14 h-14 shrink-0 rounded-full flex items-center justify-center hover:scale-105 transition-[transform,box-shadow] duration-300 ${isDark ? "bg-white shadow-[0_0_30px_rgba(255,255,255,0.2)]" : "bg-neutral-900 shadow-[0_0_30px_rgba(0,0,0,0.2)]"}`}
                >
                  {isPlaying ? <Pause size={20} className={isDark ? "text-black" : "text-white"} fill="currentColor" /> : <Play size={20} className={`ml-1 ${isDark ? "text-black" : "text-white"}`} fill="currentColor" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold truncate text-sm md:text-base ${isDark ? "text-white" : "text-neutral-900"}`}>{release.title}</p>
                  <p className={`text-sm md:text-base truncate ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>{release.artist}</p>
                </div>
                <EQBars count={5} tall isPlaying={isPlaying} className="hidden sm:flex shrink-0" />
              </div>
              
              <div className="flex items-center gap-3 w-full">
                <span className="text-xs md:text-sm text-neutral-500 font-medium tabular-nums w-8 text-right">{isCurrentTrack ? currentTime : "0:00"}</span>
                {/* Only the loaded track owns the shared playhead — a modal
                    opened on some OTHER release shows an inert empty bar
                    rather than another song's position. */}
                {isCurrentTrack ? (
                  <SeekBar
                    progressMV={progressMV}
                    onSeek={onScrub}
                    ariaLabel="Seek"
                    className={`flex-1 h-2 md:h-1.5 rounded-full overflow-hidden hover:h-3 md:hover:h-2 transition-[height] duration-200 focus:outline-none focus-visible:ring-2 ${isDark ? "bg-white/10 focus-visible:ring-white/50" : "bg-black/10 focus-visible:ring-black/30"}`}
                    fillClassName={`rounded-full ${isDark ? "bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" : "bg-neutral-900 shadow-[0_0_10px_rgba(0,0,0,0.35)]"}`}
                    hoverOverlayClassName={`opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? "bg-white/20" : "bg-black/10"}`}
                  />
                ) : (
                  <div className={`flex-1 h-2 md:h-1.5 rounded-full ${isDark ? "bg-white/10" : "bg-black/10"}`} />
                )}
                <span className="text-xs md:text-sm text-neutral-500 font-medium tabular-nums w-8">{release.duration}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-3 md:gap-4 mb-8">
              <a
                href={release.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none inline-flex justify-center items-center gap-2 border border-[#1DB954]/40 bg-[#1DB954]/10 text-[#1DB954] px-6 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold tracking-wide uppercase rounded-full transition-all duration-300 hover:bg-[#1DB954] hover:text-white hover:border-[#1DB954] hover:shadow-[0_0_20px_rgba(29,185,84,0.35)] active:bg-[#1DB954] active:text-white active:border-[#1DB954] active:shadow-[0_0_20px_rgba(29,185,84,0.35)] active:scale-[0.98]"
              >
                <Spotify size={16} /> Listen on Spotify
              </a>
              <a
                href={release.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none inline-flex justify-center items-center gap-2 border border-red-500/40 bg-red-500/10 text-red-500 px-6 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold tracking-wide uppercase rounded-full transition-all duration-300 hover:bg-[#FF0000] hover:text-white hover:border-[#FF0000] hover:shadow-[0_0_20px_rgba(255,0,0,0.3)] active:bg-[#FF0000] active:text-white active:border-[#FF0000] active:shadow-[0_0_20px_rgba(255,0,0,0.3)] active:scale-[0.98]"
              >
                <Youtube size={16} /> Watch on YouTube
              </a>
            </div>

            <div className={`mt-auto pt-6 border-t space-y-4 ${isDark ? "border-white/5" : "border-black/10"}`}>
               {release.composition && (
                 <div className="flex justify-between text-sm md:text-base">
                   <span className="text-neutral-500">Composition</span>
                   <span className={`font-medium ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>{release.composition}</span>
                 </div>
               )}
               {release.lyrics && (
                 <div className="flex justify-between text-sm md:text-base">
                   <span className="text-neutral-500">Lyrics</span>
                   <span className={`font-medium ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>{release.lyrics}</span>
                 </div>
               )}
               <div className="flex justify-between text-sm md:text-base">
                 <span className="text-neutral-500">Label</span>
                 <span className={`font-medium ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>{release.credits}</span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- GLOBAL STICKY PLAYER ------------------------------- */

/* ==================================================================== */
/* SEEK BAR — one shared, drag-capable scrubber                         */
/*                                                                      */
/* Why a MotionValue instead of React state: <audio> fires timeupdate    */
/* ~4–66×/second. Routing that through setState re-rendered AppShell and */
/* every child on each tick, which is what made playback feel laggy.     */
/* `progressMV` writes straight to the DOM transform, so the fill glides */
/* at 60fps with ZERO React renders.                                     */
/*                                                                      */
/* Drag uses setPointerCapture, which is what makes this feel native:    */
/* once you press, this element keeps receiving events even if the       */
/* pointer leaves it — so a fast drag off the edge doesn't drop the      */
/* grab. It also unifies mouse, touch and pen through one code path.     */
/*                                                                      */
/* onSeek phases:                                                        */
/*   "start"/"move" — preview only. The parent updates the visual and    */
/*                    SUPPRESSES timeupdate, so the bar can't fight the  */
/*                    audio element's own position while you drag.       */
/*   "end"          — commit: assign audio.currentTime once, on release. */
/* ==================================================================== */
const SeekBar = memo(function SeekBar({
  progressMV,
  onSeek,
  ariaLabel = "Seek",
  className = "",
  fillClassName = "",
  hoverOverlayClassName = "",
}) {
  const barRef = useRef(null);
  const draggingRef = useRef(false);

  const fractionFromEvent = useCallback((e) => {
    const el = barRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return 0;
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  const handlePointerDown = useCallback((e) => {
    /* Ignore secondary buttons so a right-click can't hijack the scrub. */
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    draggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onSeek(fractionFromEvent(e), "start");
  }, [fractionFromEvent, onSeek]);

  const handlePointerMove = useCallback((e) => {
    if (!draggingRef.current) return;
    onSeek(fractionFromEvent(e), "move");
  }, [fractionFromEvent, onSeek]);

  const endDrag = useCallback((e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    onSeek(fractionFromEvent(e), "end");
  }, [fractionFromEvent, onSeek]);

  const handleKeyDown = useCallback((e) => {
    const step = e.shiftKey ? 0.1 : 0.05;
    const current = progressMV.get();
    if (e.key === "ArrowRight") { e.preventDefault(); onSeek(Math.min(1, current + step), "end"); }
    if (e.key === "ArrowLeft")  { e.preventDefault(); onSeek(Math.max(0, current - step), "end"); }
    if (e.key === "Home")       { e.preventDefault(); onSeek(0, "end"); }
    if (e.key === "End")        { e.preventDefault(); onSeek(1, "end"); }
  }, [onSeek, progressMV]);

  return (
    <div
      ref={barRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      /* touch-none stops the browser claiming the gesture for scrolling,
         which would otherwise make dragging on mobile impossible. */
      className={`relative touch-none select-none cursor-pointer group ${className}`}
    >
      <motion.div
        className={`absolute top-0 left-0 bottom-0 origin-left ${fillClassName}`}
        style={{ scaleX: progressMV, width: "100%" }}
      />
      {hoverOverlayClassName && <div className={`absolute inset-0 pointer-events-none ${hoverOverlayClassName}`} />}
    </div>
  );
});

const GlobalPlayer = memo(function GlobalPlayer({ playingRelease, isPlaying, togglePlay, progressMV, currentTime, onScrub, onOpen, onDismiss, onBackToList }) {
  const { isDark } = useTheme();

  if (!playingRelease) return null;

  return (
    /* Visibility is tied to a track being LOADED (guaranteed by the guard
       above), never to transport state — otherwise pausing would slide the
       whole mini player off the bottom of the screen. */
    <div className="fixed bottom-0 left-0 right-0 z-40 transition-transform duration-500 ease-out will-change-transform translate-y-0">
      {/* Taller hit area than it looks: h-1 visually, but the wrapper gives
          the pointer a forgiving target — grabbing a 4px line is a chore. */}
      <SeekBar
        progressMV={progressMV}
        onSeek={onScrub}
        ariaLabel="Seek current track"
        className={`w-full h-1.5 md:h-1 hover:h-2 transition-[height] duration-200 focus:outline-none focus-visible:h-2 ${isDark ? "bg-neutral-900" : "bg-neutral-200"}`}
        fillClassName="bg-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.85)]"
      />

      <div className={`safe-bottom backdrop-blur-2xl border-t px-4 md:px-8 py-3 md:py-4 flex items-center justify-between gap-3 md:gap-8 ${isDark ? "bg-black/90 border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]" : "bg-white/90 border-neutral-200 shadow-[0_-10px_40px_rgba(0,0,0,0.12)]"}`}>
        
        <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0 cursor-pointer group" onClick={() => onOpen(playingRelease)}>
          <div className={`relative w-10 h-10 md:w-14 md:h-14 rounded-md md:rounded-lg overflow-hidden shrink-0 shadow-md border transition-colors ${isDark ? "border-white/10 group-hover:border-white/30" : "border-black/10 group-hover:border-black/30"}`}>
            <img src={playingRelease.coverImg} alt={playingRelease.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronUp size={20} className="text-white" />
            </div>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <p className={`text-sm md:text-base font-semibold truncate group-hover:underline ${isDark ? "text-white decoration-white/50" : "text-neutral-900 decoration-neutral-900/40"}`}>{playingRelease.title}</p>
              <EQBars count={3} isPlaying={isPlaying} className="shrink-0" />
            </div>
            <p className={`text-xs md:text-sm truncate ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>{playingRelease.artist}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-4 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onBackToList(); }}
            aria-label="Back to track listing"
            title="Back to track listing"
            className={`hidden sm:flex w-9 h-9 md:w-10 md:h-10 rounded-full border items-center justify-center transition-all duration-300 ${isDark ? "border-white/10 text-neutral-400 hover:text-white hover:border-white/30 hover:bg-white/5" : "border-black/10 text-neutral-500 hover:text-neutral-900 hover:border-black/30 hover:bg-black/5"}`}
          >
            <ListMusic size={16} />
          </button>

          <div className="hidden lg:flex items-center gap-2">
            <a
              href={playingRelease.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label="Listen on Spotify"
              title="Listen on Spotify"
              className="w-9 h-9 rounded-full border border-[#1DB954]/40 bg-[#1DB954]/10 text-[#1DB954] flex items-center justify-center hover:text-white hover:bg-[#1DB954] hover:border-[#1DB954] active:text-white active:bg-[#1DB954] active:border-[#1DB954] active:scale-95 transition-all duration-300"
            >
              <Spotify size={15} />
            </a>
            <a
              href={playingRelease.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label="Watch on YouTube"
              title="Watch on YouTube"
              className="w-9 h-9 rounded-full border border-red-500/40 bg-red-500/10 text-red-500 flex items-center justify-center hover:text-white hover:bg-[#FF0000] hover:border-[#FF0000] active:text-white active:bg-[#FF0000] active:border-[#FF0000] active:scale-95 transition-all duration-300"
            >
              <Youtube size={15} />
            </a>
          </div>

          <div className={`hidden sm:flex text-xs font-medium tabular-nums ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
            {currentTime} <span className={`mx-1 ${isDark ? "text-neutral-700" : "text-neutral-300"}`}>/</span> {playingRelease.duration}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); togglePlay(playingRelease.id); }}
            aria-label={isPlaying ? "Pause" : "Play"}
            className={`press-feedback w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center hover:scale-105 transition-transform duration-300 ${isDark ? "bg-white shadow-[0_0_15px_rgba(255,255,255,0.2)]" : "bg-neutral-900 shadow-[0_0_15px_rgba(0,0,0,0.25)]"}`}
          >
            {isPlaying ? <Pause size={18} className={isDark ? "text-black" : "text-white"} fill="currentColor" /> : <Play size={18} className={`ml-1 ${isDark ? "text-black" : "text-white"}`} fill="currentColor" />}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            aria-label="Stop and dismiss player"
            title="Stop and dismiss player"
            className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-300 ${isDark ? "text-neutral-400 hover:text-white hover:bg-white/10" : "text-neutral-500 hover:text-neutral-900 hover:bg-black/5"}`}
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* VINYL CURSOR — a small spinning record that trails the mouse.       */
/* Purely additive: desktop/fine-pointer only, pointer-events-none,    */
/* zero interaction with existing click handlers or layout. Mount it   */
/* once in AppShell alongside AmbientNotes/FloatingBackground.         */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* VINYL CURSOR — a small spinning record that trails the mouse.       */
/* Purely additive: desktop/fine-pointer only, pointer-events-none,    */
/* zero interaction with existing click handlers or layout. Mount it   */
/* once in AppShell alongside AmbientNotes/FloatingBackground.         */
/* ------------------------------------------------------------------ */

const VinylCursor = memo(function VinylCursor({ isPlaying = false }) {
  const { isDark } = useTheme();
  const wrapRef = useRef(null);
  const pos = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [isFinePointer, setIsFinePointer] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: fine)");
    setIsFinePointer(mq.matches);
    const onChange = (e) => setIsFinePointer(e.matches);
    mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", onChange) : mq.removeListener(onChange);
    };
  }, []);

  useEffect(() => {
    if (!isFinePointer) return;
    const onMove = (e) => {
      target.current = { x: e.clientX, y: e.clientY };
      setVisible(true);
    };
    const onLeave = () => setVisible(false);
    window.addEventListener("mousemove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, [isFinePointer]);

  useEffect(() => {
    if (!isFinePointer) return;
    const tick = () => {
      pos.current.x += (target.current.x - pos.current.x) * 0.18;
      pos.current.y += (target.current.y - pos.current.y) * 0.18;
      if (wrapRef.current) {
        wrapRef.current.style.transform = `translate(${pos.current.x - 14}px, ${pos.current.y - 14}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isFinePointer]);

  if (!isFinePointer) return null;

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className={`fixed top-0 left-0 z-[90] pointer-events-none transition-opacity duration-300 ${visible ? "opacity-70" : "opacity-0"}`}
    >
      <div
        className={`w-7 h-7 rounded-full vinyl-cursor-spin relative ${isPlaying ? "is-spinning" : ""}`}
        style={{
          background: isDark
            ? "radial-gradient(circle at 35% 35%, #3a3a3a, #0a0a0a 70%)"
            : "radial-gradient(circle at 35% 35%, #4a4a4a, #111 70%)",
          boxShadow: isDark ? "0 0 14px rgba(255,255,255,0.15)" : "0 0 14px rgba(0,0,0,0.2)",
        }}
      >
        <span className="absolute inset-[38%] rounded-full bg-white/70" />
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* SCROLL PROGRESS — a hairline bar tracking read depth. Additive,     */
/* fixed, pointer-events-none. Mount once at the top of AppShell.      */
/* ------------------------------------------------------------------ */

const ScrollProgressBar = memo(function ScrollProgressBar() {
  const { isDark } = useTheme();
  const barRef = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || document.body.scrollTop;
      const scrollHeight = (doc.scrollHeight || document.body.scrollHeight) - doc.clientHeight;
      const pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      if (barRef.current) barRef.current.style.width = `${pct}%`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[2px] pointer-events-none" aria-hidden="true">
      <div
        ref={barRef}
        className="h-full transition-[width] duration-150 ease-out"
        style={{ width: "0%", background: isDark ? "linear-gradient(90deg,#ffffff,#10b981)" : "linear-gradient(90deg,#171717,#10b981)" }}
      />
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* CENTRAL MASTER ENTRYPOINT: APP                                     */
/* ------------------------------------------------------------------ */

function AppShell() {
  const { isDark } = useTheme();

  /* `view` now comes from the real URL, and `setView` now performs a
     real navigation — both keep the exact same name/shape every
     existing component already calls, so Nav, Footer, Home, Services,
     and backToTrackListing() below are all untouched. */
  const location = useLocation();
  const navigate = useNavigate();
  const view = pathToView(location.pathname);
  const setView = useCallback((id) => {
    navigate(viewToPath(id));
  }, [navigate]);

  const [selectedRelease, setSelectedRelease] = useState(null);

  /* ------------------------- PLAYBACK STATE -------------------------
     THE FIX: these used to be a single `playingId`, which conflated two
     completely different questions — "which track is loaded?" and "is it
     currently playing?". Pausing set it to null, so `playingRelease`
     became undefined, GlobalPlayer hit its `if (!playingRelease) return
     null` guard, and the whole mini player unmounted. The track appeared
     to close/reset even though the <audio> element had faithfully kept
     its position all along.

     Now they are separate:
       currentTrackId — survives pause. Only changes when a DIFFERENT
                        song is chosen, or the player is dismissed.
       isPlaying      — pure transport state. Toggling it never touches
                        the source, currentTime, or the track identity. */
  const [currentTrackId, setCurrentTrackId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState("0:00");

  /* ---------------------- SMOOTH PROGRESS PIPELINE ----------------------
     The visual fill lives in a MotionValue (0–1), NOT React state. It is
     written on every timeupdate and painted straight to the DOM, so the
     bar moves at 60fps while AppShell re-renders at most ONCE PER SECOND
     (only when the displayed mm:ss actually changes). That single change
     is what removes the playback lag.

     scrubbingRef suppresses timeupdate writes mid-drag — without it the
     audio element's own position would fight the thumb you're dragging
     and the bar would visibly stutter backwards. */
  const progressMV = useMotionValue(0);
  const scrubbingRef = useRef(false);
  const lastSecondRef = useRef(-1);

  const [isLoading, setIsLoading] = useState(true);
  const [showPreloader, setShowPreloader] = useState(true);

  const audioRef = useRef(null);
  const loadedIdRef = useRef(null);

  useEffect(() => {
    const minDelay = new Promise((resolve) => setTimeout(resolve, 900));
    const pageReady =
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));

    Promise.all([minDelay, pageReady]).then(() => {
      setIsLoading(false);
      setTimeout(() => setShowPreloader(false), 750);
    });
  }, []);

  const formatTime = (secs) => {
    if (isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const togglePlay = useCallback((releaseId) => {
    const target = RELEASES.find((r) => r.id === releaseId);
    if (!target) return;
    const audio = audioRef.current;
    if (!audio) return;

    /* --- Same track: pure transport. Never touches src/currentTime. --- */
    if (currentTrackId === releaseId) {
      if (isPlaying) {
        audio.pause();          /* position is retained by the element */
        setIsPlaying(false);
        return;
      }
      audio.play()              /* resumes from audio.currentTime as-is */
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
      return;
    }

    /* --- Genuinely different song: this is the ONLY place the source
           is ever assigned. Reset the readout so the previous track's
           timestamp doesn't linger for a frame before the new one loads. --- */
    if (loadedIdRef.current !== releaseId) {
      audio.src = target.audioSrc;
      loadedIdRef.current = releaseId;
      progressMV.set(0);
      lastSecondRef.current = -1;
      setCurrentTimeStr("0:00");
    }
    setCurrentTrackId(releaseId);
    audio.play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, [currentTrackId, isPlaying]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    /* Mid-drag the user owns the playhead; ignore the element's reports. */
    if (scrubbingRef.current) return;

    const current = audio.currentTime;
    const duration = audio.duration || 1;

    /* 60fps visual, zero renders. */
    progressMV.set(Math.max(0, Math.min(1, current / duration)));

    /* One render per displayed second, instead of one per timeupdate. */
    const sec = Math.floor(current);
    if (sec !== lastSecondRef.current) {
      lastSecondRef.current = sec;
      setCurrentTimeStr(formatTime(current));
    }

    /* Keep the OS scrubber (lock screen / macOS Now Playing) in sync.
       setPositionState throws if duration is Infinity or NaN — which is
       exactly what a still-loading stream reports — so it's guarded. */
    if ("mediaSession" in navigator && navigator.mediaSession.setPositionState) {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: Math.min(current, audio.duration),
          });
        } catch { /* browser rejected the state — harmless, skip this tick */ }
      }
    }
  };

  const handleAudioEnded = () => {
    /* Finishing a track is not the same as closing it. The song stays
       loaded and the player stays on screen, rewound to the top and ready
       to replay — loadedIdRef deliberately keeps its value so pressing
       play again does NOT re-assign src and re-download the file. */
    setIsPlaying(false);
    progressMV.set(0);
    lastSecondRef.current = -1;
    setCurrentTimeStr("0:00");
    const audio = audioRef.current;
    if (audio) audio.currentTime = 0;
  };

  /* Phase-aware seek.
       start/move → paint the preview and hold timeupdate off. We do NOT
                    assign currentTime on every move: doing so triggers a
                    seek + buffer flush per frame, which is exactly what
                    made scrubbing stutter and the audio crackle.
       end        → commit the position once, then hand control back. */
  const handleScrub = useCallback((fraction, phase = "end") => {
    const audio = audioRef.current;
    const clamped = Math.max(0, Math.min(1, fraction));
    progressMV.set(clamped);

    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const newTime = clamped * audio.duration;

    if (phase === "start" || phase === "move") {
      scrubbingRef.current = true;
      const sec = Math.floor(newTime);
      if (sec !== lastSecondRef.current) {
        lastSecondRef.current = sec;
        setCurrentTimeStr(formatTime(newTime));   /* live readout while dragging */
      }
      return;
    }

    audio.currentTime = newTime;
    lastSecondRef.current = Math.floor(newTime);
    setCurrentTimeStr(formatTime(newTime));
    scrubbingRef.current = false;
  }, [progressMV]);

  const openRelease = useCallback((release) => {
    setSelectedRelease(release);
  }, []);

  /* The one place a teardown is correct: the user explicitly closed the
     player with the X. Everything else (pause, page change, modal, theme
     switch) leaves the audio element and its position untouched. */
  const dismissPlayer = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    loadedIdRef.current = null;
    setCurrentTrackId(null);
    setIsPlaying(false);
    progressMV.set(0);
    lastSecondRef.current = -1;
    setCurrentTimeStr("0:00");
  }, [progressMV]);

  const backToTrackListing = useCallback(() => {
    setSelectedRelease(null);
    setView("releases");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  /* Derived from currentTrackId (not isPlaying), so the mini player, its
     artwork, title, artist and duration all stay put while paused. */
  const playingRelease = RELEASES.find(r => r.id === currentTrackId);

  /* ---------------------- Media Session integration ----------------------
     Publishes the current track to the OS: lock screen, notification
     shade, macOS Now Playing, smartwatches, and car head units — plus
     wires up hardware media keys / headphone buttons. Chromium + Safari
     support this; the whole block no-ops elsewhere. Artwork is served at
     several sizes because each surface picks its own. */
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

    if (!playingRelease) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      return;
    }

    const artwork = playingRelease.coverImg
      ? ["96x96", "192x192", "256x256", "384x384", "512x512"].map((sizes) => ({
          src: playingRelease.coverImg,
          sizes,
          type: "image/jpeg",
        }))
      : [];

    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: playingRelease.title,
      artist: playingRelease.artist,
      album: "Wildwood Records",
      artwork,
    });
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [playingRelease, isPlaying]);

  /* Hardware transport controls. Registered once and kept in sync via the
     ref-free callbacks below; seek handlers move the same <audio> element
     the on-page player uses, so both stay perfectly in agreement. */
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

    const handlers = [
      /* Hardware transport mirrors the on-screen buttons exactly: resume
         from the existing position, pause without unloading anything. */
      ["play", () => { const a = audioRef.current; if (a && loadedIdRef.current) a.play().then(() => setIsPlaying(true)).catch(() => {}); }],
      ["pause", () => { const a = audioRef.current; if (a) { a.pause(); setIsPlaying(false); } }],
      ["stop", () => { const a = audioRef.current; if (a) { a.pause(); a.currentTime = 0; setIsPlaying(false); } }],
      ["seekbackward", (d) => { const a = audioRef.current; if (a) a.currentTime = Math.max(0, a.currentTime - (d.seekOffset || 10)); }],
      ["seekforward", (d) => { const a = audioRef.current; if (a) a.currentTime = Math.min(a.duration || 0, a.currentTime + (d.seekOffset || 10)); }],
      ["seekto", (d) => { const a = audioRef.current; if (a && d.seekTime != null) a.currentTime = d.seekTime; }],
    ];

    handlers.forEach(([action, fn]) => {
      try { navigator.mediaSession.setActionHandler(action, fn); }
      catch { /* action unsupported in this browser — skip it */ }
    });

    return () => {
      handlers.forEach(([action]) => {
        try { navigator.mediaSession.setActionHandler(action, null); } catch { /* noop */ }
      });
    };
  }, []);

  return (
    <ClickBurstProvider>
      <div className={`relative min-h-screen font-sans overflow-x-hidden ${isDark ? "bg-[#050505] text-white selection:bg-white selection:text-black" : "bg-[#fafafa] text-neutral-900 selection:bg-neutral-900 selection:text-white"}`}>
        <GoogleFontsLoader />
<ScrollProgressBar />
<VinylCursor isPlaying={isPlaying} />
        {/* preload="metadata" grabs just the header (duration, seek table)
            rather than buffering audio nobody asked for — tracks start
            near-instantly on press without competing with first paint. */}
        <audio
          ref={audioRef}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleAudioEnded}
        />

        <GlobalPolishStyles />
        <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
      <CraftStyles />
      <SubmissionStyles />

        {showPreloader && <Preloader visible={isLoading} />}

        <AmbientNotes />
        <FloatingBackground isPlaying={isPlaying} />
        <Nav view={view} setView={setView} />

        {/* mode="wait" holds the incoming page until the outgoing one has
            fully left — the difference between a considered scene change
            and two pages briefly wrestling. */}
<AnimatePresence mode="wait" initial={false}>
        <PageWrapper key={view}>
          {view === "home" && (
            <Home setView={setView} openRelease={openRelease} playing={currentTrackId} isPlaying={isPlaying} togglePlay={togglePlay} />
          )}
          {view === "releases" && (
            <Releases openRelease={openRelease} playing={currentTrackId} isPlaying={isPlaying} togglePlay={togglePlay} />
          )}
          {view === "artists" && <Artists />}
          {view === "about" && <About />}
          {view === "events" && <Events />}
          {view === "services" && <Services setView={setView} />}
          {view === "donateus" && <DonateUs />}
          {view === "admin" && <AdminDashboard />}
          {view === "contact" && <Contact />}
          {view === "privacy" && <PrivacyPolicy />}
          {view === "terms" && <TermsAndConditions />}
        </PageWrapper>
        </AnimatePresence>

        <Footer setView={setView} />

        <ReleaseModal
          release={selectedRelease}
          onClose={() => setSelectedRelease(null)}
          playing={currentTrackId}
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          progressMV={progressMV}
          currentTime={currentTimeStr}
          onScrub={handleScrub}
        />

        {!selectedRelease && (
          <GlobalPlayer 
            playingRelease={playingRelease}
            isPlaying={isPlaying}
            togglePlay={togglePlay}
            progressMV={progressMV}
            currentTime={currentTimeStr}
            onScrub={handleScrub}
            onOpen={openRelease}
            onDismiss={dismissPlayer}
            onBackToList={backToTrackListing}
          />
        )}
      </div>
    </ClickBurstProvider>
  );
}

/* ------------------------------------------------------------------ */
/* PRIVACY POLICY PAGE                                                */
/* ------------------------------------------------------------------ */

const PrivacyPolicy = memo(function PrivacyPolicy() {
  const { isDark } = useTheme();

  const sections = [
    {
      title: "1. Information Collection",
      content: "To provide you with a bespoke and seamless experience, we may require you to provide us with certain personally identifiable information. This includes, but is not limited to: Contact Information (full name, email address, phone number) and Artist Data (demos, portfolio data). The information that we collect is used to contact you, identify you, process your requests, and facilitate our music distribution operations."
    },
    {
      title: "2. Log Data & Analytics",
      content: "Whenever you visit our Service, we collect information that your browser sends to us, known as Log Data. This is crucial for maintaining technical integrity and may include your computer’s Internet Protocol (IP) address, browser type and version, specific pages you visit, time and date of your visit, and other diagnostic statistics."
    },
    {
      title: "3. Cookies & Tracking",
      content: "Cookies are files containing a small amount of data, commonly used as an anonymous unique identifier. Wildwood Records uses these to collect information, remember your preferences, and improve our Service. You have the option to accept or refuse these cookies. Refusing cookies may prevent you from using certain portions of our Service, such as seamless audio streaming."
    },
    {
      title: "4. Service Providers",
      content: "As a globally operating record label, we may employ third-party companies and individuals—under the strict oversight of LDM Associates—to facilitate our Service, provide Service-related functions (like Spotify/Apple Music distribution), or assist in analytics. These trusted parties have strictly limited access to your Personal Information and are legally obligated not to disclose or use it for any other purpose."
    },
    {
      title: "5. Security Measures",
      content: "We deeply value the trust you place in Wildwood Records and LDM Associates. We strive to use commercially acceptable, premium security protocols to protect your Personal Information. However, no method of transmission over the internet, or method of electronic storage, is 100% secure. While we implement rigorous safeguards, we cannot guarantee absolute security."
    },
    {
      title: "6. External Links",
      content: "Our Service may contain links to external sites, including social media platforms and digital streaming partners. These external sites are not operated by us. We strongly advise you to review the Privacy Policy of these websites independently. We assume no responsibility for the content or privacy practices of any third-party sites."
    },
    {
      title: "7. Children’s Privacy",
      content: "Our Services are not directed to anyone under the age of 13. We do not knowingly collect personally identifiable information from children under 13. If we discover that a child under 13 has provided us with personal information, we immediately and permanently delete this data from our servers."
    },
  ];

  return (
    <div className="pt-32 md:pt-44 pb-24 px-5 md:px-8 lg:px-10 relative z-10">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Section */}
        <Reveal>
          <Eyebrow>Legal & Compliance</Eyebrow>
          <h1 className={`font-display text-page-title mb-6 ${isDark ? "text-white" : "text-neutral-900"}`}>
            Privacy Policy
          </h1>
          <p className={`text-sm md:text-lg max-w-3xl leading-[1.8] ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
            Welcome to <strong className={isDark ? "text-white" : "text-black"}>Wildwood Records</strong>. 
            A premier independent music label, wholly operated, managed, and digitally powered under the parent banner of <strong className={isDark ? "text-white" : "text-black"}>LDM Associates</strong>.
          </p>
          <p className={`text-sm md:text-base max-w-3xl leading-[1.8] mt-6 ${isDark ? "text-neutral-500" : "text-neutral-500"}`}>
            By choosing to use our Service, you explicitly agree to the collection and use of information in accordance with this policy. We will not use or share your information with anyone except as deliberately described below.
          </p>
        </Reveal>

        <div className={`h-px my-14 md:my-20 bg-gradient-to-r to-transparent ${isDark ? "from-white/20 via-white/5" : "from-black/20 via-black/5"}`} aria-hidden="true" />

        {/* Editorial Layout for Sections */}
        <div className="space-y-16 md:space-y-24">
          {sections.map((sec, i) => (
            <Reveal key={i} delay={40}>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4 md:gap-10 items-start">
                <h2 className={`font-display text-2xl md:text-3xl leading-tight md:sticky md:top-28 ${isDark ? "text-white" : "text-neutral-900"}`}>
                  {sec.title}
                </h2>
                <div className={`text-sm md:text-base leading-[1.85] rounded-3xl p-6 md:p-8 border ${isDark ? "bg-white/[0.02] border-white/10 text-neutral-300 shadow-inner" : "bg-black/[0.02] border-black/10 text-neutral-700 shadow-inner"}`}>
                  {sec.content}
                </div>
              </div>
            </Reveal>
          ))}

          {/* Contact Section */}
          {/* Contact Section */}
          <Reveal>
             <div className={`rounded-3xl p-8 md:p-12 border text-center ${isDark ? "bg-neutral-900/50 border-white/10" : "bg-white border-neutral-200 shadow-xl"}`}>
                <ShieldCheck size={32} className={`mx-auto mb-6 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                <h2 className={`font-display text-2xl md:text-3xl mb-4 ${isDark ? "text-white" : "text-neutral-900"}`}>
                  Changes & Contact
                </h2>
                <p className={`text-sm md:text-base leading-relaxed max-w-2xl mx-auto mb-8 ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
                  LDM Associates reserves the right to update or modify our Privacy Policy from time to time. If you have any questions regarding how your data is handled, please reach out to us.
                </p>
                
                {/* UPDATED BUTTONS */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <GhostButton href="mailto:contactwwrecords@gmail.com">
                    <Mail size={16} /> contactwwrecords@gmail.com
                  </GhostButton>
                  
                  {/* Replace the href below with the actual LDM Associates Instagram link */}
                  <PrimaryButton href="https://www.instagram.com/ldmassociates?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" icon={Instagram}>
                    LDM Associates
                  </PrimaryButton>
                </div>

             </div>
          </Reveal>
        </div>

      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* TERMS & CONDITIONS PAGE                                            */
/* ------------------------------------------------------------------ */

const TermsAndConditions = memo(function TermsAndConditions() {
  const { isDark } = useTheme();

  const sections = [
    {
      title: "1. Cookies",
      content: "We employ the use of cookies to enhance user experience. By accessing Wildwood Records, you agree to use cookies in agreement with our Privacy Policy. Cookies are used by our website to enable the functionality of certain areas to make it easier for people visiting our website."
    },
    {
      title: "2. Intellectual Property",
      content: "Unless otherwise explicitly stated, LDM Associates and/or its licensors own the intellectual property rights for all material on Wildwood Records, including audio recordings, master tracks, cover art, video content, and branding. You must strictly not republish, sell, rent, sub-license, reproduce, pirate, or redistribute material from Wildwood Records without explicit written permission."
    },
    {
      title: "3. User Submissions",
      content: "Parts of this website may offer an opportunity for users to submit demo materials or post opinions. Wildwood Records does not filter, edit, publish, or review Comments prior to their presence on the website. By submitting content, you warrant that you are entitled to post it, have all necessary licenses and consents, and that the content does not invade any intellectual property rights or contain unlawful material."
    },
    {
      title: "4. Hyperlinking",
      content: "Government agencies, search engines, and news organizations may link to our Website without prior written approval. However, no use of the Wildwood Records logo, LDM Associates logo, or other artwork will be allowed for linking absent a trademark license agreement. Without prior approval and written permission, you may not create frames around our Webpages."
    },
    {
      title: "5. Content Liability",
      content: "We shall not be held responsible for any content that appears on your external Website. You agree to protect and defend us against all claims that rise on your Website. No links should appear on any Website that may be interpreted as libelous, obscene, or criminal, or which infringes any third-party rights."
    },
    {
      title: "6. Disclaimer",
      content: "To the maximum extent permitted by applicable law, we exclude all representations, warranties, and conditions relating to our website and the use of this website. As long as the website and the information and services on the website are provided free of charge, we will not be liable for any loss or damage of any nature."
    }
  ];

  return (
    <div className="pt-32 md:pt-44 pb-24 px-5 md:px-8 lg:px-10 relative z-10">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Section */}
        <Reveal>
          <Eyebrow>Legal & Compliance</Eyebrow>
          <h1 className={`font-display text-page-title mb-6 ${isDark ? "text-white" : "text-neutral-900"}`}>
            Terms & Conditions
          </h1>
          <p className={`text-sm md:text-lg max-w-3xl leading-[1.8] ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
            Welcome to <strong className={isDark ? "text-white" : "text-black"}>Wildwood Records</strong>.
          </p>
          <p className={`text-sm md:text-base max-w-3xl leading-[1.8] mt-6 ${isDark ? "text-neutral-500" : "text-neutral-500"}`}>
            These terms and conditions outline the rules and regulations for the use of the Wildwood Records Website and its associated digital platforms. By accessing this website, we assume you fully accept these terms and conditions.
          </p>
        </Reveal>

        <div className={`h-px my-14 md:my-20 bg-gradient-to-r to-transparent ${isDark ? "from-white/20 via-white/5" : "from-black/20 via-black/5"}`} aria-hidden="true" />

        {/* Editorial Layout for Sections */}
        <div className="space-y-16 md:space-y-24">
          {sections.map((sec, i) => (
            <Reveal key={i} delay={40}>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4 md:gap-10 items-start">
                <h2 className={`font-display text-2xl md:text-3xl leading-tight md:sticky md:top-28 ${isDark ? "text-white" : "text-neutral-900"}`}>
                  {sec.title}
                </h2>
                <div className={`text-sm md:text-base leading-[1.85] rounded-3xl p-6 md:p-8 border ${isDark ? "bg-white/[0.02] border-white/10 text-neutral-300 shadow-inner" : "bg-black/[0.02] border-black/10 text-neutral-700 shadow-inner"}`}>
                  {sec.content}
                </div>
              </div>
            </Reveal>
          ))}

          {/* Contact Section (Reused for consistency) */}
          <Reveal>
             <div className={`rounded-3xl p-8 md:p-12 border text-center ${isDark ? "bg-neutral-900/50 border-white/10" : "bg-white border-neutral-200 shadow-xl"}`}>
                <ShieldCheck size={32} className={`mx-auto mb-6 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                <h2 className={`font-display text-2xl md:text-3xl mb-4 ${isDark ? "text-white" : "text-neutral-900"}`}>
                  Legal Inquiries
                </h2>
                <p className={`text-sm md:text-base leading-relaxed max-w-2xl mx-auto mb-8 ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
                  We reserve the right to amend these terms and conditions at any time. If you have any inquiries regarding licensing, usage, or compliance, please reach out to our team.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <GhostButton href="mailto:contactwwrecords@gmail.com">
                    <Mail size={16} /> contactwwrecords@gmail.com
                  </GhostButton>
                  
                  <PrimaryButton href="https://www.instagram.com/ldmassociates?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" icon={Instagram}>
                    LDM Associates
                  </PrimaryButton>
                </div>
             </div>
          </Reveal>
        </div>

      </div>
    </div>
  );
});

/* Default export: BrowserRouter gives every view a real URL (so
   AppShell's useLocation()/useNavigate() below have something to read
   from), wrapping ThemeProvider so every component (pages, nav, footer,
   modal, player, background layers) can still read/react to the current
   theme via useTheme() exactly as before. */
export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </BrowserRouter>
  );
}