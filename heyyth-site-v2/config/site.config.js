// ============================================================
//  CENTRAL CONFIG  (static-site version — plain script, no build step)
//  Change your name, about text, interests, gallery, socials,
//  colors, etc. all from this one file. Nothing else needs
//  to be touched for basic content edits.
//
//  This file just sets a global `window.SITE_CONFIG` object so it
//  can be loaded with a plain <script> tag from any page, whether
//  you're opening index.html directly or hosting it on GitHub Pages.
// ============================================================

window.SITE_CONFIG = {
  // ---- Backend API (the secure GitHub bridge) ----
  // Point this at wherever you deploy the backend/ folder (Render,
  // Railway, Fly.io, etc). No trailing slash. See backend/README
  // and the main README's "Deploying" section.
  apiBaseUrl: "https://your-backend-host.example.com",

  // ---- Identity ----
  name: "heyyth",
  tagline: "probably up to something",
  pageTitle: "heyyth.",

  // ---- Main wiki page content ----
  about: [
    "hi, i'm heyyth. this is my little corner of the internet.",
    "i build weird things, break other things, and occasionally fix them again.",
    "this site is basically a digital junk drawer that got out of hand."
  ],

  interests: [
    "building stupid little projects at 2am",
    "music (mostly whatever's stuck in my head that day)",
    "overengineering things that didn't need it",
    "collecting hobbies I will not finish"
  ],

  favoriteThings: [
    "cold coffee that used to be hot coffee",
    "dark mode, obviously",
    "the sound a keyboard makes when a project finally works",
    "pink and navy blue, apparently"
  ],

  randomFacts: [
    "this website has more pages than my actual resume.",
    "there is a whole hidden section past the button below. don't say I didn't warn you.",
    "the vault is real, it saves your stuff right in your own browser.",
    "yes the anonymous messages are real too. be nice. or don't."
  ],

  currentlyUpTo: [
    "adding features to a website nobody asked for",
    "pretending my to-do list isn't 40 items long",
    "vibing"
  ],

  // ---- Loading screen messages (kept short + not corny) ----
  loadingMessages: [
    "loading...",
    "doing something important...",
    "probably...",
    "waking up the vault...",
    "almost there...",
    "okay actually almost there..."
  ],

  // ---- Theme colors (dark blue + pink, cute) ----
  colors: {
    bg: "#0c0f1f",
    bgSoft: "#12172c",
    surface: "#161c36",
    surfaceSoft: "#1d2542",
    pink: "#ff8fc4",
    pinkSoft: "#ffb6d9",
    pinkDeep: "#ff5fa8",
    blue: "#7c9bff",
    blueSoft: "#a9bdff",
    text: "#f1f0ff",
    textDim: "#9aa1c4",
    border: "rgba(255, 143, 196, 0.18)"
  },

  // ---- Gallery ----
  // Drop image files into /gallery/images/ and add an entry here.
  // That's it — nothing else to touch.
  gallery: [
    {
      id: "g1",
      file: "placeholder-1.svg",
      caption: "replace me with a real photo 💕",
      date: "2026-01-01",
      category: "misc"
    },
    {
      id: "g2",
      file: "placeholder-2.svg",
      caption: "another placeholder, very artistic",
      date: "2026-02-14",
      category: "misc"
    },
    {
      id: "g3",
      file: "placeholder-3.svg",
      caption: "gallery category example",
      date: "2026-03-03",
      category: "projects"
    }
  ],

  // ---- Sample anonymous messages ----
  // These are seeded into the anon message list the very first time
  // the site is opened in a browser. After that, real submitted
  // messages live in that browser's local storage. See README for
  // how to permanently bake in messages you write yourself.
  sampleAnonMessages: [
    {
      username: "Anonymous",
      message: "bro what is this website",
      timestamp: "2026-01-01 12:00:00"
    },
    {
      username: "Anonymous",
      message: "why am I still clicking things",
      timestamp: "2026-01-02 18:30:00"
    }
  ],

  // ---- Socials (Socials page, lives inside Projects area) ----
  socials: [
    { platform: "Instagram", username: "Hethan_akhilesh", icon: "instagram", url: "https://instagram.com/Hethan_akhilesh" },
    { platform: "Instagram (alt)", username: "He_xot", icon: "instagram", url: "https://instagram.com/He_xot" },
    { platform: "Snapchat", username: "Heyythxd", icon: "snapchat", url: "https://www.snapchat.com/add/Heyythxd" },
    { platform: "Discord", username: "Rexstepz", icon: "discord", url: "" },
    { platform: "X", username: "Rexstepz", icon: "x", url: "https://x.com/Rexstepz" }
  ],

  // ---- Other Projects (hub cards) ----
  projects: [
    { id: "cyne", name: "CYNE", tagline: "an experimental security-flavored UI", color: "#00ffb2" },
    { id: "sonicflow", name: "SONICFLOW", tagline: "a little music player that got out of hand", color: "#ff5fa8" },
    { id: "buildcore", name: "BUILDCORE", tagline: "a fake build dashboard for fake builds", color: "#7c9bff" },
    { id: "archive", name: "ARCHIVE", tagline: "a database of things that may or may not matter", color: "#ffd166" },
    { id: "experimental", name: "EXPERIMENTAL", tagline: "small broken toys that mostly work", color: "#c792ff" },
    { id: "socials", name: "SOCIALS", tagline: "the normal part, I promise", color: "#ff8fc4" }
  ]
};
