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
    games = Game.query.order_by(Game.created_at.desc()).all()
    return render_template('index.html', games=games)


@app.route('/game/<int:game_id>')
def game(game_id):
    g = Game.query.get_or_404(game_id)
    return render_template('game.html', game=g)


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


# ── Player API ─────────────────────────────────────────────────────────────────

@app.route('/api/games/<int:game_id>/players', methods=['POST'])
def add_player(game_id):
    game = Game.query.get_or_404(game_id)
    data = request.json
    player = Player(name=data['name'], game_id=game.id)
    db.session.add(player)
    db.session.commit()
    return jsonify(player.to_dict()), 201


@app.route('/api/players/<int:player_id>', methods=['DELETE'])
def remove_player(player_id):
    player = Player.query.get_or_404(player_id)
    db.session.delete(player)
    db.session.commit()
    return jsonify({'deleted': True})


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

    current_round = max((r.number for r in game.rounds), default=1)
    db.session.add(ScoreEntry(change=change, round_number=current_round, player_id=player.id))
    player.score = new_score
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


if __name__ == '__main__':
    app.run(debug=True)
