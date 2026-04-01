const map = L.map('crime-map').setView([17.385, 78.486], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

const crimeIcons = {
    'harassment':        '⚠️',
    'assault':           '🔴',
    'theft':             '🟡',
    'stalking':          '🟠',
    'domestic_violence': '🟣',
    'other':             '⚪'
};

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(pos) {
        map.setView([pos.coords.latitude, pos.coords.longitude], 14);
        L.marker([pos.coords.latitude, pos.coords.longitude])
            .addTo(map)
            .bindPopup('<b>📍 You are here</b>')
            .openPopup();
    });
}

function renderCrimes(crimes) {
    crimes.forEach(function(crime) {
        const emoji     = crimeIcons[crime.crime_type] || '📍';
        const isPending = crime.status === 'pending';
        const icon = L.divIcon({
            html: `<span style="font-size:1.5rem;opacity:${isPending ? 0.55 : 1};">${emoji}</span>`,
            className: 'crime-icon',
            iconSize: [30, 30]
        });
        const statusBadge = isPending
            ? '<span style="background:#fef3c7;color:#92400e;font-size:0.75rem;padding:1px 6px;border-radius:10px;">⏳ Pending Review</span>'
            : '<span style="background:#d1fae5;color:#065f46;font-size:0.75rem;padding:1px 6px;border-radius:10px;">✅ Verified</span>';

        L.marker([crime.latitude, crime.longitude], { icon })
            .addTo(map)
            .bindPopup(`
                <div style="min-width:190px;font-family:sans-serif;">
                    <b style="text-transform:capitalize;">${crime.crime_type.replace('_', ' ')}</b>
                    <div style="margin:4px 0;">${statusBadge}</div>
                    <div style="color:#374151;font-size:0.85rem;">${crime.description || ''}</div>
                    <small style="color:#9ca3af;">${crime.location_name || ''}<br>${crime.created_at || ''}</small>
                </div>
            `);
    });
}

fetch('/crime/api/crimes')
    .then(r => r.json())
    .then(renderCrimes);

const params = new URLSearchParams(window.location.search);
if (params.get('submitted') === '1') {
    fetch('/crime/api/all-crimes')
        .then(r => r.json())
        .then(function(all) {
            renderCrimes(all.filter(c => c.status === 'pending'));
            showToast('Your report is on the map! Visible to all after admin review.', 'info');
        });
}