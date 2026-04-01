import os
import time
from flask import Blueprint, render_template, request, redirect, session, jsonify, flash
from werkzeug.utils import secure_filename
from database import get_db

crime_bp = Blueprint('crime', __name__)

UPLOAD_FOLDER = os.path.join('static', 'uploads')
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif', 'mp3', 'wav', 'm4a', 'ogg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@crime_bp.route('/report', methods=['GET', 'POST'])
def report():
    if 'user_id' not in session:
        return redirect('/auth/login')

    if request.method == 'POST':
        db = get_db()
        try:
            crime_type    = request.form.get('crime_type', '').strip()
            description   = request.form.get('description', '').strip()
            latitude      = request.form.get('latitude', '').strip()
            longitude     = request.form.get('longitude', '').strip()
            location_name = request.form.get('location_name', '').strip()
            severity      = request.form.get('severity', 'medium').strip()

            if not crime_type:
                flash('Please select a crime type.', 'error')
                return redirect('/crime/report')
            if not latitude or not longitude:
                flash('Please pin the location on the map.', 'error')
                return redirect('/crime/report')
            if not description:
                flash('Please enter a description.', 'error')
                return redirect('/crime/report')

            os.makedirs(UPLOAD_FOLDER, exist_ok=True)
            saved_files = []
            for f in request.files.getlist('files'):
                if f and f.filename and allowed_file(f.filename):
                    fname = str(int(time.time())) + '_' + secure_filename(f.filename)
                    f.save(os.path.join(UPLOAD_FOLDER, fname))
                    saved_files.append(fname)

            db.execute(
                '''INSERT INTO crimes
                   (user_id, crime_type, description, latitude, longitude,
                    location_name, severity, attachments)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                (
                    session['user_id'],
                    crime_type,
                    description,
                    float(latitude),
                    float(longitude),
                    location_name or (latitude + ', ' + longitude),
                    severity,
                    ','.join(saved_files)
                )
            )
            db.commit()
            flash('Report submitted successfully! Pending admin review.', 'success')
            return redirect('/crime/map?submitted=1')

        except Exception as e:
            print('Crime report error:', e)
            flash('Failed to submit report: ' + str(e), 'error')
            return redirect('/crime/report')
        finally:
            db.close()

    return render_template('report_crime.html')


@crime_bp.route('/map')
def crime_map():
    return render_template('crime_map.html')


@crime_bp.route('/api/crimes')
def get_crimes():
    """Public endpoint — approved crimes only."""
    db = get_db()
    crimes = db.execute(
        'SELECT * FROM crimes WHERE status="approved" ORDER BY created_at DESC'
    ).fetchall()
    db.close()
    return jsonify([dict(c) for c in crimes])


@crime_bp.route('/api/all-crimes')
def get_all_crimes():
    """Admin: all crimes with reporter name.
       User: approved + their own reports.
       Guest: empty list."""
    if 'user_id' not in session:
        return jsonify([])
    db = get_db()
    if session.get('role') == 'admin':
        rows = db.execute(
            '''SELECT crimes.*, users.name AS reporter_name
               FROM crimes
               JOIN users ON crimes.user_id = users.id
               ORDER BY crimes.created_at DESC'''
        ).fetchall()
    else:
        rows = db.execute(
            '''SELECT crimes.*, users.name AS reporter_name
               FROM crimes
               JOIN users ON crimes.user_id = users.id
               WHERE crimes.status = "approved" OR crimes.user_id = ?
               ORDER BY crimes.created_at DESC''',
            (session['user_id'],)
        ).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])