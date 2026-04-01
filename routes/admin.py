from flask import Blueprint, render_template, request, redirect, session, jsonify
import sqlite3
from functools import wraps

admin_bp = Blueprint('admin', __name__)

def get_db():
    conn = sqlite3.connect('safeher.db')
    conn.row_factory = sqlite3.Row
    return conn

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('role') != 'admin':
            return redirect('/')
        return f(*args, **kwargs)
    return decorated

@admin_bp.route('/dashboard')
@admin_required
def dashboard():
    db = get_db()
    stats = {
        'total_crimes': db.execute('SELECT COUNT(*) FROM crimes').fetchone()[0],
        'pending_crimes': db.execute("SELECT COUNT(*) FROM crimes WHERE status='pending'").fetchone()[0],
        'total_sos': db.execute('SELECT COUNT(*) FROM sos_alerts').fetchone()[0],
        'total_users': db.execute('SELECT COUNT(*) FROM users').fetchone()[0],
    }
    db.close()
    return render_template('admin/dashboard.html', stats=stats)

@admin_bp.route('/crimes')
@admin_required
def review_crimes():
    db = get_db()
    crimes = db.execute('''SELECT crimes.*, users.name as reporter_name 
                           FROM crimes JOIN users ON crimes.user_id = users.id 
                           ORDER BY created_at DESC''').fetchall()
    db.close()
    return render_template('admin/review_crimes.html', crimes=crimes)

@admin_bp.route('/crimes/<int:crime_id>/approve', methods=['POST'])
@admin_required
def approve_crime(crime_id):
    db = get_db()
    db.execute("UPDATE crimes SET status = 'approved' WHERE id = ?", (crime_id,))
    db.commit()
    db.close()
    return jsonify({'status': 'approved'})

@admin_bp.route('/crimes/<int:crime_id>/reject', methods=['POST'])
@admin_required
def reject_crime(crime_id):
    db = get_db()
    db.execute("UPDATE crimes SET status = 'rejected' WHERE id = ?", (crime_id,))
    db.commit()
    db.close()
    return jsonify({'status': 'rejected'})
