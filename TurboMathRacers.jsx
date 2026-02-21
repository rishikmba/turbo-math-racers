import { useState, useEffect, useRef } from "react";

// Load Google Fonts
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Bangers&family=Nunito:wght@700;800;900&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const TIERS = [
  { id: 1, name: "GEAR 1", tables: [2, 5, 10], color: "#00e676", label: "×2, ×5, ×10", unlockCoins: 0   },
  { id: 2, name: "GEAR 2", tables: [3, 4],     color: "#ffdd00", label: "×3, ×4",       unlockCoins: 20  },
  { id: 3, name: "GEAR 3", tables: [6, 9],     color: "#ff9100", label: "×6, ×9",       unlockCoins: 50  },
  { id: 4, name: "GEAR 4", tables: [7, 8],     color: "#ff3d00", label: "×7, ×8",       unlockCoins: 90  },
  { id: 5, name: "GEAR 5", tables: [11, 12],   color: "#d500f9", label: "×11, ×12",     unlockCoins: 140 },
];

const CARS = [
  { id: 1, name: "Red Rocket",   color: "#cc2200", stripe: "#ff6644", unlockCoins: 0   },
  { id: 2, name: "Blue Bolt",    color: "#1155cc", stripe: "#55aaff", unlockCoins: 30  },
  { id: 3, name: "Green Ghost",  color: "#116622", stripe: "#44ee88", unlockCoins: 75  },
  { id: 4, name: "Gold Chaser",  color: "#aa6600", stripe: "#ffee22", unlockCoins: 130 },
  { id: 5, name: "Purple Storm", color: "#660088", stripe: "#dd66ff", unlockCoins: 200 },
];

const QUESTIONS_PER_RACE = 12;
const MASTERY_THRESHOLD = 4;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

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

// ─── CAR SVG ─────────────────────────────────────────────────────────────────

function CarSVG({ color, stripe, size = 80, animating = false, flip = false }) {
  return (
    <svg width={size} height={size * 0.55} viewBox="0 0 120 66" fill="none"
      style={{
        filter: animating ? `drop-shadow(0 0 10px ${color}) drop-shadow(0 0 20px ${color}88)` : `drop-shadow(2px 2px 6px #00000099)`,
        transition: 'filter 0.3s', transform: flip ? 'scaleX(-1)' : 'none',
      }}>
      <path d="M10 44 Q12 28 30 22 L50 16 Q60 14 70 16 L90 22 Q108 28 110 44 L110 52 Q110 58 104 58 L16 58 Q10 58 10 52 Z" fill={color}/>
      <path d="M35 22 L42 10 Q52 6 68 10 L78 22 Z" fill={stripe}/>
      <path d="M38 22 L44 12 Q52 8.5 68 12 L74 22 Z" fill="#aaddff" opacity="0.75"/>
      <circle cx="32" cy="57" r="9" fill="#111"/>
      <circle cx="32" cy="57" r="6" fill="#333"/>
      <circle cx="32" cy="57" r="2.5" fill="#666"/>
      <circle cx="88" cy="57" r="9" fill="#111"/>
      <circle cx="88" cy="57" r="6" fill="#333"/>
      <circle cx="88" cy="57" r="2.5" fill="#666"/>
      <path d="M44 43 L76 43 L74 52 L46 52 Z" fill={stripe} opacity="0.5"/>
      <ellipse cx="108" cy="40" rx="4" ry="3" fill="#ffff99" opacity="0.9"/>
      <ellipse cx="108" cy="46" rx="3" ry="2.5" fill="#ffff99" opacity="0.7"/>
      <rect x="7" y="45" width="8" height="4" rx="2" fill="#333"/>
    </svg>
  );
}

// ─── RACE TRACK ──────────────────────────────────────────────────────────────

function RaceTrack({ progress, speed, carColor, carStripe }) {
  const frameRef = useRef(0);
  const [lineOffset, setLineOffset] = useState(0);
  useEffect(() => {
    let raf;
    const animate = () => {
      setLineOffset(prev => (prev + (speed * 0.3)) % 11);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  return (
    <div style={{ position: 'relative', width: '100%', height: 112, overflow: 'hidden', background: '#0a0a1a', borderRadius: 16, border: '2px solid #222' }}>
      {/* Sky */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 45, background: 'linear-gradient(180deg, #050510 0%, #0a0a2a 100%)' }}/>
      {/* Stars */}
      {[15, 40, 70, 90, 110, 200, 280, 340].map((x, i) => (
        <div key={i} style={{ position: 'absolute', top: 4 + (i % 3) * 8, left: x, width: 2, height: 2, borderRadius: '50%', background: '#fff', opacity: 0.5 }}/>
      ))}
      {/* Road */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 67, background: 'linear-gradient(180deg, #1a1a1a 0%, #2d2d2d 100%)' }}/>
      {/* Road edge lines */}
      <div style={{ position: 'absolute', bottom: 62, left: 0, right: 0, height: 3, background: '#ffdd0088' }}/>
      <div style={{ position: 'absolute', bottom: 2, left: 0, right: 0, height: 3, background: '#ffdd0088' }}/>
      {/* Dashed center line */}
      <div style={{ position: 'absolute', bottom: 30, left: 0, right: 0, height: 5, overflow: 'hidden' }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${(i * 11 + lineOffset) % 110 - 2}%`,
            width: '7%', height: '100%', background: '#fff', opacity: 0.5, borderRadius: 2,
          }}/>
        ))}
      </div>
      {/* Finish line */}
      <div style={{ position: 'absolute', right: 14, bottom: 0, width: 14, height: 67,
        background: 'repeating-conic-gradient(#fff 0% 25%, #000 0% 50%) 0 0 / 7px 7px', opacity: 0.85 }}/>
      {/* Speed blur lines */}
      {speed > 5 && [10, 26, 40].map((y, i) => (
        <div key={i} style={{
          position: 'absolute', top: y, left: 0, right: 0, height: 1.5,
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) ${progress * 0.8}%, transparent 100%)`,
        }}/>
      ))}
      {/* Car */}
      <div style={{
        position: 'absolute', bottom: 13,
        left: `calc(${Math.min(progress, 82)}% - 40px)`,
        transition: 'left 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      }}>
        <CarSVG color={carColor} stripe={carStripe} size={80} animating={speed > 5}/>
        {/* Exhaust puffs */}
        {speed > 6 && (
          <div style={{ position: 'absolute', left: -8, top: '60%', fontSize: 10, opacity: 0.5, animation: 'puff 0.5s infinite' }}>💨</div>
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

  async function loadData() {
    try {
      const pd = await window.storage.get("tmr_player");
      const fd = await window.storage.get("tmr_facts");
      const sc = await window.storage.get("tmr_car");
      if (pd) setPlayerData(JSON.parse(pd.value));
      else setPlayerData({ coins: 0, totalRaces: 0, totalCorrect: 0, totalWrong: 0 });
      if (fd) { setFactData(JSON.parse(fd.value)); setLocalFactData(JSON.parse(fd.value)); }
      if (sc) setSelectedCarId(JSON.parse(sc.value));
    } catch {
      setPlayerData({ coins: 0, totalRaces: 0, totalCorrect: 0, totalWrong: 0 });
    }
    setScreen("home");
  }

  async function saveData(pd, fd) {
    try {
      await window.storage.set("tmr_player", JSON.stringify(pd));
      await window.storage.set("tmr_facts", JSON.stringify(fd));
      await window.storage.set("tmr_car", JSON.stringify(selectedCarId));
    } catch {}
  }

  useEffect(() => { loadData(); }, []);

  const unlockedTiers = playerData ? getUnlockedTiers(playerData.coins) : [1];
  const unlockedCars = playerData ? getUnlockedCars(playerData.coins) : [1];
  const activeCar = CARS.find(c => c.id === selectedCarId) || CARS[0];

  function selectCar(id) {
    setSelectedCarId(id);
    window.storage.set("tmr_car", JSON.stringify(id)).catch(() => {});
  }

  function buildChoicesFor(q) {
    const correct = q.a * q.b;
    const wrongs = generateWrongAnswers(correct, q.a, q.b);
    const all = [correct, ...wrongs].sort(() => Math.random() - 0.5);
    setChoices(all);
  }

  function startRace() {
    const qs = selectQuestions(factData, unlockedTiers);
    setQuestions(qs);
    setQIndex(0);
    setRaceProgress(0);
    setSpeed(2);
    setStreak(0);
    setSessionStats({ correct: 0, wrong: 0, coins: 0, wrongFacts: [] });
    setFeedback(null);
    setChoiceAnim(null);
    setLocalFactData({ ...factData });
    buildChoicesFor(qs[0]);
    setScreen("race");
  }

  function handleAnswer(chosen, idx) {
    if (feedback) return;
    const q = questions[qIndex];
    const correct = q.a * q.b;
    const isCorrect = chosen === correct;
    setChoiceAnim(idx);
    setFeedback(isCorrect ? "correct" : "wrong");

    const key = getFactKey(q.a, q.b);
    const cur = localFactData[key] || { bucket: 0, correct: 0, wrong: 0 };
    const newBucket = isCorrect ? Math.min(5, cur.bucket + 1) : 0;
    const newFd = { ...localFactData, [key]: { bucket: newBucket, correct: cur.correct + (isCorrect ? 1 : 0), wrong: cur.wrong + (isCorrect ? 0 : 1), lastSeen: Date.now() } };
    setLocalFactData(newFd);

    const newStreak = isCorrect ? streak + 1 : 0;
    setStreak(newStreak);
    const coinsEarned = isCorrect ? (newStreak >= 3 ? 2 : 1) : 0;
    const progressStep = 100 / QUESTIONS_PER_RACE;
    const newProgress = raceProgress + (isCorrect ? progressStep : progressStep * 0.25);
    const newSpeed = isCorrect ? Math.min(10, speed + 1.5) : Math.max(1, speed - 1);
    setRaceProgress(Math.min(95, newProgress));
    setSpeed(newSpeed);

    setSessionStats(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1),
      coins: prev.coins + coinsEarned,
      wrongFacts: isCorrect ? prev.wrongFacts : [...prev.wrongFacts, `${q.a} × ${q.b} = ${correct}`],
    }));

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setFeedback(null);
      setChoiceAnim(null);
      const nextIdx = qIndex + 1;
      if (nextIdx >= QUESTIONS_PER_RACE) {
        setRaceProgress(100);
        const finalSessionCoins = sessionStats.coins + coinsEarned;
        const newPd = { ...playerData, coins: playerData.coins + finalSessionCoins, totalRaces: playerData.totalRaces + 1, totalCorrect: playerData.totalCorrect + sessionStats.correct + (isCorrect ? 1 : 0), totalWrong: playerData.totalWrong + sessionStats.wrong + (isCorrect ? 0 : 1) };
        setPlayerData(newPd);
        setFactData(newFd);
        saveData(newPd, newFd);
        setTimeout(() => setScreen("results"), 400);
      } else {
        setQIndex(nextIdx);
        buildChoicesFor(questions[nextIdx]);
      }
    }, isCorrect ? 550 : 1500);
  }

  if (screen === "loading") return (
    <div style={S.page}><div style={{ margin: 'auto', textAlign: 'center' }}>
      <div style={{ ...S.bigTitle, animation: 'pulse 1s infinite' }}>🏎️</div>
      <div style={S.bigTitle}>Loading...</div>
    </div></div>
  );

  if (screen === "home") return <HomeScreen playerData={playerData} unlockedTiers={unlockedTiers} unlockedCars={unlockedCars} selectedCarId={selectedCarId} selectCar={selectCar} activeCar={activeCar} onRace={startRace} onDashboard={() => setScreen("dashboard")}/>;
  if (screen === "race") return <RaceScreen q={questions[qIndex]} choices={choices} qIndex={qIndex} feedback={feedback} choiceAnim={choiceAnim} raceProgress={raceProgress} speed={speed} streak={streak} sessionStats={sessionStats} activeCar={activeCar} onAnswer={handleAnswer}/>;
  if (screen === "results") return <ResultsScreen sessionStats={sessionStats} playerData={playerData} factData={factData} onHome={() => setScreen("home")} onRace={startRace} activeCar={activeCar}/>;
  if (screen === "dashboard") return <DashboardScreen playerData={playerData} factData={factData} unlockedTiers={unlockedTiers} onBack={() => setScreen("home")}/>;
  return null;
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────

function HomeScreen({ playerData, unlockedTiers, unlockedCars, selectedCarId, selectCar, activeCar, onRace, onDashboard }) {
  const [revving, setRevving] = useState(false);
  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <div style={S.bigTitle}>TURBO</div>
          <div style={{ fontFamily: 'Bangers, cursive', fontSize: 20, letterSpacing: 10, color: '#ff3d00', marginTop: -8 }}>MATH RACERS</div>
          <div style={S.coinChip}>🪙 {playerData?.coins || 0} COINS</div>
        </div>

        {/* Car showcase */}
        <div style={{ background: '#0d0d1a', borderRadius: 16, border: '1px solid #1a1a3a', padding: '16px 0 8px', textAlign: 'center', margin: '12px 0', cursor: 'pointer' }}
          onClick={() => setRevving(r => !r)}>
          <CarSVG color={activeCar.color} stripe={activeCar.stripe} size={130} animating={revving}/>
          <div style={{ color: '#666', fontSize: 11, letterSpacing: 3, marginTop: 6, fontWeight: 800 }}>{activeCar.name.toUpperCase()}</div>
          <div style={{ color: '#333', fontSize: 10, marginTop: 2 }}>tap to rev 🔥</div>
        </div>

        {/* Car picker */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          {CARS.map(car => {
            const locked = !unlockedCars.includes(car.id);
            const sel = selectedCarId === car.id;
            return (
              <button key={car.id} onClick={() => !locked && selectCar(car.id)}
                style={{ background: sel ? car.color : '#111', border: `2px solid ${sel ? car.color : locked ? '#1a1a1a' : '#333'}`, borderRadius: 10, padding: '7px 10px', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, color: sel ? '#000' : '#999', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11, lineHeight: 1.4, textAlign: 'center', minWidth: 68 }}>
                {locked ? '🔒' : ''} {car.name.split(' ')[0]}
                {locked ? <div style={{ fontSize: 9 }}>{car.unlockCoins}🪙</div> : null}
              </button>
            );
          })}
        </div>

        {/* Gear unlocks */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          {TIERS.map(tier => {
            const on = unlockedTiers.includes(tier.id);
            return (
              <div key={tier.id} style={{ background: on ? tier.color + '18' : '#0d0d0d', border: `1.5px solid ${on ? tier.color : '#222'}`, borderRadius: 8, padding: '5px 10px', color: on ? tier.color : '#333', fontSize: 11, fontWeight: 800, textAlign: 'center', minWidth: 60 }}>
                {on ? '⚡' : '🔒'} {tier.name}
                <div style={{ fontSize: 9, marginTop: 1 }}>{on ? tier.label : `${tier.unlockCoins}🪙`}</div>
              </div>
            );
          })}
        </div>

        <button onClick={onRace} style={S.raceBtnBig} onMouseOver={e => e.target.style.transform = 'scale(1.02)'} onMouseOut={e => e.target.style.transform = 'scale(1)'}>
          🏁 START RACE!
        </button>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 10 }}>
          <div style={S.pill}>🏎️ {playerData?.totalRaces || 0} races</div>
          <div style={S.pill}>✅ {playerData?.totalCorrect || 0} correct</div>
          <button onClick={onDashboard} style={{ ...S.pill, background: '#1a1a2e', border: '1px solid #333', cursor: 'pointer', color: '#aaa' }}>📊 Stats</button>
        </div>
      </div>
      <GlobalStyles/>
    </div>
  );
}

// ─── RACE SCREEN ─────────────────────────────────────────────────────────────

function RaceScreen({ q, choices, qIndex, feedback, choiceAnim, raceProgress, speed, streak, sessionStats, activeCar, onAnswer }) {
  if (!q) return null;
  const speedLabel = speed <= 2 ? 'SLOW' : speed <= 4 ? 'CRUISING' : speed <= 6 ? 'FAST!' : speed <= 8 ? '⚡ TURBO!' : '🔥 MAX SPEED!';
  const speedColor = speed <= 2 ? '#ff3d00' : speed <= 4 ? '#ffdd00' : speed <= 6 ? '#00e676' : speed <= 8 ? '#00b0ff' : '#e040fb';

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {/* HUD */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ background: '#0d0d1a', border: `1.5px solid ${speedColor}66`, borderRadius: 10, padding: '5px 10px' }}>
            <div style={{ color: speedColor, fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>{speedLabel}</div>
            <div style={{ display: 'flex', gap: 2, marginTop: 3 }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{ width: 5, height: 12, borderRadius: 2, background: i < speed ? speedColor : '#222', transition: 'background 0.2s' }}/>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#555', fontSize: 9, letterSpacing: 2 }}>QUESTION</div>
            <div style={{ fontFamily: 'Bangers, cursive', fontSize: 22, color: '#fff' }}>{qIndex + 1} / {QUESTIONS_PER_RACE}</div>
          </div>
          <div style={{ background: '#ffdd0011', border: '1.5px solid #ffdd0044', borderRadius: 10, padding: '5px 10px', textAlign: 'right' }}>
            <div style={{ color: '#ffdd00', fontSize: 10, fontWeight: 800 }}>COINS</div>
            <div style={{ fontFamily: 'Bangers, cursive', fontSize: 20, color: '#ffdd00' }}>🪙{sessionStats.coins}</div>
          </div>
        </div>

        {/* Streak banner */}
        {streak >= 3 && (
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <span style={{ background: 'linear-gradient(90deg, #ff6d00, #ffdd00)', color: '#000', borderRadius: 20, padding: '2px 14px', fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>
              🔥 {streak} STREAK → +2 COINS!
            </span>
          </div>
        )}

        {/* Track */}
        <RaceTrack progress={raceProgress} speed={feedback === 'correct' ? 10 : speed} carColor={activeCar.color} carStripe={activeCar.stripe}/>

        {/* Question card */}
        <div style={{ background: feedback === 'correct' ? '#00e67610' : feedback === 'wrong' ? '#ff3d0010' : '#0d0d1a', border: `2px solid ${feedback === 'correct' ? '#00e676' : feedback === 'wrong' ? '#ff3d00' : '#1a1a3a'}`, borderRadius: 16, padding: '14px 20px', textAlign: 'center', margin: '10px 0', transition: 'all 0.2s' }}>
          <div style={{ fontFamily: 'Bangers, cursive', fontSize: 56, letterSpacing: 4, lineHeight: 1 }}>
            {q.a} <span style={{ color: '#ffdd00' }}>×</span> {q.b} <span style={{ color: '#333' }}>=</span> <span style={{ color: feedback ? (feedback === 'correct' ? '#00e676' : '#ff3d00') : '#555' }}>?</span>
          </div>
          {feedback === 'wrong' && <div style={{ color: '#ff6d50', fontWeight: 900, fontSize: 15, marginTop: 2 }}>✗ The answer is <span style={{ color: '#ffaa88', fontSize: 18 }}>{q.a * q.b}</span> — you'll see this again!</div>}
          {feedback === 'correct' && <div style={{ color: '#00e676', fontWeight: 900, fontSize: 16, marginTop: 2 }}>✓ CORRECT! {streak >= 3 ? '🔥 +2 coins!' : '+1 coin!'}</div>}
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
              <button key={idx} onClick={() => onAnswer(choice, idx)} disabled={!!feedback}
                style={{ background: bg, border: `2px solid ${border}`, borderRadius: 14, padding: '20px 10px', cursor: feedback ? 'default' : 'pointer', color, fontFamily: 'Bangers, cursive', fontSize: 36, letterSpacing: 2, transition: 'all 0.15s', transform: `scale(${scale})`, boxShadow: feedback && choiceAnim === idx && isCorrectAns ? '0 0 20px #00e67644' : 'none' }}>
                {choice}
              </button>
            );
          })}
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          {Array.from({ length: QUESTIONS_PER_RACE }).map((_, i) => (
            <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', transition: 'background 0.3s', background: i < qIndex ? '#00e676' : i === qIndex ? '#ffdd00' : '#222' }}/>
          ))}
        </div>
      </div>
      <GlobalStyles/>
    </div>
  );
}

// ─── RESULTS SCREEN ──────────────────────────────────────────────────────────

function ResultsScreen({ sessionStats, playerData, factData, onHome, onRace, activeCar }) {
  const accuracy = Math.round((sessionStats.correct / QUESTIONS_PER_RACE) * 100);
  const [show, setShow] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 100); }, []);

  const grade = accuracy >= 90 ? ['🏆', 'CHAMPION!', '#ffdd00'] : accuracy >= 70 ? ['🥈', 'GREAT RACE!', '#00e676'] : accuracy >= 50 ? ['🥉', 'GOOD JOB!', '#ff9100'] : ['💪', 'KEEP RACING!', '#ff3d00'];

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ textAlign: 'center', padding: '12px 0', opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(20px)', transition: 'all 0.4s' }}>
          <div style={{ fontSize: 52, animation: 'bounce 0.5s ease' }}>{grade[0]}</div>
          <div style={{ fontFamily: 'Bangers, cursive', fontSize: 34, color: grade[2], letterSpacing: 3 }}>{grade[1]}</div>
          <div style={{ color: '#555', fontSize: 12, marginTop: 4 }}>Race Complete!</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0', opacity: show ? 1 : 0, transition: 'all 0.4s 0.1s' }}>
          <CarSVG color={activeCar.color} stripe={activeCar.stripe} size={110} animating={true}/>
        </div>

        <div style={{ ...S.card, opacity: show ? 1 : 0, transition: 'all 0.4s 0.2s' }}>
          {[['✅ Correct', `${sessionStats.correct} / ${QUESTIONS_PER_RACE}`, '#00e676'],['🎯 Accuracy', `${accuracy}%`, grade[2]],['🪙 Coins Earned', `+${sessionStats.coins}`, '#ffdd00'],['💰 Total Coins', `${playerData?.coins || 0}`, '#ffaa00']].map(([label, val, col]) => (
            <div key={label} style={S.row}>
              <span style={{ color: '#888', fontSize: 14 }}>{label}</span>
              <span style={{ color: col, fontWeight: 900, fontSize: 16 }}>{val}</span>
            </div>
          ))}
        </div>

        {sessionStats.wrongFacts.length > 0 && (
          <div style={{ ...S.card, background: '#0d0505', border: '1px solid #ff3d0033', opacity: show ? 1 : 0, transition: 'all 0.4s 0.3s' }}>
            <div style={{ color: '#ff9100', fontWeight: 800, fontSize: 12, marginBottom: 8 }}>🔁 NEEDS PRACTICE — These will come back!</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[...new Set(sessionStats.wrongFacts)].map(f => (
                <span key={f} style={{ background: '#ff3d0022', color: '#ff7755', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 800 }}>{f}</span>
              ))}
            </div>
          </div>
        )}

        <button onClick={onRace} style={{ ...S.raceBtnBig, opacity: show ? 1 : 0, transition: 'all 0.4s 0.4s', marginTop: 4 }}>🏎️ RACE AGAIN!</button>
        <button onClick={onHome} style={{ ...S.raceBtnBig, background: 'transparent', border: '2px solid #222', color: '#888', marginTop: 8, fontSize: 16, opacity: show ? 1 : 0, transition: 'all 0.4s 0.5s' }}>🏠 Garage</button>
      </div>
      <GlobalStyles/>
    </div>
  );
}

// ─── DASHBOARD SCREEN ────────────────────────────────────────────────────────

function DashboardScreen({ playerData, factData, unlockedTiers, onBack }) {
  const [tab, setTab] = useState('tables');
  const unlockedTables = TIERS.filter(t => unlockedTiers.includes(t.id)).flatMap(t => t.tables);
  const tables = [...new Set([1, ...unlockedTables])].sort((a, b) => a - b);

  const weakFacts = [];
  for (const t of tables) {
    for (let n = 1; n <= 12; n++) {
      const d = factData[getFactKey(t, n)];
      if (d && d.wrong > 0) {
        weakFacts.push({ label: `${t} × ${n} = ${t * n}`, acc: d.correct / (d.correct + d.wrong), bucket: d.bucket, wrong: d.wrong, correct: d.correct });
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
          <button onClick={onBack} style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: '7px 14px', color: '#aaa', cursor: 'pointer', fontWeight: 800, fontSize: 13, fontFamily: 'Nunito, sans-serif' }}>← Back</button>
          <div style={{ fontFamily: 'Bangers, cursive', fontSize: 28, color: '#ffdd00', letterSpacing: 3 }}>STATS</div>
        </div>

        <div style={S.card}>
          {[['🏎️ Races', playerData?.totalRaces || 0, '#aaa'],['✅ Correct', playerData?.totalCorrect || 0, '#00e676'],['❌ Wrong', playerData?.totalWrong || 0, '#ff3d00'],['🎯 Accuracy', ((playerData?.totalCorrect || 0) + (playerData?.totalWrong || 0) > 0) ? `${Math.round(playerData.totalCorrect / (playerData.totalCorrect + playerData.totalWrong) * 100)}%` : '—', '#ffdd00']].map(([l, v, c]) => (
            <div key={l} style={S.row}><span style={{ color: '#888', fontSize: 14 }}>{l}</span><span style={{ color: c, fontWeight: 900, fontSize: 16 }}>{v}</span></div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {['tables', 'weak'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 12, fontFamily: 'Nunito, sans-serif', background: tab === t ? '#ffdd00' : '#111', color: tab === t ? '#000' : '#666', letterSpacing: 1 }}>
              {t === 'tables' ? '📊 BY TABLE' : '🎯 WEAKEST'}
            </button>
          ))}
        </div>

        {tab === 'tables' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tables.map(t => {
              const st = tableStats(t);
              const tierC = TIERS.find(ti => ti.tables.includes(t))?.color || '#888';
              return (
                <div key={t} style={{ background: '#0d0d1a', borderRadius: 12, padding: '10px 14px', border: `1px solid ${tierC}22` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ color: tierC, fontWeight: 900, fontSize: 15 }}>× {t} table</span>
                    <span style={{ color: '#555', fontSize: 11 }}>{st.mastered}/12 mastered {st.acc !== null ? `· ${st.acc}%` : ''}</span>
                  </div>
                  <div style={{ background: '#111', borderRadius: 4, height: 5, marginBottom: 6 }}>
                    <div style={{ height: '100%', width: `${(st.mastered / 12) * 100}%`, background: tierC, borderRadius: 4, transition: 'width 0.8s' }}/>
                  </div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(n => {
                      const d = factData[getFactKey(t, n)];
                      const bucket = d?.bucket ?? -1;
                      const bg = bucket < 0 ? '#1a1a1a' : bucket === 0 ? '#7f0000' : bucket <= 2 ? '#7f4000' : bucket <= 3 ? '#6b5500' : '#004d20';
                      const dot = bucket < 0 ? '#333' : bucket === 0 ? '#ff5252' : bucket <= 2 ? '#ff9100' : bucket <= 3 ? '#ffdd00' : '#00e676';
                      return (
                        <div key={n} title={`${t}×${n}=${t*n} bucket:${bucket}`} style={{ background: bg, border: `1px solid ${dot}66`, borderRadius: 5, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: dot, fontWeight: 900 }}>
                          {n}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: 10, color: '#444', textAlign: 'center' }}>🔴 Missed · 🟠 Learning · 🟡 Almost · 🟢 Mastered</div>
          </div>
        )}

        {tab === 'weak' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {weakFacts.length === 0
              ? <div style={{ color: '#555', textAlign: 'center', padding: 28 }}>No missed facts yet — keep racing! 🏎️</div>
              : weakFacts.slice(0, 15).map((f, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0d0d1a', borderRadius: 10, padding: '10px 14px', border: '1px solid #1a1a2a' }}>
                  <div>
                    <span style={{ color: '#fff', fontWeight: 800 }}>{f.label}</span>
                    <span style={{ color: '#444', fontSize: 11, marginLeft: 8 }}>missed {f.wrong}×, correct {f.correct}×</span>
                  </div>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <div style={{ background: '#1a1a1a', borderRadius: 3, height: 5, width: 46 }}>
                      <div style={{ height: '100%', width: `${f.acc * 100}%`, background: f.acc < 0.5 ? '#ff3d00' : f.acc < 0.75 ? '#ffdd00' : '#00e676', borderRadius: 3 }}/>
                    </div>
                    <span style={{ fontSize: 11, color: '#666' }}>{Math.round(f.acc * 100)}%</span>
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
  bigTitle: { fontFamily: 'Bangers, cursive', fontSize: 44, letterSpacing: 5, color: '#ffdd00', textShadow: '0 0 30px rgba(255,221,0,0.4), 2px 2px 0 #000', lineHeight: 1 },
  coinChip: { display: 'inline-block', background: '#ffdd0018', border: '1.5px solid #ffdd0055', color: '#ffdd00', borderRadius: 20, padding: '4px 16px', fontSize: 14, fontWeight: 900, marginTop: 8 },
  raceBtnBig: { width: '100%', padding: '16px 0', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #cc2200, #ff6600)', color: '#fff', fontFamily: 'Bangers, cursive', fontSize: 24, letterSpacing: 3, boxShadow: '0 4px 24px rgba(200,50,0,0.35)', transition: 'transform 0.15s, box-shadow 0.15s' },
  card: { background: '#0d0d1a', border: '1px solid #1a1a2a', borderRadius: 14, padding: '10px 14px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #111', paddingBottom: 7 },
  pill: { background: '#111', border: '1px solid #1a1a1a', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: '#888', fontWeight: 800 },
};

function GlobalStyles() {
  return (
    <style>{`
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      body { margin: 0; background: #080812; }
      button:active { transform: scale(0.97) !important; }
      @keyframes bounce { 0%{transform:scale(0.5)} 60%{transform:scale(1.2)} 100%{transform:scale(1)} }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    `}</style>
  );
}
