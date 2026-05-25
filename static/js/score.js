// ── Judgement scoring ─────────────────────────────────────────────────────────
// 0 → +10, 1 → +15, N>=2 → +10 + N*10. Wrong → +0 pts.
function judgementPoints(predicted) {
  if (predicted === 0) return 10;
  if (predicted === 1) return 15;
  return 10 + predicted * 10;
}

function openJudgementModal(round) {
  const players = [...document.querySelectorAll('.player-card')];
  if (players.length === 0) return;

  const modal = document.getElementById('judgement-modal');
  const body = document.getElementById('judgement-body');
  document.getElementById('judgement-title').textContent = `round ${round} — predictions & results`;

  // Ask for cards distributed this round
  body.innerHTML = `
    <div class="judgement-cards-row">
      <label class="cards-label">cards distributed this round</label>
      <input type="number" id="cards-distributed" min="1" max="52" value="7" class="judgement-input" />
      <span class="dealer-note">dealer's prediction will be validated</span>
    </div>
    <div class="judgement-players" id="judgement-players"></div>
    <div id="dealer-warning" class="dealer-warning" style="display:none;">
      ⚠️ Total predictions equal cards distributed! The dealer's bid must be different.
    </div>
  `;

  const playersDiv = document.getElementById('judgement-players');
  playersDiv.innerHTML = players.map((card, idx) => {
    const id = card.id.replace('player-', '');
    const name = card.querySelector('.player-name').textContent;
    const isDealer = idx === players.length - 1;
    return `
      <div class="judgement-row">
        <div class="judgement-name">
          ${name}
          ${isDealer ? '<span class="dealer-badge">dealer</span>' : ''}
        </div>
        <div class="judgement-inputs">
          <div class="judgement-input-group">
            <label>predicted</label>
            <input type="number" id="pred-${id}" min="0" max="52" value="0" class="judgement-input pred-input" data-player="${id}" data-isdealer="${isDealer}" />
          </div>
          <div class="judgement-input-group">
            <label>actual hands</label>
            <input type="number" id="actual-${id}" min="0" max="52" value="0" class="judgement-input" />
          </div>
          <div class="judgement-pts" id="pts-${id}">+10 pts ✓</div>
        </div>
      </div>`;
  }).join('');

  // Live preview + dealer validation
  function updateAll() {
    const cards = parseInt(document.getElementById('cards-distributed').value) || 0;
    const allPredInputs = [...document.querySelectorAll('.pred-input')];
    const total = allPredInputs.reduce((sum, inp) => sum + (parseInt(inp.value) || 0), 0);
    const dealerInput = allPredInputs[allPredInputs.length - 1];
    const dealerPred = parseInt(dealerInput.value) || 0;

    // Show dealer warning
    const warning = document.getElementById('dealer-warning');
    warning.style.display = total === cards ? 'block' : 'none';

    // Update points preview per player
    players.forEach(card => {
      const id = card.id.replace('player-', '');
      const pred = parseInt(document.getElementById(`pred-${id}`).value) || 0;
      const actual = parseInt(document.getElementById(`actual-${id}`).value) || 0;
      const pts = pred === actual ? judgementPoints(pred) : 0;
      const ptsEl = document.getElementById(`pts-${id}`);
      ptsEl.textContent = pred === actual ? `+${pts} pts ✓` : `+0 pts ✗`;
      ptsEl.style.color = pred === actual ? '#1D9E75' : '#E24B4A';
    });
  }

  document.getElementById('cards-distributed').addEventListener('input', updateAll);
  document.querySelectorAll('.pred-input, .judgement-input').forEach(inp => {
    inp.addEventListener('input', updateAll);
  });
  updateAll();

  modal.style.display = 'flex';
}

async function submitJudgement() {
  const players = [...document.querySelectorAll('.player-card')];
  const cards = parseInt(document.getElementById('cards-distributed').value) || 0;
  const allPredInputs = [...document.querySelectorAll('.pred-input')];
  const total = allPredInputs.reduce((sum, inp) => sum + (parseInt(inp.value) || 0), 0);

  // Block submission if dealer rule violated
  if (total === cards) {
    document.getElementById('dealer-warning').style.display = 'block';
    document.getElementById('dealer-warning').textContent = '⚠️ Cannot save! Total predictions equal cards distributed. Change the dealer\'s bid.';
    return;
  }

  const roundLabel = document.getElementById('round-display').textContent;

  for (const card of players) {
    const id = card.id.replace('player-', '');
    const pred = parseInt(document.getElementById(`pred-${id}`).value) || 0;
    const actual = parseInt(document.getElementById(`actual-${id}`).value) || 0;
    const pts = pred === actual ? judgementPoints(pred) : 0;

    await fetch(`/api/players/${id}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ change: pts }),
    });

    const scoreEl = card.querySelector('.player-score');
    if (scoreEl) scoreEl.textContent = parseInt(scoreEl.textContent) + pts;

    const historyEl = card.querySelector('.score-history');
    if (historyEl) {
      const entry = document.createElement('div');
      entry.className = `history-entry ${pts > 0 ? 'pos' : 'neg'}`;
      entry.textContent = `${roundLabel}: pred ${pred}, made ${actual} → +${pts}`;
      historyEl.prepend(entry);
    }
  }

  refreshLeader();
  closeJudgementModal();
}

function closeJudgementModal() {
  document.getElementById('judgement-modal').style.display = 'none';
}

// ── End Game ──────────────────────────────────────────────────────────────────

function endGame() {
  const cards = [...document.querySelectorAll('.player-card')];
  if (cards.length === 0) return;

  const results = cards.map(card => ({
    name: card.querySelector('.player-name').textContent,
    score: parseInt(card.querySelector('.player-score').textContent),
  }));

  results.sort((a, b) => WIN_CONDITION === 'lowest' ? a.score - b.score : b.score - a.score);

  const medals = ['🥇', '🥈', '🥉'];
  const body = document.getElementById('endgame-body');

  body.innerHTML = results.map((p, i) => `
    <div class="endgame-row ${i === 0 ? 'winner-row' : ''}">
      <span class="endgame-rank">${medals[i] || `#${i + 1}`}</span>
      <span class="endgame-name">${p.name}</span>
      <span class="endgame-score">${p.score} pts</span>
    </div>
  `).join('');

  document.getElementById('endgame-modal').style.display = 'flex';
}

function closeEndGame() {
  document.getElementById('endgame-modal').style.display = 'none';
}

// ── Player cards ──────────────────────────────────────────────────────────────

function addPlayerCard(player) {
  const grid = document.getElementById('players-grid');
  const empty = grid.querySelector('.empty-state');
  if (empty) empty.remove();

  const card = document.createElement('div');
  card.className = 'player-card';
  card.id = `player-${player.id}`;

  if (IS_JUDGEMENT) {
    card.innerHTML = `
      <button class="remove-player" onclick="removePlayer(${player.id})" aria-label="remove ${player.name}">×</button>
      <div class="player-name">${player.name}</div>
      <div class="player-score">${player.score}</div>
      <div class="score-history"></div>
    `;
  } else {
    card.innerHTML = `
      <button class="remove-player" onclick="removePlayer(${player.id})" aria-label="remove ${player.name}">×</button>
      <div class="player-name">${player.name}</div>
      <div class="player-score">${player.score}</div>
      <div class="score-controls">
        <button class="btn-score-sub" onclick="updateScore(${player.id}, -1)">−</button>
        <input type="number" id="amt-${player.id}" value="${DEFAULT_PTS}" min="1" max="9999" />
        <button class="btn-score-add" onclick="updateScore(${player.id}, 1)">+</button>
      </div>
      <div class="score-history"></div>
    `;
  }

  grid.appendChild(card);
  refreshLeader();
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function addPlayer() {
  const input = document.getElementById('player-name');
  const name = input.value.trim();
  if (!name) return;
  const res = await fetch(`/api/games/${GAME_ID}/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const player = await res.json();
  addPlayerCard(player);
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
  const res = await fetch(`/api/players/${playerId}/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ change: sign * amt }),
  });
  const player = await res.json();
  const scoreEl = document.querySelector(`#player-${playerId} .player-score`);
  if (scoreEl) scoreEl.textContent = player.score;
  refreshLeader();
}

async function nextRound() {
  const res = await fetch(`/api/games/${GAME_ID}/next-round`, { method: 'POST' });
  const data = await res.json();
  document.getElementById('round-display').textContent = `round ${data.round}`;
  if (IS_JUDGEMENT) openJudgementModal(data.round);
}

async function resetScores() {
  if (!confirm('reset all scores to zero?')) return;
  await fetch(`/api/games/${GAME_ID}/reset`, { method: 'POST' });
  location.reload();
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

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('player-name')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addPlayer();
  });
});
