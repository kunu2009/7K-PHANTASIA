
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
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useImageEditor, INITIAL_STATE } from '@/hooks/use-image-editor';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, RotateCcw, Sun, Contrast, Droplets, Palette, Bot, RotateCw, FlipHorizontal, FlipVertical, Download, Wand2, CropIcon, Scissors, Undo, Redo, Eraser, Circle } from 'lucide-react';
import type { EditorState } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { enhanceImageQualityAction } from '@/lib/actions';

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
  { name: 'Clarity', icon: '✨', settings: { contrast: 120, saturate: 110, brightness: 105 } },
  { name: 'Sin City', icon: '🌆', settings: { contrast: 200, grayscale: 100, brightness: 80, sepia: 20 } },
  { name: 'Sunrise', icon: '🌅', settings: { contrast: 110, saturate: 140, brightness: 110, sepia: 10, hueRotate: -10 } },
];

type EditMode = 'none' | 'crop' | 'erase';

export function Editor({ image }: EditorProps) {
  const { state, updateFilter, rotate, flip, applyPreset, reset, cssFilters, cssTransform } = useImageEditor();
  
  const [history, setHistory] = useState<string[]>([image]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const activeImage = history[historyIndex];

  const [reasoning, setReasoning] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const { toast } = useToast();

  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [brushSize, setBrushSize] = useState(40);
  
  const eraseCanvasRef = useRef<HTMLCanvasElement>(null);
  const erasePreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

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
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        1, 
        width,
        height
      ),
      width,
      height
    );
    setCrop(crop);
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
        }
    };
  }, [activeImage]);

  useEffect(() => {
    if (editMode === 'erase') {
      setupEraseCanvas();
      window.addEventListener('resize', setupEraseCanvas);
    }
    return () => {
        window.removeEventListener('resize', setupEraseCanvas);
    }
  }, [editMode, activeImage, setupEraseCanvas]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = erasePreviewCanvasRef.current;
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
    setIsProcessing(true);
    setReasoning(null);
    try {
      const result = await enhanceImageQualityAction(activeImage);
      if (result.enhancedPhotoDataUri) {
        updateHistory(result.enhancedPhotoDataUri);
        setReasoning(result.reasoning);
      } else {
        throw new Error("AI enhancement failed to return an image.");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast({
        variant: "destructive",
        title: "AI Enhance Failed",
        description: errorMessage,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFullReset = () => {
    reset();
    setHistory([image]);
    setHistoryIndex(0);
    setEditMode('none');
  }

  const inEditMode = editMode !== 'none';

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
                className="max-w-full max-h-full object-contain"
                onLoad={onImageLoad}
                data-ai-hint="photo edit"
              />
            </ReactCrop>
        )}

        {editMode === 'none' && (
          <Image
            ref={imageRef}
            key={activeImage}
            src={activeImage}
            alt="Editing preview"
            fill
            className="object-contain transition-all duration-300"
            style={{ filter: cssFilters, transform: cssTransform }}
            data-ai-hint="photo edit"
          />
        )}
      </div>

      <Card className="flex flex-col min-h-0">
        <CardContent className="p-4 flex-1 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-headline font-bold">
              {editMode === 'erase' ? 'Erase Background' : editMode === 'crop' ? 'Crop Image' : 'Editing Tools' }
            </h2>
            {!inEditMode && (
            <div className="flex items-center gap-1">
              <TooltipProvider>
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
                 <div className="grid grid-cols-2 gap-2 pt-4">
                  <Button variant="outline" onClick={handleCancelErase}>Cancel</Button>
                  <Button onClick={handleApplyErase}>Apply Erase</Button>
                 </div>
               </div>
            ) : editMode === 'crop' ? (
                 <div className="space-y-6">
                     <p className="text-sm text-muted-foreground">Adjust the selection on the. image to crop it.</p>
                     <div className="grid grid-cols-2 gap-2 pt-4">
                        <Button variant="outline" onClick={() => setEditMode('none')}>Cancel</Button>
                        <Button onClick={applyCrop}><CropIcon className="mr-2 h-4 w-4"/> Apply Crop</Button>
                     </div>
                 </div>
            ) : (
            <Accordion type="multiple" defaultValue={['ai-tools', 'adjustments']} className="w-full">
              <AccordionItem value="ai-tools">
                <AccordionTrigger className="font-semibold"><Sparkles className="mr-2 text-primary h-5 w-5"/>AI Tools</AccordionTrigger>
                <AccordionContent className="space-y-2 pt-2 grid grid-cols-2 gap-2">
                  <Button onClick={handleAutoEnhance} disabled={isProcessing} className="w-full bg-primary/90 hover:bg-primary col-span-2">
                    <Wand2 className="mr-2 h-4 w-4" /> {isProcessing ? 'Working...' : 'Auto Enhance'}
                  </Button>
                   <Button onClick={() => setEditMode('erase')} disabled={isProcessing} className="w-full col-span-2">
                    <Scissors className="mr-2 h-4 w-4" /> BG Remover
                  </Button>
                  {isProcessing && !reasoning && <Skeleton className="h-20 w-full col-span-2" />}
                  {reasoning && !isProcessing && (
                    <Alert className="col-span-2">
                      <Bot className="h-4 w-4" />
                      <AlertTitle>AI Analysis</AlertTitle>
                      <AlertDescription>{reasoning}</AlertDescription>
                    </Alert>
                  )}
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
