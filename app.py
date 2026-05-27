from flask import Flask, render_template, request, jsonify
from models import db, Game, Player, Round, ScoreEntry
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///scorekeeper.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    db.create_all()


# ── Pages ──────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    games = Game.query.filter_by(archived=False).order_by(Game.created_at.desc()).all()
    archived = Game.query.filter_by(archived=True).order_by(Game.created_at.desc()).all()
    return render_template('index.html', games=games, archived=archived)

@app.route('/game/<int:game_id>')
def game(game_id):
    g = Game.query.get_or_404(game_id)
    return render_template('game.html', game=g)

@app.route('/stats')
def stats():
    players = Player.query.all()
    return render_template('stats.html', players=players)

@app.route('/manifest.json')
def manifest():
    return jsonify({
        "name": "Scorekeeper",
        "short_name": "Scorekeeper",
        "description": "Track scores for any card game",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#edecea",
        "theme_color": "#5a6e72",
        "icons": [
            {"src": "/static/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/static/icon-512.png", "sizes": "512x512", "type": "image/png"}
        ]
    })

@app.route('/sw.js')
def service_worker():
    from flask import Response
    sw = """
const CACHE = 'scorekeeper-v1';
const ASSETS = ['/', '/static/css/style.css', '/static/js/score.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
self.addEventListener('fetch', e => e.respondWith(
  fetch(e.request).catch(() => caches.match(e.request))
));
"""
    return Response(sw, mimetype='application/javascript')


# ── Game API ───────────────────────────────────────────────────────────────────

@app.route('/api/games', methods=['POST'])
def create_game():
    data = request.json
    game = Game(
        name=data['name'],
        win_condition=data.get('win_condition', 'highest'),
        target_score=int(data.get('target_score', 0)),
        allow_negatives=data.get('allow_negatives', True),
        default_points=int(data.get('default_points', 1)),
    )
    db.session.add(game)
    db.session.flush()
    db.session.add(Round(number=1, game_id=game.id))
    db.session.commit()
    return jsonify(game.to_dict()), 201

@app.route('/api/games/<int:game_id>', methods=['DELETE'])
def delete_game(game_id):
    game = Game.query.get_or_404(game_id)
    db.session.delete(game)
    db.session.commit()
    return jsonify({'deleted': True})

@app.route('/api/games/<int:game_id>/archive', methods=['POST'])
def archive_game(game_id):
    game = Game.query.get_or_404(game_id)
    game.archived = not game.archived
    db.session.commit()
    return jsonify({'archived': game.archived})


# ── Player API ─────────────────────────────────────────────────────────────────

@app.route('/api/games/<int:game_id>/players', methods=['POST'])
def add_player(game_id):
    game = Game.query.get_or_404(game_id)
    data = request.json
    max_order = max((p.order for p in game.players), default=-1)
    player = Player(name=data['name'], game_id=game.id, order=max_order + 1)
    db.session.add(player)
    db.session.commit()
    return jsonify(player.to_dict()), 201

@app.route('/api/players/<int:player_id>', methods=['DELETE'])
def remove_player(player_id):
    player = Player.query.get_or_404(player_id)
    db.session.delete(player)
    db.session.commit()
    return jsonify({'deleted': True})

@app.route('/api/games/<int:game_id>/reorder', methods=['POST'])
def reorder_players(game_id):
    data = request.json  # { order: [player_id, player_id, ...] }
    for idx, pid in enumerate(data['order']):
        player = Player.query.get(pid)
        if player and player.game_id == game_id:
            player.order = idx
    db.session.commit()
    return jsonify({'ok': True})


# ── Score API ──────────────────────────────────────────────────────────────────

@app.route('/api/players/<int:player_id>/score', methods=['POST'])
def update_score(player_id):
    player = Player.query.get_or_404(player_id)
    game = player.game
    data = request.json
    change = int(data['change'])
    new_score = player.score + change
    if not game.allow_negatives and new_score < 0:
        new_score = 0
        change = new_score - player.score
    current_round = max((r.number for r in game.rounds), default=1)
    entry = ScoreEntry(change=change, round_number=current_round, player_id=player.id)
    player.score = new_score
    db.session.add(entry)
    db.session.commit()
    return jsonify(player.to_dict())

@app.route('/api/players/<int:player_id>/undo', methods=['POST'])
def undo_score(player_id):
    player = Player.query.get_or_404(player_id)
    last = ScoreEntry.query.filter_by(player_id=player_id).order_by(ScoreEntry.id.desc()).first()
    if not last:
        return jsonify({'error': 'nothing to undo'}), 400
    player.score -= last.change
    db.session.delete(last)
    db.session.commit()
    return jsonify(player.to_dict())


# ── Round API ──────────────────────────────────────────────────────────────────

@app.route('/api/games/<int:game_id>/next-round', methods=['POST'])
def next_round(game_id):
    game = Game.query.get_or_404(game_id)
    current = max((r.number for r in game.rounds), default=1)
    db.session.add(Round(number=current + 1, game_id=game.id))
    db.session.commit()
    return jsonify({'round': current + 1})

@app.route('/api/games/<int:game_id>/reset', methods=['POST'])
def reset_scores(game_id):
    game = Game.query.get_or_404(game_id)
    for player in game.players:
        player.score = 0
        ScoreEntry.query.filter_by(player_id=player.id).delete()
    Round.query.filter_by(game_id=game.id).delete()
    db.session.add(Round(number=1, game_id=game.id))
    db.session.commit()
    return jsonify(game.to_dict())


# ── Stats API ──────────────────────────────────────────────────────────────────

@app.route('/api/stats')
def get_stats():
    from sqlalchemy import func
    games = Game.query.all()
    stats = {}
    for game in games:
        if not game.players:
            continue
        if game.win_condition == 'lowest':
            winner = min(game.players, key=lambda p: p.score)
        else:
            winner = max(game.players, key=lambda p: p.score)
        name = winner.name.lower()
        if name not in stats:
            stats[name] = {'name': winner.name, 'wins': 0, 'games': 0, 'total_score': 0}
        stats[name]['wins'] += 1
        for p in game.players:
            n = p.name.lower()
            if n not in stats:
                stats[n] = {'name': p.name, 'wins': 0, 'games': 0, 'total_score': 0}
            stats[n]['games'] += 1
            stats[n]['total_score'] += p.score
    return jsonify(list(stats.values()))


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)