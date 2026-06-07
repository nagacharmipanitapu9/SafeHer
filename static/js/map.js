(function () {
    var mapEl = document.getElementById('crime-map');
    if (!mapEl) return;

    // Read admin flag injected by the template
    var IS_ADMIN = (window.SAFEHER_IS_ADMIN === true);

    var map = L.map('crime-map').setView([17.385, 78.486], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19
    }).addTo(map);
    setTimeout(function () { map.invalidateSize(); }, 300);

    // Store admin's GPS
    var adminLat = null;
    var adminLng = null;
    var adminMarker = null;
    var routeLayer  = null;
    var routeDestMarker = null;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (pos) {
            adminLat = pos.coords.latitude;
            adminLng = pos.coords.longitude;
            map.setView([adminLat, adminLng], 14);
            adminMarker = L.marker([adminLat, adminLng])
                .addTo(map)
                .bindPopup('<b>📍 You are here</b>')
                .openPopup();
        }, function () {});
    }

    var crimeIcons = {
        harassment:        '⚠️',
        assault:           '🔴',
        theft:             '🟡',
        stalking:          '🟠',
        domestic_violence: '🟣',
        other:             '⚪'
    };
    var sevColors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
    var statusLabels = {
        pending:       '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-size:0.75rem;">⏳ Pending</span>',
        investigating: '<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:10px;font-size:0.75rem;">🔍 Investigating</span>',
        approved:      '<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:10px;font-size:0.75rem;">✅ Verified</span>',
        resolved:      '<span style="background:#ede9fe;color:#5b21b6;padding:2px 8px;border-radius:10px;font-size:0.75rem;">✔️ Resolved</span>',
        rejected:      '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:10px;font-size:0.75rem;">❌ Rejected</span>'
    };

    // Store all crimes and markers for filtering
    var allCrimes  = [];
    var allMarkers = []; // each: { marker, crime, baseOpacity }
    var activeFilter = 'all'; // current highlighted type

    // ── Clear all crime markers ───────────────────────────────
    function clearCrimeMarkers() {
        allMarkers.forEach(function (m) { map.removeLayer(m.marker); });
        allMarkers = [];
    }

    // ── Build marker icon with opacity ────────────────────────
    function buildIcon(crimeType, opacity) {
        var emoji = crimeIcons[crimeType] || '📍';
        return L.divIcon({
            html: '<span style="font-size:1.6rem;opacity:' + opacity + ';">' + emoji + '</span>',
            className: '', iconSize: [32, 32], iconAnchor: [16, 32]
        });
    }

    // ── Render all crimes on map ──────────────────────────────
    function renderCrimes(crimes) {
        clearCrimeMarkers();
        allCrimes = crimes;

        var counts   = { total: 0, harassment: 0, assault: 0, theft: 0, stalking: 0 };
        var byStatus = { pending: 0, investigating: 0, approved: 0, resolved: 0, rejected: 0 };

        crimes.forEach(function (crime) {
            var isPending    = (crime.status === 'pending' || crime.status === 'investigating');
            var baseOpacity  = isPending ? 0.45 : 1;
            var sevColor     = sevColors[crime.severity] || '#6b7280';
            var statusBadge  = statusLabels[crime.status] || '';
            var sevBadge     = '<span style="background:' + sevColor + '22;color:' + sevColor
                             + ';padding:2px 8px;border-radius:10px;font-size:0.75rem;font-weight:600;">'
                             + (crime.severity || 'medium').toUpperCase() + '</span>';

            // Admin gets a "Get Route" button in the popup
            var routeBtn = IS_ADMIN
                ? '<br><button '
                  + 'onclick="showRouteToCrime(' + crime.latitude + ',' + crime.longitude + ',\''
                  + (crime.location_name || 'Crime Scene').replace(/'/g, '') + '\')" '
                  + 'style="margin-top:8px;padding:7px 14px;background:#6d28d9;color:#fff;'
                  + 'border:none;border-radius:7px;font-size:0.8rem;font-weight:600;cursor:pointer;">'
                  + '🧭 Get Route to Here</button>'
                : '';

            var popup = '<div style="min-width:220px;font-family:sans-serif;line-height:1.6;">'
                + '<b style="font-size:0.95rem;text-transform:capitalize;">'
                + crime.crime_type.replace(/_/g, ' ') + '</b>'
                + '<div style="margin:5px 0;display:flex;gap:6px;flex-wrap:wrap;">'
                + statusBadge + ' ' + sevBadge + '</div>'
                + (crime.description
                    ? '<p style="color:#374151;font-size:0.84rem;margin:4px 0;">' + crime.description + '</p>'
                    : '')
                + '<p style="color:#9ca3af;font-size:0.78rem;margin:4px 0 0;">'
                + (crime.location_name || '')
                + (crime.created_at ? ' · ' + crime.created_at.split(' ')[0] : '')
                + (crime.reporter_name ? '<br>By: ' + crime.reporter_name : '')
                + '</p>'
                + routeBtn
                + '</div>';

            var marker = L.marker([crime.latitude, crime.longitude], {
                icon: buildIcon(crime.crime_type, baseOpacity)
            }).addTo(map).bindPopup(popup);

            allMarkers.push({ marker: marker, crime: crime, baseOpacity: baseOpacity });

            counts.total++;
            if (counts[crime.crime_type]  !== undefined) counts[crime.crime_type]++;
            if (byStatus[crime.status]    !== undefined) byStatus[crime.status]++;
        });

        updateStats(counts, byStatus);
        applyFilter(activeFilter); // keep current filter applied
    }

    // ── Filter: highlight selected type, dim others ───────────
    // Does NOT remove any marker — just changes opacity
    window.filterByType = function (type, el) {
        activeFilter = type;

        // Update legend pill styles
        document.querySelectorAll('.legend-item').forEach(function (btn) {
            btn.classList.remove('active');
        });
        if (el) el.classList.add('active');

        applyFilter(type);
    };

    function applyFilter(type) {
        allMarkers.forEach(function (m) {
            var crime    = m.crime;
            var isPending = (crime.status === 'pending' || crime.status === 'investigating');

            var opacity;
            if (type === 'all') {
                // Normal state
                opacity = isPending ? 0.45 : 1;
            } else if (crime.crime_type === type) {
                // Highlighted — always full bright
                opacity = 1;
            } else {
                // Dimmed but still visible — NOT removed
                opacity = 0.15;
            }

            m.marker.setIcon(buildIcon(crime.crime_type, opacity));
        });
    }

    // ── Route: admin → crime location ────────────────────────
    window.showRouteToCrime = function (crimeLat, crimeLng, crimeLabel) {
        if (!IS_ADMIN) return;

        // Show route panel
        var panel = document.getElementById('route-panel');
        var info  = document.getElementById('route-info');
        if (panel) panel.style.display = 'block';
        if (info)  info.innerHTML = '<span style="color:#6b7280;font-size:0.88rem;">⏳ Calculating route...</span>';

        if (!adminLat || !adminLng) {
            // Try to get location now
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(function (pos) {
                    adminLat = pos.coords.latitude;
                    adminLng = pos.coords.longitude;
                    doRoute(crimeLat, crimeLng, crimeLabel);
                }, function () {
                    if (info) info.innerHTML = '<span style="color:#ef4444;">❌ Enable location access to use routing.</span>';
                });
            }
            return;
        }
        doRoute(crimeLat, crimeLng, crimeLabel);
    };

    function doRoute(crimeLat, crimeLng, crimeLabel) {
        // Clear previous route
        clearRoute();

        var panel = document.getElementById('route-panel');
        var info  = document.getElementById('route-info');
        if (panel) panel.style.display = 'block';

        // OSRM free routing API
        var url = 'http://router.project-osrm.org/route/v1/driving/'
            + adminLng + ',' + adminLat + ';'
            + crimeLng + ',' + crimeLat
            + '?geometries=geojson&overview=full&steps=false';

        fetch(url, { timeout: 12000 })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.code !== 'Ok' || !data.routes || !data.routes.length) {
                    if (info) info.innerHTML = '<span style="color:#ef4444;">Could not calculate route.</span>';
                    return;
                }

                var route      = data.routes[0];
                var distKm     = (route.distance / 1000).toFixed(2);
                var durationMin = Math.round(route.duration / 60);
                var coords     = route.geometry.coordinates.map(function (c) { return [c[1], c[0]]; });

                // Draw route line
                routeLayer = L.polyline(coords, {
                    color: '#6d28d9', weight: 5, opacity: 0.85
                }).addTo(map);

                // Crime destination pin
                routeDestMarker = L.marker([crimeLat, crimeLng], {
                    icon: L.divIcon({
                        html: '<div style="background:#ef4444;color:#fff;width:30px;height:30px;'
                            + 'border-radius:50%;display:flex;align-items:center;justify-content:center;'
                            + 'font-size:1rem;box-shadow:0 2px 8px rgba(0,0,0,0.3);">🚨</div>',
                        className: '', iconSize: [30, 30], iconAnchor: [15, 15]
                    })
                }).addTo(map).bindPopup('<b>🚨 Crime Scene</b><br>' + crimeLabel).openPopup();

                // Fit map to show full route
                map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

                if (info) {
                    info.innerHTML =
                        '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;">'
                        + '<div style="background:#ede9fe;color:#5b21b6;padding:8px 16px;border-radius:8px;font-size:0.88rem;font-weight:600;">📏 ' + distKm + ' km</div>'
                        + '<div style="background:#ede9fe;color:#5b21b6;padding:8px 16px;border-radius:8px;font-size:0.88rem;font-weight:600;">🕐 ~' + durationMin + ' min drive</div>'
                        + '<div style="background:#fef3c7;color:#92400e;padding:8px 16px;border-radius:8px;font-size:0.88rem;font-weight:600;">📍 ' + crimeLabel + '</div>'
                        + '</div>'
                        + '<a href="https://www.google.com/maps/dir/?api=1&origin=' + adminLat + ',' + adminLng
                        + '&destination=' + crimeLat + ',' + crimeLng + '&travelmode=driving" '
                        + 'target="_blank" style="display:inline-flex;align-items:center;gap:6px;'
                        + 'background:#3b82f6;color:#fff;padding:8px 16px;border-radius:8px;'
                        + 'font-size:0.84rem;font-weight:600;text-decoration:none;">'
                        + '🗺️ Open in Google Maps</a>';
                }
            })
            .catch(function () {
                if (info) info.innerHTML = '<span style="color:#ef4444;">Route service unavailable.</span>';
            });
    }

    window.clearRoute = function () {
        if (routeLayer)      { map.removeLayer(routeLayer);      routeLayer = null; }
        if (routeDestMarker) { map.removeLayer(routeDestMarker); routeDestMarker = null; }
        var panel = document.getElementById('route-panel');
        if (panel) panel.style.display = 'none';
    };

    // ── Stats cards ───────────────────────────────────────────
    function updateStats(counts, byStatus) {
        var el = document.getElementById('map-stats');
        if (!el) return;
        el.innerHTML =
            sc(counts.total,           'Total',         '#6d28d9') +
            sc(byStatus.approved,      'Verified',      '#10b981') +
            sc(byStatus.pending,       'Pending',       '#f59e0b') +
            sc(byStatus.investigating, 'Investigating', '#3b82f6') +
            sc(byStatus.resolved,      'Resolved',      '#8b5cf6') +
            sc(counts.harassment,      'Harassment',    '#ef4444') +
            sc(counts.assault,         'Assault',       '#dc2626') +
            sc(counts.theft,           'Theft',         '#d97706');
    }

    function sc(v, l, c) {
        return '<div class="map-stat"><div class="val" style="color:' + c + ';">'
            + v + '</div><div class="lbl">' + l + '</div></div>';
    }

    // ── Load crimes ───────────────────────────────────────────
    var justSubmitted = new URLSearchParams(window.location.search).get('submitted') === '1';

    fetch('/crime/api/all-crimes')
        .then(function (r) { return r.json(); })
        .then(function (crimes) {
            // If empty (guest or no crimes), fallback to public approved
            if (!crimes || !crimes.length) {
                return fetch('/crime/api/crimes').then(function (r) { return r.json(); });
            }
            return crimes;
        })
        .then(function (crimes) {
            renderCrimes(crimes);
            if (justSubmitted && typeof showToast === 'function') {
                showToast('Your report is submitted and pending admin review.', 'success');
            }
        })
        .catch(function () {
            fetch('/crime/api/crimes')
                .then(function (r) { return r.json(); })
                .then(renderCrimes);
        });

})();