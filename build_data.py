"""
Builds static JSON data files for the NBA quiz app from quizzy_database.db.

Outputs (into ./data/):
  - players_search.json       flat list of all players for the guess-search dropdown
  - decade_questions.json     "Decade Team Leader" question pool
  - player_career_questions.json "Player Career" question pool (season-by-season tables)
  - this_or_that_pool.json    "This or That" close-pair pool per stat
  - college_questions.json    "College" question pool (guess the player's alma mater)
  - colleges_search.json      distinct colleges for the guess-search dropdown
  - draft_questions.json      "Draft" question pool (guess the player from their draft slot)
  - awards_season_questions.json "Awards Season" question pool (guess who won a given award in a given season)
  - trophy_case_questions.json "Trophy Case" question pool (guess the player from their career accolade resume)
  - fill_blank_boards.json    "Fill in the Blank" top-5 stat leaderboards
  - teammates_questions.json  "Teammates" question pool (guess a player's most-played-with teammate)
"""
import csv
import json
import re
import sqlite3
from collections import defaultdict
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
DB = BASE / "quizzy_database.db"
TEAMS_CSV = BASE / "All NBA Teams.csv"
COLLEGE_CONFERENCES_CSV = BASE / "college_conferences.csv"
OUT = Path(__file__).resolve().parent / "data"
OUT.mkdir(exist_ok=True)

MULTI_TEAM_CODES = {"2TM", "3TM", "4TM", "5TM", ""}
MIN_CAREER_GAMES = 300
MIN_CAREER_SEASONS = 10  # Player Career category: only players with a decently long career

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
    ("highPts", "Career-High Points in a Game", 0),
]
# A pair counts as "similar tier" if smaller/larger falls in this window - not so
# close it's a coin flip, not so far apart it's obvious.
PAIR_RATIO_MAX = 0.85
PAIR_RATIO_MIN = 0.5


def season_decade(season: str) -> int:
    # "Decade" is shifted one season earlier than a strict start-year-mod-10
    # bucketing, to match all-decade-team convention: the "1990s" is the
    # 1989-90 season through 1998-99 (not 1990-91 through 1999-00), so a
    # rookie's debut season anchors their decade the way "all-1990s team"
    # usually implies. Season start year Y maps to decade ((Y+1)//10)*10.
    start_year = int(season.split("-")[0])
    return ((start_year + 1) // 10) * 10


def load_team_names():
    names = {}
    with open(TEAMS_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            code = row["Team ID"].strip()
            if code not in names:
                names[code] = row["Team"].strip()
    return names


def load_franchise_map():
    """Maps each historical Team ID to its current Franchise ID and current
    Franchise display name, but only for teams whose overall franchise is
    still active today (Franchise Status == Active). Team IDs whose franchise
    is defunct (e.g. Anderson Packers) are left out entirely. Used by Decade
    Team Leader, which needs to group historical team-code stints (e.g. the
    Bobcats-to-Hornets rename, CHA -> CHO) together under one continuous,
    currently-active franchise instead of splitting a player's stats across
    both old and new codes.
    """
    franchise_id_by_team = {}
    franchise_name_by_id = {}
    with open(TEAMS_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["Franchise Status"].strip() != "Active":
                continue
            team_id = row["Team ID"].strip()
            franchise_id = row["Franchise ID"].strip()
            franchise_id_by_team[team_id] = franchise_id
            franchise_name_by_id.setdefault(franchise_id, row["Franchise"].strip())
    return franchise_id_by_team, franchise_name_by_id


# college_conferences.csv is a flat single-column export: a conference name row
# (e.g. "ACC"), followed by that conference's member schools as "School Mascot"
# rows, repeating for every conference. These are exactly those header rows.
COLLEGE_CONFERENCE_NAMES = {
    "ACC", "America East", "American", "Atlantic 10", "Atlantic Sun", "Big 12", "Big East",
    "Big Sky", "Big South", "Big Ten", "Big West", "Coastal", "Conference USA", "Horizon",
    "Ivy", "MAAC", "MEAC", "Mid-American", "Missouri Valley", "Mountain West", "Northeast",
    "Ohio Valley", "Pac-12", "Patriot League", "SEC", "SWAC", "Southern", "Southland",
    "Summit League", "Sun Belt", "UAC", "West Coast",
}

# Our internal `college` values (drafts.college) don't match the CSV's "School Mascot"
# names 1-to-1 - these are the cases the automatic matching below can't resolve on its
# own (abbreviations, alternate names, or the school genuinely not being a current
# D-I member so there's nothing to match). A value of None means "known, not in the CSV".
COLLEGE_NAME_ALIASES = {
    "Miami (FL)": "Miami Hurricanes", "Miami University": "Miami (OH) RedHawks",
    "NC Central": "North Carolina Central Eagles", "Louisiana-Monroe": "UL Monroe Warhawks",
    "Texas-El Paso": "UTEP Miners", "United States Naval Academy": "Navy Midshipmen",
    "University of Central Arkansas": "Central Arkansas Bears",
    "University of Texas Rio Grande Valley": "UT Rio Grande Valley Vaqueros",
    "Southern University and A&M College": "Southern Jaguars", "UNC": "North Carolina Tar Heels",
    "Pitt": "Pittsburgh Panthers", "Jacksonville University": "Jacksonville Dolphins",
    "Grambling State University": "Grambling Tigers", "McNeese State University": "McNeese Cowboys",
    "Boston College": "Boston College Eagles", "University of Evansville": "Evansville Purple Aces",
    "UMass": "Massachusetts Minutemen", "Seattle University": "Seattle U Redhawks",
    "University of Hartford": None, "University of Wisconsin-Stevens Point": None,
    "Virginia Union University": None, "West Texas A&M University": None,
    "Winston-Salem State": None, "Buffalo State": None, "Centenary (LA)": None,
    "Guilford College": None, "Hamline University": None,
    "Southeastern Oklahoma State University": None, "Trinity Valley CC": None,
    "Truman State University": None, "Illinois Wesleyan University": None,
    "NYU": None, "Saint Francis University": None,
}
# Mascot can't be mechanically split off the school name for the aliased entries above
# (the alias string already includes the mascot) - given directly instead.
COLLEGE_MASCOT_OVERRIDES = {
    "Miami (FL)": "Hurricanes", "Miami University": "RedHawks", "NC Central": "Eagles",
    "Louisiana-Monroe": "Warhawks", "Texas-El Paso": "Miners", "United States Naval Academy": "Midshipmen",
    "University of Central Arkansas": "Bears", "University of Texas Rio Grande Valley": "Vaqueros",
    "Southern University and A&M College": "Jaguars", "UNC": "Tar Heels", "Pitt": "Panthers",
    "Jacksonville University": "Dolphins", "Grambling State University": "Tigers",
    "McNeese State University": "Cowboys", "Boston College": "Eagles",
    "University of Evansville": "Purple Aces", "UMass": "Minutemen", "Seattle University": "Redhawks",
}
# words that mark a branch-campus/qualifier variant of a school (e.g. "Alabama State" or
# "Texas A&M-Corpus Christi" vs. the flagship "Alabama"/"Texas A&M") - used to prefer the
# flagship match when a school name is a prefix of more than one CSV entry.
COLLEGE_BRANCH_QUALIFIERS = {
    "state", "aandm", "tech", "international", "southern", "central", "eastern", "western",
    "northern", "atlantic", "gulf", "christian", "baptist", "valley", "fort", "upstate",
    "pine", "rio", "corpus", "city", "asheville", "wilmington", "greensboro", "monroe",
    "commerce", "arlington",
}


def _norm_college(s):
    s = s.lower().replace("&", "and")
    s = re.sub(r"[.'’()]", "", s)
    s = s.replace("-", " ")
    s = re.sub(r"\buniversity\b|\bcollege\b", "", s)
    return re.sub(r"\s+", " ", s).strip()


def load_college_conference_data(colleges):
    """Returns {college: {"conference": ..., "mascot": ...}} for as many of `colleges`
    as can be matched (mechanically or via the alias table above) to a school in
    college_conferences.csv. Colleges with no match are simply omitted."""
    csv_rows = [r[0] for r in csv.reader(open(COLLEGE_CONFERENCES_CSV, encoding="utf-8")) if r][1:]
    entries = []
    conference = None
    for row in csv_rows:
        if row in COLLEGE_CONFERENCE_NAMES:
            conference = row
        else:
            entries.append((row, conference, _norm_college(row)))

    result = {}
    for college in colleges:
        if college in COLLEGE_NAME_ALIASES:
            alias = COLLEGE_NAME_ALIASES[college]
            if alias is None:
                continue
            nc = _norm_college(alias)
            exact = [e for e in entries if e[2] == nc]
            if not exact:
                continue
            full, conf, _ = exact[0]
            result[college] = {"conference": conf, "mascot": COLLEGE_MASCOT_OVERRIDES[college]}
            continue

        nc = _norm_college(college)
        prefix_hits = [e for e in entries if e[2].startswith(nc + " ")]
        filtered = [e for e in prefix_hits if e[2][len(nc):].strip().split(" ")[0] not in COLLEGE_BRANCH_QUALIFIERS]
        chosen = filtered[0] if len(filtered) == 1 else (prefix_hits[0] if len(prefix_hits) == 1 else None)
        if chosen is None:
            continue
        full, conf, nfull = chosen
        mascot_norm = nfull[len(nc):].strip()
        n_words = len(mascot_norm.split())
        mascot = " ".join(full.split()[-n_words:]) if n_words else ""
        result[college] = {"conference": conf, "mascot": mascot}

    return result


def main():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row

    team_names = load_team_names()
    franchise_id_by_team, franchise_name_by_id = load_franchise_map()

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

    # per-season awards text (e.g. "MVP-3,ROY-1,AS,NBA2,DEF2"), keyed by (player_id, season)
    awards_by_season = {
        (r["player_id"], r["season"]): (r["awards"] or "").strip()
        for r in con.execute('SELECT player_id, season, awards FROM players_reg_szn_per_game')
    }

    # accumulate per (team, decade, stat) -> per player total, for decade_questions
    stat_totals = defaultdict(lambda: defaultdict(float))  # key: (team, decade, stat) -> player_id -> total

    # accumulate per (team, decade, player) -> position -> games, so decade_questions'
    # position hint can show whichever position that player played the most games at
    # for that specific team during that specific decade (not their whole-career position)
    team_decade_player_pos_games = defaultdict(lambda: defaultdict(float))

    # accumulate per player -> position -> career games, so draft_questions and
    # fill_blank_boards can show whichever position a player logged the most
    # regular-season career games at (their "primary" position)
    career_pos_games = defaultdict(lambda: defaultdict(float))

    # accumulate per (player, decade) -> position -> games, for fill_blank_boards'
    # decade-scope position hint (most games played at a position during that decade)
    decade_player_pos_games = defaultdict(lambda: defaultdict(float))

    # accumulate per (player, season) -> combined season totals, for player_career_questions
    # and fill_blank_boards
    season_totals = defaultdict(
        lambda: {
            "g": 0, "gs": 0, "mp": 0, "pts": 0, "trb": 0, "ast": 0, "tp": 0, "blk": 0, "stl": 0,
            "teams": [], "positions": [],
            # some stats weren't tracked league-wide in every season (e.g. games-started
            # before 1970-71, rebounds before 1950-51, minutes before 1951-52, blocks/steals
            # before 1973-74) - track whether we actually saw a real (non-null) value so
            # those cells can show "-"
            "gsTracked": False, "trbTracked": False, "mpTracked": False, "blkTracked": False, "stlTracked": False,
        }
    )

    for r in rows:
        team = (r["team"] or "").strip()
        if team in MULTI_TEAM_CODES or team not in team_names:
            continue
        pid = r["player_id"]
        season = r["season"]
        decade = season_decade(season)

        # Decade Team Leader groups by the current, still-active franchise (e.g. CHA
        # and CHO both roll up under one Charlotte Hornets franchise) rather than the
        # historical team code - stints with a defunct franchise don't count at all.
        franchise_id = franchise_id_by_team.get(team)
        if franchise_id:
            for stat_key, _, min_year in STATS:
                if min_year and decade < min_year:
                    continue
                col = "tp" if stat_key == "3p" else stat_key
                val = r[col] or 0
                stat_totals[(franchise_id, decade, stat_key)][pid] += val

        pos = (r["pos"] or "").strip()
        if pos:
            if franchise_id:
                team_decade_player_pos_games[(franchise_id, decade, pid)][pos] += r["g"] or 0
            career_pos_games[pid][pos] += r["g"] or 0
            decade_player_pos_games[(pid, decade)][pos] += r["g"] or 0

        s = season_totals[(pid, season)]
        s["g"] += r["g"] or 0
        s["gs"] += r["gs"] or 0
        s["mp"] += r["mp"] or 0
        s["pts"] += r["pts"] or 0
        s["trb"] += r["trb"] or 0
        s["ast"] += r["ast"] or 0
        s["tp"] += r["tp"] or 0
        s["blk"] += r["blk"] or 0
        s["stl"] += r["stl"] or 0
        if r["gs"] is not None:
            s["gsTracked"] = True
        if r["trb"] is not None:
            s["trbTracked"] = True
        if r["mp"] is not None:
            s["mpTracked"] = True
        if r["blk"] is not None:
            s["blkTracked"] = True
        if r["stl"] is not None:
            s["stlTracked"] = True
        if team not in s["teams"]:
            s["teams"].append(team)
        pos = (r["pos"] or "").strip()
        if pos and pos not in s["positions"]:
            s["positions"].append(pos)

    primary_pos = {pid: max(posmap.items(), key=lambda kv: kv[1])[0] for pid, posmap in career_pos_games.items()}

    # ---- decade_questions.json ----
    decade_questions = []
    qid = 0
    for (franchise_id, decade, stat_key), player_vals in stat_totals.items():
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
        pos_games = team_decade_player_pos_games.get((franchise_id, decade, best_pid))
        pos = max(pos_games.items(), key=lambda kv: kv[1])[0] if pos_games else p["pos"]
        decade_questions.append(
            {
                "id": qid,
                "decade": decade,
                "decadeLabel": f"{decade}s",
                "teamAbbr": franchise_id,
                "teamName": franchise_name_by_id[franchise_id],
                "statKey": stat_key,
                "statLabel": stat_label,
                "value": round(best_val),
                "answerId": best_pid,
                "answerName": p["name"],
                "pos": pos,
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
        if len(seasons) < MIN_CAREER_SEASONS:
            continue
        total_games = sum(s["g"] for _, s in seasons)
        if total_games < MIN_CAREER_GAMES:
            continue
        has_any_award = any(awards_by_season.get((pid, season), "") for season, _ in seasons)
        if not has_any_award:
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
                "fromYear": p["from"],
                "toYear": p["to"],
                "seasons": [
                    {
                        "season": season,
                        "g": round(s["g"]),
                        "gs": round(s["gs"]) if s["gsTracked"] else "-",
                        "mpg": per_game(s["mp"], s["g"]) if s["mpTracked"] else "-",
                        "pts": per_game(s["pts"], s["g"]),
                        "trb": per_game(s["trb"], s["g"]) if s["trbTracked"] else "-",
                        "ast": per_game(s["ast"], s["g"]),
                        "blk": per_game(s["blk"], s["g"]) if s["blkTracked"] else "-",
                        "stl": per_game(s["stl"], s["g"]) if s["stlTracked"] else "-",
                        "pos": "-".join(s["positions"]),
                        "team": ", ".join(s["teams"]),
                        "awards": awards_by_season.get((pid, season), ""),
                    }
                    for season, s in seasons
                ],
            }
        )
    with open(OUT / "player_career_questions.json", "w", encoding="utf-8") as f:
        json.dump(player_career_questions, f, ensure_ascii=False)
    print(f"player_career_questions.json: {len(player_career_questions)} players")

    # ---- this_or_that_pool.json ----
    # regular-season double-doubles/triple-doubles per player, derived from game logs.
    # "Regular season" here means all_league_games' own Game Type = Regular Season, with
    # Play-In Games and the NBA Cup Final excluded too (those aren't normal regular-season
    # games even though they aren't playoff games either).
    reg_season_game_ids = {
        r["game_id"]
        for r in con.execute(
            "SELECT game_id FROM all_league_games WHERE game_type = 'Regular Season' "
            "AND (notes IS NULL OR notes NOT IN ('Play-In Game', 'NBA Cup Final'))"
        )
    }
    dd_td = defaultdict(lambda: {"dd": 0, "td": 0})
    game_high_pts = defaultdict(int)
    for r in con.execute(
        'SELECT player_id, game_id, "double-double" as dd, "triple-double" as td, pts FROM player_game_logs'
    ):
        if r["game_id"] not in reg_season_game_ids:
            continue
        e = dd_td[r["player_id"]]
        e["dd"] += r["dd"] or 0
        e["td"] += r["td"] or 0
        pts = r["pts"] or 0
        if pts > game_high_pts[r["player_id"]]:
            game_high_pts[r["player_id"]] = pts

    career_rows = con.execute(
        'SELECT player_id, g, pts, trb, ast, "3p" as tp FROM players_career_reg_szn_totals'
    ).fetchall()
    career_mpg = {
        r["player_id"]: r["mp"] for r in con.execute("SELECT player_id, mp FROM players_career_reg_szn_per_game")
    }
    career_ppg = {
        r["player_id"]: r["pts"] for r in con.execute("SELECT player_id, pts FROM players_career_reg_szn_per_game")
    }
    career_total_min = {
        r["player_id"]: r["mp"] for r in con.execute('SELECT player_id, mp FROM players_career_reg_szn_totals')
    }

    # pts/trb/ast/3p eligibility = top 250 all-time in that stat (players_career_reg_szn_totals).
    # dd/td have no career-totals column to rank by, so they keep a flat threshold instead.
    # highPts (single-game career high) only requires a 30+ career MPG - it's not ranked by
    # a career total at all, since a bench player's one huge game is exactly the kind of
    # surprising match-up this stat is meant to produce.
    TOP_N_ALL_TIME = 250
    MIN_CAREER_HIGH_MPG = 30

    this_or_that_pool = {}
    for stat_key, label, threshold in THIS_OR_THAT_STATS:
        eligible = []
        if stat_key in ("dd", "td"):
            for r in career_rows:
                pid = r["player_id"]
                p = players.get(pid)
                if not p:
                    continue
                value = dd_td.get(pid, {}).get(stat_key, 0)
                if value >= threshold:
                    eligible.append(
                        {
                            "id": pid, "name": p["name"], "value": round(value),
                            "fromYear": p["from"], "toYear": p["to"],
                            "careerG": round(r["g"] or 0), "careerMpg": round(career_mpg.get(pid) or 0, 1),
                        }
                    )
        elif stat_key == "highPts":
            for pid, value in game_high_pts.items():
                p = players.get(pid)
                if not p or value <= 0:
                    continue
                if (career_mpg.get(pid) or 0) < MIN_CAREER_HIGH_MPG:
                    continue
                eligible.append(
                    {
                        "id": pid, "name": p["name"], "value": round(value),
                        "fromYear": p["from"], "toYear": p["to"],
                        "careerPpg": round(career_ppg.get(pid) or 0, 1),
                        "careerTotalMin": round(career_total_min.get(pid) or 0),
                    }
                )
        else:
            col = "tp" if stat_key == "3p" else stat_key
            ranked = sorted(career_rows, key=lambda r: -(r[col] or 0))[:TOP_N_ALL_TIME]
            for r in ranked:
                pid = r["player_id"]
                p = players.get(pid)
                value = r[col] or 0
                if not p or value <= 0:
                    continue
                eligible.append(
                    {
                        "id": pid, "name": p["name"], "value": round(value),
                        "fromYear": p["from"], "toYear": p["to"],
                        "careerG": round(r["g"] or 0), "careerMpg": round(career_mpg.get(pid) or 0, 1),
                    }
                )

        eligible.sort(key=lambda x: -x["value"])

        pairs = []
        for i in range(len(eligible) - 1):
            a = eligible[i]
            if a["value"] <= 0:
                continue
            # walk forward past near-identical neighbors until the gap is big
            # enough to be a real question, but stop before it gets too easy
            for j in range(i + 1, len(eligible)):
                b = eligible[j]
                if b["value"] == a["value"]:
                    continue
                ratio = b["value"] / a["value"]
                if ratio < PAIR_RATIO_MIN:
                    break
                if ratio <= PAIR_RATIO_MAX:
                    pairs.append([a, b])
                    break

        this_or_that_pool[stat_key] = {"label": label, "pairs": pairs}
        print(f"this_or_that[{stat_key}]: {len(eligible)} eligible players, {len(pairs)} close pairs")

    with open(OUT / "this_or_that_pool.json", "w", encoding="utf-8") as f:
        json.dump(this_or_that_pool, f, ensure_ascii=False)

    # ---- college_questions.json / colleges_search.json ----
    # Only players with exactly one college on record (all_players.colleges - richer than
    # drafts.college since it also covers undrafted players), at least one career All-Star
    # selection, and at least 25 career minutes per game. Players whose single college isn't
    # in the conference CSV are simply skipped rather than chased down further - too obscure
    # a hint either way.
    MIN_COLLEGE_MPG = 25
    all_star_ids = {
        r["player_id"] for r in con.execute("SELECT DISTINCT player_id FROM player_accolades WHERE award_type='All-Star'")
    }
    colleges_by_player = defaultdict(set)
    for r in con.execute("SELECT player_id, colleges FROM all_players WHERE colleges IS NOT NULL AND colleges != ''"):
        for college in r["colleges"].split(", "):
            college = college.strip()
            if college:
                colleges_by_player[r["player_id"]].add(college)

    all_colleges = {c for colleges in colleges_by_player.values() for c in colleges}
    college_conf_data = load_college_conference_data(all_colleges)

    college_questions = []
    qid = 0
    for pid, colleges in colleges_by_player.items():
        if pid not in all_star_ids or len(colleges) != 1:
            continue
        if (career_mpg.get(pid) or 0) < MIN_COLLEGE_MPG:
            continue
        college = next(iter(colleges))
        conf_data = college_conf_data.get(college)
        if not conf_data:
            continue
        p = players.get(pid)
        if not p or p["from"] is None or p["to"] is None:
            continue
        qid += 1
        college_questions.append(
            {
                "id": qid,
                "playerId": pid,
                "name": p["name"],
                "college": college,
                "conference": conf_data["conference"],
                "mascot": conf_data["mascot"],
                "fromYear": p["from"],
                "toYear": p["to"],
            }
        )
    with open(OUT / "college_questions.json", "w", encoding="utf-8") as f:
        json.dump(college_questions, f, ensure_ascii=False)
    print(f"college_questions.json: {len(college_questions)} players")

    colleges_search = sorted({q["college"] for q in college_questions})
    with open(OUT / "colleges_search.json", "w", encoding="utf-8") as f:
        json.dump(colleges_search, f, ensure_ascii=False)
    print(f"colleges_search.json: {len(colleges_search)} distinct colleges")

    # ---- draft_questions.json ----
    # NBA/BAA drafts only, with a valid round/pick and a known career position.
    # Players drafted more than once in NBA history (didn't sign the first
    # time, got re-drafted) are excluded entirely rather than picked from.
    # Also requires the player to have played at least 1 game for the team that
    # drafted them during their rookie season.
    MIN_DRAFT_MPG = 25

    draft_rows = con.execute(
        "SELECT player_id, draft_year, round, pick, team, college FROM drafts "
        "WHERE league IN ('NBA', 'BAA') AND round IS NOT NULL AND pick IS NOT NULL"
    ).fetchall()

    draft_by_player = defaultdict(list)
    for r in draft_rows:
        draft_by_player[r["player_id"]].append(r)

    # per (player, season) -> team -> games, so we can confirm a drafted player
    # actually suited up for the team that drafted them during their rookie season
    # (excludes players who never played a game for their drafting team - e.g.
    # traded away before playing, or who signed elsewhere first)
    team_games_by_player_season = defaultdict(lambda: defaultdict(float))
    for r in rows:
        team = (r["team"] or "").strip()
        if team in MULTI_TEAM_CODES or team not in team_names:
            continue
        team_games_by_player_season[(r["player_id"], r["season"])][team] += r["g"] or 0

    draft_questions = []
    qid = 0
    for pid, entries in draft_by_player.items():
        if len(entries) > 1:
            continue  # drafted more than once - excluded per user request
        r = entries[0]
        p = players.get(pid)
        if not p or not p["pos"] or p["from"] is None or p["to"] is None:
            continue
        if pid not in all_star_ids:
            continue
        if (career_mpg.get(pid) or 0) < MIN_DRAFT_MPG:
            continue
        team_abbr = (r["team"] or "").strip()
        if team_abbr not in team_names:
            continue
        rookie_season = f"{p['from']}-{(p['from'] + 1) % 100:02d}"
        if team_games_by_player_season.get((pid, rookie_season), {}).get(team_abbr, 0) < 1:
            continue  # never actually played a game for the team that drafted them as a rookie
        college = (r["college"] or "").strip()
        qid += 1
        draft_questions.append(
            {
                "id": qid,
                "playerId": pid,
                "name": p["name"],
                "draftYear": r["draft_year"],
                "round": round(r["round"]),
                "pick": round(r["pick"]),
                "teamAbbr": team_abbr,
                "teamName": team_names[team_abbr],
                "pos": primary_pos.get(pid, p["pos"]),
                "college": college if college else "Did Not Attend",
                "fromYear": p["from"],
                "toYear": p["to"],
            }
        )
    with open(OUT / "draft_questions.json", "w", encoding="utf-8") as f:
        json.dump(draft_questions, f, ensure_ascii=False)
    print(f"draft_questions.json: {len(draft_questions)} players")

    # ---- awards_season_questions.json ----
    # Guess who won a specific award in a specific season. Difficulty filters on the
    # award's own season year - it doesn't matter when the winning player's career
    # was, only when they won this specific award (e.g. Easy can ask about a 1990s
    # player's 2015-16 Sixth Man of the Year award).
    AWARDS_SEASON_TYPES = [
        ("MVP", "MVP"),
        ("ROY", "Rookie of the Year"),
        ("DPOY", "Defensive Player of the Year"),
        ("Sixth Man of the Year", "Sixth Man of the Year"),
        ("Most Improved Player", "Most Improved Player"),
        ("Finals MVP", "Finals MVP"),
    ]
    award_type_keys = [k for k, _ in AWARDS_SEASON_TYPES]
    award_placeholders = ",".join("?" for _ in award_type_keys)
    award_rows = con.execute(
        f"SELECT player_id, award_type, season, all_teams FROM player_accolades "
        f"WHERE award_type IN ({award_placeholders})",
        award_type_keys,
    ).fetchall()

    awards_season_questions = []
    qid = 0
    for r in award_rows:
        pid = r["player_id"]
        p = players.get(pid)
        if not p:
            continue
        season = r["season"]
        s = season_totals.get((pid, season))
        pos = "-".join(s["positions"]) if s and s["positions"] else p["pos"]
        if not pos:
            continue
        team_codes = [t.strip() for t in (r["all_teams"] or "").split(",") if t.strip()]
        team_codes = [t for t in team_codes if t in team_names]
        if not team_codes:
            continue
        award_label = next(lbl for k, lbl in AWARDS_SEASON_TYPES if k == r["award_type"])
        qid += 1
        awards_season_questions.append(
            {
                "id": qid,
                "playerId": pid,
                "name": p["name"],
                "awardLabel": award_label,
                "season": season,
                "seasonYear": int(season.split("-")[0]),
                "pos": pos,
                "team": ", ".join(team_names[t] for t in team_codes),
            }
        )
    with open(OUT / "awards_season_questions.json", "w", encoding="utf-8") as f:
        json.dump(awards_season_questions, f, ensure_ascii=False)
    print(f"awards_season_questions.json: {len(awards_season_questions)} questions")

    # ---- trophy_case_questions.json ----
    # Guess the player from their full career accolade resume (counts of each
    # award type, e.g. "2x All-Star, 2x All-NBA, 1x Championship"). Only the
    # award types below count toward a resume, and only players with 3+
    # distinct award types qualify - except All-Rookie, which doesn't count
    # toward that 3-type minimum (it can still show up in the resume itself,
    # a player just needs 3 other distinct types beyond it). If more than one
    # player ends up with the exact same resume (same types, same counts
    # each), that resume is ambiguous and is dropped entirely - every
    # question here has exactly one possible answer.
    TROPHY_CASE_AWARD_TYPES = {
        "All-BAA", "All-Defensive", "All-NBA", "All-Rookie", "All-Star",
        "All-Star Game MVP", "Assist Champ", "Block Champ", "Championship",
        "Clutch Player of the Year", "DPOY", "Finals MVP", "Hall of Fame",
        "Most Improved Player", "MVP", "NBA 75th Anniversary Team",
        "Rebound Champ", "ROY", "Scoring Champ", "Sixth Man of the Year",
        "Steal Champ",
    }
    MIN_TROPHY_CASE_TYPES = 3

    trophy_award_counts = defaultdict(lambda: defaultdict(int))
    for r in con.execute("SELECT player_id, award_type FROM player_accolades"):
        if r["award_type"] in TROPHY_CASE_AWARD_TYPES:
            trophy_award_counts[r["player_id"]][r["award_type"]] += 1

    # distinct teams across a player's whole regular-season career, chronologically
    trophy_career_teams = defaultdict(list)
    for r in con.execute('SELECT player_id, team, season FROM players_reg_szn_totals ORDER BY season'):
        team = (r["team"] or "").strip()
        if team in MULTI_TEAM_CODES or team not in team_names:
            continue
        lst = trophy_career_teams[r["player_id"]]
        if team not in lst:
            lst.append(team)

    signature_groups = defaultdict(list)  # signature tuple -> [player_id, ...]
    for pid, counts in trophy_award_counts.items():
        # All-Rookie doesn't count toward the 3-type minimum - it can still show up
        # in the resume, but a player needs 3 other distinct types beyond it
        qualifying_types = [t for t in counts if t != "All-Rookie"]
        if len(qualifying_types) < MIN_TROPHY_CASE_TYPES:
            continue
        p = players.get(pid)
        if not p or p["from"] is None or p["to"] is None:
            continue
        if not trophy_career_teams.get(pid):
            continue
        signature = tuple(sorted(counts.items()))
        signature_groups[signature].append(pid)

    trophy_case_questions = []
    qid = 0
    dropped_ambiguous = 0
    for signature, pids in signature_groups.items():
        if len(pids) != 1:
            dropped_ambiguous += 1
            continue
        pid = pids[0]
        p = players[pid]
        accolades = sorted(signature, key=lambda kv: (-kv[1], kv[0]))
        qid += 1
        trophy_case_questions.append(
            {
                "id": qid,
                "playerId": pid,
                "name": p["name"],
                "accolades": [{"type": t, "count": c} for t, c in accolades],
                "fromYear": p["from"],
                "toYear": p["to"],
                "years": f"{p['from']}–{p['to']}",
                "team": ", ".join(team_names[t] for t in trophy_career_teams[pid]),
            }
        )
    with open(OUT / "trophy_case_questions.json", "w", encoding="utf-8") as f:
        json.dump(trophy_case_questions, f, ensure_ascii=False)
    print(f"trophy_case_questions.json: {len(trophy_case_questions)} questions ({dropped_ambiguous} ambiguous resumes dropped)")

    # ---- teammates_questions.json ----
    # Guess who a mystery player played the most games with as an actual
    # teammate: same team, same game, counted from player_game_logs joined to
    # all_league_games, regular season + playoffs combined, excluding Play-In
    # Games and the NBA Cup Final. Only players with 5+ career All-NBA
    # selections can be the *prompted* player (the mystery name shown) - the
    # answer (the teammate being guessed) has no such requirement at all, so
    # an obscure role player can absolutely be the correct answer. Difficulty
    # filters on the prompted player's own career span only, per user's
    # explicit example (LeBron counts for Easy even though his most-played
    # teammate, Ilgauskas, started in the 1990s and has no All-NBA selections).
    MIN_TEAMMATES_ALL_NBA = 5
    MIN_SHARED_GAMES = 250  # a real, sustained teammate pairing, not a fleeting one

    all_nba_counts = defaultdict(int)
    for r in con.execute("SELECT player_id FROM player_accolades WHERE award_type = 'All-NBA'"):
        all_nba_counts[r["player_id"]] += 1
    prompt_eligible_ids = {pid for pid, c in all_nba_counts.items() if c >= MIN_TEAMMATES_ALL_NBA}

    eligible_game_ids = {
        r["game_id"]
        for r in con.execute(
            "SELECT game_id FROM all_league_games WHERE game_type IN ('Regular Season', 'Playoffs') "
            "AND (notes IS NULL OR notes NOT IN ('Play-In Game', 'NBA Cup Final'))"
        )
    }

    # (game_id, team_id) -> [player_id, ...] on that team, in that game
    group_players = defaultdict(list)
    # player_id -> [(game_id, team_id), ...], only tracked for prompt-eligible players
    groups_by_prompt = defaultdict(list)
    for r in con.execute("SELECT player_id, game_id, team_id FROM player_game_logs"):
        if r["game_id"] not in eligible_game_ids:
            continue
        key = (r["game_id"], r["team_id"])
        group_players[key].append(r["player_id"])
        if r["player_id"] in prompt_eligible_ids:
            groups_by_prompt[r["player_id"]].append(key)

    teammates_questions = []
    qid = 0
    for pid, groups in groups_by_prompt.items():
        co_games = defaultdict(int)
        co_teams = defaultdict(set)
        for game_id, team_id in groups:
            for other in group_players[(game_id, team_id)]:
                if other == pid:
                    continue
                co_games[other] += 1
                co_teams[other].add(team_id)
        if not co_games:
            continue
        answer_id, shared_games = max(co_games.items(), key=lambda kv: kv[1])
        if shared_games < MIN_SHARED_GAMES:
            continue
        p = players.get(pid)
        a = players.get(answer_id)
        if not p or not a or p["from"] is None or p["to"] is None:
            continue
        team_codes = [t for t in co_teams[answer_id] if t in team_names]
        if not team_codes:
            continue
        pos = primary_pos.get(answer_id, a["pos"])
        if not pos:
            continue
        qid += 1
        teammates_questions.append(
            {
                "id": qid,
                "playerId": pid,
                "name": p["name"],
                "fromYear": p["from"],
                "toYear": p["to"],
                "sharedGames": shared_games,
                "answerId": answer_id,
                "answerName": a["name"],
                "pos": pos,
                "team": ", ".join(team_names[t] for t in sorted(team_codes)),
            }
        )
    with open(OUT / "teammates_questions.json", "w", encoding="utf-8") as f:
        json.dump(teammates_questions, f, ensure_ascii=False)
    print(f"teammates_questions.json: {len(teammates_questions)} questions")

    # ---- fill_blank_boards.json ----
    # Top-5 stat leaderboards, one of 4 formats (the client splits its random pick
    # evenly 25/25/25/25 across these): a specific season, a specific decade,
    # all-time career, or an All-NBA/All-Defensive team roster for a season/tier.
    # Season/decade/all-time all offer regular-season and playoff variants, total
    # or per-game, per FILL_BLANK_STATS below. The client picks a board at runtime,
    # blanks out one random player, and the user has to guess who's missing.
    FILL_BLANK_STATS = [
        ("pts", "Points", 0),
        ("trb", "Rebounds", 0),
        ("ast", "Assists", 0),
        ("3p", "3-Pointers Made", 1979),  # first season with a 3-point line
    ]
    MIN_GAMES_SEASON_PG = 40  # min games in that season to qualify for a per-game board
    MIN_GAMES_CAREER_PG = MIN_CAREER_GAMES  # min career reg-season games for a per-game board
    MIN_GAMES_PLAYOFF_PG = 25  # playoff sample sizes are much smaller

    def stat_label_for(base_label, measure):
        return f"Total {base_label}" if measure == "total" else f"{base_label} Per Game"

    # distinct teams across a player's whole regular-season / playoff career, in
    # chronological order (season strings sort lexically in chronological order)
    career_reg_teams = defaultdict(list)
    for r in con.execute('SELECT player_id, team, season FROM players_reg_szn_totals ORDER BY season'):
        team = (r["team"] or "").strip()
        if team in MULTI_TEAM_CODES or team not in team_names:
            continue
        lst = career_reg_teams[r["player_id"]]
        if team not in lst:
            lst.append(team)

    career_playoff_teams = defaultdict(list)
    for r in con.execute('SELECT player_id, team, season FROM players_post_szn_totals ORDER BY season'):
        team = (r["team"] or "").strip()
        if team not in team_names:
            continue
        lst = career_playoff_teams[r["player_id"]]
        if team not in lst:
            lst.append(team)

    career_reg_totals = {r["player_id"]: r for r in con.execute(
        'SELECT player_id, g, pts, trb, ast, "3p" as tp FROM players_career_reg_szn_totals'
    )}
    career_reg_pg = {r["player_id"]: r for r in con.execute(
        'SELECT player_id, g, pts, trb, ast, "3p" as tp FROM players_career_reg_szn_per_game'
    )}
    career_po_totals = {r["player_id"]: r for r in con.execute(
        'SELECT player_id, g, pts, trb, ast, "3p" as tp FROM players_career_post_szn_totals'
    )}
    career_po_pg = {r["player_id"]: r for r in con.execute(
        'SELECT player_id, g, pts, trb, ast, "3p" as tp FROM players_career_post_szn_per_game'
    )}

    fill_blank_boards = []
    bid = 0

    # -- season-scope boards --
    season_player_map = defaultdict(list)
    for (pid, season), s in season_totals.items():
        season_player_map[season].append((pid, s))

    for season, plist in season_player_map.items():
        start_year = int(season.split("-")[0])
        for stat_key, stat_label, min_year in FILL_BLANK_STATS:
            if min_year and start_year < min_year:
                continue
            # 3-Pointers Made: only a season total board, no per-game board
            measures = ("total",) if stat_key == "3p" else ("total", "perGame")
            for measure in measures:
                entries = []
                for pid, s in plist:
                    p = players.get(pid)
                    if not p or not p["pos"]:
                        continue
                    games = s["g"] or 0
                    if games <= 0:
                        continue
                    raw = s[stat_key if stat_key != "3p" else "tp"]
                    if measure == "perGame":
                        if games < MIN_GAMES_SEASON_PG:
                            continue
                        value = round(raw / games, 1)
                    else:
                        value = round(raw)
                    if value <= 0:
                        continue
                    entries.append(
                        {
                            "playerId": pid,
                            "name": p["name"],
                            "value": value,
                            "pos": "-".join(s["positions"]) or p["pos"],
                            "team": ", ".join(team_names[t] for t in s["teams"]),
                        }
                    )
                entries.sort(key=lambda e: -e["value"])
                top5 = entries[:5]
                if len(top5) < 5:
                    continue
                bid += 1
                fill_blank_boards.append(
                    {
                        "id": bid,
                        "statKey": stat_key,
                        "statLabel": stat_label_for(stat_label, measure),
                        "measure": measure,
                        "scope": "season",
                        "format": "season",
                        "scopeLabel": f"{season} Season",
                        "season": season,
                        "seasonYear": start_year,
                        "players": top5,
                    }
                )

    # -- all-time scope boards (regular season and playoffs) --
    ALL_TIME_SCOPES = [
        ("allTimeReg", "All-Time (Regular Season)", career_reg_totals, career_reg_pg, career_reg_teams, MIN_GAMES_CAREER_PG),
        ("allTimePlayoffs", "All-Time (Playoffs)", career_po_totals, career_po_pg, career_playoff_teams, MIN_GAMES_PLAYOFF_PG),
    ]
    for scope, scope_label, totals_map, pg_map, team_map, min_games_pg in ALL_TIME_SCOPES:
        for stat_key, stat_label, _ in FILL_BLANK_STATS:
            # 3-Pointers Made: only an all-time (regular season) total board - no
            # per-game board, and no playoffs board at all
            if stat_key == "3p" and scope == "allTimePlayoffs":
                continue
            col = "tp" if stat_key == "3p" else stat_key
            measures = ("total",) if stat_key == "3p" else ("total", "perGame")
            for measure in measures:
                src_map = pg_map if measure == "perGame" else totals_map
                entries = []
                for pid, r in src_map.items():
                    p = players.get(pid)
                    if not p or not p["pos"]:
                        continue
                    games = r["g"] or 0
                    if games <= 0:
                        continue
                    if measure == "perGame":
                        if games < min_games_pg:
                            continue
                        value = round(r[col] or 0, 1)
                    else:
                        value = round(r[col] or 0)
                    if value <= 0:
                        continue
                    teams = team_map.get(pid) or []
                    if not teams:
                        continue
                    entries.append(
                        {
                            "playerId": pid,
                            "name": p["name"],
                            "value": value,
                            "pos": primary_pos.get(pid, p["pos"]),
                            "team": ", ".join(team_names[t] for t in teams),
                        }
                    )
                entries.sort(key=lambda e: -e["value"])
                top5 = entries[:5]
                if len(top5) < 5:
                    continue
                bid += 1
                fill_blank_boards.append(
                    {
                        "id": bid,
                        "statKey": stat_key,
                        "statLabel": stat_label_for(stat_label, measure),
                        "measure": measure,
                        "scope": scope,
                        "format": "allTime",
                        "scopeLabel": scope_label,
                        "season": None,
                        "seasonYear": None,
                        "players": top5,
                    }
                )

    # -- decade-scope boards (regular season and playoffs) --
    # Same 4 stats as season-scope, aggregated across a whole decade instead of one
    # season. Regular season gets total + per-game; playoffs is total-only (playoff
    # per-decade sample sizes get thin enough that per-game is less meaningful), and
    # 3-Pointers Made isn't offered for playoffs at all, matching the all-time rule.
    MIN_GAMES_DECADE_PG = 200  # min games across that whole decade to qualify for a per-game board

    decade_reg_totals = defaultdict(lambda: {"pts": 0, "trb": 0, "ast": 0, "tp": 0, "g": 0})
    for (pid, season), s in season_totals.items():
        d = decade_reg_totals[(pid, season_decade(season))]
        d["pts"] += s["pts"]
        d["trb"] += s["trb"]
        d["ast"] += s["ast"]
        d["tp"] += s["tp"]
        d["g"] += s["g"]

    decade_reg_teams = defaultdict(list)
    for r in con.execute('SELECT player_id, team, season FROM players_reg_szn_totals ORDER BY season'):
        team = (r["team"] or "").strip()
        if team in MULTI_TEAM_CODES or team not in team_names:
            continue
        lst = decade_reg_teams[(r["player_id"], season_decade(r["season"]))]
        if team not in lst:
            lst.append(team)

    decade_po_totals = defaultdict(lambda: {"pts": 0, "trb": 0, "ast": 0, "tp": 0, "g": 0})
    decade_po_teams = defaultdict(list)
    decade_po_pos_games = defaultdict(lambda: defaultdict(float))
    for r in con.execute(
        'SELECT player_id, team, season, pts, trb, ast, "3p" as tp, g, pos FROM players_post_szn_totals ORDER BY season'
    ):
        team = (r["team"] or "").strip()
        if team not in team_names:
            continue
        decade = season_decade(r["season"])
        pid = r["player_id"]
        d = decade_po_totals[(pid, decade)]
        d["pts"] += r["pts"] or 0
        d["trb"] += r["trb"] or 0
        d["ast"] += r["ast"] or 0
        d["tp"] += r["tp"] or 0
        d["g"] += r["g"] or 0
        lst = decade_po_teams[(pid, decade)]
        if team not in lst:
            lst.append(team)
        pos = (r["pos"] or "").strip()
        if pos:
            decade_po_pos_games[(pid, decade)][pos] += r["g"] or 0

    DECADE_SCOPES = [
        ("decadeReg", "Regular Season", decade_reg_totals, decade_reg_teams, decade_player_pos_games, MIN_GAMES_DECADE_PG, True),
        ("decadePlayoffs", "Playoffs", decade_po_totals, decade_po_teams, decade_po_pos_games, MIN_GAMES_DECADE_PG, False),
    ]
    for scope, scope_suffix, totals_by_decade_player, teams_by_decade_player, pos_by_decade_player, min_games_pg, allow_per_game in DECADE_SCOPES:
        by_decade = defaultdict(list)
        for (pid, decade), d in totals_by_decade_player.items():
            by_decade[decade].append((pid, d))

        for decade, plist in by_decade.items():
            for stat_key, stat_label, min_year in FILL_BLANK_STATS:
                if stat_key == "3p" and (not allow_per_game or decade < 1980):
                    # no 3-Pointers Made board for playoffs at all, and regular-season
                    # 3PM only once the whole decade is inside the 3-point era
                    continue
                measures = ("total", "perGame") if (stat_key != "3p" and allow_per_game) else ("total",)
                for measure in measures:
                    entries = []
                    for pid, d in plist:
                        p = players.get(pid)
                        if not p or not p["pos"]:
                            continue
                        games = d["g"] or 0
                        if games <= 0:
                            continue
                        raw = d[stat_key if stat_key != "3p" else "tp"]
                        if measure == "perGame":
                            if games < min_games_pg:
                                continue
                            value = round(raw / games, 1)
                        else:
                            value = round(raw)
                        if value <= 0:
                            continue
                        teams = teams_by_decade_player.get((pid, decade)) or []
                        if not teams:
                            continue
                        pos_games = pos_by_decade_player.get((pid, decade))
                        pos = max(pos_games.items(), key=lambda kv: kv[1])[0] if pos_games else p["pos"]
                        entries.append(
                            {
                                "playerId": pid,
                                "name": p["name"],
                                "value": value,
                                "pos": pos,
                                "team": ", ".join(team_names[t] for t in teams),
                            }
                        )
                    entries.sort(key=lambda e: -e["value"])
                    top5 = entries[:5]
                    if len(top5) < 5:
                        continue
                    bid += 1
                    fill_blank_boards.append(
                        {
                            "id": bid,
                            "statKey": stat_key,
                            "statLabel": stat_label_for(stat_label, measure),
                            "measure": measure,
                            "scope": scope,
                            "format": "decade",
                            "scopeLabel": f"{decade}s ({scope_suffix})",
                            "season": None,
                            "seasonYear": decade,
                            "players": top5,
                        }
                    )

    # -- All-NBA / All-Defensive team roster boards --
    # e.g. "2015 2nd Team All-NBA" - no stat value, just the 5-player roster for
    # that team/season, with the same position/team-that-season hints as any
    # other season-scope board.
    TEAM_ORDINAL = {1: "1st", 2: "2nd", 3: "3rd"}
    team_award_rows = con.execute(
        "SELECT player_id, award_type, season, team_number FROM player_accolades "
        "WHERE award_type IN ('All-NBA', 'All-Defensive') AND team_number IS NOT NULL"
    ).fetchall()
    team_rosters = defaultdict(list)  # (award_type, season, team_number) -> [player_id, ...]
    for r in team_award_rows:
        key = (r["award_type"], r["season"], int(r["team_number"]))
        team_rosters[key].append(r["player_id"])

    for (award_type, season, team_number), pids in team_rosters.items():
        if len(pids) != 5:
            continue  # historical ties for the last spot don't fit a 5-player board
        start_year = int(season.split("-")[0])
        entries = []
        for pid in pids:
            p = players.get(pid)
            s = season_totals.get((pid, season))
            if not p or not s or not s["teams"]:
                continue
            pos = "-".join(s["positions"]) or p["pos"]
            if not pos:
                continue
            entries.append(
                {
                    "playerId": pid,
                    "name": p["name"],
                    "pos": pos,
                    "team": ", ".join(team_names[t] for t in s["teams"]),
                }
            )
        if len(entries) != 5:
            continue
        bid += 1
        ordinal = TEAM_ORDINAL.get(team_number, f"{team_number}th")
        fill_blank_boards.append(
            {
                "id": bid,
                "statKey": award_type,
                "statLabel": f"{start_year} {ordinal} Team {award_type}",
                "measure": "roster",
                "scope": "season",
                "format": "team",
                "scopeLabel": f"{season} Season",
                "season": season,
                "seasonYear": start_year,
                "players": entries,
            }
        )

    with open(OUT / "fill_blank_boards.json", "w", encoding="utf-8") as f:
        json.dump(fill_blank_boards, f, ensure_ascii=False)
    print(f"fill_blank_boards.json: {len(fill_blank_boards)} boards")


if __name__ == "__main__":
    main()
