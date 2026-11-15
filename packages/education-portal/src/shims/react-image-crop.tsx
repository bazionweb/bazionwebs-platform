import React from "react";

export interface Crop {
  unit: "px" | "%";
  x: number;
  y: number;
  width: number;
  height: number;
}

export function makeAspectCrop(
  mediaCrop: Partial<Crop>,
  aspect: number,
  mediaWidth: number,
  mediaHeight: number
): Crop {
  const width = mediaCrop.width ?? 80;
  const height = aspect > 0 && mediaHeight > 0 ? Math.min(100, (width * mediaWidth) / (aspect * mediaHeight)) : width;
  return {
    unit: mediaCrop.unit ?? "%",
    x: mediaCrop.x ?? 0,
    y: mediaCrop.y ?? 0,
    width,
    height,
  };
}

export function centerCrop(crop: Crop, _mediaWidth: number, _mediaHeight: number): Crop {
  return {
    ...crop,
    x: Math.max(0, (100 - crop.width) / 2),
    y: Math.max(0, (100 - crop.height) / 2),
  };
}

export default function ReactCrop({
  children,
  crop,
}: {
  crop?: Crop;
  onChange?: (crop: Crop, percentCrop: Crop) => void;
  onComplete?: (crop: Crop, percentCrop: Crop) => void;
  aspect?: number;
  circularCrop?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="ReactCrop" style={{ position: "relative", display: "inline-block" }}>
      {children}
      {crop ? (
        <div
          className="ReactCrop__crop-selection"
          style={{
            position: "absolute",
            left: `${crop.x}${crop.unit}`,
            top: `${crop.y}${crop.unit}`,
            width: `${crop.width}${crop.unit}`,
            height: `${crop.height}${crop.unit}`,
            border: "2px dashed #c5a048",
            pointerEvents: "none",
          }}
        />
      ) : null}
    </div>
  );
}

