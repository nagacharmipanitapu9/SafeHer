import json
from flask import Blueprint, render_template, request, redirect, session, flash
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name              = request.form.get('name', '').strip()
        email             = request.form.get('email', '').strip()
        password          = generate_password_hash(request.form.get('password', ''))
        phone             = request.form.get('phone', '').strip()
        alternate_phone   = request.form.get('alternate_phone', '').strip()
        aadhar_number     = request.form.get('aadhar_number', '').strip()
        current_address   = request.form.get('current_address', '').strip()
        permanent_address = request.form.get('permanent_address', '').strip()
        contacts_json     = request.form.get('contacts_json', '[]').strip()

        # Validate at least 1 emergency contact
        try:
            contacts_list = json.loads(contacts_json)
            if not isinstance(contacts_list, list) or len(contacts_list) == 0:
                flash('Please add at least one emergency contact.', 'error')
                return render_template('register.html')
        except Exception:
            flash('Invalid emergency contact data. Please try again.', 'error')
            return render_template('register.html')

        db = get_db()
        try:
            db.execute(
                '''INSERT INTO users
                   (name, email, password, phone, alternate_phone, aadhar_number,
                    current_address, permanent_address, contacts_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (name, email, password, phone, alternate_phone, aadhar_number,
                 current_address, permanent_address, contacts_json)
            )
            db.commit()
            flash('Registration successful! Please login.', 'success')
            return redirect('/auth/login')
        except Exception as e:
            if 'UNIQUE' in str(e):
                flash('Email already exists. Please login.', 'error')
            else:
                flash('Registration failed: ' + str(e), 'error')
        finally:
            db.close()
    return render_template('register.html')


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email    = request.form['email']
        password = request.form['password']
        db   = get_db()
        user = db.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
        db.close()
        if user and check_password_hash(user['password'], password):
            session['user_id']   = user['id']
            session['user_name'] = user['name']
            session['role']      = user['role']
            return redirect('/admin/dashboard' if user['role'] == 'admin' else '/dashboard')
        flash('Invalid email or password.', 'error')
        return redirect('/auth/login')
    return render_template('login.html')


@auth_bp.route('/profile', methods=['GET', 'POST'])
def profile():
    if 'user_id' not in session:
        return redirect('/auth/login')

    db   = get_db()
    user = db.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()

    # ── Auto-migrate legacy contacts to contacts_json on first profile visit ──
    raw_json = user['contacts_json'] or '[]'
    try:
        existing = json.loads(raw_json)
    except Exception:
        existing = []

    # If contacts_json is empty but legacy fields have data → migrate them
    if len(existing) == 0 and user['emergency_contact_phone']:
        legacy = [{
            'name':  user['emergency_contact_name'] or 'Emergency Contact',
            'phone': str(user['emergency_contact_phone']).strip()
        }]
        try:
            db.execute(
                'UPDATE users SET contacts_json = ? WHERE id = ?',
                (json.dumps(legacy), session['user_id'])
            )
            db.commit()
            # Reload user with updated data
            user = db.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()
            print(f'[Profile] Migrated legacy contact for user {session["user_id"]}')
        except Exception as e:
            print(f'[Profile] Migration error: {e}')

    if request.method == 'POST':
        name              = request.form.get('name', '').strip()
        phone             = request.form.get('phone', '').strip()
        alternate_phone   = request.form.get('alternate_phone', '').strip()
        aadhar_number     = request.form.get('aadhar_number', '').strip()
        current_address   = request.form.get('current_address', '').strip()
        permanent_address = request.form.get('permanent_address', '').strip()
        contacts_json     = request.form.get('contacts_json', '[]').strip()
        new_pw            = request.form.get('new_password', '').strip()

        # Validate at least 1 contact
        try:
            contacts_list = json.loads(contacts_json)
            if not isinstance(contacts_list, list) or len(contacts_list) == 0:
                flash('At least one emergency contact is required.', 'error')
                db.close()
                return render_template('profile.html', user=user)
        except Exception:
            contacts_json = user['contacts_json'] or '[]'

        try:
            if new_pw:
                if len(new_pw) < 6:
                    flash('Password must be at least 6 characters.', 'error')
                    db.close()
                    return render_template('profile.html', user=user)
                db.execute(
                    '''UPDATE users SET name=?, phone=?, alternate_phone=?, aadhar_number=?,
                       current_address=?, permanent_address=?, contacts_json=?, password=?
                       WHERE id=?''',
                    (name, phone, alternate_phone, aadhar_number, current_address,
                     permanent_address, contacts_json,
                     generate_password_hash(new_pw), session['user_id'])
                )
            else:
                db.execute(
                    '''UPDATE users SET name=?, phone=?, alternate_phone=?, aadhar_number=?,
                       current_address=?, permanent_address=?, contacts_json=?
                       WHERE id=?''',
                    (name, phone, alternate_phone, aadhar_number, current_address,
                     permanent_address, contacts_json, session['user_id'])
                )
            db.commit()
            session['user_name'] = name
            flash('Profile updated successfully!', 'success')
        except Exception as e:
            flash('Failed to update profile: ' + str(e), 'error')
        finally:
            db.close()
        return redirect('/auth/profile')

    db.close()
    return render_template('profile.html', user=user)


@auth_bp.route('/logout')
def logout():
    session.clear()
    return redirect('/')