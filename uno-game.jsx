import { useState, useEffect, useCallback, useRef } from "react";

const COLORS = ["red", "yellow", "green", "blue"];
const VALUES = ["0","1","2","3","4","5","6","7","8","9","skip","reverse","draw2"];
const WILD_TYPES = ["wild","wild4"];

const COLOR_MAP = {
  red: { bg: "#E8453C", light: "#FDECEA", text: "#fff", border: "#C0392B" },
  yellow: { bg: "#F5C518", light: "#FFFBEA", text: "#333", border: "#D4A017" },
  green: { bg: "#27AE60", light: "#EAFAF1", text: "#fff", border: "#1E8449" },
  blue: { bg: "#2980B9", light: "#EAF4FB", text: "#fff", border: "#1F618D" },
  wild: { bg: "#2C2C2C", light: "#F5F5F5", text: "#fff", border: "#111" },
};

function createDeck() {
  const deck = [];
  let id = 0;
  COLORS.forEach(color => {
    VALUES.forEach(val => {
      const count = val === "0" ? 1 : 2;
      for (let i = 0; i < count; i++) {
        deck.push({ id: id++, color, value: val });
      }
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
  const effectiveColor = activeColor || topCard.color;
  if (card.color === "wild") return true;
  if (card.color === effectiveColor) return true;
  if (card.value === topCard.value && card.color !== "wild") return true;
  return false;
}

function calcScore(hand) {
  return hand.reduce((sum, c) => {
    if (c.value === "wild" || c.value === "wild4") return sum + 50;
    if (["skip","reverse","draw2"].includes(c.value)) return sum + 20;
    return sum + parseInt(c.value, 10);
  }, 0);
}

function botChooseCard(hand, topCard, activeColor, difficulty) {
  const playable = hand.filter(c => canPlay(c, topCard, activeColor));
  if (playable.length === 0) return null;
  if (difficulty === "easy") {
    return playable[Math.floor(Math.random() * playable.length)];
  }
  if (difficulty === "medium") {
    const nonWild = playable.filter(c => c.color !== "wild");
    const special = nonWild.filter(c => ["skip","reverse","draw2"].includes(c.value));
    if (special.length > 0) return special[0];
    if (nonWild.length > 0) return nonWild[0];
    return playable[0];
  }
  // hard
  const nonWild = playable.filter(c => c.color !== "wild");
  const actionCards = nonWild.filter(c => ["skip","reverse","draw2"].includes(c.value));
  const wild4 = playable.filter(c => c.value === "wild4");
  const wild = playable.filter(c => c.value === "wild");
  if (actionCards.length > 0) return actionCards[0];
  if (nonWild.length > 0) {
    const colorCount = {};
    hand.forEach(c => { if (c.color !== "wild") colorCount[c.color] = (colorCount[c.color]||0)+1; });
    let best = nonWild[0];
    nonWild.forEach(c => { if ((colorCount[c.color]||0) > (colorCount[best.color]||0)) best = c; });
    return best;
  }
  if (wild4.length > 0) return wild4[0];
  return wild[0];
}

function botChooseColor(hand, difficulty) {
  if (difficulty === "easy") return COLORS[Math.floor(Math.random() * COLORS.length)];
  const count = {};
  COLORS.forEach(c => count[c] = 0);
  hand.forEach(c => { if (c.color !== "wild") count[c.color]++; });
  return Object.entries(count).sort((a,b) => b[1]-a[1])[0][0];
}

// ─── Card Component ───────────────────────────────────────────────────────────
function UnoCard({ card, onClick, small, hidden, selected, disabled }) {
  if (hidden) {
    return (
      <div
        style={{
          width: small ? 36 : 56,
          height: small ? 54 : 84,
          borderRadius: 8,
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          border: "2px solid #e94560",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          cursor: disabled ? "default" : "pointer",
        }}
      >
        <span style={{ color: "#e94560", fontWeight: 700, fontSize: small ? 10 : 16, fontFamily: "'Nunito', sans-serif" }}>UNO</span>
      </div>
    );
  }

  const c = card.color === "wild" ? COLOR_MAP.wild : COLOR_MAP[card.color];
  const isAction = ["skip","reverse","draw2","wild","wild4"].includes(card.value);
  const label = {
    skip: "⊘", reverse: "⇄", draw2: "+2", wild: "🎨", wild4: "+4"
  }[card.value] || card.value;

  return (
    <div
      onClick={() => !disabled && onClick && onClick(card)}
      style={{
        width: small ? 36 : 60,
        height: small ? 54 : 90,
        borderRadius: 10,
        background: c.bg,
        border: selected ? "3px solid #fff" : `2px solid ${c.border}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : (onClick ? "pointer" : "default"),
        flexShrink: 0,
        transform: selected ? "translateY(-12px)" : "none",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        boxShadow: selected ? "0 8px 24px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.2)",
        position: "relative",
        userSelect: "none",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {card.color !== "wild" && (
        <>
          <span style={{ position: "absolute", top: 3, left: 5, fontSize: small ? 8 : 11, color: c.text, fontWeight: 700, opacity: 0.9 }}>{label}</span>
          <span style={{ position: "absolute", bottom: 3, right: 5, fontSize: small ? 8 : 11, color: c.text, fontWeight: 700, opacity: 0.9, transform: "rotate(180deg)" }}>{label}</span>
        </>
      )}
      <div style={{
        background: "rgba(255,255,255,0.15)",
        borderRadius: 8,
        width: small ? 22 : 36,
        height: small ? 32 : 54,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1.5px solid rgba(255,255,255,0.25)",
      }}>
        <span style={{
          fontSize: small ? (isAction ? 10 : 12) : (isAction ? 16 : 22),
          fontWeight: 800,
          color: c.text,
          fontFamily: "'Nunito', sans-serif",
          lineHeight: 1,
          textAlign: "center",
        }}>{label}</span>
      </div>
      {card.color === "wild" && (
        <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
          {COLORS.map(col => (
            <div key={col} style={{ width: 5, height: 5, borderRadius: "50%", background: COLOR_MAP[col].bg }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Color Picker ─────────────────────────────────────────────────────────────
function ColorPicker({ onPick }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "32px 40px", textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      }}>
        <p style={{ margin: "0 0 20px", fontWeight: 700, fontSize: 18, color: "#222", fontFamily: "'Nunito', sans-serif" }}>
          Choisir une couleur
        </p>
        <div style={{ display: "flex", gap: 16 }}>
          {COLORS.map(col => (
            <button key={col} onClick={() => onPick(col)} style={{
              width: 60, height: 60, borderRadius: 12, background: COLOR_MAP[col].bg,
              border: `3px solid ${COLOR_MAP[col].border}`, cursor: "pointer",
              transition: "transform 0.15s",
              fontFamily: "'Nunito', sans-serif",
            }}
              onMouseEnter={e => e.target.style.transform = "scale(1.1)"}
              onMouseLeave={e => e.target.style.transform = "scale(1)"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Game Engine ──────────────────────────────────────────────────────────────
function initGame(players) {
  let deck = shuffle(createDeck());
  const hands = players.map(() => []);
  for (let i = 0; i < 7; i++) {
    players.forEach((_, pi) => hands[pi].push(deck.pop()));
  }
  let top;
  do { top = deck.pop(); } while (top.color === "wild");
  return {
    deck,
    discard: [top],
    hands,
    currentPlayer: 0,
    direction: 1,
    activeColor: top.color,
    drawPending: 0,
    status: "playing",
    lastAction: "",
    scores: players.map(() => 0),
    unoCallable: false,
    unoCallBy: null,
  };
}

function nextPlayer(current, direction, count) {
  return (current + direction * count + 100) % count;
}

function applyCard(state, playerIdx, card, chosenColor) {
  const newState = JSON.parse(JSON.stringify(state));
  const n = newState.hands.length;

  newState.hands[playerIdx] = newState.hands[playerIdx].filter(c => c.id !== card.id);
  newState.discard.push(card);
  newState.activeColor = chosenColor || card.color;
  newState.unoCallable = false;
  newState.unoCallBy = null;

  if (newState.hands[playerIdx].length === 0) {
    newState.status = "ended";
    newState.winner = playerIdx;
    newState.scores = newState.hands.map(h => calcScore(h));
    return newState;
  }
  if (newState.hands[playerIdx].length === 1) {
    newState.unoCallable = true;
    newState.unoCallBy = playerIdx;
  }

  let skip = false;
  if (card.value === "skip") {
    skip = true;
    newState.lastAction = "Skip !";
  } else if (card.value === "reverse") {
    newState.direction *= -1;
    if (n === 2) skip = true;
    newState.lastAction = "Sens inversé !";
  } else if (card.value === "draw2") {
    const next = nextPlayer(playerIdx, newState.direction, n);
    for (let i = 0; i < 2; i++) {
      if (newState.deck.length === 0) newState.deck = shuffle(newState.discard.splice(0, newState.discard.length - 1));
      newState.hands[next].push(newState.deck.pop());
    }
    skip = true;
    newState.lastAction = "+2 !";
  } else if (card.value === "wild4") {
    const next = nextPlayer(playerIdx, newState.direction, n);
    for (let i = 0; i < 4; i++) {
      if (newState.deck.length === 0) newState.deck = shuffle(newState.discard.splice(0, newState.discard.length - 1));
      newState.hands[next].push(newState.deck.pop());
    }
    skip = true;
    newState.lastAction = "+4 !";
  } else if (card.value === "wild") {
    newState.lastAction = "Wild !";
  } else {
    newState.lastAction = "";
  }

  const steps = skip ? 2 : 1;
  newState.currentPlayer = nextPlayer(playerIdx, newState.direction, n);
  if (skip) newState.currentPlayer = nextPlayer(playerIdx, newState.direction * steps, n);

  return newState;
}

function drawCard(state, playerIdx) {
  const newState = JSON.parse(JSON.stringify(state));
  if (newState.deck.length === 0) {
    newState.deck = shuffle(newState.discard.splice(0, newState.discard.length - 1));
  }
  if (newState.deck.length === 0) return newState;
  const drawn = newState.deck.pop();
  newState.hands[playerIdx].push(drawn);
  newState.currentPlayer = nextPlayer(playerIdx, newState.direction, newState.hands.length);
  newState.lastAction = "Pioche !";
  return newState;
}

// ─── Main Game Screen ─────────────────────────────────────────────────────────
function GameScreen({ players, onBack }) {
  const [gs, setGs] = useState(() => initGame(players));
  const [selectedCard, setSelectedCard] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingCard, setPendingCard] = useState(null);
  const [log, setLog] = useState([]);
  const [showUnoBtn, setShowUnoBtn] = useState(false);
  const botTimerRef = useRef(null);

  const humanIdx = players.findIndex(p => p.type === "human");
  const topCard = gs.discard[gs.discard.length - 1];

  const addLog = (msg) => setLog(l => [msg, ...l].slice(0, 8));

  const isMyTurn = gs.status === "playing" && gs.currentPlayer === humanIdx;

  // Bot logic
  useEffect(() => {
    if (gs.status !== "playing") return;
    const current = gs.currentPlayer;
    if (players[current].type === "human") return;
    if (botTimerRef.current) clearTimeout(botTimerRef.current);
    const delay = players[current].difficulty === "hard" ? 900 : players[current].difficulty === "medium" ? 1200 : 1600;
    botTimerRef.current = setTimeout(() => {
      setGs(prev => {
        if (prev.status !== "playing" || prev.currentPlayer !== current) return prev;
        const card = botChooseCard(prev.hands[current], prev.discard[prev.discard.length - 1], prev.activeColor, players[current].difficulty);
        if (!card) {
          const ns = drawCard(prev, current);
          addLog(`${players[current].name} pioche`);
          return ns;
        }
        if (card.color === "wild") {
          const col = botChooseColor(prev.hands[current], players[current].difficulty);
          const ns = applyCard(prev, current, card, col);
          addLog(`${players[current].name} joue ${card.value} → ${col}`);
          return ns;
        }
        const ns = applyCard(prev, current, card, null);
        addLog(`${players[current].name} joue ${card.value}`);
        return ns;
      });
    }, delay);
    return () => clearTimeout(botTimerRef.current);
  }, [gs.currentPlayer, gs.status]);

  // UNO button timer
  useEffect(() => {
    if (gs.unoCallable && gs.unoCallBy === humanIdx) {
      setShowUnoBtn(true);
      const t = setTimeout(() => setShowUnoBtn(false), 4000);
      return () => clearTimeout(t);
    } else {
      setShowUnoBtn(false);
    }
  }, [gs.unoCallable, gs.unoCallBy]);

  const handleCardClick = (card) => {
    if (!isMyTurn) return;
    if (!canPlay(card, topCard, gs.activeColor)) return;
    if (selectedCard?.id === card.id) {
      // Play it
      if (card.color === "wild") {
        setPendingCard(card);
        setShowColorPicker(true);
        setSelectedCard(null);
      } else {
        const ns = applyCard(gs, humanIdx, card, null);
        setGs(ns);
        setSelectedCard(null);
        addLog(`Vous jouez ${card.value}`);
      }
    } else {
      setSelectedCard(card);
    }
  };

  const handleDraw = () => {
    if (!isMyTurn) return;
    const ns = drawCard(gs, humanIdx);
    setGs(ns);
    addLog("Vous piochez");
  };

  const handleColorPick = (col) => {
    setShowColorPicker(false);
    const ns = applyCard(gs, humanIdx, pendingCard, col);
    setGs(ns);
    setPendingCard(null);
    addLog(`Vous jouez ${pendingCard.value} → ${col}`);
  };

  const handleUno = () => {
    setShowUnoBtn(false);
    addLog("UNO !");
  };

  const restart = () => {
    setGs(initGame(players));
    setLog([]);
    setSelectedCard(null);
  };

  const topColor = COLOR_MAP[gs.activeColor] || COLOR_MAP.wild;

  // Layout
  const botPlayers = players.filter((p, i) => i !== humanIdx);
  const botTop = botPlayers.filter((_, bi) => bi < Math.ceil(botPlayers.length / 2));
  const botSide = botPlayers.filter((_, bi) => bi >= Math.ceil(botPlayers.length / 2));

  const getPlayerIndex = (name) => players.findIndex(p => p.name === name);

  if (gs.status === "ended") {
    const winner = players[gs.winner];
    return (
      <div style={{ minHeight: "100vh", background: "#0f0f1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', sans-serif" }}>
        <div style={{ textAlign: "center", color: "#fff" }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>{winner.type === "human" ? "🎉" : "😢"}</div>
          <h1 style={{ fontSize: 42, fontWeight: 800, margin: "0 0 8px", color: winner.type === "human" ? "#F5C518" : "#E8453C" }}>
            {winner.type === "human" ? "Victoire !" : `${winner.name} gagne !`}
          </h1>
          <p style={{ fontSize: 18, color: "#aaa", margin: "0 0 32px" }}>
            {winner.type === "human" ? "Bravo, vous avez tout raflé !" : "Meilleure chance la prochaine fois !"}
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            <button onClick={restart} style={{ padding: "14px 32px", background: "#F5C518", color: "#222", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
              Rejouer
            </button>
            <button onClick={onBack} style={{ padding: "14px 32px", background: "transparent", color: "#fff", border: "2px solid #444", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
              Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f0f1a",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Nunito', sans-serif",
      overflow: "hidden",
      position: "relative",
    }}>
      {showColorPicker && <ColorPicker onPick={handleColorPick} />}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px", borderBottom: "1px solid #222" }}>
        <button onClick={onBack} style={{ background: "transparent", border: "1px solid #333", color: "#888", padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "'Nunito', sans-serif" }}>
          ← Menu
        </button>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: topColor.bg }} />
          <span style={{ color: "#ccc", fontSize: 13 }}>
            {gs.lastAction || (isMyTurn ? "Votre tour" : `Tour de ${players[gs.currentPlayer].name}`)}
          </span>
        </div>
        <button onClick={restart} style={{ background: "transparent", border: "1px solid #333", color: "#888", padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "'Nunito', sans-serif" }}>
          Reset
        </button>
      </div>

      {/* Bot opponents top */}
      <div style={{ display: "flex", justifyContent: "center", gap: 32, padding: "16px 0 8px" }}>
        {botTop.map((p) => {
          const pi = getPlayerIndex(p.name);
          return (
            <div key={p.name} style={{ textAlign: "center" }}>
              <div style={{
                fontSize: 12, color: pi === gs.currentPlayer ? "#F5C518" : "#666",
                fontWeight: pi === gs.currentPlayer ? 700 : 400, marginBottom: 6,
              }}>
                {p.name} {pi === gs.currentPlayer ? "●" : ""} ({gs.hands[pi]?.length} cartes)
              </div>
              <div style={{ display: "flex", gap: -8, justifyContent: "center" }}>
                {(gs.hands[pi] || []).slice(0, 12).map((c, ci) => (
                  <div key={ci} style={{ marginLeft: ci > 0 ? -14 : 0 }}>
                    <UnoCard card={c} small hidden />
                  </div>
                ))}
                {(gs.hands[pi]?.length || 0) > 12 && (
                  <div style={{ color: "#666", fontSize: 11, alignSelf: "center", marginLeft: 4 }}>+{gs.hands[pi].length - 12}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Center area */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 48 }}>
        {/* Side bots */}
        {botSide.map((p) => {
          const pi = getPlayerIndex(p.name);
          return (
            <div key={p.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 12, color: pi === gs.currentPlayer ? "#F5C518" : "#666", fontWeight: pi === gs.currentPlayer ? 700 : 400 }}>
                {p.name} {pi === gs.currentPlayer ? "●" : ""}
              </div>
              <div style={{ fontSize: 11, color: "#555" }}>{gs.hands[pi]?.length} cartes</div>
              <div style={{ display: "flex", flexDirection: "column", gap: -10 }}>
                {(gs.hands[pi] || []).slice(0, 8).map((c, ci) => (
                  <div key={ci} style={{ marginTop: ci > 0 ? -28 : 0 }}>
                    <UnoCard card={c} small hidden />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Deck & Discard */}
        <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
          {/* Draw deck */}
          <div style={{ textAlign: "center" }}>
            <div onClick={isMyTurn ? handleDraw : undefined} style={{ cursor: isMyTurn ? "pointer" : "default" }}>
              <UnoCard card={{ color: "wild", value: "wild" }} hidden disabled={!isMyTurn} />
            </div>
            <div style={{ color: "#555", fontSize: 11, marginTop: 4 }}>{gs.deck.length} cartes</div>
          </div>

          {/* Direction indicator */}
          <div style={{ color: "#444", fontSize: 24 }}>
            {gs.direction === 1 ? "↻" : "↺"}
          </div>

          {/* Top card */}
          <div style={{ textAlign: "center" }}>
            <div style={{
              padding: 4,
              borderRadius: 14,
              background: `${topColor.bg}33`,
              border: `2px solid ${topColor.bg}66`,
            }}>
              <UnoCard card={topCard} />
            </div>
            <div style={{ color: topColor.bg, fontSize: 11, marginTop: 4, fontWeight: 700 }}>
              {gs.activeColor.toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* Player hand */}
      <div style={{
        background: "#111",
        borderTop: "1px solid #222",
        padding: "16px 24px 20px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ color: isMyTurn ? "#F5C518" : "#555", fontSize: 14, fontWeight: isMyTurn ? 700 : 400 }}>
            {isMyTurn ? "▶ Votre tour" : "Vous"} — {gs.hands[humanIdx]?.length} cartes
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            {showUnoBtn && (
              <button onClick={handleUno} style={{
                background: "#E8453C", color: "#fff", border: "none",
                padding: "8px 20px", borderRadius: 10, fontWeight: 800, fontSize: 16,
                cursor: "pointer", fontFamily: "'Nunito', sans-serif", animation: "pulse 0.5s infinite",
              }}>
                UNO!
              </button>
            )}
          </div>
        </div>
        <div style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 8,
          flexWrap: "nowrap",
        }}>
          {(gs.hands[humanIdx] || []).map(card => {
            const playable = isMyTurn && canPlay(card, topCard, gs.activeColor);
            return (
              <div key={card.id} style={{ flexShrink: 0 }}>
                <UnoCard
                  card={card}
                  onClick={playable ? handleCardClick : undefined}
                  selected={selectedCard?.id === card.id}
                  disabled={!playable}
                />
              </div>
            );
          })}
        </div>
        {selectedCard && (
          <div style={{ textAlign: "center", marginTop: 8, color: "#888", fontSize: 12 }}>
            Cliquez à nouveau pour jouer la carte sélectionnée
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }`}</style>
    </div>
  );
}

// ─── Multiplayer Room System (local simulation) ───────────────────────────────
const roomsStore = {};

function MultiplayerLobby({ onStartGame, onBack }) {
  const [view, setView] = useState("menu"); // menu | create | join
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [rooms, setRooms] = useState(roomsStore);
  const [myRoom, setMyRoom] = useState(null);
  const [error, setError] = useState("");

  const refreshRooms = () => setRooms({ ...roomsStore });

  const createRoom = () => {
    if (!playerName.trim()) { setError("Entrez votre nom"); return; }
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    roomsStore[code] = {
      code,
      host: playerName.trim(),
      players: [{ name: playerName.trim(), type: "human" }],
      status: "waiting",
    };
    setMyRoom(code);
    setView("room");
    setError("");
  };

  const joinRoom = () => {
    if (!playerName.trim()) { setError("Entrez votre nom"); return; }
    const r = roomsStore[roomCode.toUpperCase()];
    if (!r) { setError("Salle introuvable"); return; }
    if (r.players.length >= 4) { setError("Salle pleine"); return; }
    if (r.status !== "waiting") { setError("Partie en cours"); return; }
    r.players.push({ name: playerName.trim(), type: "human" });
    setMyRoom(roomCode.toUpperCase());
    setView("room");
    setError("");
  };

  const startGame = () => {
    const r = roomsStore[myRoom];
    if (r.players.length < 2) { setError("Au moins 2 joueurs requis"); return; }
    onStartGame(r.players);
  };

  const leaveRoom = () => {
    if (myRoom && roomsStore[myRoom]) {
      delete roomsStore[myRoom];
    }
    setMyRoom(null);
    setView("menu");
    setError("");
  };

  const room = myRoom ? roomsStore[myRoom] : null;

  if (view === "room" && room) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>Code de la salle</div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 8, color: "#F5C518" }}>{room.code}</div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>Partagez ce code avec vos amis</div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>Joueurs ({room.players.length}/4)</div>
          {room.players.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "#1a1a2e", borderRadius: 10, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#27AE60" }} />
              <span style={{ color: "#fff", fontWeight: 600 }}>{p.name}</span>
              {i === 0 && <span style={{ marginLeft: "auto", fontSize: 11, color: "#F5C518" }}>Hôte</span>}
            </div>
          ))}
        </div>
        {error && <div style={{ color: "#E8453C", fontSize: 13 }}>{error}</div>}
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={leaveRoom} style={btnStyle("outline")}>Quitter</button>
          {room.host === playerName && (
            <button onClick={startGame} disabled={room.players.length < 2} style={btnStyle("primary", room.players.length < 2)}>
              Lancer la partie
            </button>
          )}
        </div>
        {room.host !== playerName && (
          <div style={{ textAlign: "center", color: "#555", fontSize: 13 }}>En attente de l'hôte…</div>
        )}
      </div>
    );
  }

  if (view === "create") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h3 style={{ margin: 0, color: "#fff", fontSize: 20, fontWeight: 700 }}>Créer une salle</h3>
      <input placeholder="Votre nom" value={playerName} onChange={e => setPlayerName(e.target.value)} style={inputStyle} />
      {error && <div style={{ color: "#E8453C", fontSize: 13 }}>{error}</div>}
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={() => setView("menu")} style={btnStyle("outline")}>Retour</button>
        <button onClick={createRoom} style={btnStyle("primary")}>Créer</button>
      </div>
    </div>
  );

  if (view === "join") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h3 style={{ margin: 0, color: "#fff", fontSize: 20, fontWeight: 700 }}>Rejoindre une salle</h3>
      <input placeholder="Votre nom" value={playerName} onChange={e => setPlayerName(e.target.value)} style={inputStyle} />
      <input placeholder="Code de la salle" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} maxLength={5} style={{ ...inputStyle, letterSpacing: 4, textTransform: "uppercase" }} />
      {error && <div style={{ color: "#E8453C", fontSize: 13 }}>{error}</div>}
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={() => setView("menu")} style={btnStyle("outline")}>Retour</button>
        <button onClick={joinRoom} style={btnStyle("primary")}>Rejoindre</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ margin: 0, color: "#fff", fontSize: 20, fontWeight: 700 }}>Multijoueur local</h3>
      <p style={{ margin: 0, color: "#666", fontSize: 14, lineHeight: 1.6 }}>
        Créez une salle et partagez le code avec vos amis (sur cet appareil ou en réseau local).
      </p>
      <button onClick={() => setView("create")} style={btnStyle("primary")}>Créer une salle</button>
      <button onClick={() => setView("join")} style={btnStyle("outline")}>Rejoindre une salle</button>
      <button onClick={onBack} style={{ ...btnStyle("outline"), marginTop: 8, opacity: 0.6 }}>← Retour</button>
    </div>
  );
}

// ─── Solo Setup ───────────────────────────────────────────────────────────────
function SoloSetup({ onStartGame, onBack }) {
  const [playerName, setPlayerName] = useState("Vous");
  const [numBots, setNumBots] = useState(2);
  const [difficulty, setDifficulty] = useState("medium");
  const difficultyLabel = { easy: "Facile", medium: "Moyen", hard: "Difficile" };

  const start = () => {
    const botNames = ["Alice", "Bob", "Charlie", "Diana"];
    const players = [
      { name: playerName || "Vous", type: "human" },
      ...Array.from({ length: numBots }, (_, i) => ({
        name: botNames[i],
        type: "bot",
        difficulty,
      })),
    ];
    onStartGame(players);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h3 style={{ margin: 0, color: "#fff", fontSize: 20, fontWeight: 700 }}>Mode Solo</h3>
      <div>
        <label style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 6 }}>Votre nom</label>
        <input value={playerName} onChange={e => setPlayerName(e.target.value)} style={inputStyle} />
      </div>
      <div>
        <label style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 10 }}>Nombre de bots ({numBots})</label>
        <div style={{ display: "flex", gap: 8 }}>
          {[1, 2, 3].map(n => (
            <button key={n} onClick={() => setNumBots(n)} style={numBots === n ? btnStyle("primary") : btnStyle("outline")}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 10 }}>Difficulté des bots</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["easy", "medium", "hard"].map(d => (
            <button key={d} onClick={() => setDifficulty(d)} style={difficulty === d ? btnStyle("accent") : btnStyle("outline")}>
              {difficultyLabel[d]}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button onClick={onBack} style={btnStyle("outline")}>← Retour</button>
        <button onClick={start} style={btnStyle("primary")}>Jouer !</button>
      </div>
    </div>
  );
}

// ─── Shared Styles ────────────────────────────────────────────────────────────
const inputStyle = {
  background: "#1a1a2e",
  border: "1.5px solid #333",
  borderRadius: 10,
  color: "#fff",
  padding: "12px 16px",
  fontSize: 15,
  fontFamily: "'Nunito', sans-serif",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const btnStyle = (variant, disabled = false) => ({
  padding: "12px 24px",
  borderRadius: 12,
  border: "none",
  cursor: disabled ? "not-allowed" : "pointer",
  fontFamily: "'Nunito', sans-serif",
  fontWeight: 700,
  fontSize: 15,
  flex: 1,
  opacity: disabled ? 0.5 : 1,
  transition: "opacity 0.15s",
  ...(variant === "primary" ? {
    background: "#E8453C",
    color: "#fff",
  } : variant === "accent" ? {
    background: "#F5C518",
    color: "#222",
  } : {
    background: "transparent",
    color: "#aaa",
    border: "1.5px solid #333",
  }),
});

// ─── Home Screen ──────────────────────────────────────────────────────────────
function HomeScreen({ onNav }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      {/* Logo */}
      <div style={{ marginBottom: 48, textAlign: "center" }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 100, height: 100,
          borderRadius: 24,
          background: "linear-gradient(135deg, #E8453C, #F5C518)",
          marginBottom: 20,
          boxShadow: "0 8px 32px rgba(232,69,60,0.3)",
        }}>
          <span style={{ fontSize: 48, fontWeight: 900, color: "#fff", fontFamily: "'Nunito', sans-serif", letterSpacing: -2 }}>U</span>
        </div>
        <h1 style={{ fontSize: 52, fontWeight: 900, margin: 0, color: "#fff", letterSpacing: -2, fontFamily: "'Nunito', sans-serif" }}>
          uno
        </h1>
        <p style={{ color: "#555", margin: "8px 0 0", fontSize: 15 }}>La version épurée du classique</p>
      </div>

      {/* Cards preview */}
      <div style={{ display: "flex", gap: 12, marginBottom: 48, transform: "rotate(-2deg)" }}>
        {[
          { color: "red", value: "7" },
          { color: "yellow", value: "skip" },
          { color: "blue", value: "draw2" },
          { color: "green", value: "reverse" },
          { color: "wild", value: "wild" },
        ].map((c, i) => (
          <div key={i} style={{ transform: `rotate(${(i - 2) * 5}deg)` }}>
            <UnoCard card={c} />
          </div>
        ))}
      </div>

      {/* Menu */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 320 }}>
        <button onClick={() => onNav("solo")} style={{
          background: "linear-gradient(135deg, #E8453C, #C0392B)",
          border: "none", borderRadius: 16, padding: "18px 24px",
          color: "#fff", fontSize: 18, fontWeight: 800, cursor: "pointer",
          fontFamily: "'Nunito', sans-serif", textAlign: "left",
          boxShadow: "0 4px 20px rgba(232,69,60,0.3)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>Solo vs Bots</span>
          <span style={{ fontSize: 22 }}>🤖</span>
        </button>
        <button onClick={() => onNav("multi")} style={{
          background: "linear-gradient(135deg, #2980B9, #1a5c8a)",
          border: "none", borderRadius: 16, padding: "18px 24px",
          color: "#fff", fontSize: 18, fontWeight: 800, cursor: "pointer",
          fontFamily: "'Nunito', sans-serif", textAlign: "left",
          boxShadow: "0 4px 20px rgba(41,128,185,0.3)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>Multijoueur</span>
          <span style={{ fontSize: 22 }}>👥</span>
        </button>
      </div>

      {/* Rules */}
      <div style={{ marginTop: 40, padding: "20px 24px", background: "#111", borderRadius: 16, maxWidth: 400, width: "100%" }}>
        <div style={{ fontSize: 12, color: "#555", fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Rappel des règles</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            ["⊘", "Skip — passe le tour du suivant"],
            ["⇄", "Reverse — inverse le sens"],
            ["+2", "Draw 2 — le suivant pioche 2"],
            ["🎨", "Wild — choisit la couleur"],
            ["+4", "Wild+4 — pioche 4 + couleur"],
          ].map(([sym, desc]) => (
            <div key={sym} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 15, width: 28, textAlign: "center" }}>{sym}</span>
              <span style={{ color: "#666", fontSize: 13 }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home"); // home | solo | multi | game
  const [gamePlayers, setGamePlayers] = useState(null);

  const startGame = (players) => {
    setGamePlayers(players);
    setScreen("game");
  };

  if (screen === "game" && gamePlayers) {
    return <GameScreen players={gamePlayers} onBack={() => setScreen("home")} />;
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f0f1a",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      fontFamily: "'Nunito', sans-serif",
      padding: "40px 20px 60px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet" />

      <div style={{ width: "100%", maxWidth: 480 }}>
        {screen === "home" && <HomeScreen onNav={setScreen} />}
        {screen === "solo" && (
          <div style={{ background: "#111", borderRadius: 24, padding: "32px 28px" }}>
            <SoloSetup onStartGame={startGame} onBack={() => setScreen("home")} />
          </div>
        )}
        {screen === "multi" && (
          <div style={{ background: "#111", borderRadius: 24, padding: "32px 28px" }}>
            <MultiplayerLobby onStartGame={startGame} onBack={() => setScreen("home")} />
          </div>
        )}
      </div>
    </div>
  );
}
