export type EditorState = {
  brightness: number;
  contrast: number;
  saturate: number;
  grayscale: number;
  sepia: number;
  hueRotate: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
};

export type TextElement = {
    id: string;
    text: string;
    fontFamily: string;
    fontSize: number;
    color: string;
    bold: boolean;
    italic: boolean;
    shadow: boolean;
    stroke: boolean;
    rotation: number;
    x: number;
    y: number;
};

export type StickerElement = {
    id: string;
    sticker: string;
    size: number;
    rotation: number;
    x: number;
    y: number;
};

export type WatermarkElement = {
    id: 'watermark';
    text: string;
    color: string;
    opacity: number;
    size: number;
    font: string;
    x: number;
    y: number;
};
