// ============================================
// VARIABLES GLOBALES
// ============================================
var map;
var vectorSource;
var vectorLayer;
var geoJsonData = [];
var currentOverlay = null;
var heatmapLayer = null;
var charts = {}; // Almacenar instancias de gráficos

// ============================================
// FUNCIONES DE INTERFAZ Y SIDEBAR
// ============================================

function applyMargins() {
    var sidebar = $(".sidebar-left");
    var mapElement = $("#map");
    
    if (window.innerWidth <= 768) {
        if (sidebar.hasClass('expanded')) {
            mapElement.css("margin-left", "0");
        } else {
            mapElement.css("margin-left", "0");
        }
    } else {
        if (sidebar.hasClass('collapsed')) {
            mapElement.css("margin-left", "0");
        } else {
            var sidebarWidth = sidebar.width();
            mapElement.css("margin-left", sidebarWidth + "px");
        }
    }
}

function checkScreenSize() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    
    if (width <= 768) {
        $('.sidebar-left').removeClass('expanded').addClass('collapsed');
        $('.sidebar-toggle-btn').css('left', '10px');
        $('#map').css('margin-left', '0');
    } else {
        $('.sidebar-left').removeClass('collapsed').addClass('expanded');
        $('.sidebar-toggle-btn').css('left', 'calc(350px - 42px - 10px)');
        
        if (width <= 1024) {
            $('.sidebar-left').css('width', '300px');
            $('#map').css('margin-left', '300px');
            $('.sidebar-toggle-btn').css('left', 'calc(300px - 42px - 10px)');
        } else {
            $('.sidebar-left').css('width', '350px');
            $('#map').css('margin-left', '350px');
            $('.sidebar-toggle-btn').css('left', 'calc(350px - 42px - 10px)');
        }
    }
    
    var availableHeight = height - 100;
    $('.panel-body').css('max-height', Math.min(availableHeight * 0.8, 400) + 'px');
}

function toggleSidebar() {
    var sidebar = $('.sidebar-left');
    var toggleBtn = $('.sidebar-toggle-btn i');
    
    if (window.innerWidth <= 768) {
        if (sidebar.hasClass('expanded')) {
            sidebar.removeClass('expanded').addClass('collapsed');
            toggleBtn.removeClass('fa-times').addClass('fa-bars');
        } else {
            sidebar.removeClass('collapsed').addClass('expanded');
            toggleBtn.removeClass('fa-bars').addClass('fa-times');
        }
    } else {
        if (sidebar.hasClass('collapsed')) {
            sidebar.removeClass('collapsed').addClass('expanded');
            toggleBtn.removeClass('fa-bars').addClass('fa-times');
        } else {
            sidebar.removeClass('expanded').addClass('collapsed');
            toggleBtn.removeClass('fa-times').addClass('fa-bars');
        }
    }
    applyMargins();
}

// ============================================
// FUNCIONES DE CARGA DE DATOS
// ============================================

function loadGeoJSONData() {
    console.log("🔄 Iniciando carga de GeoJSON...");
    
    $('body').append('<div class="loading-message">Cargando datos de marejadas...</div>');
    
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

function getColorByDamageLevel(nivelDanio) {
    if (!nivelDanio) return '#2ecc71';
    
    nivelDanio = nivelDanio.toString();
    switch(nivelDanio) {
        case "3": return '#e74c3c';
        case "2": return '#f39c12';
        case "1": return '#2ecc71';
        default: return '#2ecc71';
    }
}

function getColorByLocationType(tipoLugar) {
    var colorMap = {
        'vereda': '#3498db',
        'calzada_calle': '#9b59b6',
        'interior_vivienda': '#e67e22',
        'interior_comercio': '#1abc9c',
        'espacio_publico': '#d35400',
        'infraestructura': '#c0392b',
        'playa': '#16a085',
        'otro': '#95a5a6'
    };
    return colorMap[tipoLugar] || '#95a5a6';
}

function getColorByWaveCategory(categoria) {
    var colorMap = {
        'N': '#27ae60',
        'N_plus': '#f1c40f',
        'M1': '#e67e22',
        'M2': '#d35400',
        'M3': '#c0392b',
        'M4': '#8e44ad',
        'M5': '#2c3e50'
    };
    return colorMap[categoria] || '#95a5a6';
}

function createStyle(feature, styleType = 'damage') {
    var color;
    
    switch(styleType) {
        case 'damage':
            color = getColorByDamageLevel(feature.get('nivel_danio'));
            break;
        case 'location':
            color = getColorByLocationType(feature.get('tipo_lugar'));
            break;
        case 'wave':
            color = getColorByWaveCategory(feature.get('categoria_marejada'));
            break;
        default:
            color = getColorByDamageLevel(feature.get('nivel_danio'));
    }
    
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

// ============================================
// FUNCIONES DE POPUP
// ============================================

function createPopupContent(feature) {
    var props = feature.getProperties();
    
    // Mapear valores a nombres legibles
    var tipoLugarMap = {
        'vereda': 'Vereda',
        'calzada_calle': 'Calzada o calle',
        'interior_vivienda': 'Interior de vivienda',
        'interior_comercio': 'Interior de comercio o servicio',
        'espacio_publico': 'Espacio público costero',
        'infraestructura': 'Infraestructura crítica',
        'playa': 'Playa o sector de roqueríos',
        'otro': 'Otro'
    };
    
    var categoriaMap = {
        'N': 'N — Oleaje normal',
        'N_plus': 'N+ — Oleaje fuerte',
        'M1': 'M1 — Categoría 1',
        'M2': 'M2 — Categoría 2',
        'M3': 'M3 — Categoría 3',
        'M4': 'M4 — Categoría 4',
        'M5': 'M5 — Categoría 5'
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
        'marea_baja': 'Marea baja',
        'marea_media': 'Marea media',
        'marea_alta': 'Marea alta',
        'no_sabe': 'No sabe'
    };
    
    var afectacionMap = {
        'inundacion_vereda': 'Inundación de vereda',
        'inundacion_calle': 'Inundación de calle o vía',
        'inundacion_vivienda': 'Inundación de vivienda',
        'inundacion_comercio': 'Inundación de comercio o servicio',
        'danio_infraestructura': 'Daño a infraestructura',
        'erosion': 'Erosión o socavación',
        'arrastre': 'Arrastre de objetos o vehículos',
        'salpicaduras': 'Salpicaduras sin inundación significativa'
    };
    
    var usuarioMap = {
        'residente_permanente': 'Residente permanente',
        'residente_temporal': 'Residente temporal o segunda vivienda',
        'turista': 'Turista o visitante',
        'trabajador': 'Trabajador o comerciante',
        'otro': 'Otro'
    };
    
    var tenenciaMap = {
        'propietario': 'Propietario',
        'arrendatario': 'Arrendatario',
        'no_aplica': 'No aplica',
        'otro': 'Otro'
    };
    
    var impactoMap = {
        'sin_impacto': 'Sin impacto relevante',
        'impacto_leve': 'Demoras o ajustes leves',
        'impacto_moderado': 'Suspensión temporal de actividades',
        'impacto_severo': 'Cierre prolongado o impactos mayores'
    };
    
    var tipoLugarDisplay = tipoLugarMap[props.tipo_lugar] || props.tipo_lugar || 'No especificado';
    var categoriaDisplay = categoriaMap[props.categoria_marejada] || props.categoria_marejada || 'No especificado';
    var afectacionDisplay = afectacionMap[props.tipo_afectacion_principal] || props.tipo_afectacion_principal || 'No especificado';
    
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
    
    // Preparar comentarios
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
                <div><strong>⚠️ Afectación principal:</strong> ${afectacionDisplay}</div>
                <div><strong>🔴 Nivel de daño:</strong> ${props.nivel_danio || '1'}</div>
                <div><strong>👤 Tipo observador:</strong> ${usuarioMap[props.tipo_usuario] || props.tipo_usuario || 'No especificado'}</div>
                <div><strong>🏠 Tenencia:</strong> ${tenenciaMap[props.tenencia] || props.tenencia || 'No especificado'}</div>
                <div><strong>💥 Impacto actividad:</strong> ${impactoMap[props.impacto_actividad] || props.impacto_actividad || 'No especificado'}</div>
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
    }
    
    content += `</div>`;
    return content;
}

// ============================================
// FUNCIONES DE FILTRADO
// ============================================

function applyFilters() {
    var tipoLugarFilter = $('#filter-location').val();
    var categoriaFilter = $('#filter-wave').val();
    var lluviaFilter = $('#filter-rain').val();
    var mareaFilter = $('#filter-tide').val();
    var danioFilter = $('#filter-damage').val();
    var afectacionFilter = $('#filter-affectation').val();
    
    console.log("🔍 Aplicando filtros:", {
        tipoLugar: tipoLugarFilter,
        categoria: categoriaFilter,
        lluvia: lluviaFilter,
        marea: mareaFilter,
        danio: danioFilter,
        afectacion: afectacionFilter
    });
    
    // Si todos los filtros están vacíos, mostrar todos los datos
    if (!tipoLugarFilter && !categoriaFilter && !lluviaFilter && 
        !mareaFilter && !danioFilter && !afectacionFilter) {
        resetToAllData();
        return;
    }
    
    // Filtrar características
    var filteredFeatures = vectorSource.getFeatures().filter(function(feature) {
        var tipoLugar = feature.get('tipo_lugar');
        var categoria = feature.get('categoria_marejada');
        var lluvia = feature.get('lluvia');
        var marea = feature.get('marea');
        var danio = feature.get('nivel_danio');
        var afectacion = feature.get('tipo_afectacion_principal');
        
        var tipoLugarMatch = !tipoLugarFilter || tipoLugar === tipoLugarFilter;
        var categoriaMatch = !categoriaFilter || categoria === categoriaFilter;
        var lluviaMatch = !lluviaFilter || lluvia === lluviaFilter;
        var mareaMatch = !mareaFilter || marea === mareaFilter;
        var danioMatch = !danioFilter || danio === danioFilter;
        var afectacionMatch = !afectacionFilter || afectacion === afectacionFilter;
        
        return tipoLugarMatch && categoriaMatch && lluviaMatch && 
               mareaMatch && danioMatch && afectacionMatch;
    });
    
    console.log("📊 Resultados del filtro:", filteredFeatures.length, "de", vectorSource.getFeatures().length);
    
    // Actualizar la fuente con características filtradas
    vectorSource.clear();
    vectorSource.addFeatures(filteredFeatures);
    
    // Actualizar estadísticas y gráficos
    updateStatistics();
    updateCharts();
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
            tipo_lugar: props.tipo_lugar,
            categoria_marejada: props.categoria_marejada,
            altura_agua_cm: props.altura_agua_cm,
            clase_profundidad: props.clase_profundidad,
            lluvia: props.lluvia,
            marea: props.marea,
            tipo_afectacion_principal: props.tipo_afectacion_principal,
            nivel_danio: props.nivel_danio,
            tipo_usuario: props.tipo_usuario,
            tenencia: props.tenencia,
            impacto_actividad: props.impacto_actividad,
            fecha_evento: props.fecha_evento,
            hora_evento: props.hora_evento,
            comentarios: props.comentarios,
            foto_evento: props.foto_evento,
            foto_high_quality_url: props.foto_high_quality_url
        });
        
        vectorSource.addFeature(feature);
    });
    
    // Resetear los filtros en la interfaz
    $('#filter-location').val('');
    $('#filter-wave').val('');
    $('#filter-rain').val('');
    $('#filter-tide').val('');
    $('#filter-damage').val('');
    $('#filter-affectation').val('');
    
    // Actualizar estadísticas y gráficos
    updateStatistics();
    updateCharts();
}

// ============================================
// FUNCIONES DE ESTADÍSTICAS DINÁMICAS
// ============================================

function calculateStatistics() {
    var features = vectorSource.getFeatures();
    var stats = {
        total: features.length,
        
        // Por nivel de daño
        danio: {
            leve: features.filter(f => f.get('nivel_danio') === "1").length,
            moderado: features.filter(f => f.get('nivel_danio') === "2").length,
            severo: features.filter(f => f.get('nivel_danio') === "3").length
        },
        
        // Por categoría de marejada
        marejada: {
            N: features.filter(f => f.get('categoria_marejada') === "N").length,
            N_plus: features.filter(f => f.get('categoria_marejada') === "N_plus").length,
            M1: features.filter(f => f.get('categoria_marejada') === "M1").length,
            M2: features.filter(f => f.get('categoria_marejada') === "M2").length,
            M3: features.filter(f => f.get('categoria_marejada') === "M3").length,
            M4: features.filter(f => f.get('categoria_marejada') === "M4").length,
            M5: features.filter(f => f.get('categoria_marejada') === "M5").length
        },
        
        // Por tipo de lugar - VALORES CORREGIDOS
        lugar: {
            vereda: features.filter(f => f.get('tipo_lugar') === "vereda").length,
            calzada: features.filter(f => f.get('tipo_lugar') === "calzada").length,
            interior_vivienda: features.filter(f => f.get('tipo_lugar') === "interior_vivienda").length,
            interior_comercio: features.filter(f => f.get('tipo_lugar') === "interior_comercio").length,
            espacio_publico: features.filter(f => f.get('tipo_lugar') === "espacio_publico").length,
            infraestructura_critica: features.filter(f => f.get('tipo_lugar') === "infraestructura_critica").length,
            playa_roquerios: features.filter(f => f.get('tipo_lugar') === "playa_roquerios").length
        },
        
        // Por afectación principal - VALORES CORREGIDOS (basados en tu formulario)
        afectacion: {
            inundacion_vereda: features.filter(f => f.get('tipo_afectacion_principal') === "inundacion_vereda").length,
            inundacion_calle: features.filter(f => f.get('tipo_afectacion_principal') === "inundacion_calle").length,
            inundacion_vivienda: features.filter(f => f.get('tipo_afectacion_principal') === "inundacion_vivienda").length,
            inundacion_comercio: features.filter(f => f.get('tipo_afectacion_principal') === "inundacion_comercio").length,
            danio_infraestructura: features.filter(f => f.get('tipo_afectacion_principal') === "danio_infraestructura").length,
            erosion: features.filter(f => f.get('tipo_afectacion_principal') === "erosion").length,
            arrastre: features.filter(f => f.get('tipo_afectacion_principal') === "arrastre").length,
            salpicaduras: features.filter(f => f.get('tipo_afectacion_principal') === "salpicaduras").length
        }
    };
    
    return stats;
}

function updateStatistics() {
    var stats = calculateStatistics();
    
    // Actualizar total siempre visible
    $('#total-reports').text(stats.total);
    
    // Nivel de daño
    $('#damage-mild').text(stats.danio.leve);
    $('#damage-moderate').text(stats.danio.moderado);
    $('#damage-severe').text(stats.danio.severo);
    
    // Categorías de marejada (desagregadas)
    $('#wave-n').text(stats.marejada.N);
    $('#wave-n-plus').text(stats.marejada.N_plus);
    $('#wave-m1').text(stats.marejada.M1);
    $('#wave-m2').text(stats.marejada.M2);
    $('#wave-m3').text(stats.marejada.M3);
    $('#wave-m4').text(stats.marejada.M4);
    $('#wave-m5').text(stats.marejada.M5);
    
    // Tipos de afectación
    $('#affectation-street').text(stats.afectacion.inundacion_calle);
    $('#affectation-house').text(stats.afectacion.inundacion_vivienda);
    $('#affectation-sidewalk').text(stats.afectacion.inundacion_vereda);
    $('#affectation-commerce').text(stats.afectacion.inundacion_comercio);
    $('#affectation-infra').text(stats.afectacion.danio_infraestructura);
    $('#affectation-erosion').text(stats.afectacion.erosion);
    $('#affectation-drag').text(stats.afectacion.arrastre);
    $('#affectation-splash').text(stats.afectacion.salpicaduras);
    
    // Tipo de lugar - NOMBRES CORREGIDOS
    $('#tipo-vereda').text(stats.lugar.vereda);
    $('#tipo-calzada').text(stats.lugar.calzada);
    $('#tipo-vivienda').text(stats.lugar.interior_vivienda);
    $('#tipo-comercio').text(stats.lugar.interior_comercio);
    $('#tipo-espacio-publico').text(stats.lugar.espacio_publico);
    $('#tipo-infraestructura').text(stats.lugar.infraestructura_critica);
    $('#tipo-playa').text(stats.lugar.playa_roquerios);
    
    // Actualizar gráfico
    updateChart();
}

// ============================================
// GRÁFICOS DINÁMICOS
// ============================================

function createChart(chartId, type, data, options = {}) {
    var ctx = document.getElementById(chartId);
    if (!ctx) {
        console.error("No se encontró el canvas para el gráfico:", chartId);
        return;
    }
    
    // Destruir gráfico existente si hay uno
    if (charts[chartId]) {
        charts[chartId].destroy();
    }
    
    var defaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: data.title || ''
            }
        }
    };
    
    // Combinar opciones
    var chartOptions = {...defaultOptions, ...options};
    
    // Crear nuevo gráfico
    charts[chartId] = new Chart(ctx, {
        type: type,
        data: data,
        options: chartOptions
    });
}

function updateCharts() {
    var stats = calculateStatistics();
    var features = vectorSource.getFeatures();
    
    // Gráfico 1: Nivel de daño (Dona)
    var damageChartData = {
        labels: ['Leve (1)', 'Moderado (2)', 'Severo (3)'],
        datasets: [{
            data: [stats.danio.leve, stats.danio.moderado, stats.danio.severo],
            backgroundColor: ['#2ecc71', '#f39c12', '#e74c3c'],
            borderWidth: 1
        }],
        title: 'Distribución por Nivel de Daño'
    };
    
    // Gráfico 2: Categorías de marejada (Barras)
    var waveChartData = {
        labels: ['N', 'N+', 'M1', 'M2', 'M3', 'M4', 'M5'],
        datasets: [{
            label: 'Cantidad de Reportes',
            data: [
                stats.marejada.N,
                stats.marejada.N_plus,
                stats.marejada.M1,
                stats.marejada.M2,
                stats.marejada.M3,
                stats.marejada.M4,
                stats.marejada.M5
            ],
            backgroundColor: [
                '#27ae60', '#f1c40f', '#e67e22', 
                '#d35400', '#c0392b', '#8e44ad', '#2c3e50'
            ],
            borderWidth: 1
        }],
        title: 'Reportes por Categoría de Marejada'
    };
    
    // Gráfico 3: Tipo de lugar (Horizontal Bars)
    var locationChartData = {
        labels: [
            'Vereda', 'Calzada', 'Vivienda', 'Comercio', 
            'Esp. Público', 'Infraestructura', 'Playa'
        ],
        datasets: [{
            label: 'Cantidad de Reportes',
            data: [
                stats.lugar.vereda,
                stats.lugar.calzada_calle,
                stats.lugar.interior_vivienda,
                stats.lugar.interior_comercio,
                stats.lugar.espacio_publico,
                stats.lugar.infraestructura,
                stats.lugar.playa
            ],
            backgroundColor: [
                '#3498db', '#9b59b6', '#e67e22', '#1abc9c',
                '#d35400', '#c0392b', '#16a085'
            ],
            borderWidth: 1
        }],
        title: 'Reportes por Tipo de Lugar'
    };
    
    // Crear contenedores para gráficos si no existen
    if (!$('#charts-container').length) {
        $('.panel-body').first().append(`
            <div id="charts-container" style="margin-top: 20px;">
                <div class="chart-row">
                    <div class="chart-container">
                        <canvas id="damage-chart"></canvas>
                    </div>
                    <div class="chart-container">
                        <canvas id="wave-chart"></canvas>
                    </div>
                </div>
                <div class="chart-row">
                    <div class="chart-container full-width">
                        <canvas id="location-chart"></canvas>
                    </div>
                </div>
            </div>
        `);
        
        // Agregar CSS para gráficos
        $('head').append(`
            <style>
                .chart-row {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 15px;
                }
                .chart-container {
                    flex: 1;
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    border: 1px solid #ddd;
                    height: 250px;
                }
                .chart-container.full-width {
                    flex: 2;
                }
                .chart-container canvas {
                    width: 100% !important;
                    height: 200px !important;
                }
            </style>
        `);
    }
    
    // Crear gráficos
    createChart('damage-chart', 'doughnut', damageChartData);
    createChart('wave-chart', 'bar', waveChartData);
    createChart('location-chart', 'bar', {
        ...locationChartData,
        options: {
            indexAxis: 'y'
        }
    });
}

// ============================================
// MAPA DE CALOR (HEATMAP)
// ============================================

function createHeatmap() {
    var features = vectorSource.getFeatures();
    
    if (features.length === 0) {
        alert('No hay datos para crear el mapa de calor');
        return;
    }
    
    // Crear capa de calor
    var heatmapSource = new ol.source.Vector();
    
    features.forEach(function(feature) {
        var geometry = feature.getGeometry();
        var heatFeature = new ol.Feature({
            geometry: geometry,
            weight: 1
        });
        heatmapSource.addFeature(heatFeature);
    });
    
    // Si ya existe una capa de calor, removerla
    if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
    }
    
    heatmapLayer = new ol.layer.Heatmap({
        source: heatmapSource,
        blur: 15,
        radius: 10,
        gradient: ['#00f', '#0ff', '#0f0', '#ff0', '#f00']
    });
    
    map.addLayer(heatmapLayer);
}

function toggleHeatmap() {
    if (heatmapLayer) {
        var visible = heatmapLayer.getVisible();
        heatmapLayer.setVisible(!visible);
        return !visible;
    } else {
        createHeatmap();
        return true;
    }
}

// ============================================
// FUNCIONES DEL MAPA
// ============================================

function initializeMapWithData(features) {
    if (features.length === 0) {
        alert('No hay datos para mostrar. El mapa se inicializará vacío.');
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
            center: ol.proj.fromLonLat([-73.179626, -37.025243]),
            zoom: 15
        })
    });

    // Crear fuente vectorial y capa
    vectorSource = new ol.source.Vector();
    vectorLayer = new ol.layer.Vector({
        source: vectorSource,
        style: function(feature) {
            return createStyle(feature, 'damage'); // Por defecto muestra por daño
        }
    });
    
    map.addLayer(vectorLayer);

    // Convertir características GeoJSON a características OpenLayers
    features.forEach(function(featureData) {
        var coords = featureData.geometry.coordinates;
        var props = featureData.properties;
        
        var feature = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat([coords[0], coords[1]])),
            tipo_lugar: props.tipo_lugar,
            categoria_marejada: props.categoria_marejada,
            altura_agua_cm: props.altura_agua_cm,
            clase_profundidad: props.clase_profundidad,
            lluvia: props.lluvia,
            marea: props.marea,
            tipo_afectacion_principal: props.tipo_afectacion_principal,
            nivel_danio: props.nivel_danio,
            tipo_usuario: props.tipo_usuario,
            tenencia: props.tenencia,
            impacto_actividad: props.impacto_actividad,
            fecha_evento: props.fecha_evento,
            hora_evento: props.hora_evento,
            comentarios: props.comentarios,
            foto_evento: props.foto_evento,
            foto_high_quality_url: props.foto_high_quality_url
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

    // Actualizar estadísticas iniciales y gráficos
    updateStatistics();
    updateCharts();
    
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
// FUNCIONES DE LEYENDAS INTERCAMBIABLES
// ============================================

function changeLegend(legendType) {
    // Ocultar todas las leyendas
    $('.legend-box').hide();
    
    // Mostrar la leyenda seleccionada
    $('#' + legendType + '-legend').show();
    
    // Actualizar botones activos
    $('.legend-toggle-btn').removeClass('active');
    $('.legend-toggle-btn[data-target="' + legendType + '"]').addClass('active');
    
    // Cambiar estilo de los puntos en el mapa
    if (vectorLayer) {
        vectorLayer.setStyle(function(feature) {
            return createStyle(feature, legendType);
        });
    }
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

    $('body').append('<div class="loading-message">Buscando ubicación...</div>');

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
                
                map.getView().animate({
                    center: ol.proj.fromLonLat([lon, lat]),
                    zoom: 15,
                    duration: 1000
                });
                
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
    
    window.tempMarker = markerLayer;
    
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
            
            map.getView().animate({
                center: ol.proj.fromLonLat([lon, lat]),
                zoom: 15,
                duration: 1000
            });
            
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
    
    // Cargar datos GeoJSON
    loadGeoJSONData().then(function(features) {
        initializeMapWithData(features);
    });

    // Configuración del sidebar
    $('.sidebar-toggle-btn').on('click', function() {
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

    // Configurar botones de leyenda
    $('.legend-toggle-btn').on('click', function() {
        var target = $(this).data('target');
        changeLegend(target);
    });

    // Botón para mapa de calor
    $('#heatmap-toggle').on('click', function() {
        var isActive = toggleHeatmap();
        $(this).text(isActive ? 'Desactivar Mapa de Calor' : 'Activar Mapa de Calor');
    });

    applyMargins();
    
    // Asegurar que el botón de sidebar sea visible
    $('.sidebar-toggle-btn').show();
    // ============================================
// CORRECCIÓN PARA SEARCH BAR
// ============================================

function initializeSearchBar() {
    // Configurar búsqueda de ubicación
    $('#search-form').off('submit').on('submit', function(e) {
        e.preventDefault();
        const query = $('#search-input').val().trim();
        if (query) {
            searchLocation(query);
        } else {
            alert('Por favor ingresa una ubicación para buscar');
        }
    });

    // Botón para buscar ubicación actual
    $('#current-location-btn').off('click').on('click', function() {
        searchCurrentLocation();
    });

    // Autocompletar en la búsqueda
    $('#search-input').off('keypress').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            e.preventDefault();
            const query = $(this).val().trim();
            if (query) {
                searchLocation(query);
            }
        }
    });
}
});

// ============================================
// FUNCIONES DE LEYENDA CORREGIDAS
// ============================================

// ============================================
// FUNCIÓN CAMBIAR LEYENDA - CORREGIDA
// ============================================

function changeLegend(legendType) {
    console.log("Cambiando leyenda a:", legendType);
    
    // Ocultar todas las leyendas primero
    $('#legend').hide();
    $('#location-legend').hide();
    $('#wave-legend').hide();
    
    // Mostrar la leyenda seleccionada
    if (legendType === 'damage') {
        $('#legend').show();
    } else if (legendType === 'location') {
        $('#location-legend').show();
    } else if (legendType === 'wave') {
        $('#wave-legend').show();
    }
    
    // Actualizar botones activos
    $('.legend-toggle-btn').removeClass('active');
    $('.legend-toggle-btn[data-target="' + legendType + '"]').addClass('active');
    
    // Cambiar estilo de los puntos en el mapa - CORREGIDO
    if (vectorLayer) {
        vectorLayer.setStyle(function(feature) {
            return createStyle(feature, legendType);
        });
        
        // Forzar redibujado del mapa
        vectorLayer.changed();
        console.log("Estilo cambiado para leyenda:", legendType);
    }
}

// Función createStyle actualizada para asegurar que funcione
function createStyle(feature, styleType = 'damage') {
    var color;
    var radius = 10;
    
    // Obtener el valor según el tipo de estilo
    switch(styleType) {
        case 'damage':
            var nivelDanio = feature.get('nivel_danio');
            color = getColorByDamageLevel(nivelDanio);
            break;
            
        case 'location':
            var tipoLugar = feature.get('tipo_lugar');
            color = getColorByLocationType(tipoLugar);
            break;
            
        case 'wave':
            var categoriaMarejada = feature.get('categoria_marejada');
            color = getColorByWaveCategory(categoriaMarejada);
            break;
            
        default:
            var nivelDanio = feature.get('nivel_danio');
            color = getColorByDamageLevel(nivelDanio);
    }
    
    // Si no hay color, usar gris por defecto
    if (!color) {
        color = '#95a5a6';
    }
    
    return new ol.style.Style({
        image: new ol.style.Circle({
            radius: radius,
            fill: new ol.style.Fill({color: color}),
            stroke: new ol.style.Stroke({
                color: '#2c3e50',
                width: 2
            })
        })
    });
}

// Asegurar que la leyenda de daño sea la default al cargar
$(document).ready(function() {
    setTimeout(function() {
        changeLegend('damage');
    }, 500);
});

// ============================================
// FUNCIONES DE ESTADÍSTICAS ACTUALIZADAS
// ============================================

function calculateStatistics() {
    var features = vectorSource.getFeatures();
    var stats = {
        total: features.length,
        
        // Por nivel de daño (desagregado)
        danio: {
            leve: features.filter(f => f.get('nivel_danio') === "1").length,
            moderado: features.filter(f => f.get('nivel_danio') === "2").length,
            severo: features.filter(f => f.get('nivel_danio') === "3").length
        },
        
        // Por categoría de marejada (completamente desagregado)
        marejada: {
            N: features.filter(f => f.get('categoria_marejada') === "N").length,
            N_plus: features.filter(f => f.get('categoria_marejada') === "N_plus").length,
            M1: features.filter(f => f.get('categoria_marejada') === "M1").length,
            M2: features.filter(f => f.get('categoria_marejada') === "M2").length,
            M3: features.filter(f => f.get('categoria_marejada') === "M3").length,
            M4: features.filter(f => f.get('categoria_marejada') === "M4").length,
            M5: features.filter(f => f.get('categoria_marejada') === "M5").length
        },
        
        // Por tipo de lugar
        lugar: {
            vereda: features.filter(f => f.get('tipo_lugar') === "vereda").length,
            calzada_calle: features.filter(f => f.get('tipo_lugar') === "calzada_calle").length,
            interior_vivienda: features.filter(f => f.get('tipo_lugar') === "interior_vivienda").length,
            interior_comercio: features.filter(f => f.get('tipo_lugar') === "interior_comercio").length,
            espacio_publico: features.filter(f => f.get('tipo_lugar') === "espacio_publico").length,
            infraestructura: features.filter(f => f.get('tipo_lugar') === "infraestructura").length,
            playa: features.filter(f => f.get('tipo_lugar') === "playa").length
        },
        
        // Por afectación principal (completo)
        afectacion: {
            inundacion_vereda: features.filter(f => f.get('tipo_afectacion_principal') === "inundacion_vereda").length,
            inundacion_calle: features.filter(f => f.get('tipo_afectacion_principal') === "inundacion_calle").length,
            inundacion_vivienda: features.filter(f => f.get('tipo_afectacion_principal') === "inundacion_vivienda").length,
            inundacion_comercio: features.filter(f => f.get('tipo_afectacion_principal') === "inundacion_comercio").length,
            danio_infraestructura: features.filter(f => f.get('tipo_afectacion_principal') === "danio_infraestructura").length,
            erosion: features.filter(f => f.get('tipo_afectacion_principal') === "erosion").length,
            arrastre: features.filter(f => f.get('tipo_afectacion_principal') === "arrastre").length,
            salpicaduras: features.filter(f => f.get('tipo_afectacion_principal') === "salpicaduras").length
        }
    };
    
    return stats;
}

function updateStatistics() {
    var stats = calculateStatistics();
    
    // Actualizar total siempre visible
    $('#total-reports').text(stats.total);
    
    // Nivel de daño
    $('#damage-mild').text(stats.danio.leve);
    $('#damage-moderate').text(stats.danio.moderado);
    $('#damage-severe').text(stats.danio.severo);
    
    // Categorías de marejada (desagregadas)
    $('#wave-n').text(stats.marejada.N);
    $('#wave-n-plus').text(stats.marejada.N_plus);
    $('#wave-m1').text(stats.marejada.M1);
    $('#wave-m2').text(stats.marejada.M2);
    $('#wave-m3').text(stats.marejada.M3);
    $('#wave-m4').text(stats.marejada.M4);
    $('#wave-m5').text(stats.marejada.M5);
    
    // Tipos de afectación
    $('#affectation-street').text(stats.afectacion.inundacion_calle);
    $('#affectation-house').text(stats.afectacion.inundacion_vivienda);
    $('#affectation-sidewalk').text(stats.afectacion.inundacion_vereda);
    $('#affectation-commerce').text(stats.afectacion.inundacion_comercio);
    $('#affectation-infra').text(stats.afectacion.danio_infraestructura);
    $('#affectation-erosion').text(stats.afectacion.erosion);
    $('#affectation-drag').text(stats.afectacion.arrastre);
    $('#affectation-splash').text(stats.afectacion.salpicaduras);
    
    // Tipo de lugar
    $('#tipo-vereda').text(stats.lugar.vereda);
    $('#tipo-calzada').text(stats.lugar.calzada_calle);
    $('#tipo-vivienda').text(stats.lugar.interior_vivienda);
    $('#tipo-comercio').text(stats.lugar.interior_comercio);
    $('#tipo-espacio-publico').text(stats.lugar.espacio_publico);
    $('#tipo-infraestructura').text(stats.lugar.infraestructura);
    $('#tipo-playa').text(stats.lugar.playa);
    
    // Actualizar gráfico
    updateChart();
}

// ============================================
// FUNCIONES DE GRÁFICOS (TIPO TORTA/DONA)
// ============================================

var currentChart = null;

function updateChart() {
    var chartType = $('#chart-type-selector').val();
    var stats = calculateStatistics();
    
    var chartData = getChartData(chartType, stats);
    renderChart(chartData);
}

function getChartData(chartType, stats) {
    var data = {};
    
    switch(chartType) {
        case 'damage':
            data = {
                title: 'Distribución por Nivel de Daño',
                labels: ['Leve (1)', 'Moderado (2)', 'Severo (3)'],
                values: [stats.danio.leve, stats.danio.moderado, stats.danio.severo],
                colors: ['#2ecc71', '#f39c12', '#e74c3c'],
                total: stats.danio.leve + stats.danio.moderado + stats.danio.severo
            };
            break;
            
        case 'wave':
            data = {
                title: 'Distribución por Categoría de Marejada',
                labels: ['N', 'N+', 'M1', 'M2', 'M3', 'M4', 'M5'],
                values: [
                    stats.marejada.N,
                    stats.marejada.N_plus,
                    stats.marejada.M1,
                    stats.marejada.M2,
                    stats.marejada.M3,
                    stats.marejada.M4,
                    stats.marejada.M5
                ],
                colors: ['#27ae60', '#f1c40f', '#e67e22', '#d35400', '#c0392b', '#8e44ad', '#2c3e50'],
                total: Object.values(stats.marejada).reduce((a, b) => a + b, 0)
            };
            break;
            
        case 'location':
            data = {
                title: 'Distribución por Tipo de Lugar',
                labels: ['Vereda', 'Calzada', 'Vivienda', 'Comercio', 'Esp. Público', 'Infraestructura', 'Playa'],
                values: [
                    stats.lugar.vereda,
                    stats.lugar.calzada, // CORREGIDO: calzada en lugar de calzada_calle
                    stats.lugar.interior_vivienda,
                    stats.lugar.interior_comercio,
                    stats.lugar.espacio_publico,
                    stats.lugar.infraestructura_critica, // CORREGIDO
                    stats.lugar.playa_roquerios // CORREGIDO
                ],
                colors: ['#3498db', '#9b59b6', '#e67e22', '#1abc9c', '#d35400', '#c0392b', '#16a085'],
                total: Object.values(stats.lugar).reduce((a, b) => a + b, 0)
            };
            break;
            
        case 'affectation':
            data = {
                title: 'Distribución por Tipo de Afectación',
                labels: ['Inund. Vereda', 'Inund. Calle', 'Inund. Vivienda', 'Inund. Comercio', 'Daño Infra', 'Erosión', 'Arrastre', 'Salpicaduras'],
                values: [
                    stats.afectacion.inundacion_vereda,
                    stats.afectacion.inundacion_calle,
                    stats.afectacion.inundacion_vivienda,
                    stats.afectacion.inundacion_comercio,
                    stats.afectacion.danio_infraestructura,
                    stats.afectacion.erosion,
                    stats.afectacion.arrastre,
                    stats.afectacion.salpicaduras
                ],
                colors: ['#3498db', '#9b59b6', '#e67e22', '#1abc9c', '#d35400', '#c0392b', '#8e44ad', '#2c3e50'],
                total: Object.values(stats.afectacion).reduce((a, b) => a + b, 0)
            };
            break;
    }
    
    return data;
}

function renderChart(chartData) {
    var ctx = document.getElementById('main-chart').getContext('2d');
    
    // Destruir gráfico anterior si existe
    if (currentChart) {
        currentChart.destroy();
    }
    
    // Configurar tooltips personalizados
    var tooltipCallbacks = {
        label: function(context) {
            var label = context.label || '';
            var value = context.raw || 0;
            var percentage = chartData.total > 0 ? Math.round((value / chartData.total) * 100) : 0;
            return label + ': ' + value + ' (' + percentage + '%)';
        }
    };
    
    currentChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartData.labels,
            datasets: [{
                data: chartData.values,
                backgroundColor: chartData.colors,
                borderWidth: 1,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Ocultamos leyenda interna para usar la externa
                },
                title: {
                    display: true,
                    text: chartData.title,
                    font: {
                        size: 14
                    }
                },
                tooltip: {
                    callbacks: tooltipCallbacks
                }
            },
            cutout: '50%' // Para hacerlo tipo dona
        }
    });
    
    // Actualizar leyenda externa
    updateChartLegend(chartData);
}

function updateChartLegend(chartData) {
    var legendHtml = '';
    
    chartData.labels.forEach(function(label, index) {
        var value = chartData.values[index];
        var percentage = chartData.total > 0 ? Math.round((value / chartData.total) * 100) : 0;
        
        legendHtml += `
            <div class="legend-item-small" title="${label}: ${value} (${percentage}%)">
                <div class="legend-color-small" style="background-color: ${chartData.colors[index]}"></div>
                <span>${label.split(' ')[0]}</span>
            </div>
        `;
    });
    
    $('#chart-legend').html(legendHtml);
}

// ============================================
// INICIALIZACIÓN MEJORADA
// ============================================

$(function(){
    // Inicializar tamaño de pantalla
    checkScreenSize();
    
    // Cargar datos GeoJSON
    loadGeoJSONData().then(function(features) {
        initializeMapWithData(features);
    });

    // Configuración del sidebar
    $('.sidebar-toggle-btn').on('click', function() {
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

    // Configurar botones de leyenda (CORREGIDO)
    $(document).on('click', '.legend-toggle-btn', function() {
        var target = $(this).data('target');
        changeLegend(target);
    });

    // Cambiar gráfico cuando se selecciona otro tipo
    $('#chart-type-selector').on('change', function() {
        updateChart();
    });

    // Asegurar que dropdowns de Bootstrap funcionen
    $('.dropdown-toggle').dropdown();

    applyMargins();
    
    // Asegurar que el botón de sidebar sea visible
    $('.sidebar-toggle-btn').show();
    
    // Inicializar leyenda en daño por defecto
    setTimeout(function() {
        changeLegend('damage');
    }, 1000);
});
// ============================================
// FUNCIONES PARA CONTROLAR TAMAÑO DE SIDEBAR
// ============================================

var isResizing = false;
var lastDownX = 0;
var sidebarDefaultWidth = 350;

function initializeSidebarResize() {
    var sidebar = $('.sidebar-left');
    var resizeHandle = sidebar[0];
    
    // Crear controles de tamaño si no existen
    if (!$('.sidebar-size-controls').length) {
        sidebar.append(`
            <div class="sidebar-size-controls">
                <button class="size-control-btn" data-size="small" title="Pequeño (300px)">
                    <i class="fa fa-compress"></i>
                </button>
                <button class="size-control-btn active" data-size="medium" title="Mediano (400px)">
                    <i class="fa fa-square-o"></i>
                </button>
                <button class="size-control-btn" data-size="large" title="Grande (500px)">
                    <i class="fa fa-expand"></i>
                </button>
                <button class="size-control-btn" data-size="extra-large" title="Extra Grande (600px)">
                    <i class="fa fa-arrows-alt"></i>
                </button>
            </div>
            <div class="sidebar-width-indicator">${sidebar.width()}px</div>
        `);
    }
    
    // Evento para redimensionamiento con mouse
    $(document).on('mousedown', '.sidebar-left::after', function(e) {
        isResizing = true;
        lastDownX = e.clientX;
        sidebar.addClass('resizing');
        $('body').addClass('resizing-sidebar');
        e.preventDefault();
    });
    
    $(document).on('mousemove', function(e) {
        if (!isResizing) return;
        
        var offsetRight = document.body.offsetWidth - (e.clientX - document.body.offsetLeft);
        var newWidth = e.clientX - sidebar.offset().left;
        
        // Limitar tamaño mínimo y máximo
        newWidth = Math.max(300, Math.min(600, newWidth));
        
        sidebar.css('width', newWidth + 'px');
        applyMargins();
        
        // Actualizar indicador
        $('.sidebar-width-indicator').text(newWidth + 'px');
        
        e.preventDefault();
    });
    
    $(document).on('mouseup', function() {
        if (isResizing) {
            isResizing = false;
            sidebar.removeClass('resizing');
            $('body').removeClass('resizing-sidebar');
        }
    });
    
    // Controles de tamaño predefinidos
    $(document).on('click', '.size-control-btn', function() {
        var size = $(this).data('size');
        changeSidebarSize(size);
    });
    
    // Botón para modo compacto
    $(document).on('dblclick', '.sidebar-toggle-btn', function() {
        toggleCompactMode();
    });
}

function changeSidebarSize(size) {
    var sidebar = $('.sidebar-left');
    
    // Remover todas las clases de tamaño
    sidebar.removeClass('size-small size-medium size-large size-extra-large');
    
    // Aplicar nuevo tamaño
    switch(size) {
        case 'small':
            sidebar.addClass('size-small').css('width', '300px');
            break;
        case 'medium':
            sidebar.addClass('size-medium').css('width', '400px');
            break;
        case 'large':
            sidebar.addClass('size-large').css('width', '500px');
            break;
        case 'extra-large':
            sidebar.addClass('size-extra-large').css('width', '600px');
            break;
    }
    
    // Actualizar botones activos
    $('.size-control-btn').removeClass('active');
    $(`.size-control-btn[data-size="${size}"]`).addClass('active');
    
    // Ajustar márgenes
    applyMargins();
    
    // Actualizar posición del botón toggle
    updateToggleButtonPosition();
}

function toggleCompactMode() {
    var sidebar = $('.sidebar-left');
    sidebar.toggleClass('compact-mode');
    
    if (sidebar.hasClass('compact-mode')) {
        // Guardar el tamaño actual antes de compactar
        sidebar.data('previous-width', sidebar.width());
        sidebar.css('width', '50px');
    } else {
        // Restaurar tamaño anterior
        var previousWidth = sidebar.data('previous-width') || sidebarDefaultWidth;
        sidebar.css('width', previousWidth + 'px');
    }
    
    applyMargins();
    updateToggleButtonPosition();
}

function updateToggleButtonPosition() {
    var sidebar = $('.sidebar-left');
    var toggleBtn = $('.sidebar-toggle-btn');
    
    if (sidebar.hasClass('collapsed') || sidebar.hasClass('compact-mode')) {
        toggleBtn.css('left', '10px');
    } else {
        var sidebarWidth = sidebar.width();
        toggleBtn.css('left', 'calc(' + sidebarWidth + 'px - 42px - 10px)');
    }
}

function togglePanelExpand(panelId) {
    var panel = $('#' + panelId);
    panel.toggleClass('collapsed');
    
    // Ajustar altura del panel body
    if (panel.hasClass('collapsed')) {
        panel.find('.panel-body').css('max-height', '0');
    } else {
        panel.find('.panel-body').css('max-height', '500px');
    }
}

// ============================================
// INICIALIZACIÓN ACTUALIZADA
// ============================================

$(function(){
    // Inicializar tamaño de pantalla
    checkScreenSize();
    
    // Inicializar redimensionamiento de sidebar
    initializeSidebarResize();
    
    // Cargar datos GeoJSON
    loadGeoJSONData().then(function(features) {
        initializeMapWithData(features);
    });

    // Configuración del sidebar
    $('.sidebar-toggle-btn').on('click', function() {
        toggleSidebar();
    });

    $(window).on("resize", function() {
        checkScreenSize();
        applyMargins();
    });

    // ... resto de tu código existente ...

    applyMargins();
    
    // Asegurar que el botón de sidebar sea visible
    $('.sidebar-toggle-btn').show();
    
    // Inicializar leyenda en daño por defecto
    setTimeout(function() {
        changeLegend('damage');
    }, 1000);
});