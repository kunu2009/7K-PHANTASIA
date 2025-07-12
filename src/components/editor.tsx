'use client';
import { useState, useRef, useCallback } from 'react';
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
import { enhanceImageQualityAction, removeBackgroundAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, RotateCcw, Sun, Contrast, Droplets, Palette, Bot, RotateCw, FlipHorizontal, FlipVertical, Download, Wand2, CropIcon, Scissors } from 'lucide-react';
import type { EditorState } from '@/lib/types';
import { Skeleton } from './ui/skeleton';

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


export function Editor({ image }: EditorProps) {
  const { state, updateFilter, rotate, flip, applyPreset, reset, cssFilters, cssTransform } = useImageEditor();
  const [activeImage, setActiveImage] = useState(image);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const imageRef = useRef<HTMLImageElement>(null);
  const { toast } = useToast();

  const [crop, setCrop] = useState<Crop>();
  const [isCropping, setIsCropping] = useState(false);

  const handleEnhance = async () => {
    setIsProcessing(true);
    setProcessingMessage('Enhancing...');
    setReasoning(null);
    try {
      const result = await enhanceImageQualityAction(activeImage);
      if (result.enhancedPhotoDataUri) {
        setActiveImage(result.enhancedPhotoDataUri);
        setReasoning(result.reasoning);
      } else {
        throw new Error("The AI didn't return an enhanced image.");
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Enhancement Failed',
        description: (error as Error).message,
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleRemoveBackground = async () => {
    setIsProcessing(true);
    setProcessingMessage('Removing background...');
    setReasoning(null);
    try {
      const result = await removeBackgroundAction(activeImage);
       if (result.photoWithTransparentBackground) {
        setActiveImage(result.photoWithTransparentBackground);
        setReasoning('The background has been removed.');
      } else {
         throw new Error("The AI didn't return an image with the background removed.");
      }
    } catch (error) {
       toast({
        variant: 'destructive',
        title: 'Background Removal Failed',
        description: (error as Error).message,
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, 16/9, width, height),
      width,
      height
    );
    setCrop(initialCrop);
  };
  
  const getCroppedImg = (sourceSrc: string, crop: Crop, imageElement: HTMLImageElement): Promise<string | null> => {
     return new Promise((resolve) => {
      const image = new window.Image();
      image.src = sourceSrc;
      image.crossOrigin = 'anonymous';

      image.onload = () => {
        const canvas = document.createElement('canvas');
        const scaleX = image.naturalWidth / imageElement.width;
        const scaleY = image.naturalHeight / imageElement.height;
        
        const pixelCropX = crop.x * scaleX;
        const pixelCropY = crop.y * scaleY;
        const pixelCropWidth = crop.width * scaleX;
        const pixelCropHeight = crop.height * scaleY;

        canvas.width = pixelCropWidth;
        canvas.height = pixelCropHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(
          image,
          pixelCropX,
          pixelCropY,
          pixelCropWidth,
          pixelCropHeight,
          0,
          0,
          pixelCropWidth,
          pixelCropHeight
        );
        resolve(canvas.toDataURL('image/png'));
      }
      image.onerror = () => {
        resolve(null);
      }
    });
  }

  const applyCrop = useCallback(async () => {
    if (crop && imageRef.current) {
        const croppedImageUrl = await getCroppedImg(activeImage, crop, imageRef.current);
        if (croppedImageUrl) {
            setActiveImage(croppedImageUrl);
        }
    }
    setIsCropping(false);
  }, [crop, activeImage]);

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
        canvas.height = originalWidth * absSin + originalHeight * absCos;
        
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

  return (
    <div className="grid md:grid-cols-3 gap-8 h-[calc(100vh-10rem)]">
      <div className="md:col-span-2 bg-muted/40 rounded-xl flex items-center justify-center p-4 relative overflow-hidden">
        {isCropping ? (
           <ReactCrop crop={crop} onChange={c => setCrop(c)} aspect={16 / 9}>
              <Image
                ref={imageRef}
                key={activeImage}
                src={activeImage}
                alt="Cropping preview"
                fill
                className="object-contain"
                onLoad={onImageLoad}
                data-ai-hint="photo edit"
              />
            </ReactCrop>
        ) : (
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

      <Card className="flex flex-col">
        <CardContent className="p-4 flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-headline font-bold">Editing Tools</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={reset}>
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reset All</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex-1 overflow-y-auto pr-2">
            <Accordion type="multiple" defaultValue={['ai-tools', 'adjustments']} className="w-full">
              <AccordionItem value="ai-tools">
                <AccordionTrigger className="font-semibold"><Sparkles className="mr-2 text-primary h-5 w-5"/>AI Tools</AccordionTrigger>
                <AccordionContent className="space-y-2 pt-2 grid grid-cols-2 gap-2">
                  <Button onClick={handleEnhance} disabled={isProcessing} className="w-full bg-primary/90 hover:bg-primary col-span-2">
                    <Wand2 className="mr-2 h-4 w-4" /> {isProcessing && processingMessage === 'Enhancing...' ? 'Enhancing...' : 'Auto Enhance'}
                  </Button>
                   <Button onClick={handleRemoveBackground} disabled={isProcessing} className="w-full">
                    <Scissors className="mr-2 h-4 w-4" /> {isProcessing && processingMessage === 'Removing background...' ? 'Working...' : 'BG Remover'}
                  </Button>
                  {isProcessing && <Skeleton className="h-20 w-full col-span-2" />}
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
                   {isCropping ? (
                      <Button variant="secondary" onClick={applyCrop} className="col-span-2"><CropIcon className="mr-2 h-4 w-4"/> Apply Crop</Button>
                    ) : (
                      <Button variant="outline" onClick={() => setIsCropping(true)} className="col-span-2"><CropIcon className="mr-2 h-4 w-4"/> Crop Image</Button>
                    )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <div className="mt-auto pt-4">
            <Button size="lg" className="w-full bg-accent hover:bg-accent/90" onClick={handleExport}>
              <Download className="mr-2 h-5 w-5"/> Export Image
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
