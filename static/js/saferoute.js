/* ══════════════════════════════════════════════════════════
   SafeHer — Safe Route JS
   • Nominatim autocomplete
   • GPS detection
   • OSRM road routes
   • Recommended card + route list in right panel
   • Safety breakdown section (Crime / Lighting / Population / Anchors)
   • Correct safety_pct / risk_pct usage from backend
══════════════════════════════════════════════════════════ */

/* ── State ── */
let map            = null;
let mapLayers      = [];
let mode           = 'night';
let originCoords   = null;
let destCoords     = null;
let routesData     = null;
let activeRouteIdx = 0;

let _suggestTimers  = {};
let _nominatimCache = {};

/* ════════════════════════════════
   MAP INIT
════════════════════════════════ */
function initMap() {
    map = L.map('route-map', { zoomControl: true }).setView([17.44, 78.38], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    setTimeout(() => map.invalidateSize(), 300);
}

/* ════════════════════════════════
   TIME MODE
════════════════════════════════ */
function setMode(t, el) {
    mode = t;
    document.querySelectorAll('.tt-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
}

/* ════════════════════════════════
   GPS
════════════════════════════════ */
function useGPS() {
    if (!navigator.geolocation) { showToast('Geolocation not supported', 'error'); return; }
    const btn = document.getElementById('gps-btn');
    btn.disabled = true; btn.textContent = '⏳';
    showToast('Detecting your location…', 'info');

    navigator.geolocation.getCurrentPosition(
        pos => {
            originCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            const inp = document.getElementById('origin-input');
            inp.value = `My location (${originCoords.lat.toFixed(4)}, ${originCoords.lng.toFixed(4)})`;
            inp.dataset.lat = originCoords.lat;
            inp.dataset.lng = originCoords.lng;
            btn.disabled = false; btn.textContent = '📍';
            clearMapLayers();
            const icon = L.divIcon({
                className: '',
                html: `<div style="background:#e91e8c;border:3px solid #fff;border-radius:50%;width:16px;height:16px;box-shadow:0 0 10px rgba(233,30,140,.5);"></div>`,
                iconSize: [16,16], iconAnchor: [8,8]
            });
            const m = L.marker([originCoords.lat, originCoords.lng], { icon })
                .addTo(map).bindPopup('<b>📍 You are here</b>');
            mapLayers.push(m);
            map.setView([originCoords.lat, originCoords.lng], 13);
            showToast('📍 Location detected!', 'success');
        },
        err => {
            btn.disabled = false; btn.textContent = '📍';
            const msgs = { 1:'Permission denied.', 2:'Location unavailable.', 3:'Timed out.' };
            showToast(msgs[err.code] || 'Could not get location.', 'error');
        },
        { timeout: 12000, enableHighAccuracy: true, maximumAge: 0 }
    );
}

/* ════════════════════════════════
   SWAP LOCATIONS
════════════════════════════════ */
function swapLocations() {
    const oi = document.getElementById('origin-input');
    const di = document.getElementById('dest-input');
    const tmp = oi.value; oi.value = di.value; di.value = tmp;
    const tmpC = originCoords; originCoords = destCoords; destCoords = tmpC;
    if (originCoords) { oi.dataset.lat = originCoords.lat; oi.dataset.lng = originCoords.lng; }
    else { delete oi.dataset.lat; delete oi.dataset.lng; }
    if (destCoords)   { di.dataset.lat = destCoords.lat;   di.dataset.lng = destCoords.lng; }
    else { delete di.dataset.lat; delete di.dataset.lng; }
}

/* ════════════════════════════════
   AUTOCOMPLETE
════════════════════════════════ */
function suggestPlace(input, dropId) {
    const q = input.value.trim();
    const drop = document.getElementById(dropId);
    if (dropId === 'origin-drop') originCoords = null;
    if (dropId === 'dest-drop')   destCoords   = null;
    if (q.length < 3) { closeDrop(drop); return; }
    clearTimeout(_suggestTimers[dropId]);
    _suggestTimers[dropId] = setTimeout(() => doNominatim(q, drop, dropId, input), 380);
}

async function doNominatim(q, drop, dropId, input) {
    drop.innerHTML = '';
    const loader = document.createElement('div');
    loader.className = 'drop-loading';
    loader.textContent = '🔍 Searching…';
    drop.appendChild(loader);
    drop.classList.add('open');
    if (_nominatimCache[q]) { renderDrop(_nominatimCache[q], drop, dropId, input); return; }
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&countrycodes=in&addressdetails=1`,
            { headers: { 'Accept-Language': 'en', 'User-Agent': 'SafeHer/2.0' } }
        );
        const data = await res.json();
        _nominatimCache[q] = data;
        renderDrop(data, drop, dropId, input);
    } catch {
        drop.innerHTML = '<div class="drop-loading">Search failed. Check connection.</div>';
    }
}

function renderDrop(results, drop, dropId, input) {
    drop.innerHTML = '';
    if (!results.length) { drop.innerHTML = '<div class="drop-loading">No results found.</div>'; return; }
    results.forEach(r => {
        const lat   = parseFloat(r.lat);
        const lng   = parseFloat(r.lon);
        const parts = r.display_name.split(', ');
        const main  = parts.slice(0, 2).join(', ');
        const sub   = parts.slice(2, 5).join(', ');
        const item  = document.createElement('div');
        item.className = 'drop-item';
        item.innerHTML = `
            <span class="drop-icon">📍</span>
            <div>
                <div class="drop-main">${esc(main)}</div>
                <div class="drop-sub">${esc(sub)}</div>
            </div>`;
        item.addEventListener('mousedown', e => {
            e.preventDefault();
            input.value = main;
            input.dataset.lat = lat;
            input.dataset.lng = lng;
            if (dropId === 'origin-drop') originCoords = { lat, lng };
            if (dropId === 'dest-drop')   destCoords   = { lat, lng };
            closeDrop(drop);
        });
        drop.appendChild(item);
    });
}

function closeDrop(drop) {
    if (!drop) return;
    drop.classList.remove('open');
    drop.innerHTML = '';
}

document.addEventListener('click', e => {
    if (!e.target.closest('.loc-wrap'))
        document.querySelectorAll('.loc-drop').forEach(closeDrop);
});

/* ════════════════════════════════
   FIND ROUTES
════════════════════════════════ */
async function findRoutes() {
    const oi = document.getElementById('origin-input');
    const di = document.getElementById('dest-input');
    const ov = oi.value.trim();
    const dv = di.value.trim();

    if (!ov) { showToast('Please enter a start location', 'error'); return; }
    if (!dv) { showToast('Please enter a destination',    'error'); return; }

    if (!originCoords && oi.dataset.lat) originCoords = { lat: parseFloat(oi.dataset.lat), lng: parseFloat(oi.dataset.lng) };
    if (!destCoords   && di.dataset.lat) destCoords   = { lat: parseFloat(di.dataset.lat), lng: parseFloat(di.dataset.lng) };

    const btn = document.getElementById('findBtn');
    btn.disabled = true;
    showStatus('Calculating safest routes…');
    clearMapLayers();
    hideBreakdown();
    setPanel('<div class="idle-card"><div class="idle-icon">⏳</div><p>Analysing safety data…</p></div>');

    const payload = { origin: ov, destination: dv, time_of_day: mode, profile: 'foot' };
    if (originCoords) { payload.origin_lat = originCoords.lat; payload.origin_lng = originCoords.lng; }
    if (destCoords)   { payload.dest_lat   = destCoords.lat;   payload.dest_lng   = destCoords.lng; }

    try {
        const res = await fetch('/safe-route/api/find', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`Server ${res.status}`);
        const data = await res.json();
        if (data.error) {
            showToast(data.error, 'error');
            setPanel(`<div class="idle-card"><p>⚠️ ${esc(data.error)}</p></div>`);
            return;
        }
        routesData = data;
        renderResults(data);
        showToast(`${data.routes.length} route(s) found!`, 'success');
    } catch (e) {
        console.error('findRoutes error:', e);
        showToast('Could not fetch routes: ' + e.message, 'error');
        setPanel(`<div class="idle-card"><p>⚠️ ${esc(e.message)}</p></div>`);
    } finally {
        btn.disabled = false;
        hideStatus();
    }
}

/* ════════════════════════════════
   RENDER RESULTS
════════════════════════════════ */
function renderResults(data) {
    /* Origin / destination pins */
    addStyledPin(data.origin.lat,      data.origin.lng,      '#e91e8c', '📍 Start');
    addStyledPin(data.destination.lat, data.destination.lng, '#7c3aed', '📍 Destination');

    /* Anchor pins (police / hospital / 24-7) */
    (data.anchors || []).slice(0, 50).forEach(a => {
        const emoji = a.type === 'police' ? '👮' : a.type === 'hospital' ? '🏥' : '🏪';
        const icon  = L.divIcon({
            className: '',
            html: `<div style="font-size:.95rem;filter:drop-shadow(0 1px 3px rgba(0,0,0,.3))">${emoji}</div>`,
            iconSize: [18,18], iconAnchor: [9,9]
        });
        const m = L.marker([a.lat, a.lng], { icon }).addTo(map)
            .bindPopup(`<b>${emoji} ${esc(a.name || a.type)}</b>`);
        mapLayers.push(m);
    });

    /* Draw all routes */
    data.routes.forEach((r, i) => drawRoute(r, i, i === 0));

    /* Build right panel */
    buildPanel(data);

    /* Show breakdown for first route */
    activeRouteIdx = 0;
    showBreakdown(data, 0);

    /* Fit map to all layers */
    if (mapLayers.length) {
        try { map.fitBounds(L.featureGroup(mapLayers).getBounds(), { padding: [40, 40] }); } catch(e){}
    }
}

/* ════════════════════════════════
   BUILD RIGHT PANEL
════════════════════════════════ */
function buildPanel(data) {
    const panel = document.getElementById('rightPanel');
    panel.innerHTML = '';

    const best = data.routes[0];
    /* safety_pct = 0-100 where 100 = safest (from backend)
       risk_pct   = 0-100 where 100 = most dangerous            */
    const bestSafety = Math.round(best.safety_pct !== undefined ? best.safety_pct : 100 - best.safety_score);
    const bestRisk   = Math.round(best.risk_pct   !== undefined ? best.risk_pct   : best.safety_score);
    const badgeClass = badgeCls(best.safety_label);

    /* Recommended card */
    const rec = document.createElement('div');
    rec.className = 'rec-card';
    rec.innerHTML = `
        <div class="rec-label">RECOMMENDED</div>
        <div class="rec-score">${bestSafety}<span>/ 100 safety</span></div>
        <div class="rec-risk">Risk level <strong>${bestRisk}%</strong> for ${data.time_of_day.replace('_',' ')}.</div>
        <div class="route-badge ${badgeClass}">${best.safety_label}</div>`;
    panel.appendChild(rec);

    /* Route list */
    data.routes.forEach((r, i) => {
        const safety   = Math.round(r.safety_pct !== undefined ? r.safety_pct : 100 - r.safety_score);
        const badgeCl  = badgeCls(r.safety_label);
        const barColor = r.safety_color || '#10b981';

        const card = document.createElement('div');
        card.className = 'route-item' + (i === 0 ? ' active' : '');
        card.innerHTML = `
            <div class="route-item-head">
                <div style="display:flex;align-items:center;">
                    <div class="route-num-circle">${i + 1}</div>
                    <div class="route-item-name">Route ${i + 1}</div>
                </div>
                <span class="route-badge ${badgeCl}" style="position:static;font-size:.68rem;padding:3px 9px;">${r.safety_label}</span>
            </div>
            <div class="route-meta">
                <span>🚶 ${r.distance_km} km</span>
                <span>🕐 ${r.duration_min} min</span>
                <span>⚓ ${r.crime_count || 0}</span>
            </div>
            <div class="route-bar">
                <div class="route-bar-fill" style="width:${safety}%;background:${barColor};"></div>
            </div>`;
        card.addEventListener('click', () => selectRoute(i));
        panel.appendChild(card);
    });
}

/* ════════════════════════════════
   SELECT ROUTE
════════════════════════════════ */
function selectRoute(idx) {
    activeRouteIdx = idx;
    document.querySelectorAll('.route-item').forEach((c, i) => c.classList.toggle('active', i === idx));
    mapLayers.forEach(l => {
        if (l._routeIdx !== undefined) {
            const on = l._routeIdx === idx;
            l.setStyle({ opacity: on ? 0.9 : 0.1, weight: on ? 6 : 2 });
            if (on) l.bringToFront();
        }
    });
    const lines = mapLayers.filter(l => l._routeIdx === idx);
    if (lines.length) {
        try { map.fitBounds(L.featureGroup(lines).getBounds(), { padding: [50,50] }); } catch(e){}
    }
    if (routesData) showBreakdown(routesData, idx);
}

/* ════════════════════════════════
   SAFETY BREAKDOWN
════════════════════════════════ */
function showBreakdown(data, idx) {
    const r    = data.routes[idx];
    const wrap = document.getElementById('breakdownWrap');
    wrap.classList.add('show');

    document.getElementById('breakdownTitle').textContent = `Safety breakdown — Route ${idx + 1}`;
    const bdgEl = document.getElementById('breakdownBadge');
    bdgEl.textContent = r.safety_label;
    bdgEl.className   = `route-badge ${badgeCls(r.safety_label)}`;

    /* Segment factors are danger scores (0=safe, 100=dangerous) */
    const segs = r.segments || [];
    const avg  = key => segs.length
        ? segs.reduce((s, sg) => s + (sg.factors?.[key] || 0), 0) / segs.length
        : 50;

    /* Convert danger → safety (higher = safer) */
    const crimeScore  = Math.round(100 - avg('crime'));
    const lightScore  = Math.round(100 - avg('lighting'));
    const popScore    = Math.round(100 - avg('population'));
    const anchorScore = Math.round(100 - avg('anchor'));

    const lights_per_km = (data.lights_count && r.distance_km)
        ? Math.round(data.lights_count / r.distance_km) : '—';
    const crimes_nearby = r.crime_count || 0;
    const anchors_count = (data.anchors || []).length;

    const factors = [
        {
            icon: '⚠️', name: 'Crime', score: crimeScore,
            color: crimeScore > 70 ? '#10b981' : crimeScore > 45 ? '#f59e0b' : '#ef4444',
            desc: `${crimes_nearby} incidents nearby`
        },
        {
            icon: '💡', name: 'Lighting', score: lightScore,
            color: lightScore > 70 ? '#10b981' : '#e91e8c',
            desc: `${lights_per_km}/km streetlights`
        },
        {
            icon: '👥', name: 'Population', score: popScore,
            color: popScore > 70 ? '#e91e8c' : '#f59e0b',
            desc: 'Foot traffic estimate'
        },
        {
            icon: '🏥', name: 'Safe anchors', score: anchorScore,
            color: anchorScore > 70 ? '#10b981' : '#f59e0b',
            desc: `Police, hospitals, 24/7`
        },
    ];

    document.getElementById('factorsGrid').innerHTML = factors.map(f => `
        <div class="factor-box">
            <div class="factor-head">
                <div class="factor-name">${f.icon} ${f.name}</div>
                <div class="factor-score">${f.score}</div>
            </div>
            <div class="factor-bar">
                <div class="factor-bar-fill" style="width:${f.score}%;background:${f.color};"></div>
            </div>
            <div class="factor-desc">${f.desc}</div>
        </div>`).join('');

    /* risk_pct = avg_danger (0=safest, 100=worst) */
    const riskPct = Math.round(r.risk_pct !== undefined ? r.risk_pct : r.safety_score);
    document.getElementById('statsRow').innerHTML = `
        <div class="stat-box">
            <div class="stat-val">${r.distance_km} km</div>
            <div class="stat-key">Distance</div>
        </div>
        <div class="stat-box">
            <div class="stat-val">${r.duration_min} min</div>
            <div class="stat-key">Duration</div>
        </div>
        <div class="stat-box">
            <div class="stat-val risk-col">${riskPct}%</div>
            <div class="stat-key">Risk</div>
        </div>`;

    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideBreakdown() {
    document.getElementById('breakdownWrap').classList.remove('show');
}

/* ════════════════════════════════
   DRAW ROUTE
════════════════════════════════ */
function drawRoute(r, idx, isActive) {
    const opacity    = isActive ? 0.9 : 0.15;
    const weight     = isActive ? 6   : 3;
    const routeColor = r.safety_color || '#e91e8c';

    if (r.points && r.points.length) {
        const line = L.polyline(r.points, {
            color: routeColor, weight, opacity, lineJoin: 'round', lineCap: 'round'
        }).addTo(map);
        line._routeIdx = idx;
        mapLayers.push(line);
    }
}

/* ════════════════════════════════
   HELPERS
════════════════════════════════ */
function addStyledPin(lat, lng, color, label) {
    const icon = L.divIcon({
        className: '',
        html: `<div style="width:28px;height:36px;position:relative;">
            <div style="
                width:28px;height:28px;
                background:${color};
                border:3px solid #fff;
                border-radius:50% 50% 50% 0;
                transform:rotate(-45deg);
                box-shadow:0 3px 12px rgba(0,0,0,.35);
            "></div>
        </div>`,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
        popupAnchor: [0, -36]
    });
    const m = L.marker([lat, lng], { icon }).addTo(map).bindPopup(`<b>${esc(label)}</b>`);
    mapLayers.push(m);
}

function clearMapLayers() {
    mapLayers.forEach(l => { try { map.removeLayer(l); } catch(e){} });
    mapLayers = [];
}

function badgeCls(label) {
    if (!label) return 'badge-safe';
    const l = label.toLowerCase();
    if (l === 'safest')         return 'badge-safest';
    if (l === 'safe')           return 'badge-safe';
    if (l.includes('mod'))      return 'badge-moderate';
    return 'badge-risky';
}

function setPanel(html) { document.getElementById('rightPanel').innerHTML = html; }

function showStatus(msg) {
    document.getElementById('statusText').textContent = msg;
    document.getElementById('statusBar').classList.add('show');
}

function hideStatus() { document.getElementById('statusBar').classList.remove('show'); }

function showToast(msg, type = 'info') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className   = `toast t-${type}`;
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 4500);
}

function esc(str) {
    return String(str || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', initMap);