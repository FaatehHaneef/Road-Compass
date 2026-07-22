import { useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// --- OSRM Polyline Decoder ---
// OSRM returns encoded polylines by default in the "geometry" field if geojson isn't used properly,
// but in our backend we requested "geojson", so geometry is already a GeoJSON dict: { coordinates: [[lon, lat], ...] }

// Custom Icons
const createIcon = (color) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })
}

const ICONS = {
  origin: createIcon('green'),
  pickup: createIcon('blue'),
  dropoff: createIcon('red'),
  REST: createIcon('violet'),
  FUEL: createIcon('gold'),
  RESTART: createIcon('black')
}

// Helper to adjust map bounds to fit all markers and lines
const MapUpdater = ({ waypoints, geometries }) => {
  const map = useMap()
  
  useEffect(() => {
    if (!waypoints || waypoints.length === 0) return

    const bounds = L.latLngBounds(waypoints.map(wp => [wp.lat, wp.lon]))
    
    // Also include geometries in bounds
    if (geometries) {
      geometries.forEach(geo => {
        if (geo && geo.coordinates) {
          geo.coordinates.forEach(coord => {
            // GeoJSON is [lon, lat], Leaflet is [lat, lon]
            bounds.extend([coord[1], coord[0]])
          })
        }
      })
    }

    map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1 })
  }, [map, waypoints, geometries])

  return null
}

const MapView = ({ waypoints, geometries }) => {
  // Center of USA as default
  const defaultCenter = [39.8283, -98.5795]
  const defaultZoom = 4

  // Extract polyline paths
  const paths = []
  if (geometries) {
    geometries.forEach((geo, idx) => {
      if (geo && geo.coordinates) {
        // GeoJSON coordinates are [lon, lat], Leaflet Polyline expects [lat, lon]
        const latLngs = geo.coordinates.map(c => [c[1], c[0]])
        paths.push(
          <Polyline 
            key={`path-${idx}`} 
            positions={latLngs} 
            color={idx === 0 ? 'var(--accent)' : 'var(--accent-purple)'}
            weight={4} 
            opacity={0.8} 
          />
        )
      }
    })
  }

  return (
    <MapContainer 
      center={defaultCenter} 
      zoom={defaultZoom} 
      style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      
      {waypoints && waypoints.map((wp, idx) => (
        <Marker key={idx} position={[wp.lat, wp.lon]} icon={ICONS[wp.type] || ICONS.origin}>
          <Popup>
            <div style={{ fontFamily: 'var(--font-sans)' }}>
              <strong>{wp.label}</strong><br/>
              {wp.name}
            </div>
          </Popup>
        </Marker>
      ))}

      {paths}
      
      <MapUpdater waypoints={waypoints} geometries={geometries} />
    </MapContainer>
  )
}

export default MapView
