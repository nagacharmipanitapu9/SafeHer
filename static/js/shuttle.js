/* ── State ── */
let userLat = null, userLng = null;
let map = null, userMarker = null;
let busMarkers = [], routeLines = [];
let selectedId = null;
let shuttles = [];

/* ── Map init ── */
function initMap() {
    map = L.map('shuttle-map', { zoomControl: true }).setView([17.44, 78.38], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);
    setTimeout(() => map.invalidateSize(), 300);
}

/* ── Icons ── */
function busIcon(status) {
    const color = status === 'active' ? '#16a34a' : status === 'limited' ? '#d97706' : '#dc2626';
    return L.divIcon({
        className: '',
        html: `<div style="background:${color};color:#fff;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,.28);">🚌</div>`,
        iconSize: [34, 34], iconAnchor: [17, 17]
    });
}

const meIcon = L.divIcon({
    className: '',
    html: `<div style="background:#e91e8c;border:3px solid #fff;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 10px rgba(233,30,140,.55);"></div>`,
    iconSize: [20, 20], iconAnchor: [10, 10]
});

/* ── Location detection ── */
function detectLocation() {
    if (!navigator.geolocation) {
        showToast('Geolocation not supported on this device', 'error');
        return;
    }
    const btn = document.getElementById('detectBtn');
    btn.disabled = true;
    btn.textContent = '⏳';
    showStatus('Detecting your location…');

    navigator.geolocation.getCurrentPosition(
        pos => {
            userLat = pos.coords.latitude;
            userLng = pos.coords.longitude;

            document.getElementById('locName').textContent = `${userLat.toFixed(4)}, ${userLng.toFixed(4)}`;
            document.getElementById('locCoords').textContent = 'GPS location detected ✓';

            btn.disabled = false;
            btn.textContent = '📍';
            hideStatus();

            if (userMarker) map.removeLayer(userMarker);
            userMarker = L.marker([userLat, userLng], { icon: meIcon })
                .addTo(map)
                .bindPopup('📍 You are here');
            map.setView([userLat, userLng], 13);
            showToast('Location detected successfully!', 'success');
        },
        () => {
            // Fallback to Hitech City centre (SHE Shuttle hub)
            userLat = 17.4453;
            userLng = 78.3772;
            document.getElementById('locName').textContent = 'Hitech City (default)';
            document.getElementById('locCoords').textContent = 'Could not get GPS – using default';

            btn.disabled = false;
            btn.textContent = '📍';
            hideStatus();

            if (userMarker) map.removeLayer(userMarker);
            userMarker = L.marker([userLat, userLng], { icon: meIcon })
                .addTo(map)
                .bindPopup('📍 Default location (Hitech City)');
            map.setView([userLat, userLng], 12);
            showToast('Using default location: Hitech City', 'info');
        },
        { timeout: 10000, enableHighAccuracy: true }
    );
}

/* ── Find buses ── */
async function findShuttles() {
    if (!userLat) {
        showToast('Please detect your location first', 'error');
        return;
    }
    
    const btn = document.getElementById('findBtn');
    btn.disabled = true;
    showStatus('Searching SHE Shuttle routes…');
    clearBusMarkers();

    try {
        const destination =
            document.getElementById('destinationInput')
                .value
                .trim();

        console.log("Destination:", destination);
        const res = await fetch('/shuttle/nearby', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                latitude: userLat,
                longitude: userLng,
                destination: destination
            })
        });
        shuttles = await res.json();
        renderList(shuttles);
        renderMapMarkers(shuttles);

    document.getElementById('listCount')
    .textContent =
    destination
        ? `${shuttles.length} routes`
        : `${shuttles.length} found`;

        // Fit map to show user + all bus markers together
        if (shuttles.length && userMarker) {
            const group = L.featureGroup([userMarker, ...busMarkers]);
            map.fitBounds(group.getBounds(), { padding: [50, 50] });
        }

        showToast(`${shuttles.length} SHE Shuttle routes found near you!`, 'success');
    } catch (e) {
        showToast('Could not fetch shuttle data. Try again.', 'error');
    } finally {
        btn.disabled = false;
        hideStatus();
    }
}

/* ── Render list ── */
function renderList(data) {
    const list = document.getElementById('shuttleList');
    if (!data.length) {
        list.innerHTML = `<div class="empty-state"><div class="es-icon">😕</div><p>No SHE Shuttle routes found near you.</p></div>`;
        return;
    }

    list.innerHTML = data.map(s => {
        const statusClass = s.status === 'limited' ? 'status-limited' : s.status === 'inactive' ? 'status-inactive' : '';
        const badgeClass  = s.status === 'active'  ? 'badge-active'  : s.status === 'limited'  ? 'badge-limited'  : 'badge-inactive';
        const badgeText   = s.status === 'active'  ? '● Active'      : s.status === 'limited'  ? '◑ Limited'      : '○ No Service';

        // Build stops timeline
        const stopsHtml = s.stops.map((st, i) => `
            <div class="stop-item">
                <div class="stop-dot"></div>
                <span>${st.name}</span>
            </div>
            ${i < s.stops.length - 1
                ? `<div style="display:flex;gap:10px;"><div style="width:8px;flex-shrink:0"></div><div class="stop-line"></div></div>`
                : ''}
        `).join('');

        const gmapsUrl = buildGmapsUrl(s);
        const shareUrl = buildShareUrl(s);

        return `
        <div class="bus-card ${statusClass}" id="card-${s.id}" onclick="selectBus(${s.id})">
            <div class="bus-card-top">
                <div class="bus-name">${s.name}</div>
                <span class="badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="bus-route">
                <span>${s.from}</span>
                <span class="route-arrow">→</span>
                <span>${s.to}</span>
            </div>
            <div class="bus-meta">
                <span class="meta-chip">🕐 ${s.frequency}</span>
                <span class="meta-chip">💰 ${s.fare}</span>
                <span class="meta-chip">📍 ${s.distance_km} km away</span>
            </div>

            <div class="bus-detail">
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="di-label">First Bus</div>
                        <div class="di-val">${s.first_bus}</div>
                    </div>
                    <div class="detail-item">
                        <div class="di-label">Last Bus</div>
                        <div class="di-val">${s.last_bus}</div>
                    </div>
                    <div class="detail-item">
                        <div class="di-label">Type</div>
                        <div class="di-val">${s.type}</div>
                    </div>
                    <div class="detail-item">
                        <div class="di-label">Capacity</div>
                        <div class="di-val">${s.capacity}</div>
                    </div>
                    <div class="detail-item">
                        <div class="di-label">Vehicle No.</div>
                        <div class="di-val">${s.vehicle || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="di-label">📞 Lady Guard</div>
                        <div class="di-val">${s.lady_guard || 'N/A'}</div>
                    </div>
                </div>

                <button class="stops-toggle" onclick="toggleStops(event, ${s.id})">
                    🛑 Show ${s.stops.length} Stops ▾
                </button>
                <div class="stops-list" id="stops-${s.id}">
                    ${stopsHtml}
                </div>

                <div class="action-row">
                    <a class="btn-action btn-gmaps" href="${gmapsUrl}" target="_blank" rel="noopener">
                        🗺️ View Route on Google Maps
                    </a>
                    <button class="btn-action btn-share" onclick="shareRoute(event, '${shareUrl}', '${s.name.replace(/'/g, "\\'")}')">
                        🔗 Share Route
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}

/* ── Select bus & draw road route ── */
async function selectBus(id) {
    selectedId = id;

    // Highlight selected card
    document.querySelectorAll('.bus-card').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById(`card-${id}`);
    if (card) {
        card.classList.add('selected');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    clearRouteLines();

    const s = shuttles.find(x => x.id === id);
    if (!s || !s.stops || s.stops.length < 2) return;

    showStatus('Loading road route…');

    // Place stop markers
    s.stops.forEach((stop, i) => {
        const isFirst = i === 0;
        const isLast  = i === s.stops.length - 1;
        const color   = isFirst ? '#16a34a' : isLast ? '#dc2626' : '#7c3aed';
        const stopIcon = L.divIcon({
            className: '',
            html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);"></div>`,
            iconSize: [12, 12], iconAnchor: [6, 6]
        });
        const label = isFirst ? '🟢 Start: ' : isLast ? '🔴 End: ' : '🔵 Stop: ';
        const m = L.marker([stop.lat, stop.lng], { icon: stopIcon })
            .addTo(map)
            .bindPopup(`<b>${label}${stop.name}</b>`);
        routeLines.push(m);
    });

    // Fetch road route from OSRM
    try {
        const coordStr = `${s.stops[0].lng},${s.stops[0].lat};${s.stops[s.stops.length - 1].lng},${s.stops[s.stops.length - 1].lat}`;
        const osrmUrl  = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;
        const res  = await fetch(osrmUrl);
        const data = await res.json();

        if (data.code === 'Ok' && data.routes.length) {
            const geojson = data.routes[0].geometry;
            const line = L.geoJSON(geojson, {
                style: { color: '#e91e8c', weight: 5, opacity: 0.85 }
            }).addTo(map);
            routeLines.push(line);
            map.fitBounds(line.getBounds(), { padding: [50, 50] });

            const distKm = (data.routes[0].distance / 1000).toFixed(1);
            const durMin = Math.round(data.routes[0].duration / 60);
            showToast(`Route: ${distKm} km · ~${durMin} min`, 'info');
        } else {
            throw new Error('No route from OSRM');
        }
    } catch {
        // Fallback: straight polyline between stops
        const coords = s.stops.map(st => [st.lat, st.lng]);
        const line = L.polyline(coords, {
            color: '#e91e8c', weight: 5, opacity: 0.8, dashArray: '8 4'
        }).addTo(map);
        routeLines.push(line);
        map.fitBounds(line.getBounds(), { padding: [50, 50] });
    } finally {
        hideStatus();
    }
}

/* ── Toggle stops section ── */
function toggleStops(e, id) {
    e.stopPropagation();
    const el  = document.getElementById(`stops-${id}`);
    const btn = e.currentTarget;
    const s   = shuttles.find(x => x.id === id);
    if (el.classList.toggle('open')) {
        btn.textContent = `🛑 Hide Stops ▴`;
    } else {
        btn.textContent = `🛑 Show ${s ? s.stops.length : ''} Stops ▾`;
    }
}

/* ── Google Maps URL ── */
function buildGmapsUrl(s) {
    if (!s.stops || !s.stops.length) {
        return `https://www.google.com/maps/dir/?api=1&origin=${s.lat},${s.lng}&destination=${s.end_lat},${s.end_lng}&travelmode=transit`;
    }
    const origin   = `${s.stops[0].lat},${s.stops[0].lng}`;
    const dest     = `${s.stops[s.stops.length - 1].lat},${s.stops[s.stops.length - 1].lng}`;
    const midStops = s.stops.slice(1, -1);
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
    if (midStops.length) {
        const wp = midStops.map(st => `${st.lat},${st.lng}`).join('|');
        url += `&waypoints=${encodeURIComponent(wp)}`;
    }
    return url;
}

/* ── Shareable URL ── */
function buildShareUrl(s) {
    if (!s.stops || !s.stops.length) return buildGmapsUrl(s);
    const origin = encodeURIComponent(`${s.stops[0].name}, Hyderabad`);
    const dest   = encodeURIComponent(`${s.stops[s.stops.length - 1].name}, Hyderabad`);
    return `https://www.google.com/maps/dir/${origin}/${dest}/`;
}

/* ── Share route ── */
async function shareRoute(e, url, name) {
    e.stopPropagation();
    const text = `🚌 SHE Shuttle – ${name}\nRoute on Google Maps: ${url}`;
    if (navigator.share) {
        try {
            await navigator.share({ title: `SHE Shuttle – ${name}`, text, url });
            return;
        } catch (_) {}
    }
    try {
        await navigator.clipboard.writeText(text);
        showToast('Route link copied to clipboard!', 'success');
    } catch (_) {
        prompt('Copy this link to share:', url);
    }
}

/* ── Map markers ── */
function renderMapMarkers(data) {
    data.forEach(s => {
        const m = L.marker([s.lat, s.lng], { icon: busIcon(s.status) })
            .addTo(map)
            .bindPopup(`<b>${s.name}</b><br>${s.from} → ${s.to}<br><small>FREE for women · ${s.frequency}</small>`);
        m.on('click', () => selectBus(s.id));
        busMarkers.push(m);
    });
}

function clearBusMarkers() {
    busMarkers.forEach(m => map.removeLayer(m));
    busMarkers = [];
    clearRouteLines();
}

function clearRouteLines() {
    routeLines.forEach(l => map.removeLayer(l));
    routeLines = [];
}

/* ── Status bar ── */
function showStatus(msg) {
    const el = document.getElementById('statusMsg');
    document.getElementById('statusText').textContent = msg;
    el.classList.add('show');
}
function hideStatus() {
    document.getElementById('statusMsg').classList.remove('show');
}

/* ── Toast ── */
function showToast(msg, type = 'info') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast ${type}`;
    void t.offsetWidth; // force reflow so animation resets
    t.classList.add('show');
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(() => t.classList.remove('show'), 4500);
}

/* ── Init on page load ── */
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    detectLocation();
});
const destinationInput =
    document.getElementById('destinationInput');

const suggestionsBox =
    document.getElementById('destinationSuggestions');
destinationInput.addEventListener('input', async () => {

    const q = destinationInput.value.trim();

    if(q.length < 2){
        suggestionsBox.innerHTML = '';
        suggestionsBox.classList.remove('show');
        return;
    }

    const res =
        await fetch(`/shuttle/destinations?q=${encodeURIComponent(q)}`);

    const data = await res.json();

    suggestionsBox.innerHTML = data.map(place => `
        <div class="suggestion-item"
             onclick="selectDestination('${place}')">
             📍 ${place}
        </div>
    `).join('');

    suggestionsBox.classList.toggle(
        'show',
        data.length > 0
    );
});
function selectDestination(place){

    destinationInput.value = place;

    suggestionsBox.classList.remove('show');
}
document.addEventListener('click', e => {

    if(!e.target.closest('.destination-wrapper')){
        suggestionsBox.classList.remove('show');
    }

});