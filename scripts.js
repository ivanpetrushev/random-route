OSRM_TOKEN = '5b3ce3597851110001cf62481a688d900d66418ba38fc6db24843fd5';
MAPBOX_TOKEN = 'pk.eyJ1IjoiaXZhbmF0b3JhIiwiYSI6ImNrMXMxNWd2ejA4ZXQzbWthMnQ3cWsxdmoifQ.BiIeOPWFWTTRZvi_7RPGEA';


var mymap = L.map('mapid').setView([51.505, -0.09], 15);
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

mymap.on('click', function (e) {
    if (selectMode === 'begin') {
        markerBegin.setLatLng(e.latlng);
    }
    if (selectMode === 'end') {
        markerEnd.setLatLng(e.latlng);
    }
});

navigator.geolocation.getCurrentPosition(function(position) {
    console.log('getCurrentPosition', position);
    mymap.setView({lat: position.coords.latitude, lng: position.coords.longitude});
});

selectBegin = function () {
    selectMode = 'begin';
};

selectEnd = function () {
    selectMode = 'end';
};