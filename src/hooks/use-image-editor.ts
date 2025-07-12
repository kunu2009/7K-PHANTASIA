'use client';

import { useState, useCallback } from 'react';
import type { EditorState } from '@/lib/types';

export const INITIAL_STATE: EditorState = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  grayscale: 0,
  sepia: 0,
  hueRotate: 0,
  rotate: 0,
  scaleX: 1,
  scaleY: 1,
};

export function useImageEditor() {
  const [state, setState] = useState<EditorState>(INITIAL_STATE);

  const updateFilter = useCallback((filter: keyof EditorState, value: number) => {
    setState((prevState) => ({ ...prevState, [filter]: value }));
  }, []);

  const rotate = useCallback((degrees: number) => {
    setState((prevState) => ({ ...prevState, rotate: prevState.rotate + degrees }));
  }, []);

  const flip = useCallback((axis: 'horizontal' | 'vertical') => {
    setState((prevState) => ({
      ...prevState,
      scaleX: axis === 'horizontal' ? prevState.scaleX * -1 : prevState.scaleX,
      scaleY: axis === 'vertical' ? prevState.scaleY * -1 : prevState.scaleY,
    }));
  }, []);

  const applyPreset = useCallback((preset: Partial<EditorState>) => {
    setState((prevState) => ({ ...prevState, ...INITIAL_STATE, ...preset, rotate: prevState.rotate, scaleX: prevState.scaleX, scaleY: prevState.scaleY }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const cssFilters = `
    brightness(${state.brightness}%)
    contrast(${state.contrast}%)
    saturate(${state.saturate}%)
    grayscale(${state.grayscale}%)
    sepia(${state.sepia}%)
    hue-rotate(${state.hueRotate}deg)
  `.trim();

  const cssTransform = `
    rotate(${state.rotate}deg)
    scaleX(${state.scaleX})
    scaleY(${state.scaleY})
  `.trim();

  return {
    state,
    updateFilter,
    rotate,
    flip,
    applyPreset,
    reset,
    cssFilters,
    cssTransform,
  };
}
