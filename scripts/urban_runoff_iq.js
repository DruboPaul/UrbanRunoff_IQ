var cities = {
    'Brisbane': [152.9991, -27.4975],
    'Sydney': [151.2093, -33.8688],
    'Melbourne': [144.9631, -37.8136],
    'Perth': [115.8605, -31.9505],
    'Adelaide': [138.6007, -34.9285],
    'Canberra': [149.1300, -35.2809]
};

var currentCity = 'Brisbane';
var compareCity = 'Sydney';
var appMode = 'WIPE';
var currentResolution = 30;

var adminBoundaries = ee.FeatureCollection("FAO/GAUL/2015/level2");

function getAnalysis(cityName) {
    var region = adminBoundaries
        .filter(ee.Filter.eq('ADM0_NAME', 'Australia'))
        .filter(ee.Filter.stringContains('ADM2_NAME', cityName))
        .geometry().simplify(1000);

    if (cityName == 'Canberra') {
        region = ee.FeatureCollection("FAO/GAUL/2015/level1")
            .filter(ee.Filter.eq('ADM1_NAME', 'Australian Capital Territory'))
            .geometry().simplify(1000);
    }

    var s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED");
    var dem = ee.Image("NASA/NASADEM_HGT/001").select('elevation');
    var rainfallColl = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY");

    function addIndices(img) {
        var ndvi = img.normalizedDifference(['B8', 'B4']).rename('NDVI');
        var ndbi = img.normalizedDifference(['B11', 'B8']).rename('NDBI');
        var ndwi = img.normalizedDifference(['B3', 'B8']).rename('NDWI');
        return img.addBands([ndvi, ndbi, ndwi]).clip(region);
    }

    var urbanImg = s2.filterBounds(region).filterDate('2023-01-01', '2023-12-31')
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10)).map(addIndices).median();

    var waterMask = urbanImg.select('NDWI').lt(0.1);
    var imperviousFactor = urbanImg.select('NDBI').subtract(urbanImg.select('NDVI')).rename('Impervious');
    var slope = ee.Terrain.slope(dem.clip(region));
    var rainFactor = rainfallColl.filterDate('2023-01-01', '2023-12-31').sum().clip(region).divide(3000).rename('Rain');

    var rpi = imperviousFactor.multiply(0.4).add(slope.divide(45).multiply(0.3))
        .add(rainFactor.multiply(0.3)).updateMask(waterMask).rename('RPI').clip(region);

    var rpiClass = ee.Image(0).where(rpi.gt(0.2), 3).where(rpi.lte(0.2).and(rpi.gt(0)), 2)
        .where(rpi.lte(0), 1).rename('Class').clip(region).updateMask(waterMask);

    return { rpi: rpi, base: urbanImg.clip(region), rpiClass: rpiClass, region: region, rainfall: rainfallColl };
}

function getTiles(geometry, nx, ny) {
    var bounds = ee.List(geometry.bounds().coordinates().get(0));
    var xMin = ee.Number(ee.List(bounds.get(0)).get(0));
    var yMin = ee.Number(ee.List(bounds.get(0)).get(1));
    var xMax = ee.Number(ee.List(bounds.get(2)).get(0));
    var yMax = ee.Number(ee.List(bounds.get(2)).get(1));

    var dx = xMax.subtract(xMin).divide(nx);
    var dy = yMax.subtract(yMin).divide(ny);

    var tiles = [];
    for (var i = 0; i < nx; i++) {
        for (var j = 0; j < ny; j++) {
            var x1 = xMin.add(dx.multiply(i));
            var x2 = xMin.add(dx.multiply(i + 1));
            var y1 = yMin.add(dy.multiply(j));
            var y2 = yMin.add(dy.multiply(j + 1));
            var tile = ee.Geometry.Rectangle([x1, y1, x2, y2]);
            tiles.push(tile.intersection(geometry));
        }
    }
    return tiles;
}

ui.root.clear();
var leftMap = ui.Map();
var rightMap = ui.Map();
var panel = ui.Panel({ style: { width: '400px', padding: '15px', backgroundColor: '#f8f9fa' } });

var leftLabel = ui.Label('', { position: 'top-left', fontWeight: 'bold', padding: '5px', backgroundColor: 'rgba(255,255,255,0.7)' });
var rightLabel = ui.Label('', { position: 'top-right', fontWeight: 'bold', padding: '5px', backgroundColor: 'rgba(255,255,255,0.7)' });

var splitPanel = ui.SplitPanel({
    firstPanel: leftMap, secondPanel: rightMap,
    orientation: 'horizontal', wipe: true, style: { stretch: 'both' }
});

ui.root.add(ui.Panel([panel, splitPanel], ui.Panel.Layout.flow('horizontal'), { stretch: 'both' }));

var rpiVis = { min: -0.5, max: 0.5, palette: ['#00FF00', '#FFFF00', '#FF7F00', '#FF0000'] };
var inspectResults = ui.Label('Click on map to inspect...');
var chartPlaceholder = ui.Panel();

function refreshApp() {
    panel.clear();
    leftMap.layers().reset();
    rightMap.layers().reset();
    leftMap.widgets().reset();
    rightMap.widgets().reset();

    panel.add(ui.Label('UrbanRunoff IQ', { fontSize: '24px', fontWeight: 'bold', color: '#1a73e8' }));
    panel.add(ui.Label('Multi-Evidence Urban Hydrology Analytics', { fontSize: '14px', fontStyle: 'italic' }));
    panel.add(ui.Label('________________________________________________', { color: '#e0e0e0' }));

    panel.add(ui.Label('View Settings:', { fontWeight: 'bold', fontSize: '16px', margin: '10px 0 5px 0' }));

    panel.add(ui.Label('Analysis Mode:'));
    panel.add(ui.Select({
        items: ['Wipe Mode (Base vs Risk)', 'Dual City Comparison'],
        value: appMode == 'WIPE' ? 'Wipe Mode (Base vs Risk)' : 'Dual City Comparison',
        onChange: function (v) {
            appMode = v == 'Wipe Mode (Base vs Risk)' ? 'WIPE' : 'COMPARE';
            refreshApp();
        }
    }));

    panel.add(ui.Label('Primary City:'));
    panel.add(ui.Select({
        items: Object.keys(cities), value: currentCity,
        onChange: function (v) { currentCity = v; refreshApp(); }
    }));

    if (appMode == 'COMPARE') {
        panel.add(ui.Label('Compare With:'));
        panel.add(ui.Select({
            items: Object.keys(cities), value: compareCity,
            onChange: function (v) { compareCity = v; refreshApp(); }
        }));
        splitPanel.setWipe(false);
    } else {
        splitPanel.setWipe(true);
    }

    panel.add(ui.Label('Map Legend:', { fontWeight: 'bold', margin: '15px 0 5px 0' }));
    var makeRow = function (color, name) {
        return ui.Panel([
            ui.Label('\u00A0\u00A0\u00A0\u00A0', { backgroundColor: color, padding: '8px', border: '1px solid black', margin: '0 0 4px 0' }),
            ui.Label(name, { margin: '8px 0 4px 10px', fontSize: '13px' })
        ], ui.Panel.Layout.flow('horizontal'));
    };
    panel.add(makeRow('#FF0000', 'Critical Runoff (High Risk)'));
    panel.add(makeRow('#FFFF00', 'Moderate Flow'));
    panel.add(makeRow('#00FF00', 'Natural Permeable (Low Risk)'));

    var resA = getAnalysis(currentCity);

    panel.add(ui.Label('Analysis Resolution:', { fontWeight: 'bold', margin: '15px 0 5px 0' }));
    var resSelect = ui.Select({
        items: ['High (10m)', 'Medium (30m)', 'Standard (50m)', 'Efficient (100m)'],
        value: currentResolution == 10 ? 'High (10m)' :
            currentResolution == 30 ? 'Medium (30m)' :
                currentResolution == 50 ? 'Standard (50m)' : 'Efficient (100m)',
        onChange: function (v) {
            currentResolution = parseInt(v.match(/\d+/)[0]);
            refreshApp();
        }
    });
    panel.add(resSelect);
    if (currentResolution < 30) {
        panel.add(ui.Label('\u26A0 High resolution may exceed user memory limits for large cities.',
            { fontSize: '10px', color: 'orange', margin: '0 0 10px 0' }));
    }

    leftMap.setCenter(cities[currentCity][0], cities[currentCity][1], 11);
    leftLabel.setValue(currentCity);
    leftMap.widgets().set(0, leftLabel);

    if (appMode == 'WIPE') {
        leftMap.addLayer(resA.base, { bands: ['B4', 'B3', 'B2'], min: 0, max: 3000 }, 'Satellite View');
        rightMap.addLayer(resA.rpi, rpiVis, 'Runoff Analysis');
        rightMap.setCenter(cities[currentCity][0], cities[currentCity][1], 11);
        rightLabel.setValue(currentCity + ' (Risk Map)');
        rightMap.widgets().set(0, rightLabel);

        panel.add(ui.Label('Regional Analysis (' + currentCity + '):', { fontWeight: 'bold', margin: '10px 0' }));
        panel.add(ui.Chart.image.histogram({ image: resA.rpiClass, region: resA.region, scale: currentResolution * 10 })
            .setOptions({ title: 'Risk Distribution', colors: ['#1a73e8'], legend: { position: 'none' } }));
    } else {
        var resB = getAnalysis(compareCity);
        leftMap.addLayer(resA.rpi, rpiVis, currentCity);
        rightMap.addLayer(resB.rpi, rpiVis, compareCity);
        rightMap.setCenter(cities[compareCity][0], cities[compareCity][1], 11);
        rightLabel.setValue(compareCity);
        rightMap.widgets().set(0, rightLabel);
        panel.add(ui.Label('Comparison Mode Active.', { fontStyle: 'italic', fontSize: '12px', color: '#666' }));
    }

    panel.add(ui.Label('Data Export:', { fontWeight: 'bold', margin: '15px 0 5px 0' }));
    var statusLabel = ui.Label('', { fontSize: '11px', color: '#666' });

    var downloadBtn = ui.Button({
        label: '\uD83D\uDE80 Generate Download Links',
        onClick: function () {
            downloadBtn.setDisabled(true);
            statusLabel.setValue('\u23F3 Preparing files (Resolution: ' + currentResolution + 'm)...');

            if (currentResolution == 10) {
                statusLabel.setValue('\uD83D\uDCA1 Large Area: Splitting into 16 Tiles for stability...');
                var tiles = getTiles(resA.region, 4, 4);

                tiles.forEach(function (tile, index) {
                    tile.evaluate(function (geoJson) {
                        resA.rpi.getDownloadURL({
                            name: currentCity + '_10m_Part_' + (index + 1),
                            scale: 10,
                            crs: 'EPSG:4326', region: geoJson
                        }, function (url) {
                            var link = ui.Label('\uD83D\uDCE5 Part ' + (index + 1) + ' (Link Ready)', { color: 'blue', fontSize: '12px' });
                            link.setUrl(url);
                            panel.add(link);
                            if (index == 15) {
                                statusLabel.setValue('\u2705 All 16 High-Res Tiles Generated!');
                                downloadBtn.setDisabled(false);
                            }
                        });
                    });
                });
            } else {
                resA.region.evaluate(function (geoJson) {
                    resA.rpi.getDownloadURL({
                        name: currentCity + '_Runoff_IQ',
                        scale: currentResolution,
                        crs: 'EPSG:4326', region: geoJson
                    }, function (url) {
                        statusLabel.setValue('\u2705 Single Link Generated successfully.');
                        var link = ui.Label('\uD83D\uDCE5 Click to Download Full Map', { color: 'blue', fontWeight: 'bold' });
                        link.setUrl(url);
                        panel.add(link);
                        downloadBtn.setDisabled(false);
                    });
                });
            }
        }
    });
    panel.add(downloadBtn);
    panel.add(statusLabel);

    panel.add(ui.Label('Point Inspector:', { fontWeight: 'bold', margin: '10px 0' }));
    panel.add(inspectResults);
    panel.add(chartPlaceholder);

    var setupClick = function (map, analysis) {
        map.onClick(function (coords) {
            inspectResults.setValue('Analyzing...');
            var point = ee.Geometry.Point([coords.lon, coords.lat]);
            analysis.rpi.reduceRegion({
                reducer: ee.Reducer.mean(), geometry: point, scale: currentResolution, tileScale: 4
            }).get('RPI').evaluate(function (val) {
                inspectResults.setValue('Runoff Index: ' + (val ? val.toFixed(3) : 'Water/Outside'));
            });
            chartPlaceholder.clear();
            chartPlaceholder.add(ui.Chart.image.series({
                imageCollection: analysis.rainfall.select('precipitation').filterDate('2019-01-01', '2023-12-31'),
                region: point, reducer: ee.Reducer.mean(), scale: 5000
            }).setOptions({ title: 'Rainfall Trend (5 Years)', vAxis: { title: 'mm' }, lineWidth: 1.5, colors: ['#e74c3c'] }));
        });
    };

    setupClick(leftMap, resA);
    if (appMode == 'WIPE') setupClick(rightMap, resA);
    else setupClick(rightMap, getAnalysis(compareCity));
}

refreshApp();
