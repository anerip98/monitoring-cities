var start_date = '2000-01-01'
var end_date = '2020-12-31'

var t1_1 = '2000-01-01'
var t1_2 = '2000-12-31'

var t1_1 = '2020-01-01'
var t1_2 = '2020-12-31'

var palettes = require('users/gena/packages:palettes');

var no2_viz = {"min":0,"max":0.0002,"palette":["black","blue","purple","cyan","green","yellow","red"]};
var aerosol_viz = {"min":-1,"max":2,"palette":["black","blue","purple","cyan","green","yellow","red"]};
var co_viz = {"min":0,"max":0.05,"palette":["black","blue","purple","cyan","green","yellow","red"]};
var VIIRS_viz = {min: 15, max:100, palette:['0000ff', '00ffff', 'ffff00', 'ff0000']};
var diff_vis = {"min":-1,"max":1,"palette":["blue, white, red"]};
var dsm_viz = {min: 180, max:210, palette:['0000ff', '00ffff', 'ffff00', 'ff0000', 'ffffff']};
var ndvi_viz = {min:-0.8, max:0.8, palette: ['brown' ,'black','lightgreen']};
var landcover_viz = {min:1, max:3, palette:"lightgreen, black, brown"};
var population_viz = {min: 0, max: 3000, palette:['blue', 'white', 'red']};
var temp_viz = {min:20, max:45 , palette: ['040274', '040281', '0502a3', '0502b8', '0502ce', '0502e6',
    '0602ff', '235cb1', '307ef3', '269db1', '30c8e2', '32d3ef',
    '3be285', '3ff38f', '86e26f', '3ae237', 'b5e22e', 'd6e21f',
    'fff705', 'ffd611', 'ffb613', 'ff8b13', 'ff6e08', 'ff500d',
    'ff0000', 'de0101', 'c21301', 'a71001', '911003']};
var solar_viz = {min:0.55,max:7, palette:palettes.niccoli.linearl[7]}
    
var ROI = ee.FeatureCollection("users/aneripatel/phoenix").geometry();
print(ROI.area().divide(1e6).round(),"km2");
Map.centerObject(ROI, 10);

// --------------------------------
var co = ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_CO')
  .filterBounds(ROI)
  .select('CO_column_number_density')
  .filterDate(t1_1, t1_2)
  .mean()
  .clip(ROI);
  
var aerosol = ee.ImageCollection('COPERNICUS/S5P/NRTI/L3_AER_AI')
  .filterBounds(ROI)
  .select('absorbing_aerosol_index')
  .filterDate(t1_1, t1_2)
  .mean()
  .clip(ROI);
  
var no2 = ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_NO2')
  .filterBounds(ROI)
  .filterDate(t1_1, t1_2)
  .select('tropospheric_NO2_column_number_density')
  .filterDate(t1_1, t1_2)
  .mean()
  .clip(ROI);

var sentinel = ee.ImageCollection('COPERNICUS/S2')
  .filterBounds(ROI)
  .filterDate(t1_1, t1_2)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10)) // filter to only less cloudy images
  .filterBounds(ROI)
  .map(function(image) {
  var QA60 = image.select(['QA60']);
    return image
    .updateMask(QA60.lt(1));
  })
  .median()
  .clip(ROI);

var landsat = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
                .filterBounds(ROI)
                .filterDate(t1_1, t1_2)
                .filter(ee.Filter.lt('CLOUD_COVER',15)) 
                .select('ST_B10')
                .map(function (img){
                        return img.addBands(img.multiply(0.00341802)
                        .add(149.0)
                        .subtract(273.15)
                        .rename('landsat_day_celcius'))
                })
                .select('landsat_day_celcius')
                .mean()
                .clip(ROI);

var modis = ee.ImageCollection('MODIS/006/MOD11A2')
    .filterDate(t1_1, t1_2)
    .select(['LST_Day_1km','LST_Night_1km'])
    .map(function (img){
      return img.multiply(0.02).subtract(273.15)
    .rename(['modis_day_celcius', 'modis_night_celcius'])
    .copyProperties(img, img.propertyNames())
    });

var modis_day = modis.select('modis_day_celcius').median().clip(ROI);
var modis_night = modis.select('modis_night_celcius').median().clip(ROI);

var veg_ndvi = {'low': 0.5, 'high': 1}
var urban_ndvi = {'low': 0, 'high': 0.5}
var ground_ndvi = {'low':-1, high:0}
var ndvi = sentinel.normalizedDifference(['B8', 'B4']).rename('NDVI_Sentinel').clip(ROI);
var vegetation = ndvi.gt(veg_ndvi['low']).and(ndvi.lt(veg_ndvi['high'])).multiply(1)
var urban = ndvi.gt(urban_ndvi['low']).and(ndvi.lt(urban_ndvi['high'])).multiply(2)
var soil = ndvi.lt(ground_ndvi['high']).and(ndvi.lt(ground_ndvi['high'])).multiply(3)
var landcover = vegetation.add(urban).add(soil).clip(ROI)

var VIIRS = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMCFG')
  .filterDate(t1_1, t1_2)
  .select('avg_rad')
  .mean()
  .clip(ROI);

var population = ee.ImageCollection('CIESIN/GPWv411/GPW_UNWPP-Adjusted_Population_Count')
  .select('unwpp-adjusted_population_count').filterDate(t1_1,t1_2).first().clip(ROI);

var copernicus_dsm = ee.ImageCollection('projects/sat-io/open-datasets/GLO-30').mosaic().clip(ROI)

Map.addLayer(no2, no2_viz, 'S5P N02');
Map.addLayer(aerosol, aerosol_viz, 'S5P Aerosol');
Map.addLayer(co, co_viz, 'S5P CO');
Map.addLayer(landsat, temp_viz, 'Landsat - Temperature');
Map.addLayer(modis_day, temp_viz, 'Modis Day');  
Map.addLayer(modis_night,temp_viz, 'Modis Night');
Map.addLayer(ndvi, ndvi_viz, 'Sentinel NDVI');
Map.addLayer(landcover, landcover_viz, 'Landcover');
Map.addLayer(population, population_viz, 'Population')
Map.addLayer(VIIRS, VIIRS_viz, 'VIIRS');
Map.addLayer(copernicus_dsm, dsm_viz, 'Copernicus DSM 30m');


// Export.image.toDrive({
//   image: solar,
//   description: 'Solar',
//   scale: 10000,
//   region: ROI, 
//   crs: 'EPSG:4326',
//   folder: 'random',
//   maxPixels: 10000000
// });

print("done")
