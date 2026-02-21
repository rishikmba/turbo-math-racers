import { useState, useEffect, useRef } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const TIERS = [
  { id: 1, name: "GEAR 1", tables: [2, 5, 10], color: "#00e676", label: "\u00d72, \u00d75, \u00d710", unlockCoins: 0   },
  { id: 2, name: "GEAR 2", tables: [3, 4],     color: "#ffdd00", label: "\u00d73, \u00d74",       unlockCoins: 20  },
  { id: 3, name: "GEAR 3", tables: [6, 9],     color: "#ff9100", label: "\u00d76, \u00d79",       unlockCoins: 50  },
  { id: 4, name: "GEAR 4", tables: [7, 8],     color: "#ff3d00", label: "\u00d77, \u00d78",       unlockCoins: 90  },
  { id: 5, name: "GEAR 5", tables: [11, 12],   color: "#d500f9", label: "\u00d711, \u00d712",     unlockCoins: 140 },
];

const CARS = [
  { id: 1, name: "Starter Sedan",   color: "#cc2200", stripe: "#ff6644", unlockCoins: 0,   shape: "sedan"   },
  { id: 2, name: "Street Racer",    color: "#1155cc", stripe: "#55aaff", unlockCoins: 30,  shape: "hatch"   },
  { id: 3, name: "Speed Demon",     color: "#116622", stripe: "#44ee88", unlockCoins: 75,  shape: "sports"  },
  { id: 4, name: "Monster Crusher", color: "#aa6600", stripe: "#ffee22", unlockCoins: 130, shape: "monster" },
  { id: 5, name: "Turbo Beast",     color: "#660088", stripe: "#dd66ff", unlockCoins: 200, shape: "super"   },
];

const QUESTIONS_PER_RACE = 12;
const MASTERY_THRESHOLD = 4;

// ─── LEVEL SYSTEM ────────────────────────────────────────────────────────────

const LEVELS = [
  { id: 1, name: "Rookie",   champFinishTime: 120, winsToUnlock: 0, color: "#66bb6a" },
  { id: 2, name: "Street",   champFinishTime: 85,  winsToUnlock: 3, color: "#ffdd00" },
  { id: 3, name: "Circuit",  champFinishTime: 65,  winsToUnlock: 3, color: "#ff9100" },
  { id: 4, name: "Pro",      champFinishTime: 50,  winsToUnlock: 3, color: "#ff3d00" },
  { id: 5, name: "Champion", champFinishTime: 38,  winsToUnlock: 3, color: "#d500f9" },
];

const CHAMP_CARS = {
  1: { name: "Ol' Rusty",       color: "#8a7a6a", stripe: "#aa9966", shape: "beater"  },
  2: { name: "Thunderbolt",     color: "#2a2a2a", stripe: "#cc0000", shape: "muscle"  },
  3: { name: "Blue Lightning",  color: "#003388", stripe: "#ffdd00", shape: "racecar" },
  4: { name: "Formula One",     color: "#cc0000", stripe: "#ffffff", shape: "f1"      },
  5: { name: "Quantum",         color: "#1a0033", stripe: "#00ffcc", shape: "future"  },
};

function getChampCar(levelId) {
  return CHAMP_CARS[levelId] || CHAMP_CARS[1];
}

// ─── SPEED ENGINE CONSTANTS ──────────────────────────────────────────────────

const SPEED_DECAY_RATE = 1 / 1.5;
const SPEED_MIN = 1;
const SPEED_MAX = 10;

const BOOST_FAST_THRESHOLD = 1.5;
const BOOST_MEDIUM_THRESHOLD = 3.0;
const BOOST_SLOW_THRESHOLD = 5.0;

const BOOST_FAST = 3.0;
const BOOST_MEDIUM = 2.0;
const BOOST_SLOW = 1.0;
const BOOST_VERY_SLOW = 0.3;

const WRONG_ANSWER_PENALTY = 2.5;

const CHAMP_BURST_INTERVAL_MIN = 2;
const CHAMP_BURST_INTERVAL_MAX = 4;
const CHAMP_BURST_MULTIPLIER_MIN = 1.10;
const CHAMP_BURST_MULTIPLIER_MAX = 1.15;
const CHAMP_BURST_DURATION = 1500;

// ─── SOUND ENGINE (Web Audio API) ───────────────────────────────────────────

const SFX = {
  ctx: null,
  muted: false,
  musicNodes: null,

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { /* audio not supported */ }
  },

  _tone(freq, duration, type = 'sine', vol = 0.3, startDelay = 0) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime + startDelay);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + startDelay + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(this.ctx.currentTime + startDelay);
    osc.stop(this.ctx.currentTime + startDelay + duration + 0.05);
  },

  _noise(duration, vol = 0.15) {
    if (!this.ctx || this.muted) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * vol;
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    src.buffer = buffer;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    src.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
  },

  play(name) {
    if (!this.ctx || this.muted) return;
    try { this.ctx.resume(); } catch {}
    switch (name) {
      case 'correct':
        this._tone(523, 0.12, 'sine', 0.25);        // C5
        this._tone(659, 0.15, 'sine', 0.25, 0.08);   // E5
        this._tone(784, 0.2, 'sine', 0.2, 0.16);     // G5
        break;
      case 'wrong':
        this._tone(200, 0.25, 'sawtooth', 0.15);
        this._tone(150, 0.3, 'sawtooth', 0.12, 0.1);
        break;
      case 'coin':
        this._tone(1200, 0.08, 'sine', 0.2);
        this._tone(1600, 0.12, 'sine', 0.18, 0.06);
        break;
      case 'streak':
        this._tone(784, 0.08, 'sine', 0.2);           // G5
        this._tone(988, 0.08, 'sine', 0.2, 0.06);     // B5
        this._tone(1175, 0.08, 'sine', 0.2, 0.12);    // D6
        this._tone(1568, 0.15, 'sine', 0.25, 0.18);   // G6
        break;
      case 'raceStart':
        this._tone(440, 0.15, 'square', 0.12);
        this._tone(554, 0.15, 'square', 0.12, 0.2);
        this._tone(659, 0.25, 'square', 0.15, 0.4);
        break;
      case 'win':
        this._tone(523, 0.15, 'sine', 0.25);
        this._tone(659, 0.15, 'sine', 0.25, 0.12);
        this._tone(784, 0.15, 'sine', 0.25, 0.24);
        this._tone(1047, 0.35, 'sine', 0.3, 0.36);
        // Add harmony
        this._tone(659, 0.3, 'sine', 0.15, 0.36);
        this._tone(784, 0.3, 'sine', 0.15, 0.36);
        break;
      case 'lose':
        this._tone(392, 0.2, 'sine', 0.2);
        this._tone(349, 0.2, 'sine', 0.18, 0.15);
        this._tone(330, 0.3, 'sine', 0.15, 0.3);
        this._tone(294, 0.4, 'sine', 0.12, 0.45);
        break;
      case 'pause':
        this._tone(500, 0.15, 'sine', 0.12);
        this._tone(350, 0.2, 'sine', 0.1, 0.08);
        break;
      case 'resume':
        this._tone(350, 0.15, 'sine', 0.12);
        this._tone(500, 0.2, 'sine', 0.15, 0.08);
        break;
      case 'levelUp':
        [523, 587, 659, 784, 880, 988, 1047, 1319].forEach((f, i) => {
          this._tone(f, 0.12, 'sine', 0.2 - i * 0.015, i * 0.08);
        });
        break;
      case 'rev':
        this._tone(80, 0.15, 'sawtooth', 0.1);
        this._tone(120, 0.2, 'sawtooth', 0.12, 0.05);
        this._tone(200, 0.15, 'sawtooth', 0.08, 0.15);
        this._noise(0.25, 0.06);
        break;
      case 'tap':
        this._noise(0.03, 0.08);
        break;
    }
  },

  startMusic() {
    if (!this.ctx || this.muted || this.musicNodes) return;
    try { this.ctx.resume(); } catch {}
    const masterGain = this.ctx.createGain();
    masterGain.gain.value = 0.06;
    masterGain.connect(this.ctx.destination);

    // Bass line: simple looping pattern
    const bassNotes = [65, 82, 73, 87]; // C2, E2, D2, F2 area
    let running = true;
    const oscs = [];

    const playBassLoop = () => {
      if (!running || !this.ctx) return;
      const now = this.ctx.currentTime;
      bassNotes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.5, now + i * 0.5);
        g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.5 + 0.45);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now + i * 0.5);
        osc.stop(now + i * 0.5 + 0.5);
        oscs.push(osc);
      });
      // Light hi-hat rhythm
      for (let i = 0; i < 8; i++) {
        const bufLen = Math.floor(this.ctx.sampleRate * 0.03);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let j = 0; j < bufLen; j++) d[j] = (Math.random() * 2 - 1);
        const src = this.ctx.createBufferSource();
        const g = this.ctx.createGain();
        src.buffer = buf;
        g.gain.setValueAtTime(i % 2 === 0 ? 0.3 : 0.15, now + i * 0.25);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.25 + 0.05);
        src.connect(g);
        g.connect(masterGain);
        src.start(now + i * 0.25);
      }
    };

    playBassLoop();
    const interval = setInterval(() => {
      if (!running) { clearInterval(interval); return; }
      playBassLoop();
    }, 2000);

    this.musicNodes = { masterGain, interval, stop() { running = false; clearInterval(interval); } };
  },

  stopMusic() {
    if (!this.musicNodes) return;
    this.musicNodes.stop();
    if (this.musicNodes.masterGain && this.ctx) {
      try {
        this.musicNodes.masterGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
      } catch {}
    }
    this.musicNodes = null;
  },

  setMuted(m) {
    this.muted = m;
    if (m) this.stopMusic();
  }
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function loadFromStorage(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function getFactKey(a, b) { return `${Math.min(a,b)}x${Math.max(a,b)}`; }
function getFactBucket(factData, a, b) { return factData[getFactKey(a, b)]?.bucket ?? 0; }

function generateWrongAnswers(correct, a, b) {
  const wrongs = new Set();
  const candidates = [
    correct+1, correct-1, correct+2, correct-2, correct+3, correct-3,
    correct+a, correct-a, correct+b, correct-b,
    a*(b+1), a*(b-1), (a+1)*b, (a-1)*b,
    correct+5, correct-5, correct+10, correct-10,
  ];
  for (const c of candidates) {
    if (c > 0 && c !== correct && !wrongs.has(c)) wrongs.add(c);
    if (wrongs.size >= 5) break;
  }
  let fill = 1;
  while (wrongs.size < 3) { if (fill !== correct) wrongs.add(fill); fill++; }
  return Array.from(wrongs).slice(0, 3);
}

function buildQuestionPool(factData, unlockedTiers) {
  const allTables = TIERS.filter(t => unlockedTiers.includes(t.id)).flatMap(t => t.tables);
  const tables = [...new Set([1, ...allTables])];
  const pool = [];
  for (const t of tables) {
    for (let n = 1; n <= 12; n++) {
      const bucket = getFactBucket(factData, t, n);
      const weight = Math.max(1, 6 - bucket);
      for (let i = 0; i < weight; i++) pool.push({ a: t, b: n });
    }
  }
  return pool;
}

function selectQuestions(factData, unlockedTiers) {
  const pool = buildQuestionPool(factData, unlockedTiers);
  const selected = [];
  let lastKey = null;
  for (let i = 0; i < QUESTIONS_PER_RACE; i++) {
    const filtered = pool.filter(q => getFactKey(q.a, q.b) !== lastKey);
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    selected.push(pick);
    lastKey = getFactKey(pick.a, pick.b);
  }
  return selected;
}

function getUnlockedTiers(coins) { return TIERS.filter(t => coins >= t.unlockCoins).map(t => t.id); }
function getUnlockedCars(coins) { return CARS.filter(c => coins >= c.unlockCoins).map(c => c.id); }

function getUnlockedLevels(levelData) {
  const unlocked = [1];
  for (let i = 1; i < LEVELS.length; i++) {
    const prevId = LEVELS[i - 1].id;
    const winsAtPrev = levelData.wins[String(prevId)] || 0;
    if (winsAtPrev >= LEVELS[i].winsToUnlock) {
      unlocked.push(LEVELS[i].id);
    } else {
      break;
    }
  }
  return unlocked;
}

// ─── CAR SHAPES ──────────────────────────────────────────────────────────────

function stdWheels() {
  return <>
    <circle cx="32" cy="57" r="9" fill="#111"/><circle cx="32" cy="57" r="6" fill="#333"/><circle cx="32" cy="57" r="2.5" fill="#666"/>
    <circle cx="88" cy="57" r="9" fill="#111"/><circle cx="88" cy="57" r="6" fill="#333"/><circle cx="88" cy="57" r="2.5" fill="#666"/>
  </>;
}

const CAR_SHAPES = {
  // ── PLAYER CARS ──────────────────────────────────────────────

  // Car 1: Basic sedan — boxy, tall roofline, very plain
  sedan: (color, stripe) => <>
    <path d="M12 44 Q14 32 28 28 L40 24 L44 14 Q54 10 66 14 L70 24 L92 28 Q106 32 108 44 L108 52 Q108 58 102 58 L18 58 Q12 58 12 52 Z" fill={color}/>
    <path d="M44 24 L46 14 Q54 10.5 64 14 L66 24 Z" fill={stripe}/>
    <path d="M46 24 L47 16 Q54 12 63 16 L64 24 Z" fill="#aaddff" opacity="0.7"/>
    <rect x="20" y="36" width="80" height="2" rx="1" fill={stripe} opacity="0.3"/>
    {stdWheels()}
    <ellipse cx="106" cy="40" rx="3" ry="2.5" fill="#ffff99" opacity="0.85"/>
    <rect x="9" y="42" width="6" height="4" rx="1.5" fill="#ff3333" opacity="0.7"/>
    <rect x="9" y="47" width="5" height="3" rx="1.5" fill="#333"/>
  </>,

  // Car 2: Sporty hatchback — lower, sloped rear, small spoiler
  hatch: (color, stripe) => <>
    <path d="M10 44 Q12 30 28 26 L46 20 Q56 16 70 20 L88 24 Q106 28 110 44 L110 52 Q110 58 104 58 L16 58 Q10 58 10 52 Z" fill={color}/>
    <path d="M46 20 L50 10 Q58 7 68 10 L72 20 Z" fill={stripe}/>
    <path d="M49 20 L52 12 Q58 9 66 12 L69 20 Z" fill="#aaddff" opacity="0.7"/>
    <path d="M82 24 L82 20 L90 22 Z" fill={stripe} opacity="0.6"/>
    <path d="M18 40 L30 36 L36 40 Z" fill={stripe} opacity="0.25"/>
    {stdWheels()}
    <ellipse cx="108" cy="40" rx="4" ry="3" fill="#ffff99" opacity="0.9"/>
    <ellipse cx="108" cy="45" rx="3" ry="2" fill="#ffff99" opacity="0.6"/>
    <rect x="7" y="45" width="7" height="3.5" rx="1.5" fill="#ff3333" opacity="0.7"/>
  </>,

  // Car 3: Sports car — very low, sleek curves, rear engine hump
  sports: (color, stripe) => <>
    <path d="M8 46 Q10 34 24 28 L44 20 Q54 14 72 18 L94 24 Q112 30 112 44 L112 52 Q112 58 106 58 L14 58 Q8 58 8 52 Z" fill={color}/>
    <path d="M44 20 L48 12 Q56 8 70 12 L76 20 Z" fill={stripe}/>
    <path d="M47 20 L50 14 Q56 10.5 68 14 L73 20 Z" fill="#aaddff" opacity="0.7"/>
    <path d="M78 18 Q88 15 96 22 L90 24 Z" fill={color} stroke={stripe} strokeWidth="1" opacity="0.5"/>
    <path d="M14 42 L36 36 L36 42 Z" fill={stripe} opacity="0.2"/>
    {stdWheels()}
    <ellipse cx="110" cy="40" rx="4" ry="2.5" fill="#ffff99" opacity="0.9"/>
    <ellipse cx="110" cy="44" rx="3" ry="2" fill="#ffff99" opacity="0.6"/>
    <rect x="5" y="46" width="7" height="3" rx="1.5" fill="#ff3333" opacity="0.7"/>
  </>,

  // Car 4: Monster truck — lifted body, huge wheels, roll cage
  monster: (color, stripe) => <>
    <path d="M20 38 L20 28 L32 24 L44 18 Q54 14 66 18 L78 24 L100 28 L100 38 L100 42 L20 42 Z" fill={color}/>
    <path d="M44 18 L48 12 Q54 9 64 12 L68 18 Z" fill={stripe}/>
    <path d="M47 18 L50 14 Q54 11 62 14 L65 18 Z" fill="#aaddff" opacity="0.65"/>
    <rect x="46" y="10" width="2" height="8" rx="1" fill="#666"/>
    <rect x="64" y="10" width="2" height="8" rx="1" fill="#666"/>
    <rect x="44" y="9" width="24" height="2" rx="1" fill="#666"/>
    <rect x="22" y="32" width="76" height="2" rx="1" fill={stripe} opacity="0.4"/>
    <circle cx="32" cy="57" r="12" fill="#111"/><circle cx="32" cy="57" r="9" fill="#333"/><circle cx="32" cy="57" r="4" fill="#666"/>
    <circle cx="88" cy="57" r="12" fill="#111"/><circle cx="88" cy="57" r="9" fill="#333"/><circle cx="88" cy="57" r="4" fill="#666"/>
    <ellipse cx="99" cy="34" rx="3" ry="2" fill="#ffff99" opacity="0.85"/>
    <rect x="17" y="34" width="6" height="3" rx="1.5" fill="#ff3333" opacity="0.7"/>
    <path d="M20 42 L26 48 L20 48 Z" fill="#555" opacity="0.5"/>
    <path d="M100 42 L94 48 L100 48 Z" fill="#555" opacity="0.5"/>
  </>,

  // Car 5: Supercar — ultra-low wedge, big rear wing, side intakes, angular
  super: (color, stripe) => <>
    <path d="M6 46 Q8 36 18 30 L42 22 Q52 14 68 16 L96 22 Q114 28 114 44 L114 52 Q114 58 108 58 L12 58 Q6 58 6 52 Z" fill={color}/>
    <path d="M42 22 L48 13 Q56 9 68 13 L74 22 Z" fill={stripe}/>
    <path d="M45 22 L50 15 Q56 11 66 15 L71 22 Z" fill="#aaddff" opacity="0.7"/>
    <rect x="82" y="10" width="3" height="12" rx="1" fill="#444"/>
    <rect x="95" y="10" width="3" height="12" rx="1" fill="#444"/>
    <path d="M80 10 L100 10 L98 13 L82 13 Z" fill={stripe} opacity="0.8"/>
    <path d="M16 38 L28 32 L28 42 Z" fill="#111" opacity="0.5"/>
    <path d="M20 40 L30 35 L30 42 Z" fill={stripe} opacity="0.3"/>
    {stdWheels()}
    <ellipse cx="112" cy="40" rx="4" ry="2" fill="#ffff99" opacity="0.95"/>
    <ellipse cx="112" cy="43" rx="3" ry="1.5" fill="#ffff99" opacity="0.7"/>
    <rect x="3" y="46" width="7" height="2.5" rx="1" fill="#ff3333" opacity="0.8"/>
    <path d="M6 52 L14 54 L6 54 Z" fill={stripe} opacity="0.3"/>
  </>,

  // ── CHAMP CARS ──────────────────────────────────────────────

  // Champ Lv1: Beat-up junker — dented, rusty, antenna, mismatched panels
  beater: (color, stripe) => <>
    <path d="M14 44 Q16 32 30 28 L42 24 L46 16 Q54 12 64 16 L68 24 L90 28 Q104 32 106 44 L106 52 Q106 58 100 58 L20 58 Q14 58 14 52 Z" fill={color}/>
    <path d="M46 24 L48 16 Q54 12.5 62 16 L64 24 Z" fill={stripe} opacity="0.6"/>
    <path d="M49 24 L50 18 Q54 14.5 60 18 L61 24 Z" fill="#aaddff" opacity="0.5"/>
    <rect x="68" y="8" width="1.5" height="16" rx="0.5" fill="#888"/>
    <circle cx="69" cy="8" r="2" fill="#ff4444" opacity="0.7"/>
    <rect x="72" y="28" width="14" height="10" rx="2" fill={stripe} opacity="0.15"/>
    <path d="M30 36 L38 36 L36 42 L28 42 Z" fill="#5a4a3a" opacity="0.4"/>
    {stdWheels()}
    <ellipse cx="104" cy="40" rx="3" ry="2.5" fill="#ffff99" opacity="0.6"/>
    <ellipse cx="104" cy="45" rx="2.5" ry="2" fill="#ffff99" opacity="0.4"/>
    <rect x="11" y="44" width="6" height="3.5" rx="1.5" fill="#ff3333" opacity="0.5"/>
  </>,

  // Champ Lv2: Muscle car — long hood, short deck, hood scoop, wide
  muscle: (color, stripe) => <>
    <path d="M8 44 Q10 30 22 26 L60 20 Q66 16 74 20 L80 24 Q108 28 112 44 L112 52 Q112 58 106 58 L14 58 Q8 58 8 52 Z" fill={color}/>
    <path d="M60 20 L64 12 Q68 9 76 12 L80 20 Z" fill={stripe}/>
    <path d="M63 20 L66 14 Q68 11 74 14 L77 20 Z" fill="#aaddff" opacity="0.65"/>
    <path d="M34 24 L52 22 L52 28 L34 28 Z" fill={stripe} opacity="0.5"/>
    <path d="M38 22 L48 20 L48 24 L38 24 Z" fill="#222" opacity="0.4"/>
    <rect x="14" y="36" width="92" height="2.5" rx="1" fill={stripe} opacity="0.25"/>
    {stdWheels()}
    <ellipse cx="110" cy="40" rx="4" ry="3" fill="#ffff99" opacity="0.9"/>
    <ellipse cx="110" cy="45" rx="3" ry="2" fill="#ffff99" opacity="0.7"/>
    <rect x="5" y="44" width="7" height="4" rx="2" fill="#ff3333" opacity="0.8"/>
    <path d="M5 48 L12 48 L10 52 L5 52 Z" fill={stripe} opacity="0.3"/>
  </>,

  // Champ Lv3: Race car with body kit — low, big spoiler, side skirts, splitter
  racecar: (color, stripe) => <>
    <path d="M6 46 Q8 32 24 26 L46 18 Q56 13 72 18 L92 24 Q112 30 114 44 L114 52 Q114 58 108 58 L12 58 Q6 58 6 52 Z" fill={color}/>
    <path d="M46 18 L50 10 Q58 6 70 10 L76 18 Z" fill={stripe}/>
    <path d="M49 18 L52 12 Q58 8.5 68 12 L73 18 Z" fill="#aaddff" opacity="0.7"/>
    <rect x="78" y="8" width="3" height="10" rx="1" fill="#444"/>
    <rect x="90" y="8" width="3" height="10" rx="1" fill="#444"/>
    <path d="M76 8 L95 8 L94 11 L77 11 Z" fill={stripe} opacity="0.7"/>
    <path d="M6 50 L18 52 L6 54 Z" fill={stripe} opacity="0.5"/>
    <path d="M12 42 L108 42 L108 44 L12 44 Z" fill={stripe} opacity="0.2"/>
    <circle cx="50" cy="30" r="5" fill="#fff" opacity="0.15"/>
    <text x="50" y="33" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="900" opacity="0.5">1</text>
    {stdWheels()}
    <ellipse cx="112" cy="40" rx="4" ry="2.5" fill="#ffff99" opacity="0.9"/>
    <rect x="3" y="46" width="7" height="3" rx="1.5" fill="#ff3333" opacity="0.8"/>
  </>,

  // Champ Lv4: F1 open-wheel — narrow nose, open cockpit, exposed wheels, rear wing
  f1: (color, stripe) => <>
    <path d="M24 40 L6 38 L6 42 L24 44 Z" fill={color}/>
    <path d="M24 36 L24 48 L72 48 Q80 48 86 42 L86 36 Q80 30 72 30 L40 30 Z" fill={color}/>
    <path d="M62 30 L66 22 Q70 20 74 22 L76 30 Z" fill="#222"/>
    <path d="M64 30 L67 24 Q70 22 73 24 L75 30 Z" fill="#aaddff" opacity="0.5"/>
    <path d="M86 40 L100 42 L100 46 L86 44 Z" fill={color}/>
    <rect x="92" y="18" width="3" height="24" rx="1" fill="#444"/>
    <rect x="102" y="18" width="3" height="24" rx="1" fill="#444"/>
    <path d="M90 18 L107 18 L106 22 L91 22 Z" fill={stripe} opacity="0.8"/>
    <path d="M6 36 L6 44 L10 44 L10 36 Z" fill={stripe} opacity="0.5"/>
    <rect x="30" y="36" width="50" height="2" rx="1" fill={stripe} opacity="0.3"/>
    <circle cx="28" cy="57" r="9" fill="#111"/><circle cx="28" cy="57" r="6" fill="#333"/><circle cx="28" cy="57" r="2.5" fill="#666"/>
    <circle cx="96" cy="57" r="9" fill="#111"/><circle cx="96" cy="57" r="6" fill="#333"/><circle cx="96" cy="57" r="2.5" fill="#666"/>
    <ellipse cx="4" cy="40" rx="3" ry="2" fill="#ffff99" opacity="0.8"/>
  </>,

  // Champ Lv5: Futuristic concept — smooth flowing curves, LED strips, canopy
  future: (color, stripe) => <>
    <path d="M8 46 Q10 34 20 28 L42 20 Q56 12 78 16 L98 22 Q114 30 114 44 L114 52 Q114 58 108 58 L12 58 Q6 58 6 52 Z" fill={color}/>
    <path d="M42 20 L50 12 Q60 8 74 12 L80 20 Z" fill={stripe} opacity="0.3"/>
    <path d="M46 20 L52 14 Q60 10 72 14 L76 20 Z" fill="#aaddff" opacity="0.5"/>
    <path d="M12 44 L108 44 L108 46 L12 46 Z" fill={stripe} opacity="0.6"/>
    <path d="M20 34 L100 30 L100 32 L20 36 Z" fill={stripe} opacity="0.3"/>
    <ellipse cx="60" cy="16" rx="14" ry="4" fill={stripe} opacity="0.08"/>
    {stdWheels()}
    <path d="M108 36 L114 38 L114 44 L108 44 Z" fill={stripe} opacity="0.8"/>
    <path d="M6 44 L12 42 L12 48 L6 48 Z" fill={stripe} opacity="0.8"/>
    <ellipse cx="112" cy="40" rx="3" ry="4" fill={stripe} opacity="0.6"/>
    <rect x="3" y="46" width="7" height="2" rx="1" fill={stripe} opacity="0.6"/>
  </>,
};

// ─── CAR SVG ─────────────────────────────────────────────────────────────────

function CarSVG({ color, stripe, size = 80, animating = false, flip = false, shape = "sedan" }) {
  const renderShape = CAR_SHAPES[shape] || CAR_SHAPES.sedan;
  return (
    <svg width={size} height={size * 0.55} viewBox="0 0 120 66" fill="none"
      style={{
        filter: animating ? `drop-shadow(0 0 10px ${color}) drop-shadow(0 0 20px ${color}88)` : `drop-shadow(2px 2px 6px #00000099)`,
        transition: 'filter 0.3s', transform: flip ? 'scaleX(-1)' : 'none',
      }}>
      {renderShape(color, stripe)}
    </svg>
  );
}

// ─── RACE TRACK ──────────────────────────────────────────────────────────────

function RaceTrack({ progress, speed, carColor, carStripe, carShape, champProgress, champCar, paused }) {
  const [lineOffset, setLineOffset] = useState(0);
  const speedForAnim = paused ? 0 : speed;
  useEffect(() => {
    let raf;
    const animate = () => {
      setLineOffset(prev => (prev + (speedForAnim * 0.3)) % 11);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [speedForAnim]);

  const champVisualSpeed = Math.min(10, (champProgress < 100 ? 4 : 0));

  return (
    <div style={{ position: 'relative', width: '100%', height: 148, overflow: 'hidden', background: '#0a0a1a', borderRadius: 16, border: '2px solid #222' }}>
      {/* Sky */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 48, background: 'linear-gradient(180deg, #050510 0%, #0a0a2a 100%)' }}/>
      {/* Stars */}
      {[15, 40, 70, 90, 110, 200, 280, 340].map((x, i) => (
        <div key={i} style={{ position: 'absolute', top: 4 + (i % 3) * 10, left: x, width: 2, height: 2, borderRadius: '50%', background: '#fff', opacity: 0.5 }}/>
      ))}
      {/* Road */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(180deg, #1a1a1a 0%, #2d2d2d 100%)' }}/>
      {/* Road edge lines */}
      <div style={{ position: 'absolute', bottom: 95, left: 0, right: 0, height: 3, background: '#ffdd0088' }}/>
      <div style={{ position: 'absolute', bottom: 2, left: 0, right: 0, height: 3, background: '#ffdd0088' }}/>
      {/* Dashed center line (between lanes) */}
      <div style={{ position: 'absolute', bottom: 48, left: 0, right: 0, height: 4, overflow: 'hidden' }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${(i * 11 + lineOffset) % 110 - 2}%`,
            width: '7%', height: '100%', background: '#fff', opacity: 0.35, borderRadius: 2,
          }}/>
        ))}
      </div>
      {/* Finish line */}
      <div style={{ position: 'absolute', right: 14, bottom: 0, width: 14, height: 100,
        background: 'repeating-conic-gradient(#fff 0% 25%, #000 0% 50%) 0 0 / 7px 7px', opacity: 0.85 }}/>
      {/* Speed blur lines */}
      {speed > 5 && [10, 30, 44].map((y, i) => (
        <div key={i} style={{
          position: 'absolute', top: y, left: 0, right: 0, height: 1.5,
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) ${progress * 0.8}%, transparent 100%)`,
        }}/>
      ))}
      {/* Champ Car (upper lane) */}
      <div style={{
        position: 'absolute', bottom: 58,
        left: `calc(${Math.min(champProgress, 82)}% - 32px)`,
        transition: 'left 0.5s linear',
      }}>
        <div style={{ textAlign: 'center', marginBottom: -2 }}>
          <span style={{ fontSize: 8, color: champCar.stripe, fontWeight: 900, letterSpacing: 1, textShadow: '0 1px 3px #000' }}>THE CHAMP</span>
        </div>
        <CarSVG color={champCar.color} stripe={champCar.stripe} size={65} animating={champVisualSpeed > 2} shape={champCar.shape}/>
      </div>
      {/* Player Car (lower lane) */}
      <div style={{
        position: 'absolute', bottom: 8,
        left: `calc(${Math.min(progress, 82)}% - 40px)`,
        transition: 'left 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: -2 }}>
          <span style={{ fontSize: 8, color: '#fff', fontWeight: 900, letterSpacing: 1, textShadow: '0 1px 3px #000' }}>YOU</span>
        </div>
        <CarSVG color={carColor} stripe={carStripe} size={80} animating={speed > 5} shape={carShape}/>
        {/* Exhaust puffs */}
        {speed > 6 && (
          <div style={{ position: 'absolute', left: -8, top: '60%', fontSize: 10, opacity: 0.5, animation: 'puff 0.5s infinite' }}>{"\uD83D\uDCA8"}</div>
        )}
      </div>
      <style>{`@keyframes puff { 0%{opacity:0.6;transform:scale(0.8)} 100%{opacity:0;transform:scale(1.5) translateX(-8px)} }`}</style>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────

export default function TurboMathRacers() {
  const [screen, setScreen] = useState("loading");
  const [playerData, setPlayerData] = useState(null);
  const [factData, setFactData] = useState({});
  const [selectedCarId, setSelectedCarId] = useState(1);
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [choices, setChoices] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [raceProgress, setRaceProgress] = useState(0);
  const [speed, setSpeed] = useState(2);
  const [streak, setStreak] = useState(0);
  const [sessionStats, setSessionStats] = useState({ correct: 0, wrong: 0, coins: 0, wrongFacts: [] });
  const [choiceAnim, setChoiceAnim] = useState(null);
  const [localFactData, setLocalFactData] = useState({});
  const timerRef = useRef(null);
  // Use a ref to track running coin total to avoid stale closure bugs
  const runningCoinsRef = useRef(0);

  // Level system
  const [levelData, setLevelData] = useState({ wins: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } });
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [selectedGear, setSelectedGear] = useState(1);

  // Opponent car
  const [champProgress, setChampProgress] = useState(0);
  const [champFinished, setChampFinished] = useState(false);
  const [raceResult, setRaceResult] = useState(null);

  // Pause
  const [paused, setPaused] = useState(false);

  // Sound
  const [muted, setMuted] = useState(() => loadFromStorage("tmr_muted", false));
  function toggleMute() {
    const newMuted = !muted;
    setMuted(newMuted);
    saveToStorage("tmr_muted", newMuted);
    SFX.setMuted(newMuted);
  }
  // Keep SFX in sync with muted state on load
  useEffect(() => { SFX.setMuted(muted); }, []);

  // Real-time speed engine refs
  const speedRef = useRef(2);
  const questionStartTimeRef = useRef(null);
  const decayLoopRef = useRef(null);
  const lastFrameTimeRef = useRef(null);
  const frameCountRef = useRef(0);

  // Opponent car refs
  const champProgressRef = useRef(0);
  const champFinishedRef = useRef(false);
  const champSpeedMultiplierRef = useRef(1);
  const champBurstTimeoutRef = useRef(null);
  const nextBurstAtQuestionRef = useRef(0);
  const selectedLevelRef = useRef(1);

  // Pause refs
  const pausedRef = useRef(false);
  const pauseStartTimeRef = useRef(null);
  const totalPausedTimeRef = useRef(0);
  const feedbackRemainingRef = useRef(null);
  const feedbackStartRef = useRef(null);
  const feedbackDurationRef = useRef(null);

  function loadData() {
    const pd = loadFromStorage("tmr_player", null);
    const fd = loadFromStorage("tmr_facts", {});
    const sc = loadFromStorage("tmr_car", 1);
    const ld = loadFromStorage("tmr_levels", { wins: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } });
    const lc = loadFromStorage("tmr_last_combo", { gear: 1, level: 1 });
    const resolvedPd = pd || { coins: 0, totalRaces: 0, totalCorrect: 0, totalWrong: 0, totalWins: 0, totalLosses: 0 };
    // Backwards-compatible: ensure new fields exist
    if (resolvedPd.totalWins === undefined) resolvedPd.totalWins = 0;
    if (resolvedPd.totalLosses === undefined) resolvedPd.totalLosses = 0;
    setPlayerData(resolvedPd);
    setFactData(fd);
    setLocalFactData(fd);
    setSelectedCarId(sc);
    setLevelData(ld);
    setSelectedGear(lc.gear);
    setSelectedLevel(lc.level);
    setScreen("home");
  }

  function saveData(pd, fd) {
    saveToStorage("tmr_player", pd);
    saveToStorage("tmr_facts", fd);
    saveToStorage("tmr_car", selectedCarId);
  }

  function saveLevelData(ld) {
    saveToStorage("tmr_levels", ld);
  }

  useEffect(() => { loadData(); }, []);

  const unlockedTiers = playerData ? getUnlockedTiers(playerData.coins) : [1];
  const unlockedCars = playerData ? getUnlockedCars(playerData.coins) : [1];
  const activeCar = CARS.find(c => c.id === selectedCarId) || CARS[0];

  function selectCar(id) {
    setSelectedCarId(id);
    saveToStorage("tmr_car", id);
  }

  function buildChoicesFor(q) {
    const correct = q.a * q.b;
    const wrongs = generateWrongAnswers(correct, q.a, q.b);
    const all = [correct, ...wrongs].sort(() => Math.random() - 0.5);
    setChoices(all);
  }

  const unlockedLevels = getUnlockedLevels(levelData);

  function scheduleNextChampBurst(currentQIndex) {
    const gap = CHAMP_BURST_INTERVAL_MIN + Math.floor(Math.random() * (CHAMP_BURST_INTERVAL_MAX - CHAMP_BURST_INTERVAL_MIN + 1));
    nextBurstAtQuestionRef.current = currentQIndex + gap;
  }

  function triggerChampBurst() {
    const mult = CHAMP_BURST_MULTIPLIER_MIN + Math.random() * (CHAMP_BURST_MULTIPLIER_MAX - CHAMP_BURST_MULTIPLIER_MIN);
    champSpeedMultiplierRef.current = mult;
    clearTimeout(champBurstTimeoutRef.current);
    champBurstTimeoutRef.current = setTimeout(() => {
      champSpeedMultiplierRef.current = 1;
    }, CHAMP_BURST_DURATION);
  }

  function startRace() {
    // Use selectedGear to filter tiers for question pool
    const tiersForRace = unlockedTiers.filter(t => t <= selectedGear);
    const qs = selectQuestions(factData, tiersForRace.length > 0 ? tiersForRace : [1]);
    setQuestions(qs);
    setQIndex(0);
    setRaceProgress(0);
    setSpeed(2);
    speedRef.current = 2;
    setStreak(0);
    setSessionStats({ correct: 0, wrong: 0, coins: 0, wrongFacts: [] });
    setFeedback(null);
    setChoiceAnim(null);
    setLocalFactData({ ...factData });
    runningCoinsRef.current = 0;

    // Save last-used combo
    saveToStorage("tmr_last_combo", { gear: selectedGear, level: selectedLevel });

    // Initialize opponent
    champProgressRef.current = 0;
    setChampProgress(0);
    champFinishedRef.current = false;
    setChampFinished(false);
    champSpeedMultiplierRef.current = 1;
    setRaceResult(null);
    selectedLevelRef.current = selectedLevel;
    scheduleNextChampBurst(0);

    // Initialize pause
    setPaused(false);
    pausedRef.current = false;
    totalPausedTimeRef.current = 0;
    feedbackRemainingRef.current = null;

    // Initialize timing
    questionStartTimeRef.current = performance.now();
    frameCountRef.current = 0;

    buildChoicesFor(qs[0]);
    SFX.init();
    SFX.play('raceStart');
    SFX.startMusic();
    setScreen("race");
  }

  // Main game loop for real-time speed decay + champ progress
  useEffect(() => {
    if (screen !== "race") return;
    lastFrameTimeRef.current = performance.now();

    function gameLoop(now) {
      const rawDelta = (now - lastFrameTimeRef.current) / 1000;
      const delta = Math.min(rawDelta, 0.1); // clamp for tab backgrounding
      lastFrameTimeRef.current = now;

      // Player speed decay (only when not paused)
      if (!pausedRef.current) {
        speedRef.current = Math.max(SPEED_MIN, speedRef.current - SPEED_DECAY_RATE * delta);
      }

      // Champ progress (ALWAYS, even when paused — cost of pausing)
      if (!champFinishedRef.current) {
        const level = LEVELS.find(l => l.id === selectedLevelRef.current);
        if (level) {
          const champRate = (100 / level.champFinishTime) * champSpeedMultiplierRef.current;
          champProgressRef.current = Math.min(100, champProgressRef.current + champRate * delta);
          if (champProgressRef.current >= 100) {
            champFinishedRef.current = true;
            setChampFinished(true);
          }
        }
      }

      // Batch state sync every ~3 frames
      frameCountRef.current++;
      if (frameCountRef.current % 3 === 0) {
        setSpeed(Math.round(speedRef.current * 10) / 10);
        setChampProgress(Math.round(champProgressRef.current * 10) / 10);
      }

      decayLoopRef.current = requestAnimationFrame(gameLoop);
    }

    decayLoopRef.current = requestAnimationFrame(gameLoop);
    return () => {
      cancelAnimationFrame(decayLoopRef.current);
      clearTimeout(champBurstTimeoutRef.current);
    };
  }, [screen]);

  function handlePause() {
    if (paused) {
      // Resume
      SFX.play('resume');
      const pauseDuration = performance.now() - pauseStartTimeRef.current;
      totalPausedTimeRef.current += pauseDuration;
      pausedRef.current = false;
      setPaused(false);
      lastFrameTimeRef.current = performance.now();
      // Resume feedback timeout if it was active
      if (feedbackRemainingRef.current !== null && advanceQuestionRef.current) {
        timerRef.current = setTimeout(advanceQuestionRef.current, feedbackRemainingRef.current);
        feedbackRemainingRef.current = null;
      }
    } else {
      // Pause
      SFX.play('pause');
      pausedRef.current = true;
      setPaused(true);
      pauseStartTimeRef.current = performance.now();
      // Pause feedback timeout if active
      if (feedback && feedbackStartRef.current) {
        clearTimeout(timerRef.current);
        const elapsed = performance.now() - feedbackStartRef.current;
        feedbackRemainingRef.current = Math.max(0, feedbackDurationRef.current - elapsed);
      }
    }
  }

  // Extracted so it can be called from both handleAnswer timeout and handlePause resume
  const advanceQuestionRef = useRef(null);

  function handleAnswer(chosen, idx) {
    if (feedback || paused) return;
    const q = questions[qIndex];
    const correct = q.a * q.b;
    const isCorrect = chosen === correct;
    setChoiceAnim(idx);
    setFeedback(isCorrect ? "correct" : "wrong");
    SFX.play(isCorrect ? 'correct' : 'wrong');

    const key = getFactKey(q.a, q.b);
    const cur = localFactData[key] || { bucket: 0, correct: 0, wrong: 0 };
    const newBucket = isCorrect ? Math.min(5, cur.bucket + 1) : 0;
    const newFd = { ...localFactData, [key]: { bucket: newBucket, correct: cur.correct + (isCorrect ? 1 : 0), wrong: cur.wrong + (isCorrect ? 0 : 1), lastSeen: Date.now() } };
    setLocalFactData(newFd);

    // Real-time speed engine: response-time-based boosts
    const responseTime = (performance.now() - questionStartTimeRef.current - totalPausedTimeRef.current) / 1000;
    if (isCorrect) {
      let boost;
      if (responseTime < BOOST_FAST_THRESHOLD) boost = BOOST_FAST;
      else if (responseTime < BOOST_MEDIUM_THRESHOLD) boost = BOOST_MEDIUM;
      else if (responseTime < BOOST_SLOW_THRESHOLD) boost = BOOST_SLOW;
      else boost = BOOST_VERY_SLOW;
      speedRef.current = Math.min(SPEED_MAX, speedRef.current + boost);
    } else {
      speedRef.current = Math.max(SPEED_MIN, speedRef.current - WRONG_ANSWER_PENALTY);
    }
    setSpeed(speedRef.current);

    const newStreak = isCorrect ? streak + 1 : 0;
    setStreak(newStreak);
    const coinsEarned = isCorrect ? (newStreak >= 3 ? 2 : 1) : 0;
    if (isCorrect) { setTimeout(() => SFX.play('coin'), 100); }
    if (newStreak === 3) { setTimeout(() => SFX.play('streak'), 150); }
    const progressStep = 100 / QUESTIONS_PER_RACE;
    const newProgress = raceProgress + (isCorrect ? progressStep : progressStep * 0.25);
    setRaceProgress(Math.min(95, newProgress));

    // Track totals via local variables (not stale state)
    const newCorrect = sessionStats.correct + (isCorrect ? 1 : 0);
    const newWrong = sessionStats.wrong + (isCorrect ? 0 : 1);
    runningCoinsRef.current += coinsEarned;

    setSessionStats(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1),
      coins: prev.coins + coinsEarned,
      wrongFacts: isCorrect ? prev.wrongFacts : [...prev.wrongFacts, `${q.a} \u00d7 ${q.b} = ${correct}`],
    }));

    const feedbackDuration = isCorrect ? 550 : 1500;

    // Create advanceQuestion closure for this specific answer
    function advanceQuestion() {
      setFeedback(null);
      setChoiceAnim(null);
      feedbackRemainingRef.current = null;
      feedbackStartRef.current = null;
      const nextIdx = qIndex + 1;
      if (nextIdx >= QUESTIONS_PER_RACE) {
        setRaceProgress(100);
        const finalCoins = runningCoinsRef.current;
        const accuracy = newCorrect / QUESTIONS_PER_RACE;
        let bonus = 0;
        if (accuracy === 1) bonus = 5;
        else if (accuracy >= 0.9) bonus = 3;
        const totalSessionCoins = finalCoins + bonus;

        // Determine win/loss
        const playerWon = !champFinishedRef.current;
        setRaceResult(playerWon ? "win" : "loss");
        SFX.stopMusic();
        SFX.play(playerWon ? 'win' : 'lose');

        const newPd = {
          ...playerData,
          coins: playerData.coins + totalSessionCoins,
          totalRaces: playerData.totalRaces + 1,
          totalCorrect: playerData.totalCorrect + newCorrect,
          totalWrong: playerData.totalWrong + newWrong,
          totalWins: (playerData.totalWins || 0) + (playerWon ? 1 : 0),
          totalLosses: (playerData.totalLosses || 0) + (playerWon ? 0 : 1),
        };

        // Update level wins on player win
        if (playerWon) {
          const newLd = {
            ...levelData,
            wins: { ...levelData.wins, [String(selectedLevel)]: (levelData.wins[String(selectedLevel)] || 0) + 1 }
          };
          setLevelData(newLd);
          saveLevelData(newLd);
        }

        setSessionStats(prev => ({ ...prev, coins: totalSessionCoins, bonus, raceResult: playerWon ? "win" : "loss" }));
        setPlayerData(newPd);
        setFactData(newFd);
        saveData(newPd, newFd);
        setTimeout(() => setScreen("results"), 400);
      } else {
        setQIndex(nextIdx);
        buildChoicesFor(questions[nextIdx]);
        questionStartTimeRef.current = performance.now();
        totalPausedTimeRef.current = 0;
        // Check for champ burst
        if (nextIdx === nextBurstAtQuestionRef.current) {
          triggerChampBurst();
          scheduleNextChampBurst(nextIdx);
        }
      }
    }

    // Store ref for pause/resume
    advanceQuestionRef.current = advanceQuestion;

    clearTimeout(timerRef.current);
    feedbackStartRef.current = performance.now();
    feedbackDurationRef.current = feedbackDuration;
    timerRef.current = setTimeout(advanceQuestion, feedbackDuration);
  }

  if (screen === "loading") return (
    <div style={S.page}><div style={{ margin: 'auto', textAlign: 'center' }}>
      <div style={{ ...S.bigTitle, animation: 'pulse 1s infinite' }}>{"\uD83C\uDFCE\uFE0F"}</div>
      <div style={S.bigTitle}>Loading...</div>
    </div></div>
  );

  if (screen === "home") return <HomeScreen playerData={playerData} unlockedTiers={unlockedTiers} unlockedCars={unlockedCars} selectedCarId={selectedCarId} selectCar={selectCar} activeCar={activeCar} onPreRace={() => setScreen("prerace")} onDashboard={() => setScreen("dashboard")} unlockedLevels={unlockedLevels} levelData={levelData} muted={muted} toggleMute={toggleMute}/>;
  if (screen === "prerace") return <PreRaceScreen unlockedTiers={unlockedTiers} unlockedLevels={unlockedLevels} selectedGear={selectedGear} setSelectedGear={setSelectedGear} selectedLevel={selectedLevel} setSelectedLevel={setSelectedLevel} levelData={levelData} activeCar={activeCar} onStart={startRace} onBack={() => setScreen("home")}/>;
  if (screen === "race") return <RaceScreen q={questions[qIndex]} choices={choices} qIndex={qIndex} feedback={feedback} choiceAnim={choiceAnim} raceProgress={raceProgress} speed={speed} streak={streak} sessionStats={sessionStats} activeCar={activeCar} onAnswer={handleAnswer} champProgress={champProgress} champFinished={champFinished} paused={paused} onPause={handlePause} selectedLevel={selectedLevel}/>;
  if (screen === "results") return <ResultsScreen sessionStats={sessionStats} playerData={playerData} factData={factData} onHome={() => setScreen("home")} onPreRace={() => setScreen("prerace")} activeCar={activeCar} raceResult={raceResult} selectedLevel={selectedLevel} levelData={levelData} unlockedLevels={unlockedLevels}/>;
  if (screen === "dashboard") return <DashboardScreen playerData={playerData} factData={factData} unlockedTiers={unlockedTiers} onBack={() => setScreen("home")} levelData={levelData}/>;
  return null;
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────

function HomeScreen({ playerData, unlockedTiers, unlockedCars, selectedCarId, selectCar, activeCar, onPreRace, onDashboard, unlockedLevels, levelData, muted, toggleMute }) {
  const [revving, setRevving] = useState(false);
  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ textAlign: 'center', paddingTop: 8, position: 'relative' }}>
          {/* Mute toggle */}
          <button onClick={() => { SFX.init(); toggleMute(); }} style={{ position: 'absolute', top: 8, right: 0, background: '#111', border: '1px solid #222', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: muted ? '#555' : '#ffdd00', fontSize: 18, lineHeight: 1, fontFamily: 'Nunito, sans-serif' }}>
            {muted ? "\uD83D\uDD07" : "\uD83D\uDD0A"}
          </button>
          <div style={S.bigTitle}>TURBO</div>
          <div style={{ fontFamily: 'Bangers, cursive', fontSize: 24, letterSpacing: 10, color: '#ff3d00', marginTop: -8 }}>MATH RACERS</div>
          <div style={S.coinChip}>{"\uD83E\uDE99"} {playerData?.coins || 0} COINS</div>
        </div>

        {/* Car showcase */}
        <div style={{ background: '#0d0d1a', borderRadius: 16, border: '1px solid #1a1a3a', padding: '16px 0 8px', textAlign: 'center', margin: '12px 0', cursor: 'pointer' }}
          onClick={() => { setRevving(r => !r); SFX.init(); SFX.play('rev'); }}>
          <CarSVG color={activeCar.color} stripe={activeCar.stripe} size={130} animating={revving} shape={activeCar.shape}/>
          <div style={{ color: '#666', fontSize: 14, letterSpacing: 3, marginTop: 6, fontWeight: 800 }}>{activeCar.name.toUpperCase()}</div>
          <div style={{ color: '#444', fontSize: 12, marginTop: 2 }}>tap to rev {"\uD83D\uDD25"}</div>
        </div>

        {/* Car picker */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          {CARS.map(car => {
            const locked = !unlockedCars.includes(car.id);
            const sel = selectedCarId === car.id;
            return (
              <button key={car.id} onClick={() => { if (!locked) { selectCar(car.id); SFX.init(); SFX.play('tap'); } }}
                style={{ background: sel ? car.color : '#111', border: `2px solid ${sel ? car.color : locked ? '#1a1a1a' : '#333'}`, borderRadius: 10, padding: '8px 12px', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, color: sel ? '#000' : '#999', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13, lineHeight: 1.4, textAlign: 'center', minWidth: 68 }}>
                {locked ? "\uD83D\uDD12" : ""} {car.name.split(' ')[0]}
                {locked ? <div style={{ fontSize: 11 }}>{car.unlockCoins}{"\uD83E\uDE99"}</div> : null}
              </button>
            );
          })}
        </div>

        {/* Gear status (passive display, not interactive) */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 2, textAlign: 'center', marginBottom: 6 }}>UNLOCKED GEARS</div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
            {TIERS.map(tier => {
              const on = unlockedTiers.includes(tier.id);
              return (
                <div key={tier.id} style={{ background: on ? tier.color + '0c' : '#080808', border: `1px solid ${on ? tier.color + '33' : '#1a1a1a'}`, borderRadius: 6, padding: '3px 8px', color: on ? tier.color + 'aa' : '#333', fontSize: 11, fontWeight: 700, textAlign: 'center' }}>
                  {on ? "\u2713" : "\uD83D\uDD12"} {tier.name}
                </div>
              );
            })}
          </div>
          <div style={{ color: '#444', fontSize: 10, textAlign: 'center', marginTop: 4 }}>Choose gear in Race Setup</div>
        </div>

        <button onClick={() => { SFX.init(); SFX.play('tap'); onPreRace(); }} style={S.raceBtnBig} onMouseOver={e => e.target.style.transform = 'scale(1.02)'} onMouseOut={e => e.target.style.transform = 'scale(1)'}>
          {"\uD83C\uDFC1"} START RACE!
        </button>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 10 }}>
          <div style={S.pill}>{"\uD83C\uDFCE\uFE0F"} {playerData?.totalRaces || 0} races</div>
          <div style={S.pill}>{"\u2705"} {playerData?.totalCorrect || 0} correct</div>
          <button onClick={onDashboard} style={{ ...S.pill, background: '#1a1a2e', border: '1px solid #333', cursor: 'pointer', color: '#aaa' }}>{"\uD83D\uDCCA"} Stats</button>
        </div>
      </div>
      <GlobalStyles/>
    </div>
  );
}

// ─── PRE-RACE SCREEN ─────────────────────────────────────────────────────────

function PreRaceScreen({ unlockedTiers, unlockedLevels, selectedGear, setSelectedGear, selectedLevel, setSelectedLevel, levelData, activeCar, onStart, onBack }) {
  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <button onClick={onBack} style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: '8px 16px', color: '#aaa', cursor: 'pointer', fontWeight: 800, fontSize: 15, fontFamily: 'Nunito, sans-serif' }}>{"\u2190"} Back</button>
          <div style={{ fontFamily: 'Bangers, cursive', fontSize: 32, color: '#ffdd00', letterSpacing: 3 }}>RACE SETUP</div>
        </div>

        {/* Gear selection */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#888', fontSize: 13, fontWeight: 800, letterSpacing: 2, marginBottom: 8 }}>SELECT GEAR</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {TIERS.map(tier => {
              const on = unlockedTiers.includes(tier.id);
              const sel = selectedGear === tier.id;
              return (
                <button key={tier.id} onClick={() => on && setSelectedGear(tier.id)}
                  style={{ background: sel ? tier.color + '22' : '#0d0d0d', border: `2px solid ${sel ? tier.color : on ? tier.color + '44' : '#222'}`, borderRadius: 10, padding: '8px 12px', color: on ? (sel ? tier.color : tier.color + 'aa') : '#444', fontSize: 13, fontWeight: 800, textAlign: 'center', minWidth: 60, cursor: on ? 'pointer' : 'not-allowed', opacity: on ? 1 : 0.4, fontFamily: 'Nunito, sans-serif', transition: 'all 0.15s' }}>
                  {on ? "\u26A1" : "\uD83D\uDD12"} {tier.name}
                  <div style={{ fontSize: 11, marginTop: 1 }}>{on ? tier.label : `${tier.unlockCoins}\uD83E\uDE99`}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Level selection */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#888', fontSize: 13, fontWeight: 800, letterSpacing: 2, marginBottom: 8 }}>SELECT LEVEL</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {LEVELS.map((level, i) => {
              const on = unlockedLevels.includes(level.id);
              const sel = selectedLevel === level.id;
              const winsAtThis = levelData.wins[String(level.id)] || 0;
              const prevLevel = i > 0 ? LEVELS[i - 1] : null;
              const winsAtPrev = prevLevel ? (levelData.wins[String(prevLevel.id)] || 0) : 0;
              const winsNeeded = prevLevel ? Math.max(0, level.winsToUnlock - winsAtPrev) : 0;
              return (
                <button key={level.id} onClick={() => on && setSelectedLevel(level.id)}
                  style={{ background: sel ? level.color + '22' : '#0d0d0d', border: `2px solid ${sel ? level.color : on ? level.color + '44' : '#222'}`, borderRadius: 10, padding: '8px 12px', color: on ? (sel ? level.color : level.color + 'aa') : '#444', fontSize: 13, fontWeight: 800, textAlign: 'center', minWidth: 60, cursor: on ? 'pointer' : 'not-allowed', opacity: on ? 1 : 0.4, fontFamily: 'Nunito, sans-serif', transition: 'all 0.15s' }}>
                  {on ? `Lv${level.id}` : "\uD83D\uDD12"} {level.name}
                  <div style={{ fontSize: 11, marginTop: 1 }}>
                    {on ? `${winsAtThis} win${winsAtThis !== 1 ? 's' : ''}` : `${winsNeeded} more win${winsNeeded !== 1 ? 's' : ''}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Champ preview */}
        {(() => { const cc = getChampCar(selectedLevel); return (
        <div style={{ background: '#0d0d1a', borderRadius: 16, border: '1px solid #1a1a3a', padding: '16px 0 12px', textAlign: 'center', margin: '8px 0 16px' }}>
          <div style={{ color: '#888', fontSize: 12, fontWeight: 800, letterSpacing: 2, marginBottom: 8 }}>YOUR OPPONENT</div>
          <CarSVG color={cc.color} stripe={cc.stripe} size={100} animating={true} shape={cc.shape}/>
          <div style={{ color: '#ffd700', fontSize: 16, fontWeight: 900, letterSpacing: 2, marginTop: 6 }}>{cc.name.toUpperCase()}</div>
          <div style={{ color: '#666', fontSize: 13, marginTop: 2 }}>
            {LEVELS.find(l => l.id === selectedLevel)?.name || 'Rookie'} Level
          </div>
        </div>
        ); })()}

        {/* vs preview */}
        {(() => { const cc = getChampCar(selectedLevel); return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <CarSVG color={activeCar.color} stripe={activeCar.stripe} size={60} shape={activeCar.shape}/>
            <div style={{ color: '#aaa', fontSize: 11, fontWeight: 800, marginTop: 2 }}>YOU</div>
          </div>
          <div style={{ fontFamily: 'Bangers, cursive', fontSize: 28, color: '#ff3d00' }}>VS</div>
          <div style={{ textAlign: 'center' }}>
            <CarSVG color={cc.color} stripe={cc.stripe} size={60} animating={true} shape={cc.shape}/>
            <div style={{ color: '#ffd700', fontSize: 11, fontWeight: 800, marginTop: 2 }}>{cc.name.toUpperCase()}</div>
          </div>
        </div>
        ); })()}

        <button onClick={onStart} style={S.raceBtnBig} onMouseOver={e => e.target.style.transform = 'scale(1.02)'} onMouseOut={e => e.target.style.transform = 'scale(1)'}>
          {"\uD83C\uDFC1"} START RACE!
        </button>
      </div>
      <GlobalStyles/>
    </div>
  );
}

// ─── RACE SCREEN ─────────────────────────────────────────────────────────────

function RaceScreen({ q, choices, qIndex, feedback, choiceAnim, raceProgress, speed, streak, sessionStats, activeCar, onAnswer, champProgress, champFinished, paused, onPause, selectedLevel }) {
  if (!q) return null;
  const speedLabel = speed <= 2 ? 'SLOW' : speed <= 4 ? 'CRUISING' : speed <= 6 ? 'FAST!' : speed <= 8 ? '\u26A1 TURBO!' : '\uD83D\uDD25 MAX SPEED!';
  const speedColor = speed <= 2 ? '#ff3d00' : speed <= 4 ? '#ffdd00' : speed <= 6 ? '#00e676' : speed <= 8 ? '#00b0ff' : '#e040fb';

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {/* HUD */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ background: '#0d0d1a', border: `1.5px solid ${speedColor}66`, borderRadius: 10, padding: '6px 12px' }}>
            <div style={{ color: speedColor, fontSize: 13, fontWeight: 900, letterSpacing: 1 }}>{speedLabel}</div>
            <div style={{ display: 'flex', gap: 2, marginTop: 3 }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{ width: 6, height: 14, borderRadius: 2, background: i < speed ? speedColor : '#222', transition: 'background 0.2s' }}/>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#666', fontSize: 11, letterSpacing: 2, fontWeight: 800 }}>QUESTION</div>
            <div style={{ fontFamily: 'Bangers, cursive', fontSize: 26, color: '#fff' }}>{qIndex + 1} / {QUESTIONS_PER_RACE}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <div style={{ background: '#ffdd0011', border: '1.5px solid #ffdd0044', borderRadius: 10, padding: '6px 12px', textAlign: 'right' }}>
              <div style={{ color: '#ffdd00', fontSize: 13, fontWeight: 800 }}>COINS</div>
              <div style={{ fontFamily: 'Bangers, cursive', fontSize: 24, color: '#ffdd00' }}>{"\uD83E\uDE99"}{sessionStats.coins}</div>
            </div>
            {/* Pause button */}
            <button onClick={onPause} style={{ background: '#0d0d1a', border: '1.5px solid #333', borderRadius: 10, padding: '10px 10px', cursor: 'pointer', color: '#888', fontSize: 16, fontWeight: 900, fontFamily: 'Nunito, sans-serif', lineHeight: 1 }}>
              {"\u23F8"}
            </button>
          </div>
        </div>

        {/* Streak banner */}
        {streak >= 3 && (
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <span style={{ background: 'linear-gradient(90deg, #ff6d00, #ffdd00)', color: '#000', borderRadius: 20, padding: '3px 16px', fontSize: 14, fontWeight: 900, letterSpacing: 1 }}>
              {"\uD83D\uDD25"} {streak} STREAK {"\u2192"} +2 COINS!
            </span>
          </div>
        )}

        {/* Champ crossed finish banner */}
        {champFinished && (() => { const cc = getChampCar(selectedLevel); return (
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <span style={{ background: `linear-gradient(90deg, ${cc.color}, ${cc.stripe})`, color: '#fff', borderRadius: 20, padding: '3px 16px', fontSize: 13, fontWeight: 900, letterSpacing: 1, textShadow: '0 1px 3px #000' }}>
              {"\uD83C\uDFC1"} {cc.name} crossed the finish!
            </span>
          </div>
        ); })()}

        {/* Track */}
        <RaceTrack progress={raceProgress} speed={feedback === 'correct' ? 10 : speed} carColor={activeCar.color} carStripe={activeCar.stripe} carShape={activeCar.shape} champProgress={champProgress} champCar={getChampCar(selectedLevel)} paused={paused}/>

        {/* Question card */}
        <div style={{ background: feedback === 'correct' ? '#00e67610' : feedback === 'wrong' ? '#ff3d0010' : '#0d0d1a', border: `2px solid ${feedback === 'correct' ? '#00e676' : feedback === 'wrong' ? '#ff3d00' : '#1a1a3a'}`, borderRadius: 16, padding: '16px 20px', textAlign: 'center', margin: '10px 0', transition: 'all 0.2s' }}>
          <div style={{ fontFamily: 'Bangers, cursive', fontSize: 60, letterSpacing: 4, lineHeight: 1 }}>
            {q.a} <span style={{ color: '#ffdd00' }}>{"\u00d7"}</span> {q.b} <span style={{ color: '#333' }}>=</span> <span style={{ color: feedback ? (feedback === 'correct' ? '#00e676' : '#ff3d00') : '#555' }}>?</span>
          </div>
          {feedback === 'wrong' && <div style={{ color: '#ff6d50', fontWeight: 900, fontSize: 17, marginTop: 4 }}>{"\u2717"} The answer is <span style={{ color: '#ffaa88', fontSize: 20 }}>{q.a * q.b}</span> {"\u2014"} you'll see this again!</div>}
          {feedback === 'correct' && <div style={{ color: '#00e676', fontWeight: 900, fontSize: 18, marginTop: 4 }}>{"\u2713"} CORRECT! {streak >= 3 ? '\uD83D\uDD25 +2 coins!' : '+1 coin!'}</div>}
        </div>

        {/* Answer grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {choices.map((choice, idx) => {
            const isCorrectAns = choice === q.a * q.b;
            let bg = '#111';
            let border = '#222';
            let color = '#fff';
            let scale = 1;
            if (feedback && choiceAnim === idx) {
              bg = isCorrectAns ? '#00e676' : '#ff3d00';
              border = bg;
              color = '#000';
              scale = 0.96;
            } else if (feedback === 'wrong' && isCorrectAns) {
              bg = '#00e67615';
              border = '#00e676';
              color = '#00e676';
            }
            return (
              <button key={idx} onClick={() => onAnswer(choice, idx)} disabled={!!feedback || paused}
                style={{ background: bg, border: `2px solid ${border}`, borderRadius: 14, padding: '22px 10px', cursor: feedback || paused ? 'default' : 'pointer', color, fontFamily: 'Bangers, cursive', fontSize: 40, letterSpacing: 2, transition: 'all 0.15s', transform: `scale(${scale})`, boxShadow: feedback && choiceAnim === idx && isCorrectAns ? '0 0 20px #00e67644' : 'none', minHeight: 70 }}>
                {choice}
              </button>
            );
          })}
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          {Array.from({ length: QUESTIONS_PER_RACE }).map((_, i) => (
            <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', transition: 'background 0.3s', background: i < qIndex ? '#00e676' : i === qIndex ? '#ffdd00' : '#222' }}/>
          ))}
        </div>
      </div>

      {/* Pause overlay */}
      {paused && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ fontFamily: 'Bangers, cursive', fontSize: 52, color: '#ffdd00', letterSpacing: 5, textShadow: '0 0 30px rgba(255,221,0,0.4)' }}>PAUSED</div>
          <div style={{ color: '#888', fontSize: 14, margin: '8px 0 24px', fontWeight: 700 }}>{getChampCar(selectedLevel).name} is still racing...</div>
          <button onClick={onPause} style={{ ...S.raceBtnBig, maxWidth: 300 }}>{"\u25B6\uFE0F"} RESUME</button>
        </div>
      )}

      <GlobalStyles/>
    </div>
  );
}

// ─── RESULTS SCREEN ──────────────────────────────────────────────────────────

function ResultsScreen({ sessionStats, playerData, factData, onHome, onPreRace, activeCar, raceResult, selectedLevel, levelData, unlockedLevels }) {
  const accuracy = Math.round((sessionStats.correct / QUESTIONS_PER_RACE) * 100);
  const [show, setShow] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 100); }, []);

  const grade = accuracy >= 90 ? ['\uD83C\uDFC6', 'CHAMPION!', '#ffdd00'] : accuracy >= 70 ? ['\uD83E\uDD48', 'GREAT RACE!', '#00e676'] : accuracy >= 50 ? ['\uD83E\uDD49', 'GOOD JOB!', '#ff9100'] : ['\uD83D\uDCAA', 'KEEP RACING!', '#ff3d00'];

  const levelName = LEVELS.find(l => l.id === selectedLevel)?.name || 'Rookie';

  // Check if a new level was just unlocked
  const prevUnlockedCount = getUnlockedLevels({ ...levelData, wins: { ...levelData.wins, [String(selectedLevel)]: Math.max(0, (levelData.wins[String(selectedLevel)] || 0) - (raceResult === 'win' ? 1 : 0)) } }).length;
  const newLevelUnlocked = raceResult === 'win' && unlockedLevels.length > prevUnlockedCount;
  const newlyUnlockedLevel = newLevelUnlocked ? LEVELS.find(l => l.id === unlockedLevels[unlockedLevels.length - 1]) : null;

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {/* Win/Loss headline */}
        <div style={{ textAlign: 'center', padding: '12px 0 4px', opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(20px)', transition: 'all 0.4s' }}>
          {raceResult === 'win' ? (
            <>
              <div style={{ fontSize: 48, animation: 'bounce 0.5s ease' }}>{"\uD83C\uDFC1"}</div>
              <div style={{ fontFamily: 'Bangers, cursive', fontSize: 42, color: '#ffd700', letterSpacing: 4, textShadow: '0 0 20px rgba(255,215,0,0.4)' }}>YOU WIN!</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 48, animation: 'bounce 0.5s ease' }}>{"\uD83C\uDFCE\uFE0F"}</div>
              <div style={{ fontFamily: 'Bangers, cursive', fontSize: 36, color: getChampCar(selectedLevel).stripe, letterSpacing: 3 }}>{getChampCar(selectedLevel).name.toUpperCase()} WINS!</div>
              <div style={{ color: '#888', fontSize: 14, marginTop: 2 }}>Keep practicing — you'll get there!</div>
            </>
          )}
        </div>

        {/* Grade badge */}
        <div style={{ textAlign: 'center', padding: '4px 0', opacity: show ? 1 : 0, transition: 'all 0.4s 0.05s' }}>
          <div style={{ fontSize: 40 }}>{grade[0]}</div>
          <div style={{ fontFamily: 'Bangers, cursive', fontSize: 28, color: grade[2], letterSpacing: 2 }}>{grade[1]}</div>
        </div>

        {/* New level unlock banner */}
        {newLevelUnlocked && newlyUnlockedLevel && (
          <div style={{ textAlign: 'center', margin: '8px 0', opacity: show ? 1 : 0, transition: 'all 0.4s 0.1s' }}>
            <span style={{ background: `linear-gradient(90deg, ${newlyUnlockedLevel.color}44, ${newlyUnlockedLevel.color}22)`, border: `2px solid ${newlyUnlockedLevel.color}`, color: newlyUnlockedLevel.color, borderRadius: 12, padding: '8px 20px', fontSize: 16, fontWeight: 900, letterSpacing: 1 }}>
              {"\uD83D\uDD13"} NEW LEVEL UNLOCKED: {newlyUnlockedLevel.name}!
            </span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0', opacity: show ? 1 : 0, transition: 'all 0.4s 0.1s' }}>
          <CarSVG color={activeCar.color} stripe={activeCar.stripe} size={100} animating={true} shape={activeCar.shape}/>
        </div>

        <div style={{ ...S.card, opacity: show ? 1 : 0, transition: 'all 0.4s 0.2s' }}>
          {[
            ['\uD83C\uDFCE\uFE0F Race', `${raceResult === 'win' ? 'WIN' : 'LOSS'} vs ${getChampCar(selectedLevel).name}`, raceResult === 'win' ? '#ffd700' : getChampCar(selectedLevel).stripe],
            ['\uD83C\uDFC1 Level', `${levelName} (Lv${selectedLevel})`, LEVELS.find(l => l.id === selectedLevel)?.color || '#888'],
            ['\u2705 Correct', `${sessionStats.correct} / ${QUESTIONS_PER_RACE}`, '#00e676'],
            ['\uD83C\uDFAF Accuracy', `${accuracy}%`, grade[2]],
            ['\uD83E\uDE99 Coins Earned', `+${sessionStats.coins}${sessionStats.bonus ? ` (incl. +${sessionStats.bonus} bonus!)` : ''}`, '#ffdd00'],
            ['\uD83D\uDCB0 Total Coins', `${playerData?.coins || 0}`, '#ffaa00'],
          ].map(([label, val, col]) => (
            <div key={label} style={S.row}>
              <span style={{ color: '#999', fontSize: 16 }}>{label}</span>
              <span style={{ color: col, fontWeight: 900, fontSize: 18 }}>{val}</span>
            </div>
          ))}
        </div>

        {sessionStats.wrongFacts.length > 0 && (
          <div style={{ ...S.card, background: '#0d0505', border: '1px solid #ff3d0033', opacity: show ? 1 : 0, transition: 'all 0.4s 0.3s' }}>
            <div style={{ color: '#ff9100', fontWeight: 800, fontSize: 14, marginBottom: 8 }}>{"\uD83D\uDD01"} NEEDS PRACTICE {"\u2014"} These will come back!</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[...new Set(sessionStats.wrongFacts)].map(f => (
                <span key={f} style={{ background: '#ff3d0022', color: '#ff7755', borderRadius: 8, padding: '4px 12px', fontSize: 14, fontWeight: 800 }}>{f}</span>
              ))}
            </div>
          </div>
        )}

        <button onClick={onPreRace} style={{ ...S.raceBtnBig, opacity: show ? 1 : 0, transition: 'all 0.4s 0.4s', marginTop: 4 }}>{"\uD83C\uDFCE\uFE0F"} RACE AGAIN!</button>
        <button onClick={onHome} style={{ ...S.raceBtnBig, background: 'transparent', border: '2px solid #222', color: '#888', marginTop: 8, fontSize: 18, opacity: show ? 1 : 0, transition: 'all 0.4s 0.5s' }}>{"\uD83C\uDFE0"} Garage</button>
      </div>
      <GlobalStyles/>
    </div>
  );
}

// ─── DASHBOARD SCREEN ────────────────────────────────────────────────────────

function DashboardScreen({ playerData, factData, unlockedTiers, onBack, levelData }) {
  const [tab, setTab] = useState('tables');
  const unlockedTables = TIERS.filter(t => unlockedTiers.includes(t.id)).flatMap(t => t.tables);
  const tables = [...new Set([1, ...unlockedTables])].sort((a, b) => a - b);
  const dashUnlockedLevels = getUnlockedLevels(levelData);

  const weakFacts = [];
  for (const t of tables) {
    for (let n = 1; n <= 12; n++) {
      const d = factData[getFactKey(t, n)];
      if (d && d.wrong > 0) {
        weakFacts.push({ label: `${t} \u00d7 ${n} = ${t * n}`, acc: d.correct / (d.correct + d.wrong), bucket: d.bucket, wrong: d.wrong, correct: d.correct });
      }
    }
  }
  weakFacts.sort((a, b) => a.acc - b.acc);

  function tableStats(t) {
    let c = 0, w = 0, m = 0;
    for (let n = 1; n <= 12; n++) {
      const d = factData[getFactKey(t, n)];
      if (d) { c += d.correct; w += d.wrong; if (d.bucket >= MASTERY_THRESHOLD) m++; }
    }
    return { correct: c, wrong: w, mastered: m, acc: c + w > 0 ? Math.round(c / (c + w) * 100) : null };
  }

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <button onClick={onBack} style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: '8px 16px', color: '#aaa', cursor: 'pointer', fontWeight: 800, fontSize: 15, fontFamily: 'Nunito, sans-serif' }}>{"\u2190"} Back</button>
          <div style={{ fontFamily: 'Bangers, cursive', fontSize: 32, color: '#ffdd00', letterSpacing: 3 }}>STATS</div>
        </div>

        <div style={S.card}>
          {[
            ['\uD83C\uDFCE\uFE0F Races', playerData?.totalRaces || 0, '#aaa'],
            ['\uD83C\uDFC6 Wins', playerData?.totalWins || 0, '#ffd700'],
            ['\uD83E\uDD4C Losses', playerData?.totalLosses || 0, '#b0b8c8'],
            ['\u2705 Correct', playerData?.totalCorrect || 0, '#00e676'],
            ['\u274C Wrong', playerData?.totalWrong || 0, '#ff3d00'],
            ['\uD83C\uDFAF Accuracy', ((playerData?.totalCorrect || 0) + (playerData?.totalWrong || 0) > 0) ? `${Math.round(playerData.totalCorrect / (playerData.totalCorrect + playerData.totalWrong) * 100)}%` : '\u2014', '#ffdd00'],
          ].map(([l, v, c]) => (
            <div key={l} style={S.row}><span style={{ color: '#999', fontSize: 16 }}>{l}</span><span style={{ color: c, fontWeight: 900, fontSize: 18 }}>{v}</span></div>
          ))}
        </div>

        {/* Level progress */}
        <div style={{ ...S.card, marginBottom: 12 }}>
          <div style={{ color: '#888', fontSize: 13, fontWeight: 800, letterSpacing: 2, marginBottom: 4 }}>LEVEL PROGRESS</div>
          {LEVELS.map((level, i) => {
            const on = dashUnlockedLevels.includes(level.id);
            const wins = levelData.wins[String(level.id)] || 0;
            const nextLevel = LEVELS[i + 1];
            const winsNeeded = nextLevel ? nextLevel.winsToUnlock : null;
            const isMaxed = winsNeeded !== null && wins >= winsNeeded;
            return (
              <div key={level.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < LEVELS.length - 1 ? '1px solid #111' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: on ? level.color : '#444', fontWeight: 900, fontSize: 15 }}>
                    {on ? `Lv${level.id}` : "\uD83D\uDD12"} {level.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {on && winsNeeded !== null && (
                    <div style={{ display: 'flex', gap: 3 }}>
                      {Array.from({ length: winsNeeded }).map((_, j) => (
                        <span key={j} style={{ fontSize: 14, color: j < wins ? '#ffd700' : '#333' }}>{"\u2605"}</span>
                      ))}
                    </div>
                  )}
                  <span style={{ color: on ? (isMaxed ? '#00e676' : '#888') : '#444', fontSize: 13, fontWeight: 700 }}>
                    {on ? `${wins} win${wins !== 1 ? 's' : ''}` : 'Locked'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {['tables', 'weak'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 14, fontFamily: 'Nunito, sans-serif', background: tab === t ? '#ffdd00' : '#111', color: tab === t ? '#000' : '#666', letterSpacing: 1 }}>
              {t === 'tables' ? '\uD83D\uDCCA BY TABLE' : '\uD83C\uDFAF WEAKEST'}
            </button>
          ))}
        </div>

        {tab === 'tables' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tables.map(t => {
              const st = tableStats(t);
              const tierC = TIERS.find(ti => ti.tables.includes(t))?.color || '#888';
              return (
                <div key={t} style={{ background: '#0d0d1a', borderRadius: 12, padding: '12px 14px', border: `1px solid ${tierC}22` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ color: tierC, fontWeight: 900, fontSize: 17 }}>{"\u00d7"} {t} table</span>
                    <span style={{ color: '#666', fontSize: 13 }}>{st.mastered}/12 mastered {st.acc !== null ? `\u00b7 ${st.acc}%` : ''}</span>
                  </div>
                  <div style={{ background: '#111', borderRadius: 4, height: 6, marginBottom: 6 }}>
                    <div style={{ height: '100%', width: `${(st.mastered / 12) * 100}%`, background: tierC, borderRadius: 4, transition: 'width 0.8s' }}/>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(n => {
                      const d = factData[getFactKey(t, n)];
                      const bucket = d?.bucket ?? -1;
                      const bg = bucket < 0 ? '#1a1a1a' : bucket === 0 ? '#7f0000' : bucket <= 2 ? '#7f4000' : bucket <= 3 ? '#6b5500' : '#004d20';
                      const dot = bucket < 0 ? '#333' : bucket === 0 ? '#ff5252' : bucket <= 2 ? '#ff9100' : bucket <= 3 ? '#ffdd00' : '#00e676';
                      return (
                        <div key={n} title={`${t}\u00d7${n}=${t*n} bucket:${bucket}`} style={{ background: bg, border: `1px solid ${dot}66`, borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: dot, fontWeight: 900 }}>
                          {n}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: 12, color: '#555', textAlign: 'center' }}>{"\uD83D\uDD34"} Missed {"\u00b7"} {"\uD83D\uDFE0"} Learning {"\u00b7"} {"\uD83D\uDFE1"} Almost {"\u00b7"} {"\uD83D\uDFE2"} Mastered</div>
          </div>
        )}

        {tab === 'weak' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {weakFacts.length === 0
              ? <div style={{ color: '#666', textAlign: 'center', padding: 28, fontSize: 15 }}>No missed facts yet {"\u2014"} keep racing! {"\uD83C\uDFCE\uFE0F"}</div>
              : weakFacts.slice(0, 15).map((f, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0d0d1a', borderRadius: 10, padding: '10px 14px', border: '1px solid #1a1a2a' }}>
                  <div>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>{f.label}</span>
                    <span style={{ color: '#555', fontSize: 13, marginLeft: 8 }}>missed {f.wrong}{"\u00d7"}, correct {f.correct}{"\u00d7"}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <div style={{ background: '#1a1a1a', borderRadius: 3, height: 6, width: 50 }}>
                      <div style={{ height: '100%', width: `${f.acc * 100}%`, background: f.acc < 0.5 ? '#ff3d00' : f.acc < 0.75 ? '#ffdd00' : '#00e676', borderRadius: 3 }}/>
                    </div>
                    <span style={{ fontSize: 13, color: '#777' }}>{Math.round(f.acc * 100)}%</span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
      <GlobalStyles/>
    </div>
  );
}

// ─── SHARED STYLES ───────────────────────────────────────────────────────────

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(160deg, #080812 0%, #0a0a1e 60%, #080812 100%)', display: 'flex', justifyContent: 'center', fontFamily: "'Nunito', sans-serif", color: '#fff' },
  wrap: { width: '100%', maxWidth: 430, padding: '16px 14px 36px' },
  bigTitle: { fontFamily: 'Bangers, cursive', fontSize: 48, letterSpacing: 5, color: '#ffdd00', textShadow: '0 0 30px rgba(255,221,0,0.4), 2px 2px 0 #000', lineHeight: 1 },
  coinChip: { display: 'inline-block', background: '#ffdd0018', border: '1.5px solid #ffdd0055', color: '#ffdd00', borderRadius: 20, padding: '5px 18px', fontSize: 16, fontWeight: 900, marginTop: 8 },
  raceBtnBig: { width: '100%', padding: '18px 0', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #cc2200, #ff6600)', color: '#fff', fontFamily: 'Bangers, cursive', fontSize: 26, letterSpacing: 3, boxShadow: '0 4px 24px rgba(200,50,0,0.35)', transition: 'transform 0.15s, box-shadow 0.15s' },
  card: { background: '#0d0d1a', border: '1px solid #1a1a2a', borderRadius: 14, padding: '12px 16px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #111', paddingBottom: 8 },
  pill: { background: '#111', border: '1px solid #1a1a1a', borderRadius: 20, padding: '6px 16px', fontSize: 14, color: '#888', fontWeight: 800 },
};

function GlobalStyles() {
  return (
    <style>{`
      button:active { transform: scale(0.97) !important; }
      @keyframes bounce { 0%{transform:scale(0.5)} 60%{transform:scale(1.2)} 100%{transform:scale(1)} }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    `}</style>
  );
}
