var userLat = null;
var userLng = null;

// Welcome + request location on load
window.onload = function () {
    addBotMessage("Hi! I'm your SafeHer assistant. I can help with safety tips, legal guidance, or find nearby emergency services.");

    setTimeout(function () {
        addBotMessage("📍 Requesting your location to enable nearby service search...");
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function (pos) {
                    userLat = pos.coords.latitude;
                    userLng = pos.coords.longitude;
                    addBotMessage("✅ Location accessed! Use the buttons below to find nearby Police Stations or Hospitals.");
                },
                function () {
                    addBotMessage("⚠️ Location access denied. Please enable location in your browser to use nearby search features.");
                }
            );
        } else {
            addBotMessage("⚠️ Your browser does not support geolocation.");
        }
    }, 800);
};

// Add message helpers
function addBotMessage(html) {
    var msgs = document.getElementById('messages');
    var div  = document.createElement('div');
    div.className = 'message bot';
    div.innerHTML = html;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
}

function addUserMessage(text) {
    var msgs = document.getElementById('messages');
    var div  = document.createElement('div');
    div.className = 'message user';
    div.innerText = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
}

function scrollToChat() {
    document.querySelector('.chat-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Quick message from buttons
function quickMsg(text) {
    document.getElementById('userInput').value = text;
    chatbot();
}

// ── MAIN CHATBOT LOGIC ────────────────────────────────────
function chatbot() {
    var inputField = document.getElementById('userInput');
    var input      = inputField.value.trim();
    if (!input) return;

    addUserMessage(input);
    inputField.value = '';

    var lower = input.toLowerCase();
    var response = '';

    if (lower.includes('police') || lower.includes('station')) {
        findNearby('police station', '🚔 Police Station');
        return;
    }
    if (lower.includes('hospital') || lower.includes('ambulance') || lower.includes('medical')) {
        findNearby('hospital', '🏥 Hospital');
        return;
    }
    if (lower.includes('follow') || lower.includes('stalked') || lower.includes('being followed')) {
        response = '🚨 Go to a crowded public place immediately. Call a trusted person. If the threat is immediate, call Police: <b>100</b> or Emergency: <b>112</b>.';
    } else if (lower.includes('self defense') || lower.includes('defend') || lower.includes('attack')) {
        response = '💪 Target sensitive areas (eyes, nose, knees). Shout loudly to attract attention. Your goal is to escape, not fight. Run to a safe/crowded place.';
    } else if (lower.includes('alone') || lower.includes('night') || lower.includes('unsafe') || lower.includes('scared')) {
        response = '🌙 Stay in well-lit areas. Share your live location with a trusted contact. Keep emergency numbers ready: Police <b>100</b>, Women Helpline <b>1091</b>, Emergency <b>112</b>.';
    } else if (lower.includes('legal') || lower.includes('fir') || lower.includes('complaint') || lower.includes('rights')) {
        response = '⚖️ You have the right to file an FIR at any police station at no cost. For online complaints visit cybercrime.gov.in. Women Helpline: <b>1091</b>. Emergency: <b>112</b>.';
    } else if (lower.includes('helpline') || lower.includes('number') || lower.includes('emergency')) {
        response = '📞 <b>Emergency Numbers:</b><br>Police: 100<br>Ambulance: 102<br>Women Helpline: 1091<br>National Emergency: 112<br>Cyber Crime: 1930';
    } else if (lower.includes('report') || lower.includes('crime')) {
        response = '📋 You can report crimes directly on SafeHer! Go to <a href="/crime/report" style="color:#7b2cbf;font-weight:600;">Report a Crime</a> in your dashboard. Reports are reviewed by our admin team.';
    } else if (lower.includes('travel') || lower.includes('safe') || lower.includes('transport')) {
        response = '🚌 Use trusted transport. Share your ride details and live location with someone you trust. Use SafeHer\'s <a href="/shuttle" style="color:#7b2cbf;font-weight:600;">SheShuttle</a> for women-only safe transport.';
    } else {
        response = 'I can help with safety tips, legal guidance, finding nearby police stations/hospitals, or reporting crimes. What do you need help with?';
    }

    addBotMessage(response);
}

// ── FIND NEARBY (opens Google Maps) ──────────────────────
function findNearby(placeType, label) {
    addUserMessage('Find nearest ' + label);

    if (!userLat || !userLng) {
        // Try getting location now
        if (!navigator.geolocation) {
            addBotMessage('⚠️ Geolocation is not supported by your browser.');
            return;
        }
        addBotMessage('📍 Getting your location...');
        navigator.geolocation.getCurrentPosition(
            function (pos) {
                userLat = pos.coords.latitude;
                userLng = pos.coords.longitude;
                showNearbyButtons(placeType, label, userLat, userLng);
            },
            function () {
                addBotMessage('⚠️ Could not get your location. Please enable location access in your browser settings, then try again.');
            }
        );
        return;
    }
    showNearbyButtons(placeType, label, userLat, userLng);
}

function showNearbyButtons(placeType, label, lat, lng) {
    // Google Maps Search URL
    var googleMapsUrl = 'https://www.google.com/maps/search/' + encodeURIComponent(placeType)
        + '/@' + lat + ',' + lng + ',15z';

    // Google Maps Directions URL (nearest)
    var directionsUrl = 'https://www.google.com/maps/dir/?api=1'
        + '&origin=' + lat + ',' + lng
        + '&destination=' + encodeURIComponent(placeType)
        + '&travelmode=driving';

    var html = '📍 Here are the nearest <b>' + label + 's</b> near you:<br><br>'
        + '<a href="' + googleMapsUrl + '" target="_blank" class="map-btn">🗺️ View on Google Maps</a>'
        + '<a href="' + directionsUrl + '" target="_blank" class="map-btn-alt">🧭 Get Directions</a>'
        + '<br><small style="color:#9ca3af;margin-top:6px;display:block;">Opens in Google Maps with your current location</small>';

    addBotMessage(html);
    scrollToChat();
}

// ── FAQ CLICK ─────────────────────────────────────────────
function faqMsg(question) {
    addUserMessage(question);
    scrollToChat();

    var answers = {
        '📞 What is the emergency number?':
            '📞 <b>Emergency numbers in India:</b><br>Police: <b>100</b><br>Ambulance: <b>102</b><br>Women Helpline: <b>1091</b><br>National Emergency: <b>112</b><br>Cyber Crime: <b>1930</b>',

        '📍 How can I share my live location?':
            '📍 Share your live location using <b>Google Maps</b> (tap your location → Share) or <b>WhatsApp Live Location</b>. You can also use SafeHer\'s SOS feature which shares your location automatically with your emergency contact.',

        '⚠️ What should I do if I feel unsafe?':
            '⚠️ <b>Immediate steps:</b><br>1. Move to a crowded/public place<br>2. Call a trusted person<br>3. Use SafeHer SOS to alert your emergency contact<br>4. Call Police (100) or Emergency (112) if in immediate danger',

        '🌙 What are some late night safety tips?':
            '🌙 <b>Late night safety tips:</b><br>• Avoid isolated/unlit areas<br>• Keep emergency contacts saved<br>• Share your travel route with someone<br>• Use trusted transport (SafeHer SheShuttle)<br>• Stay alert and avoid distractions',

        '🚨 How can I report a crime?':
            '🚨 You can report crimes through:<br>• <a href="/crime/report" style="color:#7b2cbf;font-weight:600;">SafeHer Crime Report</a> (on this platform)<br>• Nearest police station (free to file FIR)<br>• National Cyber Crime portal: cybercrime.gov.in<br>• Call 100 (Police) or 112 (Emergency)',

        '🚌 What are some safe travel tips?':
            '🚌 <b>Safe travel tips:</b><br>• Use trusted services like <a href="/shuttle" style="color:#7b2cbf;font-weight:600;">SheShuttle</a><br>• Share your ride details with a contact<br>• Enable live location sharing<br>• Sit near the driver or in visible seats<br>• Avoid travelling alone very late at night'
    };

    var answer = answers[question] || 'I\'m not sure about that. Please ask another safety question!';
    addBotMessage(answer);
}