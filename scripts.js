OSRM_TOKEN = '5b3ce3597851110001cf62481a688d900d66418ba38fc6db24843fd5';
MAPBOX_TOKEN = 'pk.eyJ1IjoiaXZhbmF0b3JhIiwiYSI6ImNrMXMxNWd2ejA4ZXQzbWthMnQ3cWsxdmoifQ.BiIeOPWFWTTRZvi_7RPGEA';


var mymap = L.map('mapid').setView([42.1510598276, 24.7412538528], 15);
var begin = {lat: 0, lng: 0};
var end = {lat: 0, lng: 0};
var selectMode = null;

L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=' + MAPBOX_TOKEN, {
    maxZoom: 18,
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
    '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
    'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    id: 'mapbox.streets'
}).addTo(mymap);

var markerBegin = new L.marker({lat: 0, lng: 0}, {draggable: true}).addTo(mymap);
var markerEnd = new L.marker({lat: 0, lng: 0}, {draggable: true}).addTo(mymap);
var markerMiddle = null;
var route = null;

mymap.on('click', function (e) {
    if (selectMode === 'begin') {
        markerBegin.setLatLng(e.latlng);
    }
    if (selectMode === 'end') {
        markerEnd.setLatLng(e.latlng);
    }
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
    var b = mymap.getBounds();
    var polygon = L.polygon([b.getNorthEast(), b.getSouthEast(), b.getSouthWest(), b.getNorthWest()]);
    var latLng = randomPointInPoly(polygon);
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
        return L.latLng(lat, lng);
    } else {
        return randomPointInPoly(polygon)
    }
};