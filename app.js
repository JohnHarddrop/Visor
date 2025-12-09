// Variables globales
var map;
var vectorSource;
var vectorLayer;
var geoJsonData = [];
var currentOverlay = null;

// ============================================
// FUNCIONES DE INTERFAZ Y SIDEBAR
// ============================================

function applyMargins() {
    var leftToggler = $(".mini-submenu-left");
    var sidebar = $(".sidebar-left");
    var mapElement = $("#map");
    
    // Si estamos en móvil y sidebar está abierta
    if (window.innerWidth <= 768) {
        if (sidebar.hasClass('open')) {
            mapElement.css("margin-left", "0");
        } else {
            mapElement.css("margin-left", "0");
        }
    } 
    // Si estamos en escritorio
    else {
        if (leftToggler.is(":visible") || sidebar.hasClass('closed')) {
            mapElement.css("margin-left", "0");
        } else {
            var sidebarWidth = sidebar.width();
            mapElement.css("margin-left", sidebarWidth + "px");
        }
    }
}

function isConstrained() {
    return window.innerWidth <= 768;
}

function applyInitialUIState() {
    if (isConstrained()) {
        $(".sidebar-left").addClass('closed');
        $('.mini-submenu-left').show();
    } else {
        $(".sidebar-left").removeClass('closed open');
        $('.mini-submenu-left').hide();
    }
    applyMargins();
}

function checkScreenSize() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    
    console.log("📱 Tamaño de pantalla:", width, "x", height);
    
    if (width <= 768) {
        // Pantalla móvil: sidebar oculta por defecto
        $('.sidebar-left').removeClass('open').addClass('closed');
        $('.mini-submenu-left').show();
        $('#map').css('margin-left', '0');
    } else {
        // Pantalla de escritorio: sidebar visible
        $('.sidebar-left').removeClass('closed open');
        $('.mini-submenu-left').hide();
        
        if (width <= 1024) {
            $('.sidebar-left').css('width', '300px');
            $('#map').css('margin-left', '300px');
        } else {
            $('.sidebar-left').css('width', '350px');
            $('#map').css('margin-left', '350px');
        }
    }
    
    // Ajustar altura de los paneles según altura disponible
    var availableHeight = height - 100;
    $('.panel-body').css('max-height', Math.min(availableHeight * 0.8, 400) + 'px');
}

function toggleSidebar() {
    var sidebar = $('.sidebar-left');
    var toggler = $('.mini-submenu-left i');
    
    if (window.innerWidth <= 768) {
        if (sidebar.hasClass('open')) {
            sidebar.removeClass('open').addClass('closed');
            toggler.removeClass('fa-times').addClass('fa-bars');
        } else {
            sidebar.removeClass('closed').addClass('open');
            toggler.removeClass('fa-bars').addClass('fa-times');
        }
        applyMargins();
    }
}

// ============================================
// FUNCIONES DE CARGA DE DATOS
// ============================================

function loadGeoJSONData() {
    console.log("🔄 Iniciando carga de GeoJSON...");
    
    // Mostrar mensaje de carga
    $('body').append('<div class="loading-message">Cargando datos de marejadas...</div>');
    
    // Intentar cargar primero el archivo NUEVO, luego el original como respaldo
    return Promise.any([
        fetch('data/marejadas_NUEVA.geojson'),
        fetch('data/marejadas.geojson')
    ])
    .then(response => {
        console.log("📡 Respuesta del servidor:", response.status, response.statusText, response.url);
        
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
        
        var errorMsg = `Error al cargar los datos: ${error.message}\n\n` +
                      `Verifica que:\n` +
                      `• El archivo data/marejadas_NUEVA.geojson exista\n` +
                      `• O que data/marejadas.geojson exista\n` +
                      `• La ruta sea correcta\n` +
                      `• El formato del GeoJSON sea válido`;
        
        alert(errorMsg);
        return [];
    });
}

// ============================================
// FUNCIONES DE MAPEO Y ESTILOS
// ============================================

function getUrgencyFromDamageLevel(nivelDanio) {
    if (!nivelDanio) return "Bajo";
    
    nivelDanio = nivelDanio.toString();
    switch(nivelDanio) {
        case "3": return "Alto";
        case "2": return "Medio";
        case "1": return "Bajo";
        default: return "Bajo";
    }
}

function getColorByUrgency(urgency) {
    switch(urgency) {
        case 'Alto': return '#e74c3c';
        case 'Medio': return '#f39c12';
        case 'Bajo': return '#f1c40f';
        default: return '#95a5a6';
    }
}

function createStyle(feature) {
    var urgency = feature.get('urgency');
    var color = getColorByUrgency(urgency);
    
    return new ol.style.Style({
        image: new ol.style.Circle({
            radius: 10,
            fill: new ol.style.Fill({color: color}),
            stroke: new ol.style.Stroke({
                color: '#2c3e50',
                width: 2
            })
        })
    });
}

function createPopupContent(feature) {
    var props = feature.getProperties();
    
    // Mapear valores a nombres legibles
    var tipoLugarMap = {
        'calzada': 'Calzada',
        'vereda': 'Vereda',
        'playa': 'Playa',
        'vivienda': 'Vivienda',
        'infraestructura': 'Infraestructura',
        'otro': 'Otro'
    };
    
    var categoriaMap = {
        'N_plus': 'N+',
        'N': 'N',
        'N_minus': 'N-'
    };
    
    var profundidadMap = {
        'debajo_tobillo': 'Debajo del tobillo',
        'sobre_tobillo': 'Sobre el tobillo',
        'rodilla': 'Hasta la rodilla',
        'sobre_rodilla': 'Sobre la rodilla'
    };
    
    var lluviaMap = {
        'no_lluvia': 'Sin lluvia',
        'lluvia_leve': 'Lluvia leve',
        'lluvia_moderada': 'Lluvia moderada',
        'lluvia_intensa': 'Lluvia intensa'
    };
    
    var mareaMap = {
        'alta': 'Alta',
        'media': 'Media',
        'baja': 'Baja'
    };
    
    var usuarioMap = {
        'residente_principal': 'Residente principal',
        'residente_secundario': 'Residente secundario',
        'turista': 'Turista',
        'autoridad': 'Autoridad',
        'otro': 'Otro'
    };
    
    var tenenciaMap = {
        'propietario': 'Propietario',
        'arrendatario': 'Arrendatario',
        'usuario': 'Usuario',
        'visitante': 'Visitante',
        'otro': 'Otro'
    };
    
    var impactoMap = {
        'sin_impacto': 'Sin impacto',
        'impacto_leve': 'Impacto leve',
        'impacto_moderado': 'Impacto moderado',
        'impacto_severo': 'Impacto severo'
    };
    
    var tipoLugarDisplay = tipoLugarMap[props.tipo_lugar] || props.tipo_lugar || 'No especificado';
    var categoriaDisplay = categoriaMap[props.categoria_marejada] || props.categoria_marejada || 'No especificado';
    
    // Formatear fecha y hora
    var fechaDisplay = props.fecha_evento || 'No especificada';
    var horaDisplay = 'No especificada';
    if (props.hora_evento) {
        if (props.hora_evento.includes('T')) {
            horaDisplay = props.hora_evento.split('T')[1].substring(0, 5);
        } else if (props.hora_evento.includes(':')) {
            horaDisplay = props.hora_evento.substring(0, 5);
        }
    }
    
    // Preparar comentarios (limitar longitud)
    var comentariosDisplay = props.comentarios || 'Sin comentarios';
    if (comentariosDisplay.length > 100) {
        comentariosDisplay = comentariosDisplay.substring(0, 100) + '...';
    }
    
    var content = `
        <div class="popup-content">
            <h5 style="margin-top: 0; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px;">Detalles del Reporte</h5>
            <div style="display: grid; grid-template-columns: 1fr; gap: 6px; font-size: 13px;">
                <div><strong>📍 Tipo de lugar:</strong> ${tipoLugarDisplay}</div>
                <div><strong>📅 Fecha evento:</strong> ${fechaDisplay}</div>
                <div><strong>🕒 Hora evento:</strong> ${horaDisplay}</div>
                <div><strong>🌊 Categoría marejada:</strong> ${categoriaDisplay}</div>
                <div><strong>📏 Altura agua:</strong> ${props.altura_agua_cm || '0'} cm</div>
                <div><strong>💧 Profundidad:</strong> ${profundidadMap[props.clase_profundidad] || props.clase_profundidad || 'No especificado'}</div>
                <div><strong>🌧️ Lluvia:</strong> ${lluviaMap[props.lluvia] || props.lluvia || 'No especificado'}</div>
                <div><strong>🌊 Marea:</strong> ${mareaMap[props.marea] || props.marea || 'No especificado'}</div>
                <div><strong>⚠️ Nivel de daño:</strong> ${props.nivel_danio || '1'}</div>
                <div><strong>👤 Tipo usuario:</strong> ${usuarioMap[props.tipo_usuario] || props.tipo_usuario || 'No especificado'}</div>
                <div><strong>🏠 Tenencia:</strong> ${tenenciaMap[props.tenencia] || props.tenencia || 'No especificado'}</div>
                <div><strong>💥 Impacto actividad:</strong> ${impactoMap[props.impacto_actividad] || props.impacto_actividad || 'No especificado'}</div>
                <div><strong>🚨 Urgencia:</strong> <span style="color: ${getColorByUrgency(props.urgency)}; font-weight: bold;">${props.urgency || 'Bajo'}</span></div>
                <div><strong>💬 Comentarios:</strong> ${comentariosDisplay}</div>
            </div>
    `;
    
    // Mostrar imagen si está disponible
    if (props.foto_high_quality_url) {
        content += `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;">
                <strong>📸 Foto:</strong><br>
                <img src="${props.foto_high_quality_url}" alt="Foto del evento" 
                     style="max-width: 100%; height: auto; margin-top: 5px; border-radius: 5px; border: 1px solid #ddd;"
                     onerror="this.style.display='none';">
            </div>
        `;
    } else if (props.foto_evento && props.foto_evento !== "No especificado") {
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

// ============================================
// FUNCIONES DE FILTRADO
// ============================================

function applyFilters() {
    var tipoLugarFilter = $('#filter-type').val();
    var categoriaFilter = $('#filter-category').val();
    var lluviaFilter = $('#filter-rain').val();
    var urgenciaFilter = $('#filter-urgency').val();
    
    console.log("🔍 Aplicando filtros:", {
        tipoLugar: tipoLugarFilter,
        categoria: categoriaFilter,
        lluvia: lluviaFilter,
        urgencia: urgenciaFilter
    });
    
    // Si todos los filtros están vacíos, mostrar todos los datos
    if (!tipoLugarFilter && !categoriaFilter && !lluviaFilter && !urgenciaFilter) {
        resetToAllData();
        return;
    }
    
    // Filtrar características
    var filteredFeatures = vectorSource.getFeatures().filter(function(feature) {
        var tipoLugar = feature.get('tipo_lugar');
        var categoria = feature.get('categoria_marejada');
        var lluvia = feature.get('lluvia');
        var urgencia = feature.get('urgency');
        
        var tipoLugarMatch = !tipoLugarFilter || tipoLugar === tipoLugarFilter;
        var categoriaMatch = !categoriaFilter || categoria === categoriaFilter;
        var lluviaMatch = !lluviaFilter || lluvia === lluviaFilter;
        var urgenciaMatch = !urgenciaFilter || urgencia === urgenciaFilter;
        
        return tipoLugarMatch && categoriaMatch && lluviaMatch && urgenciaMatch;
    });
    
    console.log("📊 Resultados del filtro:", filteredFeatures.length, "de", vectorSource.getFeatures().length);
    
    // Actualizar la fuente con características filtradas
    vectorSource.clear();
    vectorSource.addFeatures(filteredFeatures);
    
    // Actualizar estadísticas
    updateStatistics();
}

function resetToAllData() {
    console.log("🔄 Restableciendo todos los datos");
    
    // Limpiar la fuente actual
    vectorSource.clear();
    
    // Volver a cargar todos los datos originales
    geoJsonData.forEach(function(featureData) {
        var coords = featureData.geometry.coordinates;
        var props = featureData.properties;
        
        var feature = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat([coords[0], coords[1]])),
            // Campos principales de la nueva encuesta
            tipo_lugar: props.tipo_lugar,
            categoria_marejada: props.categoria_marejada,
            altura_agua_cm: props.altura_agua_cm,
            clase_profundidad: props.clase_profundidad,
            lluvia: props.lluvia,
            marea: props.marea,
            nivel_danio: props.nivel_danio,
            tipo_usuario: props.tipo_usuario,
            tenencia: props.tenencia,
            impacto_actividad: props.impacto_actividad,
            fecha_evento: props.fecha_evento,
            hora_evento: props.hora_evento,
            comentarios: props.comentarios,
            foto_evento: props.foto_evento,
            foto_high_quality_url: props.foto_high_quality_url,
            urgency: getUrgencyFromDamageLevel(props.nivel_danio)
        });
        
        vectorSource.addFeature(feature);
    });
    
    // Resetear los filtros en la interfaz
    $('#filter-type').val('');
    $('#filter-category').val('');
    $('#filter-rain').val('');
    $('#filter-urgency').val('');
    
    // Actualizar estadísticas
    updateStatistics();
}

// ============================================
// FUNCIONES DE ESTADÍSTICAS
// ============================================

function updateStatistics() {
    var features = vectorSource.getFeatures();
    var totalReports = features.length;
    
    // Urgencia
    var highUrgency = features.filter(f => f.get('urgency') === "Alto").length;
    var mediumUrgency = features.filter(f => f.get('urgency') === "Medio").length;
    var lowUrgency = features.filter(f => f.get('urgency') === "Bajo").length;
    
    // Tipo de lugar
    var calzada = features.filter(f => f.get('tipo_lugar') === "calzada").length;
    var vereda = features.filter(f => f.get('tipo_lugar') === "vereda").length;
    var playa = features.filter(f => f.get('tipo_lugar') === "playa").length;
    var vivienda = features.filter(f => f.get('tipo_lugar') === "vivienda").length;
    var infraestructura = features.filter(f => f.get('tipo_lugar') === "infraestructura").length;
    var otro = features.filter(f => f.get('tipo_lugar') === "otro").length;
    
    // Categoría marejada
    var nPlus = features.filter(f => f.get('categoria_marejada') === "N_plus").length;
    var nNormal = features.filter(f => f.get('categoria_marejada') === "N").length;
    var nMinus = features.filter(f => f.get('categoria_marejada') === "N_minus").length;
    
    // Lluvia
    var noLluvia = features.filter(f => f.get('lluvia') === "no_lluvia").length;
    var lluviaLeve = features.filter(f => f.get('lluvia') === "lluvia_leve").length;
    var lluviaModerada = features.filter(f => f.get('lluvia') === "lluvia_moderada").length;
    var lluviaIntensa = features.filter(f => f.get('lluvia') === "lluvia_intensa").length;
    
    // Actualizar la interfaz
    $('#total-reports').text(totalReports);
    $('#high-urgency').text(highUrgency);
    $('#medium-urgency').text(mediumUrgency);
    $('#low-urgency').text(lowUrgency);
    
    $('#tipo-calzada').text(calzada);
    $('#tipo-vereda').text(vereda);
    $('#tipo-playa').text(playa);
    $('#tipo-vivienda').text(vivienda);
    $('#tipo-infraestructura').text(infraestructura);
    $('#tipo-otro').text(otro);
    
    $('#categoria-n-plus').text(nPlus);
    $('#categoria-n').text(nNormal);
    $('#categoria-n-minus').text(nMinus);
    
    $('#lluvia-no').text(noLluvia);
    $('#lluvia-leve').text(lluviaLeve);
    $('#lluvia-moderada').text(lluviaModerada);
    $('#lluvia-intensa').text(lluviaIntensa);
}

// ============================================
// FUNCIONES DEL MAPA
// ============================================

function initializeMapWithData(features) {
    if (features.length === 0) {
        alert('No hay datos para mostrar. El mapa se inicializará vacío.');
        // Inicializar mapa vacío centrado en una ubicación por defecto
        initializeEmptyMap();
        return;
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
            center: ol.proj.fromLonLat([-73.179626, -37.025243]), // Centrado en el primer dato
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
            // Campos principales de la nueva encuesta
            tipo_lugar: props.tipo_lugar,
            categoria_marejada: props.categoria_marejada,
            altura_agua_cm: props.altura_agua_cm,
            clase_profundidad: props.clase_profundidad,
            lluvia: props.lluvia,
            marea: props.marea,
            nivel_danio: props.nivel_danio,
            tipo_usuario: props.tipo_usuario,
            tenencia: props.tenencia,
            impacto_actividad: props.impacto_actividad,
            fecha_evento: props.fecha_evento,
            hora_evento: props.hora_evento,
            comentarios: props.comentarios,
            foto_evento: props.foto_evento,
            foto_high_quality_url: props.foto_high_quality_url,
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
    
    currentOverlay = overlay;

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
    
    // Ajustar vista para mostrar todos los puntos si hay más de uno
    if (features.length > 1) {
        setTimeout(function() {
            var extent = vectorSource.getExtent();
            if (extent && extent[0] !== Infinity) {
                map.getView().fit(extent, {
                    padding: [50, 50, 50, 50],
                    maxZoom: 15
                });
            }
        }, 500);
    }
}

function initializeEmptyMap() {
    map = new ol.Map({
        target: "map",
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            })
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([-71.626963, -33.038295]),
            zoom: 15
        })
    });
}

// ============================================
// FUNCIONES DE BÚSQUEDA Y GEOLOCALIZACIÓN
// ============================================

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
    
    // Remover el marcador y popup después de 5 segundos
    setTimeout(() => {
        if (window.tempMarker) {
            map.removeLayer(window.tempMarker);
            window.tempMarker = null;
        }
        map.removeOverlay(overlay);
    }, 5000);
}

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

// ============================================
// INICIALIZACIÓN PRINCIPAL
// ============================================

$(function(){
    // Inicializar tamaño de pantalla
    checkScreenSize();
    
    // Cargar datos GeoJSON primero
    loadGeoJSONData().then(function(features) {
        initializeMapWithData(features);
    });

    // Configuración del sidebar
    $('.sidebar-left .slide-submenu').on('click',function() {
        var thisEl = $(this);
        thisEl.closest('.sidebar-body').fadeOut('slide',function(){
            $('.mini-submenu-left').fadeIn();
            $('.sidebar-left').addClass('closed');
            applyMargins();
        });
    });

    $('.mini-submenu-left').on('click',function() {
        toggleSidebar();
    });

    $(window).on("resize", function() {
        checkScreenSize();
        applyMargins();
    });

    // Configurar eventos de filtros
    $('#filter-form').on('submit', function(e) {
        e.preventDefault();
        applyFilters();
    });

    $('#reset-filters').on('click', function() {
        console.log("Limpiando filtros");
        resetToAllData();
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

    // Autocompletar en la búsqueda
    $('#search-input').on('keypress', function(e) {
        if (e.which === 13) {
            e.preventDefault();
            const query = $(this).val().trim();
            searchLocation(query);
        }
    });

    // Configurar botón de formulario Kobo
    $('#open-kobo-form').on('click', function() {
        window.open('https://ee.kobotoolbox.org/vs93MIxk');
    });

    applyInitialUIState();
    applyMargins();
});