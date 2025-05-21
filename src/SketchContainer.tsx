'use strict';

import React, {
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import DrawCanvas, {
  type DrawCanvasRef,
  type Path,
  type PathData,
  type StrokeEndData,
} from './DrawCanvas';

interface SketchContainerProps {
  strokeColor: string;
  strokeWidth: number;
  style?: any;
  user?: string;
  onStrokeStart?: (x: number, y: number) => void;
  onStrokeChanged?: (x: number, y: number) => void;
  onStrokeEnd?: (data: StrokeEndData) => void;
  onPathsChange?: (pathsUpdate: any) => void;
  onSketchSaved?: (success: boolean, path: string) => void;
  onGenerateBase64?: (result: any) => void;
  onCanvasReady?: () => void;
  touchEnabled?: boolean;
  scrollY?: (y?: number, velocity?: number) => void;
  eraserOn?: boolean;
}

export interface SketchContainerRef {
  clear: () => void;
  undo: () => number;
  addPath: (data: Path) => void;
  getPaths: () => Path[];
  save: (
    imageType: string,
    transparent: boolean,
    folder: string,
    filename: string,
    includeImage: boolean,
    includeText: boolean,
    cropToImageSize: boolean
  ) => void;
  getBase64: (
    imageType: string,
    transparent: boolean,
    includeImage: boolean,
    includeText: boolean,
    cropToImageSize: boolean
  ) => void;
}

const SketchContainer = forwardRef<SketchContainerRef, SketchContainerProps>(
  (props, ref) => {
    const {
      strokeColor,
      strokeWidth,
      style,
      user,
      onStrokeStart,
      onStrokeChanged,
      onStrokeEnd,
      onPathsChange,
      onSketchSaved,
      onGenerateBase64,
      onCanvasReady,
      touchEnabled,
      scrollY,
      eraserOn,
    } = props;

    // Use refs instead of state for path data (similar to original implementation)
    const pathsRef = useRef<Path[]>([]);
    const pathsToProcessRef = useRef<Path[]>([]);
    const currentPathRef = useRef<PathData | null>(null);

    // We'll use a single state for size and to trigger redraws when needed
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [, setForceUpdate] = useState(0); // For forcing re-renders when needed

    // Reference to the DrawCanvas component
    const canvasRef = useRef<DrawCanvasRef>(null);

    // Force component to update when paths change
    const triggerUpdate = () => {
      setForceUpdate((prev) => prev + 1);
    };
    const lastYAmount = useRef(0);

    // Create the pan gesture
    const panGesture = Gesture.Pan()
      .onStart((event) => {
        if ((!event.stylusData && !touchEnabled) || eraserOn) {
          return;
        }

        const newPath: PathData = {
          id: parseInt(String(Math.random() * 100000000), 10),
          color: strokeColor,
          width: strokeWidth,
          data: [],
        };

        const x = parseFloat(event.x.toFixed(2));
        const y = parseFloat(event.y.toFixed(2));

        newPath.data.push(`${x},${y}`);
        currentPathRef.current = newPath;

        // Start path in the DrawCanvas
        if (canvasRef.current) {
          canvasRef.current.newPath(newPath.id, newPath.color, newPath.width);
          canvasRef.current.addPoint(x, y);
        }

        onStrokeStart?.(x, y);
        triggerUpdate(); // Force update to render current path
      })
      .onUpdate((event) => {
        const x = parseFloat(event.x.toFixed(2));
        const y = parseFloat(event.y.toFixed(2));

        if (eraserOn) {
          onStrokeChanged?.(x, y);
          return;
        }
        if ((!event.stylusData && !touchEnabled) || !currentPathRef.current) {
          if (scrollY) {
            // If scrollY is provided, call it with the current scroll position
            scrollY(lastYAmount.current - event.translationY);
            lastYAmount.current = event.translationY;
          }
          return;
        }

        // Add point to current path
        if (currentPathRef.current) {
          currentPathRef.current.data.push(`${x},${y}`);

          // Add point directly to the canvas
          if (canvasRef.current) {
            canvasRef.current.addPoint(x, y);
          }
        }

        onStrokeChanged?.(x, y);
      })
      .onEnd((event) => {
        if (eraserOn) {
          onStrokeEnd?.({
            path: {
              id: -1,
              color: strokeColor,
              width: strokeWidth,
              data: [],
            },
            size: { width: 0, height: 0 },
            drawer: null,
          });
          return;
        }
        if ((!event.stylusData && !touchEnabled) || !currentPathRef.current) {
          if (scrollY) {
            scrollY(0, event.velocityY);
            lastYAmount.current = 0;
          }
          return;
        }

        if (currentPathRef.current) {
          // Create path for internal tracking
          const newPath: Path = {
            path: currentPathRef.current,
            size,
            drawer: user,
          };

          // Add to paths array
          pathsRef.current = [...pathsRef.current, newPath];

          // Create properly typed object for the callback
          const strokeEndData: StrokeEndData = {
            path: currentPathRef.current,
            size,
            drawer: user || null,
          };

          // End the path in the canvas
          if (canvasRef.current) {
            canvasRef.current.endPath();
          }

          onStrokeEnd?.(strokeEndData);
        }

        currentPathRef.current = null;
        triggerUpdate(); // Force update after completing the path
      })
      .minDistance(1)
      .runOnJS(true);

    // Methods that can be called from outside
    const clear = () => {
      pathsRef.current = [];
      pathsToProcessRef.current = [];
      currentPathRef.current = null;

      if (canvasRef.current) {
        canvasRef.current.clear();
      }

      triggerUpdate();
    };

    const undo = () => {
      let lastId = -1;
      pathsRef.current.forEach(
        (d) => (lastId = d.drawer === user ? d.path.id : lastId)
      );

      if (lastId >= 0) {
        pathsRef.current = pathsRef.current.filter((p) => p.path.id !== lastId);

        if (canvasRef.current) {
          canvasRef.current.deletePath(lastId);
        }

        triggerUpdate();
      }

      return lastId;
    };

    const addPath = (data: Path) => {
      // Check if path already exists
      if (
        pathsRef.current.filter((p) => p.path.id === data.path.id).length === 0
      ) {
        // Add to paths array
        pathsRef.current = [...pathsRef.current, data];

        // Add to processing queue
        pathsToProcessRef.current = [...pathsToProcessRef.current, data];

        // Process the path directly
        if (canvasRef.current && size.width > 0 && size.height > 0) {
          canvasRef.current.addPath(data);
        }

        triggerUpdate();
      }
    };
    const deletePath = (id: number) => {
      pathsRef.current = pathsRef.current.filter((p) => p.path.id !== id);
      pathsToProcessRef.current = pathsToProcessRef.current.filter(
        (p) => p.path.id !== id
      );
      if (canvasRef.current) {
        canvasRef.current.deletePath(id);
      }
      triggerUpdate();
    };

    const save = (
      imageType: string,
      transparent: boolean,
      folder: string,
      filename: string,
      includeImage: boolean,
      includeText: boolean,
      cropToImageSize: boolean
    ) => {
      if (canvasRef.current) {
        canvasRef.current.save(
          imageType,
          transparent,
          folder,
          filename,
          includeImage,
          includeText,
          cropToImageSize
        );
      }
    };

    const getBase64 = (
      imageType: string,
      transparent: boolean,
      includeImage: boolean,
      includeText: boolean,
      cropToImageSize: boolean
    ) => {
      if (canvasRef.current) {
        canvasRef.current.getBase64(
          imageType,
          transparent,
          includeImage,
          includeText,
          cropToImageSize
        );
      }
    };

    const getPaths = () => {
      return pathsRef.current;
    };

    // Process any paths that need processing after layout
    useEffect(() => {
      if (
        size.width > 0 &&
        size.height > 0 &&
        pathsToProcessRef.current.length > 0 &&
        canvasRef.current
      ) {
        pathsToProcessRef.current.forEach((path) => {
          canvasRef.current?.addPath(path);
        });

        // Clear the processing queue
        pathsToProcessRef.current = [];
      }
    }, [size]);

    // Expose methods to parent components
    useImperativeHandle(ref, () => ({
      clear,
      undo,
      addPath,
      deletePath,
      getPaths,
      save,
      getBase64,
    }));
    return (
      <GestureHandlerRootView style={styles.container}>
        <GestureDetector gesture={panGesture}>
          <View
            style={[styles.container, style]}
            onLayout={(e) => {
              setSize({
                width: e.nativeEvent.layout.width,
                height: e.nativeEvent.layout.height,
              });
            }}
          >
            <DrawCanvas
              ref={canvasRef}
              style={styles.canvas}
              strokeColor={strokeColor}
              strokeWidth={strokeWidth}
              paths={pathsRef.current}
              pathsToProcess={pathsToProcessRef.current}
              currentPath={currentPathRef.current}
              onPathsChange={onPathsChange}
              onStrokeStart={onStrokeStart}
              onStrokeChanged={onStrokeChanged}
              onStrokeEnd={onStrokeEnd}
              onSketchSaved={onSketchSaved}
              onGenerateBase64={onGenerateBase64}
              onCanvasReady={onCanvasReady}
              user={user}
            />
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
});

export default SketchContainer;
