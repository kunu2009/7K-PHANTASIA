
'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Card,
  CardContent
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useImageEditor, INITIAL_STATE } from '@/hooks/use-image-editor';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, RotateCcw, Sun, Contrast, Droplets, Palette, RotateCw, FlipHorizontal, FlipVertical, Download, Wand2, CropIcon, Scissors, Undo, Redo, Eraser, Layers, Type, Bold, Italic, Smile, Loader, Ratio, Copyright } from 'lucide-react';
import type { EditorState, TextElement, StickerElement, WatermarkElement } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { inpaintImageAction } from '@/lib/actions';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';


interface EditorProps {
  image: string;
  onReset: () => void;
}

const PRESETS = [
  { name: 'Vintage', icon: '📷', settings: { sepia: 60, brightness: 110, contrast: 90, saturate: 120 } },
  { name: 'Grayscale', icon: '🎞️', settings: { grayscale: 100 } },
  { name: 'Cool', icon: '🧊', settings: { contrast: 110, brightness: 105, hueRotate: -15 } },
  { name: 'Warm', icon: '🔥', settings: { sepia: 20, saturate: 130, hueRotate: 5 } },
  { name: 'Lomo', icon: '📷', settings: { contrast: 150, saturate: 150, sepia: 20, hueRotate: -5 } },
  { name: 'Sin City', icon: '🌆', settings: { contrast: 200, grayscale: 100, brightness: 80, sepia: 20 } },
  { name: 'Sunrise', icon: '🌅', settings: { contrast: 110, saturate: 140, brightness: 110, sepia: 10, hueRotate: -10 } },
];

const STICKERS = ['😀', '😂', '😍', '😎', '🥳', '🚀', '❤️', '⭐️', '💯', '🔥', '👍', '🎉'];

const AUTO_ENHANCE_PRESET: Partial<EditorState> = { contrast: 120, saturate: 110, brightness: 105 };

type EditMode = 'none' | 'crop' | 'erase' | 'text' | 'stickers' | 'inpaint' | 'watermark';
type InteractionMode = 'none' | 'dragging' | 'resizing' | 'rotating';
type InteractionTarget = 'none' | 'text' | 'sticker' | 'watermark';

const FONT_FACES = [
  { name: 'PT Sans', value: 'PT Sans, sans-serif' },
  { name: 'Playfair Display', value: 'Playfair Display, serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Lobster', value: 'Lobster, cursive' },
  { name: 'Pacifico', value: 'Pacifico, cursive' },
  { name: 'Bebas Neue', value: 'Bebas Neue, sans-serif' },
];

const ASPECT_RATIOS = [
    { name: 'Free', value: undefined },
    { name: '1:1', value: 1 / 1 },
    { name: '9:16', value: 9 / 16 },
    { name: '16:9', value: 16 / 9 },
    { name: '4:5', value: 4 / 5 },
]

const HANDLE_SIZE = 8;
const ROTATION_HANDLE_OFFSET = 25;

export function Editor({ image }: EditorProps) {
  const { state, updateFilter, rotate, flip, applyPreset, reset, cssFilters, cssTransform } = useImageEditor();
  
  const [history, setHistory] = useState<string[]>([image]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const [activeImage, setActiveImage] = useState(history[historyIndex]);
  const [isComparing, setIsComparing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);


  const imageRef = useRef<HTMLImageElement>(null);
  const { toast } = useToast();

  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [aspect, setAspect] = useState<number | undefined>();
  
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [brushSize, setBrushSize] = useState(40);
  
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null); // For the base image in drawing modes
  const previewCanvasRef = useRef<HTMLCanvasElement>(null); // For drawing the mask/preview
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [drawHistory, setDrawHistory] = useState<string[]>([]);
  const [drawHistoryIndex, setDrawHistoryIndex] = useState(-1);

  // Object Interaction state
  const objectCanvasRef = useRef<HTMLCanvasElement>(null);
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [stickerElements, setStickerElements] = useState<StickerElement[]>([]);
  const [watermark, setWatermark] = useState<WatermarkElement | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<{id: string | null, type: InteractionTarget}>({id: null, type: 'none'});
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('none');
  const interactionStartRef = useRef<{ x: number, y: number, object?: TextElement | StickerElement | WatermarkElement }>({ x: 0, y: 0 });

  const selectedText = selectedObjectId.type === 'text' ? textElements.find(t => t.id === selectedObjectId.id) : undefined;
  const selectedSticker = selectedObjectId.type === 'sticker' ? stickerElements.find(s => s.id === selectedObjectId.id) : undefined;
  const selectedWatermark = selectedObjectId.type === 'watermark' ? watermark : undefined;

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const canUndoDraw = drawHistoryIndex > 0;
  const canRedoDraw = drawHistoryIndex < drawHistory.length - 1;

  useEffect(() => {
    setActiveImage(history[historyIndex]);
  }, [history, historyIndex]);

  const handleUndo = () => {
    if (canUndo) {
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      setHistoryIndex(history.length - 1);
    }
  };

  const updateHistory = (newImage: string) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImage);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };
  
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const newCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, aspect || 1, width, height),
      width,
      height
    );
    setCrop(newCrop);
    setCompletedCrop(newCrop);
  };

  function onAspectChange(newAspect: number | undefined) {
    setAspect(newAspect);
    if (imageRef.current) {
        const { width, height } = imageRef.current;
        const newCrop = centerCrop(
            makeAspectCrop({ unit: '%', width: 90 }, newAspect || (width/height), width, height),
            width,
            height
        );
        setCrop(newCrop);
        setCompletedCrop(newCrop);
    }
  }
  
  const getCroppedImg = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const sourceImage = new window.Image();
      sourceImage.src = activeImage;
      sourceImage.crossOrigin = 'anonymous';
      
      sourceImage.onload = () => {
        if (!completedCrop?.width || !completedCrop?.height) {
            reject(new Error('Crop is not complete'));
            return;
        }
        
        const canvas = document.createElement('canvas');
        const displayImage = imageRef.current;
        if (!displayImage) {
            reject(new Error('Could not get image reference'));
            return;
        }

        const scaleX = sourceImage.naturalWidth / displayImage.width;
        const scaleY = sourceImage.naturalHeight / displayImage.height;

        const pixelCrop = {
          x: completedCrop.x * scaleX,
          y: completedCrop.y * scaleY,
          width: completedCrop.width * scaleX,
          height: completedCrop.height * scaleY
        };

        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(
          sourceImage,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          pixelCrop.width,
          pixelCrop.height
        );
        
        resolve(canvas.toDataURL('image/png'));
      }
      sourceImage.onerror = (error) => reject(error);
    });
  }

  const applyCrop = useCallback(async () => {
    if (!completedCrop) {
      toast({ variant: 'destructive', title: 'Crop Error', description: 'Could not apply crop. Please try again.' });
      return;
    }
    
    try {
      const croppedImageUrl = await getCroppedImg();
      updateHistory(croppedImageUrl);
    } catch(e) {
       toast({ variant: 'destructive', title: 'Crop Failed', description: (e as Error).message });
    }

    setEditMode('none');
  }, [completedCrop, activeImage, toast]);
  
  const saveDrawHistory = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const newHistory = drawHistory.slice(0, drawHistoryIndex + 1);
    newHistory.push(canvas.toDataURL());
    setDrawHistory(newHistory);
    setDrawHistoryIndex(newHistory.length - 1);
  };

  const handleUndoDraw = () => {
    if (!canUndoDraw) return;
    const newIndex = drawHistoryIndex - 1;
    setDrawHistoryIndex(newIndex);
    const canvas = previewCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const img = new window.Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = drawHistory[newIndex];
  };

  const handleRedoDraw = () => {
    if (!canUndoDraw) return;
    const newIndex = drawHistoryIndex + 1;
    setDrawHistoryIndex(newIndex);
    const canvas = previewCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const img = new window.Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = drawHistory[newIndex];
  };

  const setupDrawingCanvas = useCallback(() => {
    const baseLayer = drawingCanvasRef.current;
    const previewLayer = previewCanvasRef.current;

    if (!baseLayer || !previewLayer) return;

    const img = new window.Image();
    img.src = activeImage;
    img.crossOrigin = "anonymous";
    img.onload = () => {
        const { naturalWidth, naturalHeight } = img;
        const parent = baseLayer.parentElement;
        if (parent) {
            const aspect = naturalWidth / naturalHeight;
            const parentWidth = parent.clientWidth;
            let parentHeight = parent.clientHeight;
            if (parentHeight === 0) {
              parentHeight = parentWidth / aspect;
            }

            let width = parentWidth;
            let height = parentWidth / aspect;

            if (height > parentHeight) {
              height = parentHeight;
              width = parentHeight * aspect;
            }
            
            [baseLayer, previewLayer].forEach(canvas => {
                canvas.width = width;
                canvas.height = height;
            });

            const baseCtx = baseLayer.getContext('2d');
            if (baseCtx) {
              baseCtx.drawImage(img, 0, 0, width, height);
            }
            const previewCtx = previewLayer.getContext('2d');
            if (previewCtx) {
              previewCtx.clearRect(0,0, width, height);
            }
            // Initial state for eraser history
            const initialHistoryImage = previewLayer.toDataURL();
            setDrawHistory([initialHistoryImage]);
            setDrawHistoryIndex(0);
        }
    };
  }, [activeImage]);

  const getObjectMetrics = (obj: TextElement | StickerElement | WatermarkElement, ctx: CanvasRenderingContext2D) => {
    if ('text' in obj) { // TextElement or WatermarkElement
      const fontStyle = 'font' in obj ? obj.font : `${obj.italic ? 'italic' : ''} ${obj.bold ? 'bold' : ''} ${obj.fontSize}px "${obj.fontFamily}"`;
      ctx.font = fontStyle;
      const metrics = ctx.measureText(obj.text);
      return {
        width: metrics.width,
        height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
      };
    } else { // StickerElement
      ctx.font = `${obj.size}px sans-serif`;
      const metrics = ctx.measureText(obj.sticker);
      return {
        width: metrics.width,
        height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
      };
    }
  }

  const drawObjectsOnCanvas = useCallback(() => {
    const canvas = objectCanvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const elementsToDraw: (TextElement | StickerElement | WatermarkElement)[] = [...textElements, ...stickerElements];
    if (watermark) {
        elementsToDraw.push(watermark);
    }
    
    elementsToDraw.forEach(obj => {
      ctx.save();
      
      if ('text' in obj) { // TextElement or WatermarkElement
        if ('opacity' in obj) { // Watermark
            ctx.globalAlpha = obj.opacity;
            ctx.font = obj.font;
            ctx.fillStyle = obj.color;
        } else { // TextElement
            const fontStyle = `${obj.italic ? 'italic' : ''} ${obj.bold ? 'bold' : ''} ${obj.fontSize}px "${obj.fontFamily}"`;
            ctx.font = fontStyle;
            ctx.fillStyle = obj.color;
            if (obj.shadow) {
              ctx.shadowColor = 'rgba(0,0,0,0.5)';
              ctx.shadowBlur = 5;
              ctx.shadowOffsetX = 2;
              ctx.shadowOffsetY = 2;
            }
            if (obj.stroke) {
              ctx.strokeStyle = 'black'; 
              ctx.lineWidth = 2;
            }
        }
      } else { // StickerElement
        ctx.font = `${obj.size}px sans-serif`;
        ctx.fillStyle = '#000000'; // Not used for emoji
      }
      
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      ctx.translate(obj.x, obj.y);
      if ('rotation' in obj) {
        ctx.rotate(obj.rotation * Math.PI / 180);
      }
      
      if ('text' in obj) {
        if ('stroke' in obj && obj.stroke) ctx.strokeText(obj.text, 0, 0);
        ctx.fillText(obj.text, 0, 0);
      } else {
        ctx.fillText(obj.sticker, 0, 0);
      }
      
      ctx.restore();

      const isSelected = selectedObjectId.id === obj.id;
      if (isSelected) {
          const { width, height } = getObjectMetrics(obj, ctx);
          const padding = 10;
          const boxWidth = width + padding * 2;
          const boxHeight = height + padding * 2;
          
          ctx.save();
          ctx.translate(obj.x, obj.y);
          if ('rotation' in obj) {
              ctx.rotate(obj.rotation * Math.PI / 180);
          }
          
          ctx.strokeStyle = 'hsl(var(--primary))';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight);

          // Draw handles only for objects that support them
          if ('rotation' in obj) {
            ctx.setLineDash([]);
            ctx.fillStyle = 'hsl(var(--background))';
            
            // Rotation handle
            ctx.beginPath();
            ctx.moveTo(0, -boxHeight / 2);
            ctx.lineTo(0, -boxHeight / 2 - ROTATION_HANDLE_OFFSET);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, -boxHeight / 2 - ROTATION_HANDLE_OFFSET, HANDLE_SIZE / 2, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();

            // Resize handle (bottom right)
            ctx.beginPath();
            ctx.rect(boxWidth / 2 - HANDLE_SIZE / 2, boxHeight / 2 - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
            ctx.fill();
            ctx.stroke();
          }
          
          ctx.restore();
      }
    });

  }, [textElements, stickerElements, watermark, selectedObjectId]);

  useEffect(() => {
    if (editMode === 'erase' || editMode === 'inpaint') {
      setupDrawingCanvas();
      window.addEventListener('resize', setupDrawingCanvas);
    }
    if (editMode === 'text' || editMode === 'stickers' || editMode === 'watermark') {
      drawObjectsOnCanvas();
    }
    return () => {
        window.removeEventListener('resize', setupDrawingCanvas);
    }
  }, [editMode, activeImage, setupDrawingCanvas, drawObjectsOnCanvas]);

  useEffect(() => {
      if (editMode === 'watermark' && !watermark) {
          const canvas = objectCanvasRef.current;
          if (!canvas) return;
          const newWatermark: WatermarkElement = {
              id: 'watermark',
              text: '© Your Name',
              color: 'rgba(255, 255, 255, 0.7)',
              size: 40,
              opacity: 0.7,
              font: '40px "PT Sans", sans-serif',
              x: canvas.width / 2,
              y: canvas.height - 50,
          };
          setWatermark(newWatermark);
          setSelectedObjectId({id: 'watermark', type: 'watermark'});
      }
  }, [editMode, watermark]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    let canvas: HTMLCanvasElement | null = null;
    if (editMode === 'erase' || editMode === 'inpaint') {
      canvas = previewCanvasRef.current;
    } else if (editMode === 'text' || editMode === 'stickers' || editMode === 'watermark') {
      canvas = objectCanvasRef.current;
    }
    
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = 'touches' in e ? e.touches[0] : null;
    const clientX = touch ? touch.clientX : (e as React.MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (e as React.MouseEvent).clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    const { x, y } = getCanvasCoordinates(e);
    lastPointRef.current = { x, y };
    draw(e);
  };
  
  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (isDrawing) {
      saveDrawHistory();
    }
    setIsDrawing(false);
    lastPointRef.current = null;
  };
  
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;

    const previewCtx = previewCanvasRef.current?.getContext('2d');
    if (!previewCtx) return;

    const { x, y } = getCanvasCoordinates(e);
    
    if(editMode === 'erase') {
        previewCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        previewCtx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    } else if (editMode === 'inpaint') {
        previewCtx.fillStyle = 'rgba(0, 0, 255, 0.5)';
        previewCtx.strokeStyle = 'rgba(0, 0, 255, 0.5)';
    }
    
    previewCtx.lineWidth = brushSize;
    previewCtx.lineCap = 'round';
    previewCtx.lineJoin = 'round';
    
    previewCtx.beginPath();
    if (lastPointRef.current) {
      previewCtx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    }
    previewCtx.lineTo(x, y);
    previewCtx.stroke();
    previewCtx.closePath();

    previewCtx.beginPath();
    previewCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    previewCtx.fill();
    previewCtx.closePath();
    
    lastPointRef.current = { x, y };
  };

  const handleApplyErase = () => {
      const baseLayer = drawingCanvasRef.current;
      const previewLayer = previewCanvasRef.current;
      if (!baseLayer || !previewLayer) return;

      const baseCtx = baseLayer.getContext('2d');
      if (!baseCtx) return;

      baseCtx.globalCompositeOperation = 'destination-out';
      baseCtx.drawImage(previewLayer, 0, 0);

      const resultDataUrl = baseLayer.toDataURL('image/png');
      updateHistory(resultDataUrl);
      setEditMode('none');
  };

  const handleApplyInpaint = async () => {
    const previewLayer = previewCanvasRef.current;
    if (!previewLayer) return;

    setIsProcessing(true);
    try {
      // Create a new canvas to generate the black and white mask
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = previewLayer.width;
      maskCanvas.height = previewLayer.height;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) {
        throw new Error('Could not create mask canvas context.');
      }

      // Draw the blue preview onto the mask canvas
      maskCtx.drawImage(previewLayer, 0, 0);

      // Process the image data to create a pure B&W mask
      const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        // If the pixel has any opacity (was painted), make it pure white
        if (data[i + 3] > 0) {
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = 255;
        }
      }
      maskCtx.putImageData(imageData, 0, 0);

      const maskDataUri = maskCanvas.toDataURL('image/png');

      const result = await inpaintImageAction({
        photoDataUri: activeImage,
        maskDataUri: maskDataUri,
      });
      updateHistory(result.inpaintedPhotoDataUri);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Inpainting Failed', description: (e as Error).message });
    } finally {
      setIsProcessing(false);
      setEditMode('none');
    }
  };


  const handleCancelDrawing = () => {
      setEditMode('none');
  };

  const handleAddText = () => {
    const canvas = objectCanvasRef.current;
    if (!canvas) return;

    const newText: TextElement = {
      id: Date.now().toString(),
      text: 'Hello World',
      color: '#ffffff',
      fontFamily: 'PT Sans, sans-serif',
      fontSize: 50,
      bold: false,
      italic: false,
      rotation: 0,
      shadow: true,
      stroke: false,
      x: canvas.width / 2,
      y: canvas.height / 2
    };
    setTextElements([...textElements, newText]);
    setSelectedObjectId({id: newText.id, type: 'text'});
  };

  const updateTextElement = (id: string, updates: Partial<TextElement>) => {
    setTextElements(textElements.map(t => t.id === id ? { ...t, ...updates } : t));
  };
  
  const handleAddSticker = (sticker: string) => {
    const canvas = objectCanvasRef.current;
    if (!canvas) return;

    const newSticker: StickerElement = {
      id: Date.now().toString(),
      sticker: sticker,
      size: 100,
      rotation: 0,
      x: canvas.width / 2,
      y: canvas.height / 2,
    };
    setStickerElements([...stickerElements, newSticker]);
    setSelectedObjectId({id: newSticker.id, type: 'sticker'});
  };
  
  const updateStickerElement = (id: string, updates: Partial<StickerElement>) => {
    setStickerElements(stickerElements.map(s => s.id === id ? { ...s, ...updates } : s));
  };
  
  const updateWatermarkElement = (updates: Partial<WatermarkElement>) => {
      if (!watermark) return;
      const newWatermark = { ...watermark, ...updates };

      // Also update font string if size is changed
      if ('size' in updates) {
          newWatermark.font = `${updates.size}px "PT Sans", sans-serif`;
      }
      if ('opacity' in updates) {
          const color = newWatermark.color.startsWith('rgba(0,0,0') ? '0,0,0' : '255,255,255';
          newWatermark.color = `rgba(${color}, ${updates.opacity})`;
      }
      if ('color' in updates && updates.color) {
          const opacity = newWatermark.opacity;
          const newColor = updates.color === 'black' ? `rgba(0,0,0,${opacity})` : `rgba(255,255,255,${opacity})`;
          newWatermark.color = newColor;
      }
      setWatermark(newWatermark);
  };


  const getHitRegion = (x: number, y: number, obj: TextElement | StickerElement | WatermarkElement): InteractionMode => {
    const canvas = objectCanvasRef.current;
    if (!canvas) return 'none';
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'none';

    const { width, height } = getObjectMetrics(obj, ctx);
    const padding = 10;
    const boxWidth = width + padding * 2;
    const boxHeight = height + padding * 2;
    
    // Watermark is only draggable
    if ('opacity' in obj) {
        if (Math.abs(x - obj.x) < boxWidth / 2 && Math.abs(y - obj.y) < boxHeight / 2) {
            return 'dragging';
        }
        return 'none';
    }


    const angle = -obj.rotation * Math.PI / 180;
    const s = Math.sin(angle);
    const c = Math.cos(angle);

    const localX = (x - obj.x) * c - (y - obj.y) * s;
    const localY = (x - obj.x) * s + (y - obj.y) * c;
    
    // Check rotation handle
    const rotHandleX = 0;
    const rotHandleY = -boxHeight / 2 - ROTATION_HANDLE_OFFSET;
    if (Math.hypot(localX - rotHandleX, localY - rotHandleY) < HANDLE_SIZE) {
        return 'rotating';
    }
    
    // Check resize handle
    const resizeHandleX = boxWidth / 2;
    const resizeHandleY = boxHeight / 2;
    if (localX > resizeHandleX - HANDLE_SIZE && localX < resizeHandleX + HANDLE_SIZE &&
        localY > resizeHandleY - HANDLE_SIZE && localY < resizeHandleY + HANDLE_SIZE) {
        return 'resizing';
    }

    // Check main body for dragging
    if (Math.abs(localX) < boxWidth / 2 && Math.abs(localY) < boxHeight / 2) {
        return 'dragging';
    }

    return 'none';
  }


  const handleCanvasInteractionStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x, y } = getCanvasCoordinates(e);
    
    let interaction: InteractionMode = 'none';
    let clickedObject: TextElement | StickerElement | WatermarkElement | undefined;
    let clickedObjectType: InteractionTarget = 'none';

    const allObjects: (TextElement | StickerElement | WatermarkElement)[] = [...stickerElements, ...textElements];
    if (watermark) {
        allObjects.push(watermark);
    }

    // Check for interaction with the currently selected object first
    const selectedObject = allObjects.find(o => o.id === selectedObjectId.id);
    if (selectedObject) {
        interaction = getHitRegion(x, y, selectedObject);
        if(interaction !== 'none') {
            clickedObject = selectedObject;
            clickedObjectType = selectedObjectId.type;
        }
    }
    
    // If no interaction with selected object, check other objects
    if (interaction === 'none') {
        for (let i = allObjects.length - 1; i >= 0; i--) {
            const obj = allObjects[i];
            const hit = getHitRegion(x, y, obj);
            if (hit !== 'none') {
                interaction = hit;
                clickedObject = obj;
                clickedObjectType = 'text' in obj && !('opacity' in obj) ? 'text' : ('sticker' in obj ? 'sticker' : 'watermark');
                setSelectedObjectId({id: obj.id, type: clickedObjectType});
                break;
            }
        }
    }
    
    if (clickedObject && interaction !== 'none') {
        setInteractionMode(interaction);
        interactionStartRef.current = { x, y, object: clickedObject };
    } else {
        setSelectedObjectId({id: null, type: 'none'});
        setInteractionMode('none');
    }
  };
  
  const handleCanvasInteractionMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (interactionMode === 'none' || !selectedObjectId.id) return;
    
    const { x, y } = getCanvasCoordinates(e);
    const start = interactionStartRef.current;
    if (!start.object) return;
    
    let updateFunction;
    let currentObject;

    switch(selectedObjectId.type) {
        case 'text':
            updateFunction = updateTextElement;
            currentObject = textElements.find(t => t.id === selectedObjectId.id);
            break;
        case 'sticker':
            updateFunction = updateStickerElement;
            currentObject = stickerElements.find(s => s.id === selectedObjectId.id);
            break;
        case 'watermark':
            updateFunction = updateWatermarkElement;
            currentObject = watermark;
            break;
        default: return;
    }

    if (!currentObject) return;
    
    if (interactionMode === 'dragging') {
        const updates = {
            x: start.object.x + (x - start.x),
            y: start.object.y + (y - start.y)
        };
        if (selectedObjectId.type === 'watermark') {
            updateWatermarkElement(updates);
        } else {
            (updateFunction as (id: string, updates: any) => void)(selectedObjectId.id, updates);
        }
    } else if (interactionMode === 'resizing' && 'rotation' in currentObject) {
        const dX = x - currentObject.x;
        const dY = y - currentObject.y;
        const startDx = start.x - start.object.x;
        const startDy = start.y - start.object.y;
        
        const dist = Math.hypot(dX, dY);
        const startDist = Math.hypot(startDx, startDy);

        if (startDist > 0) {
            const scale = dist / startDist;
            const currentSize = 'fontSize' in start.object ? start.object.fontSize : ('size' in start.object ? start.object.size : 0);
            const newSize = Math.max(10, currentSize * scale);
            if(selectedObjectId.type === 'text') {
                updateTextElement(selectedObjectId.id, { fontSize: newSize });
            } else if (selectedObjectId.type === 'sticker') {
                updateStickerElement(selectedObjectId.id, { size: newSize });
            }
        }
    } else if (interactionMode === 'rotating' && 'rotation' in currentObject) {
        const angle = Math.atan2(y - currentObject.y, x - currentObject.x) * 180 / Math.PI;
        (updateFunction as (id: string, updates: any) => void)(selectedObjectId.id, { rotation: angle + 90 });
    }
  };

  const handleCanvasInteractionEnd = () => {
    setInteractionMode('none');
  };

  const handleApplyObjects = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const sourceImage = new window.Image();
    sourceImage.src = activeImage;
    sourceImage.crossOrigin = 'anonymous';
    sourceImage.onload = () => {
      canvas.width = sourceImage.naturalWidth;
      canvas.height = sourceImage.naturalHeight;
      if (!ctx) return;
      
      const displayImage = imageRef.current;
      if (!displayImage) return;

      const scaleX = sourceImage.naturalWidth / displayImage.clientWidth;
      const scaleY = sourceImage.naturalHeight / displayImage.clientHeight;
      
      ctx.drawImage(sourceImage, 0, 0);
      
      const allObjects: (TextElement | StickerElement | WatermarkElement)[] = [...textElements, ...stickerElements];
      if (watermark) {
        allObjects.push(watermark);
      }
      
      allObjects.forEach(obj => {
        ctx.save();
        
        if ('text' in obj) { // Text or Watermark
            if ('opacity' in obj) { // Watermark
                ctx.globalAlpha = obj.opacity;
                ctx.font = `${obj.size * scaleX}px "PT Sans", sans-serif`;
                ctx.fillStyle = obj.color.startsWith('rgba(0,0,0') ? `rgba(0,0,0,${obj.opacity})` : `rgba(255,255,255,${obj.opacity})`;
            } else { // TextElement
                const fontStyle = `${obj.italic ? 'italic' : ''} ${obj.bold ? 'bold' : ''} ${obj.fontSize * scaleX}px "${obj.fontFamily}"`;
                ctx.font = fontStyle;
                ctx.fillStyle = obj.color;
                if (obj.shadow) {
                  ctx.shadowColor = 'rgba(0,0,0,0.5)';
                  ctx.shadowBlur = 5 * scaleX;
                  ctx.shadowOffsetX = 2 * scaleX;
                  ctx.shadowOffsetY = 2 * scaleY;
                }
                if (obj.stroke) {
                  ctx.strokeStyle = 'black';
                  ctx.lineWidth = 2 * scaleX;
                }
            }
        } else { // StickerElement
            ctx.font = `${obj.size * scaleX}px sans-serif`;
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
  
        ctx.translate(obj.x * scaleX, obj.y * scaleY);

        if (!('opacity' in obj)) { // Not a watermark
            ctx.rotate(obj.rotation * Math.PI / 180);
        }

        if ('text' in obj) {
            if ('stroke' in obj && obj.stroke) ctx.strokeText(obj.text, 0, 0);
            ctx.fillText(obj.text, 0, 0);
        } else {
            ctx.fillText(obj.sticker, 0, 0);
        }
        ctx.restore();
      });

      updateHistory(canvas.toDataURL('image/png'));
      setEditMode('none');
      // Reset states
      setTextElements([]);
      setStickerElements([]);
      setWatermark(null);
      setSelectedObjectId({id: null, type: 'none'});
    }
  };
  
  const handleExport = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const originalImage = new window.Image();
    originalImage.crossOrigin = 'anonymous';
    originalImage.src = activeImage;

    originalImage.onload = () => {
        const rad = state.rotate * Math.PI / 180;
        const absCos = Math.abs(Math.cos(rad));
        const absSin = Math.abs(Math.sin(rad));

        const originalWidth = originalImage.naturalWidth;
        const originalHeight = originalImage.naturalHeight;

        canvas.width = originalWidth * absCos + originalHeight * absSin;
        canvas.height = originalHeight * absCos + originalWidth * absSin;
        
        ctx.filter = cssFilters;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rad);
        ctx.scale(state.scaleX, state.scaleY);
        ctx.drawImage(originalImage, -originalWidth / 2, -originalHeight / 2, originalWidth, originalHeight);

        const link = document.createElement('a');
        link.download = `phantasia-edit-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };
  };

  const handleAutoEnhance = () => {
    applyPreset(AUTO_ENHANCE_PRESET);
  };

  const handleFullReset = () => {
    reset();
    setHistory([image]);
    setHistoryIndex(0);
    setEditMode('none');
    setTextElements([]);
    setStickerElements([]);
    setWatermark(null);
    setSelectedObjectId({id: null, type: 'none'});
  }
  
  const cancelObjectEditing = () => {
      setEditMode('none'); 
      setTextElements([]); 
      setStickerElements([]);
      setWatermark(null);
      setSelectedObjectId({id: null, type: 'none'})
  };

  const inEditMode = editMode !== 'none';
  const displayedImage = isComparing ? image : activeImage;
  const inObjectMode = editMode === 'text' || editMode === 'stickers' || editMode === 'watermark';
  const inDrawingMode = editMode === 'erase' || editMode === 'inpaint';

  return (
    <div className="grid md:grid-cols-3 gap-8 h-full md:h-[calc(100vh-10rem)] grid-rows-[minmax(0,1fr)_auto] md:grid-rows-1">
      <div className="md:col-span-2 bg-muted/40 rounded-xl flex items-center justify-center p-4 relative overflow-hidden min-h-[300px] md:min-h-0 h-full">
        {inDrawingMode && (
          <div className="relative w-full h-full flex items-center justify-center">
            <canvas ref={drawingCanvasRef} className="absolute inset-0 w-auto h-auto max-w-full max-h-full object-contain pointer-events-none" />
            <canvas 
              ref={previewCanvasRef}
              className="absolute inset-0 w-auto h-auto max-w-full max-h-full object-contain cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onMouseMove={draw}
              onTouchStart={startDrawing}
              onTouchEnd={stopDrawing}
              onTouchCancel={stopDrawing}
              onTouchMove={draw}
            />
          </div>
        )}

        {editMode === 'crop' && (
           <ReactCrop 
              crop={crop} 
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspect}
              >
              <Image
                ref={imageRef}
                src={activeImage}
                alt="Cropping preview"
                width={800}
                height={600}
                className="max-w-full max-h-[calc(100vh-16rem)] object-contain"
                onLoad={onImageLoad}
                data-ai-hint="photo edit"
              />
            </ReactCrop>
        )}
        
        {(editMode === 'none' || inObjectMode) && (
            <div className="relative w-full h-full flex items-center justify-center">
                 <Image
                    ref={imageRef}
                    key={displayedImage}
                    src={displayedImage}
                    alt="Editing preview"
                    width={1000}
                    height={1000}
                    className="object-contain transition-all duration-300 w-auto h-auto max-w-full max-h-full"
                    style={isComparing ? {} : { filter: cssFilters, transform: cssTransform }}
                    data-ai-hint="photo edit"
                    onLoad={drawObjectsOnCanvas}
                  />
                  {inObjectMode && (
                    <canvas 
                        ref={objectCanvasRef}
                        className="absolute inset-0 w-auto h-auto max-w-full max-h-full object-contain cursor-move touch-none"
                        onMouseDown={handleCanvasInteractionStart}
                        onMouseMove={handleCanvasInteractionMove}
                        onMouseUp={handleCanvasInteractionEnd}
                        onMouseLeave={handleCanvasInteractionEnd}
                        onTouchStart={handleCanvasInteractionStart}
                        onTouchMove={handleCanvasInteractionMove}
                        onTouchEnd={handleCanvasInteractionEnd}
                        onTouchCancel={handleCanvasInteractionEnd}
                    />
                  )}
            </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-10">
              <Loader className="w-12 h-12 animate-spin text-primary" />
              <p className="mt-4 text-lg">AI is thinking...</p>
          </div>
        )}

      </div>

      <Card className="flex flex-col min-h-0">
        <CardContent className="p-4 flex-1 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-headline font-bold">
              {editMode === 'erase' ? 'Background Eraser' : 
               editMode === 'inpaint' ? 'Erase Tool' :
               editMode === 'crop' ? 'Crop Image' : 
               editMode === 'text' ? 'Add Text' :
               editMode === 'watermark' ? 'Add Watermark' :
               editMode === 'stickers' ? 'Add Stickers' : 'Editing Tools' }
            </h2>
            {!inEditMode && (
            <div className="flex items-center gap-1">
              <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         onMouseDown={() => setIsComparing(true)}
                         onMouseUp={() => setIsComparing(false)}
                         onTouchStart={() => setIsComparing(true)}
                         onTouchEnd={() => setIsComparing(false)}
                       >
                        <Layers className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Hold to Compare</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleUndo} disabled={!canUndo}>
                        <Undo className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Undo</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleRedo} disabled={!canRedo}>
                        <Redo className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Redo</p>
                    </TooltipContent>
                  </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleFullReset}>
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reset All</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pr-2 min-h-0">
            {inDrawingMode ? (
               <div className="space-y-6">
                 <div>
                    <Label htmlFor="brush-size" className="flex items-center gap-2 mb-2">
                      <Eraser className="w-4 h-4 text-muted-foreground" />
                      Brush Size
                    </Label>
                    <Slider
                      id="brush-size"
                      min={5}
                      max={100}
                      step={1}
                      value={[brushSize]}
                      onValueChange={([value]) => setBrushSize(value)}
                    />
                 </div>
                 <div className="flex items-center justify-center p-4 bg-muted/50 rounded-lg">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ 
                        width: brushSize, 
                        height: brushSize,
                        backgroundColor: editMode === 'erase' ? 'rgba(255,0,0,0.5)' : 'rgba(0,0,255,0.5)'
                     }}>
                    </div>
                 </div>
                 <div className="flex items-center justify-center gap-2">
                     <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={handleUndoDraw} disabled={!canUndoDraw}>
                                    <Undo className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Undo Stroke</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={handleRedoDraw} disabled={!canRedoDraw}>
                                    <Redo className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Redo Stroke</p></TooltipContent>
                        </Tooltip>
                     </TooltipProvider>
                 </div>
                 <div className="grid grid-cols-2 gap-2 pt-4">
                  <Button variant="outline" onClick={handleCancelDrawing}>Cancel</Button>
                  <Button onClick={editMode === 'erase' ? handleApplyErase : handleApplyInpaint}>Apply</Button>
                 </div>
               </div>
            ) : editMode === 'crop' ? (
                 <div className="space-y-4">
                    <Label className="flex items-center gap-2">
                        <Ratio className="w-4 h-4 text-muted-foreground" /> Aspect Ratio
                    </Label>
                    <div className="grid grid-cols-5 gap-2">
                        {ASPECT_RATIOS.map(ratio => (
                            <Button 
                                key={ratio.name}
                                variant={aspect === ratio.value ? 'secondary' : 'outline'}
                                onClick={() => onAspectChange(ratio.value)}
                                className="text-xs"
                            >
                                {ratio.name}
                            </Button>
                        ))}
                    </div>
                     <p className="text-sm text-muted-foreground pt-4">Adjust the selection on the image to crop it.</p>
                     <div className="grid grid-cols-2 gap-2 pt-2">
                        <Button variant="outline" onClick={() => setEditMode('none')}>Cancel</Button>
                        <Button onClick={applyCrop}><CropIcon className="mr-2 h-4 w-4"/> Apply Crop</Button>
                     </div>
                 </div>
            ) : editMode === 'text' ? (
                <div className="space-y-4">
                    <Button onClick={handleAddText} className="w-full">Add Text</Button>
                    {selectedText && (
                      <div className="space-y-4 p-2 border rounded-lg">
                        <h3 className="font-semibold text-center">Edit Text</h3>
                         <div>
                            <Label htmlFor="text-input">Text</Label>
                            <Input id="text-input" value={selectedText.text} onChange={(e) => updateTextElement(selectedText.id, {text: e.target.value})} />
                         </div>
                         <div>
                            <Label htmlFor="font-family">Font Family</Label>
                             <Select value={selectedText.fontFamily} onValueChange={(value) => updateTextElement(selectedText.id, { fontFamily: value })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {FONT_FACES.map(font => <SelectItem key={font.value} value={font.value} style={{fontFamily: font.value}}>{font.name}</SelectItem>)}
                                </SelectContent>
                             </Select>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="font-size">Size</Label>
                                <Slider id="font-size" min={10} max={200} value={[selectedText.fontSize]} onValueChange={([v]) => updateTextElement(selectedText.id, {fontSize: v})} />
                            </div>
                            <div>
                                <Label htmlFor="font-rotation">Rotate</Label>
                                <Slider id="font-rotation" min={-180} max={180} value={[selectedText.rotation]} onValueChange={([v]) => updateTextElement(selectedText.id, {rotation: v})} />
                            </div>
                         </div>
                         <div className="flex items-center gap-4">
                            <Label>Color</Label>
                            <Input type="color" value={selectedText.color} onChange={e => updateTextElement(selectedText.id, {color: e.target.value})} className="p-0 h-8 w-12" />
                         </div>
                         <div className="grid grid-cols-2 gap-2">
                             <Button variant={selectedText.bold ? 'secondary' : 'outline'} onClick={() => updateTextElement(selectedText.id, {bold: !selectedText.bold})}><Bold/></Button>
                             <Button variant={selectedText.italic ? 'secondary' : 'outline'} onClick={() => updateTextElement(selectedText.id, {italic: !selectedText.italic})}><Italic/></Button>
                         </div>
                         <div className="flex items-center justify-between">
                            <Label htmlFor="shadow" className="flex items-center gap-2">Shadow</Label>
                            <Switch id="shadow" checked={selectedText.shadow} onCheckedChange={c => updateTextElement(selectedText.id, {shadow: c})} />
                         </div>
                         <div className="flex items-center justify-between">
                            <Label htmlFor="stroke" className="flex items-center gap-2">Stroke</Label>
                            <Switch id="stroke" checked={selectedText.stroke} onCheckedChange={c => updateTextElement(selectedText.id, {stroke: c})} />
                         </div>
                         <Button variant="destructive" size="sm" onClick={() => setTextElements(textElements.filter(t => t.id !== selectedText.id))}>Remove Text</Button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-4">
                        <Button variant="outline" onClick={cancelObjectEditing}>Cancel</Button>
                        <Button onClick={handleApplyObjects}>Apply Text</Button>
                    </div>
                </div>
            ) : editMode === 'stickers' ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-2">
                        {STICKERS.map(sticker => (
                            <Button key={sticker} variant="outline" className="text-2xl aspect-square h-auto" onClick={() => handleAddSticker(sticker)}>
                                {sticker}
                            </Button>
                        ))}
                    </div>
                    {selectedSticker && (
                        <div className="space-y-4 p-2 border rounded-lg">
                            <h3 className="font-semibold text-center">Edit Sticker</h3>
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="sticker-size">Size</Label>
                                    <Slider id="sticker-size" min={20} max={300} value={[selectedSticker.size]} onValueChange={([v]) => updateStickerElement(selectedSticker.id, {size: v})} />
                                </div>
                                <div>
                                    <Label htmlFor="sticker-rotation">Rotate</Label>
                                    <Slider id="sticker-rotation" min={-180} max={180} value={[selectedSticker.rotation]} onValueChange={([v]) => updateStickerElement(selectedSticker.id, {rotation: v})} />
                                </div>
                             </div>
                             <Button variant="destructive" size="sm" onClick={() => setStickerElements(stickerElements.filter(t => t.id !== selectedSticker.id))}>Remove Sticker</Button>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-4">
                        <Button variant="outline" onClick={cancelObjectEditing}>Cancel</Button>
                        <Button onClick={handleApplyObjects}>Apply Stickers</Button>
                    </div>
                </div>
            ) : editMode === 'watermark' ? (
                <div className="space-y-4">
                    {watermark && (
                      <div className="space-y-4 p-2 border rounded-lg">
                        <h3 className="font-semibold text-center">Edit Watermark</h3>
                         <div>
                            <Label htmlFor="watermark-input">Text</Label>
                            <Input id="watermark-input" value={watermark.text} onChange={(e) => updateWatermarkElement({text: e.target.value})} />
                         </div>
                         <div>
                            <Label>Color</Label>
                             <RadioGroup defaultValue={watermark.color.startsWith('rgba(0,0,0') ? 'black' : 'white'} onValueChange={(value) => updateWatermarkElement({ color: value as 'black' | 'white'})} className="flex gap-4 pt-2">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="white" id="white" />
                                    <Label htmlFor="white">White</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="black" id="black" />
                                    <Label htmlFor="black">Black</Label>
                                </div>
                             </RadioGroup>
                         </div>
                         <div>
                             <Label htmlFor="watermark-opacity">Opacity</Label>
                             <Slider id="watermark-opacity" min={0} max={1} step={0.05} value={[watermark.opacity]} onValueChange={([v]) => updateWatermarkElement({opacity: v})} />
                         </div>
                         <div>
                            <Label htmlFor="watermark-size">Size</Label>
                            <Slider id="watermark-size" min={10} max={200} value={[watermark.size]} onValueChange={([v]) => updateWatermarkElement({size: v})} />
                         </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-4">
                        <Button variant="outline" onClick={cancelObjectEditing}>Cancel</Button>
                        <Button onClick={handleApplyObjects}>Apply Watermark</Button>
                    </div>
                </div>
            ) : (
            <Accordion type="multiple" defaultValue={['ai-tools', 'adjustments']} className="w-full">
              <AccordionItem value="ai-tools">
                <AccordionTrigger className="font-semibold"><Sparkles className="mr-2 text-primary h-5 w-5"/>AI Tools</AccordionTrigger>
                <AccordionContent className="space-y-2 pt-2 grid grid-cols-2 gap-2">
                  <Button onClick={handleAutoEnhance} className="w-full bg-primary/90 hover:bg-primary col-span-2">
                    <Wand2 className="mr-2 h-4 w-4" /> Auto Enhance
                  </Button>
                   <Button onClick={() => setEditMode('erase')} className="w-full">
                    <Scissors className="mr-2 h-4 w-4" /> BG Eraser
                  </Button>
                   <Button onClick={() => setEditMode('inpaint')} className="w-full">
                    <Wand2 className="mr-2 h-4 w-4" /> Erase Tool
                  </Button>
                  <Button onClick={() => { setEditMode('text'); setSelectedObjectId({id: null, type: 'text'}); }} className="w-full">
                    <Type className="mr-2 h-4 w-4" /> Add Text
                  </Button>
                  <Button onClick={() => { setEditMode('stickers'); setSelectedObjectId({id: null, type: 'sticker'}); }} className="w-full">
                    <Smile className="mr-2 h-4 w-4" /> Add Stickers
                  </Button>
                  <Button onClick={() => setEditMode('watermark')} className="w-full col-span-2">
                    <Copyright className="mr-2 h-4 w-4" /> Watermark
                  </Button>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="adjustments">
                <AccordionTrigger className="font-semibold">Adjustments</AccordionTrigger>
                <AccordionContent className="space-y-6 pt-4">
                  {(Object.keys(INITIAL_STATE) as Array<keyof EditorState>).slice(0, 6).map((key) => {
                      const icons: Record<string, React.ReactNode> = {
                        brightness: <Sun className="w-4 h-4 text-muted-foreground" />,
                        contrast: <Contrast className="w-4 h-4 text-muted-foreground" />,
                        saturate: <Droplets className="w-4 h-4 text-muted-foreground" />,
                        grayscale: <Palette className="w-4 h-4 text-muted-foreground" />,
                        sepia: <Palette className="w-4 h-4 text-muted-foreground" />,
                        hueRotate: <Palette className="w-4 h-4 text-muted-foreground" />,
                      };
                      return (
                        <div key={key} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label htmlFor={key} className="flex items-center gap-2 capitalize">
                              {icons[key]}
                              {key.replace('Rotate', ' Rotate')}
                            </Label>
                            <span className="text-sm text-muted-foreground">{state[key]}</span>
                          </div>
                          <Slider
                            id={key}
                            min={key === 'hueRotate' ? -180 : 0}
                            max={key.match(/brightness|contrast|saturate/) ? 200 : key === 'hueRotate' ? 180 : 100}
                            step={1}
                            value={[state[key]]}
                            onValueChange={([value]) => updateFilter(key, value)}
                          />
                        </div>
                      );
                  })}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="filters">
                <AccordionTrigger className="font-semibold">Filters</AccordionTrigger>
                <AccordionContent className="pt-4 grid grid-cols-2 gap-2">
                   <Button key="Clarity" variant="outline" onClick={() => applyPreset(AUTO_ENHANCE_PRESET)} className="flex items-center justify-start gap-2 h-12">
                      <span className="text-lg">✨</span>
                      <span className="font-medium">Clarity</span>
                    </Button>
                  {PRESETS.map((preset) => (
                    <Button key={preset.name} variant="outline" onClick={() => applyPreset(preset.settings as Partial<EditorState>)} className="flex items-center justify-start gap-2 h-12">
                      <span className="text-lg">{preset.icon}</span>
                      <span className="font-medium">{preset.name}</span>
                    </Button>
                  ))}
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="transform">
                <AccordionTrigger className="font-semibold">Transform</AccordionTrigger>
                <AccordionContent className="pt-4 grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => rotate(90)}><RotateCw className="mr-2 h-4 w-4"/> Rotate</Button>
                  <Button variant="outline" onClick={() => rotate(-90)}><RotateCw className="mr-2 h-4 w-4 scale-x-[-1]"/> Rotate</Button>
                  <Button variant="outline" onClick={() => flip('horizontal')}><FlipHorizontal className="mr-2 h-4 w-4"/> Flip</Button>
                  <Button variant="outline" onClick={() => flip('vertical')}><FlipVertical className="mr-2 h-4 w-4"/> Flip</Button>
                  <Button variant="outline" onClick={() => setEditMode('crop')} className="col-span-2"><CropIcon className="mr-2 h-4 w-4"/> Crop Image</Button>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            )}
          </div>

          {!inEditMode && (<div className="mt-auto pt-4">
            <Button size="lg" className="w-full bg-accent hover:bg-accent/90" onClick={handleExport}>
              <Download className="mr-2 h-5 w-5"/> Export Image
            </Button>
          </div>)}
        </CardContent>
      </Card>
    </div>
  );
}
