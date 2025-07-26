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
};

export function useImageEditor() {
  const [state, setState] = useState<EditorState>(INITIAL_STATE);

  const updateFilter = useCallback((filter: keyof EditorState, value: number) => {
    setState((prevState) => ({ ...prevState, [filter]: value }));
  }, []);

  const applyPreset = useCallback((preset: Partial<EditorState>) => {
    setState((prevState) => ({ ...prevState, ...INITIAL_STATE, ...preset }));
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


  return {
    state,
    updateFilter,
    applyPreset,
    reset,
    cssFilters,
  };
}
