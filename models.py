from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class Game(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    win_condition = db.Column(db.String(20), default='highest')  # highest, lowest, target, none
    target_score = db.Column(db.Integer, default=0)
    allow_negatives = db.Column(db.Boolean, default=True)
    default_points = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    players = db.relationship('Player', backref='game', lazy=True, cascade='all, delete-orphan')
    rounds = db.relationship('Round', backref='game', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'win_condition': self.win_condition,
            'target_score': self.target_score,
            'allow_negatives': self.allow_negatives,
            'default_points': self.default_points,
            'players': [p.to_dict() for p in self.players],
            'current_round': max((r.number for r in self.rounds), default=1),
        }


class Player(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    score = db.Column(db.Integer, default=0)
    game_id = db.Column(db.Integer, db.ForeignKey('game.id'), nullable=False)

    score_entries = db.relationship('ScoreEntry', backref='player', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'score': self.score,
            'history': [e.to_dict() for e in list(self.score_entries)[-5:]],
        }


class Round(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    number = db.Column(db.Integer, nullable=False, default=1)
    game_id = db.Column(db.Integer, db.ForeignKey('game.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class ScoreEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    change = db.Column(db.Integer, nullable=False)
    round_number = db.Column(db.Integer, nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'change': self.change,
            'round': self.round_number,
        }
