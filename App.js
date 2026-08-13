import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet, Text, View, Image, TouchableOpacity,
  SafeAreaView, Platform, StatusBar,
  Animated, Easing, useWindowDimensions, ScrollView
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';

// ─── pseudoqr algorithm (ported from pseudoqr.py) ───────────────────────────

const EDGE_MODULES = 7;
const ALIGNMENT_MODULES = 5;
const ALIGNMENT_PADDING = 4;
const ALIGNMENT_MAX_SPACE = 23;

const DIR = { UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8 };

function buildPseudoQR(modules) {
  const grid = Array.from({ length: modules }, () => new Array(modules).fill(false));

  function setModule(row, col, dark) {
    if (row >= 0 && row < modules && col >= 0 && col < modules) {
      grid[row][col] = dark;
    }
  }

  function drawDot(x, y, size, paddingDir = 0) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const light =
          (c % (size - 3) === 1 && r % (size - 1) !== 0) ||
          (r % (size - 3) === 1 && c % (size - 1) !== 0);
        setModule(x + r, y + c, !light);
      }
    }

    const up = (paddingDir & DIR.UP) === DIR.UP;
    const down = (paddingDir & DIR.DOWN) === DIR.DOWN;
    const left = (paddingDir & DIR.LEFT) === DIR.LEFT;
    const right = (paddingDir & DIR.RIGHT) === DIR.RIGHT;

    const startAdd = up ? -1 : 0;
    const endAdd = down ? 1 : 0;

    if (up) for (let i = 0; i < size; i++) setModule(x - 1, y + i, false);
    if (down) for (let i = 0; i < size; i++) setModule(x + size, y + i, false);
    if (left) for (let i = startAdd; i < size + endAdd; i++) setModule(x + i, y - 1, false);
    if (right) for (let i = startAdd; i < size + endAdd; i++) setModule(x + i, y + size, false);
  }

  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      grid[r][c] = Math.random() > 0.5;
    }
  }

  const edgePos = modules - EDGE_MODULES;

  drawDot(0, 0, EDGE_MODULES, DIR.DOWN | DIR.RIGHT);
  drawDot(0, edgePos, EDGE_MODULES, DIR.DOWN | DIR.LEFT);
  drawDot(edgePos, 0, EDGE_MODULES, DIR.UP | DIR.RIGHT);

  if (modules >= 25) {
    const baseAlignPos = modules - ALIGNMENT_PADDING - ALIGNMENT_MODULES;
    const alignPadMargin = ALIGNMENT_PADDING;

    const alignCount = Math.ceil(
      (modules - 2 * ALIGNMENT_PADDING + ALIGNMENT_MAX_SPACE) /
      (ALIGNMENT_MAX_SPACE + ALIGNMENT_MODULES)
    );
    let space = Math.round(
      (modules - 2 * ALIGNMENT_PADDING - alignCount * ALIGNMENT_MODULES) /
      (alignCount - 1)
    );
    if (space % 2 === 0) space += 1;

    for (let i = 0; i < alignCount - 1; i++) {
      for (let j = 0; j < alignCount - 1; j++) {
        if (i + j > 0) {
          const rr = baseAlignPos - (space + ALIGNMENT_MODULES) * i;
          const cc = baseAlignPos - (space + ALIGNMENT_MODULES) * j;
          drawDot(rr, cc, ALIGNMENT_MODULES);
        }
      }
    }
    for (let i = 1; i < alignCount - 1; i++) {
      drawDot(alignPadMargin, baseAlignPos - (space + ALIGNMENT_MODULES) * i, ALIGNMENT_MODULES);
    }
    for (let i = 1; i < alignCount - 1; i++) {
      drawDot(baseAlignPos - (space + ALIGNMENT_MODULES) * i, alignPadMargin, ALIGNMENT_MODULES);
    }
  }

  return grid;
}

// ─── React Native QR component ───────────────────────────────────────────────

const MODULE_COUNT = 41;
const MODULE_SIZE = 6;
const QR_DISPLAY = MODULE_COUNT * MODULE_SIZE;

const PseudoQRCode = ({ size = 230 }) => {
  const grid = useMemo(() => buildPseudoQR(MODULE_COUNT), []);

  const rects = [];
  for (let r = 0; r < MODULE_COUNT; r++) {
    for (let c = 0; c < MODULE_COUNT; c++) {
      if (grid[r][c]) {
        rects.push(
          <Rect
            key={`${r}-${c}`}
            x={c * MODULE_SIZE}
            y={r * MODULE_SIZE}
            width={MODULE_SIZE + 0.5}
            height={MODULE_SIZE + 0.5}
            fill="#000000"
          />
        );
      }
    }
  }

  return (
    <View style={{ backgroundColor: '#fff', padding: 8, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${QR_DISPLAY} ${QR_DISPLAY}`}
      >
        {rects}
      </Svg>
    </View>
  );
};

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = useMemo(() => Math.min(screenWidth * 0.96, 380), [screenWidth]);
  const translateX = useRef(new Animated.Value(-68)).current;

  const [cancellationTimeObj, setCancellationTimeObj] = useState(null);
  const [ticketData, setTicketData] = useState({
    lineNum: '638',
    cancellationDate: '--.--.----r. --:--:--',
    validityDate: '--.--.----r. --:--:--',
    buyDate: '--.--.----r. --:--:--',
    currentNumber: '---------',
    controlNumber: '-----',
  });

  const [upTimerStr, setUpTimerStr] = useState('10:00');
  const [downTimerStr, setDownTimerStr] = useState('35:00');

  useEffect(() => {
    const now = new Date();
    // Czas skasowania = teraz minus 10 minut
    const cancellationDateObj = new Date(now.getTime() - 10 * 60000);
    setCancellationTimeObj(cancellationDateObj);

    // Czas zakupu = Czas skasowania minus 30 sekund
    const buyDateObj = new Date(cancellationDateObj.getTime() - 30 * 1000);
    // Ważny do = Czas skasowania + 45 minut
    const validityDateObj = new Date(cancellationDateObj.getTime() + 45 * 60000);

    const pad = (n) => n.toString().padStart(2, '0');
    const formatDate = (date) =>
      `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}r. ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

    // Numer bieżący (9 cyfr)
    const cNum = Math.floor(Math.random() * 900000000) + 100000000;
    // Numer kontrolny (5 cyfr 25000-80000)
    const ctrlNum = Math.floor(Math.random() * (80000 - 25000 + 1)) + 25000;

    setTicketData({
      lineNum: '638',
      cancellationDate: formatDate(cancellationDateObj),
      validityDate: formatDate(validityDateObj),
      buyDate: formatDate(buyDateObj),
      currentNumber: cNum.toString(),
      controlNumber: ctrlNum.toString(),
    });
  }, []);

  // Live Timer effect (odliczanie w górę od 0:00->45:00 i w dół od 45:00->0:00)
  useEffect(() => {
    if (!cancellationTimeObj) return;

    const interval = setInterval(() => {
      const now = new Date();
      const elapsedSec = Math.floor((now.getTime() - cancellationTimeObj.getTime()) / 1000);

      const countUpSec = Math.min(Math.max(elapsedSec, 0), 45 * 60);
      const countDownSec = Math.max(45 * 60 - elapsedSec, 0);

      const pad = (n) => n.toString().padStart(2, '0');

      const upMin = Math.floor(countUpSec / 60);
      const upSec = countUpSec % 60;
      setUpTimerStr(`${upMin}:${pad(upSec)}`);

      const downMin = Math.floor(countDownSec / 60);
      const downSec = countDownSec % 60;
      setDownTimerStr(`${downMin}:${pad(downSec)}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [cancellationTimeObj]);

  const bannerStyle = useMemo(() => ({
    width: screenWidth,
    marginLeft: -((screenWidth - cardWidth) / 2 + 14),
  }), [screenWidth, cardWidth]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: screenWidth,
          duration: 3500,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(translateX, {
          toValue: -68,
          duration: 0,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [translateX, screenWidth]);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1161a6" />
      <View style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} activeOpacity={0.7}>
              <Image source={require('./assets/image.png')} style={styles.iconBack} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <View style={styles.logoContainer}>
              <Image source={require('./assets/cJ.png')} style={styles.contentImage} resizeMode="contain" />
            </View>
            <View style={styles.placeholder} />
          </View>

          {/* Single Scrollable Ticket Page */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.ticketContainer, { width: cardWidth }]}>
              {/* 1. Latające logo od lewej do prawej na CAŁĄ SZEROKOŚĆ EKRANU */}
              <View style={[styles.bannerWrapper, bannerStyle]}>
                <Animated.Image
                  source={require('./assets/banner.png')}
                  style={[styles.floatingLogo, { transform: [{ translateX }] }]}
                />
              </View>

              {/* 2. Kod QR duży */}
              <View style={styles.qrSection}>
                <PseudoQRCode size={255} />
              </View>

              {/* 3. Nazwa z timerem w tej samej linii */}
              <View style={[styles.fieldSection, { marginTop: 10, marginBottom: 18 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
                  <Text style={styles.label}>Nazwa:</Text>
                  <Text style={styles.timerText}>{upTimerStr}</Text>
                </View>
                <Text style={styles.valueTitle}>Miasto Gorzów Wlkp. Komunikacja miejska</Text>
              </View>

              {/* 4. Bilet */}
              <View style={styles.fieldSection}>
                <Text style={[styles.label, { marginBottom: 8 }]}>Bilet:</Text>
                <Text style={styles.valueText}>45 min jedn. Ulg. w gr.adm. Miasta Gorzów</Text>
                <Text style={styles.valueText}>Wlkp. Miasto</Text>
              </View>

              {/* 5. line number */}
              <View style={styles.fieldSection}>
                <Text style={[styles.label, { marginBottom: 3 }]}>line number:</Text>
                <Text style={styles.valueText}>{ticketData.lineNum}</Text>
              </View>

              {/* 6. Czas skasowania */}
              <View style={styles.fieldSection}>
                <Text style={styles.label}>Czas skasowania:</Text>
                <Text style={[styles.valueText]}>{ticketData.cancellationDate}</Text>
              </View>

              {/* Czas ważności (odliczanie w dół) */}
              <View style={styles.fieldSection}>
                <Text style={styles.label}>Czas ważności:</Text>
                <Text style={styles.valueText}>{downTimerStr}</Text>
              </View>

              {/* 7. Ważny do */}
              <View style={styles.fieldSection}>
                <Text style={styles.label}>Ważny do:</Text>
                <Text style={[styles.valueText]}>{ticketData.validityDate}</Text>
              </View>

              {/* 8. Numer bieżący */}
              <View style={[styles.fieldSection, { marginTop: -5 }]}>
                <Text style={styles.label}>Numer bieżący:</Text>
                <Text style={[styles.valueText]}>{ticketData.currentNumber}</Text>
              </View>

              {/* 9. Numer kontrolny */}
              <View style={[styles.fieldSection, { marginTop: -5 }]}>
                <Text style={styles.label}>Numer kontrolny:</Text>
                <Text style={[styles.valueText, styles.controlBox]}>{ticketData.controlNumber}</Text>
              </View>

              {/* 10. Latające logo gorzowa na CAŁĄ SZEROKOŚĆ EKRANU */}
              <View style={[styles.bannerWrapper, bannerStyle, { marginTop: -7, marginBottom: 3 }]}>
                <Animated.Image
                  source={require('./assets/banner.png')}
                  style={[styles.floatingLogo, { transform: [{ translateX }] }]}
                />
              </View>

              {/* 11. Cena */}
              <View style={styles.fieldSection}>
                <Text style={styles.label}>Cena:</Text>
                <Text style={[styles.valueText]}>5.00 PLN</Text>
              </View>

              {/* 12. Czas zakupu */}
              <View style={[styles.fieldSection, { marginBottom: 20 }]}>
                <Text style={styles.label}>Czas zakupu:</Text>
                <Text style={styles.valueText}>{ticketData.buyDate}</Text>
              </View>

              {/* Przycisk Prolong ticket */}
              <TouchableOpacity style={styles.prolongButton} activeOpacity={0.8}>
                <Text style={styles.prolongButtonText}>Prolong ticket</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1161a6',
    touchAction: 'manipulation',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    height: Platform.OS === 'ios' ? 106 : 64,
    paddingTop: Platform.OS === 'ios' ? 54 : (Platform.OS === 'web' ? 16 : 12),
    backgroundColor: '#1161a6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 6,
    zIndex: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 120,
  },
  iconBack: {
    width: 24,
    height: 24,
    marginLeft: 6,
  },
  backText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '400',
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentImage: {
    width: 100,
    height: 30,
  },
  placeholder: {
    width: 120,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 2,
    paddingBottom: 40,
  },
  ticketContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bannerWrapper: {
    height: 48,
    marginHorizontal: -14,
    overflow: 'hidden',
    justifyContent: 'center',
    marginTop: -2,
    marginBottom: 15,
  },
  floatingLogo: {
    width: 68,
    height: 58,
    resizeMode: 'contain',
  },
  qrSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 14,
  },
  fieldSection: {
    marginBottom: 14,
  },
  label: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '100',
    marginBottom: 4,
  },
  timerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginTop: -4,
  },
  valueTitle: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  valueText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  highlightDate: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  controlBox: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  prolongButton: {
    backgroundColor: '#1161a6',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 0,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    marginBottom: 35,
  },
  prolongButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
  },
});
