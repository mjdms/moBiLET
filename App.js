import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet, Text, View, Image, TouchableOpacity,
  SafeAreaView, Platform, StatusBar,
  Animated, Easing, Dimensions, ImageBackground
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

const MODULE_COUNT = 41; // QR version 6  (4×6+17 = 41) — pasuje do ~100-znakowego URL
const MODULE_SIZE = 6;  // integer → zero przerw między modułami
const QR_DISPLAY = MODULE_COUNT * MODULE_SIZE; // 246px

const PseudoQRCode = () => {
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
    <View style={{ backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={QR_DISPLAY * 0.65}
        height={QR_DISPLAY * 0.65}
        viewBox={`0 0 ${QR_DISPLAY} ${QR_DISPLAY}`}
      >
        {rects}
      </Svg>
    </View>
  );
};

// ─── Dot Component ─────────────────────────────────────────────────────────────

const Dot = ({ index, scrollX, screenWidth }) => {
  const opacity = scrollX.interpolate({
    inputRange: [
      (index - 1) * screenWidth,
      index * screenWidth - (screenWidth * 0.1), // Pojawia się bardzo szybko, gdy zbliża się do środka
      index * screenWidth,
      index * screenWidth + (screenWidth * 0.8), // Powoli zanika przy odsuwaniu
      (index + 1) * screenWidth,
    ],
    outputRange: [0, 1, 1, 0, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.dot}>
      <Animated.View style={[styles.activeDot, { opacity }]} />
    </View>
  );
};

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const screenWidth = Dimensions.get('window').width;
  const translateX = useRef(new Animated.Value(-150)).current;
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentPage, setCurrentPage] = useState(0);
  const [randomData, setRandomData] = useState({
    lineNum: '---',
    ticketId: '-----',
    currentNumber: '---------',
    buyDate: '--.--.----r. --:--:--',
    validityDate: '--.--.----r. --:--:--',
  });

  useEffect(() => {
    const now = new Date();
    // 10 minutes ago
    const buyDateObj = new Date(now.getTime() - 10 * 60000);
    // buyDate + 45 minutes
    const validityDateObj = new Date(buyDateObj.getTime() + 45 * 60000);

    const pad = (n) => n.toString().padStart(2, '0');
    const formatDate = (date) =>
      `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}r. ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

    const line = Math.floor(Math.random() * (310 - 302 + 1)) + 302;
    const tId = Math.floor(Math.random() * (69999 - 60000 + 1)) + 60000;
    const cNum = Math.floor(Math.random() * 900000000) + 100000000;

    setRandomData({
      lineNum: line.toString(),
      ticketId: tId.toString(),
      currentNumber: cNum.toString(),
      buyDate: formatDate(buyDateObj),
      validityDate: formatDate(validityDateObj),
    });
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: screenWidth,
          duration: 3500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -150,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => loop.stop();
  }, [translateX, screenWidth]);

  const onScrollEvent = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: true,
      listener: (event) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const page = Math.round(offsetX / screenWidth);
        if (page !== currentPage) {
          setCurrentPage(page);
        }
      }
    }
  );

  const pages = [0, 1, 2];

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

          <View style={styles.subHeader}>
            <Text style={styles.subHeaderText}>Miasto Gorzów Wlkp. Komunikacja miejska</Text>
          </View>

          {/* Swipeable content */}
          <ImageBackground
            source={require('./assets/background.png')}
            style={styles.content}
            imageStyle={styles.backgroundImage}
          >
            <Animated.View style={[styles.bannerContainer, {
              opacity: scrollX.interpolate({
                inputRange: [screenWidth * 1.49, screenWidth * 1.5],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              })
            }]}>
              <Animated.Image
                source={require('./assets/banner.png')}
                style={[styles.floatingLogo, { transform: [{ translateX }] }]}
              />
            </Animated.View>

            <Animated.ScrollView
              horizontal
              pagingEnabled={true}
              showsHorizontalScrollIndicator={false}
              onScroll={onScrollEvent}
              scrollEventThrottle={16}
              contentContainerStyle={[styles.contentContainer, { scrollSnapType: 'x mandatory' }]}
            >
              {pages.map((pageIndex) => (
                <View
                  key={pageIndex}
                  style={{
                    width: screenWidth,
                    flexShrink: 0,
                    alignItems: 'center',
                    scrollSnapAlign: 'start'
                  }}
                >
                  <View style={styles.qrContainer}>
                    <View style={styles.fakeQrWrapper}>
                      {pageIndex === 0 && (
                        <>
                          <Text style={[styles.pageText, styles.pageTitle]}>Gorzów Wlkp. Miasto</Text>
                          <Text style={[styles.pageText, styles.pageSubtitle]}>ticket:</Text>
                          <Text style={[styles.pageText]}>45 min jedn. Ulg. w gr.adm.</Text>
                          <Text style={[styles.pageText]}>Miasta Gorzów Wlkp. Mia...</Text>

                          <Text style={[styles.pageText, styles.pageSubtitle, { marginTop: 30, marginBottom: 3 }]}>line number:</Text>
                          <Text style={[styles.pageText]}>{randomData.lineNum}</Text>
                          <Text style={[styles.pageText, styles.pageSubtitle, { marginTop: 5, marginBottom: 3 }]}>the term of validity:</Text>
                          <Text style={[styles.pageText, { fontSize: 24 }]}>{randomData.validityDate}</Text>
                          <View style={{ paddingHorizontal: 10 }}>
                            <Text style={[styles.ticketNumber]}>{randomData.ticketId}</Text>
                          </View>
                        </>
                      )}
                      {pageIndex === 1 && (
                        <>
                          <Text style={[styles.pageText, styles.pageTitle]}>Gorzów Wlkp. Miasto</Text>
                          <Text style={[styles.pageText, styles.pageSubtitle]}>price:</Text>
                          <Text style={[styles.pageText]}>2.50 PLN</Text>

                          <Text style={[styles.pageText, styles.pageSubtitle, { marginTop: 50 }]}>current number:</Text>
                          <Text style={[styles.pageText, { fontSize: 25 }]}>{randomData.currentNumber}</Text>
                          <View style={{ paddingHorizontal: 10 }}>
                            <Text style={[styles.ticketNumber, { marginTop: 80, marginBottom: 50 }]}>{randomData.buyDate}</Text>
                          </View>
                        </>
                      )}
                      {pageIndex === 2 && (
                        <View style={{ alignItems: 'left' }}>
                          <Text style={[styles.pageText, styles.pageTitle, { marginBottom: 50 }]}>Gorzów Wlkp. Miasto</Text>
                          <View style={[styles.qrCodeContainer, { marginBottom: 45 }]}>
                            <PseudoQRCode />
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </Animated.ScrollView>

            {/* Pagination Dots with custom enter/exit timing */}
            <View style={styles.pagination}>
              {pages.map((i) => (
                <Dot key={i} index={i} scrollX={scrollX} screenWidth={screenWidth} />
              ))}
            </View>
          </ImageBackground>
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
    backgroundColor: '#fff',
  },
  qrCodeContainer: {
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketNumber: {
    color: 'white',
    fontSize: 20,
    fontWeight: '400',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'white',
    padding: 4,
    marginTop: 25,
    marginBottom: 5,
  },
  pageText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '400',
  },
  pageTitle: {
    marginBottom: 32
  },
  pageSubtitle: {
    fontSize: 13
  },
  header: {
    height: Platform.OS === 'ios' ? 94 : 40,
    paddingTop: Platform.OS === 'ios' ? 44 : 0,
    backgroundColor: '#1161a6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 1,
    paddingBottom: 3,
    zIndex: 10,
  },
  subHeader: {
    backgroundColor: '#1161a6',
    paddingVertical: 9,
    borderTopWidth: 0.5,
    borderTopColor: '#064d89',
    marginBottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  subHeaderText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '400',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
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
    justifyContent: 'flex-end',
  },
  contentImage: {
    width: 100,
    height: 30,
  },
  placeholder: {
    width: 120,
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backgroundImage: {
    resizeMode: 'cover',
    width: '100%',
    height: '100%',
    opacity: 1,
    transform: [{ translateY: -20 }],
  },
  contentContainer: {
    flexGrow: 1,
    scrollSnapType: 'x mandatory',
  },
  bannerContainer: {
    position: 'absolute',
    top: 43, // Odsunięcie od góry (możesz dostosować)
    zIndex: 20,
    height: 80,
    width: Dimensions.get('window').width - 40,
    marginHorizontal: 20,
    overflow: 'hidden',
  },
  floatingLogo: {
    position: 'absolute',

    top: 0,
    width: 60,
    height: 50,
    marginTop: -15,
    resizeMode: 'contain',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    padding: 0,
  },
  fakeQrWrapper: {
    paddingHorizontal: 21,
    paddingVertical: 13,
    width: 246 + 38,
    backgroundColor: '#bf0007',
    marginBottom: 20,
    alignItems: 'left',
    justifyContent: 'flex-start',
    marginTop: 0, // Kompensacja miejsca po wyrzuceniu bannera
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20, // Bottom padding
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 50,
    backgroundColor: '#ccc',
    marginHorizontal: 4,
    overflow: 'hidden',
    marginBottom: 35
  },
  activeDot: {
    backgroundColor: '#555',
    ...StyleSheet.absoluteFillObject,
    borderRadius: 50,
  },
});
