import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Alert, Platform, LogBox, Dimensions, TouchableOpacity, Modal } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import Geolocation from '@react-native-community/geolocation';
import CompassHeading from 'react-native-compass-heading';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

// LogBox'ı devre dışı bırak
LogBox.ignoreAllLogs();

// Basit bir hata gösterici bileşen
const ErrorDisplay = ({ message }) => (
  <View style={styles.errorContainer}>
    <Text style={styles.errorText}>{message}</Text>
  </View>
);

const PlaceDetailModal = ({ isVisible, place, onClose }) => {
  if (!isVisible || !place) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{place.name}</Text>
          <View style={styles.modalDetails}>
            <Text style={styles.modalDistance}>
              Mesafe: {place.distance.toFixed(1)} km
            </Text>
            <Text style={styles.modalType}>
              Tür: {place.types[0]}
            </Text>
            {Object.entries(place.tags || {}).map(([key, value]) => (
              <Text key={key} style={styles.modalTag}>
                {key}: {value}
              </Text>
            ))}
          </View>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Radius kontrol panelini güncelleyelim
const RadiusControl = ({ searchRadius, onRadiusChange }) => {
  const decreaseRadius = () => {
    console.log('Azaltma tıklandı, mevcut değer:', searchRadius);
    const newRadius = Math.max(0.1, searchRadius - 0.5);
    console.log('Yeni değer:', newRadius);
    onRadiusChange(newRadius);
  };

  const increaseRadius = () => {
    console.log('Artırma tıklandı, mevcut değer:', searchRadius);
    const newRadius = Math.min(5, searchRadius + 0.5);
    console.log('Yeni değer:', newRadius);
    onRadiusChange(newRadius);
  };

  return (
    <View style={styles.radiusControl}>
      <Text style={styles.radiusText}>Arama Yarıçapı: {searchRadius.toFixed(1)} km</Text>
      <View style={styles.radiusButtons}>
        <TouchableOpacity 
          style={styles.radiusButton} 
          onPress={decreaseRadius}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>-</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.radiusButton}
          onPress={increaseRadius}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const App = () => {
  const [places, setPlaces] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [deviceOrientation, setDeviceOrientation] = useState(0);
  const [cameraPermission, setCameraPermission] = useState(false);
  const [searchRadius, setSearchRadius] = useState(1); // km cinsinden yarıçap
  const [selectedPlace, setSelectedPlace] = useState(null);
  
  const device = useCameraDevice('back')

  // Kamera izinlerini al
  useEffect(() => {
    const getPermission = async () => {
      const permission = await Camera.requestCameraPermission();
      console.log('Kamera izni:', permission);
      if (permission === 'denied') {
        Alert.alert('Kamera izni gerekli', 'Lütfen ayarlardan kamera iznini verin');
      }
      setCameraPermission(permission === 'authorized');
    };
    getPermission();
  }, []);

  // Konum izinlerini al
  useEffect(() => {
    const setupLocationTracking = async () => {
      const hasPermission = await requestLocationPermission();
      if (hasPermission) {
        // Konum izleme için watchPosition başlat
        const watchId = Geolocation.watchPosition(
          position => {
            console.log('Yeni konum alındı:', position);
            const newLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            
            setCurrentLocation(newLocation);
            // Yeni konuma göre yerleri güncelle
            throttledFetchNearbyPlaces(newLocation.latitude, newLocation.longitude);
          },
          error => {
            console.log('Konum hatası:', error);
            Alert.alert(
              'Konum Hatası',
              'Konumunuza erişilemedi. Lütfen konum servislerini açtığınızdan emin olun.',
              [{ text: 'Tamam' }]
            );
          },
          { 
            enableHighAccuracy: true, 
            timeout: 20000, 
            maximumAge: 1000,
            distanceFilter: 10 // 10 metre hareket edildiğinde güncelle
          }
        );

        // Cleanup function
        return () => {
          if (watchId) {
            Geolocation.clearWatch(watchId);
          }
        };
      }
    };

    setupLocationTracking();
  }, []); // Sadece component mount olduğunda çalışsın

  // Pusula için useEffect'i güncelle
  useEffect(() => {
    const degree_update_rate = 3;
    
    // Pusula başlat
    CompassHeading.start(degree_update_rate, ({heading}) => {
      setDeviceOrientation(heading);
      // Yön değiştiğinde mevcut konumla yerleri yeniden çek
      if (currentLocation) {
        throttledFetchNearbyPlaces(
          currentLocation.latitude,
          currentLocation.longitude
        );
      }
    });

    return () => {
      CompassHeading.stop();
    };
  }, [currentLocation]); // currentLocation değiştiğinde yeniden bağlan

  // Kamera hazır değilse bekle
  if (!device) {
    return (
      <View style={styles.container}>
        <Text>Kamera başlatılıyor...</Text>
        <Text>Kamera başlatılıyor...</Text>
        <Text>Kamera başlatılıyor...</Text>
        <Text>Kamera başlatılıyor...</Text>
        <Text>Kamera başlatılıyor...</Text>
        <Text>Kamera başlatılıyor...</Text>

      </View>
    );
  }

  const requestLocationPermission = async () => {
    try {
      const permission = Platform.select({
        android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
      });

      const result = await check(permission);

      if (result === RESULTS.DENIED) {
        const permissionResult = await request(permission);
        return permissionResult === RESULTS.GRANTED;
      }

      return result === RESULTS.GRANTED;
    } catch (error) {
      console.error('Error checking location permission:', error);
      return false;
    }
  };

  const fetchNearbyPlaces = async (latitude, longitude) => {
    try {
      console.log('fetchNearbyPlaces çağrıldı, koordinatlar:', latitude, longitude);
      console.log('Arama yarıçapı:', searchRadius, 'km');
      
      // Metre cinsine çevir ve hassas hesapla
      const radiusInMeters = searchRadius * 1000;
      
      const query = `
        [out:json][timeout:25];
        (
          node["shop"](around:${radiusInMeters},${latitude},${longitude});
          node["amenity"="restaurant"](around:${radiusInMeters},${latitude},${longitude});
          node["amenity"="cafe"](around:${radiusInMeters},${latitude},${longitude});
          way["leisure"="park"](around:${radiusInMeters},${latitude},${longitude});
          node["amenity"="school"](around:${radiusInMeters},${latitude},${longitude});
          node["amenity"="hospital"](around:${radiusInMeters},${latitude},${longitude});
          node["amenity"="bank"](around:${radiusInMeters},${latitude},${longitude});
          node["public_transport"="stop_position"](around:${radiusInMeters},${latitude},${longitude});
          way["shop"="mall"](around:${radiusInMeters},${latitude},${longitude});
          node["tourism"="hotel"](around:${radiusInMeters},${latitude},${longitude});
          node["amenity"="pharmacy"](around:${radiusInMeters},${latitude},${longitude});
        );
        out body;
        >;
        out skel qt;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'data=' + encodeURIComponent(query)
      });

      if (!response.ok) {
        throw new Error('Overpass API hatası');
      }

      const data = await response.json();
      console.log('Ham veri sayısı:', data.elements.length);

      // Verileri formatla ve tam olarak belirtilen yarıçap içindekileri filtrele
      const formattedPlaces = data.elements
        .filter(element => {
          if (!element.type === 'node' || !element.tags) return false;
          
          // Mesafeyi hassas hesapla
          const distance = getDistance(
            latitude,
            longitude,
            element.lat,
            element.lon
          );
          
          // Tam olarak belirtilen yarıçap içinde mi kontrol et
          return distance <= searchRadius;
        })
        .map(place => {
          const distance = getDistance(
            latitude,
            longitude,
            place.lat,
            place.lon
          );

          return {
            name: place.tags.name || place.tags['name:tr'] || 'İsimsiz Yer',
            geometry: {
              location: {
                lat: place.lat,
                lng: place.lon
              }
            },
            types: [
              place.tags.shop || 
              place.tags.amenity || 
              place.tags.tourism || 
              place.tags.leisure || 
              'other'
            ],
            distance: distance,
            tags: place.tags
          };
        })
        .sort((a, b) => a.distance - b.distance);

      console.log('Filtrelenmiş yer sayısı:', formattedPlaces.length);
      console.log('En yakın yer mesafesi:', formattedPlaces[0]?.distance);
      console.log('En uzak yer mesafesi:', formattedPlaces[formattedPlaces.length - 1]?.distance);

      setPlaces(formattedPlaces);

    } catch (error) {
      console.error('Yer arama hatası:', error);
      Alert.alert(
        'Hata',
        'Yakındaki yerler alınırken bir hata oluştu: ' + error.message,
        [{ text: 'Tamam' }]
      );
    }
  };

  // Rate limiting için basit bir yardımcı fonksiyon
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Throttled versiyon of fetchNearbyPlaces
  const throttledFetchNearbyPlaces = debounce(fetchNearbyPlaces, 1000);

  const renderPlaceMarkers = () => {
    console.log('renderPlaceMarkers çağrıldı. Places:', places);
    
    // Görüş açısındaki yerleri filtrele
    const visiblePlaces = places.filter(place => {
      if (!place.geometry?.location?.lat || !place.geometry?.location?.lng) return false;
      
      const bearing = calculateBearing(
        currentLocation.latitude,
        currentLocation.longitude,
        place.geometry.location.lat,
        place.geometry.location.lng
      );
      
      return isInViewport(bearing, deviceOrientation);
    });

    // Mesafeye göre sırala
    visiblePlaces.sort((a, b) => a.distance - b.distance);

    // Marker pozisyonlarını takip etmek için bir grid sistemi
    const grid = {};
    const GRID_SIZE = 80; // Grid hücre boyutu (pixel)
    const MARKER_HEIGHT = 70; // Marker yüksekliği

    return (
      <View style={styles.markersContainer}>
        {visiblePlaces.map((place, index) => {
          const bearing = calculateBearing(
            currentLocation.latitude,
            currentLocation.longitude,
            place.geometry.location.lat,
            place.geometry.location.lng
          );

          const screenWidth = Dimensions.get('window').width;
          const baseHorizontalOffset = ((bearing - deviceOrientation + 30) / 60) * screenWidth;
          
          // Grid pozisyonunu hesapla
          const gridX = Math.floor(baseHorizontalOffset / GRID_SIZE);
          let gridY = Math.floor((100 + place.distance * 30) / GRID_SIZE);
          
          // Çakışmaları kontrol et ve çöz
          while (grid[`${gridX},${gridY}`]) {
            gridY++;
          }
          
          // Grid pozisyonunu işaretle
          grid[`${gridX},${gridY}`] = true;

          // Final pozisyonları hesapla
          const horizontalOffset = baseHorizontalOffset;
          const verticalPosition = gridY * GRID_SIZE;

          return (
            <TouchableOpacity
              key={`${place.name}-${index}`}
              style={[styles.placeMarker, {
                left: horizontalOffset,
                top: verticalPosition,
                transform: [
                  { translateX: -75 },
                  { scale: Math.max(0.8, 1 - (place.distance * 0.05)) }
                ],
                opacity: Math.max(0.8, 1 - (place.distance * 0.1))
              }]}
              onPress={() => {
                console.log('Marker tıklandı, yer:', place.name);
                setSelectedPlace(place);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.markerPointer} />
              <View style={styles.markerContent}>
                <Text 
                  style={styles.placeName}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {place.name}
                </Text>
                <View style={styles.markerInfo}>
                  <Text style={styles.placeDistance}>
                    {place.distance.toFixed(1)} km
                  </Text>
                  <Text style={styles.placeType}>
                    {place.types[0]}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const toRad = value => (value * Math.PI) / 180;
    const toDeg = value => (value * 180) / Math.PI;

    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x =
      Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    const bearing = toDeg(Math.atan2(y, x));
    return (bearing + 360) % 360;
  };

  const isInViewport = (bearing, deviceOrientation) => {
    const viewportAngle = 60; // Kamera görüş açısı (derece)
    let diff = Math.abs(bearing - deviceOrientation);
    if (diff > 180) {
      diff = 360 - diff;
    }
    return diff <= viewportAngle / 2;
  };

  const calculateHorizontalOffset = (bearing, deviceOrientation) => {
    const screenWidth = Dimensions.get('window').width;
    const viewportAngle = 60; // Kamera görüş açısı
    
    let diff = bearing - deviceOrientation;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    
    // Görüş açısına göre yatay pozisyonu hesapla
    return (diff / (viewportAngle / 2)) * (screenWidth / 2);
  };

  const calculateVerticalPosition = (distance) => {
    // Uzaklığa göre dikey pozisyon (yakın olan daha aşağıda)
    return Math.min(300, distance * 50);
  };

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Dünya yarıçapı (km)
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toRad = value => (value * Math.PI) / 180;

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        enableZoomGesture
      />
      {currentLocation && renderPlaceMarkers()}
      
      <RadiusControl 
        searchRadius={searchRadius}
        onRadiusChange={(newRadius) => {
          console.log('Yarıçap değişiyor:', newRadius);
          setSearchRadius(newRadius);
          if (currentLocation) {
            // Yeni yarıçapla yerleri hemen güncelle
            fetchNearbyPlaces(
              currentLocation.latitude,
              currentLocation.longitude
            );
          }
        }}
      />

      <PlaceDetailModal 
        isVisible={selectedPlace !== null}
        place={selectedPlace}
        onClose={() => {
          console.log('Modal kapatılıyor');
          setSelectedPlace(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  markersContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  placeMarker: {
    position: 'absolute',
    alignItems: 'center',
    width: 150,
    zIndex: 1000,
  },
  markerPointer: {
    width: 12,
    height: 12,
    backgroundColor: '#FF4081',
    borderRadius: 6,
    marginBottom: 5,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerContent: {
    flexDirection: 'column',
    backgroundColor: 'rgba(33, 33, 33, 0.9)',
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  placeName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  placeDistance: {
    backgroundColor: '#FF4081',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
    marginTop: 2,
  },
  placeType: {
    fontSize: 11,
    color: '#E0E0E0',
    marginTop: 2,
  },
  errorContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 5,
  },
  errorText: {
    color: 'white',
    fontSize: 14,
  },
  radiusControl: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(33, 33, 33, 0.9)',
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 2000, // Üstte görünmesi için
  },
  radiusText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '600',
  },
  radiusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 50,
    marginTop: 10,
  },
  radiusButton: {
    backgroundColor: '#FF4081',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 35,
  },
  placeGroup: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 120,
  },
  groupTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'center',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#212121',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalDetails: {
    marginBottom: 20,
  },
  modalDistance: {
    fontSize: 16,
    color: '#FF4081',
    marginBottom: 8,
  },
  modalType: {
    fontSize: 14,
    color: '#E0E0E0',
    marginBottom: 8,
  },
  modalTag: {
    fontSize: 13,
    color: '#9E9E9E',
    marginBottom: 4,
  },
  closeButton: {
    backgroundColor: '#FF4081',
    padding: 12,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default App; 