from flask import Blueprint, render_template, request, redirect, session, flash
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db
from models import user

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name     = request.form['name']
        email    = request.form['email']
        password = generate_password_hash(request.form['password'])
        phone    = request.form['phone']
        db = get_db()
        try:
            db.execute(
                'INSERT INTO users (name, email, password, phone) VALUES (?, ?, ?, ?)',
                (name, email, password, phone)
            )
            db.commit()
            flash('Registration successful! Please login.', 'success')
            return redirect('/auth/login')
        except Exception:
            flash('Email already exists.', 'error')
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
            # Redirect based on role — no tab needed
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
    contacts = db.execute('SELECT id, name, phone, relationship FROM emergency_contacts WHERE user_id = ?',
                          (session['user_id'],)).fetchall()

    if request.method == 'POST':
        name         = request.form['name']
        phone        = request.form.get('phone', '')
        address      = request.form.get('address', '')
        ec_name      = request.form.get('emergency_contact_name', '')
        ec_phone     = request.form.get('emergency_contact_phone', '')
        contacts_json= request.form.get('contacts_json', '')
        new_pw       = request.form.get('new_password', '').strip()

        if new_pw:
            if len(new_pw) < 6:
                flash('Password must be at least 6 characters.', 'error')
                db.close()
                return render_template('profile.html', user=user, contacts=contacts)
            db.execute(
                '''UPDATE users SET name=?, phone=?, address=?, emergency_contact_name=?,
                   emergency_contact_phone=?, password=? WHERE id=?''',
                (name, phone, address, ec_name, ec_phone, generate_password_hash(new_pw), session['user_id'])
            )
        else:
            db.execute(
                '''UPDATE users SET name=?, phone=?, address=?, emergency_contact_name=?,
                   emergency_contact_phone=? WHERE id=?''',
                (name, phone, address, ec_name, ec_phone, session['user_id'])
            )

        # Persist dynamic emergency contacts list
        if contacts_json:
            import json
            try:
                contacts_data = json.loads(contacts_json)
            except Exception:
                contacts_data = []

            db.execute('DELETE FROM emergency_contacts WHERE user_id = ?', (session['user_id'],))
            for item in contacts_data:
                if item.get('name') and item.get('phone'):
                    db.execute(
                        'INSERT INTO emergency_contacts (user_id, name, phone, relationship) VALUES (?, ?, ?, ?)',
                        (session['user_id'], item.get('name'), item.get('phone'), item.get('relationship', None))
                    )
        elif ec_name and ec_phone:
            # Legacy fallback for single emergency contact fields
            db.execute('DELETE FROM emergency_contacts WHERE user_id = ?', (session['user_id'],))
            db.execute(
                'INSERT INTO emergency_contacts (user_id, name, phone) VALUES (?, ?, ?)',
                (session['user_id'], ec_name, ec_phone)
            )

        db.commit()
        session['user_name'] = name
        flash('Profile updated successfully!', 'success')
        db.close()
        return redirect('/auth/profile')

    db.close()
    contacts_list = [dict(c) for c in contacts]
    return render_template('profile.html', user=user, contacts=contacts_list)


@auth_bp.route('/logout')
def logout():
    session.clear()
    return redirect('/')