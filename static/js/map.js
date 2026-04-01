(function () {
    var mapEl = document.getElementById('crime-map');
    if (!mapEl) return;

    var map = L.map('crime-map').setView([17.385, 78.486], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19
    }).addTo(map);
    setTimeout(function () { map.invalidateSize(); }, 300);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (pos) {
            map.setView([pos.coords.latitude, pos.coords.longitude], 14);
            L.marker([pos.coords.latitude, pos.coords.longitude])
                .addTo(map).bindPopup('<b>📍 You are here</b>').openPopup();
        }, function () {});
    }

    var crimeIcons   = { harassment:'⚠️', assault:'🔴', theft:'🟡', stalking:'🟠', domestic_violence:'🟣', other:'⚪' };
    var sevColors    = { high:'#ef4444', medium:'#f59e0b', low:'#10b981' };
    var statusLabels = {
        pending:       '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-size:0.75rem;">⏳ Pending</span>',
        investigating: '<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:10px;font-size:0.75rem;">🔍 Investigating</span>',
        approved:      '<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:10px;font-size:0.75rem;">✅ Verified</span>',
        resolved:      '<span style="background:#ede9fe;color:#5b21b6;padding:2px 8px;border-radius:10px;font-size:0.75rem;">✔️ Resolved</span>',
        rejected:      '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:10px;font-size:0.75rem;">❌ Rejected</span>'
    };

    var allMarkers = [];

    function clearMarkers() {
        allMarkers.forEach(function(m) { map.removeLayer(m); });
        allMarkers = [];
    }

    function renderCrimes(crimes) {
        clearMarkers();
        var counts   = { total:0, harassment:0, assault:0, theft:0, stalking:0 };
        var byStatus = { pending:0, investigating:0, approved:0, resolved:0, rejected:0 };

        crimes.forEach(function(crime) {
            var isPending = (crime.status === 'pending' || crime.status === 'investigating');
            var emoji     = crimeIcons[crime.crime_type] || '📍';
            var sevColor  = sevColors[crime.severity]    || '#6b7280';

            var icon = L.divIcon({
                html: '<span style="font-size:1.6rem;opacity:' + (isPending ? 0.5 : 1) + ';">' + emoji + '</span>',
                className: '', iconSize: [32,32], iconAnchor: [16,32]
            });

            var statusBadge = statusLabels[crime.status] || '';
            var sevBadge    = '<span style="background:' + sevColor + '22;color:' + sevColor + ';padding:2px 8px;border-radius:10px;font-size:0.75rem;font-weight:600;">'
                            + (crime.severity || 'medium').toUpperCase() + '</span>';

            var popup = '<div style="min-width:220px;font-family:sans-serif;line-height:1.6;">'
                + '<b style="font-size:0.95rem;text-transform:capitalize;">' + crime.crime_type.replace('_',' ') + '</b>'
                + '<div style="margin:5px 0;display:flex;gap:6px;flex-wrap:wrap;">' + statusBadge + ' ' + sevBadge + '</div>'
                + (crime.description ? '<p style="color:#374151;font-size:0.84rem;margin:4px 0;">' + crime.description + '</p>' : '')
                + '<p style="color:#9ca3af;font-size:0.78rem;margin:4px 0 0;">'
                + (crime.location_name || '') + (crime.created_at ? ' &bull; ' + crime.created_at.split(' ')[0] : '')
                + (crime.reporter_name ? '<br>Reported by: ' + crime.reporter_name : '')
                + '</p></div>';

            var m = L.marker([crime.latitude, crime.longitude], { icon: icon })
                      .addTo(map).bindPopup(popup);
            allMarkers.push(m);

            counts.total++;
            if (counts[crime.crime_type] !== undefined) counts[crime.crime_type]++;
            if (byStatus[crime.status] !== undefined) byStatus[crime.status]++;
        });

        updateStats(counts, byStatus);
    }

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
        return '<div class="map-stat"><div class="val" style="color:' + c + ';">' + v + '</div><div class="lbl">' + l + '</div></div>';
    }

    var justSubmitted = new URLSearchParams(window.location.search).get('submitted') === '1';

    fetch('/crime/api/all-crimes')
        .then(function(r) { return r.json(); })
        .then(function(crimes) {
            if (!crimes || !crimes.length) {
                return fetch('/crime/api/crimes').then(function(r) { return r.json(); });
            }
            return crimes;
        })
        .then(function(crimes) {
            renderCrimes(crimes);
            if (justSubmitted && typeof showToast === 'function') {
                showToast('Your report is submitted and pending admin review.', 'success');
            }
        })
        .catch(function() {
            fetch('/crime/api/crimes')
                .then(function(r) { return r.json(); })
                .then(renderCrimes);
        });
})();