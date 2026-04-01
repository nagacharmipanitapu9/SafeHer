from flask import Blueprint, render_template, request, jsonify
import json

chatbot_bp = Blueprint('chatbot', __name__)

# Simple rule-based chatbot (replace with AI API for production)
RESPONSES = {
    'police': 'To find nearest police stations, I\'ll use your location. Please enable GPS. You can also call 100 (Police) or 112 (Emergency).',
    'hospital': 'For nearest hospitals, share your location. Emergency number: 108 (Ambulance).',
    'safety': 'Safety tips: 1) Share live location with trusted contacts. 2) Use SOS feature. 3) Avoid isolated areas at night. 4) Keep emergency numbers saved.',
    'legal': 'For legal help: Contact Women Helpline 181. File FIR at nearest police station. You can also file online complaints at NCW website.',
    'helpline': 'Important numbers: Women Helpline: 181, Police: 100, Ambulance: 108, Emergency: 112',
}

@chatbot_bp.route('/')
def chat_page():
    return render_template('chatbot.html')

@chatbot_bp.route('/ask', methods=['POST'])
def ask():
    message = request.json.get('message', '').lower()
    
    response = "I'm here to help with your safety. Ask me about police stations, hospitals, safety tips, legal rights, or helpline numbers."
    
    for keyword, reply in RESPONSES.items():
        if keyword in message:
            response = reply
            break
    
    # For location-based queries, use the provided coordinates
    lat = request.json.get('latitude')
    lng = request.json.get('longitude')
    if lat and lng and ('nearest' in message or 'nearby' in message):
        response += f"\n\nBased on your location ({lat}, {lng}), searching nearby services..."
    
    return jsonify({'response': response})
