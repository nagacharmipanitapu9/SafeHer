var sosBtn = document.getElementById('sos-button');

// ── Load contacts preview ─────────────────────────────────
window.addEventListener('load', function () {
    fetch('/sos/api/contacts')
        .then(function (r) { return r.json(); })
        .then(function (contacts) {
            var warn    = document.getElementById('no-contacts-warn');
            var preview = document.getElementById('contacts-preview');
            var pills   = document.getElementById('contacts-pills');

            if (!contacts.length) {
                warn.style.display    = 'block';
                preview.style.display = 'none';
            } else {
                warn.style.display    = 'none';
                preview.style.display = 'block';
                pills.innerHTML = contacts.map(function (c) {
                    var emailLine  = c.email
                        ? '📧 ' + c.email
                        : '⚠️ No email — add one in Profile';
                    var emailColor = c.email ? '' : 'color:#ef4444;font-weight:600;';
                    return '<div class="contact-pill">'
                        + '<div class="contact-name">👤 ' + c.name + '</div>'
                        + '<div class="contact-email" style="' + emailColor + '">' + emailLine + '</div>'
                        + '</div>';
                }).join('');
            }
        })
        .catch(function () {});
});

// ── Instant click trigger (no hold needed) ────────────────
sosBtn.addEventListener('click', function () {
    triggerSOS();
});

// ── Trigger SOS ───────────────────────────────────────────
function triggerSOS() {
    sosBtn.disabled    = true;
    sosBtn.innerHTML = '⏳<br><small>Sending...</small>';

    if (!navigator.geolocation) {
        showResult('error', '⚠️ GPS not supported. Please call 112 directly.');
        resetBtn(2000);
        return;
    }

    showResult('loading', '📍 Getting your exact location...');

    navigator.geolocation.getCurrentPosition(
        function (pos) {
            showResult('loading', '📧 Sending emergency emails...');

            fetch('/sos/trigger', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    latitude:  pos.coords.latitude,
                    longitude: pos.coords.longitude
                })
            })
            .then(function (r) { return r.json(); })
            .then(function (data) { renderResult(data); })
            .catch(function () {
                showResult('error', '⚠️ Server error. Please call 112 directly.');
                resetBtn(2000);
            });
        },
        function () {
            showResult('error', '⚠️ Location access denied. Please enable GPS.');
            resetBtn(2000);
        },
        { timeout: 12000, enableHighAccuracy: true }
    );
}

// ── Render result ─────────────────────────────────────────
function renderResult(data) {
    var el = document.getElementById('sos-status');
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (data.status === 'no_contacts') {
        el.innerHTML =
            '<div class="status-title">⚠️ No Emergency Contacts</div>'
            + '<p style="color:#6b7280;font-size:0.88rem;">SOS was recorded but nobody was notified. '
            + '<a href="/auth/profile" style="color:#6d28d9;font-weight:600;">Add emergency contacts →</a></p>'
            + (data.maps_link
                ? '<div class="location-wrapper">'
                  + '<a href="' + data.maps_link + '" target="_blank" class="location-link">🗺️ View Your Live Location</a>'
                  + '</div>'
                : '');
        resetBtn(3000);
        return;
    }

    // Contact result rows
    var rows =
        '<div class="results-grid">'
        + (data.email_results || []).map(function (r) {
            var sent       = r.sent;
            var badgeClass = sent ? 'sent' : (data.email_enabled ? 'failed' : 'not-active');
            var badgeText  = sent ? '✅ Email Sent' : (data.email_enabled ? '❌ Failed' : '⚙️ Not Active');
            var errorNote  = (!sent && r.error)
                ? '<div style="font-size:0.75rem;color:#ef4444;margin-top:3px;">' + r.error + '</div>'
                : '';
            return '<div class="result-row">'
                + '<div class="result-name">👤 ' + r.name + '</div>'
                + '<div class="result-phone">📧 ' + r.email + '</div>'
                + errorNote
                + '<span class="email-badge ' + badgeClass + '">' + badgeText + '</span>'
                + '</div>';
        }).join('')
        + '</div>';

    var sentCount  = (data.sent_to  || []).length;
    var totalCount = (data.contacts || []).length;

    var titleIcon = sentCount > 0 ? '🚨' : '⚠️';
    var titleText = sentCount > 0
        ? 'Email sent to ' + sentCount + ' of ' + totalCount + ' contact(s)'
        : 'SOS recorded — Email not delivered';

    var setupNote = !data.email_enabled
        ? '<div class="setup-note">'
          + '⚙️ Auto email needs Gmail credentials. '
          + '<a href="https://www.gmail.com" target="_blank">Sign up free</a> '
          + 'and set <code>GMAIL_USER</code> and <code>GMAIL_PASS</code> in sos.py. '
          + 'Use WhatsApp links above until then.'
          + '</div>'
        : '';

    el.innerHTML =
        '<div class="status-title">' + titleIcon + ' ' + titleText + '</div>'
        + rows
        + (data.maps_link
            ? '<div class="location-wrapper">'
              + '<a href="' + data.maps_link + '" target="_blank" class="location-link">🗺️ View Your Live Location</a>'
              + '</div>'
            : '')
        + setupNote;

    if (sentCount > 0) {
        showToast('🚨 Email sent to ' + sentCount + ' contact(s)!', 'success');
    } else if (!data.email_enabled) {
        showToast('SOS recorded. Configure Gmail in sos.py to enable email.', 'info');
    } else {
        showToast('SOS recorded. Make sure contacts have email addresses saved.', 'error');
    }

    resetBtn(5000);
}

// ── Helpers ───────────────────────────────────────────────
function showResult(type, msg) {
    var el = document.getElementById('sos-status');
    el.style.display = 'block';
    var bg = type === 'error'   ? '#fee2e2'
           : type === 'loading' ? '#dbeafe'
           :                      '#d1fae5';
    var fg = type === 'error'   ? '#991b1b'
           : type === 'loading' ? '#1e40af'
           :                      '#065f46';
    el.innerHTML = '<div style="background:' + bg + ';color:' + fg
        + ';padding:14px 16px;border-radius:10px;font-size:0.9rem;">' + msg + '</div>';
}

function resetBtn(delay) {
    setTimeout(function () {
        sosBtn.disabled   = false;
        sosBtn.innerHTML  = '🚨 SOS<br><small>Tap to Send Alert</small>';
    }, delay || 3000);
}

// ── False Alarm Siren ─────────────────────────────────────
let alarmCtx      = null;
let alarmNodes    = [];
let alarmOn       = false;
let alarmInterval = null;

function buildSiren(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    gain.gain.value = 0.5;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    /* Slow sweep: rise from 200Hz to 900Hz over 3s, drop back over 3s */
    function sweep() {
        osc.frequency.setTargetAtTime(900, ctx.currentTime,       1.2);
        osc.frequency.setTargetAtTime(200, ctx.currentTime + 3.0, 1.2);
    }
    sweep();
    const interval = setInterval(sweep, 6000);
    osc._interval = interval;

    return [osc, gain];
}

function stopSiren() {
    alarmNodes.forEach(n => {
        try {
            if (n._interval) clearInterval(n._interval);
            n.stop(); n.disconnect();
        } catch(e) {}
    });
    alarmNodes = [];
    if (alarmCtx) { alarmCtx.close(); alarmCtx = null; }
    clearInterval(alarmInterval);
}

function toggleAlarm() {
    const btn    = document.getElementById('alarmBtn');
    const status = document.getElementById('alarmStatus');

    if (!alarmOn) {
        alarmOn    = true;
        alarmCtx   = new (window.AudioContext || window.webkitAudioContext)();
        alarmNodes = buildSiren(alarmCtx);

        btn.textContent = '🔕 Stop Alarm';
        btn.classList.add('ringing');
        status.style.display = 'flex';

        /* Restart every 25s to keep alive on mobile */
        alarmInterval = setInterval(() => {
            stopSiren();
            if (alarmOn) {
                alarmCtx   = new (window.AudioContext || window.webkitAudioContext)();
                alarmNodes = buildSiren(alarmCtx);
            }
        }, 25000);

    } else {
        alarmOn = false;
        stopSiren();
        btn.textContent = '🔔 Start False Alarm';
        btn.classList.remove('ringing');
        status.style.display = 'none';
    }
}

/* Stop alarm on page leave */
window.addEventListener('beforeunload', () => {
    if (alarmOn) stopSiren();
});