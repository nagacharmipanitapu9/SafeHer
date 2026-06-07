"""
Safe Route — backend (v3)
=========================
Scoring weights updated to match the specification exactly:

             Crime   Lighting  Population  Anchors
  Day        0.35     0.10       0.25       0.30
  Night      0.30     0.30       0.20       0.20
  Late Night 0.30     0.35       0.20       0.15

Label thresholds (overall = 0-100 safety, higher = safer):
  Safest   >= 78
  Safe     >= 62
  Moderate >= 45
  Risky    < 45

Overall score = crime*w1 + lighting*w2 + population*w3 + anchors*w4
Risk %        = 100 - overall

All other logic (Overpass, OSRM, geocoding, DB crimes) unchanged from v2.
"""

import json
import math
import time
import requests as http_requests
from datetime import datetime, timezone
from flask import Blueprint, render_template, request, jsonify, session
from database import get_db

safe_route_bp = Blueprint('safe_route', __name__)

# ────────────────────────── Tunables ──────────────────────────
SEGMENT_LENGTH_M     = 120
CRIME_RADIUS_M       = 250
LIGHT_RADIUS_M       = 150
ANCHOR_RADIUS_M      = 600
ISOLATION_PENALTY_M  = 400
CRIME_HALF_LIFE_DAYS = 60
OVERPASS_URL         = 'https://overpass-api.de/api/interpreter'
OVERPASS_CACHE_TTL_S = 60 * 30   # 30 min
_OVERPASS_CACHE: dict = {}

SEVERITY_WEIGHT = {'high': 10, 'medium': 5, 'low': 2}

# ── Scoring weights — match spec exactly ──────────────────────
#    higher weight = factor matters more for final safety score
WEIGHTS = {
    'day': {
        'crime':      0.35,
        'lighting':   0.10,
        'population': 0.25,
        'anchor':     0.30,
    },
    'night': {
        'crime':      0.30,
        'lighting':   0.30,
        'population': 0.20,
        'anchor':     0.20,
    },
    'late_night': {
        'crime':      0.30,
        'lighting':   0.35,
        'population': 0.20,
        'anchor':     0.15,
    },
}

# ────────────────────────── Geo helpers ───────────────────────
def haversine(lat1, lng1, lat2, lng2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def chunk_route(points, target_len_m=SEGMENT_LENGTH_M):
    """Split polyline into ~target_len_m metre segments."""
    segments, cur, acc = [], [points[0]], 0.0
    for i in range(1, len(points)):
        d = haversine(points[i-1][0], points[i-1][1], points[i][0], points[i][1])
        acc += d
        cur.append(points[i])
        if acc >= target_len_m:
            mid = cur[len(cur)//2]
            segments.append({'center': mid, 'points': cur, 'length_m': acc})
            cur, acc = [points[i]], 0.0
    if len(cur) > 1:
        mid = cur[len(cur)//2]
        segments.append({'center': mid, 'points': cur, 'length_m': acc})
    return segments


def route_bbox(points, pad_deg=0.01):
    lats = [p[0] for p in points]
    lngs = [p[1] for p in points]
    return (min(lats)-pad_deg, min(lngs)-pad_deg,
            max(lats)+pad_deg, max(lngs)+pad_deg)


# ─────────────────────── Overpass (OSM) ───────────────────────
def overpass_query(query: str):
    """Cached POST to Overpass API."""
    key = hash(query)
    now = time.time()
    cached = _OVERPASS_CACHE.get(key)
    if cached and now - cached[0] < OVERPASS_CACHE_TTL_S:
        return cached[1]
    try:
        r = http_requests.post(OVERPASS_URL, data={'data': query}, timeout=20)
        elements = r.json().get('elements', []) if r.ok else []
    except Exception as e:
        print(f'Overpass error: {e}')
        elements = []
    _OVERPASS_CACHE[key] = (now, elements)
    return elements


def fetch_safety_infra(points):
    """
    Pull streetlights, anchors and lit/busy roads via Overpass.
    Uses two separate queries so partial failure still gives useful data.
    Falls back to urban-baseline synthetic infra when Overpass is unavailable.
    """
    s, w, n, e = route_bbox(points)
    bbox = f'{s},{w},{n},{e}'

    q_nodes = f"""
    [out:json][timeout:15];
    (
      node["highway"="street_lamp"]({bbox});
      node["highway"="bus_stop"]({bbox});
      node["amenity"="police"]({bbox});
      node["amenity"="hospital"]({bbox});
      node["amenity"="clinic"]({bbox});
      node["amenity"="pharmacy"]({bbox});
      node["amenity"="atm"]({bbox});
      node["amenity"="bank"]({bbox});
      node["amenity"="school"]({bbox});
      node["amenity"="college"]({bbox});
      node["amenity"="place_of_worship"]({bbox});
      node["amenity"~"fuel|fast_food|convenience|cafe|restaurant"]({bbox});
      node["shop"~"convenience|supermarket|general"]({bbox});
    );
    out tags qt;
    """

    q_ways = f"""
    [out:json][timeout:15];
    (
      way["highway"~"primary|secondary|tertiary|residential"]["lit"="yes"]({bbox});
      way["highway"~"primary|secondary|tertiary"]({bbox});
    );
    out center tags qt;
    """

    def _run(q, label):
        key = hash(q)
        now = time.time()
        cached = _OVERPASS_CACHE.get(key)
        if cached and now - cached[0] < OVERPASS_CACHE_TTL_S:
            return cached[1]
        try:
            r = http_requests.post(OVERPASS_URL, data={'data': q}, timeout=16)
            els = r.json().get('elements', []) if r.ok else []
            _OVERPASS_CACHE[key] = (now, els)
            print(f'Overpass {label}: {len(els)} elements')
            return els
        except Exception as e:
            print(f'Overpass {label} error (non-fatal): {e}')
            return []

    node_els = _run(q_nodes, 'nodes')
    way_els  = _run(q_ways,  'ways')

    lights, anchors, lit_ways = [], [], []

    for el in node_els:
        tags = el.get('tags', {})
        lat  = el.get('lat')
        lng  = el.get('lon')
        if lat is None:
            continue
        hw  = tags.get('highway', '')
        am  = tags.get('amenity', '')
        shp = tags.get('shop', '')
        if hw == 'street_lamp':
            lights.append((lat, lng))
        elif hw == 'bus_stop':
            anchors.append({'lat': lat, 'lng': lng, 'type': 'bus_stop', 'name': tags.get('name', '')})
        elif am in ('police', 'hospital', 'clinic', 'pharmacy', 'atm', 'bank',
                    'school', 'college', 'place_of_worship'):
            anchors.append({'lat': lat, 'lng': lng, 'type': am, 'name': tags.get('name', '')})
        elif am in ('fuel', 'fast_food', 'convenience', 'cafe', 'restaurant')                 or shp in ('convenience', 'supermarket', 'general'):
            anchors.append({'lat': lat, 'lng': lng, 'type': am or shp, 'name': tags.get('name', '')})

    for el in way_els:
        tags   = el.get('tags', {})
        center = el.get('center', {})
        lat    = center.get('lat')
        lng    = center.get('lon')
        if lat is None:
            continue
        hw = tags.get('highway', '')
        if hw in ('primary', 'secondary', 'tertiary'):
            lit_ways.append((lat, lng))
        elif tags.get('lit') == 'yes':
            lit_ways.append((lat, lng))

    # Urban fallback: if Overpass returned nothing, seed synthetic infra
    # so dense urban roads aren't penalised as if they were rural tracks
    if not lights and not anchors and not lit_ways:
        print('Overpass returned empty -- using urban baseline synthetic infra')
        for pt in points[::3]:
            lights.append((pt[0], pt[1]))
        for pt in points[::5]:
            lit_ways.append((pt[0], pt[1]))
        mid = points[len(points) // 2]
        for dlat, dlng in [(0, 0), (0.005, 0.005), (-0.005, 0.003)]:
            anchors.append({'lat': mid[0]+dlat, 'lng': mid[1]+dlng,
                            'type': 'convenience', 'name': 'Urban anchor'})

    return {'lights': lights, 'anchors': anchors, 'lit_ways': lit_ways}


# ─────────────────────── Factor scorers (0–100, higher = more DANGER) ──
def _nearest(point, items, radius_m):
    plat, plng = point
    count, best = 0, float('inf')
    for it in items:
        lat = it[0] if isinstance(it, tuple) else it['lat']
        lng = it[1] if isinstance(it, tuple) else it['lng']
        d = haversine(plat, plng, lat, lng)
        if d <= radius_m:
            count += 1
        if d < best:
            best = d
    return count, best


def crime_danger(center, crimes_decayed):
    """0 = no crimes near, 100 = very dangerous."""
    score = 0.0
    for c in crimes_decayed:
        d = haversine(center[0], center[1], c['lat'], c['lng'])
        if d <= CRIME_RADIUS_M:
            score += c['weight'] * (1 - d / CRIME_RADIUS_M)
    return min(100.0, score * 4)


def lighting_danger(center, infra):
    """0 = well-lit, 100 = no lights."""
    n_lamps, _ = _nearest(center, infra['lights'],   LIGHT_RADIUS_M)
    n_lit,   _ = _nearest(center, infra['lit_ways'], LIGHT_RADIUS_M * 3)  # ways cover larger area
    # Each lamp counts 1, each lit-way counts 2 (road-level lighting)
    total = n_lamps + n_lit * 2
    return max(0.0, 100 - min(total, 8) * 12.5)


def population_danger(center, infra):
    """
    Proxy for foot-traffic / passive surveillance.
    More anchors + lit roads nearby → denser area → lower danger.
    0 = very busy / safe, 100 = isolated.
    """
    n_anchors, _ = _nearest(center, infra['anchors'],  ANCHOR_RADIUS_M * 2)
    n_lit,     _ = _nearest(center, infra['lit_ways'], ANCHOR_RADIUS_M * 3)
    n_lamps,   _ = _nearest(center, infra['lights'],   LIGHT_RADIUS_M * 2)
    density = n_anchors * 3 + n_lit * 2 + n_lamps
    return max(0.0, 100 - min(density, 10) * 10)


def anchor_danger(center, infra):
    """
    0 = many safety anchors nearby, 100 = completely isolated.
    Uses a tiered radius: close anchors count more than far ones.
    Urban baseline: even 0 anchors within 600m gives 60 danger (not 100)
    because populated urban areas have passive safety regardless.
    """
    plat, plng = center
    score = 0.0
    for a in infra['anchors']:
        d = haversine(plat, plng, a['lat'], a['lng'])
        # Tier 1: within 300m → strong contribution
        if d <= ANCHOR_RADIUS_M * 0.5:
            score += 3.0
        # Tier 2: 300-600m → moderate
        elif d <= ANCHOR_RADIUS_M:
            score += 1.5
        # Tier 3: 600m-1km → weak (nearby neighbourhood)
        elif d <= ANCHOR_RADIUS_M * 1.7:
            score += 0.5
    # 0 nearby → urban baseline 55 (not 100); saturates at score≥11 → danger 0
    return max(0.0, 55.0 - min(score, 11.0) * 5.0)


# ─────────────────────── Crime preprocessing ──────────────────
def decay_crimes(crimes):
    now = datetime.now(timezone.utc)
    out = []
    for c in crimes:
        base   = SEVERITY_WEIGHT.get(c.get('severity'), 3)
        weight = base
        ts     = c.get('occurred_at') or c.get('created_at')
        if ts:
            try:
                dt       = datetime.fromisoformat(str(ts).replace('Z', '+00:00'))
                age_days = max(0, (now - dt).total_seconds() / 86400)
                weight   = base * math.exp(-age_days / CRIME_HALF_LIFE_DAYS)
            except Exception:
                pass
        out.append({'lat': c['latitude'], 'lng': c['longitude'],
                    'weight': weight, 'id': c['id']})
    return out


# ─────────────────────── Per-route scoring ────────────────────
def score_route(points, crimes_decayed, infra, time_of_day):
    """
    For each segment compute 4 danger sub-scores (0–100, higher = worse).
    Combine with time-of-day weights → danger score per segment.
    Safety = 100 − danger  (returned as safety_score = avg danger for the route).

    Returns (scored_segments, avg_danger_0_to_100).
    """
    w    = WEIGHTS.get(time_of_day, WEIGHTS['night'])
    segs = chunk_route(points)

    scored_segs, total_danger = [], 0.0

    for seg in segs:
        c = seg['center']

        # Danger sub-scores (0=safe, 100=dangerous)
        f = {
            'crime':      crime_danger(c,      crimes_decayed),
            'lighting':   lighting_danger(c,   infra),
            'population': population_danger(c, infra),
            'anchor':     anchor_danger(c,     infra),
        }

        # Weighted danger for this segment
        danger = (
            f['crime']      * w['crime']      +
            f['lighting']   * w['lighting']   +
            f['population'] * w['population'] +
            f['anchor']     * w['anchor']
        )

        scored_segs.append({
            'center': [c[0], c[1]],
            'points': [[p[0], p[1]] for p in seg['points']],
            'danger': round(danger, 1),
            'factors': {k: round(v, 1) for k, v in f.items()},
        })
        total_danger += danger

    avg_danger = total_danger / max(1, len(scored_segs))
    return scored_segs, round(avg_danger, 1)


def label_for_safety(overall_safety):
    """
    overall_safety = 100 − avg_danger  (higher = safer)
    Safest >= 78, Safe >= 62, Moderate >= 45, else Risky
    """
    if overall_safety >= 78: return ('Safest',   '#10b981')
    if overall_safety >= 62: return ('Safe',     '#22c55e')
    if overall_safety >= 45: return ('Moderate', '#f59e0b')
    return                          ('Risky',    '#ef4444')


# ─────────────────────── Geocode + routing ────────────────────
def geocode(place_name):
    try:
        resp = http_requests.get(
            'https://nominatim.openstreetmap.org/search',
            params={'q': place_name + ', Hyderabad', 'format': 'json', 'limit': 1},
            headers={'User-Agent': 'SafeHer/3.0'}, timeout=8)
        r = resp.json()
        if r:
            return float(r[0]['lat']), float(r[0]['lon']), r[0]['display_name']
    except Exception as e:
        print(f'Geocode error: {e}')
    return None, None, None


def get_osrm_routes(slat, slng, dlat, dlng, alternatives=2, profile='foot'):
    """
    alternatives=true asks for up to 3 routes total.
    We pass 'true' not a number — OSRM interprets numbers > 1 inconsistently.
    """
    url = (f'https://router.project-osrm.org/route/v1/{profile}/'
           f'{slng},{slat};{dlng},{dlat}'
           f'?alternatives=true&geometries=geojson&overview=full&steps=false')
    try:
        data = http_requests.get(url, timeout=15).json()
        if data.get('code') != 'Ok':
            print(f'OSRM non-OK: {data.get("code")} — {data.get("message")}')
            return []
        out = []
        for i, r in enumerate(data['routes']):
            pts = [(c[1], c[0]) for c in r['geometry']['coordinates']]
            out.append({
                'index':        i,
                'points':       pts,
                'distance_m':   r['distance'],
                'duration_s':   r['duration'],
                'distance_km':  round(r['distance'] / 1000, 1),
                'duration_min': round(r['duration'] / 60,   1),
            })
        return out
    except Exception as e:
        print(f'OSRM error: {e}')
        return []


# ─────────────────────── Flask routes ────────────────────────
@safe_route_bp.route('/')
def safe_route_page():
    return render_template('safe_route.html')


@safe_route_bp.route('/api/find', methods=['POST'])
def find_safe_route():
    data        = request.get_json(force=True)
    origin      = data.get('origin', '').strip()
    destination = data.get('destination', '').strip()
    origin_lat  = data.get('origin_lat')
    origin_lng  = data.get('origin_lng')
    dest_lat    = data.get('dest_lat')
    dest_lng    = data.get('dest_lng')
    time_of_day = data.get('time_of_day', 'night')
    profile     = data.get('profile', 'foot')

    # Geocode if coords not provided
    if not origin_lat or not origin_lng:
        origin_lat, origin_lng, origin = geocode(origin)
        if not origin_lat:
            return jsonify({'error': f'Could not find: {origin}'}), 400

    if not dest_lat or not dest_lng:
        dest_lat, dest_lng, destination = geocode(destination)
        if not dest_lat:
            return jsonify({'error': f'Could not find: {destination}'}), 400

    # Get OSRM routes
    routes = get_osrm_routes(
        float(origin_lat), float(origin_lng),
        float(dest_lat),   float(dest_lng),
        alternatives=True, profile=profile
    )
    if not routes:
        return jsonify({'error': 'Could not calculate route between these locations. Make sure both points are reachable by foot in Hyderabad.'}), 500

    # Fetch crime data
    db = get_db()
    # Check which timestamp column exists in this DB schema
    cols = [r[1] for r in db.execute("PRAGMA table_info(crimes)").fetchall()]
    if 'occurred_at' in cols:
        ts_expr = "COALESCE(occurred_at, created_at)"
    else:
        ts_expr = "created_at"

    crimes = db.execute(
        f"SELECT id, latitude, longitude, severity, crime_type, "
        f"{ts_expr} AS occurred_at "
        f"FROM crimes WHERE status IN ('approved','investigating','pending')"
    ).fetchall()
    db.close()
    crimes_decayed = decay_crimes([dict(c) for c in crimes])

    # Fetch OSM safety infrastructure (one call for all routes)
    all_points = [p for r in routes for p in r['points']]
    infra = fetch_safety_infra(all_points)

    # Score every route
    for route in routes:
        segs, avg_danger = score_route(
            route['points'], crimes_decayed, infra, time_of_day
        )
        overall_safety = round(100 - avg_danger, 1)   # higher = safer
        label, color   = label_for_safety(overall_safety)

        route.update({
            'segments':       segs,
            'safety_score':   avg_danger,      # 0=safest, 100=worst (kept for compat)
            'safety_pct':     overall_safety,  # 0=worst, 100=safest (matches spec)
            'risk_pct':       round(avg_danger, 1),
            'safety_label':   label,
            'safety_color':   color,
            'crime_count':    sum(1 for s in segs if s['factors']['crime'] > 5),
        })

    # Sort best (safest) first
    routes.sort(key=lambda r: r['safety_score'])
    routes[0]['recommended'] = True
    for r in routes[1:]:
        r['recommended'] = False

    anchors_out = [
        {'lat': a['lat'], 'lng': a['lng'], 'type': a['type'], 'name': a['name']}
        for a in infra['anchors'][:80]
    ]

    return jsonify({
        'routes':             routes,
        'origin':             {'lat': float(origin_lat), 'lng': float(origin_lng), 'name': str(origin)},
        'destination':        {'lat': float(dest_lat),   'lng': float(dest_lng),   'name': str(destination)},
        'time_of_day':        time_of_day,
        'profile':            profile,
        'anchors':            anchors_out,
        'lights_count':       len(infra['lights']),
        'total_crimes_in_db': len(crimes),
    })