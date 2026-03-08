# UrbanRunoff IQ: A Cloud-Native Framework for Precision Urban Hydrology

**UrbanRunoff IQ** is an advanced Google Earth Engine (GEE) platform designed for the high-resolution assessment of urban stormwater risks and runoff dynamics. This framework leverages multi-sensor satellite data fusion to bridge the gap between meteorological precipitation and surface hydrological response in complex urban environments.

🚀 **[Live App Link](https://drubopaulresearch.projects.earthengine.app/view/urbanrunoff-iq)**

---

## 🔬 Scientific Methodology

The platform is built on the premise that urban runoff is a function of land-surface morphology, anthropogenic modification, and precipitation intensity.

### 1. Runoff Potential Index (RPI) Formulation
The core analytical output is the **Runoff Potential Index (RPI)**, derived from three primary physical drivers:
- **Impervious Surface Intensity (ISI)**: Extracted from multi-temporal Sentinel-2 imagery (Boreal-summer composites) using spectral indices (NDVI/NDBI) to quantify non-absorbing surfaces.
- **Topographic Slope ($\theta$)**: Calculated from NASADEM (30m, resampled to 10m) to determine gravitational flow velocity.
- **Precipitation Forcing ($P$)**: Real-time and archival precipitation data from CHIRPS and ERA5-Land to identify "hydro-meteorological stress" zones.

$$RPI = f(ISI, \theta, P)$$

### 2. Multi-Sensor Data Fusion
UrbanRunoff IQ integrates distinct satellite constellations to provide a comprehensive hydrological picture:
- **Optical (Sentinel-2)**: High-resolution (10m) LULC and urban morphology mapping.
- **Topographic (NASADEM)**: High-accuracy elevation data for hydrological flow accumulation analysis.
- **Meteorological (CHIRPS/ERA5)**: Spatiotemporal rainfall distribution and cumulative stress metrics.

---

## 🛠️ Technical Innovations

### Scalable "Smart Chunking" Tiling Logic
Traditional GEE applications often fail when processing high-resolution (10m) data over large metropolitan areas due to memory constraints (`User Memory Limit Exceeded`). 
**UrbanRunoff IQ** implements a custom **Recursive Tiling Architecture** that:
1. Dynamically divides the viewport into a 16-tile grid.
2. Synchronizes data requests across tiles to maintain seamless visualization.
3. Enables high-fidelity (10m) analytic exports that are otherwise impossible on the standard GEE client.

---

## 📖 Application in WSUD & Green Infrastructure
This tool is designed to support **Water-Sensitive Urban Design (WSUD)** and **Nature-Based Solutions (NBS)** by:
- **Critical Node Identification**: Locating "Drainage Critical Points" where high RPI values overlap with steep terrain and intense rainfall.
- **Placement Optimization**: Providing evidence-based justifications for the placement of retention basins, bioswales, and green roofs in Australian coastal cities.

---

## 🎓 About the Researcher
Developed by **Drubo Paul** (Geospatial Data Scientist, IWM) as a technical demonstration of preparedness for PhD research at the **University of Queensland (UQ)**.

- **Portfolio**: [drubo-portfolio.vercel.app](https://drubo-portfolio.vercel.app)
- **Email**: [pdrubo064@gmail.com](mailto:pdrubo064@gmail.com)

---
*Disclaimer: This platform is for research and demonstration purposes. Cross-validation with ground-truth radar (Sentinel-1) data is recommended for emergency response.*
