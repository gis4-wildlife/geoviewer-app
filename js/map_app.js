/* Wildlife Tracker GEO — MapLibre GL JS */

const ESRI_OCEAN_STYLE = {
    version: 8,
    sources: {
        'esri-ocean': {
            type: 'raster',
            tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Tiles &copy; Esri &mdash; GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ',
        },
    },
    layers: [{
        id: 'esri-ocean-layer',
        type: 'raster',
        source: 'esri-ocean'
    }],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
};

const map = new maplibregl.Map({
    container: 'map',
    style: ESRI_OCEAN_STYLE,
    center: [-100, -8],
    zoom: 5,
    attributionControl: false,
    antialias: true,
});
map.addControl(new maplibregl.NavigationControl({
    showCompass: false
}), 'top-right');

// ── ANIMATION STATE ───────────────────────────────────────
let ALL_COORDS = [];
let startMs = 0,
    endMs = 0;
let frame = 0, playing = false, animId = null;
let currentSpeed = 0.2;

function frameToDate(i) {
    const t = ALL_COORDS.length > 1 ? i / (ALL_COORDS.length - 1) : 0;
    return new Date(startMs + t * (endMs - startMs));
}

function updateFrame(i) {
    i = Math.max(0, Math.min(i, ALL_COORDS.length - 1));
    frame = i;
    const idx = Math.floor(i);

    // LineString requires at least 2 points
    const trail = ALL_COORDS.slice(0, Math.max(2, idx + 1));
    const head = ALL_COORDS[idx];

    map.getSource('track').setData({
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: trail
        },
    });
    if (window._sharkMarker) window._sharkMarker.setLngLat(head);

    const d = frameToDate(i);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const datePart = d.getUTCDate() + ' ' + months[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
    const timePart = String(d.getUTCHours()).padStart(2,'0') + ':' + String(d.getUTCMinutes()).padStart(2,'0');
    document.getElementById('cur-date-d').textContent = datePart;
    document.getElementById('cur-date-t').textContent = timePart;
    document.getElementById('trk-sl').value = idx;

    document.getElementById('last-pos').textContent = head[0].toFixed(4) + ', ' + head[1].toFixed(4);
    document.getElementById('last-time').textContent = datePart;
}

function tick() {
    if (!playing) return;
    frame = frame + currentSpeed;
    if (frame >= ALL_COORDS.length) {
        pause();
        frame = 0;
        updateFrame(0);
        setTimeout(() => play(), 600);
        return;
    }
    updateFrame(frame);
    animId = requestAnimationFrame(tick);
}

function play() {
    if (playing || ALL_COORDS.length === 0) return;
    if (frame >= ALL_COORDS.length - 1) frame = 0;
    playing = true;
    const btn = document.getElementById('play-btn');
    btn.textContent = '';
    btn.classList.add('paused');
    animId = requestAnimationFrame(tick);
}

function pause() {
    playing = false;
    cancelAnimationFrame(animId);
    const btn = document.getElementById('play-btn');
    btn.textContent = '▶';
    btn.classList.remove('paused');
}

function togglePlay() {
    playing ? pause() : play();
}

function onSlider(v) {
    pause();
    updateFrame(parseInt(v));
}

function toggleSpdPopup() {
    document.getElementById('spd-popup').classList.toggle('open');
}
function onSpdSlider(v) {
    currentSpeed = parseFloat(v);
    const num = parseFloat(v).toFixed(1);
    document.getElementById('spd-val').textContent = num;
    document.getElementById('spd-btn').textContent = num + ' speed';
}
// close popup when clicking outside
document.addEventListener('click', e => {
    const wrap = document.getElementById('spd-wrap');
    if (wrap && !wrap.contains(e.target)) {
        document.getElementById('spd-popup').classList.remove('open');
    }
});

// ── LOAD & DISPLAY TRACK ──────────────────────────────────
map.on('load', async () => {
    const res = await fetch('data/sky-galapagos-whaleshark.geojson');
    const geojson = await res.json();

    const feature = geojson.features[0];
    ALL_COORDS = feature.geometry.coordinates;
    const props = feature.properties;

    startMs = new Date(props.begin).getTime();
    endMs = new Date(props.end).getTime();

    // Slider range
    document.getElementById('trk-sl').max = ALL_COORDS.length - 1;

    // Fit map
    const lons = ALL_COORDS.map(c => c[0]),
        lats = ALL_COORDS.map(c => c[1]);
    map.fitBounds(
        [
            [Math.min(...lons), Math.min(...lats)],
            [Math.max(...lons), Math.max(...lats)]
        ], {
            padding: 60,
            duration: 800
        }
    );

    // Ghost — full route shown faintly
    map.addSource('ghost', {
        type: 'geojson',
        data: geojson
    });
    map.addLayer({
        id: 'ghost-line',
        type: 'line',
        source: 'ghost',
        paint: {
            'line-color': '#ffffff',
            'line-width': 1.2,
            'line-opacity': 0.12
        },
        layout: {
            'line-cap': 'round',
            'line-join': 'round'
        },
    });

    // Animated trail — needs at least 2 points for a valid LineString
    map.addSource('track', {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [ALL_COORDS[0], ALL_COORDS[1]]
            }
        },
    });
    map.addLayer({
        id: 'track-glow',
        type: 'line',
        source: 'track',
        paint: {
            'line-color': '#000000',
            'line-width': 10,
            'line-opacity': 0.25,
            'line-blur': 6
        },
    });
    map.addLayer({
        id: 'track-line',
        type: 'line',
        source: 'track',
        paint: {
            'line-color': '#000000',
            'line-width': 3.2,
            'line-opacity': 0.8
        },
        layout: {
            'line-cap': 'round',
            'line-join': 'round'
        },
    });

    // Head marker — custom HTML element for CSS animation
    const markerEl = document.createElement('div');
    markerEl.className = 'shark-marker';
    window._sharkMarker = new maplibregl.Marker({ element: markerEl, anchor: 'center' })
        .setLngLat(ALL_COORDS[0])
        .addTo(map);

    updateFrame(0);
    setTimeout(() => play(), 900);
});

// ── SIDEBAR HELPERS ───────────────────────────────────────
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('backdrop').classList.toggle('open');
}