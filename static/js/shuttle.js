var shuttleMap = null;
var shuttleMarkers = [];

// Init map once
function initMap() {
    if (shuttleMap) return;
    shuttleMap = L.map('shuttle-map').setView([17.385, 78.486], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19
    }).addTo(shuttleMap);
    setTimeout(function() { shuttleMap.invalidateSize(); }, 300);
}

function clearShuttleMarkers() {
    shuttleMarkers.forEach(function(m) { shuttleMap.removeLayer(m); });
    shuttleMarkers = [];
}

function findShuttles() {
    var btn = document.getElementById('findBtn');
    var msg = document.getElementById('locating-msg');
    btn.disabled = true;
    msg.style.display = 'flex';

    initMap();

    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser.', 'error');
        btn.disabled = false;
        msg.style.display = 'none';
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function(pos) {
            var lat = pos.coords.latitude;
            var lng = pos.coords.longitude;

            // Center map and add user marker
            shuttleMap.setView([lat, lng], 14);
            clearShuttleMarkers();

            var userIcon = L.divIcon({
                html: '<span style="font-size:1.8rem;">📍</span>',
                className: '', iconSize: [32,32], iconAnchor: [16,32]
            });
            var userMarker = L.marker([lat, lng], { icon: userIcon })
                .addTo(shuttleMap)
                .bindPopup('<b>📍 You are here</b>');
            shuttleMarkers.push(userMarker);

            // Fetch nearby shuttles from backend
            fetch('/shuttle/nearby', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latitude: lat, longitude: lng })
            })
            .then(function(r) { return r.json(); })
            .then(function(shuttles) {
                btn.disabled = false;
                msg.style.display = 'none';
                renderShuttles(shuttles, lat, lng);
            })
            .catch(function() {
                btn.disabled = false;
                msg.style.display = 'none';
                showToast('Could not fetch shuttle data. Please try again.', 'error');
            });
        },
        function() {
            btn.disabled = false;
            msg.style.display = 'none';
            showToast('Please enable location access to find nearby shuttles.', 'error');
        }
    );
}

function renderShuttles(shuttles, userLat, userLng) {
    var list = document.getElementById('shuttleList');

    if (!shuttles || !shuttles.length) {
        list.innerHTML = '<div class="empty-shuttle">😔 No SheShuttle routes found near your location right now. Try again later.</div>';
        return;
    }

    list.innerHTML = '';

    shuttles.forEach(function(s) {
        // ── Map marker with bus emoji ──
        var busIcon = L.divIcon({
            html: '<div style="font-size:1.8rem;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.2));">🚌</div>',
            className: '', iconSize: [36, 36], iconAnchor: [18, 36]
        });

        var statusLabel = s.status === 'active'
            ? '✅ Active'
            : s.status === 'limited'
            ? '⚠️ Limited'
            : '❌ Inactive';

        var popup = '<div style="min-width:180px;font-family:sans-serif;line-height:1.6;">'
            + '<b style="font-size:0.95rem;">' + s.name + '</b><br>'
            + '🕐 Next arrival: <b>' + s.next_arrival + '</b><br>'
            + '📌 Status: ' + statusLabel + '<br>'
            + (s.route ? '🗺️ Route: ' + s.route + '<br>' : '')
            + (s.capacity ? '👥 Capacity: ' + s.capacity : '')
            + '</div>';

        var marker = L.marker([s.lat, s.lng], { icon: busIcon })
            .addTo(shuttleMap)
            .bindPopup(popup);
        shuttleMarkers.push(marker);

        // Draw a dashed line from user to shuttle
        var line = L.polyline([[userLat, userLng], [s.lat, s.lng]], {
            color: '#7c3aed', weight: 2, dashArray: '6,6', opacity: 0.5
        }).addTo(shuttleMap);
        shuttleMarkers.push(line);

        // Calculate rough distance in km
        var dist = (function(lat1, lng1, lat2, lng2) {
            var R = 6371;
            var dLat = (lat2 - lat1) * Math.PI / 180;
            var dLng = (lng2 - lng1) * Math.PI / 180;
            var a = Math.sin(dLat/2)*Math.sin(dLat/2)
                  + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)
                  * Math.sin(dLng/2)*Math.sin(dLng/2);
            return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
        })(userLat, userLng, s.lat, s.lng);

        var dotClass = s.status === 'active' ? 'active' : s.status === 'limited' ? 'limited' : 'inactive';

        // ── List card ──
        var card = document.createElement('div');
        card.className = 'shuttle-card';
        card.innerHTML =
            '<h4>🚌 ' + s.name + '</h4>'
            + '<div class="info-row"><span class="status-dot ' + dotClass + '"></span> ' + statusLabel + '</div>'
            + '<div class="info-row">📍 ' + dist + ' km away</div>'
            + (s.route ? '<div class="info-row">🗺️ ' + s.route + '</div>' : '')
            + (s.capacity ? '<div class="info-row">👥 Capacity: ' + s.capacity + '</div>' : '')
            + '<div><span class="arrival-badge">🕐 Next: ' + s.next_arrival + '</span></div>';

        // Click card to open popup on map
        card.addEventListener('click', function() {
            marker.openPopup();
            shuttleMap.setView([s.lat, s.lng], 15);
        });

        list.appendChild(card);
    });

    showToast(shuttles.length + ' SheShuttle routes found near you!', 'success');
}