async function safeherAPI(url, options = {}) {
    try {
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options,
            body: options.body ? JSON.stringify(options.body) : undefined,
        });
        const data = await res.json();
        if (!res.ok) {
            showToast(data.message || 'Something went wrong.', 'error');
            return null;
        }
        return data;
    } catch (err) {
        showToast('Network error. Please check your connection.', 'error');
        return null;
    }
}

function getUserLocation() {
    return new Promise(function(resolve, reject) {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            function(pos) { resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
            function(err) { reject(err); }
        );
    });
}