from flask import Blueprint, render_template, request, redirect, session, jsonify
from functools import wraps
from database import get_db

admin_bp = Blueprint('admin', __name__)
VALID_STATUSES = ['pending', 'investigating', 'approved', 'resolved', 'rejected']

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
        'total_crimes':    db.execute('SELECT COUNT(*) FROM crimes').fetchone()[0],
        'pending_crimes':  db.execute("SELECT COUNT(*) FROM crimes WHERE status='pending'").fetchone()[0],
        'approved_crimes': db.execute("SELECT COUNT(*) FROM crimes WHERE status='approved'").fetchone()[0],
        'investigating':   db.execute("SELECT COUNT(*) FROM crimes WHERE status='investigating'").fetchone()[0],
        'resolved':        db.execute("SELECT COUNT(*) FROM crimes WHERE status='resolved'").fetchone()[0],
        'rejected':        db.execute("SELECT COUNT(*) FROM crimes WHERE status='rejected'").fetchone()[0],
        'total_sos':       db.execute('SELECT COUNT(*) FROM sos_alerts').fetchone()[0],
        'total_users':     db.execute("SELECT COUNT(*) FROM users WHERE role='user'").fetchone()[0],
    }
    db.close()
    return render_template('admin/dashboard.html', stats=stats)


@admin_bp.route('/map')
@admin_required
def admin_map():
    return render_template('crime_map.html')


@admin_bp.route('/crimes')
@admin_required
def review_crimes():
    db = get_db()
    crimes = db.execute(
        '''SELECT crimes.*, users.name AS reporter_name
           FROM crimes JOIN users ON crimes.user_id = users.id
           ORDER BY crimes.created_at DESC'''
    ).fetchall()
    db.close()
    return render_template('admin/review_crimes.html', crimes=crimes)


@admin_bp.route('/crimes/<int:crime_id>/update-status', methods=['POST'])
@admin_required
def update_status(crime_id):
    data = request.get_json(force=True)
    new_status = (data.get('status') or '').strip()
    if new_status not in VALID_STATUSES:
        return jsonify({'error': 'Invalid status'}), 400
    db = get_db()
    db.execute('UPDATE crimes SET status=? WHERE id=?', (new_status, crime_id))
    db.commit()
    db.close()
    return jsonify({'status': new_status, 'id': crime_id})


@admin_bp.route('/crimes/<int:crime_id>/approve', methods=['POST'])
@admin_required
def approve_crime(crime_id):
    db = get_db()
    db.execute("UPDATE crimes SET status='approved' WHERE id=?", (crime_id,))
    db.commit()
    db.close()
    return jsonify({'status': 'approved'})


@admin_bp.route('/crimes/<int:crime_id>/reject', methods=['POST'])
@admin_required
def reject_crime(crime_id):
    db = get_db()
    db.execute("UPDATE crimes SET status='rejected' WHERE id=?", (crime_id,))
    db.commit()
    db.close()
    return jsonify({'status': 'rejected'})


# ── USER MANAGEMENT ROUTES ────────────────────────────────────
@admin_bp.route('/users')
@admin_required
def manage_users():
    db = get_db()
    users = db.execute(
        "SELECT * FROM users WHERE role='user' ORDER BY created_at DESC"
    ).fetchall()
    db.close()
    return render_template('admin/manage_users.html', users=users)


@admin_bp.route('/users/<int:user_id>/verify', methods=['POST'])
@admin_required
def verify_user(user_id):
    data       = request.get_json(force=True)
    is_verified = 1 if data.get('verified') else 0
    db = get_db()
    db.execute('UPDATE users SET is_verified=? WHERE id=?', (is_verified, user_id))
    db.commit()
    db.close()
    return jsonify({'user_id': user_id, 'is_verified': is_verified})