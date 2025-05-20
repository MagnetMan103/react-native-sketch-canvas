import {type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, View} from "react-native";
import {useRef, useState} from "react";
import React from "react";
import {SketchContainer} from "@magnetman103/react-native-sketch-canvas";


export default function ScrollComponent() {
  const scrollRef = useRef<ScrollView>(null);
  // Track current scroll position
  const [currentScrollY, setCurrentScrollY] = useState(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setCurrentScrollY(offsetY);
  };

  const scrollY = (y: number = 0, velocity: number = 0) => {
    console.log(`scrollY: ${y}, velocity: ${velocity}`);
    // scroll the current location by y
    if (scrollRef.current) {
      const newPosition = currentScrollY + y;
      scrollRef.current.scrollTo({
        x: 0,
        y: newPosition,
        animated: false
      });
      if (Math.abs(velocity) > 1000) {
        const velocityPosition = newPosition + -velocity * 0.2;
        scrollRef.current.scrollTo({
          x: 0,
          y: velocityPosition,
          animated: true,
        });
      }
      // setCurrentScrollY(velocityPosition);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "blue" }}>
    <ScrollView
      ref={scrollRef}
      onScroll={handleScroll}
      scrollEnabled={true}
      scrollEventThrottle={16} // Add this for smoother tracking
      style={{width: 500, backgroundColor: "red" }}
    >
      <SketchContainer strokeColor={"blue"} strokeWidth={2} scrollY={scrollY}
                       style={{height: 600, width: 300, backgroundColor: "lightblue"}}
      />
      <SketchContainer strokeColor={"blue"} strokeWidth={2} scrollY={scrollY}
                       style={{height: 600, width: 300, backgroundColor: "lightblue",
                         marginTop: 20}}
      />
      <SketchContainer strokeColor={"blue"} strokeWidth={2} scrollY={scrollY}
                       style={{height: 600, width: 300, backgroundColor: "lightblue"}}
      />
      <SketchContainer strokeColor={"blue"} strokeWidth={2} scrollY={scrollY}
                       style={{height: 600, width: 300, backgroundColor: "lightblue",
                         marginTop: 20}}
      />
      <SketchContainer strokeColor={"blue"} strokeWidth={2} scrollY={scrollY}
                       style={{height: 600, width: 300, backgroundColor: "lightblue"}}
      />
      <SketchContainer strokeColor={"blue"} strokeWidth={2} scrollY={scrollY}
                       style={{height: 600, width: 300, backgroundColor: "lightblue",
                         marginTop: 20}}
      />
    </ScrollView>
    </View>
  );
}
