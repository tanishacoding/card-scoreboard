// Socket.IO real-time sync — only runs on game pages
if (typeof GAME_ID !== 'undefined') {
  const socket = io();
  socket.emit('join', { game_id: GAME_ID });

  socket.on('player_added', (player) => addPlayerCard(player));
  socket.on('player_removed', ({ player_id }) => document.getElementById(`player-${player_id}`)?.remove());
  socket.on('score_updated', ({ player_id, score, change, round }) => {
    const scoreEl = document.querySelector(`#player-${player_id} .player-score`);
    const historyEl = document.querySelector(`#player-${player_id} .score-history`);
    if (scoreEl) scoreEl.textContent = score;
    if (historyEl) {
      const entry = document.createElement('div');
      entry.className = `history-entry ${change > 0 ? 'pos' : 'neg'}`;
      entry.textContent = `r${round}: ${change > 0 ? '+' : ''}${change}`;
      historyEl.prepend(entry);
    }
    refreshLeader();
    checkWinCondition(player_id, score);
  });
  socket.on('round_changed', ({ round }) => {
    document.getElementById('round-display').textContent = `round ${round}`;
  });
  socket.on('scores_reset', (game) => {
    document.getElementById('players-grid').innerHTML = '<p class="empty-state">add players above to start tracking scores</p>';
    document.getElementById('round-display').textContent = 'round 1';
    document.getElementById('winner-banner').style.display = 'none';
    game.players.forEach(addPlayerCard);
  });
}

// ── Player cards ──────────────────────────────────────────────────────────────

function addPlayerCard(player) {
  const grid = document.getElementById('players-grid');
  const empty = grid.querySelector('.empty-state');
  if (empty) empty.remove();

  const card = document.createElement('div');
  card.className = 'player-card';
  card.id = `player-${player.id}`;
  card.innerHTML = `
    <button class="remove-player" onclick="removePlayer(${player.id})" aria-label="remove ${player.name}">×</button>
    <div class="player-name">${player.name}</div>
    <div class="player-score">${player.score}</div>
    <div class="score-controls">
      <button class="btn-score-sub" onclick="updateScore(${player.id}, -1)">−</button>
      <input type="number" id="amt-${player.id}" value="${DEFAULT_PTS}" min="1" max="9999" />
      <button class="btn-score-add" onclick="updateScore(${player.id}, 1)">+</button>
    </div>
    ${WIN_CONDITION === 'target' ? `<div class="target-progress">${player.score} / ${TARGET_SCORE}</div>` : ''}
    <div class="score-history"></div>
  `;
  grid.appendChild(card);
  refreshLeader();
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function addPlayer() {
  const input = document.getElementById('player-name');
  const name = input.value.trim();
  if (!name) return;
  await fetch(`/api/games/${GAME_ID}/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  input.value = '';
}

async function removePlayer(id) {
  await fetch(`/api/players/${id}`, { method: 'DELETE' });
  document.getElementById(`player-${id}`)?.remove();
  refreshLeader();
}

async function updateScore(playerId, sign) {
  const amt = parseInt(document.getElementById(`amt-${playerId}`).value) || 0;
  if (amt === 0) return;
  await fetch(`/api/players/${playerId}/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ change: sign * amt }),
  });
}

async function nextRound() {
  await fetch(`/api/games/${GAME_ID}/next-round`, { method: 'POST' });
}

async function resetScores() {
  if (!confirm('reset all scores to zero?')) return;
  await fetch(`/api/games/${GAME_ID}/reset`, { method: 'POST' });
}

// ── Leader logic ──────────────────────────────────────────────────────────────

function refreshLeader() {
  const cards = [...document.querySelectorAll('.player-card')];
  if (cards.length < 2) return;

  const scores = cards.map(c => parseInt(c.querySelector('.player-score').textContent));
  const best = WIN_CONDITION === 'lowest' ? Math.min(...scores) : Math.max(...scores);

  cards.forEach((card, i) => {
    const isLeader = scores[i] === best;
    card.classList.toggle('leader', isLeader);
    let badge = card.querySelector('.leader-badge');
    if (isLeader && !badge) {
      badge = document.createElement('div');
      badge.className = 'leader-badge';
      badge.textContent = 'leading';
      card.prepend(badge);
    } else if (!isLeader && badge) {
      badge.remove();
    }
  });
}

function checkWinCondition(playerId, score) {
  if (WIN_CONDITION !== 'target' || score < TARGET_SCORE) return;
  const name = document.querySelector(`#player-${playerId} .player-name`)?.textContent;
  const banner = document.getElementById('winner-banner');
  document.getElementById('winner-text').textContent = `🏆 ${name} reached ${TARGET_SCORE} points — winner!`;
  banner.style.display = 'block';
}

// Enter key on player input
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('player-name')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addPlayer();
  });
});
