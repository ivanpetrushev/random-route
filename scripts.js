OSRM_TOKEN = '5b3ce3597851110001cf62481a688d900d66418ba38fc6db24843fd5';
MAPBOX_TOKEN = 'pk.eyJ1IjoiaXZhbmF0b3JhIiwiYSI6ImNrMXMxNWd2ejA4ZXQzbWthMnQ3cWsxdmoifQ.BiIeOPWFWTTRZvi_7RPGEA';


var mymap = L.map('mapid').setView([42.1510598276, 24.7412538528], 15);
var begin = {lat: 0, lng: 0};
var end = {lat: 0, lng: 0};
var selectMode = null;
var markerBegin = new L.marker({lat: 0, lng: 0}, {draggable: true}).addTo(mymap);
var markerEnd = new L.marker({lat: 0, lng: 0}, {draggable: true}).addTo(mymap);
var markerMiddle = null;
var route = null;
var layerUnion = null;
var polygonUnion = null;

L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=' + MAPBOX_TOKEN, {
    maxZoom: 18,
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
    '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
    'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    id: 'mapbox.streets'
}).addTo(mymap);

mymap.on('click', function (e) {
    if (selectMode === 'begin') {
        markerBegin.setLatLng(e.latlng);
    }
    if (selectMode === 'end') {
        markerEnd.setLatLng(e.latlng);
    }
});

markerBegin.on('move', function(e) {
    recalculateArea();
});
markerEnd.on('move', function(e) {
    recalculateArea();
});

navigator.geolocation.getCurrentPosition(function(position) {
    mymap.setView({lat: position.coords.latitude, lng: position.coords.longitude});
});

selectBegin = function () {
    selectMode = 'begin';
};

selectEnd = function () {
    selectMode = 'end';
};

makeMarkerMiddle = function () {
    if (markerMiddle) {
        mymap.removeLayer(markerMiddle);
    }
    var latLng = randomPointInPoly(polygonUnion);
    markerMiddle = new L.marker(latLng, {draggable: true}).addTo(mymap);
};

navigate = async function () {
    makeMarkerMiddle();

    var url = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';

    var response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-type': 'application/json',
            'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
            'Authorization': OSRM_TOKEN
        },
        body: JSON.stringify({
            // profile: 'foot-walking',
            coordinates: [
                [markerBegin.getLatLng().lng, markerBegin.getLatLng().lat],
                [markerMiddle.getLatLng().lng, markerMiddle.getLatLng().lat],
                [markerEnd.getLatLng().lng, markerEnd.getLatLng().lat]
            ]
        })
    });
    var json = await response.json();
    if (route) {
        mymap.removeLayer(route);
    }
    route = L.geoJSON(json.features).addTo(mymap);
};

randomPointInPoly = function(polygon) {
    var bounds = polygon.getBounds();
    var x_min  = bounds.getEast();
    var x_max  = bounds.getWest();
    var y_min  = bounds.getSouth();
    var y_max  = bounds.getNorth();

    var lat = y_min + (Math.random() * (y_max - y_min));
    var lng = x_min + (Math.random() * (x_max - x_min));

    var point  = turf.point([lng, lat]);
    var poly   = polygon.toGeoJSON();
    var inside = turf.inside(point, poly);

    if (inside) {
        // why are lat and lng switched here?
        return L.latLng(lng, lat);
    } else {
        return randomPointInPoly(polygon)
    }
};

recalculateArea = function () {
    var polygonBegin = null;
    var polygonEnd = null;

    var from = turf.point([markerBegin.getLatLng().lng, markerBegin.getLatLng().lat]);
    var to = turf.point([markerEnd.getLatLng().lng, markerEnd.getLatLng().lat]);
    var distance = turf.distance(from, to);

    var radius = distance * 0.75; // in km

    polygonBegin = turf.circle(from, radius);
    polygonEnd = turf.circle(to, radius);
    var union = turf.union(polygonBegin, polygonEnd);
    polygonUnion = L.polygon(union.geometry.coordinates[0]);

    if (layerUnion) {
        mymap.removeLayer(layerUnion);
    }
    layerUnion = L.geoJSON(union).addTo(mymap);
};

fetchPoiNumbers = async function () {
    var b = mymap.getBounds();
    var bbox = b.getSouth() + ',' + b.getWest() + ',' + b.getNorth() + ',' + b.getEast();
    var overpassUrl = 'https://overpass-api.de/api/interpreter';
    var query = "[out:json][timeout:25];" +
        "(" +
        "  node['leisure'='park']("+bbox+");" +
        "  way['leisure'='park']("+bbox+");" +
        "  node['tourism'='viewpoint']("+bbox+");" +
        "  way['tourism'='viewpoint']("+bbox+");" +
        "  way['natural'='water']("+bbox+");" +
        "  way['waterway']("+bbox+");" +
        ");" +
        "out body;" +
        ">;" +
        "out skel qt;";

    var formData = new FormData();
    formData.append('data', query);

    var response = await fetch(overpassUrl+'?data='+query);
    var json = await response.json();
    console.log('json', json)
};