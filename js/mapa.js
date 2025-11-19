// 1. Crear mapa base
var map = L.map('map').setView([-33.04, -71.62], 14); // Ajusta la posición inicial y zoom del mapa

// Añadir capas base (OpenStreetMap, Terrain, Satellite)
var osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
});

var terrainLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
});

var satelliteLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
});

// Por defecto, OpenStreetMap
osmLayer.addTo(map);

// Añadir control de capas para cambiar el fondo del mapa
L.control.layers({
    "OpenStreetMap": osmLayer,
    "Terrain": terrainLayer,
    "Satellite": satelliteLayer
}).addTo(map);

// 2. Estilo para los puntos (según nivel de daño)
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

// 3. Popup para cada punto con los detalles
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

// 4. Cargar los datos desde el archivo GeoJSON (sin filtrar)
fetch("data/marejadas.geojson")
  .then(r => r.json())
  .then(data => {
      console.log("DATA CRUDA:", data);

      // Llamamos a la función para mostrar las estadísticas
      mostrarEstadisticas(data.features);

      // Creamos una capa de GeoJSON con los datos
      const capa = {
          "type": "FeatureCollection",
          "features": data.features  // Aquí no filtramos nada, simplemente cargamos todos los puntos
      };

      // Ajuste automático para mostrar todos los puntos en la vista del mapa
      map.fitBounds(L.geoJSON(data.features).getBounds());

      // Añadir los puntos al mapa
      L.geoJSON(capa, {
          pointToLayer: (f, latlng) => L.circleMarker(latlng, estilo(f)),
          onEachFeature: popup
      }).addTo(map);
  })
  .catch(err => console.error("ERROR cargando GeoJSON local:", err));

// 5. Filtrar puntos según el tipo de afectación y nivel de urgencia
document.getElementById('filter-form').addEventListener('submit', function(event) {
    event.preventDefault(); // Evita la recarga de la página

    const filterType = document.getElementById('filter-type').value;
    const filterUrgency = document.getElementById('filter-urgency').value;

    // Filtrar los datos en función de los valores seleccionados
    const filteredData = data.features.filter(feature => {
        const tipoAfectacion = feature.properties.tipo_afectacion;
        const nivelUrgencia = feature.properties.nivel_danio;

        const matchesType = !filterType || tipoAfectacion === filterType;
        const matchesUrgency = !filterUrgency || nivelUrgencia === filterUrgency;

        return matchesType && matchesUrgency;
    });

    // Limpiar los puntos anteriores y añadir los puntos filtrados
    map.eachLayer(layer => {
        if (layer instanceof L.GeoJSON) {
            map.removeLayer(layer);
        }
    });

    // Crear nueva capa de GeoJSON con los puntos filtrados
    const capaFiltrada = {
        "type": "FeatureCollection",
        "features": filteredData
    };

    // Ajuste automático para mostrar los puntos filtrados
    map.fitBounds(L.geoJSON(filteredData).getBounds());

    // Añadir los puntos filtrados al mapa
    L.geoJSON(capaFiltrada, {
        pointToLayer: (f, latlng) => L.circleMarker(latlng, estilo(f)),
        onEachFeature: popup
    }).addTo(map);
});

function mostrarEstadisticas(data) {
    const totalReportes = data.length;

    // Contar los reportes por tipo de afectación
    const tipoAfectacion = data.reduce((acc, feature) => {
        const tipo = feature.properties.tipo_afectacion;
        acc[tipo] = (acc[tipo] || 0) + 1;
        return acc;
    }, {});

    // Contar los reportes por nivel de daño
    const nivelDanio = data.reduce((acc, feature) => {
        const nivel = feature.properties.nivel_danio;
        acc[nivel] = (acc[nivel] || 0) + 1;
        return acc;
    }, {});

    // Mostrar las estadísticas de manera más ordenada
    document.getElementById('statistics-data').innerHTML = `
        <p><b>Total de reportes:</b> ${totalReportes}</p>
        <p><b>Tipos de Afectación:</b></p>
        <ul>
            ${Object.entries(tipoAfectacion).map(([key, value]) => `<li>${key.replace(/_/g, ' ').toUpperCase()}: ${value}</li>`).join('')}
        </ul>
        <p><b>Niveles de Daño:</b></p>
        <ul>
            ${Object.entries(nivelDanio).map(([key, value]) => `<li>${key}: ${value}</li>`).join('')}
        </ul>
    `;
}


// Función para abrir el formulario de KoboToolbox en una nueva ventana
document.getElementById('open-kobo-form').addEventListener('click', () => {
    window.open("https://ee.kobotoolbox.org/x/WpH0FcYu", "_blank");
});