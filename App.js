import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, useColorScheme, Animated, PanResponder, Switch, Alert, Easing, TextInput, Keyboard, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const gerarVagasMock = () => {
  return Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    status: Math.random() > 0.5 ? 'livre' : 'ocupada'
  }));
};

export default function App() {
  const [location, setLocation] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [vagas, setVagas] = useState(gerarVagasMock());
  
  const systemTheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemTheme === 'dark');
  const [notificacoesGlobais, setNotificacoesGlobais] = useState(true);
  
  const [sinoAtivo, setSinoAtivo] = useState(false);
  const [menuGaveta, setMenuGaveta] = useState('principal');
  
  const [searchQuery, setSearchQuery] = useState('');
  const webViewRef = useRef(null);
  
  const [sheetOpen, setSheetOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current; 
  const fireflyRotate = useRef(new Animated.Value(0)).current;

  const colors = {
    background: isDarkMode ? '#121212' : '#F5F5F5',
    card: isDarkMode ? '#1E1E1E' : '#FFFFFF',
    text: isDarkMode ? '#FFFFFF' : '#1A1A1A',
    livre: 'rgba(34, 197, 94, 0.15)', 
    ocupada: 'rgba(239, 68, 68, 0.15)', 
  };

  useEffect(() => {
    Animated.loop(
      Animated.timing(fireflyRotate, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();

    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        let currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation(currentLocation.coords);
      } catch (error) {
        setLocation({ latitude: -23.6477, longitude: -46.5742 });
      }
    })();
  }, []);

  useEffect(() => {
    if (modalVisible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
        ])
      ).start();
    }
  }, [modalVisible]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();
    
    try {
      const geocoded = await Location.geocodeAsync(searchQuery);
      if (geocoded.length > 0) {
        const { latitude, longitude } = geocoded[0];
        const script = `map.flyTo([${latitude}, ${longitude}], 16); true;`;
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(script);
        }
      } else {
        Alert.alert("Local não encontrado", "Tente pesquisar de forma mais específica (ex: Rua, Cidade).");
      }
    } catch (error) {
      Alert.alert("Erro na Busca", "Não foi possível procurar este endereço no momento.");
    }
  };

  const toggleSheet = () => {
    const toValue = sheetOpen ? 0 : 1;
    Animated.timing(slideAnim, { toValue, duration: 300, useNativeDriver: false }).start();
    setSheetOpen(!sheetOpen);
    
    if (sheetOpen) {
      setTimeout(() => setMenuGaveta('principal'), 300);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      // Intercepta apenas se o utilizador arrastar mais de 10px (preserva cliques normais nos botões)
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy < -30 && !sheetOpen) toggleSheet(); 
        if (gestureState.dy > 30 && sheetOpen) toggleSheet();  
      },
    })
  ).current;

  const sheetHeight = slideAnim.interpolate({
    inputRange: [0, 1], outputRange: [60, 300] 
  });

  const handleBellPress = () => {
    setSinoAtivo(!sinoAtivo);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true })
    ]).start();

    if (!sinoAtivo) {
      Alert.alert("Notificações Ativadas", "Você será avisado assim que uma vaga liberar!");
    } else if (menuGaveta === 'notificacoes') {
      Alert.alert("Notificação Removida", "Alerta para este estacionamento desativado.");
    }
  };

  const bellSpin = shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-20deg', '20deg'] });
  const spinLoader1 = fireflyRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spinLoader2 = fireflyRotate.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  const getMapHtml = (lat, lng) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>body { padding: 0; margin: 0; } html, body, #map { height: 100vh; width: 100vw; }</style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false }).setView([${lat}, ${lng}], 16);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
          
          var parkingIcon = L.divIcon({ 
            className: 'custom-parking-icon', 
            html: '<div style="position: relative; width: 34px; height: 34px;"><div style="background-color: #EAB308; color: #000; width: 34px; height: 34px; display: flex; justify-content: center; align-items: center; border-radius: 50%; font-family: Arial; font-weight: bold; font-size: 18px; border: 3px solid #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.5);">P</div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="34" height="34" style="position: absolute; top: -22px; right: -16px; filter: drop-shadow(0 0 8px #4ADE80); transform: rotate(20deg);"><path d="M12 22C14.2091 22 16 20.2091 16 18C16 15.7909 14.2091 14 12 14C9.79086 14 8 15.7909 8 18C8 20.2091 9.79086 22 12 22Z" fill="#EAB308" /><path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z" fill="#333333"/><path d="M15 10C17.7614 10 20 7.76142 20 5C20 4.44772 19.5523 4 19 4C16.2386 4 14 6.23858 14 9C14 9.35127 14.0363 9.69344 14.1039 10.0227C14.394 10.0077 14.6926 10 15 10Z" fill="#FFFFFF" opacity="0.9"/><path d="M9 10C6.23858 10 4 7.76142 4 5C4 4.44772 4.44772 4 5 4C7.76142 4 10 6.23858 10 9C10 9.35127 9.96374 9.69344 9.89613 10.0227C9.60601 10.0077 9.30739 10 9 10Z" fill="#FFFFFF" opacity="0.9"/><path d="M11 6L10 3" stroke="#333333" stroke-width="1.5" stroke-linecap="round"/><path d="M13 6L14 3" stroke="#333333" stroke-width="1.5" stroke-linecap="round"/></svg></div>', 
            iconSize: [40, 40], iconAnchor: [20, 20] 
          });
          
          var latBlocoG = -23.648500; var lngBlocoG = -46.574500;
          var marker = L.marker([latBlocoG, lngBlocoG], {icon: parkingIcon}).addTo(map);
          marker.on('click', function() { window.ReactNativeWebView.postMessage('ABRIR_VAGAS'); });
        </script>
      </body>
    </html>
  `;

  const renderVaga = (vaga, isEsquerda) => (
    <View key={vaga.id} style={[styles.vaga, isEsquerda ? styles.vagaEsquerda : styles.vagaDireita, { backgroundColor: vaga.status === 'livre' ? colors.livre : colors.ocupada }]}>
      <Text style={[styles.numeroVaga, { opacity: vaga.status === 'ocupada' ? 0.3 : 1 }]}>{vaga.id < 10 ? `0${vaga.id}` : vaga.id}</Text>
      {vaga.status === 'ocupada' && (
        <View style={styles.xContainer}>
          <Text style={[styles.vagaOcupadaX, isEsquerda ? styles.xEsquerda : styles.xDireita]}>X</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      {/* BARRA DE PESQUISA FLUTUANTE */}
      {location && (
        <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
          <Ionicons name="search" size={20} color={colors.text} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Buscar endereço ou local..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>
      )}
      
      {location ? (
        <WebView 
          ref={webViewRef}
          style={styles.map} source={{ html: getMapHtml(location.latitude, location.longitude) }}
          onMessage={(event) => { if (event.nativeEvent.data === 'ABRIR_VAGAS') setModalVisible(true); }}
          javaScriptEnabled={true} bounces={false}
        />
      ) : (
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <View style={styles.fireflyLoaderBox}>
            <Animated.View style={[styles.fireflyOrbit, { transform: [{ rotate: spinLoader1 }] }]}>
              <View style={[styles.firefly, { backgroundColor: '#EAB308', shadowColor: '#EAB308' }]} />
            </Animated.View>
            <Animated.View style={[styles.fireflyOrbit, { position: 'absolute', transform: [{ rotate: spinLoader2 }] }]}>
              <View style={[styles.firefly, { backgroundColor: '#EAB308', shadowColor: '#EAB308' }]} />
            </Animated.View>
          </View>
          <Text style={[styles.loadingText, { color: colors.text }]}>Carregando Vagalume...</Text>
        </View>
      )}

      {/* OVERLAY PARA CLICAR FORA E FECHAR */}
      {sheetOpen && (
        <Pressable 
          style={styles.overlayClick} 
          onPress={toggleSheet} 
        />
      )}

      {/* GAVETA INFERIOR (Agora o PanResponder cobre toda a gaveta) */}
      <Animated.View 
        {...panResponder.panHandlers}
        style={[styles.bottomSheet, { height: sheetHeight, backgroundColor: colors.card }]}
      >
        <View style={styles.dragHandleArea}>
          <View style={styles.dragIndicator} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            {sheetOpen ? (menuGaveta === 'principal' ? "Configurações" : "Gerenciar Notificações") : "Configurações"}
          </Text>
        </View>
        <View style={styles.configContent}>
          
          {menuGaveta === 'principal' ? (
            <>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: colors.text }]}>Modo Escuro</Text>
                <Switch value={isDarkMode} onValueChange={setIsDarkMode} trackColor={{ false: "#767577", true: "#EAB308" }} thumbColor={"#f4f3f4"} />
              </View>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: colors.text }]}>Alertas Gerais</Text>
                <Switch value={notificacoesGlobais} onValueChange={setNotificacoesGlobais} trackColor={{ false: "#767577", true: "#EAB308" }} thumbColor={"#f4f3f4"} />
              </View>
              <TouchableOpacity style={styles.menuButton} onPress={() => setMenuGaveta('notificacoes')}>
                <Text style={[styles.menuButtonText, { color: colors.text }]}>Gerenciar notificações</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.backButton} onPress={() => setMenuGaveta('principal')}>
                <Ionicons name="arrow-back" size={20} color={colors.text} />
                <Text style={[styles.backButtonText, { color: colors.text }]}>Voltar</Text>
              </TouchableOpacity>
              
              {sinoAtivo ? (
                <View style={[styles.notificationCard, { backgroundColor: isDarkMode ? '#2A2A2A' : '#F0F0F0' }]}>
                  <View style={styles.notificationTextContainer}>
                    <Text style={[styles.notificationTitle, { color: colors.text }]}>Estacionamento Bl. G</Text>
                    <Text style={styles.notificationAddress}>Praça Mauá, 1 - São Caetano do Sul</Text>
                  </View>
                  <TouchableOpacity onPress={handleBellPress}>
                    <Animated.View style={{ transform: [{ rotate: bellSpin }] }}>
                      <Ionicons name="notifications" size={26} color="#EAB308" />
                    </Animated.View>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={{color: colors.text, textAlign: 'center', marginTop: 20}}>Nenhuma notificação ativa.</Text>
              )}
            </>
          )}

        </View>
      </Animated.View>

      <Modal animationType="fade" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentRealista}>
            
            <View style={styles.modalHeader}>
                <View style={styles.liveIndicatorContainer}>
                  <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
                  <Text style={styles.liveText}>AO VIVO</Text>
                </View>
                
                <Text style={styles.modalTitleRealista}>ESTACIONAMENTO BL. G</Text>
                
                <TouchableOpacity onPress={handleBellPress}>
                  <Animated.View style={{ transform: [{ rotate: bellSpin }] }}>
                    <Ionicons name={sinoAtivo ? "notifications" : "notifications-outline"} size={26} color={sinoAtivo ? "#EAB308" : "#A3A3A3"} />
                  </Animated.View>
                </TouchableOpacity>
            </View>
            
            <View style={styles.asfaltoContainer}>
              <View style={styles.colunaVagas}>
                {vagas.slice(0, 10).map(v => renderVaga(v, true))}
              </View>
              
              <View style={styles.ruaCentral}>
                 <View style={styles.textoContainer}>
                    <Text style={styles.textoRetorno}>RETORNO</Text>
                 </View>
                 
                 <View style={styles.faixaAmarela} />
                 
                 <View style={styles.textoContainer}>
                    <Text style={styles.textoEntrada}>ENTRADA</Text>
                 </View>
              </View>

              <View style={styles.colunaVagas}>
                {vagas.slice(10, 20).map(v => renderVaga(v, false))}
              </View>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={() => { setModalVisible(false); setVagas(gerarVagasMock()); }}>
              <Text style={styles.closeButtonText}>SAIR DO ESTACIONAMENTO</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, map: { flex: 1 }, loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  searchContainer: { position: 'absolute', top: 50, left: 20, right: 20, height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5, zIndex: 10 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16 },

  fireflyLoaderBox: { width: 60, height: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  fireflyOrbit: { width: 50, height: 50, justifyContent: 'flex-start', alignItems: 'center' },
  firefly: { width: 12, height: 12, borderRadius: 6, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8, elevation: 10 },
  loadingText: { fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  
  // Overlay invisível adicionado
  overlayClick: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 15 },
  // Z-Index aumentado para ficar acima do overlay
  bottomSheet: { position: 'absolute', bottom: 0, width: '100%', borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.2, elevation: 10, zIndex: 20 },
  dragHandleArea: { width: '100%', alignItems: 'center', paddingVertical: 15 }, dragIndicator: { width: 40, height: 5, backgroundColor: '#CCC', borderRadius: 3, marginBottom: 10 }, sheetTitle: { fontSize: 16, fontWeight: 'bold' },
  configContent: { paddingHorizontal: 25, paddingTop: 10 }, configRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }, configLabel: { fontSize: 16 },
  
  menuButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(150,150,150,0.2)', marginTop: 5 },
  menuButtonText: { fontSize: 16 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButtonText: { fontSize: 16, marginLeft: 5, fontWeight: 'bold' },
  notificationCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 10 },
  notificationTextContainer: { flex: 1 },
  notificationTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  notificationAddress: { fontSize: 12, color: '#888' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContentRealista: { width: '95%', height: '85%', alignItems: 'center' },
  
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 15, paddingHorizontal: 5 },
  liveIndicatorContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74, 222, 128, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#4ADE80' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80', marginRight: 6 },
  liveText: { color: '#4ADE80', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  modalTitleRealista: { color: '#EAB308', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  
  asfaltoContainer: { flexDirection: 'row', width: '100%', flex: 1, backgroundColor: '#2B2B2B', borderWidth: 4, borderColor: '#555', borderRadius: 8, paddingVertical: 15, paddingHorizontal: 5 },
  colunaVagas: { width: '36%', justifyContent: 'space-between' },
  
  vaga: { height: '8.5%', justifyContent: 'center', alignItems: 'center', borderColor: '#FFFFFF', position: 'relative' },
  vagaEsquerda: { borderTopWidth: 2, borderBottomWidth: 2, borderRightWidth: 2 },
  vagaDireita: { borderTopWidth: 2, borderBottomWidth: 2, borderLeftWidth: 2 },
  
  numeroVaga: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', opacity: 0.8 },
  xContainer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center' },
  vagaOcupadaX: { color: 'rgba(239, 68, 68, 0.6)', fontSize: 32, fontWeight: '900' }, 
  xEsquerda: { transform: [{ rotate: '-90deg' }, { scaleY: 1.5 }] }, 
  xDireita: { transform: [{ rotate: '90deg' }, { scaleY: 1.5 }] }, 

  ruaCentral: { width: '28%', alignItems: 'center', paddingVertical: 5 },
  textoContainer: { height: 80, justifyContent: 'center', alignItems: 'center' }, 
  textoEntrada: { color: '#4ADE80', fontWeight: 'bold', fontSize: 12, letterSpacing: 2, transform: [{ rotate: '-90deg' }], width: 80, textAlign: 'center' },
  textoRetorno: { color: '#EAB308', fontWeight: 'bold', fontSize: 12, letterSpacing: 2, transform: [{ rotate: '-90deg' }], width: 80, textAlign: 'center' },
  faixaAmarela: { flex: 1, width: 0, borderWidth: 2, borderColor: '#EAB308', borderStyle: 'dashed', marginVertical: 5 },
  
  closeButton: { marginTop: 20, backgroundColor: '#EAB308', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 8 },
  closeButtonText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
});