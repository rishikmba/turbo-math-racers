import { useState, useEffect, useRef, useId } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const DISPLAY_FONT = "'Space Grotesk', sans-serif";

const TIERS = [
  { id: 1, name: "LEVEL 1", tables: [2, 5, 10], color: "#00e676", label: "\u00d72, \u00d75, \u00d710", unlockCoins: 0   },
  { id: 2, name: "LEVEL 2", tables: [3, 4],     color: "#ffdd00", label: "\u00d73, \u00d74",       unlockCoins: 20  },
  { id: 3, name: "LEVEL 3", tables: [6, 9],     color: "#ff9100", label: "\u00d76, \u00d79",       unlockCoins: 50  },
  { id: 4, name: "LEVEL 4", tables: [7, 8],     color: "#ff3d00", label: "\u00d77, \u00d78",       unlockCoins: 90  },
  { id: 5, name: "LEVEL 5", tables: [11, 12],   color: "#d500f9", label: "\u00d711, \u00d712",     unlockCoins: 140 },
];

const CARS = [
  { id: 1, name: "GR86",           color: "#cc2200", stripe: "#ff6644", unlockCoins: 0,   shape: "gr86"      },
  { id: 2, name: "Neuf-Onze",      color: "#1155cc", stripe: "#55aaff", unlockCoins: 30,  shape: "porsche"   },
  { id: 3, name: "Aventador",      color: "#116622", stripe: "#44ee88", unlockCoins: 75,  shape: "aventador" },
  { id: 4, name: "Chiron",         color: "#aa6600", stripe: "#ffee22", unlockCoins: 130, shape: "chiron"    },
  { id: 5, name: "McLaren P1",     color: "#660088", stripe: "#dd66ff", unlockCoins: 200, shape: "mclaren"   },
];

const QUESTIONS_PER_RACE = 12;
const MASTERY_THRESHOLD = 4;

// ─── LEAGUE SYSTEM ───────────────────────────────────────────────────────────

const LEAGUES = [
  { id: 1, name: "Rookie",   champFinishTime: 90,  winsToUnlock: 0, color: "#66bb6a" },
  { id: 2, name: "Street",   champFinishTime: 65,  winsToUnlock: 3, color: "#ffdd00" },
  { id: 3, name: "Circuit",  champFinishTime: 50,  winsToUnlock: 3, color: "#ff9100" },
  { id: 4, name: "Pro",      champFinishTime: 38,  winsToUnlock: 3, color: "#ff3d00" },
  { id: 5, name: "Champion", champFinishTime: 28,  winsToUnlock: 3, color: "#d500f9" },
];

const CHAMP_CARS = {
  1: { name: "Ol' Beetle",      color: "#8a7a6a", stripe: "#aa9966", shape: "beetle"     },
  2: { name: "Challenger",      color: "#2a2a2a", stripe: "#cc0000", shape: "challenger" },
  3: { name: "GT3 RS",          color: "#003388", stripe: "#ffdd00", shape: "gt3"        },
  4: { name: "F1 Car",          color: "#cc0000", stripe: "#ffffff", shape: "f1"         },
  5: { name: "Phantom X",       color: "#1a0033", stripe: "#00ffcc", shape: "phantom"    },
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

const CHAMP_BURST_INTERVAL_MIN = 1;
const CHAMP_BURST_INTERVAL_MAX = 3;
const CHAMP_BURST_MULTIPLIER_MIN = 1.15;
const CHAMP_BURST_MULTIPLIER_MAX = 1.25;
const CHAMP_BURST_DURATION = 2000;

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

  _kick(time, dest) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.08);
    g.gain.setValueAtTime(0.7, time);
    g.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
    osc.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + 0.15);
  },

  _snare(time, dest) {
    if (!this.ctx) return;
    const bufLen = Math.floor(this.ctx.sampleRate * 0.08);
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(0.4, time);
    g.gain.exponentialRampToValueAtTime(0.01, time + 0.08);
    src.connect(g);
    g.connect(dest);
    src.start(time);
    // Tonal body
    const osc = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 180;
    g2.gain.setValueAtTime(0.25, time);
    g2.gain.exponentialRampToValueAtTime(0.01, time + 0.06);
    osc.connect(g2);
    g2.connect(dest);
    osc.start(time);
    osc.stop(time + 0.1);
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

    let running = true;
    const LOOP = 8; // 8-second loop (4 bars at 120 BPM)

    // Bass: C2, C2, F2, F2, G2, G2, Ab2, G2
    const bassNotes = [65.4, 65.4, 87.3, 87.3, 98, 98, 103.8, 98];
    // Chord pads: Cm, Cm, Fm, Fm, Gm, Gm, Ab, Ab (root + third + fifth)
    const chords = [
      [131, 156, 196], [131, 156, 196], // Cm
      [175, 208, 262], [175, 208, 262], // Fm
      [196, 233, 294], [196, 233, 294], // Gm
      [208, 262, 311], [208, 262, 311], // Ab
    ];

    const playLoop = () => {
      if (!running || !this.ctx) return;
      const now = this.ctx.currentTime;

      // ── Bass line (triangle wave) ──
      bassNotes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.5, now + i);
        g.gain.exponentialRampToValueAtTime(0.01, now + i + 0.9);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now + i);
        osc.stop(now + i + 1);
      });

      // ── Chord pad (sine, very low volume) ──
      chords.forEach((chord, i) => {
        chord.forEach(freq => {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          g.gain.setValueAtTime(0.08, now + i);
          g.gain.setValueAtTime(0.08, now + i + 0.7);
          g.gain.exponentialRampToValueAtTime(0.005, now + i + 0.95);
          osc.connect(g);
          g.connect(masterGain);
          osc.start(now + i);
          osc.stop(now + i + 1);
        });
      });

      // ── Kick drum (beats 1 and 3 of each bar) ──
      [0, 1, 4, 5].forEach(beat => {
        this._kick(now + beat, masterGain);
      });

      // ── Snare (beats 2 and 4 of each bar) ──
      [2, 3, 6, 7].forEach(beat => {
        this._snare(now + beat + 0.5, masterGain);
      });

      // ── Hi-hat pattern (16th notes with accents) ──
      for (let i = 0; i < 16; i++) {
        const t = now + i * 0.5;
        const bufLen = Math.floor(this.ctx.sampleRate * 0.03);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let j = 0; j < bufLen; j++) d[j] = (Math.random() * 2 - 1);
        const src = this.ctx.createBufferSource();
        const g = this.ctx.createGain();
        src.buffer = buf;
        const accent = i % 2 === 0 ? 0.25 : 0.12;
        g.gain.setValueAtTime(accent, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        src.connect(g);
        g.connect(masterGain);
        src.start(t);
      }
    };

    playLoop();
    const interval = setInterval(() => {
      if (!running) { clearInterval(interval); return; }
      playLoop();
    }, LOOP * 1000);

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

function getUnlockedLeagues(levelData) {
  const unlocked = [1];
  for (let i = 1; i < LEAGUES.length; i++) {
    const prevId = LEAGUES[i - 1].id;
    const winsAtPrev = levelData.wins[String(prevId)] || 0;
    if (winsAtPrev >= LEAGUES[i].winsToUnlock) {
      unlocked.push(LEAGUES[i].id);
    } else {
      break;
    }
  }
  return unlocked;
}

// ─── COLOR UTILITIES & GRADIENT DEFS ─────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.substring(0,2),16), parseInt(h.substring(2,4),16), parseInt(h.substring(4,6),16)];
}
function rgbToHex(r, g, b) {
  return '#' + [r,g,b].map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2,'0')).join('');
}
function lighten(hex, pct) {
  const [r,g,b] = hexToRgb(hex);
  return rgbToHex(r + (255-r)*pct, g + (255-g)*pct, b + (255-b)*pct);
}
function darken(hex, pct) {
  const [r,g,b] = hexToRgb(hex);
  return rgbToHex(r*(1-pct), g*(1-pct), b*(1-pct));
}

function carDefs(color, stripe, uid) {
  return (
    <defs>
      {/* Metallic body gradient */}
      <linearGradient id={`body-${uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={lighten(color, 0.35)}/>
        <stop offset="30%" stopColor={lighten(color, 0.12)}/>
        <stop offset="55%" stopColor={color}/>
        <stop offset="100%" stopColor={darken(color, 0.35)}/>
      </linearGradient>
      {/* Chrome/silver gradient for rims */}
      <linearGradient id={`chrome-${uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#eee"/>
        <stop offset="40%" stopColor="#888"/>
        <stop offset="100%" stopColor="#444"/>
      </linearGradient>
      {/* Glass gradient for windows */}
      <linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stopColor="#aaddff" stopOpacity="0.7"/>
        <stop offset="50%" stopColor="#5599cc" stopOpacity="0.5"/>
        <stop offset="100%" stopColor="#224466" stopOpacity="0.6"/>
      </linearGradient>
      {/* Specular highlight */}
      <linearGradient id={`spec-${uid}`} x1="0" y1="0" x2="1" y2="0.5">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.25"/>
        <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
      </linearGradient>
      {/* Stripe gradient */}
      <linearGradient id={`stripe-${uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={lighten(stripe, 0.2)}/>
        <stop offset="100%" stopColor={darken(stripe, 0.15)}/>
      </linearGradient>
    </defs>
  );
}

// ─── CAR SHAPES ──────────────────────────────────────────────────────────────

function stdWheels(uid) {
  const wheel = (cx) => <>
    <circle cx={cx} cy="57" r="9.5" fill="#0a0a0a"/>
    <circle cx={cx} cy="57" r="9" fill="#1a1a1a"/>
    <circle cx={cx} cy="57" r="7" fill={uid ? `url(#chrome-${uid})` : '#444'}/>
    <circle cx={cx} cy="57" r="6.5" fill="#3a3a3a"/>
    <circle cx={cx} cy="57" r="5" fill="#661111" opacity="0.3"/>
    <g style={{ transformOrigin: `${cx}px 57px`, animation: 'wheelSpin 0.5s linear infinite' }}>
      {[0, 72, 144, 216, 288].map((a, i) => {
        const rad = a * Math.PI / 180;
        return <line key={i} x1={cx} y1={57} x2={cx + Math.cos(rad) * 6} y2={57 + Math.sin(rad) * 6} stroke="#777" strokeWidth="1.8" strokeLinecap="round"/>;
      })}
    </g>
    <circle cx={cx} cy="57" r="2" fill="#999"/>
    <circle cx={cx} cy="57" r="1" fill="#bbb"/>
  </>;
  return <>{wheel(32)}{wheel(88)}</>;
}

const CAR_SHAPES = {
  // ── PLAYER CARS ──────────────────────────────────────────────

  // Car 1: Toyota GR86 — compact coupe, long hood, sloped roofline
  gr86: (color, stripe, uid) => <>
    {uid && carDefs(color, stripe, uid)}
    {/* Ground shadow */}
    <ellipse cx="60" cy="63" rx="48" ry="3" fill="#000" opacity="0.3"/>
    {/* Main body */}
    <path d="M10 46 Q12 36 22 30 L40 24 L48 16 Q56 13 66 16 L72 22 L96 28 Q110 34 112 46 L112 52 Q112 58 106 58 L16 58 Q10 58 10 52 Z" fill={uid ? `url(#body-${uid})` : color}/>
    {/* Specular highlight */}
    {uid && <path d="M22 30 L72 22 L96 28 Q104 32 108 38 L90 30 L52 22 Z" fill={`url(#spec-${uid})`}/>}
    {/* Lower body panel */}
    <path d="M14 48 L108 48 L112 52 Q112 58 106 58 L16 58 Q10 58 10 52 L14 48 Z" fill="#000" opacity="0.15"/>
    {/* Hood crease */}
    <line x1="96" y1="30" x2="72" y2="22" stroke="#000" strokeWidth="0.5" opacity="0.3"/>
    {/* Door panel line */}
    <line x1="52" y1="22" x2="50" y2="46" stroke="#000" strokeWidth="0.6" opacity="0.25"/>
    {/* Rear quarter panel line */}
    <line x1="38" y1="26" x2="36" y2="46" stroke="#000" strokeWidth="0.5" opacity="0.2"/>
    {/* Fender arch - front */}
    <path d="M94 46 Q94 38 100 34" fill="none" stroke="#000" strokeWidth="0.5" opacity="0.2"/>
    {/* Fender arch - rear */}
    <path d="M24 46 Q24 38 18 34" fill="none" stroke="#000" strokeWidth="0.5" opacity="0.2"/>
    {/* Window frame */}
    <path d="M48 22 L52 14 Q58 11 66 14 L70 22 Z" fill="#111"/>
    {/* Windshield */}
    <path d="M62 22 L66 15 Q62 13 58 14.5 L56 22 Z" fill={uid ? `url(#glass-${uid})` : '#88bbee'} opacity={uid ? 1 : 0.55}/>
    {/* Rear window */}
    <path d="M50 22 L52 16 Q54 14 57 15 L55 22 Z" fill={uid ? `url(#glass-${uid})` : '#88bbee'} opacity={uid ? 0.8 : 0.4}/>
    {/* Side mirror */}
    <rect x="70" y="21" width="3" height="2" rx="0.8" fill="#222"/>
    {/* Front grille */}
    <path d="M104 36 L112 42 L112 46 L104 44 Z" fill="#111"/>
    <line x1="106" y1="38" x2="110" y2="43" stroke="#333" strokeWidth="0.5"/>
    <line x1="108" y1="37" x2="111" y2="42" stroke="#333" strokeWidth="0.5"/>
    {/* Headlight housing */}
    <path d="M110 36 L112 38 L112 42 L110 41 Z" fill="#ddeeff" opacity="0.9"/>
    <path d="M110.5 37" r="1" fill="#fff" opacity="0.5"/>
    {/* Taillight */}
    <path d="M7 44 L12 42 L12 48 L7 48 Z" fill="#cc0000" opacity="0.85"/>
    <line x1="8" y1="44" x2="8" y2="47" stroke="#ff4444" strokeWidth="0.8" opacity="0.6"/>
    {/* Rear lip spoiler */}
    <rect x="7" y="42" width="8" height="1.5" rx="0.5" fill="#222"/>
    {/* Exhaust tips */}
    <circle cx="9" cy="54" r="1.8" fill="#222"/><circle cx="9" cy="54" r="1.2" fill="#333"/>
    <circle cx="13" cy="54" r="1.8" fill="#222"/><circle cx="13" cy="54" r="1.2" fill="#333"/>
    {/* Side stripe accent */}
    <path d="M20 40 L100 34 L100 36 L20 42 Z" fill={uid ? `url(#stripe-${uid})` : stripe} opacity="0.15"/>
    {stdWheels(uid)}
  </>,

  // Car 2: Porsche 911 — iconic rear hump, flowing fastback, round headlights
  porsche: (color, stripe, uid) => <>
    {uid && carDefs(color, stripe, uid)}
    <ellipse cx="60" cy="63" rx="48" ry="3" fill="#000" opacity="0.3"/>
    {/* Main body */}
    <path d="M8 46 Q10 38 18 34 L30 30 L48 20 Q56 16 64 18 L72 22 Q80 24 86 22 Q96 18 100 22 L106 30 Q112 36 112 46 L112 52 Q112 58 106 58 L14 58 Q8 58 8 52 Z" fill={uid ? `url(#body-${uid})` : color}/>
    {uid && <path d="M30 30 L72 22 Q80 24 86 22 Q96 18 100 22 L106 30 L86 24 L52 22 Z" fill={`url(#spec-${uid})`}/>}
    {/* Lower body */}
    <path d="M12 48 L106 48 L112 52 Q112 58 106 58 L14 58 Q8 58 8 52 L12 48 Z" fill="#000" opacity="0.12"/>
    {/* Rear engine hump highlight */}
    <path d="M82 22 Q90 18 98 22 Q102 28 102 34 L98 30 Q94 24 84 24 Z" fill="#fff" opacity="0.06"/>
    {/* Rear engine louvers */}
    <line x1="86" y1="22" x2="88" y2="28" stroke="#000" strokeWidth="0.5" opacity="0.3"/>
    <line x1="90" y1="20" x2="91" y2="27" stroke="#000" strokeWidth="0.5" opacity="0.3"/>
    <line x1="94" y1="20" x2="94" y2="27" stroke="#000" strokeWidth="0.5" opacity="0.3"/>
    {/* Door panel */}
    <line x1="56" y1="20" x2="54" y2="46" stroke="#000" strokeWidth="0.6" opacity="0.2"/>
    {/* Side vent */}
    <path d="M56 32 L62 30 L62 34 Z" fill="#111" opacity="0.4"/>
    {/* Fender arches */}
    <path d="M96 46 Q96 38 102 32" fill="none" stroke="#000" strokeWidth="0.5" opacity="0.2"/>
    <path d="M22 46 Q22 38 16 36" fill="none" stroke="#000" strokeWidth="0.5" opacity="0.2"/>
    {/* Window frame */}
    <path d="M48 20 L52 13 Q58 10 66 14 L70 22 Z" fill="#111"/>
    {/* Windshield */}
    <path d="M62 22 L66 15 Q62 12 58 13 L56 22 Z" fill={uid ? `url(#glass-${uid})` : '#88bbee'} opacity={uid ? 1 : 0.5}/>
    {/* Quarter window */}
    <path d="M50 20 L53 15 Q55 13.5 57 14 L55 22 Z" fill={uid ? `url(#glass-${uid})` : '#88bbee'} opacity={uid ? 0.8 : 0.35}/>
    {/* Side mirror */}
    <rect x="70" y="20" width="3" height="2.5" rx="1" fill="#222"/>
    {/* Round headlight - housing */}
    <circle cx="110" cy="38" r="4" fill="#222"/>
    <circle cx="110" cy="38" r="3.2" fill="#ddeeff" opacity="0.9"/>
    <circle cx="110" cy="38" r="2" fill="#fff" opacity="0.6"/>
    <circle cx="110" cy="38" r="0.8" fill="#ffff99"/>
    {/* Lower fog light */}
    <ellipse cx="110" cy="44" rx="2.5" ry="1.5" fill="#ffff99" opacity="0.5"/>
    {/* Rear light bar */}
    <path d="M5 42 L12 40 L12 48 L5 48 Z" fill="#cc0000" opacity="0.85"/>
    <line x1="6" y1="43" x2="6" y2="47" stroke="#ff3333" strokeWidth="1" opacity="0.5"/>
    <line x1="8" y1="42" x2="8" y2="47" stroke="#ff3333" strokeWidth="1" opacity="0.5"/>
    <line x1="10" y1="41" x2="10" y2="47" stroke="#ff3333" strokeWidth="1" opacity="0.5"/>
    {/* Exhaust */}
    <circle cx="8" cy="54" r="2" fill="#222"/><circle cx="8" cy="54" r="1.2" fill="#444"/>
    {/* Side stripe */}
    <path d="M18 38 L102 30 L102 32 L18 40 Z" fill={uid ? `url(#stripe-${uid})` : stripe} opacity="0.15"/>
    {stdWheels(uid)}
  </>,

  // Car 3: Lamborghini Aventador — ultra-angular wedge, sharp creases
  aventador: (color, stripe, uid) => <>
    {uid && carDefs(color, stripe, uid)}
    <ellipse cx="60" cy="63" rx="48" ry="3" fill="#000" opacity="0.3"/>
    {/* Main body - angular wedge */}
    <path d="M6 46 L10 36 L20 30 L44 22 L52 14 L68 14 L74 20 L96 24 L110 32 L114 46 L114 52 Q114 58 108 58 L12 58 Q6 58 6 52 Z" fill={uid ? `url(#body-${uid})` : color}/>
    {uid && <path d="M44 22 L68 14 L74 20 L96 24 L110 32 L96 26 L56 16 Z" fill={`url(#spec-${uid})`}/>}
    {/* Lower body */}
    <path d="M10 48 L110 48 L114 52 Q114 58 108 58 L12 58 Q6 58 6 52 L10 48 Z" fill="#000" opacity="0.15"/>
    {/* Sharp body crease line */}
    <line x1="20" y1="36" x2="108" y2="32" stroke="#fff" strokeWidth="0.4" opacity="0.15"/>
    {/* Door cut line */}
    <path d="M58 14 L56 46" fill="none" stroke="#000" strokeWidth="0.6" opacity="0.25"/>
    {/* Angular side scoop */}
    <path d="M38 34 L52 26 L52 38 Z" fill="#0a0a0a" opacity="0.6"/>
    <path d="M40 34 L50 28 L50 36 Z" fill="#111"/>
    {/* Scoop mesh lines */}
    <line x1="42" y1="33" x2="48" y2="30" stroke="#222" strokeWidth="0.5"/>
    <line x1="43" y1="35" x2="49" y2="32" stroke="#222" strokeWidth="0.5"/>
    {/* Second intake */}
    <path d="M74 22 L80 18 L82 24 Z" fill="#111" opacity="0.5"/>
    {/* Window frame */}
    <path d="M52 22 L56 14 L66 14 L70 22 Z" fill="#111"/>
    {/* Windshield */}
    <path d="M62 22 L65 14.5 L60 14 L58 22 Z" fill={uid ? `url(#glass-${uid})` : '#88bbee'} opacity={uid ? 1 : 0.5}/>
    {/* Rear window */}
    <path d="M54 22 L57 15 L59 15 L57 22 Z" fill={uid ? `url(#glass-${uid})` : '#88bbee'} opacity={uid ? 0.8 : 0.3}/>
    {/* Y-shaped headlight */}
    <path d="M108 34 L114 36 L114 42 L108 42 Z" fill="#222"/>
    <path d="M109 36 L113 37 L111 39 L109 38 Z" fill="#ddeeff" opacity="0.9"/>
    <path d="M109 39 L111 39 L113 41 L109 41 Z" fill="#ffff99" opacity="0.7"/>
    {/* Taillight */}
    <path d="M6 42 L12 40 L12 48 L6 48 Z" fill="#cc0000" opacity="0.85"/>
    <path d="M7 43 L7 47" fill="none" stroke="#ff4444" strokeWidth="1" opacity="0.5"/>
    <path d="M9 42 L9 47" fill="none" stroke="#ff4444" strokeWidth="1" opacity="0.5"/>
    {/* Rear diffuser fins */}
    <rect x="6" y="50" width="2" height="6" rx="0.5" fill="#222"/>
    <rect x="10" y="50" width="2" height="6" rx="0.5" fill="#222"/>
    {/* Hexagonal exhaust */}
    <path d="M8 54 L10 53 L12 54 L12 56 L10 57 L8 56 Z" fill="#222" stroke="#444" strokeWidth="0.5"/>
    {/* Side stripe */}
    <path d="M20 38 L104 30 L104 32 L20 40 Z" fill={uid ? `url(#stripe-${uid})` : stripe} opacity="0.15"/>
    {/* Fender arches */}
    <path d="M96 46 Q96 38 102 32" fill="none" stroke="#000" strokeWidth="0.5" opacity="0.2"/>
    <path d="M22 46 Q22 40 16 36" fill="none" stroke="#000" strokeWidth="0.5" opacity="0.2"/>
    {stdWheels(uid)}
  </>,

  // Car 4: Bugatti Chiron — widest body, C-line, massive rounded rear
  chiron: (color, stripe, uid) => <>
    {uid && carDefs(color, stripe, uid)}
    <ellipse cx="60" cy="63" rx="50" ry="3.5" fill="#000" opacity="0.3"/>
    {/* Main body - wide & muscular */}
    <path d="M6 46 Q8 34 16 28 L36 22 L48 16 Q58 12 70 16 L84 20 Q96 22 104 28 Q114 34 114 46 L114 52 Q114 58 108 58 L12 58 Q6 58 6 52 Z" fill={uid ? `url(#body-${uid})` : color}/>
    {uid && <path d="M36 22 L70 16 L84 20 Q96 22 104 28 L86 22 L50 18 Z" fill={`url(#spec-${uid})`}/>}
    {/* Lower body */}
    <path d="M10 48 L110 48 L114 52 Q114 58 108 58 L12 58 Q6 58 6 52 L10 48 Z" fill="#000" opacity="0.12"/>
    {/* Muscular rear fender bulge */}
    <path d="M14 36 Q12 40 12 46 L20 46 Q18 38 22 32 Z" fill="#fff" opacity="0.05"/>
    {/* Front fender bulge */}
    <path d="M100 30 Q106 34 108 46 L100 46 Q100 36 96 30 Z" fill="#fff" opacity="0.05"/>
    {/* Signature C-line (left) */}
    <path d="M48 18 Q44 28 42 38 Q46 40 52 36 Q56 26 54 18" fill="none" stroke={stripe} strokeWidth="2.5" opacity="0.5"/>
    {/* Signature C-line (right) */}
    <path d="M72 18 Q76 28 78 38 Q74 40 68 36 Q64 26 66 18" fill="none" stroke={stripe} strokeWidth="2.5" opacity="0.5"/>
    {/* Door panel line */}
    <line x1="60" y1="16" x2="58" y2="46" stroke="#000" strokeWidth="0.5" opacity="0.2"/>
    {/* Side air curtain */}
    <path d="M42 38 L46 36 L46 42 L42 42 Z" fill="#111" opacity="0.4"/>
    {/* Window frame */}
    <path d="M48 16 L52 10 Q60 7 70 10 L74 16 Z" fill="#111"/>
    {/* Windshield */}
    <path d="M64 16 L69 11 Q64 8 60 9.5 L58 16 Z" fill={uid ? `url(#glass-${uid})` : '#88bbee'} opacity={uid ? 1 : 0.5}/>
    {/* Rear window */}
    <path d="M50 16 L53 11.5 Q56 9.5 59 10.5 L57 16 Z" fill={uid ? `url(#glass-${uid})` : '#88bbee'} opacity={uid ? 0.8 : 0.35}/>
    {/* Horseshoe grille */}
    <path d="M108 34 L114 38 L114 46 L108 44 Z" fill="#111"/>
    <path d="M109 36 Q112 38 112 42 Q112 44 109 43" fill="none" stroke="#888" strokeWidth="1" opacity="0.5"/>
    {/* Headlights */}
    <path d="M112 34 L114 36 L114 38 L112 37 Z" fill="#ddeeff" opacity="0.9"/>
    <path d="M112 42 L114 43 L114 45 L112 44 Z" fill="#ddeeff" opacity="0.7"/>
    {/* Sequential rear light */}
    <rect x="3" y="42" width="8" height="4" rx="1" fill="#cc0000" opacity="0.85"/>
    <line x1="5" y1="43" x2="5" y2="45" stroke="#ff4444" strokeWidth="0.8" opacity="0.5"/>
    <line x1="7" y1="43" x2="7" y2="45" stroke="#ff4444" strokeWidth="0.8" opacity="0.5"/>
    <line x1="9" y1="43" x2="9" y2="45" stroke="#ff4444" strokeWidth="0.8" opacity="0.5"/>
    {/* Quad exhaust */}
    <circle cx="7" cy="53" r="1.5" fill="#222"/><circle cx="7" cy="53" r="0.9" fill="#444"/>
    <circle cx="11" cy="53" r="1.5" fill="#222"/><circle cx="11" cy="53" r="0.9" fill="#444"/>
    <circle cx="7" cy="56" r="1.5" fill="#222"/><circle cx="7" cy="56" r="0.9" fill="#444"/>
    <circle cx="11" cy="56" r="1.5" fill="#222"/><circle cx="11" cy="56" r="0.9" fill="#444"/>
    {stdWheels(uid)}
  </>,

  // Car 5: McLaren P1 — teardrop, huge diffuser, butterfly doors, roof snorkel
  mclaren: (color, stripe, uid) => <>
    {uid && carDefs(color, stripe, uid)}
    <ellipse cx="60" cy="63" rx="48" ry="3" fill="#000" opacity="0.3"/>
    {/* Main body */}
    <path d="M6 46 Q8 36 16 30 L40 22 Q50 14 66 16 L80 20 L98 26 Q114 32 114 46 L114 52 Q114 58 108 58 L12 58 Q6 58 6 52 Z" fill={uid ? `url(#body-${uid})` : color}/>
    {uid && <path d="M40 22 Q50 14 66 16 L80 20 L98 26 L80 22 L52 16 Z" fill={`url(#spec-${uid})`}/>}
    {/* Lower body */}
    <path d="M10 48 L108 48 L114 52 Q114 58 108 58 L12 58 Q6 58 6 52 L10 48 Z" fill="#000" opacity="0.15"/>
    {/* Butterfly door line */}
    <path d="M58 16 Q54 24 52 32 L50 46" fill="none" stroke="#000" strokeWidth="0.6" opacity="0.25"/>
    {/* Side radiator intake */}
    <path d="M48 30 L56 26 L56 36 L48 38 Z" fill="#0a0a0a" opacity="0.5"/>
    <line x1="50" y1="31" x2="54" y2="28" stroke="#222" strokeWidth="0.5"/>
    <line x1="50" y1="33" x2="54" y2="30" stroke="#222" strokeWidth="0.5"/>
    <line x1="50" y1="35" x2="54" y2="32" stroke="#222" strokeWidth="0.5"/>
    {/* Roof snorkel */}
    <rect x="56" y="8" width="7" height="7" rx="2" fill="#1a1a1a"/>
    <rect x="57" y="9" width="5" height="5" rx="1.5" fill="#222"/>
    <path d="M58 10 L61 10 L61 13 L58 13 Z" fill={stripe} opacity="0.3"/>
    {/* Window frame */}
    <path d="M40 22 L46 12 Q54 8 66 12 L72 20 Z" fill="#111"/>
    {/* Windshield */}
    <path d="M62 20 L65 13 Q60 10 55 11.5 L54 20 Z" fill={uid ? `url(#glass-${uid})` : '#88bbee'} opacity={uid ? 1 : 0.5}/>
    {/* Rear window */}
    <path d="M42 22 L47 14 Q50 11 54 12 L52 20 Z" fill={uid ? `url(#glass-${uid})` : '#88bbee'} opacity={uid ? 0.8 : 0.3}/>
    {/* LED blade headlight */}
    <path d="M110 34 L114 36 L114 40 L110 39 Z" fill="#222"/>
    <line x1="111" y1="35.5" x2="113" y2="37" stroke="#ddeeff" strokeWidth="1.5" strokeLinecap="round" opacity="0.9"/>
    {/* Lower light */}
    <ellipse cx="112" cy="42" rx="2.5" ry="1.5" fill="#ffff99" opacity="0.5"/>
    {/* Rear diffuser channels */}
    <path d="M100 46 L114 50 L114 56 L104 54 Z" fill="#111" opacity="0.6"/>
    <rect x="102" y="48" width="1.5" height="7" rx="0.5" fill="#222"/>
    <rect x="106" y="49" width="1.5" height="6" rx="0.5" fill="#222"/>
    <rect x="110" y="50" width="1.5" height="5" rx="0.5" fill="#222"/>
    {/* Taillight */}
    <path d="M3 42 L10 40 L10 48 L3 48 Z" fill="#cc0000" opacity="0.85"/>
    <line x1="5" y1="42" x2="5" y2="47" stroke="#ff4444" strokeWidth="0.8" opacity="0.5"/>
    <line x1="7" y1="41" x2="7" y2="47" stroke="#ff4444" strokeWidth="0.8" opacity="0.5"/>
    {/* Triple exhaust */}
    <circle cx="7" cy="54" r="1.5" fill="#222"/><circle cx="7" cy="54" r="0.9" fill="#444"/>
    <circle cx="11" cy="53" r="1.5" fill="#222"/><circle cx="11" cy="53" r="0.9" fill="#444"/>
    <circle cx="11" cy="56" r="1.5" fill="#222"/><circle cx="11" cy="56" r="0.9" fill="#444"/>
    {/* Side stripe */}
    <path d="M20 36 L100 28 L100 30 L20 38 Z" fill={uid ? `url(#stripe-${uid})` : stripe} opacity="0.15"/>
    {stdWheels(uid)}
  </>,

  // ── CHAMP CARS ──────────────────────────────────────────────

  // Champ Lv1: VW Beetle — round body, huge rear dome, bubbly
  beetle: (color, stripe, uid) => <>
    <ellipse cx="60" cy="63" rx="44" ry="3" fill="#000" opacity="0.25"/>
    {/* Main body - round */}
    <path d="M16 46 Q18 36 26 30 L36 26 L42 22 Q50 18 58 20 L64 24 Q72 22 80 18 Q92 16 98 24 L102 32 Q108 38 108 46 L108 52 Q108 58 102 58 L20 58 Q14 58 14 52 Z" fill={color}/>
    {/* Lower body */}
    <path d="M18 48 L104 48 L108 52 Q108 58 102 58 L20 58 Q14 58 14 52 L18 48 Z" fill="#000" opacity="0.1"/>
    {/* Running board */}
    <rect x="28" y="48" width="56" height="2" rx="0.8" fill="#333" opacity="0.5"/>
    {/* Rear dome highlight */}
    <path d="M82 20 Q90 17 96 22 Q100 28 100 34" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.1"/>
    {/* Rear engine lid louvers */}
    <line x1="84" y1="22" x2="86" y2="28" stroke="#000" strokeWidth="0.5" opacity="0.25"/>
    <line x1="88" y1="20" x2="89" y2="27" stroke="#000" strokeWidth="0.5" opacity="0.25"/>
    <line x1="92" y1="19" x2="92" y2="26" stroke="#000" strokeWidth="0.5" opacity="0.25"/>
    {/* Door panel */}
    <line x1="54" y1="22" x2="52" y2="46" stroke="#000" strokeWidth="0.5" opacity="0.2"/>
    {/* Door handle */}
    <rect x="50" y="30" width="3" height="1.2" rx="0.5" fill="#888" opacity="0.5"/>
    {/* Rain gutter line */}
    <path d="M42 22 Q50 18 58 20 L64 24" fill="none" stroke="#000" strokeWidth="0.4" opacity="0.15"/>
    {/* Window frame */}
    <path d="M42 22 L46 18 Q52 15 58 18 L60 22 Z" fill="#111"/>
    {/* Windshield */}
    <path d="M55 22 L57 18.5 Q54 16 50 17.5 L48 22 Z" fill="#88bbee" opacity="0.45"/>
    {/* Rear window */}
    <path d="M44 22 L47 19 Q48 17.5 50 17.8 L49 22 Z" fill="#88bbee" opacity="0.3"/>
    {/* Front bumper */}
    <path d="M104 42 L108 42 L108 48 L104 48 Z" fill="#888" opacity="0.4"/>
    {/* Round headlight with chrome ring */}
    <circle cx="106" cy="38" r="3.5" fill="#888" opacity="0.5"/>
    <circle cx="106" cy="38" r="3" fill="#222"/>
    <circle cx="106" cy="38" r="2.5" fill="#ddeeff" opacity="0.8"/>
    <circle cx="106" cy="38" r="1.2" fill="#ffff99" opacity="0.9"/>
    {/* Rear bumper */}
    <path d="M14 42 L18 40 L18 48 L14 48 Z" fill="#888" opacity="0.4"/>
    {/* Taillight */}
    <circle cx="16" cy="42" r="2.5" fill="#cc0000" opacity="0.7"/>
    <circle cx="16" cy="42" r="1.5" fill="#ff3333" opacity="0.4"/>
    {/* Antenna */}
    <rect x="62" y="12" width="1.2" height="10" rx="0.4" fill="#888"/>
    <circle cx="62.6" cy="11.5" r="1.2" fill="#ff4444" opacity="0.5"/>
    {stdWheels(uid)}
  </>,

  // Champ Lv2: Dodge Challenger — long flat hood, boxy, muscular
  challenger: (color, stripe, uid) => <>
    <ellipse cx="60" cy="63" rx="48" ry="3" fill="#000" opacity="0.3"/>
    {/* Main body - long & boxy */}
    <path d="M8 46 Q10 34 18 28 L56 22 Q62 18 70 18 L76 22 Q82 24 88 28 L106 32 Q112 36 112 46 L112 52 Q112 58 106 58 L14 58 Q8 58 8 52 Z" fill={color}/>
    {/* Lower body */}
    <path d="M12 48 L108 48 L112 52 Q112 58 106 58 L14 58 Q8 58 8 52 L12 48 Z" fill="#000" opacity="0.12"/>
    {/* Muscular fender flares */}
    <path d="M96 46 Q98 38 104 32" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.08"/>
    <path d="M22 46 Q20 38 16 34" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.08"/>
    {/* Hood scoop */}
    <path d="M38 22 L48 20 L48 26 L38 26 Z" fill="#111" opacity="0.5"/>
    <path d="M40 23 L46 22 L46 25 L40 25 Z" fill="#222"/>
    {/* Twin hood stripes */}
    <rect x="22" y="25" width="34" height="2" rx="0.8" fill={stripe} opacity="0.6"/>
    <rect x="22" y="29" width="34" height="2" rx="0.8" fill={stripe} opacity="0.6"/>
    {/* Body line */}
    <rect x="14" y="38" width="92" height="1.5" rx="0.5" fill={stripe} opacity="0.15"/>
    {/* Door panel */}
    <line x1="66" y1="20" x2="64" y2="46" stroke="#000" strokeWidth="0.6" opacity="0.2"/>
    {/* Gas cap */}
    <circle cx="42" cy="34" r="1.5" fill="#333" opacity="0.4"/>
    {/* Window frame */}
    <path d="M62 22 L66 14 Q70 11 76 14 L80 22 Z" fill="#111"/>
    {/* Windshield */}
    <path d="M72 22 L75 15 Q72 12.5 68 13.5 L66 22 Z" fill="#88bbee" opacity="0.5"/>
    {/* Rear window */}
    <path d="M64 22 L67 15.5 Q68 14 69 14 L68 22 Z" fill="#88bbee" opacity="0.35"/>
    {/* Front splitter */}
    <rect x="106" y="46" width="8" height="2" rx="0.5" fill="#222"/>
    {/* Quad headlights */}
    <rect x="108" y="34" width="5" height="9" rx="1" fill="#222"/>
    <rect x="109" y="35" width="3" height="3.5" rx="0.8" fill="#ddeeff" opacity="0.9"/>
    <rect x="109" y="40" width="3" height="2.5" rx="0.8" fill="#ffff99" opacity="0.7"/>
    {/* Taillight */}
    <rect x="5" y="36" width="6" height="7" rx="1" fill="#cc0000" opacity="0.85"/>
    <line x1="7" y1="37" x2="7" y2="42" stroke="#ff4444" strokeWidth="0.8" opacity="0.5"/>
    <line x1="9" y1="37" x2="9" y2="42" stroke="#ff4444" strokeWidth="0.8" opacity="0.5"/>
    {/* Trunk lip */}
    <rect x="7" y="34" width="8" height="1.5" rx="0.5" fill="#222"/>
    {/* Dual exhaust */}
    <circle cx="9" cy="54" r="2" fill="#222"/><circle cx="9" cy="54" r="1.3" fill="#444"/>
    <circle cx="14" cy="54" r="2" fill="#222"/><circle cx="14" cy="54" r="1.3" fill="#444"/>
    {stdWheels(uid)}
  </>,

  // Champ Lv3: Porsche GT3 RS — 911-based, massive rear wing, wide fenders
  gt3: (color, stripe, uid) => <>
    <ellipse cx="60" cy="63" rx="50" ry="3" fill="#000" opacity="0.3"/>
    {/* Main body */}
    <path d="M6 46 Q8 36 16 30 L32 26 L48 18 Q56 14 66 16 L72 20 Q80 22 86 20 Q96 16 102 24 L108 32 Q114 38 114 46 L114 52 Q114 58 108 58 L12 58 Q6 58 6 52 Z" fill={color}/>
    {/* Lower body */}
    <path d="M10 48 L110 48 L114 52 Q114 58 108 58 L12 58 Q6 58 6 52 L10 48 Z" fill="#000" opacity="0.12"/>
    {/* Wide fender bulges */}
    <path d="M98 46 Q100 38 106 30" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.08"/>
    <path d="M20 46 Q18 38 12 34" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.08"/>
    {/* NACA duct on hood */}
    <path d="M96 26 L102 24 L100 30 L94 30 Z" fill="#111" opacity="0.4"/>
    {/* Door panel */}
    <line x1="58" y1="18" x2="56" y2="46" stroke="#000" strokeWidth="0.5" opacity="0.2"/>
    {/* Swan-neck wing mount (left) */}
    <path d="M86 20 Q86 10 88 6" fill="none" stroke="#444" strokeWidth="2.5" strokeLinecap="round"/>
    {/* Swan-neck wing mount (right) */}
    <path d="M100 22 Q100 12 102 6" fill="none" stroke="#444" strokeWidth="2.5" strokeLinecap="round"/>
    {/* Wing endplates */}
    <rect x="82" y="4" width="3" height="10" rx="1" fill="#333"/>
    <rect x="102" y="4" width="3" height="10" rx="1" fill="#333"/>
    {/* Wing surface */}
    <path d="M82 4 L107 4 L106 9 L83 9 Z" fill={stripe} opacity="0.8"/>
    <path d="M83 7 L106 7" fill="none" stroke="#000" strokeWidth="0.4" opacity="0.3"/>
    {/* Front canard */}
    <path d="M108 42 L116 40 L116 42 L108 44 Z" fill="#333"/>
    {/* Front splitter */}
    <path d="M108 48 L116 46 L116 48 L108 50 Z" fill="#222"/>
    {/* Window frame */}
    <path d="M48 18 L52 11 Q58 8 68 12 L72 20 Z" fill="#111"/>
    {/* Windshield */}
    <path d="M62 20 L67 13 Q62 10 58 11 L56 20 Z" fill="#88bbee" opacity="0.5"/>
    {/* Roll cage bars visible in window */}
    <line x1="58" y1="20" x2="64" y2="12" stroke="#666" strokeWidth="0.8" opacity="0.35"/>
    <line x1="60" y1="20" x2="66" y2="13" stroke="#666" strokeWidth="0.8" opacity="0.35"/>
    {/* Race number circle */}
    <circle cx="54" cy="32" r="5" fill="#fff" opacity="0.15"/>
    <text x="54" y="35" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="900" opacity="0.4">1</text>
    {/* Headlights */}
    <circle cx="112" cy="36" r="3" fill="#222"/>
    <circle cx="112" cy="36" r="2.2" fill="#ddeeff" opacity="0.9"/>
    <circle cx="112" cy="36" r="1" fill="#ffff99"/>
    <ellipse cx="112" cy="42" rx="2.5" ry="1.5" fill="#ffff99" opacity="0.5"/>
    {/* Taillights */}
    <rect x="3" y="42" width="6" height="4" rx="1" fill="#cc0000" opacity="0.85"/>
    <line x1="5" y1="43" x2="5" y2="45" stroke="#ff4444" strokeWidth="0.8" opacity="0.5"/>
    <line x1="7" y1="43" x2="7" y2="45" stroke="#ff4444" strokeWidth="0.8" opacity="0.5"/>
    {/* Center-lock wheel hint (yellow centers) */}
    <circle cx="32" cy="57" r="1.2" fill={stripe} opacity="0.6"/>
    <circle cx="88" cy="57" r="1.2" fill={stripe} opacity="0.6"/>
    {stdWheels(uid)}
  </>,

  // Champ Lv4: Modern F1 — narrow nose, halo, exposed wheels, sidepods
  f1: (color, stripe, uid) => {
    const f1Wheel = (cx) => <>
      <circle cx={cx} cy="57" r="9.5" fill="#0a0a0a"/>
      <circle cx={cx} cy="57" r="9" fill="#1a1a1a"/>
      <circle cx={cx} cy="57" r="7" fill={uid ? `url(#chrome-${uid})` : '#444'}/>
      <circle cx={cx} cy="57" r="6.5" fill="#3a3a3a"/>
      <circle cx={cx} cy="57" r="5" fill="#661111" opacity="0.3"/>
      <g style={{ transformOrigin: `${cx}px 57px`, animation: 'wheelSpin 0.5s linear infinite' }}>
        {[0, 72, 144, 216, 288].map((a, i) => {
          const rad = a * Math.PI / 180;
          return <line key={i} x1={cx} y1={57} x2={cx + Math.cos(rad) * 6} y2={57 + Math.sin(rad) * 6} stroke="#777" strokeWidth="1.8" strokeLinecap="round"/>;
        })}
      </g>
      <circle cx={cx} cy="57" r="2" fill="#999"/>
      <circle cx={cx} cy="57" r="1" fill="#bbb"/>
    </>;
    return <>
      {uid && carDefs(color, stripe, uid)}
      <ellipse cx="60" cy="63" rx="50" ry="2.5" fill="#000" opacity="0.2"/>
      {/* Front wing */}
      <path d="M4 36 L4 44 L24 42 L24 38 Z" fill={color}/>
      <path d="M2 34 L8 34 L8 46 L2 46 Z" fill={stripe} opacity="0.5"/>
      {/* Wing endplate front */}
      <rect x="0" y="33" width="3" height="14" rx="0.5" fill="#333"/>
      {/* Floor */}
      <path d="M24 38 L24 44 L88 44 L88 38 Z" fill="#111" opacity="0.3"/>
      {/* Main body/chassis */}
      <path d="M24 34 L24 48 L74 48 Q82 48 88 42 L88 34 Q82 28 74 28 L40 28 Z" fill={color}/>
      {/* Bargeboard */}
      <path d="M30 32 L36 30 L36 36 L30 36 Z" fill="#333" opacity="0.4"/>
      {/* Sidepod inlet */}
      <path d="M42 28 L50 28 L48 34 L42 34 Z" fill="#111" opacity="0.5"/>
      <line x1="44" y1="29" x2="43" y2="33" stroke="#222" strokeWidth="0.5"/>
      <line x1="46" y1="29" x2="45" y2="33" stroke="#222" strokeWidth="0.5"/>
      {/* Cockpit area */}
      <path d="M64 28 L68 20 Q72 18 76 20 L78 28 Z" fill="#222"/>
      <path d="M66 28 L69 22 Q72 20 75 22 L77 28 Z" fill="#88bbee" opacity="0.4"/>
      {/* Halo device */}
      <path d="M66 28 Q68 24 72 24 Q76 24 78 28" fill="none" stroke="#999" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M66 28 Q68 24 72 24 Q76 24 78 28" fill="none" stroke="#bbb" strokeWidth="1" strokeLinecap="round"/>
      {/* T-cam */}
      <circle cx="74" cy="20" r="2" fill={stripe} opacity="0.8"/>
      {/* DRS rear wing */}
      <rect x="94" y="16" width="2.5" height="26" rx="0.8" fill="#333"/>
      <rect x="104" y="16" width="2.5" height="26" rx="0.8" fill="#333"/>
      <path d="M92 14 L109 14 L108 19 L93 19 Z" fill={stripe} opacity="0.8"/>
      <path d="M93 17 L108 17" fill="none" stroke="#000" strokeWidth="0.4" opacity="0.3"/>
      {/* Wing endplates */}
      <rect x="90" y="12" width="3" height="10" rx="0.5" fill="#444"/>
      <rect x="108" y="12" width="3" height="10" rx="0.5" fill="#444"/>
      {/* Rear beam wing */}
      <path d="M88 40 L102 42 L102 46 L88 44 Z" fill={color}/>
      {/* Floor edge detail */}
      <path d="M28 46 L84 46 L84 48 L28 48 Z" fill={stripe} opacity="0.15"/>
      {/* Body stripe */}
      <rect x="32" y="36" width="50" height="1.5" rx="0.5" fill={stripe} opacity="0.2"/>
      {/* Nose camera */}
      <rect x="4" y="39" width="2" height="2" rx="0.5" fill="#333"/>
      {/* Rear rain light */}
      <rect x="96" y="42" width="8" height="2" rx="0.8" fill="#cc0000" opacity="0.6"/>
      {f1Wheel(28)}{f1Wheel(98)}
    </>;
  },

  // Champ Lv5: Phantom X — futuristic concept, angular, canopy, LED strips
  phantom: (color, stripe, uid) => <>
    <ellipse cx="60" cy="63" rx="50" ry="3.5" fill="#000" opacity="0.3"/>
    {/* Main body - angular/aggressive */}
    <path d="M6 46 L10 34 L22 26 L44 18 L54 12 L72 14 L84 20 L100 26 L112 34 L114 46 L114 52 Q114 58 108 58 L12 58 Q6 58 6 52 Z" fill={color}/>
    {/* Lower body */}
    <path d="M10 48 L110 48 L114 52 Q114 58 108 58 L12 58 Q6 58 6 52 L10 48 Z" fill="#000" opacity="0.15"/>
    {/* Angular body crease */}
    <line x1="22" y1="34" x2="106" y2="30" stroke="#fff" strokeWidth="0.5" opacity="0.1"/>
    {/* Door panel line */}
    <line x1="60" y1="14" x2="58" y2="46" stroke="#000" strokeWidth="0.5" opacity="0.2"/>
    {/* Canopy cockpit */}
    <path d="M54 18 Q60 10 72 14 L68 22 Z" fill="#111"/>
    <path d="M56 18 Q62 11 70 14.5 L67 21 Z" fill="#446688" opacity="0.5"/>
    <path d="M58 18 Q62 13 66 15" fill="none" stroke="#88bbee" strokeWidth="0.5" opacity="0.3"/>
    {/* LED strip running light - front */}
    <path d="M84 22 L110 32 L110 34 L84 24 Z" fill={stripe} opacity="0.5"/>
    {/* LED strip - main body */}
    <path d="M10 44 L110 44 L110 46 L10 46 Z" fill={stripe} opacity="0.7"/>
    {/* Secondary light strip */}
    <path d="M18 36 L104 32 L104 33 L18 37 Z" fill={stripe} opacity="0.3"/>
    {/* Aero wheel cover - front */}
    <path d="M22 48 L42 48 Q44 48 44 50 L44 56 Q44 58 42 58 L22 58 Q20 58 20 56 L20 50 Q20 48 22 48 Z" fill={color} opacity="0.4"/>
    <path d="M24 50 L40 50 L40 56 L24 56 Z" fill="#111" opacity="0.2"/>
    {/* Aero wheel cover - rear */}
    <path d="M78 48 L98 48 Q100 48 100 50 L100 56 Q100 58 98 58 L78 58 Q76 58 76 56 L76 50 Q76 48 78 48 Z" fill={color} opacity="0.4"/>
    <path d="M80 50 L96 50 L96 56 L80 56 Z" fill="#111" opacity="0.2"/>
    {/* Active rear wing */}
    <path d="M88 14 L88 8 L92 6 L92 20" fill="none" stroke="#333" strokeWidth="2"/>
    <path d="M100 14 L100 8 L104 6 L104 20" fill="none" stroke="#333" strokeWidth="2"/>
    <path d="M86 6 L106 4 L105 9 L87 10 Z" fill={stripe} opacity="0.7"/>
    <path d="M87 8 L105 7" fill="none" stroke="#000" strokeWidth="0.3" opacity="0.3"/>
    {/* Light-pipe headlight */}
    <path d="M110 34 L114 36 L114 42 L110 42 Z" fill="#111"/>
    <line x1="111" y1="35" x2="113" y2="37" stroke={stripe} strokeWidth="1.5" strokeLinecap="round" opacity="0.9"/>
    <line x1="111" y1="38" x2="113" y2="39.5" stroke={stripe} strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
    {/* Light-pipe taillight */}
    <path d="M6 40 L10 38 L10 46 L6 46 Z" fill="#111"/>
    <line x1="7" y1="40" x2="9" y2="39" stroke="#ff0000" strokeWidth="1.5" strokeLinecap="round" opacity="0.8"/>
    <line x1="7" y1="43" x2="9" y2="42" stroke="#ff0000" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
    {/* Carbon diffuser */}
    <path d="M6 48 L14 48 L14 56 L6 54 Z" fill="#1a1a1a"/>
    <line x1="8" y1="49" x2="8" y2="54" stroke="#333" strokeWidth="0.5"/>
    <line x1="10" y1="49" x2="10" y2="55" stroke="#333" strokeWidth="0.5"/>
    <line x1="12" y1="48" x2="12" y2="55" stroke="#333" strokeWidth="0.5"/>
    {stdWheels(uid)}
  </>,
};

// ─── CAR SVG ─────────────────────────────────────────────────────────────────

function CarSVG({ color, stripe, size = 80, animating = false, flip = false, shape = "gr86" }) {
  const uid = useId().replace(/:/g, '');
  const renderShape = CAR_SHAPES[shape] || CAR_SHAPES.gr86;
  return (
    <svg width={size} height={size * 0.55} viewBox="0 0 120 66" fill="none"
      style={{
        filter: animating ? `drop-shadow(0 0 10px ${color}) drop-shadow(0 0 20px ${color}88)` : `drop-shadow(2px 2px 6px #00000099)`,
        transition: 'filter 0.3s', transform: flip ? 'scaleX(-1)' : 'none',
      }}>
      {renderShape(color, stripe, uid)}
    </svg>
  );
}

// ─── RACE TRACK ──────────────────────────────────────────────────────────────

function RaceTrack({ progress, speed, carColor, carStripe, carShape, champProgress, champCar, paused, streak }) {
  const [lineOffset, setLineOffset] = useState(0);
  const speedForAnim = paused ? 0 : speed;
  const prevSpeedRef = useRef(speed);
  const [tilt, setTilt] = useState(0);

  useEffect(() => {
    let raf;
    const animate = () => {
      setLineOffset(prev => (prev + (speedForAnim * 0.3)) % 11);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [speedForAnim]);

  // Speed-dependent car tilt
  useEffect(() => {
    const delta = speed - prevSpeedRef.current;
    prevSpeedRef.current = speed;
    if (delta > 0.5) setTilt(-2);
    else if (delta < -0.5) setTilt(1.5);
    const t = setTimeout(() => setTilt(0), 300);
    return () => clearTimeout(t);
  }, [speed]);

  const champVisualSpeed = Math.min(10, (champProgress < 100 ? 4 : 0));
  const bounceDuration = speed > 3 ? Math.max(0.15, 0.6 - speed * 0.04) : 0;
  const numSpeedLines = Math.min(8, Math.max(0, Math.floor(speed - 2)));

  return (
    <div style={{ position: 'relative', width: '100%', height: 148, overflow: 'hidden', background: '#0a0a1a', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Sky */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 48, background: 'linear-gradient(180deg, #050510 0%, #0a0a2a 100%)' }}/>
      {/* Stars */}
      {[15, 40, 70, 90, 110, 200, 280, 340].map((x, i) => (
        <div key={i} style={{ position: 'absolute', top: 4 + (i % 3) * 10, left: x, width: 2, height: 2, borderRadius: '50%', background: '#fff', opacity: 0.5 }}/>
      ))}

      {/* Far parallax layer: buildings */}
      {[30, 110, 200, 290, 370].map((baseX, i) => {
        const h = [22, 30, 18, 26, 20][i];
        const w = [14, 10, 16, 12, 14][i];
        const x = ((baseX - lineOffset * 2) % 430 + 430) % 430 - 20;
        return (
          <div key={`b${i}`} style={{ position: 'absolute', bottom: 48, left: x, width: w, height: h, background: '#0c0c18', borderRadius: '2px 2px 0 0', opacity: 0.6 }}>
            {/* Lit windows */}
            {[0.25, 0.6].map((wy, j) => [0.2, 0.6].map((wx, k) => (
              <div key={`w${j}${k}`} style={{ position: 'absolute', left: `${wx * 100}%`, top: `${wy * 100}%`, width: 2, height: 2, background: '#ffdd00', opacity: Math.random() > 0.3 ? 0.5 : 0.15, borderRadius: 0.5 }}/>
            )))}
          </div>
        );
      })}

      {/* Near parallax layer: lampposts */}
      {[60, 160, 260, 360].map((baseX, i) => {
        const x = ((baseX - lineOffset * 4) % 430 + 430) % 430 - 20;
        return (
          <div key={`lp${i}`} style={{ position: 'absolute', bottom: 48, left: x }}>
            <div style={{ width: 2, height: 28, background: '#333', margin: '0 auto' }}/>
            <div style={{ width: 6, height: 2, background: '#555', borderRadius: '2px 2px 0 0', marginLeft: -2 }}/>
            <div style={{ position: 'absolute', top: 0, left: -2, width: 6, height: 4, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,220,100,0.4) 0%, transparent 70%)' }}/>
          </div>
        );
      })}

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

      {/* Animated speed lines */}
      {numSpeedLines > 0 && Array.from({ length: numSpeedLines }).map((_, i) => {
        const y = 55 + (i * 12) + (i % 2 ? 5 : 0);
        return (
          <div key={`sl${i}`} style={{
            position: 'absolute', top: y, left: 0, right: '40%', height: 1.5,
            background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,${0.08 + speed * 0.01}) 30%, transparent 100%)`,
            animation: `speedLine ${0.4 - speed * 0.02}s linear infinite`,
            animationDelay: `${i * 0.05}s`,
          }}/>
        );
      })}

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
        <div style={{
          animation: bounceDuration > 0 ? `carBounce ${bounceDuration}s ease-in-out infinite` : 'none',
          transform: `rotate(${tilt}deg)`,
          transition: 'transform 0.3s ease-out',
          transformOrigin: 'center bottom',
        }}>
          <CarSVG color={carColor} stripe={carStripe} size={80} animating={speed > 5} shape={carShape}/>
        </div>

        {/* SVG Smoke exhaust particles */}
        {speed > 4 && (
          <div style={{ position: 'absolute', left: -6, top: '50%', width: 20, height: 20, pointerEvents: 'none' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                position: 'absolute',
                width: 6 + i * 2, height: 6 + i * 2,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(180,180,200,0.3) 0%, transparent 70%)',
                animation: `smoke ${0.6 + i * 0.15}s ease-out infinite`,
                animationDelay: `${i * 0.18}s`,
              }}/>
            ))}
          </div>
        )}

        {/* Fire trail for streaks >= 3 */}
        {streak >= 3 && (
          <div style={{ position: 'absolute', left: -14, top: '45%', width: 20, height: 20, pointerEvents: 'none' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                position: 'absolute',
                width: 5 + i, height: 8 + i * 2,
                borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                background: `radial-gradient(ellipse, ${i < 2 ? '#ff6600' : '#ffdd00'} 0%, transparent 70%)`,
                animation: `fireTrail ${0.3 + i * 0.08}s ease-out infinite`,
                animationDelay: `${i * 0.07}s`,
                opacity: 0.8,
              }}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────

export default function TurboMathRacers() {
  const [screen, setScreen] = useState("loading");
  const [transitioning, setTransitioning] = useState(false);
  const transitionTo = (target) => {
    setTransitioning(true);
    setTimeout(() => { setScreen(target); setTransitioning(false); }, 200);
  };
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

  // League system
  const [levelData, setLevelData] = useState({ wins: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } });
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [selectedLeague, setSelectedLeague] = useState(1);

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
  const selectedLeagueRef = useRef(1);

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
    setSelectedLevel(lc.gear);
    setSelectedLeague(lc.level);
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

  const unlockedLeagues = getUnlockedLeagues(levelData);

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
    // Use selectedLevel to filter tiers for question pool
    const tiersForRace = unlockedTiers.filter(t => t <= selectedLevel);
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
    saveToStorage("tmr_last_combo", { gear: selectedLevel, level: selectedLeague });

    // Initialize opponent
    champProgressRef.current = 0;
    setChampProgress(0);
    champFinishedRef.current = false;
    setChampFinished(false);
    champSpeedMultiplierRef.current = 1;
    setRaceResult(null);
    selectedLeagueRef.current = selectedLeague;
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
        const level = LEAGUES.find(l => l.id === selectedLeagueRef.current);
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

        // Update league wins on player win
        if (playerWon) {
          const newLd = {
            ...levelData,
            wins: { ...levelData.wins, [String(selectedLeague)]: (levelData.wins[String(selectedLeague)] || 0) + 1 }
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

  const wrapStyle = { opacity: transitioning ? 0 : 1, transform: transitioning ? 'translateY(8px)' : 'translateY(0)', transition: 'opacity 0.2s, transform 0.2s' };

  if (screen === "home") return <div style={wrapStyle}><HomeScreen playerData={playerData} unlockedTiers={unlockedTiers} unlockedCars={unlockedCars} selectedCarId={selectedCarId} selectCar={selectCar} activeCar={activeCar} onPreRace={() => transitionTo("prerace")} onDashboard={() => transitionTo("dashboard")} muted={muted} toggleMute={toggleMute}/></div>;
  if (screen === "prerace") return <div style={wrapStyle}><PreRaceScreen unlockedTiers={unlockedTiers} unlockedLeagues={unlockedLeagues} selectedLevel={selectedLevel} setSelectedLevel={setSelectedLevel} selectedLeague={selectedLeague} setSelectedLeague={setSelectedLeague} levelData={levelData} activeCar={activeCar} onStart={startRace} onBack={() => transitionTo("home")}/></div>;
  if (screen === "race") return <RaceScreen q={questions[qIndex]} choices={choices} qIndex={qIndex} feedback={feedback} choiceAnim={choiceAnim} raceProgress={raceProgress} speed={speed} streak={streak} sessionStats={sessionStats} activeCar={activeCar} onAnswer={handleAnswer} champProgress={champProgress} champFinished={champFinished} paused={paused} onPause={handlePause} selectedLeague={selectedLeague}/>;
  if (screen === "results") return <div style={wrapStyle}><ResultsScreen sessionStats={sessionStats} playerData={playerData} factData={factData} onHome={() => transitionTo("home")} onPreRace={() => transitionTo("prerace")} activeCar={activeCar} raceResult={raceResult} selectedLeague={selectedLeague} levelData={levelData} unlockedLeagues={unlockedLeagues}/></div>;
  if (screen === "dashboard") return <div style={wrapStyle}><DashboardScreen playerData={playerData} factData={factData} unlockedTiers={unlockedTiers} onBack={() => transitionTo("home")} levelData={levelData}/></div>;
  return null;
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────

function HomeScreen({ playerData, unlockedTiers, unlockedCars, selectedCarId, selectCar, activeCar, onPreRace, onDashboard, muted, toggleMute }) {
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
          <div style={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 24, letterSpacing: 3, color: '#ff3d00', marginTop: -8 }}>MATH RACERS</div>
          <div style={S.coinChip}>{"\uD83E\uDE99"} {playerData?.coins || 0} COINS</div>
        </div>

        {/* Car showcase */}
        <div style={{ background: 'rgba(13,13,26,0.7)', backdropFilter: 'blur(10px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', padding: '16px 0 8px', textAlign: 'center', margin: '12px 0', cursor: 'pointer' }}
          onClick={() => { setRevving(r => !r); SFX.init(); SFX.play('rev'); }}>
          <CarSVG color={activeCar.color} stripe={activeCar.stripe} size={130} animating={revving} shape={activeCar.shape}/>
          <div style={{ color: '#666', fontSize: 14, letterSpacing: 1.5, marginTop: 6, fontWeight: 800 }}>{activeCar.name.toUpperCase()}</div>
          <div style={{ color: '#444', fontSize: 12, marginTop: 2 }}>tap to rev {"\uD83D\uDD25"}</div>
        </div>

        {/* Car picker — always show all cars, locked ones dimmed with SVG preview */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          {CARS.map(car => {
            const locked = !unlockedCars.includes(car.id);
            const sel = selectedCarId === car.id;
            return (
              <button key={car.id} onClick={() => { if (!locked) { selectCar(car.id); SFX.init(); SFX.play('tap'); } }}
                style={{ background: sel ? `${car.color}22` : '#0d0d1a', border: `2px solid ${sel ? car.color : locked ? '#1a1a1a' : '#333'}`, borderRadius: 12, padding: '6px 8px 4px', cursor: locked ? 'not-allowed' : 'pointer', color: sel ? car.color : locked ? '#555' : '#999', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11, lineHeight: 1.3, textAlign: 'center', minWidth: 72, position: 'relative', transition: 'all 0.15s' }}>
                <div style={{ filter: locked ? 'grayscale(0.7) brightness(0.5)' : 'none', transition: 'filter 0.2s' }}>
                  <CarSVG color={car.color} stripe={car.stripe} size={55} shape={car.shape}/>
                </div>
                <div style={{ marginTop: 2 }}>{car.name.split(' ')[0]}</div>
                {locked && (
                  <div style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,0.75)', borderRadius: 6, padding: '1px 5px', fontSize: 10, color: '#ffdd00', fontWeight: 900 }}>
                    {"\uD83D\uDD12"} {car.unlockCoins}{"\uD83E\uDE99"}
                  </div>
                )}
                {sel && (
                  <div style={{ position: 'absolute', top: 3, left: 3, background: car.color, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#000', fontWeight: 900 }}>{"\u2713"}</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Level status (passive display, not interactive) */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 1, textAlign: 'center', marginBottom: 6 }}>UNLOCKED LEVELS</div>
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
          <div style={{ color: '#444', fontSize: 10, textAlign: 'center', marginTop: 4 }}>Choose level in Race Setup</div>
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

function PreRaceScreen({ unlockedTiers, unlockedLeagues, selectedLevel, setSelectedLevel, selectedLeague, setSelectedLeague, levelData, activeCar, onStart, onBack }) {
  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <button onClick={onBack} style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: '8px 16px', color: '#aaa', cursor: 'pointer', fontWeight: 800, fontSize: 15, fontFamily: 'Nunito, sans-serif' }}>{"\u2190"} Back</button>
          <div style={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 32, color: '#ffdd00', letterSpacing: 1 }}>RACE SETUP</div>
        </div>

        {/* Gear selection */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#888', fontSize: 13, fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>SELECT LEVEL</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {TIERS.map(tier => {
              const on = unlockedTiers.includes(tier.id);
              const sel = selectedLevel === tier.id;
              return (
                <button key={tier.id} onClick={() => on && setSelectedLevel(tier.id)}
                  style={{ background: sel ? tier.color + '22' : '#0d0d0d', border: `2px solid ${sel ? tier.color : on ? tier.color + '44' : '#222'}`, borderRadius: 10, padding: '8px 12px', color: on ? (sel ? tier.color : tier.color + 'aa') : '#444', fontSize: 13, fontWeight: 800, textAlign: 'center', minWidth: 60, cursor: on ? 'pointer' : 'not-allowed', opacity: on ? 1 : 0.4, fontFamily: 'Nunito, sans-serif', transition: 'all 0.15s' }}>
                  {on ? "\u26A1" : "\uD83D\uDD12"} {tier.name}
                  <div style={{ fontSize: 11, marginTop: 1 }}>{on ? tier.label : `${tier.unlockCoins}\uD83E\uDE99`}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* League selection */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#888', fontSize: 13, fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>SELECT LEAGUE</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {LEAGUES.map((league, i) => {
              const on = unlockedLeagues.includes(league.id);
              const sel = selectedLeague === league.id;
              const winsAtThis = levelData.wins[String(league.id)] || 0;
              const prevLeague = i > 0 ? LEAGUES[i - 1] : null;
              const winsAtPrev = prevLeague ? (levelData.wins[String(prevLeague.id)] || 0) : 0;
              const winsNeeded = prevLeague ? Math.max(0, league.winsToUnlock - winsAtPrev) : 0;
              return (
                <button key={league.id} onClick={() => on && setSelectedLeague(league.id)}
                  style={{ background: sel ? league.color + '22' : '#0d0d0d', border: `2px solid ${sel ? league.color : on ? league.color + '44' : '#222'}`, borderRadius: 10, padding: '8px 12px', color: on ? (sel ? league.color : league.color + 'aa') : '#444', fontSize: 13, fontWeight: 800, textAlign: 'center', minWidth: 60, cursor: on ? 'pointer' : 'not-allowed', opacity: on ? 1 : 0.4, fontFamily: 'Nunito, sans-serif', transition: 'all 0.15s' }}>
                  {on ? `Lv${league.id}` : "\uD83D\uDD12"} {league.name}
                  <div style={{ fontSize: 11, marginTop: 1 }}>
                    {on ? `${winsAtThis} win${winsAtThis !== 1 ? 's' : ''}` : `${winsNeeded} more win${winsNeeded !== 1 ? 's' : ''}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Champ preview */}
        {(() => { const cc = getChampCar(selectedLeague); return (
        <div style={{ background: 'rgba(13,13,26,0.7)', backdropFilter: 'blur(10px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', padding: '16px 0 12px', textAlign: 'center', margin: '8px 0 16px' }}>
          <div style={{ color: '#888', fontSize: 12, fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>YOUR OPPONENT</div>
          <CarSVG color={cc.color} stripe={cc.stripe} size={100} animating={true} shape={cc.shape}/>
          <div style={{ color: '#ffd700', fontSize: 16, fontWeight: 900, letterSpacing: 1, marginTop: 6 }}>{cc.name.toUpperCase()}</div>
          <div style={{ color: '#666', fontSize: 13, marginTop: 2 }}>
            {LEAGUES.find(l => l.id === selectedLeague)?.name || 'Rookie'} League
          </div>
        </div>
        ); })()}

        {/* vs preview */}
        {(() => { const cc = getChampCar(selectedLeague); return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <CarSVG color={activeCar.color} stripe={activeCar.stripe} size={60} shape={activeCar.shape}/>
            <div style={{ color: '#aaa', fontSize: 11, fontWeight: 800, marginTop: 2 }}>YOU</div>
          </div>
          <div style={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 28, color: '#ff3d00' }}>VS</div>
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

function RaceScreen({ q, choices, qIndex, feedback, choiceAnim, raceProgress, speed, streak, sessionStats, activeCar, onAnswer, champProgress, champFinished, paused, onPause, selectedLeague }) {
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
            <div style={{ color: '#666', fontSize: 11, letterSpacing: 1, fontWeight: 800 }}>QUESTION</div>
            <div style={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 26, color: '#fff' }}>{qIndex + 1} / {QUESTIONS_PER_RACE}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <div style={{ background: '#ffdd0011', border: '1.5px solid #ffdd0044', borderRadius: 10, padding: '6px 12px', textAlign: 'right' }}>
              <div style={{ color: '#ffdd00', fontSize: 13, fontWeight: 800 }}>COINS</div>
              <div style={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 24, color: '#ffdd00' }}>{"\uD83E\uDE99"}{sessionStats.coins}</div>
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
        {champFinished && (() => { const cc = getChampCar(selectedLeague); return (
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <span style={{ background: `linear-gradient(90deg, ${cc.color}, ${cc.stripe})`, color: '#fff', borderRadius: 20, padding: '3px 16px', fontSize: 13, fontWeight: 900, letterSpacing: 1, textShadow: '0 1px 3px #000' }}>
              {"\uD83C\uDFC1"} {cc.name} crossed the finish!
            </span>
          </div>
        ); })()}

        {/* Track */}
        <RaceTrack progress={raceProgress} speed={feedback === 'correct' ? 10 : speed} carColor={activeCar.color} carStripe={activeCar.stripe} carShape={activeCar.shape} champProgress={champProgress} champCar={getChampCar(selectedLeague)} paused={paused} streak={streak}/>

        {/* Question card */}
        <div style={{ background: feedback === 'correct' ? '#00e67610' : feedback === 'wrong' ? '#ff3d0010' : 'rgba(13,13,26,0.7)', backdropFilter: 'blur(10px)', border: `1.5px solid ${feedback === 'correct' ? '#00e676' : feedback === 'wrong' ? '#ff3d00' : 'rgba(255,255,255,0.06)'}`, borderRadius: 16, padding: '16px 20px', textAlign: 'center', margin: '10px 0', transition: 'all 0.2s' }}>
          <div style={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 56, letterSpacing: 1, lineHeight: 1 }}>
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
                onMouseOver={e => { if (!feedback && !paused) { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; } }}
                onMouseOut={e => { if (!feedback && !paused) { e.currentTarget.style.transform = `scale(${scale})`; e.currentTarget.style.borderColor = border === '#222' ? 'rgba(255,255,255,0.08)' : border; e.currentTarget.style.background = bg === '#111' ? 'rgba(255,255,255,0.04)' : bg; } }}
                style={{ background: bg === '#111' ? 'rgba(255,255,255,0.04)' : bg, border: `1.5px solid ${border === '#222' ? 'rgba(255,255,255,0.08)' : border}`, borderRadius: 16, padding: '22px 10px', cursor: feedback || paused ? 'default' : 'pointer', color, fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 36, letterSpacing: 1, transition: 'all 0.15s', transform: `scale(${scale})`, boxShadow: feedback && choiceAnim === idx ? (isCorrectAns ? '0 0 24px #00e67666, inset 0 0 12px #00e67622' : '0 0 24px #ff3d0044, inset 0 0 12px #ff3d0022') : 'none', minHeight: 70 }}>
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
          <div style={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 52, color: '#ffdd00', letterSpacing: 1, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>PAUSED</div>
          <div style={{ color: '#888', fontSize: 14, margin: '8px 0 24px', fontWeight: 700 }}>{getChampCar(selectedLeague).name} is still racing...</div>
          <button onClick={onPause} style={{ ...S.raceBtnBig, maxWidth: 300 }}>{"\u25B6\uFE0F"} RESUME</button>
        </div>
      )}

      <GlobalStyles/>
    </div>
  );
}

// ─── RESULTS SCREEN ──────────────────────────────────────────────────────────

function ResultsScreen({ sessionStats, playerData, factData, onHome, onPreRace, activeCar, raceResult, selectedLeague, levelData, unlockedLeagues }) {
  const accuracy = Math.round((sessionStats.correct / QUESTIONS_PER_RACE) * 100);
  const [show, setShow] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 100); }, []);

  const grade = accuracy >= 90 ? ['\uD83C\uDFC6', 'CHAMPION!', '#ffdd00'] : accuracy >= 70 ? ['\uD83E\uDD48', 'GREAT RACE!', '#00e676'] : accuracy >= 50 ? ['\uD83E\uDD49', 'GOOD JOB!', '#ff9100'] : ['\uD83D\uDCAA', 'KEEP RACING!', '#ff3d00'];

  const leagueName = LEAGUES.find(l => l.id === selectedLeague)?.name || 'Rookie';

  // Check if a new league was just unlocked
  const prevUnlockedCount = getUnlockedLeagues({ ...levelData, wins: { ...levelData.wins, [String(selectedLeague)]: Math.max(0, (levelData.wins[String(selectedLeague)] || 0) - (raceResult === 'win' ? 1 : 0)) } }).length;
  const newLeagueUnlocked = raceResult === 'win' && unlockedLeagues.length > prevUnlockedCount;
  const newlyUnlockedLeague = newLeagueUnlocked ? LEAGUES.find(l => l.id === unlockedLeagues[unlockedLeagues.length - 1]) : null;

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {/* Win/Loss headline */}
        <div style={{ textAlign: 'center', padding: '12px 0 4px', opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(20px)', transition: 'all 0.4s' }}>
          {raceResult === 'win' ? (
            <>
              <div style={{ fontSize: 48, animation: 'bounce 0.5s ease' }}>{"\uD83C\uDFC1"}</div>
              <div style={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 42, color: '#ffd700', letterSpacing: 1, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>YOU WIN!</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 48, animation: 'bounce 0.5s ease' }}>{"\uD83C\uDFCE\uFE0F"}</div>
              <div style={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 36, color: getChampCar(selectedLeague).stripe, letterSpacing: 1 }}>{getChampCar(selectedLeague).name.toUpperCase()} WINS!</div>
              <div style={{ color: '#888', fontSize: 14, marginTop: 2 }}>Keep practicing — you'll get there!</div>
            </>
          )}
        </div>

        {/* Grade badge */}
        <div style={{ textAlign: 'center', padding: '4px 0', opacity: show ? 1 : 0, transition: 'all 0.4s 0.05s' }}>
          <div style={{ fontSize: 40 }}>{grade[0]}</div>
          <div style={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 28, color: grade[2], letterSpacing: 1 }}>{grade[1]}</div>
        </div>

        {/* New level unlock banner */}
        {newLeagueUnlocked && newlyUnlockedLeague && (
          <div style={{ textAlign: 'center', margin: '8px 0', opacity: show ? 1 : 0, transition: 'all 0.4s 0.1s' }}>
            <span style={{ background: `linear-gradient(90deg, ${newlyUnlockedLeague.color}44, ${newlyUnlockedLeague.color}22)`, border: `2px solid ${newlyUnlockedLeague.color}`, color: newlyUnlockedLeague.color, borderRadius: 12, padding: '8px 20px', fontSize: 16, fontWeight: 900, letterSpacing: 1 }}>
              {"\uD83D\uDD13"} NEW LEAGUE UNLOCKED: {newlyUnlockedLeague.name}!
            </span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0', opacity: show ? 1 : 0, transition: 'all 0.4s 0.1s' }}>
          <CarSVG color={activeCar.color} stripe={activeCar.stripe} size={100} animating={true} shape={activeCar.shape}/>
        </div>

        <div style={{ ...S.card, opacity: show ? 1 : 0, transition: 'all 0.4s 0.2s' }}>
          {[
            ['\uD83C\uDFCE\uFE0F Race', `${raceResult === 'win' ? 'WIN' : 'LOSS'} vs ${getChampCar(selectedLeague).name}`, raceResult === 'win' ? '#ffd700' : getChampCar(selectedLeague).stripe],
            ['\uD83C\uDFC1 League', `${leagueName} (Lv${selectedLeague})`, LEAGUES.find(l => l.id === selectedLeague)?.color || '#888'],
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
  const dashUnlockedLevels = getUnlockedLeagues(levelData);

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
          <div style={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 32, color: '#ffdd00', letterSpacing: 1 }}>STATS</div>
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
          <div style={{ color: '#888', fontSize: 13, fontWeight: 800, letterSpacing: 1, marginBottom: 4 }}>LEVEL PROGRESS</div>
          {LEAGUES.map((level, i) => {
            const on = dashUnlockedLevels.includes(level.id);
            const wins = levelData.wins[String(level.id)] || 0;
            const nextLevel = LEAGUES[i + 1];
            const winsNeeded = nextLevel ? nextLevel.winsToUnlock : null;
            const isMaxed = winsNeeded !== null && wins >= winsNeeded;
            return (
              <div key={level.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < LEAGUES.length - 1 ? '1px solid #111' : 'none' }}>
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
  page: { minHeight: '100vh', background: 'linear-gradient(160deg, #080812 0%, #0a0a1e 60%, #080812 100%)', backgroundSize: '200% 200%', animation: 'bgShift 20s ease-in-out infinite', display: 'flex', justifyContent: 'center', fontFamily: "'Nunito', sans-serif", color: '#fff' },
  wrap: { width: '100%', maxWidth: 430, padding: '16px 14px 36px' },
  bigTitle: { fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 48, letterSpacing: 1, color: '#ffdd00', textShadow: '0 2px 8px rgba(0,0,0,0.5)', lineHeight: 1 },
  coinChip: { display: 'inline-block', background: 'rgba(255,221,0,0.08)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,221,0,0.2)', color: '#ffdd00', borderRadius: 20, padding: '5px 18px', fontSize: 16, fontWeight: 900, marginTop: 8 },
  raceBtnBig: { width: '100%', padding: '18px 0', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #e63600, #ff7a1a)', color: '#fff', fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 22, letterSpacing: 1.5, boxShadow: '0 4px 20px rgba(230,54,0,0.3)', transition: 'transform 0.15s, box-shadow 0.15s' },
  card: { background: 'rgba(13,13,26,0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 18px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.3)' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 },
  pill: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '6px 16px', fontSize: 14, color: '#888', fontWeight: 800 },
};

function GlobalStyles() {
  return (
    <style>{`
      button:active { transform: scale(0.97) !important; }
      @keyframes bounce { 0%{transform:scale(0.5)} 60%{transform:scale(1.2)} 100%{transform:scale(1)} }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      @keyframes wheelSpin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
      @keyframes carBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-1.5px)} }
      @keyframes smoke { 0%{opacity:0.4;transform:scale(0.5) translateX(0)} 100%{opacity:0;transform:scale(2) translateX(-12px)} }
      @keyframes fireTrail { 0%{opacity:0.8;transform:scale(1) translateX(0)} 50%{opacity:0.6;transform:scale(1.3) translateX(-4px)} 100%{opacity:0;transform:scale(0.5) translateX(-10px)} }
      @keyframes speedLine { 0%{transform:translateX(0);opacity:0.3} 100%{transform:translateX(-100px);opacity:0} }
      @keyframes bgShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
      /* wheel spin applied via inline style on SVG <g> elements */
    `}</style>
  );
}
