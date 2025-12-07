'use client';

/**
 * Location Settings Page
 * Full location management interface with map, saved locations, and history
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatNavbar from '@/components/ChatNavbar';
import LocationMap, { SavedLocation } from '@/components/LocationMap';
import LocationList from '@/components/LocationList';
import LocationHistory from '@/components/LocationHistory';
import LocationLabelInput from '@/components/LocationLabelInput';
import LocationPrivacyToggle from '@/components/LocationPrivacyToggle';
import { colors } from '@/lib/config';
import { getCurrentPosition, isGeolocationSupported } from '@/lib/location/browserGeolocation';

function LocationSettingsContent() {
  const searchParams = useSearchParams();
  const [recordId, setRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Location data
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  
  // UI state
  const [activeTab, setActiveTab] = useState<'map' | 'history'>('map');
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationCoords, setNewLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [newLocationLabel, setNewLocationLabel] = useState('');
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [editingLocation, setEditingLocation] = useState<SavedLocation | null>(null);

  useEffect(() => {
    const urlRecordId = searchParams?.get('recordId');
    const storedRecordId = typeof window !== 'undefined' 
      ? localStorage.getItem('myKendallRecordId') 
      : null;
    
    const finalRecordId = urlRecordId || storedRecordId;
    
    if (finalRecordId) {
      setRecordId(finalRecordId);
      if (urlRecordId && typeof window !== 'undefined') {
        localStorage.setItem('myKendallRecordId', urlRecordId);
      }
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (recordId) {
      fetchSavedLocations();
      checkLocationPermission();
    }
  }, [recordId]);

  const checkLocationPermission = async () => {
    if (typeof window !== 'undefined' && navigator.permissions) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setLocationPermission(result.state as 'granted' | 'denied' | 'prompt');
      } catch {
        setLocationPermission('unknown');
      }
    }
  };

  const fetchSavedLocations = async () => {
    if (!recordId) return;

    try {
      const response = await fetch(`/api/location?userId=${recordId}&type=saved`);
      if (response.ok) {
        const data = await response.json();
        setSavedLocations(data.locations || []);
      }
    } catch (error) {
      console.error('Failed to fetch saved locations:', error);
    }
  };

  const handleRequestLocation = async () => {
    if (!isGeolocationSupported()) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    try {
      const position = await getCurrentPosition({ enableHighAccuracy: true });
      setCurrentLocation({ lat: position.latitude, lng: position.longitude });
      setLocationPermission('granted');
      
      // Auto-save current location
      await saveLocation(recordId!, position.latitude, position.longitude, undefined, 'browser');
    } catch (error: any) {
      if (error.code === 'PERMISSION_DENIED') {
        setLocationPermission('denied');
        alert('Location permission denied. Please enable location access in your browser settings.');
      } else {
        alert(`Failed to get location: ${error.message}`);
      }
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    setNewLocationCoords({ lat, lng });
    setNewLocationLabel('');
    setShowAddLocation(true);
  };

  const handleLocationClick = (location: SavedLocation) => {
    setEditingLocation(location);
    setNewLocationLabel(location.label);
    setNewLocationCoords({ lat: location.latitude, lng: location.longitude });
    setShowAddLocation(true);
  };

  const saveLocation = async (
    userId: string,
    lat: number,
    lng: number,
    label?: string,
    source: string = 'manual'
  ) => {
    if (!label) {
      // Try to geocode the address
      try {
        const geocodeResponse = await fetch(
          `/api/geocode?latitude=${lat}&longitude=${lng}&permanent=true&userId=${userId}`
        );
        if (geocodeResponse.ok) {
          const geocodeData = await geocodeResponse.json();
          label = geocodeData.result?.formatted_address || 'Custom Location';
        }
      } catch (e) {
        console.warn('Failed to geocode:', e);
      }
    }

    if (!label) {
      label = 'Custom Location';
    }

    try {
      const response = await fetch('/api/location', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          label,
          latitude: lat,
          longitude: lng,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save location');
      }

      await fetchSavedLocations();
      return true;
    } catch (error) {
      console.error('Failed to save location:', error);
      throw error;
    }
  };

  const handleSaveLocation = async () => {
    if (!recordId || !newLocationCoords || !newLocationLabel.trim()) {
      alert('Please enter a label for this location');
      return;
    }

    setIsSavingLocation(true);
    try {
      await saveLocation(
        recordId,
        newLocationCoords.lat,
        newLocationCoords.lng,
        newLocationLabel.trim(),
        'manual'
      );
      
      setShowAddLocation(false);
      setNewLocationCoords(null);
      setNewLocationLabel('');
      setEditingLocation(null);
    } catch (error) {
      alert('Failed to save location. Please try again.');
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!recordId) return;

    try {
      const location = savedLocations.find(loc => loc.id === locationId);
      if (!location) return;

      const response = await fetch(
        `/api/location?userId=${recordId}&label=${encodeURIComponent(location.label)}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        await fetchSavedLocations();
      } else {
        throw new Error('Failed to delete location');
      }
    } catch (error) {
      console.error('Failed to delete location:', error);
      alert('Failed to delete location. Please try again.');
    }
  };

  if (loading || !recordId) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{
          backgroundColor: colors.primary,
          paddingTop: '80px',
        }}
      >
        <div style={{ color: colors.text, opacity: 0.6 }}>
          {loading ? 'Loading...' : 'Please provide a recordId parameter'}
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: colors.primary }}
    >
      <ChatNavbar recordId={recordId} />
      
      <div className="flex-1 overflow-hidden" style={{ paddingTop: '100px', height: 'calc(100vh - 100px)' }}>
        <div className="flex flex-col lg:flex-row" style={{ height: '100%' }}>
          {/* Left side: Map (70% on desktop) */}
          <div 
            className="flex-1 lg:w-[70%] relative" 
            style={{ 
              height: '100%',
              position: 'relative',
              minHeight: '400px',
            }}
          >
            <LocationMap
              savedLocations={savedLocations}
              currentLocation={currentLocation}
              onMapClick={handleMapClick}
              onLocationClick={handleLocationClick}
              height="100%"
            />
            
            {/* Map controls overlay */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
              <div className="flex gap-2">
                <button
                  onClick={handleRequestLocation}
                  className="px-4 py-2 text-sm rounded transition-colors"
                  style={{
                    backgroundColor: colors.secondary,
                    color: colors.text,
                    border: `1px solid ${colors.accent}40`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = colors.secondary;
                  }}
                >
                  📍 Get Current Location
                </button>
              </div>
            </div>
          </div>

          {/* Right side: Controls (30% on desktop) */}
          <div className="lg:w-[30%] h-[50vh] lg:h-full flex flex-col border-t lg:border-t-0 lg:border-l" style={{ borderColor: colors.secondary }}>
            {/* Tabs */}
            <div className="flex border-b" style={{ borderColor: colors.secondary }}>
              <button
                onClick={() => setActiveTab('map')}
                className="flex-1 px-4 py-3 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: activeTab === 'map' ? colors.secondary : 'transparent',
                  color: colors.text,
                  borderBottom: activeTab === 'map' ? `2px solid ${colors.accent}` : '2px solid transparent',
                }}
              >
                Saved Locations
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className="flex-1 px-4 py-3 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: activeTab === 'history' ? colors.secondary : 'transparent',
                  color: colors.text,
                  borderBottom: activeTab === 'history' ? `2px solid ${colors.accent}` : '2px solid transparent',
                }}
              >
                History
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'map' ? (
                <div className="space-y-4">
                  {/* Privacy Toggle */}
                  <LocationPrivacyToggle userId={recordId} />
                  
                  {/* Saved Locations List */}
                  <div>
                    <h3 className="text-sm font-medium mb-3" style={{ color: colors.text }}>
                      Saved Locations ({savedLocations.length})
                    </h3>
                    <LocationList
                      locations={savedLocations}
                      onEdit={handleLocationClick}
                      onDelete={handleDeleteLocation}
                      onSelect={(loc) => {
                        // Center map on selected location
                        setCurrentLocation({ lat: loc.latitude, lng: loc.longitude });
                      }}
                    />
                  </div>
                </div>
              ) : (
                <LocationHistory
                  userId={recordId}
                  onItemClick={(item) => {
                    setCurrentLocation({ lat: item.latitude, lng: item.longitude });
                    setActiveTab('map');
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Location Modal */}
      {showAddLocation && newLocationCoords && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => {
            setShowAddLocation(false);
            setNewLocationCoords(null);
            setEditingLocation(null);
          }}
        >
          <div
            className="relative w-full max-w-md rounded-xl p-6"
            style={{
              backgroundColor: colors.primary,
              border: `1px solid ${colors.secondary}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium mb-4" style={{ color: colors.text }}>
              {editingLocation ? 'Edit Location' : 'Add Location'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs block mb-2" style={{ color: colors.text, opacity: 0.7 }}>
                  Label
                </label>
                <LocationLabelInput
                  value={newLocationLabel}
                  onChange={setNewLocationLabel}
                  placeholder="Enter location label..."
                />
              </div>
              
              <div>
                <label className="text-xs block mb-2" style={{ color: colors.text, opacity: 0.7 }}>
                  Coordinates
                </label>
                <p className="text-sm" style={{ color: colors.text, opacity: 0.8 }}>
                  {newLocationCoords.lat.toFixed(6)}, {newLocationCoords.lng.toFixed(6)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddLocation(false);
                  setNewLocationCoords(null);
                  setEditingLocation(null);
                }}
                className="px-4 py-2 text-sm rounded transition-colors"
                style={{
                  color: colors.text,
                  opacity: 0.7,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.backgroundColor = colors.secondary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.7';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLocation}
                disabled={isSavingLocation || !newLocationLabel.trim()}
                className="px-4 py-2 text-sm rounded transition-colors font-medium"
                style={{
                  backgroundColor: isSavingLocation || !newLocationLabel.trim() ? colors.secondary : colors.accent,
                  color: isSavingLocation || !newLocationLabel.trim() ? colors.text : colors.primary,
                  opacity: isSavingLocation || !newLocationLabel.trim() ? 0.5 : 1,
                }}
              >
                {isSavingLocation ? 'Saving...' : editingLocation ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function LocationSettingsPage() {
  return (
    <Suspense fallback={
      <main
        className="min-h-screen flex items-center justify-center"
        style={{
          backgroundColor: colors.primary,
          paddingTop: '80px',
        }}
      >
        <div style={{ color: colors.text, opacity: 0.6 }}>Loading...</div>
      </main>
    }>
      <LocationSettingsContent />
    </Suspense>
  );
}

