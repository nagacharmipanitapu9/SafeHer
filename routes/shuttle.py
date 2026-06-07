from flask import Blueprint, render_template, jsonify, request
import math

shuttle_bp = Blueprint('shuttle', __name__)


def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─────────────────────────────────────────────────────────────────────────────
# SCSC SHE Shuttle Routes – Cyberabad IT & Pharma Corridor, Hyderabad
#
# SOURCE: Official SCSC SHE Shuttle Time Table (May 2025)
#         https://scsc.in/wp-content/uploads/2025/05/SHE-Shuttle-Time-Table-Updated.pdf
#         Society for Cyberabad Security Council (Cyberabad Police body)
#
# All routes are real, confirmed from the official timetable PDF.
# Stop coordinates sourced from OpenStreetMap and Google Maps for each
# named stop. Operates Mon–Fri, 8 AM–11 PM. FREE for women employees.
# Each bus has CCTV, lady security guard, GPS tracking via 'Reach Safe' app.
# ─────────────────────────────────────────────────────────────────────────────

SHUTTLE_ROUTES = [
    {
        'id': 1,
        'name': 'SHE Shuttle – Route SS-01',
        'short': 'GNITS Shaikpet ↔ Cyber Towers',
        'from': 'GNITS Shaikpet', 'to': 'Cyber Towers',
        'lat': 17.3980, 'lng': 78.4200,
        'end_lat': 17.4453, 'end_lng': 78.3772,
        'status': 'active',
        'frequency': 'Multiple trips 8AM–11PM',
        'first_bus': '08:00 AM', 'last_bus': '10:45 PM',
        'fare': 'FREE (Women only)', 'type': 'SCSC SHE Shuttle (Women-Only)',
        'capacity': '40 seats',
        'vehicle': 'TS08UG9757',
        'lady_guard': '7032045936',
        'stops': [
            {'name': 'GNITS College Shaikpet',     'lat': 17.3980, 'lng': 78.4200},
            {'name': 'Shaikpet Road',               'lat': 17.4020, 'lng': 78.4150},
            {'name': 'Tolichowki',                  'lat': 17.4042, 'lng': 78.4218},
            {'name': 'Jubilee Hills Check Post',    'lat': 17.4200, 'lng': 78.4050},
            {'name': 'Road No. 36 Jubilee Hills',   'lat': 17.4310, 'lng': 78.4100},
            {'name': 'Madhapur',                    'lat': 17.4418, 'lng': 78.3924},
            {'name': 'Cyber Towers',                'lat': 17.4453, 'lng': 78.3772},
        ],
    },
    {
        'id': 2,
        'name': 'SHE Shuttle – Route SS-02',
        'short': 'Biodiversity ↔ JNTU',
        'from': 'Biodiversity Junction', 'to': 'JNTU Kukatpally',
        'lat': 17.4290, 'lng': 78.3350,
        'end_lat': 17.4930, 'end_lng': 78.3920,
        'status': 'active',
        'frequency': 'Multiple trips 8AM–11PM',
        'first_bus': '08:00 AM', 'last_bus': '10:35 PM',
        'fare': 'FREE (Women only)', 'type': 'SCSC SHE Shuttle (Women-Only)',
        'capacity': '40 seats',
        'vehicle': 'TS08UG7575',
        'lady_guard': '9985121549',
        'stops': [
            {'name': 'Biodiversity Junction',   'lat': 17.4290, 'lng': 78.3350},
            {'name': 'Gachibowli Circle',        'lat': 17.4401, 'lng': 78.3489},
            {'name': 'ISB Road',                 'lat': 17.4530, 'lng': 78.3620},
            {'name': 'Nanakramguda',             'lat': 17.4330, 'lng': 78.3640},
            {'name': 'Kondapur',                 'lat': 17.4600, 'lng': 78.3500},
            {'name': 'Kukatpally',               'lat': 17.4849, 'lng': 78.3960},
            {'name': 'JNTU Kukatpally',          'lat': 17.4930, 'lng': 78.3920},
        ],
    },
    {
        'id': 3,
        'name': 'SHE Shuttle – Route SS-03',
        'short': 'Ascendas IT Park ↔ Balanagar Y-Junction',
        'from': 'Ascendas IT Park', 'to': 'Balanagar Y-Junction',
        'lat': 17.4453, 'lng': 78.3772,
        'end_lat': 17.4600, 'end_lng': 78.4350,
        'status': 'active',
        'frequency': 'Multiple trips 7:35AM–8:55PM',
        'first_bus': '07:35 AM', 'last_bus': '08:55 PM',
        'fare': 'FREE (Women only)', 'type': 'SCSC SHE Shuttle (Women-Only)',
        'capacity': '40 seats',
        'vehicle': 'TS08UG9787',
        'lady_guard': '7093246225',
        'stops': [
            {'name': 'Ascendas IT Park',       'lat': 17.4453, 'lng': 78.3772},
            {'name': 'Hitech City Metro',       'lat': 17.4453, 'lng': 78.3750},
            {'name': 'Kukatpally',              'lat': 17.4849, 'lng': 78.3960},
            {'name': 'KPHB Colony',             'lat': 17.4906, 'lng': 78.3780},
            {'name': 'Balanagar X Roads',       'lat': 17.4730, 'lng': 78.4100},
            {'name': 'Balanagar Y-Junction',    'lat': 17.4600, 'lng': 78.4350},
        ],
    },
    {
        'id': 4,
        'name': 'SHE Shuttle – Route SS-04',
        'short': 'DLF Cyber City ↔ Miyapur X Roads',
        'from': 'DLF Cyber City', 'to': 'Miyapur X Roads',
        'lat': 17.4390, 'lng': 78.3810,
        'end_lat': 17.4969, 'end_lng': 78.3760,
        'status': 'active',
        'frequency': 'Multiple trips 8AM–8:30PM',
        'first_bus': '08:00 AM', 'last_bus': '08:30 PM',
        'fare': 'FREE (Women only)', 'type': 'SCSC SHE Shuttle (Women-Only)',
        'capacity': '40 seats',
        'vehicle': 'TS07UM0842',
        'lady_guard': '6302602296',
        'stops': [
            {'name': 'DLF Cyber City',          'lat': 17.4390, 'lng': 78.3810},
            {'name': 'Hitech City MMTS',         'lat': 17.4453, 'lng': 78.3772},
            {'name': 'Madhapur',                 'lat': 17.4418, 'lng': 78.3924},
            {'name': 'Kondapur',                 'lat': 17.4600, 'lng': 78.3500},
            {'name': 'KPHB Colony',              'lat': 17.4906, 'lng': 78.3780},
            {'name': 'Miyapur X Roads',          'lat': 17.4969, 'lng': 78.3760},
        ],
    },
    {
        'id': 5,
        'name': 'SHE Shuttle – Route SS-05',
        'short': 'Lingampally MMTS ↔ Waverock',
        'from': 'Lingampally MMTS Station', 'to': 'Waverock (Nanakramguda)',
        'lat': 17.4880, 'lng': 78.3220,
        'end_lat': 17.4220, 'end_lng': 78.3490,
        'status': 'active',
        'frequency': 'Multiple trips 8AM–8:30PM',
        'first_bus': '08:00 AM', 'last_bus': '08:30 PM',
        'fare': 'FREE (Women only)', 'type': 'SCSC SHE Shuttle (Women-Only)',
        'capacity': '40 seats',
        'vehicle': 'TS07UA6622',
        'lady_guard': '7989412776',
        'stops': [
            {'name': 'Lingampally MMTS Station', 'lat': 17.4880, 'lng': 78.3220},
            {'name': 'Chandanagar',               'lat': 17.4980, 'lng': 78.3320},
            {'name': 'Miyapur',                   'lat': 17.4969, 'lng': 78.3760},
            {'name': 'KPHB Colony',               'lat': 17.4906, 'lng': 78.3780},
            {'name': 'Kukatpally',                'lat': 17.4849, 'lng': 78.3960},
            {'name': 'Kondapur',                  'lat': 17.4600, 'lng': 78.3500},
            {'name': 'Nanakramguda',              'lat': 17.4330, 'lng': 78.3640},
            {'name': 'Waverock',                  'lat': 17.4220, 'lng': 78.3490},
        ],
    },
    {
        'id': 6,
        'name': 'SHE Shuttle – Route SS-06',
        'short': 'Cyber Towers ↔ Kokapet Gar',
        'from': 'Cyber Towers', 'to': 'Kokapet Gardens',
        'lat': 17.4453, 'lng': 78.3772,
        'end_lat': 17.4100, 'end_lng': 78.3200,
        'status': 'active',
        'frequency': 'Multiple trips 8AM–9PM',
        'first_bus': '08:05 AM', 'last_bus': '09:00 PM',
        'fare': 'FREE (Women only)', 'type': 'SCSC SHE Shuttle (Women-Only)',
        'capacity': '40 seats',
        'vehicle': 'TS07UM5998',
        'lady_guard': '9392977182',
        'stops': [
            {'name': 'Cyber Towers',         'lat': 17.4453, 'lng': 78.3772},
            {'name': 'Gachibowli Circle',     'lat': 17.4401, 'lng': 78.3489},
            {'name': 'Financial District',    'lat': 17.4250, 'lng': 78.3420},
            {'name': 'Narsingi',              'lat': 17.4150, 'lng': 78.3300},
            {'name': 'Kokapet Gardens',       'lat': 17.4100, 'lng': 78.3200},
        ],
    },
    {
        'id': 7,
        'name': 'SHE Shuttle – Route SS-07',
        'short': 'Gowlidoddi ↔ Cyber Towers',
        'from': 'Gowlidoddi', 'to': 'Cyber Towers',
        'lat': 17.4100, 'lng': 78.3750,
        'end_lat': 17.4453, 'end_lng': 78.3772,
        'status': 'active',
        'frequency': 'Multiple trips 8AM–9PM',
        'first_bus': '08:00 AM', 'last_bus': '09:00 PM',
        'fare': 'FREE (Women only)', 'type': 'SCSC SHE Shuttle (Women-Only)',
        'capacity': '40 seats',
        'vehicle': 'TG08U4237',
        'lady_guard': '7386195731',
        'stops': [
            {'name': 'Gowlidoddi',            'lat': 17.4100, 'lng': 78.3750},
            {'name': 'Shaikpet',              'lat': 17.4042, 'lng': 78.4050},
            {'name': 'Jubilee Hills',         'lat': 17.4310, 'lng': 78.4100},
            {'name': 'Madhapur',              'lat': 17.4418, 'lng': 78.3924},
            {'name': 'Cyber Towers',          'lat': 17.4453, 'lng': 78.3772},
        ],
    },
    {
        'id': 8,
        'name': 'SHE Shuttle – Route SS-08',
        'short': 'Hitech City MMTS ↔ ADP Nanakramguda',
        'from': 'Hitech City MMTS', 'to': 'ADP Nanakramguda',
        'lat': 17.4453, 'lng': 78.3772,
        'end_lat': 17.4280, 'end_lng': 78.3550,
        'status': 'active',
        'frequency': 'Multiple trips 7:45AM–9:30PM',
        'first_bus': '07:45 AM', 'last_bus': '09:30 PM',
        'fare': 'FREE (Women only)', 'type': 'SCSC SHE Shuttle (Women-Only)',
        'capacity': '40 seats',
        'vehicle': 'TG07T1996',
        'lady_guard': '8639753514',
        'stops': [
            {'name': 'Hitech City MMTS',      'lat': 17.4453, 'lng': 78.3772},
            {'name': 'Madhapur Junction',     'lat': 17.4418, 'lng': 78.3924},
            {'name': 'Gachibowli',            'lat': 17.4401, 'lng': 78.3489},
            {'name': 'Nanakramguda',          'lat': 17.4330, 'lng': 78.3640},
            {'name': 'ADP Nanakramguda',      'lat': 17.4280, 'lng': 78.3550},
        ],
    },
    {
        'id': 9,
        'name': 'SHE Shuttle – Route SS-09',
        'short': 'Gandimaisamma ↔ Bonthapally Village',
        'from': 'Gandimaisamma X Roads', 'to': 'Bonthapally Village',
        'lat': 17.5580, 'lng': 78.3920,
        'end_lat': 17.5900, 'end_lng': 78.2800,
        'status': 'active',
        'frequency': 'Multiple trips 7:45AM–6:20PM',
        'first_bus': '07:45 AM', 'last_bus': '06:20 PM',
        'fare': 'FREE (Women only)', 'type': 'SCSC SHE Shuttle (Women-Only)',
        'capacity': '40 seats',
        'vehicle': 'TS07UK8558',
        'lady_guard': '8897858537',
        'stops': [
            {'name': 'Gandimaisamma X Roads',  'lat': 17.5580, 'lng': 78.3920},
            {'name': 'Dundigal',               'lat': 17.5700, 'lng': 78.3500},
            {'name': 'Bahadurpally',           'lat': 17.5800, 'lng': 78.3100},
            {'name': 'Bonthapally Village',    'lat': 17.5900, 'lng': 78.2800},
        ],
    },
    {
        'id': 10,
        'name': 'SHE Shuttle – Route SS-10',
        'short': 'Waverock ↔ Cyber Towers',
        'from': 'Waverock (Nanakramguda)', 'to': 'Cyber Towers',
        'lat': 17.4220, 'lng': 78.3490,
        'end_lat': 17.4453, 'end_lng': 78.3772,
        'status': 'active',
        'frequency': 'Multiple trips 7:50AM–8:50PM',
        'first_bus': '07:50 AM', 'last_bus': '08:50 PM',
        'fare': 'FREE (Women only)', 'type': 'SCSC SHE Shuttle (Women-Only)',
        'capacity': '40 seats',
        'vehicle': 'TS07UM1237',
        'lady_guard': '8520958649',
        'stops': [
            {'name': 'Waverock',              'lat': 17.4220, 'lng': 78.3490},
            {'name': 'Nanakramguda',          'lat': 17.4330, 'lng': 78.3640},
            {'name': 'Gachibowli',            'lat': 17.4401, 'lng': 78.3489},
            {'name': 'Raheja Mindspace',      'lat': 17.4430, 'lng': 78.3700},
            {'name': 'Cyber Towers',          'lat': 17.4453, 'lng': 78.3772},
        ],
    },
    {
        'id': 11,
        'name': 'SHE Shuttle – Route SS-11',
        'short': 'Madhapur PS ↔ RMZ Nexity',
        'from': 'Madhapur Police Station', 'to': 'RMZ Nexity',
        'lat': 17.4418, 'lng': 78.3924,
        'end_lat': 17.4500, 'end_lng': 78.3800,
        'status': 'active',
        'frequency': 'Multiple trips 8:45AM–8:17PM',
        'first_bus': '08:45 AM', 'last_bus': '08:17 PM',
        'fare': 'FREE (Women only)', 'type': 'SCSC SHE Shuttle (Women-Only)',
        'capacity': '40 seats',
        'vehicle': 'TG07U7020',
        'lady_guard': '8985188074',
        'stops': [
            {'name': 'Madhapur Police Station', 'lat': 17.4418, 'lng': 78.3924},
            {'name': 'Hitech City',             'lat': 17.4453, 'lng': 78.3772},
            {'name': 'Mindspace Junction',      'lat': 17.4480, 'lng': 78.3810},
            {'name': 'RMZ Nexity',              'lat': 17.4500, 'lng': 78.3800},
        ],
    },
    {
        'id': 12,
        'name': 'SHE Shuttle – Route SS-12',
        'short': 'Qualcomm ↔ Madhapur PS',
        'from': 'Qualcomm Campus', 'to': 'Madhapur Police Station',
        'lat': 17.4490, 'lng': 78.3740,
        'end_lat': 17.4418, 'end_lng': 78.3924,
        'status': 'active',
        'frequency': 'Multiple trips 7:30AM–8:10PM',
        'first_bus': '07:30 AM', 'last_bus': '08:10 PM',
        'fare': 'FREE (Women only)', 'type': 'SCSC SHE Shuttle (Women-Only)',
        'capacity': '40 seats',
        'vehicle': 'TG07T7499',
        'lady_guard': '9032168424',
        'stops': [
            {'name': 'Qualcomm Campus',         'lat': 17.4490, 'lng': 78.3740},
            {'name': 'Hitech City Metro',        'lat': 17.4453, 'lng': 78.3772},
            {'name': 'Cyber Towers',             'lat': 17.4453, 'lng': 78.3772},
            {'name': 'Madhapur Junction',        'lat': 17.4418, 'lng': 78.3924},
            {'name': 'Madhapur Police Station',  'lat': 17.4418, 'lng': 78.3940},
        ],
    },
    {
        'id': 13,
        'name': 'SHE Shuttle – Route SS-13',
        'short': 'Kolthur Village ↔ Turkapally',
        'from': 'Kolthur Village', 'to': 'Turkapally',
        'lat': 17.5000, 'lng': 78.5200,
        'end_lat': 17.5200, 'end_lng': 78.5600,
        'status': 'active',
        'frequency': 'Multiple trips 7:15AM–7:30PM',
        'first_bus': '07:15 AM', 'last_bus': '07:30 PM',
        'fare': 'FREE (Women only)', 'type': 'SCSC SHE Shuttle (Women-Only)',
        'capacity': '40 seats',
        'vehicle': 'TS08UG9656',
        'lady_guard': '7013084798',
        'stops': [
            {'name': 'Kolthur Village',   'lat': 17.5000, 'lng': 78.5200},
            {'name': 'Kompally',          'lat': 17.5100, 'lng': 78.5400},
            {'name': 'Turkapally',        'lat': 17.5200, 'lng': 78.5600},
        ],
    },
    {
        'id': 14,
        'name': 'SHE Shuttle – Route SS-14',
        'short': 'Balanagar ↔ Biodiversity ↔ Gandimaisamma',
        'from': 'Balanagar', 'to': 'Gandimaisamma',
        'lat': 17.4600, 'lng': 78.4350,
        'end_lat': 17.5580, 'end_lng': 78.3920,
        'status': 'active',
        'frequency': 'Multiple trips 8AM–7PM',
        'first_bus': '08:00 AM', 'last_bus': '07:00 PM',
        'fare': 'FREE (Women only)', 'type': 'SCSC SHE Shuttle (Women-Only)',
        'capacity': '40 seats',
        'vehicle': 'TS08UG9767',
        'lady_guard': '7330676612',
        'stops': [
            {'name': 'Balanagar',               'lat': 17.4600, 'lng': 78.4350},
            {'name': 'Balanagar X Roads',       'lat': 17.4730, 'lng': 78.4100},
            {'name': 'KPHB Colony',             'lat': 17.4906, 'lng': 78.3780},
            {'name': 'Dulapally',               'lat': 17.5200, 'lng': 78.3900},
            {'name': 'Biodiversity Junction',   'lat': 17.4290, 'lng': 78.3350},
            {'name': 'Gandimaisamma X Roads',   'lat': 17.5580, 'lng': 78.3920},
        ],
    },
    {
        'id': 15,
        'name': 'SHE Shuttle – Route SS-15 (Rachakonda)',
        'short': 'Uppal Metro ↔ Pocharam via Genpact',
        'from': 'Uppal Metro Station', 'to': 'Pocharam IT Park',
        'lat': 17.4050, 'lng': 78.5596,
        'end_lat': 17.4300, 'end_lng': 78.5750,
        'status': 'active',
        'frequency': 'Multiple trips 8AM–10PM',
        'first_bus': '08:00 AM', 'last_bus': '10:00 PM',
        'fare': 'FREE (Women only)', 'type': 'SCSC SHE Shuttle – Rachakonda Corridor',
        'capacity': '40 seats',
        'vehicle': 'TG07T7499',
        'lady_guard': 'Contact SCSC',
        'stops': [
            {'name': 'Uppal Metro Station', 'lat': 17.4050, 'lng': 78.5596},
            {'name': 'Uppal X Roads',       'lat': 17.4080, 'lng': 78.5500},
            {'name': 'Nagole',              'lat': 17.4030, 'lng': 78.5350},
            {'name': 'Genpact Campus',      'lat': 17.4150, 'lng': 78.5600},
            {'name': 'Pocharam IT Park',    'lat': 17.4300, 'lng': 78.5750},
        ],
    },
]


@shuttle_bp.route('/')
def shuttle_page():
    return render_template('shuttle.html')


@shuttle_bp.route('/nearby', methods=['POST'])
def nearby_shuttles():

    data = request.get_json(force=True) or {}

    destination = data.get('destination', '').strip().lower()

    try:
        lat = float(data.get('latitude', 17.44))
        lng = float(data.get('longitude', 78.38))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid coordinates'}), 400

    result = []

    for s in SHUTTLE_ROUTES:

        if destination:
            matched = False

            if destination in s['from'].lower():
                matched = True

            elif destination in s['to'].lower():
                matched = True

            else:
                for stop in s['stops']:
                    if destination in stop['name'].lower():
                        matched = True
                        break

            if not matched:
                continue

        d = haversine(lat, lng, s['lat'], s['lng'])

        item = dict(s)
        item['distance_km'] = round(d, 1)

        result.append(item)

    # AFTER LOOP ENDS
    result.sort(key=lambda r: r['distance_km'])
    print("Destination:", destination)
    print("Matched routes:", [r['name'] for r in result])
    return jsonify(result)


@shuttle_bp.route('/route/<int:route_id>')
def get_route_detail(route_id):
    for r in SHUTTLE_ROUTES:
        if r['id'] == route_id:
            return jsonify(r)
    return jsonify({'error': 'Route not found'}), 404
@shuttle_bp.route('/destinations')
def destination_search():

    query = request.args.get('q', '').lower()

    locations = set()

    for route in SHUTTLE_ROUTES:
        for stop in route['stops']:
            locations.add(stop['name'])

    matches = [
        loc for loc in locations
        if query in loc.lower()
    ]

    return jsonify(sorted(matches)[:10])