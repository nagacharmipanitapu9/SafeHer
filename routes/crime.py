import os
from flask import Blueprint, render_template, request, redirect, session, jsonify, flash
from database import get_db
from werkzeug.utils import secure_filename

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
            # Save uploaded files
            os.makedirs(UPLOAD_FOLDER, exist_ok=True)
            saved_files = []
            for f in request.files.getlist('files'):
                if f and f.filename and allowed_file(f.filename):
                    filename = secure_filename(f.filename)
                    # Make filename unique
                    import time
                    filename = f"{int(time.time())}_{filename}"
                    f.save(os.path.join(UPLOAD_FOLDER, filename))
                    saved_files.append(filename)

            db.execute(
                '''INSERT INTO crimes
                   (user_id, crime_type, description, latitude, longitude, location_name, severity, attachments)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                (
                    session['user_id'],
                    request.form['crime_type'],
                    request.form['description'],
                    request.form['latitude'],
                    request.form['longitude'],
                    request.form['location_name'],
                    request.form['severity'],
                    ','.join(saved_files)
                )
            )
            db.commit()
            flash('Report submitted successfully! It will appear on the map after admin review.', 'success')
            db.close()
            return redirect('/crime/map?submitted=1')
        except Exception as e:
            flash('Failed to submit report. Please try again.', 'error')
            db.close()
            return redirect('/crime/report')

    return render_template('report_crime.html')


@crime_bp.route('/map')
def crime_map():
    return render_template('crime_map.html')


@crime_bp.route('/api/crimes')
def get_crimes():
    db = get_db()
    crimes = db.execute(
        'SELECT * FROM crimes WHERE status = "approved" ORDER BY created_at DESC'
    ).fetchall()
    db.close()
    return jsonify([dict(c) for c in crimes])


@crime_bp.route('/api/all-crimes')
def get_all_crimes():
    if 'user_id' not in session:
        return jsonify([])
    db = get_db()
    crimes = db.execute('SELECT * FROM crimes ORDER BY created_at DESC').fetchall()
    db.close()
    return jsonify([dict(c) for c in crimes])