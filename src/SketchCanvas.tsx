'use strict';

import memoize from 'memoize-one';
import React from 'react';
import { PixelRatio, Platform, processColor } from 'react-native';
import { requestPermissions } from './handlePermissions';
import {
  type SketchCanvasProps,
  type CanvasText,
  type PathData,
  type Path,
  OnChangeEventType,
} from './types';

import ReactNativeSketchCanvasView, {
  Commands,
} from './specs/SketchCanvasNativeComponent';

import RNSketchModule from './specs/NativeSketchCanvasModule';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';

type CanvasState = {
  text: any;
};

type ComponentRef = InstanceType<typeof ReactNativeSketchCanvasView>;

class SketchCanvas extends React.Component<SketchCanvasProps, CanvasState> {
  ref = React.createRef<ComponentRef>();

  static defaultProps = {
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

    touchEnabled: true,

    text: null,
    localSourceImage: null,

    permissionDialogTitle: '',
    permissionDialogMessage: '',
  };

  _pathsToProcess: Path[];
  _paths: Path[];
  _path: PathData | null;
  _handle: any;
  _screenScale: number;
  _offset: { x: number; y: number };
  _size: { width: number; height: number };
  _initialized: boolean;
  panGesture: any;

  state = {
    text: null,
  };
  static MAIN_BUNDLE: any;
  static DOCUMENT: any;
  static LIBRARY: any;
  static CACHES: any;

  constructor(props: SketchCanvasProps) {
    super(props);
    this._pathsToProcess = [];
    this._paths = [];
    this._path = null;
    this._handle = null;
    this._screenScale = Platform.OS === 'ios' ? 1 : PixelRatio.get();
    this._offset = { x: 0, y: 0 };
    this._size = { width: 0, height: 0 };
    this._initialized = false;

    // Create the pan gesture using react-native-gesture-handler
    this.panGesture = Gesture.Pan()
      .onStart((event) => {
        if (!this.props.touchEnabled) {
          return;
        }
        if (!event.stylusData) {
          return;
        }

        // Calculate offset similar to the previous implementation
        this._offset = { x: 0, y: 0 }; // We'll adjust this with absoluteX/Y and x/y

        this._path = {
          id: parseInt(String(Math.random() * 100000000), 10),
          color: this.props.strokeColor,
          width: this.props.strokeWidth,
          data: [],
        };

        if (this.ref.current) {
          Commands.newPath(
            this.ref.current,
            this._path.id,
            processColor(this._path.color) as number,
            this._path.width ? this._path.width * this._screenScale : 0
          );

          const x = parseFloat(event.x.toFixed(2));
          const y = parseFloat(event.y.toFixed(2));

          Commands.addPoint(
            this.ref.current,
            parseFloat((x * this._screenScale).toString()),
            parseFloat((y * this._screenScale).toString())
          );

          this._path.data.push(`${x},${y}`);
          this.props.onStrokeStart?.(x, y);
        }
      })
      .onUpdate((event) => {
        if (!this.props.touchEnabled) {
          return;
        }
        if (!event.stylusData) {
          return;
        }

        if (this._path && this.ref.current) {
          const x = parseFloat(event.x.toFixed(2));
          const y = parseFloat(event.y.toFixed(2));

          Commands.addPoint(
            this.ref.current,
            parseFloat((x * this._screenScale).toString()),
            parseFloat((y * this._screenScale).toString())
          );

          this._path.data.push(`${x},${y}`);
          this.props.onStrokeChanged?.(x, y);
        }
      })
      .onEnd((event) => {
        if (!this.props.touchEnabled) {
          return;
        }
        if (!event.stylusData) {
          return;
        }

        if (this._path) {
          this.props.onStrokeEnd?.({
            path: this._path,
            size: this._size,
            drawer: this.props.user,
          });

          this._paths.push({
            path: this._path,
            size: this._size,
            drawer: this.props.user,
          });
        }

        if (this.ref.current) {
          Commands.endPath(this.ref.current);
        }
      });
  }

  _processText(text: any) {
    text &&
      text.forEach(
        (t: { fontColor: any }) => (t.fontColor = processColor(t.fontColor))
      );
    return text;
  }

  getProcessedText = memoize((text: CanvasText[] | undefined) => {
    const textCopy = text ? text.map((t) => Object.assign({}, t)) : null;

    return this._processText(textCopy);
  });

  clear() {
    this._paths = [];
    this._path = null;

    if (this.ref.current) {
      Commands.clear(this.ref.current);
    }
  }

  undo() {
    let lastId = -1;
    this._paths.forEach(
      (d: any) => (lastId = d.drawer === this.props.user ? d.path.id : lastId)
    );
    if (lastId >= 0) {
      this.deletePath(lastId);
    }
    return lastId;
  }

  addPath(data: Path) {
    if (this._initialized) {
      if (
        this._paths.filter((p: Path) => p.path.id === data.path.id).length === 0
      ) {
        this._paths.push(data);
      }
      const pathData = data.path.data.map((p: any) => {
        const coor = p.split(',').map((pp: any) => parseFloat(pp).toFixed(2));
        return `${
          (coor[0] * this._screenScale * this._size.width) / data.size.width
        },${
          (coor[1] * this._screenScale * this._size.height) / data.size.height
        }`;
      });

      if (this.ref.current) {
        Commands.addPath(
          this.ref.current,
          data.path.id,
          processColor(data.path.color) as number,
          data.path.width ? data.path.width * this._screenScale : 0,
          pathData
        );
      }
    } else {
      this._pathsToProcess.filter((p: Path) => p.path.id === data.path.id)
        .length === 0 && this._pathsToProcess.push(data);
    }
  }

  deletePath(id: any) {
    this._paths = this._paths.filter((p) => p.path.id !== id);

    if (this.ref.current) {
      Commands.deletePath(this.ref.current, id);
    }
  }

  save(
    imageType: string,
    transparent: boolean,
    folder: string,
    filename: string,
    includeImage: boolean,
    includeText: boolean,
    cropToImageSize: boolean
  ) {
    if (this.ref.current) {
      Commands.save(
        this.ref.current,
        imageType,
        folder,
        filename,
        transparent,
        includeImage,
        includeText,
        cropToImageSize
      );
    }
  }

  getPaths() {
    return this._paths;
  }

  getBase64(
    imageType: string,
    transparent: boolean,
    includeImage: boolean,
    includeText: boolean,
    cropToImageSize: boolean
  ) {
    if (Platform.OS === 'ios') {
      if (this.ref.current) {
        Commands.transferToBase64(
          this.ref.current,
          imageType,
          transparent,
          includeImage,
          includeText,
          cropToImageSize
        );
      }
    } else {
      if (this.ref.current) {
        Commands.transferToBase64(
          this.ref.current,
          imageType,
          transparent,
          includeImage,
          includeText,
          cropToImageSize
        );
      }
    }
  }

  async componentDidMount() {
    await requestPermissions(
      this.props.permissionDialogTitle || '',
      this.props.permissionDialogMessage || ''
    );
  }

  render() {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={this.panGesture}>
          <ReactNativeSketchCanvasView
            ref={this.ref}
            style={this.props.style}
            onLayout={(e: any) => {
              this._size = {
                width: e.nativeEvent.layout.width,
                height: e.nativeEvent.layout.height,
              };
              this._initialized = true;
              this._pathsToProcess.length > 0 &&
                this._pathsToProcess.forEach((p) => this.addPath(p));
            }}
            onChange={(e: any) => {
              const { eventType, pathsUpdate, success, path } =
                e.nativeEvent || {};

              const isSuccess = success !== undefined;
              const isSave = eventType === OnChangeEventType.Save;
              const isPathsUpdate = eventType === OnChangeEventType.PathsUpdate;

              if (!isSave && isPathsUpdate) {
                this.props.onPathsChange?.(pathsUpdate);
              } else if (isSave) {
                this.props.onSketchSaved?.(success, path);
              } else if (isSuccess) {
                this.props.onSketchSaved?.(success, '');
              }
            }}
            onGenerateBase64={(e: any) => {
              this.props.onGenerateBase64?.(e.nativeEvent || {});
            }}
            onCanvasReady={() => {
              this.props.onCanvasReady?.();
            }}
            localSourceImage={this.props.localSourceImage}
            permissionDialogTitle={this.props.permissionDialogTitle}
            permissionDialogMessage={this.props.permissionDialogMessage}
            text={this.getProcessedText(this.props.text)}
          />
        </GestureDetector>
      </GestureHandlerRootView>
    );
  }
}

SketchCanvas.MAIN_BUNDLE = RNSketchModule.getConstants().MainBundlePath;
SketchCanvas.DOCUMENT = RNSketchModule.getConstants().NSDocumentDirectory;
SketchCanvas.LIBRARY = RNSketchModule.getConstants().NSLibraryDirectory;
SketchCanvas.CACHES = RNSketchModule.getConstants().NSCachesDirectory;

export default SketchCanvas;
