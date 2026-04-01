const sosBtn = document.getElementById('sos-button');
const sosStatus = document.getElementById('sos-status');
let holdTimer;

sosBtn.addEventListener('mousedown', function() {
    holdTimer = setTimeout(triggerSOS, 1500); // Hold for 1.5 seconds
    sosBtn.style.transform = 'scale(0.9)';
});

sosBtn.addEventListener('mouseup', function() {
    clearTimeout(holdTimer);
    sosBtn.style.transform = 'scale(1)';
});

sosBtn.addEventListener('touchstart', function(e) {
    e.preventDefault();
    holdTimer = setTimeout(triggerSOS, 1500);
    sosBtn.style.transform = 'scale(0.9)';
});

sosBtn.addEventListener('touchend', function() {
    clearTimeout(holdTimer);
    sosBtn.style.transform = 'scale(1)';
});

function triggerSOS() {
    sosBtn.style.transform = 'scale(1)';

    if (!navigator.geolocation) {
        alert('Geolocation is not supported. Please enable GPS.');
        return;
    }

    navigator.geolocation.getCurrentPosition(function(pos) {
        fetch('/sos/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                message: 'EMERGENCY! I need help immediately!'
            })
        })
        .then(r => r.json())
        .then(data => {
            sosStatus.style.display = 'block';
            sosStatus.innerHTML = '✅ ' + data.status + '<br><small>Your location has been shared with emergency contacts.</small>';
        })
        .catch(() => {
            sosStatus.style.display = 'block';
            sosStatus.innerHTML = '⚠️ Failed to send SOS. Please call 112 directly.';
        });
    }, function() {
        alert('Please enable location access to use SOS!');
    });
}
