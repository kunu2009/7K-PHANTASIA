
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
import { Sparkles, RotateCcw, Sun, Contrast, Droplets, Palette, RotateCw, FlipHorizontal, FlipVertical, Download, Wand2, CropIcon, Scissors, Undo, Redo, Eraser, Layers, Type, Bold, Italic, Underline, CaseSensitive, Pilcrow } from 'lucide-react';
import type { EditorState, TextElement } from '@/lib/types';
import { Switch } from '@/components/ui/switch';


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

const AUTO_ENHANCE_PRESET: Partial<EditorState> = { contrast: 120, saturate: 110, brightness: 105 };

type EditMode = 'none' | 'crop' | 'erase' | 'text';

const FONT_FACES = [
  { name: 'PT Sans', value: 'PT Sans, sans-serif' },
  { name: 'Playfair Display', value: 'Playfair Display, serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Lobster', value: 'Lobster, cursive' },
  { name: 'Pacifico', value: 'Pacifico, cursive' },
  { name: 'Bebas Neue', value: 'Bebas Neue, sans-serif' },
];

export function Editor({ image }: EditorProps) {
  const { state, updateFilter, rotate, flip, applyPreset, reset, cssFilters, cssTransform } = useImageEditor();
  
  const [history, setHistory] = useState<string[]>([image]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const [activeImage, setActiveImage] = useState(history[historyIndex]);
  const [isComparing, setIsComparing] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const textCanvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [brushSize, setBrushSize] = useState(40);
  
  const eraseCanvasRef = useRef<HTMLCanvasElement>(null);
  const erasePreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [eraseHistory, setEraseHistory] = useState<string[]>([]);
  const [eraseHistoryIndex, setEraseHistoryIndex] = useState(-1);

  // Text state
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const dragOffsetRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  const selectedText = textElements.find(t => t.id === selectedTextId);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const canUndoErase = eraseHistoryIndex > 0;
  const canRedoErase = eraseHistoryIndex < eraseHistory.length - 1;

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
      setHistoryIndex(historyIndex + 1);
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
    setCrop(centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
      width,
      height
    ));
  };
  
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
  
  const saveEraseHistory = () => {
    const canvas = erasePreviewCanvasRef.current;
    if (!canvas) return;
    const newHistory = eraseHistory.slice(0, eraseHistoryIndex + 1);
    newHistory.push(canvas.toDataURL());
    setEraseHistory(newHistory);
    setEraseHistoryIndex(newHistory.length - 1);
  };

  const handleUndoErase = () => {
    if (!canUndoErase) return;
    const newIndex = eraseHistoryIndex - 1;
    setEraseHistoryIndex(newIndex);
    const canvas = erasePreviewCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const img = new window.Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = eraseHistory[newIndex];
  };

  const handleRedoErase = () => {
    if (!canRedoErase) return;
    const newIndex = eraseHistoryIndex + 1;
    setEraseHistoryIndex(newIndex);
    const canvas = erasePreviewCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const img = new window.Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = eraseHistory[newIndex];
  };

  const setupEraseCanvas = useCallback(() => {
    const eraseLayer = eraseCanvasRef.current;
    const previewLayer = erasePreviewCanvasRef.current;

    if (!eraseLayer || !previewLayer) return;

    const img = new window.Image();
    img.src = activeImage;
    img.crossOrigin = "anonymous";
    img.onload = () => {
        const { naturalWidth, naturalHeight } = img;
        const parent = eraseLayer.parentElement;
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
            
            [eraseLayer, previewLayer].forEach(canvas => {
                canvas.width = width;
                canvas.height = height;
            });

            const eraseCtx = eraseLayer.getContext('2d');
            if (eraseCtx) {
              eraseCtx.drawImage(img, 0, 0, width, height);
            }
            const previewCtx = previewLayer.getContext('2d');
            if (previewCtx) {
              previewCtx.clearRect(0,0, width, height);
            }
            // Initial state for eraser history
            const initialHistoryImage = previewLayer.toDataURL();
            setEraseHistory([initialHistoryImage]);
            setEraseHistoryIndex(0);
        }
    };
  }, [activeImage]);

  const drawTextOnCanvas = useCallback(() => {
    const canvas = textCanvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    textElements.forEach(text => {
      ctx.save();
      const fontStyle = `${text.italic ? 'italic' : ''} ${text.bold ? 'bold' : ''} ${text.fontSize}px "${text.fontFamily}"`;
      ctx.font = fontStyle;
      ctx.fillStyle = text.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (text.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }
      
      if(text.stroke) {
        ctx.strokeStyle = 'black'; // Or make this configurable
        ctx.lineWidth = 2;
      }

      ctx.translate(text.x, text.y);
      ctx.rotate(text.rotation * Math.PI / 180);

      if (text.stroke) {
        ctx.strokeText(text.text, 0, 0);
      }
      ctx.fillText(text.text, 0, 0);
      ctx.restore();
    });

  }, [textElements]);

  useEffect(() => {
    if (editMode === 'erase') {
      setupEraseCanvas();
      window.addEventListener('resize', setupEraseCanvas);
    }
    if (editMode === 'text') {
      drawTextOnCanvas();
    }
    return () => {
        window.removeEventListener('resize', setupEraseCanvas);
    }
  }, [editMode, activeImage, setupEraseCanvas, drawTextOnCanvas]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = editMode === 'erase' ? erasePreviewCanvasRef.current : textCanvasRef.current;
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
      saveEraseHistory();
    }
    setIsDrawing(false);
    lastPointRef.current = null;
  };
  
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;

    const previewCtx = erasePreviewCanvasRef.current?.getContext('2d');
    if (!previewCtx) return;

    const { x, y } = getCanvasCoordinates(e);
    
    previewCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    previewCtx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
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
      const eraseLayer = eraseCanvasRef.current;
      const previewLayer = erasePreviewCanvasRef.current;
      if (!eraseLayer || !previewLayer) return;

      const eraseCtx = eraseLayer.getContext('2d');
      if (!eraseCtx) return;

      eraseCtx.globalCompositeOperation = 'destination-out';
      eraseCtx.drawImage(previewLayer, 0, 0);

      const resultDataUrl = eraseLayer.toDataURL('image/png');
      updateHistory(resultDataUrl);
      setEditMode('none');
  };

  const handleCancelErase = () => {
      setEditMode('none');
  };

  const handleAddText = () => {
    const canvas = textCanvasRef.current;
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
    setSelectedTextId(newText.id);
  };

  const updateTextElement = (id: string, updates: Partial<TextElement>) => {
    setTextElements(textElements.map(t => t.id === id ? { ...t, ...updates } : t));
  };
  
  const handleTextCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoordinates(e);
    const clickedText = textElements.find(text => {
      // Basic bounding box collision detection
      const textWidth = text.fontSize * text.text.length / 2; // rough estimate
      return x > text.x - textWidth / 2 && x < text.x + textWidth / 2 &&
             y > text.y - text.fontSize / 2 && y < text.y + text.fontSize / 2;
    });

    if (clickedText) {
      setSelectedTextId(clickedText.id);
      setIsDraggingText(true);
      dragOffsetRef.current = { x: x - clickedText.x, y: y - clickedText.y };
    } else {
      setSelectedTextId(null);
    }
  };
  
  const handleTextCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingText && selectedTextId) {
      const { x, y } = getCanvasCoordinates(e);
      updateTextElement(selectedTextId, {
        x: x - dragOffsetRef.current.x,
        y: y - dragOffsetRef.current.y
      });
    }
  };

  const handleTextCanvasMouseUp = () => {
    setIsDraggingText(false);
  };

  const handleApplyText = () => {
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

      textElements.forEach(text => {
        ctx.save();
        const fontStyle = `${text.italic ? 'italic' : ''} ${text.bold ? 'bold' : ''} ${text.fontSize * scaleX}px "${text.fontFamily}"`;
        ctx.font = fontStyle;
        ctx.fillStyle = text.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
  
        if (text.shadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 5 * scaleX;
          ctx.shadowOffsetX = 2 * scaleX;
          ctx.shadowOffsetY = 2 * scaleY;
        }
        
        if (text.stroke) {
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 2 * scaleX;
        }

        ctx.translate(text.x * scaleX, text.y * scaleY);
        ctx.rotate(text.rotation * Math.PI / 180);

        if (text.stroke) {
          ctx.strokeText(text.text, 0, 0);
        }
        ctx.fillText(text.text, 0, 0);
        ctx.restore();
      });

      updateHistory(canvas.toDataURL('image/png'));
      setEditMode('none');
      setTextElements([]);
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

  const handleAutoEnhance = async () => {
    applyPreset(AUTO_ENHANCE_PRESET);
  };

  const handleFullReset = () => {
    reset();
    setHistory([image]);
    setHistoryIndex(0);
    setEditMode('none');
  }

  const inEditMode = editMode !== 'none';
  const displayedImage = isComparing ? image : activeImage;

  return (
    <div className="grid md:grid-cols-3 gap-8 h-full md:h-[calc(100vh-10rem)] grid-rows-[minmax(0,1fr)_auto] md:grid-rows-1">
      <div className="md:col-span-2 bg-muted/40 rounded-xl flex items-center justify-center p-4 relative overflow-hidden min-h-[300px] md:min-h-0 h-full">
        {editMode === 'erase' && (
          <div className="relative w-full h-full flex items-center justify-center">
            <canvas ref={eraseCanvasRef} className="absolute inset-0 w-auto h-auto max-w-full max-h-full object-contain pointer-events-none" />
            <canvas 
              ref={erasePreviewCanvasRef}
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
        
        {(editMode === 'none' || editMode === 'text') && (
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
                    onLoad={drawTextOnCanvas}
                  />
                  {editMode === 'text' && (
                    <canvas 
                        ref={textCanvasRef}
                        className="absolute inset-0 w-auto h-auto max-w-full max-h-full object-contain cursor-move touch-none"
                        onMouseDown={handleTextCanvasMouseDown}
                        onMouseMove={handleTextCanvasMouseMove}
                        onMouseUp={handleTextCanvasMouseUp}
                        onMouseLeave={handleTextCanvasMouseUp}
                    />
                  )}
            </div>
        )}
      </div>

      <Card className="flex flex-col min-h-0">
        <CardContent className="p-4 flex-1 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-headline font-bold">
              {editMode === 'erase' ? 'Erase Background' : 
               editMode === 'crop' ? 'Crop Image' : 
               editMode === 'text' ? 'Add Text' : 'Editing Tools' }
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
            {editMode === 'erase' ? (
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
                    <div className="w-20 h-20 rounded-full bg-red-500/50 flex items-center justify-center" style={{ width: brushSize, height: brushSize }}>
                    </div>
                 </div>
                 <div className="flex items-center justify-center gap-2">
                     <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={handleUndoErase} disabled={!canUndoErase}>
                                    <Undo className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Undo Stroke</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={handleRedoErase} disabled={!canRedoErase}>
                                    <Redo className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Redo Stroke</p></TooltipContent>
                        </Tooltip>
                     </TooltipProvider>
                 </div>
                 <div className="grid grid-cols-2 gap-2 pt-4">
                  <Button variant="outline" onClick={handleCancelErase}>Cancel</Button>
                  <Button onClick={handleApplyErase}>Apply Erase</Button>
                 </div>
               </div>
            ) : editMode === 'crop' ? (
                 <div className="space-y-6">
                     <p className="text-sm text-muted-foreground">Adjust the selection on the image to crop it.</p>
                     <div className="grid grid-cols-2 gap-2 pt-4">
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
                         <Button variant="destructive-outline" size="sm" onClick={() => setTextElements(textElements.filter(t => t.id !== selectedTextId))}>Remove Text</Button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-4">
                        <Button variant="outline" onClick={() => { setEditMode('none'); setTextElements([]); }}>Cancel</Button>
                        <Button onClick={handleApplyText}>Apply Text</Button>
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
                    <Scissors className="mr-2 h-4 w-4" /> BG Remover
                  </Button>
                  <Button onClick={() => setEditMode('text')} className="w-full">
                    <Type className="mr-2 h-4 w-4" /> Add Text
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
