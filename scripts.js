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
var poiCategories = {
    'park': [],
    'viewpoint': [],
    'water': [],
    'waterway': [],
    'supermarket': [],
};
var poiNodeMap = {};
var tempLayers = [];

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

    // add point in POI if any selected
    var poiPool = [];
    var inputs = document.getElementsByTagName('input');
    for (var i in inputs) {
        if (! inputs[i].checked) {
            continue;
        }

        var tag = inputs[i].name;
        for (var j in poiCategories[tag]) {
            poiPool.push(poiCategories[tag][j]);
        }
    }
    clearTempLayers();
    var poiSelected = false;
    if (poiPool.length > 0) {
        shuffle(poiPool);
        for (var i in poiPool) {
            if (poiSelected) {
                break;
            }
            var thisPoi = poiPool.pop();
            // find "center" point (if feature type = "way")
            if (thisPoi.type === 'way') {
                var poiCoordinates = [];
                var poiLeaflet = [];
                for (var j in thisPoi.nodes) {
                    var id = thisPoi.nodes[j];
                    poiLeaflet.push([poiNodeMap[id].lat, poiNodeMap[id].lon]); // leaflet-style coordinates
                    poiCoordinates.push([poiNodeMap[id].lon, poiNodeMap[id].lat]); // turf-style coordinates
                }
                var poiPolygon = L.polygon(poiCoordinates);
                var poiPolygonLeaflet = L.polygon(poiLeaflet);
                // tempLayers.push(poiPolygonLeaflet.addTo(mymap)); // debug
                var poiSelectedCenter = randomPointInPoly(poiPolygon);
                var point  = turf.point([poiSelectedCenter.lat, poiSelectedCenter.lng]);
                // tempLayers.push(L.marker(poiSelectedCenter).addTo(mymap)); // debug
                var poly   = poiPolygon.toGeoJSON();
                var inside = turf.inside(point, poly);
                if (inside) {
                    // check if point is also inside the inner restricted area - polygonUnion
                    var insideInner = turf.inside(point, polygonUnion.toGeoJSON());
                    if (insideInner) {
                        poiSelected = poiSelectedCenter;
                    }
                }
            }
            if (thisPoi.type === 'node') {
                // check if point is also inside the inner restricted area - polygonUnion
                var point  = turf.point([thisPoi.lat, thisPoi.lon]);
                var insideInner = turf.inside(point, polygonUnion.toGeoJSON());
                if (insideInner) {
                    poiSelected = thisPoi;
                }
            }
        }
    }
    var middleLatLng;
    if (poiSelected) {
        console.log('using already selected middle from POIs')
        middleLatLng = poiSelected;
    } else {
        console.log('using random point in Union')
        middleLatLng = randomPointInPoly(polygonUnion);
    }

    markerMiddle = new L.marker(middleLatLng, {draggable: true}).addTo(mymap);
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
        "  node['shop'='supermarket']("+bbox+");" +
        ");" +
        "out body;" +
        ">;" +
        "out skel qt;";

    var formData = new FormData();
    formData.append('data', query);

    var response = await fetch(overpassUrl+'?data='+query);
    var json = await response.json();

    // load poi lists
    poiCategories = {
        'park': [],
        'viewpoint': [],
        'water': [],
        'waterway': [],
        'supermarket': [],
    };
    poiNodeMap = {};
    for (var i in json.elements) {
        if (json.elements[i].tags) {
            if (json.elements[i].tags.tourism && json.elements[i].tags.tourism === 'viewpoint') {
                poiCategories['viewpoint'].push(json.elements[i]);
            }
            if (json.elements[i].tags.leisure && json.elements[i].tags.leisure === 'park') {
                poiCategories['park'].push(json.elements[i]);
            }
            if (json.elements[i].tags.natural && json.elements[i].tags.natural === 'water') {
                poiCategories['water'].push(json.elements[i]);
            }
            if (json.elements[i].tags.waterway) {
                poiCategories['waterway'].push(json.elements[i]);
            }
            if (json.elements[i].tags.shop && json.elements[i].tags.shop === 'supermarket') {
                poiCategories['supermarket'].push(json.elements[i]);
            }
        }
        if (json.elements[i].type === 'node') {
            var id = json.elements[i].id;
            poiNodeMap[id] = {lat: json.elements[i].lat, lon: json.elements[i].lon};
        }
    }
    document.getElementById('num_park').textContent = poiCategories['park'].length;
    document.getElementById('num_viewpoint').textContent = poiCategories['viewpoint'].length;
    document.getElementById('num_water').textContent = poiCategories['water'].length;
    document.getElementById('num_waterway').textContent = poiCategories['waterway'].length;
    document.getElementById('num_supermarket').textContent = poiCategories['supermarket'].length;
};

shuffle = function(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
};

clearTempLayers = function () {
    for (var i in tempLayers) {
        mymap.removeLayer(tempLayers[i]);
    }
};