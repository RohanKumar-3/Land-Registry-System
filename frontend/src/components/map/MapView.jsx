import { useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FiNavigation } from 'react-icons/fi';

const STATUS_COLORS = {
  verified: '#4a7c59',
  pending:  '#d97706',
  flagged:  '#dc2626',
  rejected: '#475569',
};

// Flies map to a given center point
function FlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo([center.lat, center.lng], 15, { duration: 1.5 });
  }, [center, map]);
  return null;
}

// GPS locate button rendered inside the map (bottom-right)
function LiveLocateButton() {
  const map = useMap();

  const handleClick = () => {
    map.locate({ setView: true, maxZoom: 15, enableHighAccuracy: true });

    map.once('locationfound', (e) => {
      // Remove previous location marker if any
      map.eachLayer((layer) => {
        if (layer._isUserLocation) map.removeLayer(layer);
      });

      const marker = L.circleMarker(e.latlng, {
        radius: 8,
        color: '#9e7a4f',
        fillColor: '#e2b077',
        fillOpacity: 0.85,
        weight: 2.5,
      });
      marker._isUserLocation = true;
      marker.addTo(map).bindPopup('📍 Your location').openPopup();
    });

    map.once('locationerror', () => {
      alert('Could not get your location. Please allow location access in your browser.');
    });
  };

  return (
    <div
      className="leaflet-bottom leaflet-right"
      style={{ marginBottom: '32px', marginRight: '10px' }}
    >
      <div className="leaflet-control">
        <button
          onClick={handleClick}
          title="Go to my location"
          style={{
            background: '#1e293b',
            border: '1px solid #9e7a4f',
            color: '#e2b077',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#9e7a4f';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#1e293b';
            e.currentTarget.style.color = '#e2b077';
          }}
        >
          <FiNavigation size={16} />
        </button>
      </div>
    </div>
  );
}

export default function MapView({
  parcels = [],
  center,
  height = '500px',
  onParcelClick,
  showLocate = true,   // toggle GPS button
}) {
  return (
    <div
      style={{ height }}
      className="rounded-xl overflow-hidden border border-slate-800"
    >
      <MapContainer
        center={
          center
            ? [center.lat, center.lng]
            : [20.5937, 78.9629]   // Default: center of India
        }
        zoom={center ? 14 : 5}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        {/* Base map — OpenStreetMap */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
        />

        {/* Fly to center when prop changes */}
        {center && <FlyTo center={center} />}

        {/* GPS locate button */}
        {showLocate && <LiveLocateButton />}

        {/* Render each parcel as a polygon */}
        {parcels.map(parcel => {
          if (!parcel.boundaries?.length) return null;

          // boundaries stored as [[lng, lat], ...] — Leaflet needs [[lat, lng], ...]
          const positions = parcel.boundaries.map(([lng, lat]) => [lat, lng]);
          const color = STATUS_COLORS[parcel.verificationStatus] || STATUS_COLORS.pending;

          return (
            <Polygon
              key={parcel._id}
              positions={positions}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.22,
                weight: 2.5,
              }}
              eventHandlers={{
                click: () => onParcelClick?.(parcel),
              }}
            >
              <Popup>
                <div
                  style={{
                    background: '#0f172a',
                    color: '#e2e8f0',
                    borderRadius: '8px',
                    minWidth: '170px',
                    padding: '10px',
                    fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                    {parcel.title}
                  </p>
                  <p style={{ fontSize: '11px', color: '#64748b' }}>
                    {parcel.location?.district}, {parcel.location?.state}
                  </p>
                  <p style={{ fontSize: '11px', marginTop: '4px', color: '#94a3b8' }}>
                    AI Score:{' '}
                    <strong style={{ color: parcel.verificationScore >= 70 ? '#4ade80' : parcel.verificationScore >= 40 ? '#fbbf24' : '#f87171' }}>
                      {parcel.verificationScore ?? 'N/A'}
                    </strong>
                  </p>
                  <p style={{ fontSize: '11px', color: '#64748b', textTransform: 'capitalize' }}>
                    {parcel.landType} · {(parcel.areaInSqMeters / 10000).toFixed(2)} ha
                  </p>
                  <Link
                    to={`/parcels/${parcel._id}`}
                    style={{
                      display: 'block',
                      marginTop: '8px',
                      background: '#9e7a4f',
                      color: '#fff',
                      textAlign: 'center',
                      padding: '4px 0',
                      borderRadius: '6px',
                      fontSize: '11px',
                      textDecoration: 'none',
                    }}
                  >
                    View Details →
                  </Link>
                </div>
              </Popup>
            </Polygon>
          );
        })}
      </MapContainer>
    </div>
  );
}