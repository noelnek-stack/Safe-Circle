import { MapContainer, TileLayer, Marker, Circle, Polyline, Popup, useMap } from 'react-leaflet'
import { divIcon } from 'leaflet'
import { useEffect } from 'react'

function dotIcon(color, pulse = false) {
  return divIcon({
    className: '',
    html: `<span style="position:relative;display:block;width:16px;height:16px;">
        ${pulse ? `<span class="pulse-ring" style="color:${color};position:absolute;inset:-8px;"></span>` : ''}
        <span style="position:absolute;inset:0;background:${color};border:2px solid white;border-radius:9999px;box-shadow:0 1px 4px rgba(0,0,0,.35);"></span>
      </span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function Recenter({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.flyTo(center, map.getZoom(), { duration: 0.8 })
  }, [center?.[0], center?.[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

const ZONE_HEX = { critical: '#C7402F', warning: '#B8863B' }

export default function MapView({
  center = [24.8607, 67.0011],
  zoom = 14,
  userPosition,
  dangerZones = [],
  routeCoords,
  markers = [],
  startLocation,
  className = 'h-full w-full',
  scrollWheelZoom = true,
}) {
  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={scrollWheelZoom}
        style={{ height: '100%', width: '100%', borderRadius: 'inherit' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Recenter center={center} />

        {dangerZones.map((z) => (
          <Circle
            key={z.id}
            center={[z.lat, z.lng]}
            radius={z.radius}
            pathOptions={{
              color: ZONE_HEX[z.level] || ZONE_HEX.warning,
              fillColor: ZONE_HEX[z.level] || ZONE_HEX.warning,
              fillOpacity: 0.12,
              weight: 1.5,
            }}
          >
            <Popup>
              <strong>{z.name}</strong>
              <br />
              {z.level === 'critical' ? 'Reported unsafe — avoid if possible' : 'Caution advised'}
            </Popup>
          </Circle>
        ))}

        {userPosition && (
          <Marker position={[userPosition.lat, userPosition.lng]} icon={dotIcon('#2F5D42', true)}>
            <Popup>{userPosition.label || 'You are here'}</Popup>
          </Marker>
        )}

        {startLocation && (
          <Marker position={[startLocation.lat, startLocation.lng]} icon={dotIcon('#5B5A8C')}>
            <Popup>{startLocation.label || 'Starting point'}</Popup>
          </Marker>
        )}

        {markers.map((m, i) => (
          <Marker
            key={m.id || i}
            position={[m.lat, m.lng]}
            icon={dotIcon(m.color || '#5B5A8C')}
            eventHandlers={m.onClick ? { click: m.onClick } : undefined}
          >
            {m.label && (
              <Popup>
                <div>
                  <span>{m.label}</span>
                  {m.onClick && (
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={m.onClick}
                        className="text-xs font-semibold text-[var(--moss-deep)] underline"
                      >
                        Get directions
                      </button>
                    </div>
                  )}
                </div>
              </Popup>
            )}
          </Marker>
        ))}

        {routeCoords && routeCoords.length > 1 && (
          <Polyline positions={routeCoords} pathOptions={{ color: '#2F5D42', weight: 4, opacity: 0.85 }} />
        )}
      </MapContainer>
    </div>
  )
}
