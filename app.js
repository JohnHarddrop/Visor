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
function createPopupContent(feature) {
  var props = feature.getProperties();
  var content = `
    <div class="popup-content">
      <h5>Detalles del Reporte</h5>
      <p><strong>Tipo:</strong> ${props.tipo_afectacion || 'No especificado'}</p>
      <p><strong>Fecha:</strong> ${props.fecha_evento || 'No especificada'}</p>
      <p><strong>Nivel de daño:</strong> ${props.nivel_danio || 'No especificado'}</p>
      <p><strong>Altura agua:</strong> ${props.altura_agua || 'No especificado'} cm</p>
      <p><strong>Urgencia:</strong> <span style="color: ${getColorByUrgency(props.urgency)}">${props.urgency}</span></p>
      <p><strong>Comentarios:</strong> ${props.comentarios || 'Sin comentarios'}</p>
      <p><strong>Estado:</strong> ${props.estado_validacion || 'No especificado'}</p>
  `;
  
  if (props.foto_evento) {
    content += `<p><strong>Foto:</strong> ${props.foto_evento}</p>`;
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
  
  var inundacionVereda = features.filter(f => f.get('tipo_afectacion') === "inundacion_vereda").length;
  var inundacionCalle = features.filter(f => f.get('tipo_afectacion') === "inundacion_calle").length;
  var inundacionVivienda = features.filter(f => f.get('tipo_afectacion') === "inundacion_vivienda").length;
  
  // Actualizar la interfaz
  $('#total-reports').text(totalReports);
  $('#high-urgency').text(highUrgency);
  $('#medium-urgency').text(mediumUrgency);
  $('#low-urgency').text(lowUrgency);
  $('#inundacion-vereda').text(inundacionVereda);
  $('#inundacion-calle').text(inundacionCalle);
  $('#inundacion-vivienda').text(inundacionVivienda);
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
  });

  // Configurar botón de formulario Kobo
  $('#open-kobo-form').on('click', function() {
    window.open('https://ee.kobotoolbox.org/x/WpH0FcYu');
  });

  applyInitialUIState();
  applyMargins();
});