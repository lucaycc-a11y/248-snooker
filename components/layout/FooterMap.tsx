'use client'

import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { tokens } from '@/app/styles/tokens'

// TODO(Luca): coordinates confirmed by Luca via Google Maps pin-drop for
// 泰力工業中心, 32 Tai Yau Street, San Po Kong — double-check the exact unit
// (3/F 05室) still lines up with this pin if the address ever changes.
export const SPACE8_COORDS: [number, number] = [22.3372097, 114.1973068]

// Leaflet's default marker icon references image URLs that don't resolve
// correctly under Next.js's bundler — build our own from the installed
// leaflet package's own asset files instead of Leaflet's CDN defaults.
const markerIcon = new L.Icon({
  iconUrl: '/leaflet/marker-icon.png',
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  shadowUrl: '/leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

type FooterMapProps = {
  mapsUrl: string
  ariaLabel: string
}

// Free, no-API-key, no-billing dark map thumbnail for the footer — CARTO's
// "Dark Matter" tile set over OpenStreetMap data. Non-interactive (footer
// thumbnail only); the whole thing is a link out to Google Maps for actual
// navigation, same as the old Google Static Maps image was.
export function FooterMap({ mapsUrl, ariaLabel }: FooterMapProps) {
  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      style={{
        display: 'block',
        position: 'relative',
        // Leaflet's internal panes carry z-index 200–900; without a stacking
        // context here they'd escape into the page's root context and paint
        // OVER unrelated UI (the mobile nav menu overlay at z-40 was visibly
        // showing the map through it). isolation contains them all.
        isolation: 'isolate',
        width: '100%',
        maxWidth: '320px',
        aspectRatio: '2 / 1',
        borderRadius: '14px',
        overflow: 'hidden',
        marginBottom: '14px',
        border: `1px solid ${tokens.colors.border}`,
        background: tokens.colors.surface,
      }}
    >
      <MapContainer
        center={SPACE8_COORDS}
        zoom={16}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        zoomControl={false}
        attributionControl={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
        />
        <Marker position={SPACE8_COORDS} icon={markerIcon} />
      </MapContainer>
      {/* Transparent overlay so the whole thumbnail is one click target to
          Google Maps — MapContainer's own DOM would otherwise swallow the
          click since Leaflet still listens for pointer events internally
          even with dragging/zoom disabled. Leaflet's own panes cap out
          around z-index 700, so 800 clears all of them. */}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 800,
          background: 'transparent',
        }}
      />
      {/* CARTO/OSM attribution is a licence requirement — must stay visible
          and clickable even under the overlay above, and match the site's
          low-key dark styling instead of Leaflet's default white pill. */}
      <style jsx global>{`
        .leaflet-control-attribution {
          background: rgba(0, 0, 0, 0.55) !important;
          color: ${tokens.colors.textFaint} !important;
          font-size: 9px !important;
          padding: 1px 4px !important;
          position: relative;
          z-index: 900 !important;
          pointer-events: auto !important;
        }
        .leaflet-control-attribution a {
          color: ${tokens.colors.textMuted} !important;
        }
      `}</style>
    </a>
  )
}
