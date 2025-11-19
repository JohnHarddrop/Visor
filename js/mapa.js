//---------------------------------------------------------------
// 1. Crear mapa base
//---------------------------------------------------------------

var map = L.map('map').setView([-33.04, -71.62], 14);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);


//---------------------------------------------------------------
// 2. Estilo por nivel de daño
//---------------------------------------------------------------

function estilo(feature) {
    const nivel = feature.properties.nivel_danio;

    let color = "blue";
    if (nivel === "2") color = "orange";
    if (nivel === "3") color = "red";

    return {
        radius: 7,
        fillColor: color,
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.9
    };
}


//---------------------------------------------------------------
// 3. Popup
//---------------------------------------------------------------

function popup(feature, layer) {
    const p = feature.properties;

    layer.bindPopup(`
        <b>Fecha:</b> ${p.fecha_evento || ""}<br>
        <b>Hora:</b> ${p.hora_evento || ""}<br>
        <b>Tipo de afectación:</b> ${p.tipo_afectacion || ""}<br>
        <b>Nivel de daño:</b> ${p.nivel_danio || ""}<br>
        <b>Comentarios:</b> ${p.comentarios || ""}<br>
    `);
}


//---------------------------------------------------------------
// 4. Cargar GeoJSON desde archivo local (sin CORS)
//---------------------------------------------------------------

fetch("data/marejadas.geojson")
  .then(r => r.json())
  .then(data => {

      console.log("DATA CRUDA:", data);

      const capa = {
          type: "FeatureCollection",
          features: data.features  // Aquí no filtramos nada, simplemente cargamos todos los puntos
      };

      // Ajuste automático para mostrar los puntos
      map.fitBounds(L.geoJSON(data.features).getBounds());

      L.geoJSON(capa, {
          pointToLayer: (f, latlng) => L.circleMarker(latlng, estilo(f)),
          onEachFeature: popup
      }).addTo(map);
  })
  .catch(err => console.error("ERROR cargando GeoJSON local:", err));