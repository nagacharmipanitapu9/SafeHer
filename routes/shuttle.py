from flask import Blueprint, render_template, jsonify, request

shuttle_bp = Blueprint('shuttle', __name__)

# Sample shuttle data (replace with real API/database)
SHUTTLE_ROUTES = [
    {'id': 1, 'name': 'SheShuttle Route A', 'lat': 17.385, 'lng': 78.486, 'status': 'active', 'next_arrival': '10 mins'},
    {'id': 2, 'name': 'SheShuttle Route B', 'lat': 17.390, 'lng': 78.490, 'status': 'active', 'next_arrival': '15 mins'},
    {'id': 3, 'name': 'SheShuttle Route C', 'lat': 17.380, 'lng': 78.480, 'status': 'inactive', 'next_arrival': 'N/A'},
]

@shuttle_bp.route('/')
def shuttle_page():
    return render_template('shuttle.html')

@shuttle_bp.route('/nearby', methods=['POST'])
def nearby_shuttles():
    lat = request.json.get('latitude')
    lng = request.json.get('longitude')
    # In production: filter by proximity
    return jsonify(SHUTTLE_ROUTES)
