import { useState, useEffect, useRef } from "react";

const COLORS = ["red", "yellow", "green", "blue"];
const VALUES = ["0","1","2","3","4","5","6","7","8","9","skip","reverse","draw2"];

const COLOR_MAP = {
  red:    { bg: "#E8453C", text: "#fff", border: "#C0392B" },
  yellow: { bg: "#F5C518", text: "#333", border: "#D4A017" },
  green:  { bg: "#27AE60", text: "#fff", border: "#1E8449" },
  blue:   { bg: "#2980B9", text: "#fff", border: "#1F618D" },
  wild:   { bg: "#2C2C2C", text: "#fff", border: "#111"    },
};

// ─── Deck ─────────────────────────────────────────────────────────────────────
function createDeck() {
  const deck = [];
  let id = 0;
  COLORS.forEach(color => {
    VALUES.forEach(val => {
      const count = val === "0" ? 1 : 2;
      for (let i = 0; i < count; i++) deck.push({ id: id++, color, value: val });
    });
  });
  for (let i = 0; i < 4; i++) {
    deck.push({ id: id++, color: "wild", value: "wild" });
    deck.push({ id: id++, color: "wild", value: "wild4" });
  }
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function canPlay(card, topCard, activeColor) {
  if (card.color === "wild") return true;
  if (card.color === activeColor) return true;
  if (card.value === topCard.value) return true;
  return false;
}

function calcScore(hand) {
  return hand.reduce((sum, c) => {
    if (c.value === "wild" || c.value === "wild4") return sum + 50;
    if (["skip","reverse","draw2"].includes(c.value)) return sum + 20;
    return sum + parseInt(c.value, 10);
  }, 0);
}

// ─── Bot AI ───────────────────────────────────────────────────────────────────
function botChooseCard(hand, topCard, activeColor, difficulty) {
  const playable = hand.filter(c => canPlay(c, topCard, activeColor));
  if (playable.length === 0) return null;
  if (difficulty === "easy") return playable[Math.floor(Math.random() * playable.length)];
  if (difficulty === "medium") {
    const nonWild = playable.filter(c => c.color !== "wild");
    const special = nonWild.filter(c => ["skip","reverse","draw2"].includes(c.value));
    if (special.length > 0) return special[0];
    if (nonWild.length > 0) return nonWild[0];
    return playable[0];
  }
  // hard
  const nonWild = playable.filter(c => c.color !== "wild");
  const action  = nonWild.filter(c => ["skip","reverse","draw2"].includes(c.value));
  const wild4   = playable.filter(c => c.value === "wild4");
  if (action.length > 0) return action[0];
  if (nonWild.length > 0) {
    const cnt = {};
    hand.forEach(c => { if (c.color !== "wild") cnt[c.color] = (cnt[c.color]||0)+1; });
    return nonWild.reduce((best, c) => (cnt[c.color]||0) > (cnt[best.color]||0) ? c : best, nonWild[0]);
  }
  if (wild4.length > 0) return wild4[0];
  return playable[0];
}

function botChooseColor(hand, difficulty) {
  if (difficulty === "easy") return COLORS[Math.floor(Math.random() * COLORS.length)];
  const cnt = {};
  COLORS.forEach(c => cnt[c] = 0);
  hand.forEach(c => { if (c.color !== "wild") cnt[c.color]++; });
  return Object.entries(cnt).sort((a,b) => b[1]-a[1])[0][0];
}

// ─── Game Engine ──────────────────────────────────────────────────────────────
function initGame(players) {
  let deck = shuffle(createDeck());
  const hands = players.map(() => []);
  for (let i = 0; i < 7; i++) players.forEach((_, pi) => hands[pi].push(deck.pop()));
  let top;
  do { top = deck.pop(); } while (top.color === "wild");
  return { deck, discard: [top], hands, currentPlayer: 0, direction: 1,
           activeColor: top.color, status: "playing", lastAction: "",
           unoCallable: false, unoCallBy: null };
}

function replenishDeck(s) {
  if (s.deck.length === 0 && s.discard.length > 1) {
    const top = s.discard.pop();
    s.deck = shuffle(s.discard);
    s.discard = [top];
  }
}

function applyCard(state, playerIdx, card, chosenColor) {
  const s = JSON.parse(JSON.stringify(state));
  const n = s.hands.length;

  s.hands[playerIdx] = s.hands[playerIdx].filter(c => c.id !== card.id);
  s.discard.push(card);
  s.activeColor = chosenColor || card.color;
  s.unoCallable = false;
  s.unoCallBy = null;

  if (s.hands[playerIdx].length === 0) {
    s.status = "ended";
    s.winner = playerIdx;
    return s;
  }
  if (s.hands[playerIdx].length === 1) {
    s.unoCallable = true;
    s.unoCallBy = playerIdx;
  }

  // step(from, dist) = index of player 'dist' steps away in current direction
  const step = (from, dist) => ((from + s.direction * dist) % n + n) % n;

  if (card.value === "skip") {
    // Skip next player: move 2 steps
    s.currentPlayer = step(playerIdx, 2);
    s.lastAction = "⊘ Skip !";

  } else if (card.value === "reverse") {
    s.direction *= -1;
    if (n === 2) {
      // 2-player: reverse = play again
      s.currentPlayer = playerIdx;
    } else {
      // Move 1 step in the NEW direction
      s.currentPlayer = ((playerIdx + s.direction) % n + n) % n;
    }
    s.lastAction = "⇄ Sens inversé !";

  } else if (card.value === "draw2") {
    // Next player draws 2 and is skipped
    const victim = step(playerIdx, 1);
    replenishDeck(s); if (s.deck.length) s.hands[victim].push(s.deck.pop());
    replenishDeck(s); if (s.deck.length) s.hands[victim].push(s.deck.pop());
    s.currentPlayer = step(playerIdx, 2);
    s.lastAction = "+2 !";

  } else if (card.value === "wild4") {
    // Next player draws 4 and is skipped
    const victim = step(playerIdx, 1);
    for (let i = 0; i < 4; i++) { replenishDeck(s); if (s.deck.length) s.hands[victim].push(s.deck.pop()); }
    s.currentPlayer = step(playerIdx, 2);
    s.lastAction = "+4 !";

  } else if (card.value === "wild") {
    s.currentPlayer = step(playerIdx, 1);
    s.lastAction = "🎨 Wild !";

  } else {
    s.currentPlayer = step(playerIdx, 1);
    s.lastAction = "";
  }

  return s;
}

function drawCard(state, playerIdx) {
  const s = JSON.parse(JSON.stringify(state));
  const n = s.hands.length;
  replenishDeck(s);
  if (s.deck.length) s.hands[playerIdx].push(s.deck.pop());
  s.currentPlayer = ((playerIdx + s.direction) % n + n) % n;
  s.lastAction = "Pioche";
  return s;
}

// ─── Card Component ───────────────────────────────────────────────────────────
function UnoCard({ card, onClick, small, hidden, selected, disabled }) {
  const w = small ? 38 : 62, h = small ? 56 : 92;

  if (hidden) return (
    <div style={{
      width: w, height: h, borderRadius: 9,
      background: "linear-gradient(135deg,#1a1a2e,#0f3460)",
      border: "2px solid #e94560", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 8px rgba(0,0,0,.35)",
    }}>
      <span style={{ color:"#e94560", fontWeight:800, fontSize:small?9:15, fontFamily:"'Nunito',sans-serif" }}>UNO</span>
    </div>
  );

  const c = COLOR_MAP[card.color] || COLOR_MAP.wild;
  const LABELS = { skip:"⊘", reverse:"⇄", draw2:"+2", wild:"🎨", wild4:"+4" };
  const label = LABELS[card.value] || card.value;
  const isAction = !!LABELS[card.value];

  return (
    <div onClick={() => !disabled && onClick && onClick(card)} style={{
      width: w, height: h, borderRadius: 10,
      background: c.bg, border: selected ? "3px solid #fff" : `2px solid ${c.border}`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      cursor: disabled ? "default" : onClick ? "pointer" : "default",
      flexShrink: 0, position: "relative", userSelect: "none",
      transform: selected ? "translateY(-14px)" : "none",
      transition: "transform .15s, box-shadow .15s",
      boxShadow: selected ? "0 10px 28px rgba(0,0,0,.5)" : "0 2px 8px rgba(0,0,0,.25)",
      opacity: disabled ? 0.45 : 1,
    }}>
      {card.color !== "wild" && <>
        <span style={{ position:"absolute", top:3, left:5, fontSize:small?8:11, color:c.text, fontWeight:700 }}>{label}</span>
        <span style={{ position:"absolute", bottom:3, right:5, fontSize:small?8:11, color:c.text, fontWeight:700, transform:"rotate(180deg)" }}>{label}</span>
      </>}
      <div style={{
        background:"rgba(255,255,255,.15)", borderRadius:7,
        width:small?24:38, height:small?34:56,
        display:"flex", alignItems:"center", justifyContent:"center",
        border:"1.5px solid rgba(255,255,255,.22)",
      }}>
        <span style={{ fontSize:small?(isAction?10:13):(isAction?18:24), fontWeight:800, color:c.text, fontFamily:"'Nunito',sans-serif", lineHeight:1 }}>{label}</span>
      </div>
      {card.color === "wild" && (
        <div style={{ display:"flex", gap:2, marginTop:3 }}>
          {COLORS.map(col => <div key={col} style={{ width:5, height:5, borderRadius:"50%", background:COLOR_MAP[col].bg }} />)}
        </div>
      )}
    </div>
  );
}

// ─── Color Picker ─────────────────────────────────────────────────────────────
function ColorPicker({ onPick }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>
      <div style={{ background:"#1a1a2e", borderRadius:20, padding:"32px 40px", textAlign:"center", border:"1px solid #333" }}>
        <p style={{ margin:"0 0 20px", fontWeight:700, fontSize:18, color:"#fff", fontFamily:"'Nunito',sans-serif" }}>Choisir une couleur</p>
        <div style={{ display:"flex", gap:16 }}>
          {COLORS.map(col => (
            <button key={col} onClick={() => onPick(col)} style={{
              width:60, height:60, borderRadius:12, background:COLOR_MAP[col].bg,
              border:`3px solid ${COLOR_MAP[col].border}`, cursor:"pointer", transition:"transform .15s",
            }}
              onMouseEnter={e => e.currentTarget.style.transform="scale(1.12)"}
              onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Game Screen ──────────────────────────────────────────────────────────────
function GameScreen({ players, onBack }) {
  const [gs,          setGs]         = useState(() => initGame(players));
  const [selected,    setSelected]   = useState(null);
  const [showPicker,  setShowPicker] = useState(false);
  const [pendingCard, setPending]    = useState(null);
  const [log,         setLog]        = useState([]);
  const [showUno,     setShowUno]    = useState(false);
  const botTimer = useRef(null);

  const humanIdx = players.findIndex(p => p.type === "human");
  const topCard  = gs.discard[gs.discard.length - 1];
  const isMyTurn = gs.status === "playing" && gs.currentPlayer === humanIdx;

  const addLog = msg => setLog(l => [msg, ...l].slice(0, 10));

  // Bot turns
  useEffect(() => {
    if (gs.status !== "playing") return;
    const cur = gs.currentPlayer;
    if (players[cur].type === "human") return;
    clearTimeout(botTimer.current);
    const delay = { easy:1800, medium:1300, hard:900 }[players[cur].difficulty] || 1300;
    botTimer.current = setTimeout(() => {
      setGs(prev => {
        if (prev.status !== "playing" || prev.currentPlayer !== cur) return prev;
        const top  = prev.discard[prev.discard.length - 1];
        const card = botChooseCard(prev.hands[cur], top, prev.activeColor, players[cur].difficulty);
        if (!card) {
          addLog(`${players[cur].name} pioche`);
          return drawCard(prev, cur);
        }
        const col = card.color === "wild" ? botChooseColor(prev.hands[cur], players[cur].difficulty) : null;
        addLog(`${players[cur].name} joue ${card.value}${col?" → "+col:""}`);
        return applyCard(prev, cur, card, col);
      });
    }, delay);
    return () => clearTimeout(botTimer.current);
  }, [gs.currentPlayer, gs.status]);

  // UNO button
  useEffect(() => {
    if (gs.unoCallable && gs.unoCallBy === humanIdx) {
      setShowUno(true);
      const t = setTimeout(() => setShowUno(false), 4000);
      return () => clearTimeout(t);
    }
    setShowUno(false);
  }, [gs.unoCallable, gs.unoCallBy]);

  const handleCardClick = card => {
    if (!isMyTurn || !canPlay(card, topCard, gs.activeColor)) return;
    if (selected?.id === card.id) {
      if (card.color === "wild") { setPending(card); setShowPicker(true); setSelected(null); }
      else { addLog(`Vous jouez ${card.value}`); setGs(applyCard(gs, humanIdx, card, null)); setSelected(null); }
    } else { setSelected(card); }
  };

  const handleDraw = () => {
    if (!isMyTurn) return;
    addLog("Vous piochez");
    setGs(drawCard(gs, humanIdx));
  };

  const handleColorPick = col => {
    setShowPicker(false);
    addLog(`Vous jouez ${pendingCard.value} → ${col}`);
    setGs(applyCard(gs, humanIdx, pendingCard, col));
    setPending(null);
  };

  const restart = () => { setGs(initGame(players)); setLog([]); setSelected(null); };

  if (gs.status === "ended") {
    const winner = players[gs.winner];
    return (
      <div style={{ minHeight:"100vh", background:"#0f0f1a", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Nunito',sans-serif" }}>
        <div style={{ textAlign:"center", color:"#fff" }}>
          <div style={{ fontSize:72, marginBottom:16 }}>{winner.type==="human"?"🎉":"😢"}</div>
          <h1 style={{ fontSize:42, fontWeight:800, margin:"0 0 8px", color:winner.type==="human"?"#F5C518":"#E8453C" }}>
            {winner.type==="human" ? "Victoire !" : `${winner.name} gagne !`}
          </h1>
          <p style={{ fontSize:18, color:"#666", margin:"0 0 36px" }}>
            {winner.type==="human" ? "Bien joué !" : "Meilleure chance la prochaine fois…"}
          </p>
          <div style={{ display:"flex", gap:16, justifyContent:"center" }}>
            <button onClick={restart} style={BS("primary")}>Rejouer</button>
            <button onClick={onBack}  style={BS("outline")}>Menu</button>
          </div>
        </div>
      </div>
    );
  }

  const topColor     = COLOR_MAP[gs.activeColor] || COLOR_MAP.wild;
  const opponents    = players.map((p,i) => ({...p, idx:i})).filter(p => p.idx !== humanIdx);
  const botsTop      = opponents.slice(0, Math.ceil(opponents.length / 2));
  const botsSide     = opponents.slice(Math.ceil(opponents.length / 2));

  return (
    <div style={{ minHeight:"100vh", background:"#0f0f1a", display:"flex", flexDirection:"column", fontFamily:"'Nunito',sans-serif" }}>
      {showPicker && <ColorPicker onPick={handleColorPick} />}

      {/* Top bar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 20px", borderBottom:"1px solid #1e1e2e" }}>
        <button onClick={onBack}  style={{ ...BS("outline"), flex:"none", padding:"6px 14px", fontSize:13 }}>← Menu</button>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:topColor.bg }} />
          <span style={{ color:"#888", fontSize:13 }}>
            {gs.lastAction || (isMyTurn ? "▶ Votre tour" : `Tour de ${players[gs.currentPlayer].name}`)}
          </span>
          <span style={{ color:"#333", fontSize:13 }}>{gs.direction===1?"↻":"↺"}</span>
        </div>
        <button onClick={restart} style={{ ...BS("outline"), flex:"none", padding:"6px 14px", fontSize:13 }}>Reset</button>
      </div>

      {/* Opponents top */}
      <div style={{ display:"flex", justifyContent:"center", gap:40, padding:"14px 0 6px" }}>
        {botsTop.map(p => (
          <div key={p.idx} style={{ textAlign:"center" }}>
            <div style={{ fontSize:12, color:p.idx===gs.currentPlayer?"#F5C518":"#555", fontWeight:p.idx===gs.currentPlayer?700:400, marginBottom:6 }}>
              {p.name} {p.idx===gs.currentPlayer?"●":""} ({gs.hands[p.idx]?.length})
            </div>
            <div style={{ display:"flex", justifyContent:"center" }}>
              {(gs.hands[p.idx]||[]).slice(0,12).map((c,ci) => (
                <div key={ci} style={{ marginLeft:ci>0?-16:0 }}><UnoCard card={c} small hidden /></div>
              ))}
              {(gs.hands[p.idx]?.length||0)>12 && <span style={{ color:"#555", fontSize:11, alignSelf:"center", marginLeft:4 }}>+{gs.hands[p.idx].length-12}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Center */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:48 }}>
        {botsSide.map(p => (
          <div key={p.idx} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
            <div style={{ fontSize:12, color:p.idx===gs.currentPlayer?"#F5C518":"#555", fontWeight:p.idx===gs.currentPlayer?700:400 }}>
              {p.name} {p.idx===gs.currentPlayer?"●":""}
            </div>
            <div style={{ fontSize:11, color:"#444" }}>{gs.hands[p.idx]?.length} cartes</div>
            <div style={{ display:"flex", flexDirection:"column" }}>
              {(gs.hands[p.idx]||[]).slice(0,8).map((c,ci) => (
                <div key={ci} style={{ marginTop:ci>0?-30:0 }}><UnoCard card={c} small hidden /></div>
              ))}
            </div>
          </div>
        ))}

        {/* Draw pile */}
        <div style={{ textAlign:"center" }}>
          <div onClick={isMyTurn?handleDraw:undefined} style={{ cursor:isMyTurn?"pointer":"default" }}>
            <UnoCard card={{color:"wild",value:"wild"}} hidden disabled={!isMyTurn} />
          </div>
          <div style={{ color:"#444", fontSize:11, marginTop:4 }}>{gs.deck.length} cartes</div>
        </div>

        {/* Discard */}
        <div style={{ textAlign:"center" }}>
          <div style={{ padding:4, borderRadius:14, background:`${topColor.bg}22`, border:`2px solid ${topColor.bg}55` }}>
            <UnoCard card={topCard} />
          </div>
          <div style={{ color:topColor.bg, fontSize:11, marginTop:4, fontWeight:700 }}>{gs.activeColor.toUpperCase()}</div>
        </div>
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div style={{ padding:"4px 20px", display:"flex", gap:8, overflowX:"auto" }}>
          {log.slice(0,5).map((l,i) => (
            <span key={i} style={{ fontSize:11, color:"#333", whiteSpace:"nowrap", opacity:1-i*0.18 }}>{l}</span>
          ))}
        </div>
      )}

      {/* Player hand */}
      <div style={{ background:"#0c0c18", borderTop:"1px solid #1e1e2e", padding:"14px 20px 20px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <span style={{ color:isMyTurn?"#F5C518":"#444", fontSize:14, fontWeight:isMyTurn?700:400 }}>
            {isMyTurn?"▶ Votre tour":"Vos cartes"} — {gs.hands[humanIdx]?.length}
          </span>
          {showUno && (
            <button onClick={() => setShowUno(false)} style={{
              background:"#E8453C", color:"#fff", border:"none",
              padding:"8px 22px", borderRadius:10, fontWeight:800, fontSize:17,
              cursor:"pointer", fontFamily:"'Nunito',sans-serif",
            }}>UNO !</button>
          )}
        </div>
        <div style={{ display:"flex", gap:7, overflowX:"auto", paddingBottom:6 }}>
          {(gs.hands[humanIdx]||[]).map(card => {
            const playable = isMyTurn && canPlay(card, topCard, gs.activeColor);
            return (
              <div key={card.id} style={{ flexShrink:0 }}>
                <UnoCard card={card} onClick={playable?handleCardClick:undefined} selected={selected?.id===card.id} disabled={!playable} />
              </div>
            );
          })}
        </div>
        {selected && <div style={{ textAlign:"center", marginTop:6, color:"#555", fontSize:12 }}>Cliquez à nouveau pour jouer</div>}
      </div>
    </div>
  );
}

// ─── localStorage Room helpers ────────────────────────────────────────────────
const LS       = "uno_rooms_v2";
const getRooms = ()        => { try { return JSON.parse(localStorage.getItem(LS)||"{}"); } catch { return {}; } };
const getRoom  = code      => getRooms()[code] || null;
const putRoom  = (code, r) => { const all = getRooms(); all[code] = r; localStorage.setItem(LS, JSON.stringify(all)); };
const delRoom  = code      => { const all = getRooms(); delete all[code]; localStorage.setItem(LS, JSON.stringify(all)); };

// ─── Multiplayer Lobby ────────────────────────────────────────────────────────
function MultiplayerLobby({ onStartGame, onBack }) {
  const [view,       setView]       = useState("menu");
  const [roomCode,   setRoomCode]   = useState("");
  const [playerName, setPlayerName] = useState("");
  const [myRoom,     setMyRoom]     = useState(null);
  const [roomData,   setRoomData]   = useState(null);
  const [error,      setError]      = useState("");
  const pollRef = useRef(null);

  // Poll localStorage every second so lobby updates live across tabs
  useEffect(() => {
    if (!myRoom) return;
    const poll = () => { const r = getRoom(myRoom); if (r) setRoomData({...r}); };
    poll();
    pollRef.current = setInterval(poll, 1000);
    return () => clearInterval(pollRef.current);
  }, [myRoom]);

  const createRoom = () => {
    if (!playerName.trim()) { setError("Entrez votre nom"); return; }
    const code = Math.random().toString(36).substring(2,7).toUpperCase();
    const room = { code, host: playerName.trim(), players:[{name:playerName.trim(),type:"human"}], status:"waiting" };
    putRoom(code, room);
    setMyRoom(code); setRoomData(room); setView("room"); setError("");
  };

  const joinRoom = () => {
    if (!playerName.trim()) { setError("Entrez votre nom"); return; }
    const code = roomCode.trim().toUpperCase();
    if (!code) { setError("Entrez un code"); return; }
    const r = getRoom(code);
    if (!r)                    { setError("Salle introuvable — vérifiez le code"); return; }
    if (r.players.length >= 4) { setError("Salle pleine (4/4)"); return; }
    if (r.status !== "waiting"){ setError("Partie déjà lancée"); return; }
    if (r.players.find(p => p.name === playerName.trim())) { setError("Ce nom est déjà pris dans cette salle"); return; }
    r.players.push({name:playerName.trim(),type:"human"});
    putRoom(code, r);
    setMyRoom(code); setRoomData(r); setView("room"); setError("");
  };

  const startGame = () => {
    const r = getRoom(myRoom);
    if (!r) { setError("Salle introuvable"); return; }
    if (r.players.length < 2) { setError("Il faut au moins 2 joueurs"); return; }
    clearInterval(pollRef.current);
    delRoom(myRoom);
    onStartGame(r.players);
  };

  const leaveRoom = () => {
    clearInterval(pollRef.current);
    if (myRoom) {
      const r = getRoom(myRoom);
      if (r) {
        if (r.host === playerName.trim()) delRoom(myRoom);
        else { r.players = r.players.filter(p => p.name !== playerName.trim()); putRoom(myRoom, r); }
      }
    }
    setMyRoom(null); setRoomData(null); setView("menu"); setError("");
  };

  const room = roomData;

  if (view === "room" && room) return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:13, color:"#666", marginBottom:4 }}>Code de la salle</div>
        <div style={{ fontSize:38, fontWeight:800, letterSpacing:10, color:"#F5C518" }}>{room.code}</div>
        <div style={{ fontSize:12, color:"#555", marginTop:6, lineHeight:1.6 }}>
          Partagez ce code avec vos amis.<br/>Chacun ouvre le site dans un onglet et entre ce code.
        </div>
      </div>
      <div>
        <div style={{ fontSize:13, color:"#666", marginBottom:10 }}>Joueurs ({room.players.length}/4)</div>
        {room.players.map((p,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px", background:"#1a1a2e", borderRadius:10, marginBottom:8 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:"#27AE60" }} />
            <span style={{ color:"#fff", fontWeight:600 }}>{p.name}</span>
            {i===0 && <span style={{ marginLeft:"auto", fontSize:11, color:"#F5C518" }}>Hôte</span>}
          </div>
        ))}
      </div>
      {error && <div style={{ color:"#E8453C", fontSize:13 }}>{error}</div>}
      <div style={{ display:"flex", gap:12 }}>
        <button onClick={leaveRoom} style={BS("outline")}>Quitter</button>
        {room.host === playerName.trim() && (
          <button onClick={startGame} disabled={room.players.length < 2} style={BS("primary", room.players.length < 2)}>
            Lancer la partie
          </button>
        )}
      </div>
      {room.host !== playerName.trim() && (
        <div style={{ textAlign:"center", color:"#555", fontSize:13 }}>En attente de l'hôte…</div>
      )}
    </div>
  );

  if (view === "create") return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <h3 style={{ margin:0, color:"#fff", fontSize:20, fontWeight:700 }}>Créer une salle</h3>
      <input placeholder="Votre nom" value={playerName} onChange={e => setPlayerName(e.target.value)} style={IS} />
      {error && <div style={{ color:"#E8453C", fontSize:13 }}>{error}</div>}
      <div style={{ display:"flex", gap:12 }}>
        <button onClick={() => { setView("menu"); setError(""); }} style={BS("outline")}>Retour</button>
        <button onClick={createRoom} style={BS("primary")}>Créer</button>
      </div>
    </div>
  );

  if (view === "join") return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <h3 style={{ margin:0, color:"#fff", fontSize:20, fontWeight:700 }}>Rejoindre une salle</h3>
      <input placeholder="Votre nom" value={playerName} onChange={e => setPlayerName(e.target.value)} style={IS} />
      <input
        placeholder="Code (5 lettres)" value={roomCode}
        onChange={e => setRoomCode(e.target.value.toUpperCase())} maxLength={5}
        style={{ ...IS, letterSpacing:6, textTransform:"uppercase", textAlign:"center" }}
      />
      {error && <div style={{ color:"#E8453C", fontSize:13 }}>{error}</div>}
      <div style={{ display:"flex", gap:12 }}>
        <button onClick={() => { setView("menu"); setError(""); }} style={BS("outline")}>Retour</button>
        <button onClick={joinRoom} style={BS("primary")}>Rejoindre</button>
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <h3 style={{ margin:0, color:"#fff", fontSize:20, fontWeight:700 }}>Multijoueur</h3>
      <p style={{ margin:0, color:"#666", fontSize:14, lineHeight:1.7 }}>
        Créez une salle et partagez le code. Chaque joueur ouvre le site dans son propre onglet (même navigateur) et entre le code pour rejoindre.
      </p>
      <button onClick={() => setView("create")} style={BS("primary")}>Créer une salle</button>
      <button onClick={() => setView("join")}   style={BS("outline")}>Rejoindre une salle</button>
      <button onClick={onBack} style={{ ...BS("outline"), marginTop:8, opacity:.5 }}>← Retour</button>
    </div>
  );
}

// ─── Solo Setup ───────────────────────────────────────────────────────────────
function SoloSetup({ onStartGame, onBack }) {
  const [name,       setName]       = useState("Vous");
  const [numBots,    setNumBots]    = useState(2);
  const [difficulty, setDifficulty] = useState("medium");
  const DL = { easy:"Facile", medium:"Moyen", hard:"Difficile" };

  const start = () => {
    const botNames = ["Alice","Bob","Charlie"];
    onStartGame([
      { name: name||"Vous", type:"human" },
      ...Array.from({length:numBots},(_,i) => ({ name:botNames[i], type:"bot", difficulty })),
    ]);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:22 }}>
      <h3 style={{ margin:0, color:"#fff", fontSize:20, fontWeight:700 }}>Mode Solo</h3>
      <div>
        <label style={{ display:"block", fontSize:13, color:"#777", marginBottom:6 }}>Votre nom</label>
        <input value={name} onChange={e => setName(e.target.value)} style={IS} />
      </div>
      <div>
        <label style={{ display:"block", fontSize:13, color:"#777", marginBottom:10 }}>Nombre de bots ({numBots})</label>
        <div style={{ display:"flex", gap:8 }}>
          {[1,2,3].map(n => <button key={n} onClick={() => setNumBots(n)} style={numBots===n?BS("primary"):BS("outline")}>{n}</button>)}
        </div>
      </div>
      <div>
        <label style={{ display:"block", fontSize:13, color:"#777", marginBottom:10 }}>Difficulté</label>
        <div style={{ display:"flex", gap:8 }}>
          {["easy","medium","hard"].map(d => <button key={d} onClick={() => setDifficulty(d)} style={difficulty===d?BS("accent"):BS("outline")}>{DL[d]}</button>)}
        </div>
      </div>
      <div style={{ display:"flex", gap:12, marginTop:4 }}>
        <button onClick={onBack} style={BS("outline")}>← Retour</button>
        <button onClick={start}  style={BS("primary")}>Jouer !</button>
      </div>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const IS = {
  background:"#1a1a2e", border:"1.5px solid #2e2e4a", borderRadius:10,
  color:"#fff", padding:"12px 16px", fontSize:15,
  fontFamily:"'Nunito',sans-serif", outline:"none",
  width:"100%", boxSizing:"border-box",
};
const BS = (v, dis=false) => ({
  padding:"12px 24px", borderRadius:12, border:"none",
  cursor: dis?"not-allowed":"pointer",
  fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:15, flex:1,
  opacity: dis?0.45:1, transition:"opacity .15s",
  ...(v==="primary" ? { background:"#E8453C", color:"#fff" }
    : v==="accent"  ? { background:"#F5C518", color:"#222" }
    :                  { background:"transparent", color:"#aaa", border:"1.5px solid #2e2e4a" }),
});

// ─── Home ─────────────────────────────────────────────────────────────────────
function HomeScreen({ onNav }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
      <div style={{ marginBottom:40, textAlign:"center" }}>
        <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center",
          width:96, height:96, borderRadius:22,
          background:"linear-gradient(135deg,#E8453C,#F5C518)",
          marginBottom:18, boxShadow:"0 8px 32px rgba(232,69,60,.35)" }}>
          <span style={{ fontSize:46, fontWeight:900, color:"#fff", fontFamily:"'Nunito',sans-serif", letterSpacing:-2 }}>U</span>
        </div>
        <h1 style={{ fontSize:50, fontWeight:900, margin:0, color:"#fff", letterSpacing:-2, fontFamily:"'Nunito',sans-serif" }}>uno</h1>
        <p style={{ color:"#444", margin:"8px 0 0", fontSize:14 }}>La version épurée du classique</p>
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:44, transform:"rotate(-1.5deg)" }}>
        {[{color:"red",value:"7"},{color:"yellow",value:"skip"},{color:"blue",value:"draw2"},{color:"green",value:"reverse"},{color:"wild",value:"wild"}].map((c,i) => (
          <div key={i} style={{ transform:`rotate(${(i-2)*6}deg)` }}><UnoCard card={c} /></div>
        ))}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:12, width:"100%", maxWidth:300 }}>
        <button onClick={() => onNav("solo")} style={{
          background:"linear-gradient(135deg,#E8453C,#C0392B)", border:"none", borderRadius:16,
          padding:"18px 22px", color:"#fff", fontSize:17, fontWeight:800, cursor:"pointer",
          fontFamily:"'Nunito',sans-serif", textAlign:"left",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          boxShadow:"0 4px 20px rgba(232,69,60,.3)",
        }}>Solo vs Bots <span style={{fontSize:22}}>🤖</span></button>
        <button onClick={() => onNav("multi")} style={{
          background:"linear-gradient(135deg,#2980B9,#1a5c8a)", border:"none", borderRadius:16,
          padding:"18px 22px", color:"#fff", fontSize:17, fontWeight:800, cursor:"pointer",
          fontFamily:"'Nunito',sans-serif", textAlign:"left",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          boxShadow:"0 4px 20px rgba(41,128,185,.3)",
        }}>Multijoueur <span style={{fontSize:22}}>👥</span></button>
      </div>

      <div style={{ marginTop:36, padding:"18px 22px", background:"#0c0c18", borderRadius:14, maxWidth:360, width:"100%", border:"1px solid #1e1e2e" }}>
        <div style={{ fontSize:11, color:"#444", fontWeight:700, marginBottom:10, textTransform:"uppercase", letterSpacing:1 }}>Règles rapides</div>
        {[["⊘","Skip — saute le joueur suivant"],["⇄","Reverse — inverse le sens"],
          ["+2","Draw 2 — le suivant pioche 2"],["🎨","Wild — choisit la couleur"],["+4","Wild+4 — pioche 4 + couleur"]
        ].map(([s,d]) => (
          <div key={s} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:5 }}>
            <span style={{ fontSize:14, width:26, textAlign:"center" }}>{s}</span>
            <span style={{ color:"#555", fontSize:13 }}>{d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,  setScreen]  = useState("home");
  const [players, setPlayers] = useState(null);

  const startGame = p => { setPlayers(p); setScreen("game"); };

  if (screen === "game" && players)
    return <GameScreen players={players} onBack={() => setScreen("home")} />;

  return (
    <div style={{ minHeight:"100vh", background:"#0f0f1a", display:"flex", flexDirection:"column",
      alignItems:"center", fontFamily:"'Nunito',sans-serif", padding:"36px 20px 60px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
      <div style={{ width:"100%", maxWidth:480 }}>
        {screen==="home"  && <HomeScreen onNav={setScreen} />}
        {screen==="solo"  && <div style={{ background:"#111", borderRadius:22, padding:"28px 26px" }}><SoloSetup onStartGame={startGame} onBack={() => setScreen("home")} /></div>}
        {screen==="multi" && <div style={{ background:"#111", borderRadius:22, padding:"28px 26px" }}><MultiplayerLobby onStartGame={startGame} onBack={() => setScreen("home")} /></div>}
      </div>
    </div>
  );
}
