"""
Builds static JSON data files for the NBA quiz app from quizzy_database.db.

Outputs (into ./data/):
  - players_search.json       flat list of all players for the guess-search dropdown
  - decade_questions.json     "Decade Team Leader" question pool
  - player_career_questions.json "Player Career" question pool (season-by-season tables)
  - this_or_that_pool.json    "This or That" close-pair pool per stat
"""
import csv
import json
import sqlite3
from collections import defaultdict
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
DB = BASE / "quizzy_database.db"
TEAMS_CSV = BASE / "All NBA Teams.csv"
OUT = Path(__file__).resolve().parent / "data"
OUT.mkdir(exist_ok=True)

MULTI_TEAM_CODES = {"2TM", "3TM", "4TM", "5TM", ""}
MIN_CAREER_GAMES = 300
MIN_FROM_YEAR = 1974  # steals/blocks not tracked league-wide before 1973-74

STATS = [
    ("mp", "Total Minutes Played", 1951),
    ("pts", "Total Points", 0),
    ("trb", "Total Rebounds", 0),
    ("ast", "Total Assists", 0),
    ("3p", "Total 3-Pointers Made", 1980),
]

# This-or-That stat pools: (column expr in players_career_reg_szn_totals, label, min threshold to be "decent")
THIS_OR_THAT_STATS = [
    ("pts", "Career Points", 5000),
    ("trb", "Career Rebounds", 2000),
    ("ast", "Career Assists", 1000),
    ("3p", "Career 3-Pointers Made", 500),
    ("dd", "Career Double-Doubles", 50),
    ("td", "Career Triple-Doubles", 5),
]
MIN_PAIR_RATIO = 0.6  # neighboring pair only counts as "close" if smaller/larger >= this


def season_decade(season: str) -> int:
    start_year = int(season.split("-")[0])
    return (start_year // 10) * 10


def load_team_names():
    names = {}
    with open(TEAMS_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            code = row["Team ID"].strip()
            if code not in names:
                names[code] = row["Team"].strip()
    return names


def main():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row

    team_names = load_team_names()

    players = {
        r["player_id"]: {
            "id": r["player_id"],
            "name": r["player"].rstrip("*"),
            "pos": (r["pos"] or "").strip(),
            "from": r["from"],
            "to": r["to"],
        }
        for r in con.execute('SELECT player_id, player, pos, "from", "to" FROM all_players')
    }

    # ---- players_search.json ----
    search_list = [{"id": p["id"], "name": p["name"]} for p in players.values()]
    search_list.sort(key=lambda x: x["name"])
    with open(OUT / "players_search.json", "w", encoding="utf-8") as f:
        json.dump(search_list, f, ensure_ascii=False)
    print(f"players_search.json: {len(search_list)} players")

    # ---- season totals rows (excluding multi-team combined rows) ----
    rows = con.execute(
        'SELECT player_id, team, season, mp, pts, trb, ast, "3p" as tp, g, gs, stl, blk, pos '
        "FROM players_reg_szn_totals"
    ).fetchall()

    # accumulate per (team, decade, stat) -> per player total, for decade_questions
    stat_totals = defaultdict(lambda: defaultdict(float))  # key: (team, decade, stat) -> player_id -> total

    # accumulate per (player, season) -> combined season totals, for player_career_questions
    season_totals = defaultdict(
        lambda: {"g": 0, "gs": 0, "pts": 0, "trb": 0, "ast": 0, "blk": 0, "stl": 0, "teams": [], "positions": []}
    )

    for r in rows:
        team = (r["team"] or "").strip()
        if team in MULTI_TEAM_CODES or team not in team_names:
            continue
        pid = r["player_id"]
        season = r["season"]
        decade = season_decade(season)

        for stat_key, _, min_year in STATS:
            if min_year and decade < min_year:
                continue
            col = "tp" if stat_key == "3p" else stat_key
            val = r[col] or 0
            stat_totals[(team, decade, stat_key)][pid] += val

        s = season_totals[(pid, season)]
        s["g"] += r["g"] or 0
        s["gs"] += r["gs"] or 0
        s["pts"] += r["pts"] or 0
        s["trb"] += r["trb"] or 0
        s["ast"] += r["ast"] or 0
        s["blk"] += r["blk"] or 0
        s["stl"] += r["stl"] or 0
        if team not in s["teams"]:
            s["teams"].append(team)
        pos = (r["pos"] or "").strip()
        if pos and pos not in s["positions"]:
            s["positions"].append(pos)

    # ---- decade_questions.json ----
    decade_questions = []
    qid = 0
    for (team, decade, stat_key), player_vals in stat_totals.items():
        if not player_vals:
            continue
        best_pid, best_val = max(player_vals.items(), key=lambda kv: kv[1])
        if best_val <= 0:
            continue
        p = players.get(best_pid)
        if not p or not p["pos"] or p["from"] is None or p["to"] is None:
            continue
        stat_label = next(lbl for k, lbl, _ in STATS if k == stat_key)
        qid += 1
        decade_questions.append(
            {
                "id": qid,
                "decade": decade,
                "decadeLabel": f"{decade}s",
                "teamAbbr": team,
                "teamName": team_names[team],
                "statKey": stat_key,
                "statLabel": stat_label,
                "value": round(best_val),
                "answerId": best_pid,
                "answerName": p["name"],
                "pos": p["pos"],
                "years": f"{p['from']}–{p['to']}",
            }
        )
    with open(OUT / "decade_questions.json", "w", encoding="utf-8") as f:
        json.dump(decade_questions, f, ensure_ascii=False)
    print(f"decade_questions.json: {len(decade_questions)} questions")

    # ---- player_career_questions.json ----
    by_player = defaultdict(list)
    for (pid, season), s in season_totals.items():
        by_player[pid].append((season, s))

    player_career_questions = []
    qid = 0
    for pid, seasons in by_player.items():
        p = players.get(pid)
        if not p or p["from"] is None or p["to"] is None:
            continue
        if p["from"] < MIN_FROM_YEAR:
            continue
        total_games = sum(s["g"] for _, s in seasons)
        if total_games < MIN_CAREER_GAMES:
            continue
        seasons.sort(key=lambda kv: kv[0])
        qid += 1

        def per_game(total, games):
            return round(total / games, 1) if games else 0.0

        player_career_questions.append(
            {
                "id": qid,
                "playerId": pid,
                "name": p["name"],
                "seasons": [
                    {
                        "season": season,
                        "g": round(s["g"]),
                        "gs": round(s["gs"]),
                        "pts": per_game(s["pts"], s["g"]),
                        "trb": per_game(s["trb"], s["g"]),
                        "ast": per_game(s["ast"], s["g"]),
                        "blk": per_game(s["blk"], s["g"]),
                        "stl": per_game(s["stl"], s["g"]),
                        "pos": "-".join(s["positions"]),
                        "team": ", ".join(s["teams"]),
                    }
                    for season, s in seasons
                ],
            }
        )
    with open(OUT / "player_career_questions.json", "w", encoding="utf-8") as f:
        json.dump(player_career_questions, f, ensure_ascii=False)
    print(f"player_career_questions.json: {len(player_career_questions)} players")

    # ---- this_or_that_pool.json ----
    # regular-season double-doubles/triple-doubles per player, derived from game logs
    playoff_ids = {r["game_id"] for r in con.execute("SELECT game_id FROM playoffs_games")}
    dd_td = defaultdict(lambda: {"dd": 0, "td": 0})
    for r in con.execute('SELECT player_id, game_id, "double-double" as dd, "triple-double" as td FROM player_game_logs'):
        if r["game_id"] in playoff_ids:
            continue
        e = dd_td[r["player_id"]]
        e["dd"] += r["dd"] or 0
        e["td"] += r["td"] or 0

    career_rows = con.execute(
        'SELECT player_id, g, pts, trb, ast, "3p" as tp, "trp-dbl" as tdbl FROM players_career_reg_szn_totals'
    ).fetchall()

    this_or_that_pool = {}
    for stat_key, label, threshold in THIS_OR_THAT_STATS:
        eligible = []
        for r in career_rows:
            pid = r["player_id"]
            p = players.get(pid)
            if not p or (r["g"] or 0) < MIN_CAREER_GAMES:
                continue
            if stat_key == "dd":
                value = dd_td.get(pid, {}).get("dd", 0)
            elif stat_key == "td":
                value = dd_td.get(pid, {}).get("td", 0)
            elif stat_key == "3p":
                value = r["tp"] or 0
            else:
                value = r[stat_key] or 0
            if value >= threshold:
                eligible.append({"id": pid, "name": p["name"], "value": round(value)})

        eligible.sort(key=lambda x: -x["value"])

        pairs = []
        for i in range(len(eligible) - 1):
            a, b = eligible[i], eligible[i + 1]
            if a["value"] <= 0 or a["value"] == b["value"]:
                continue
            ratio = b["value"] / a["value"]
            if ratio >= MIN_PAIR_RATIO:
                pairs.append([a, b])

        this_or_that_pool[stat_key] = {"label": label, "pairs": pairs}
        print(f"this_or_that[{stat_key}]: {len(eligible)} eligible players, {len(pairs)} close pairs")

    with open(OUT / "this_or_that_pool.json", "w", encoding="utf-8") as f:
        json.dump(this_or_that_pool, f, ensure_ascii=False)


if __name__ == "__main__":
    main()
