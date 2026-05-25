# 🃏 Card Game Scorekeeper

A Flask web app to track scores for any card game — Rummy, Teen Patti, Poker, and more.

## Features
- Create custom games with win conditions (highest, lowest, target score)
- Add/remove players dynamically
- Real-time score sync across devices via Socket.IO
- Score history per player per round
- Persistent storage with SQLite

## Project Structure
```
scorekeeper/
├── app.py              # Flask app, routes, Socket.IO events
├── models.py           # SQLAlchemy models (Game, Player, Round, ScoreEntry)
├── requirements.txt    # Python dependencies
├── .env.example        # Environment variable template
├── templates/
│   ├── base.html       # Shared layout, navbar
│   ├── index.html      # Home — create/list games
│   └── game.html       # Active game — players & scores
└── static/
    ├── css/style.css   # All styles
    └── js/score.js     # Client-side logic + Socket.IO
```

## Setup & Run

```bash
# 1. Clone / enter the project folder
cd scorekeeper

# 2. Create a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up environment variables
cp .env.example .env
# Edit .env and set a SECRET_KEY

# 5. Run the app
python app.py
```

Visit http://localhost:5000 in your browser.

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/games | Create a new game |
| DELETE | /api/games/<id> | Delete a game |
| POST | /api/games/<id>/players | Add a player |
| DELETE | /api/players/<id> | Remove a player |
| POST | /api/players/<id>/score | Update a player's score |
| POST | /api/games/<id>/next-round | Advance to next round |
| POST | /api/games/<id>/reset | Reset all scores |

## Deployment
- **Render / Railway**: push to GitHub, connect repo, set env vars
- **PythonAnywhere**: upload files, configure WSGI
