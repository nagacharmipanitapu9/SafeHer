const shuttleMap = L.map('shuttle-map').setView([17.385, 78.486], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(shuttleMap);

function findShuttles() {
    if (!navigator.geolocation) {
        alert('Please enable location access!');
        return;
    }

    navigator.geolocation.getCurrentPosition(function(pos) {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        shuttleMap.setView([lat, lng], 14);
        L.marker([lat, lng]).addTo(shuttleMap).bindPopup('📍 You are here').openPopup();

        fetch('/shuttle/nearby', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude: lat, longitude: lng })
        })
        .then(r => r.json())
        .then(shuttles => {
            const list = document.getElementById('shuttleList');
            list.innerHTML = '';

            shuttles.forEach(s => {
                // Map marker
                const icon = L.divIcon({
                    html: '<span style="font-size:1.5rem;">🚌</span>',
                    className: 'crime-icon',
                    iconSize: [30, 30]
                });
                L.marker([s.lat, s.lng], { icon: icon })
                    .addTo(shuttleMap)
                    .bindPopup(`<b>${s.name}</b><br>Next: ${s.next_arrival}<br>Status: ${s.status}`);

                // List card
                list.innerHTML += `
                    <div class="card shuttle-card">
                        <div class="shuttle-status ${s.status}"></div>
                        <div class="shuttle-info">
                            <h4>${s.name}</h4>
                            <p>Next arrival: ${s.next_arrival} • Status: ${s.status}</p>
                        </div>
                    </div>
                `;
            });
        });
    });
}
