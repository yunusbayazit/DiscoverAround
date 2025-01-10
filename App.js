import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Alert, Platform, LogBox, Dimensions } from 'react-native';
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

// Yerel POI veritabanı
const LOCAL_PLACES_DB = [
  {
    name: "Anıtkabir",
    geometry: {
      location: {
        lat: 39.925533,
        lng: 32.836417
      }
    },
    types: ["müze", "tarihi_yer"]
  },
  {
    name: "Kızılay Meydanı",
    geometry: {
      location: {
        lat: 29.126103664414654 ,
        lng: 40.92349702003389
      }
    },
    types: ["meydan"]
  },
  {
    name: "TBMM",
    geometry: {
      location: {
        lat: 39.911268,
        lng: 32.850749
      }
    },
    types: ["resmi_bina"]
  },
  {
    name: "Maltepe Sahil",
    geometry: {
      location: {
        lat: 40.919869,
        lng: 29.127878
      }
    },
    types: ["park", "sahil"]
  },
  {
    name: "Maltepe Meydanı",
    geometry: {
      location: {
        lat: 40.922241,
        lng: 29.129386
      }
    },
    types: ["meydan"]
  },
  {
    name: "Dragos Tepesi",
    geometry: {
      location: {
        lat: 40.914722,
        lng: 29.127778
      }
    },
    types: ["park", "manzara"]
  },
  {
    name: "Başıbüyük Hastanesi",
    geometry: {
      location: {
        lat: 40.927778,
        lng: 29.131944
      }
    },
    types: ["hastane"]
  },
  {
    name: "Maltepe Üniversitesi",
    geometry: {
      location: {
        lat: 40.928889,
        lng: 29.130833
      }
    },
    types: ["üniversite"]
  },
  {
    name: "Maltepe Park AVM",
    geometry: {
      location: {
        lat: 40.922500,
        lng: 29.128611
      }
    },
    types: ["avm"]
  },
  {
    name: "Espressolab Maltepe Sahil",
    geometry: {
      location: {
        lat: 40.919444,
        lng: 29.127222
      }
    },
    types: ["kafe", "kahve"]
  },
  {
    name: "Pelit Pastanesi Maltepe",
    geometry: {
      location: {
        lat: 40.919722,
        lng: 29.127500
      }
    },
    types: ["pastane", "cafe"]
  },
  {
    name: "Starbucks Maltepe Sahil",
    geometry: {
      location: {
        lat: 40.919556,
        lng: 29.127111
      }
    },
    types: ["kafe", "kahve"]
  },
  {
    name: "Kahve Dünyası Maltepe",
    geometry: {
      location: {
        lat: 40.919333,
        lng: 29.127444
      }
    },
    types: ["kafe", "kahve"]
  },
  {
    name: "Burger King Maltepe Sahil",
    geometry: {
      location: {
        lat: 40.919778,
        lng: 29.126889
      }
    },
    types: ["restoran", "fast-food"]
  },
  {
    name: "Midpoint Maltepe",
    geometry: {
      location: {
        lat: 40.919222,
        lng: 29.127667
      }
    },
    types: ["restoran"]
  },
  {
    name: "Big Chefs Maltepe",
    geometry: {
      location: {
        lat: 40.919111,
        lng: 29.127889
      }
    },
    types: ["restoran", "kafe"]
  },
  {
    name: "Mado Maltepe Sahil",
    geometry: {
      location: {
        lat: 40.919444,
        lng: 29.127333
      }
    },
    types: ["kafe", "dondurma"]
  },
  {
    name: "Köfteci Yusuf Maltepe",
    geometry: {
      location: {
        lat: 40.919667,
        lng: 29.127000
      }
    },
    types: ["restoran", "köfte"]
  },
  {
    name: "HD İskender Maltepe",
    geometry: {
      location: {
        lat: 40.919889,
        lng: 29.126778
      }
    },
    types: ["restoran", "iskender"]
  },
  {
    name: "Baklava Sarayı",
    geometry: {
      location: {
        lat: 40.919333,
        lng: 29.127556
      }
    },
    types: ["tatlıcı", "baklava"]
  },
  {
    name: "Özsüt Maltepe",
    geometry: {
      location: {
        lat: 40.919222,
        lng: 29.127778
      }
    },
    types: ["pastane", "tatlıcı"]
  }
  // Daha fazla yer ekleyebilirsiniz
];

const App = () => {
  const [places, setPlaces] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [deviceOrientation, setDeviceOrientation] = useState(0);
  const [cameraPermission, setCameraPermission] = useState(false);
  
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
    const setupPermissionsAndTracking = async () => {
      const hasPermission = await requestLocationPermission();
      if (hasPermission) {
        startLocationTracking();
      }
    };
    setupPermissionsAndTracking();
  }, []);

  // Pusula yönünü izle
  useEffect(() => {
    const degree_update_rate = 3;
    CompassHeading.start(degree_update_rate, ({heading}) => {
      setDeviceOrientation(heading);
    });

    return () => {
      CompassHeading.stop();
    };
  }, []);

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

  const startLocationTracking = () => {
    Geolocation.watchPosition(
      position => {
        console.log('Konum alındı:', position);
        console.log('Konum alındı:', position.coords.latitude);
        console.log('Konum alındı:', position.coords.longitude);
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        fetchNearbyPlaces(position.coords.latitude, position.coords.longitude);
      },
      error => {
        console.log('Location error:', error);
        Alert.alert(
          'Konum Hatası',
          'Konumunuza erişilemedi. Lütfen konum servislerini açtığınızdan emin olun.',
          [{ text: 'Tamam' }]
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
    );
  };

  const fetchNearbyPlaces = (latitude, longitude) => {
    try {
      console.log('fetchNearbyPlaces çağrıldı');
      // Mevcut konuma yakın yerleri filtrele (1 km içindekiler)
      const nearbyPlaces = LOCAL_PLACES_DB.filter(place => {
        const distance = getDistance(
          latitude,
          longitude,
          place.geometry.location.lat,
          place.geometry.location.lng
        );
        return distance <= 1; // 1 km yarıçap
      });

      console.log('nearbyPlaces:', nearbyPlaces);

      setPlaces(nearbyPlaces);
    } catch (error) {
      console.error('Error fetching places:', error);
    }
  };

  const renderPlaceMarkers = () => {
    return (
      <View style={styles.markersContainer}>
        {places.map((place, index) => {
          const bearing = calculateBearing(
            currentLocation.latitude,
            currentLocation.longitude,
            place.geometry.location.lat,
            place.geometry.location.lng
          );

          const distance = getDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            place.geometry.location.lat,
            place.geometry.location.lng
          );

          // Görüş açısı kontrolü
          if (isInViewport(bearing, deviceOrientation)) {
            console.log('Görüş açısında:', place.name, 'Mesafe:', distance, 'Yön:', bearing);
            
            // Ekran genişliğine göre yatay pozisyon hesapla
            const screenWidth = Dimensions.get('window').width;
            const horizontalOffset = ((bearing - deviceOrientation + 30) / 60) * screenWidth;

            return (
              <View
                key={index}
                style={[
                  styles.placeMarker,
                  {
                    left: horizontalOffset,
                    top: '40%', // Ekranın biraz üstünde göster
                  },
                ]}
              >
                <View style={styles.markerPointer} />
                <View style={styles.markerContent}>
                  <Text style={styles.placeName}>{place.name}</Text>
                  <Text style={styles.placeDistance}>{distance.toFixed(1)} km</Text>
                  <Text style={styles.placeType}>{place.types[0]}</Text>
                </View>
              </View>
            );
          }
          return null;
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
    pointerEvents: 'none',
  },
  placeMarker: {
    position: 'absolute',
    alignItems: 'center',
    width: 150,
    transform: [{ translateX: -75 }], // Merkeze hizala
  },
  markerPointer: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(0, 0, 0, 0.8)',
  },
  markerContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  placeName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  placeDistance: {
    color: '#4CAF50',
    fontSize: 14,
    marginTop: 4,
  },
  placeType: {
    color: '#FFC107',
    fontSize: 12,
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
});

export default App; 