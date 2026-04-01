from flask import Blueprint, redirect, request, session, jsonify, render_template
import sqlite3

sos_bp = Blueprint('sos', __name__)

def get_db():
    conn = sqlite3.connect('safeher.db')
    conn.row_factory = sqlite3.Row
    return conn

@sos_bp.route('/')
def sos_page():
    if 'user_id' not in session:
        return redirect('/auth/login')
    return render_template('sos.html')

@sos_bp.route('/trigger', methods=['POST'])
def trigger_sos():
    data = request.json
    db = get_db()
    db.execute('''INSERT INTO sos_alerts (user_id, latitude, longitude, message)
                  VALUES (?, ?, ?, ?)''',
               (session['user_id'], data['latitude'], data['longitude'],
                data.get('message', 'EMERGENCY SOS!')))
    db.commit()
    db.close()
    # In production: send SMS/email to emergency contacts here
    return jsonify({'status': 'SOS sent successfully!'})
