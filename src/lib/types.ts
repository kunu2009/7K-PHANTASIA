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
