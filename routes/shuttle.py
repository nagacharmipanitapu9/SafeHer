from flask import Blueprint, render_template, jsonify, request
import math

shuttle_bp = Blueprint('shuttle', __name__)

def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

# Sample SheShuttle data — replace with real DB/API
SHUTTLE_ROUTES = [
    { 'id':1, 'name':'SheShuttle – Route A (Hitech City)', 'lat':17.4453, 'lng':78.3772,
      'status':'active',    'next_arrival':'8 mins',  'route':'Hitech City ↔ Ameerpet', 'capacity':'40 seats' },
    { 'id':2, 'name':'SheShuttle – Route B (Madhapur)',    'lat':17.4418, 'lng':78.3924,
      'status':'active',    'next_arrival':'12 mins', 'route':'Madhapur ↔ Begumpet',   'capacity':'35 seats' },
    { 'id':3, 'name':'SheShuttle – Route C (Gachibowli)',  'lat':17.4401, 'lng':78.3489,
      'status':'limited',   'next_arrival':'20 mins', 'route':'Gachibowli ↔ Mehdipatnam','capacity':'20 seats' },
    { 'id':4, 'name':'SheShuttle – Route D (Banjara Hills)','lat':17.4126, 'lng':78.4483,
      'status':'active',    'next_arrival':'5 mins',  'route':'Banjara Hills ↔ Secunderabad','capacity':'40 seats' },
    { 'id':5, 'name':'SheShuttle – Route E (Kukatpally)',   'lat':17.4849, 'lng':78.3960,
      'status':'inactive',  'next_arrival':'N/A',     'route':'Kukatpally ↔ SR Nagar',  'capacity':'35 seats' },
    { 'id':6, 'name':'SheShuttle – Route F (LB Nagar)',     'lat':17.3451, 'lng':78.5524,
      'status':'active',    'next_arrival':'15 mins', 'route':'LB Nagar ↔ MG Bus Stand','capacity':'40 seats' },
]

@shuttle_bp.route('/')
def shuttle_page():
    return render_template('shuttle.html')

@shuttle_bp.route('/nearby', methods=['POST'])
def nearby_shuttles():
    data = request.get_json(force=True)
    lat  = float(data.get('latitude',  17.385))
    lng  = float(data.get('longitude', 78.486))

    # Sort by distance from user, return closest 5
    def dist(s): return haversine(lat, lng, s['lat'], s['lng'])
    sorted_shuttles = sorted(SHUTTLE_ROUTES, key=dist)[:5]

    return jsonify(sorted_shuttles)