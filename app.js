// Variables globales
var map;
var vectorSource;
var vectorLayer;
var geoJsonData = [];

function applyMargins() {
  var leftToggler = $(".mini-submenu-left");
  if (leftToggler.is(":visible")) {
    $("#map .ol-zoom")
      .css("margin-left", 0)
      .removeClass("zoom-top-opened-sidebar")
      .addClass("zoom-top-collapsed");
  } else {
    $("#map .ol-zoom")
      .css("margin-left", $(".sidebar-left").width())
      .removeClass("zoom-top-opened-sidebar")
      .removeClass("zoom-top-collapsed");
  }
}

function isConstrained() {
  return $(".sidebar").width() == $(window).width();
}

function applyInitialUIState() {
  if (isConstrained()) {
    $(".sidebar-left .sidebar-body").fadeOut('slide');
    $('.mini-submenu-left').fadeIn();
  }
}

// Función para cargar datos GeoJSON
function loadGeoJSONData() {
    console.log("🔄 Iniciando carga de GeoJSON...");
    
    // Mostrar mensaje de carga
    $('body').append('<div class="loading-message">Cargando datos de marejadas...</div>');
    
    return fetch('data/marejadas.geojson')
        .then(response => {
            console.log("📡 Respuesta del servidor:", response.status, response.statusText);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("✅ GeoJSON cargado exitosamente:", data);
            $('.loading-message').remove();
            
            if (!data.features || data.features.length === 0) {
                console.warn("⚠️ GeoJSON no contiene features");
                throw new Error('El archivo GeoJSON no contiene datos');
            }
            
            geoJsonData = data.features;
            console.log(`📊 Datos procesados: ${geoJsonData.length} registros`);
            return geoJsonData;
        })
        .catch(error => {
            console.error("❌ Error cargando GeoJSON:", error);
            $('.loading-message').remove();
            
            // Mensaje más detallado
            var errorMsg = `Error al cargar los datos: ${error.message}\n\n` +
                          `Verifica que:\n` +
                          `• El archivo data/marejadas.geojson exista\n` +
                          `• La ruta sea correcta\n` +
                          `• El servidor permita acceso al archivo\n` +
                          `• El formato del GeoJSON sea válido`;
            
            alert(errorMsg);
            return [];
        });
}

// Función para mapear nivel_danio a urgencia
function getUrgencyFromDamageLevel(nivelDanio) {
  switch(nivelDanio) {
    case "1": return "Bajo";
    case "2": return "Medio";
    case "3": return "Alto";
    default: return "Bajo";
  }
}

// Función para obtener color según urgencia
function getColorByUrgency(urgency) {
  switch(urgency) {
    case 'Alto': return '#e74c3c';
    case 'Medio': return '#f39c12';
    case 'Bajo': return '#f1c40f';
    default: return '#95a5a6';
  }
}

// Función para crear estilo de puntos
function createStyle(feature) {
  var urgency = feature.get('urgency');
  var color = getColorByUrgency(urgency);
  
  return new ol.style.Style({
    image: new ol.style.Circle({
      radius: 8,
      fill: new ol.style.Fill({color: color}),
      stroke: new ol.style.Stroke({
        color: '#2c3e50',
        width: 2
      })
    })
  });
}

// Función para crear contenido del popup
// Función para crear contenido del popup
function createPopupContent(feature) {
    var props = feature.getProperties();
    
    // Mapear tipos de afectación a nombres legibles
    var tipoMap = {
        'inundacion_vereda': 'Inundación de vereda',
        'inundacion_calle': 'Inundación de calle', 
        'inundacion_vivienda': 'Inundación de viviendas/comercio',
        'danos_infraestructura': 'Daño a infraestructura costera',
        'erosion': 'Erosión o socavón',
        'otro': 'Otro'
    };
    
    var tipoDisplay = tipoMap[props.tipo_afectacion] || props.tipo_afectacion || 'No especificado';
    
    var content = `
        <div class="popup-content" style="background: white; padding: 15px; border-radius: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 300px; font-family: Arial, sans-serif;">
            <h5 style="margin-top: 0; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px;">Detalles del Reporte</h5>
            <div style="display: grid; grid-template-columns: 1fr; gap: 8px;">
                <div><strong>📍 Tipo:</strong> ${tipoDisplay}</div>
                <div><strong>📅 Fecha:</strong> ${props.fecha_evento || 'No especificada'}</div>
                <div><strong>⚠️ Nivel de daño:</strong> ${props.nivel_danio || 'No especificado'}</div>
                <div><strong>🌊 Altura agua:</strong> ${props.altura_agua ? props.altura_agua + ' cm' : 'No medido'}</div>
                <div><strong>🚨 Urgencia:</strong> <span style="color: ${getColorByUrgency(props.urgency)}; font-weight: bold;">${props.urgency}</span></div>
                <div><strong>💬 Comentarios:</strong> ${props.comentarios || 'Sin comentarios'}</div>
                <div><strong>📋 Estado:</strong> ${props.estado_validacion || 'Pendiente'}</div>
            </div>
    `;
    
    // Imágenes (a futuro):
    if (props.foto_evento && props.foto_evento !== "No especificado") {
        content += `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;">
                <strong>📸 Foto:</strong><br>
                <div style="color: #7f8c8d; font-style: italic;">Imagen disponible en Kobo</div>
            </div>
        `;
    }
    
    content += `</div>`;
    return content;

}

// Función para aplicar filtros
function applyFilters() {
  var typeFilter = $('#filter-type').val();
  var urgencyFilter = $('#filter-urgency').val();
  
  // Filtrar características
  var filteredFeatures = vectorSource.getFeatures().filter(function(feature) {
    var tipo = feature.get('tipo_afectacion');
    var urgencia = feature.get('urgency');
    
    var typeMatch = !typeFilter || tipo === typeFilter;
    var urgencyMatch = !urgencyFilter || urgencia === urgencyFilter;
    
    return typeMatch && urgencyMatch;
  });
  
  // Actualizar la fuente con características filtradas
  vectorSource.clear();
  vectorSource.addFeatures(filteredFeatures);
  
  // Actualizar estadísticas
  updateStatistics();
}

// Función para actualizar estadísticas
function updateStatistics() {
    var features = vectorSource.getFeatures();
    var totalReports = features.length;
    
    var highUrgency = features.filter(f => f.get('urgency') === "Alto").length;
    var mediumUrgency = features.filter(f => f.get('urgency') === "Medio").length;
    var lowUrgency = features.filter(f => f.get('urgency') === "Bajo").length;
    
    // Contar por tipo de afectación
    var inundacionVereda = features.filter(f => f.get('tipo_afectacion') === "inundacion_vereda").length;
    var inundacionCalle = features.filter(f => f.get('tipo_afectacion') === "inundacion_calle").length;
    var inundacionVivienda = features.filter(f => f.get('tipo_afectacion') === "inundacion_vivienda").length;
    var danosInfraestructura = features.filter(f => f.get('tipo_afectacion') === "danos_infraestructura").length;
    var erosion = features.filter(f => f.get('tipo_afectacion') === "erosion").length;
    var otro = features.filter(f => f.get('tipo_afectacion') === "otro").length;
    
    // Actualizar la interfaz
    $('#total-reports').text(totalReports);
    $('#high-urgency').text(highUrgency);
    $('#medium-urgency').text(mediumUrgency);
    $('#low-urgency').text(lowUrgency);
    $('#inundacion-vereda').text(inundacionVereda);
    $('#inundacion-calle').text(inundacionCalle);
    $('#inundacion-vivienda').text(inundacionVivienda);
    $('#danos-infraestructura').text(danosInfraestructura);
    $('#erosion').text(erosion);
    $('#otro').text(otro);
}

// Función para inicializar el mapa con datos GeoJSON
function initializeMapWithData(features) {
  if (features.length === 0) {
    alert('No hay datos para mostrar. El mapa se inicializará vacío.');
  }

  // Configuración del mapa
  map = new ol.Map({
    target: "map",
    layers: [
      new ol.layer.Tile({
        source: new ol.source.OSM()
      })
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([-71.626963, -33.038295]), // Centrado en tu dato
      zoom: 15
    })
  });

  // Crear fuente vectorial y capa
  vectorSource = new ol.source.Vector();
  vectorLayer = new ol.layer.Vector({
    source: vectorSource,
    style: createStyle
  });
  
  map.addLayer(vectorLayer);

  // Convertir características GeoJSON a características OpenLayers
  features.forEach(function(featureData) {
    var coords = featureData.geometry.coordinates;
    var props = featureData.properties;
    
    var feature = new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat([coords[0], coords[1]])),
      tipo_afectacion: props.tipo_afectacion,
      nivel_danio: props.nivel_danio,
      altura_agua: props.altura_agua,
      fecha_evento: props.fecha_evento,
      comentarios: props.comentarios,
      estado_validacion: props.estado_validacion,
      foto_evento: props.foto_evento,
      urgency: getUrgencyFromDamageLevel(props.nivel_danio)
    });
    
    vectorSource.addFeature(feature);
  });

  // Agregar interacción para popups
  var overlay = new ol.Overlay({
    element: document.createElement('div'),
    positioning: 'bottom-center',
    stopEvent: false
  });
  map.addOverlay(overlay);

  map.on('click', function(evt) {
    var feature = map.forEachFeatureAtPixel(evt.pixel, function(feature) {
      return feature;
    });
    
    if (feature) {
      var content = createPopupContent(feature);
      overlay.getElement().innerHTML = content;
      overlay.setPosition(evt.coordinate);
    } else {
      overlay.setPosition(undefined);
    }
  });

  // Actualizar estadísticas iniciales
  updateStatistics();
}

$(function(){
  // Cargar datos GeoJSON primero
  loadGeoJSONData().then(function(features) {
    initializeMapWithData(features);
  });

  // Configuración del sidebar
  $('.sidebar-left .slide-submenu').on('click',function() {
    var thisEl = $(this);
    thisEl.closest('.sidebar-body').fadeOut('slide',function(){
      $('.mini-submenu-left').fadeIn();
      applyMargins();
    });
  });

  $('.mini-submenu-left').on('click',function() {
    var thisEl = $(this);
    $('.sidebar-left .sidebar-body').toggle('slide');
    thisEl.hide();
    applyMargins();
  });

  $(window).on("resize", applyMargins);

  // Configurar eventos de filtros
  $('#filter-form').on('submit', function(e) {
    e.preventDefault();
    applyFilters();
  });

  $('#reset-filters').on('click', function() {
    $('#filter-type').val('');
    $('#filter-urgency').val('');
    // Recargar todos los datos
    vectorSource.clear();
    loadGeoJSONData().then(function(features) {
      features.forEach(function(featureData) {
        var coords = featureData.geometry.coordinates;
        var props = featureData.properties;
        
        var feature = new ol.Feature({
          geometry: new ol.geom.Point(ol.proj.fromLonLat([coords[0], coords[1]])),
          tipo_afectacion: props.tipo_afectacion,
          nivel_danio: props.nivel_danio,
          altura_agua: props.altura_agua,
          fecha_evento: props.fecha_evento,
          comentarios: props.comentarios,
          estado_validacion: props.estado_validacion,
          foto_evento: props.foto_evento,
          urgency: getUrgencyFromDamageLevel(props.nivel_danio)
        });
        
        vectorSource.addFeature(feature);
      });
      updateStatistics();
    });
        // Configurar búsqueda de ubicación
    $('#search-form').on('submit', function(e) {
        e.preventDefault();
        const query = $('#search-input').val().trim();
        searchLocation(query);
    });

    // Botón para buscar ubicación actual
    $('#current-location-btn').on('click', function() {
        searchCurrentLocation();
    });

    // Autocompletar en la búsqueda (opcional)
    $('#search-input').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            e.preventDefault();
            const query = $(this).val().trim();
            searchLocation(query);
        }
    });
  });

  // Configurar botón de formulario Kobo
  $('#open-kobo-form').on('click', function() {
    window.open('https://ee.kobotoolbox.org/x/WpH0FcYu');
  });

  applyInitialUIState();
  applyMargins();
});

// Función para geocodificar una dirección usando Nominatim
function searchLocation(query) {
    console.log("🔍 Buscando:", query);
    
    if (!query || query.trim() === '') {
        alert('Por favor ingresa una ubicación para buscar');
        return;
    }

    // Mostrar loading
    $('body').append('<div class="loading-message">Buscando ubicación...</div>');

    // Usar Nominatim para geocodificación
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            $('.loading-message').remove();
            
            if (data && data.length > 0) {
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lon = parseFloat(result.lon);
                
                console.log("📍 Resultado encontrado:", result.display_name, lat, lon);
                
                // Mover el mapa a la ubicación encontrada
                map.getView().animate({
                    center: ol.proj.fromLonLat([lon, lat]),
                    zoom: 15,
                    duration: 1000
                });
                
                // Añadir un marcador temporal
                addTemporaryMarker(lon, lat, result.display_name);
                
            } else {
                alert('No se encontró la ubicación: ' + query);
            }
        })
        .catch(error => {
            $('.loading-message').remove();
            console.error('Error en búsqueda:', error);
            alert('Error al buscar la ubicación. Intenta nuevamente.');
        });
}

// Función para añadir marcador temporal en la búsqueda
function addTemporaryMarker(lon, lat, name) {
    // Remover marcador anterior si existe
    if (window.tempMarker) {
        map.removeLayer(window.tempMarker);
    }
    
    const markerSource = new ol.source.Vector();
    const markerLayer = new ol.layer.Vector({
        source: markerSource,
        style: new ol.style.Style({
            image: new ol.style.Circle({
                radius: 10,
                fill: new ol.style.Fill({color: '#3498db'}),
                stroke: new ol.style.Stroke({
                    color: '#2c3e50',
                    width: 3
                })
            })
        })
    });
    
    const marker = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat])),
        name: name
    });
    
    markerSource.addFeature(marker);
    map.addLayer(markerLayer);
    
    // Guardar referencia para poder removerlo después
    window.tempMarker = markerLayer;
    
    // Remover el marcador después de 5 segundos
    setTimeout(() => {
        if (window.tempMarker) {
            map.removeLayer(window.tempMarker);
            window.tempMarker = null;
        }
    }, 5000);
    
    // Crear popup para el marcador temporal
    const overlay = new ol.Overlay({
        element: document.createElement('div'),
        positioning: 'bottom-center',
        stopEvent: false
    });
    
    overlay.getElement().innerHTML = `
        <div class="popup-content" style="background: white; padding: 10px; border-radius: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
            <strong>📍 ${name}</strong>
        </div>
    `;
    
    map.addOverlay(overlay);
    overlay.setPosition(ol.proj.fromLonLat([lon, lat]));
    
    // Remover el popup después de 3 segundos
    setTimeout(() => {
        map.removeOverlay(overlay);
    }, 3000);
}

// Función para buscar usando la ubicación actual del usuario
function searchCurrentLocation() {
    if (!navigator.geolocation) {
        alert('La geolocalización no es soportada por este navegador');
        return;
    }

    $('body').append('<div class="loading-message">Obteniendo tu ubicación...</div>');

    navigator.geolocation.getCurrentPosition(
        function(position) {
            $('.loading-message').remove();
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            console.log("📍 Ubicación actual:", lat, lon);
            
            // Mover el mapa a la ubicación actual
            map.getView().animate({
                center: ol.proj.fromLonLat([lon, lat]),
                zoom: 15,
                duration: 1000
            });
            
            // Añadir marcador temporal
            addTemporaryMarker(lon, lat, 'Tu ubicación actual');
            
        },
        function(error) {
            $('.loading-message').remove();
            console.error('Error geolocalización:', error);
            let message = 'Error al obtener la ubicación: ';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    message += 'Permiso denegado';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message += 'Ubicación no disponible';
                    break;
                case error.TIMEOUT:
                    message += 'Tiempo de espera agotado';
                    break;
                default:
                    message += 'Error desconocido';
            }
            alert(message);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
}