'use strict';

import memoize from 'memoize-one';
import React, { forwardRef, useImperativeHandle } from 'react';
import { PixelRatio, Platform, processColor } from 'react-native';
import { requestPermissions } from './handlePermissions';

import ReactNativeSketchCanvasView, {
  Commands,
} from './specs/SketchCanvasNativeComponent';

// Define types directly in this file
export enum OnChangeEventType {
  PathsUpdate = 'pathsUpdate',
  Save = 'save',
}

export interface CanvasText {
  text: string;
  font?: string;
  fontSize?: number;
  fontColor?: string;
  overlay?: 'TextOnSketch' | 'SketchOnText';
  anchor: { x: number; y: number };
  position: { x: number; y: number };
  coordinate?: 'Absolute' | 'Ratio';
  alignment?: 'Left' | 'Center' | 'Right';
  lineHeightMultiple?: number;
}

export interface PathData {
  id: number;
  color: string;
  width: number;
  data: string[];
}

export interface Path {
  path: PathData;
  size: {
    width: number;
    height: number;
  };
  drawer: string | undefined;
}

export interface StrokeEndData {
  path: PathData;
  size: {
    width: number;
    height: number;
  };
  drawer: string | null;
}

export interface SketchCanvasProps {
  style?: any;
  strokeColor?: string;
  strokeWidth?: number;
  onPathsChange?: (pathsUpdate: any) => void;
  onStrokeStart?: (x: number, y: number) => void;
  onStrokeChanged?: (x: number, y: number) => void;
  onStrokeEnd?: (data: StrokeEndData) => void;
  onSketchSaved?: (success: boolean, path: string) => void;
  onGenerateBase64?: (result: any) => void;
  onCanvasReady?: () => void;
  user?: string;
  touchEnabled?: boolean;
  text?: CanvasText[];
  localSourceImage?: {
    filename: string;
    directory: string;
    mode?: 'AspectFill' | 'AspectFit' | 'ScaleToFill';
  };
  permissionDialogTitle?: string;
  permissionDialogMessage?: string;
}

// Define DrawCanvas props interface
interface DrawCanvasProps extends Omit<SketchCanvasProps, 'touchEnabled'> {
  pathsToProcess: Path[];
  paths: Path[];
  currentPath: PathData | null;
}

// Define the ref interface to expose methods
export interface DrawCanvasRef {
  clear: () => void;
  addPath: (data: Path) => void;
  deletePath: (id: number) => void;
  newPath: (id: number, color: string, width: number) => void;
  addPoint: (x: number, y: number) => void;
  endPath: () => void;
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

const DrawCanvas = forwardRef<DrawCanvasRef, DrawCanvasProps>((props, ref) => {
  const canvasRef =
    React.useRef<InstanceType<typeof ReactNativeSketchCanvasView>>(null);

  // Track these values with refs instead of state
  const screenScale = React.useRef(
    Platform.OS === 'ios' ? 1 : PixelRatio.get()
  );
  const size = React.useRef({ width: 0, height: 0 });
  const initialized = React.useRef(false);

  // Process text for display
  const processText = (text: any) => {
    text &&
      text.forEach(
        (t: { fontColor: any }) => (t.fontColor = processColor(t.fontColor))
      );
    return text;
  };

  const getProcessedText = memoize((text: CanvasText[] | undefined) => {
    const textCopy = text ? text.map((t) => Object.assign({}, t)) : null;
    return processText(textCopy);
  });

  // Method implementations
  const clear = () => {
    if (canvasRef.current) {
      Commands.clear(canvasRef.current);
    }
  };

  const addPath = (data: Path) => {
    if (initialized.current) {
      const pathData = data.path.data.map((p: any) => {
        const coor = p.split(',').map((pp: any) => parseFloat(pp).toFixed(2));
        return `${
          (coor[0] * screenScale.current * size.current.width) / data.size.width
        },${
          (coor[1] * screenScale.current * size.current.height) /
          data.size.height
        }`;
      });

      if (canvasRef.current) {
        Commands.addPath(
          canvasRef.current,
          data.path.id,
          processColor(data.path.color) as number,
          data.path.width ? data.path.width * screenScale.current : 0,
          pathData
        );
      }
    }
  };

  const deletePath = (id: any) => {
    if (canvasRef.current) {
      Commands.deletePath(canvasRef.current, id);
    }
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
      Commands.save(
        canvasRef.current,
        imageType,
        folder,
        filename,
        transparent,
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
      Commands.transferToBase64(
        canvasRef.current,
        imageType,
        transparent,
        includeImage,
        includeText,
        cropToImageSize
      );
    }
  };

  const addPoint = (x: number, y: number) => {
    if (canvasRef.current) {
      Commands.addPoint(
        canvasRef.current,
        parseFloat((x * screenScale.current).toString()),
        parseFloat((y * screenScale.current).toString())
      );
    }
  };

  const newPath = (id: number, color: string, width: number) => {
    if (canvasRef.current) {
      Commands.newPath(
        canvasRef.current,
        id,
        processColor(color) as number,
        width ? width * screenScale.current : 0
      );
    }
  };

  const endPath = () => {
    if (canvasRef.current) {
      Commands.endPath(canvasRef.current);
    }
  };

  // Handle permissions on mount
  React.useEffect(() => {
    const setupPermissions = async () => {
      await requestPermissions(
        props.permissionDialogTitle || '',
        props.permissionDialogMessage || ''
      );
    };

    setupPermissions();
  }, [props.permissionDialogTitle, props.permissionDialogMessage]);

  // Process paths when component updates
  React.useEffect(() => {
    // Process any initial paths
    if (initialized.current && props.pathsToProcess.length > 0) {
      props.pathsToProcess.forEach((p) => addPath(p));
    }
  }, [props.pathsToProcess]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    clear,
    addPath,
    deletePath,
    newPath,
    addPoint,
    endPath,
    save,
    getBase64,
  }));

  // Default props
  const defaultProps = {
    style: null,
    strokeColor: '#000000',
    strokeWidth: 3,
    onPathsChange: () => {},
    onStrokeStart: (_x: number, _y: number) => {},
    onStrokeChanged: () => {},
    onStrokeEnd: () => {},
    onSketchSaved: () => {},
    onGenerateBase64: () => {},
    user: null,
    text: null,
    localSourceImage: null,
    permissionDialogTitle: '',
    permissionDialogMessage: '',
    pathsToProcess: [],
    paths: [],
    currentPath: null,
  };

  return (
    <ReactNativeSketchCanvasView
      ref={canvasRef}
      style={props.style || defaultProps.style}
      onLayout={(e: any) => {
        size.current = {
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        };
        initialized.current = true;

        // Process any initial paths after layout
        if (props.pathsToProcess.length > 0) {
          props.pathsToProcess.forEach((p) => addPath(p));
        }
      }}
      onChange={(e: any) => {
        const { eventType, pathsUpdate, success, path } = e.nativeEvent || {};

        const isSuccess = success !== undefined;
        const isSave = eventType === OnChangeEventType.Save;
        const isPathsUpdate = eventType === OnChangeEventType.PathsUpdate;

        if (!isSave && isPathsUpdate) {
          props.onPathsChange?.(pathsUpdate);
        } else if (isSave) {
          props.onSketchSaved?.(success, path);
        } else if (isSuccess) {
          props.onSketchSaved?.(success, '');
        }
      }}
      onGenerateBase64={(e: any) => {
        props.onGenerateBase64?.(e.nativeEvent || {});
      }}
      onCanvasReady={() => {
        props.onCanvasReady?.();
      }}
      localSourceImage={props.localSourceImage}
      text={getProcessedText(props.text)}
    />
  );
});

export default DrawCanvas;
