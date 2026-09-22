import { useEffect, useRef, useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  useMap
} from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import * as turf from "@turf/turf";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { FiNavigation, FiTrash2, FiInfo } from "react-icons/fi";
import toast from "react-hot-toast";

/* Fix default marker icon issue */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

/* Map controller for flying to GPS */
function MapController({ userLocation }) {
  const map = useMap();

  useEffect(() => {
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 16, {
        duration: 1.5
      });
    }
  }, [userLocation, map]);

  return null;
}

/* GPS Locate Button */
function LocateButton({ onLocate }) {
  const map = useMap();

  const handleLocate = useCallback(() => {
    toast.loading("Getting your location...", { id: "gps" });

    map.locate({
      setView: false,
      maxZoom: 18,
      enableHighAccuracy: true,
      timeout: 10000
    });

    map.once("locationfound", (e) => {
      toast.success("Location found!", { id: "gps" });

      const loc = { lat: e.latlng.lat, lng: e.latlng.lng };
      onLocate(loc);

      map.flyTo(e.latlng, 16, { duration: 1.5 });

      /* Add marker */
      L.marker(e.latlng)
        .addTo(map)
        .bindPopup("📍 You are here")
        .openPopup();
    });

    map.once("locationerror", () => {
      toast.error("GPS failed. Please allow location access.", {
        id: "gps"
      });
    });
  }, [map, onLocate]);

  return (
    <div className="leaflet-top leaflet-left" style={{ marginTop: "80px" }}>
      <div className="leaflet-control">
        <button
          onClick={handleLocate}
          title="Go to my location"
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            color: "#94a3b8",
            width: "34px",
            height: "34px",
            borderRadius: "6px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => {
            e.target.style.color = "#e2b077";
            e.target.style.borderColor = "#9e7a4f";
          }}
          onMouseLeave={(e) => {
            e.target.style.color = "#94a3b8";
            e.target.style.borderColor = "#334155";
          }}
        >
          <FiNavigation />
        </button>
      </div>
    </div>
  );
}

export default function ParcelDrawer({
  onBoundariesChange,
  onCenterChange,
  onAreaChange
}) {
  const featureGroupRef = useRef(null);
  const [userLocation, setUserLocation] = useState(null);
  const [areaHectares, setAreaHectares] = useState(null);
  const [instructionStep, setInstructionStep] = useState(0);

  const INSTRUCTIONS = [
    "📍 Click the GPS button to jump to your location",
    "✏️ Click the polygon tool (pentagon icon)",
    "🖱️ Click points on the map to draw your land",
    "✅ Double-click to finish polygon"
  ];

  /* Calculate polygon area */
  const calculateArea = useCallback((layer) => {
    const latlngs = layer.getLatLngs()[0];

    const coords = latlngs.map((ll) => [ll.lng, ll.lat]);
    coords.push(coords[0]);

    const polygon = turf.polygon([coords]);
    const areaSqM = turf.area(polygon);
    const areaHa = areaSqM / 10000;

    setAreaHectares(areaHa.toFixed(3));

    return { areaSqM, boundaries: coords };
  }, []);

  /* When polygon created */
  const handleCreated = useCallback(
    (e) => {
      const { layer } = e;

      const { areaSqM, boundaries } = calculateArea(layer);

      const center = layer.getBounds().getCenter();

      onBoundariesChange(boundaries);
      onCenterChange({ lat: center.lat, lng: center.lng });

      if (onAreaChange) onAreaChange(Math.round(areaSqM));

      setInstructionStep(4);

      toast.success(
        `Boundary drawn! Area: ${(areaSqM / 10000).toFixed(3)} hectares`
      );
    },
    [calculateArea, onBoundariesChange, onCenterChange, onAreaChange]
  );

  /* When polygon edited */
  const handleEdited = useCallback(
    (e) => {
      e.layers.eachLayer((layer) => {
        const { areaSqM, boundaries } = calculateArea(layer);
        const center = layer.getBounds().getCenter();

        onBoundariesChange(boundaries);
        onCenterChange({ lat: center.lat, lng: center.lng });

        if (onAreaChange) onAreaChange(Math.round(areaSqM));
      });

      toast.success("Boundary updated!");
    },
    [calculateArea, onBoundariesChange, onCenterChange, onAreaChange]
  );

  /* When polygon deleted */
  const handleDeleted = useCallback(() => {
    setAreaHectares(null);

    onBoundariesChange([]);
    onCenterChange(null);

    if (onAreaChange) onAreaChange(0);

    setInstructionStep(0);

    toast("Boundary cleared", { icon: "🗑️" });
  }, [onBoundariesChange, onCenterChange, onAreaChange]);

  const clearAll = () => {
    if (featureGroupRef.current) {
      featureGroupRef.current.clearLayers();
    }
    handleDeleted();
  };

  return (
    <div className="space-y-3">

      {/* Instructions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {INSTRUCTIONS.map((inst, i) => (
          <div
            key={i}
            className={`px-3 py-2 rounded-lg text-xs border
            ${
              i < instructionStep
                ? "bg-green-700/20 border-green-600/30 text-green-400"
                : i === instructionStep
                ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-300"
                : "bg-slate-800/50 border-slate-700/30 text-slate-600"
            }`}
          >
            {inst}
          </div>
        ))}
      </div>

      {/* Map */}
      <div
        className="rounded-xl overflow-hidden border border-slate-700"
        style={{ height: "460px" }}
      >
        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
        >
          {/* Satellite layer */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles © Esri"
            maxZoom={19}
          />

          {/* Labels */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            opacity={0.7}
          />

          <MapController userLocation={userLocation} />

          <LocateButton
            onLocate={(loc) => {
              setUserLocation(loc);
              setInstructionStep(1);
            }}
          />

          <FeatureGroup ref={featureGroupRef}>
            <EditControl
              position="topright"
              onCreated={handleCreated}
              onEdited={handleEdited}
              onDeleted={handleDeleted}
              draw={{
                rectangle: false,
                circle: false,
                circlemarker: false,
                marker: false,
                polyline: false,
                polygon: {
                  allowIntersection: false,
                  showArea: true,
                  shapeOptions: {
                    color: "#9e7a4f",
                    fillColor: "#9e7a4f",
                    fillOpacity: 0.25,
                    weight: 2.5
                  }
                }
              }}
              edit={{
                featureGroup: featureGroupRef,
                remove: true
              }}
            />
          </FeatureGroup>
        </MapContainer>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between">

        {areaHectares ? (
          <div className="text-green-400 text-sm">
            Area: <span className="font-mono">{areaHectares}</span> hectares
          </div>
        ) : (
          <div className="text-slate-500 text-sm">
            No boundary drawn yet
          </div>
        )}

        {areaHectares && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 px-3 py-1 text-xs text-red-400
            border border-red-800 rounded-lg hover:bg-red-900/20"
          >
            <FiTrash2 /> Clear boundary
          </button>
        )}
      </div>

      {/* Info */}
      <div className="flex gap-2 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
        <FiInfo className="text-slate-400 mt-0.5" />
        <p className="text-xs text-slate-400">
          Draw your land boundary using satellite imagery. The coordinates will
          be saved and used for your land NFT verification. Area is calculated
          automatically.
        </p>
      </div>
    </div>
  );
}