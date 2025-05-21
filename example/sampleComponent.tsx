import {useRef, useState} from "react";
import React from "react";
import {SketchContainer} from "@magnetman103/react-native-sketch-canvas";
import type {Path} from "@magnetman103/react-native-sketch-canvas/src/types";

export default function SampleComponent() {
  const canvasRef = useRef(null);
  const findClosest = (x: number, y: number) => {
    const paths: Path[] = canvasRef.current.getPaths();

    const distances = paths.map((path: Path) => {
      const pathData = path.path.data.map((point: string) => {
        const [px, py] = point.split(',').map(Number);
        return {x: px, y: py};
      });

      // Create an enhanced points array with interpolated points where needed
      const enhancedPoints = [];
      for (let i = 0; i < pathData.length - 1; i++) {
        const current = pathData[i];
        const next = pathData[i + 1];
        enhancedPoints.push(current);

        // Calculate distance between consecutive points
        const segmentDistance = Math.sqrt(
          Math.pow(next.x - current.x, 2) +
          Math.pow(next.y - current.y, 2)
        );

        // If points are far apart, add interpolated sample points
        if (segmentDistance > 10) {
          const sampleCount = Math.ceil(segmentDistance / 10); // One point every ~10px
          for (let j = 1; j < sampleCount; j++) {
            const ratio = j / sampleCount;
            // Linear interpolation between points
            enhancedPoints.push({
              x: current.x + (next.x - current.x) * ratio,
              y: current.y + (next.y - current.y) * ratio
            });
          }
        }
      }
      // Don't forget to add the last point
      if (pathData.length > 0) {
        enhancedPoints.push(pathData[pathData.length - 1]);
      }

      // Now calculate distances using the enhanced points
      const pointDistances = enhancedPoints.map(point => {
        return Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2));
      });

      const minDistance = Math.min(...pointDistances);
      return {id: path.path.id, distance: minDistance};
    }).sort((a, b) => a.distance - b.distance);
    const newPaths: Path[] = []
    distances.forEach(d => {
      if (d.distance < 10) {
        if (canvasRef.current) {
          let newPath = paths.find(path => path.path.id === d.id)
          newPaths.push(newPath)
          canvasRef.current.deletePath(d.id);
        }
      } else { return }
    });
    if (newPaths.length > 0) {
    }
  }
  return (
    <SketchContainer
      ref={canvasRef}
      strokeColor={"blue"}
      strokeWidth={2}
      style={{height: 600, width: 300, backgroundColor: "lightblue"}}
      eraserOn={true}
      touchEnabled={true}
      onStrokeChanged={findClosest}
      onStrokeEnd={() => {console.log('Stroke ended')}}
    />
  )
}
