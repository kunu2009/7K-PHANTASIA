'use client';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera as CameraIcon, Video, VideoOff, Settings, GalleryHorizontal, Wand2, Bot, ChevronLeft, Sun, Moon } from 'lucide-react';

interface CameraProps {
  onImageCapture: (imageDataUrl: string) => void;
}

export function Camera({ onImageCapture }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use this app.',
        });
      }
    };

    getCameraPermission();

    return () => {
        // Cleanup: stop video tracks when component unmounts
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    }
  }, [toast]);

  return (
    <div className="flex-1 flex flex-col bg-black text-white relative">
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between p-4 z-10">
        <Button variant="ghost" size="icon"><ChevronLeft /></Button>
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">HDR: Auto</Button>
            <Button variant="ghost" size="icon"><Bot /></Button>
        </div>
        <Button variant="ghost" size="icon"><Settings /></Button>
      </div>

      <div className="flex-1 flex items-center justify-center relative">
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
        {hasCameraPermission === false && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4">
                <Alert variant="destructive" className="max-w-sm">
                  <VideoOff className="h-4 w-4" />
                  <AlertTitle>Camera Access Required</AlertTitle>
                  <AlertDescription>
                    Phantasia needs permission to use your camera. Please enable it in your browser settings and refresh the page.
                  </AlertDescription>
                </Alert>
            </div>
        )}
         {hasCameraPermission === null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <p>Requesting camera permission...</p>
            </div>
        )}
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-4 z-10">
        <div className="flex items-center justify-between w-full mb-4">
            <Button variant="ghost" size="sm">Auto</Button>
            <Button variant="ghost" size="sm">Portrait</Button>
            <Button variant="ghost" size="sm"><Moon className="w-4 h-4 mr-1"/>Night</Button>
            <Button variant="ghost" size="sm">Manual</Button>
        </div>
        <div className="flex items-center justify-around w-full">
            <Button variant="ghost" size="icon"><GalleryHorizontal/></Button>
            <button className="w-20 h-20 rounded-full border-4 border-white bg-transparent ring-4 ring-black/50 active:bg-white/20 transition-colors"></button>
            <Button variant="ghost" size="icon"><Wand2 /></Button>
        </div>
      </div>
    </div>
  );
}
