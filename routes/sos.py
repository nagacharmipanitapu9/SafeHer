import json
import os
import smtplib
from email.mime.text import MIMEText
from flask import Blueprint, redirect, request, session, jsonify, render_template
from database import get_db

sos_bp = Blueprint('sos', __name__)
GMAIL_USER = "nagacharmipanitapu9@gmail.com"
GMAIL_PASS = "jzll hzvw eflo tgmf"

EMAIL_ENABLED = bool(
    GMAIL_USER.strip()
    and GMAIL_PASS.strip()
)

def send_email(recipient, subject, body):
    try:
        msg = MIMEText(body)

        msg["Subject"] = subject
        msg["From"] = GMAIL_USER
        msg["To"] = recipient

        server = smtplib.SMTP("smtp.gmail.com", 587)

        server.starttls()

        server.login(
            GMAIL_USER,
            GMAIL_PASS
        )

        server.send_message(msg)

        server.quit()

        return True, None

    except Exception as e:
        return False, str(e)

def get_all_contacts(user):
    """
    Return all emergency contacts from BOTH storage systems, deduplicated.
    Handles migration from legacy fields to contacts_json automatically.
    """
    contacts = []
    seen_phones = set()

    # 1. From contacts_json (new multi-contact system)
    try:
        json_list = json.loads(user['contacts_json'] or '[]')
        for c in json_list:
            phone = str(c.get('phone', '')).replace(' ', '').strip()
            if phone and phone not in seen_phones:
                contacts.append({
                    'name': c.get('name', 'Contact'),
                    'phone': phone,
                    'email': c.get('email', '').strip()
                })
                seen_phones.add(phone)
    except Exception:
        pass

    # 2. From legacy single-contact fields (fallback)
    if user['emergency_contact_phone']:
        phone = str(user['emergency_contact_phone']).replace(' ', '').strip()
        if phone and phone not in seen_phones:
            contacts.append({
                'name':  user['emergency_contact_name'] or 'Emergency Contact',
                'phone': phone,
                'email': ''
            })
            seen_phones.add(phone)

    return contacts


@sos_bp.route('/')
def sos_page():
    if 'user_id' not in session:
        return redirect('/auth/login')
    return render_template('sos.html', email_enabled=EMAIL_ENABLED)


@sos_bp.route('/trigger', methods=['POST'])
def trigger_sos():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    data      = request.get_json(force=True)
    latitude  = data.get('latitude')
    longitude = data.get('longitude')

    db   = get_db()
    user = db.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    contacts = get_all_contacts(user)

    maps_link = f'https://maps.google.com/?q={latitude},{longitude}'

    email_text = f"""
        🚨 SOS ALERT 🚨

        {user["name"]} may need immediate assistance.

        Phone:
        {user["phone"]}

        Location:
        {maps_link}

        Please contact them immediately.

        -SafeHer
    """

    # Always save to DB first
    db.execute(
        '''INSERT INTO sos_alerts (user_id, latitude, longitude, message, emergency_contacts)
           VALUES (?, ?, ?, ?, ?)''',
        (session['user_id'], latitude, longitude, email_text, json.dumps(contacts))
    )
    db.commit()
    db.close()

    if not contacts:
        return jsonify({
            'status':      'no_contacts',
            'message':     'SOS recorded but no emergency contacts found.',
            'maps_link':   maps_link,
            'email_enabled': EMAIL_ENABLED,
            'contacts':    [],
            'email_results': [],
            'email_text':    email_text
        })
        # Send email to every contact
    email_results = []

    for contact in contacts:

        email = contact.get('email', '')

        if not email:

            email_results.append({
                'name': contact['name'],
                'email': '',
                'sent': False,
                'error': 'No email address configured'
            })

            continue

        success, error = send_email(
            email,
            '🚨 Emergency SOS Alert',
            email_text
        )

        email_results.append({
            'name': contact['name'],
            'email': email,
            'sent': success,
            'error': error
        })

    sent_to = [r['name'] for r in email_results if r['sent']]
    failed  = [r['name'] for r in email_results if not r['sent']]

    return jsonify({
        'status': 'success',
        'email_enabled': EMAIL_ENABLED,
        'email_text': email_text,
        'maps_link': maps_link,
        'contacts': contacts,
        'email_results': email_results,
        'sent_to': sent_to,
        'failed': failed
    })


@sos_bp.route('/api/contacts')
def get_contacts():
    if 'user_id' not in session:
        return jsonify([])
    db   = get_db()
    user = db.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    db.close()
    return jsonify(get_all_contacts(user))