
'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera as CameraIcon, VideoOff, RefreshCcw, ArrowLeft } from 'lucide-react';

interface CameraProps {
  onImageCapture: (imageDataUrl: string) => void;
  onBack: () => void;
}

export function Camera({ onImageCapture, onBack }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isFrontCamera, setIsFrontCamera] = useState(false);
  const { toast } = useToast();

  const startCamera = useCallback(async (front = false) => {
    // Stop any existing tracks before starting a new one
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }

    try {
        const constraints: MediaStreamConstraints = {
            video: {
                facingMode: front ? 'user' : 'environment'
            }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
  }, [toast]);
  
  useEffect(() => {
    startCamera(isFrontCamera);

    return () => {
        // Cleanup: stop video tracks when component unmounts
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    }
  }, [isFrontCamera, startCamera]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && hasCameraPermission) {
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Flip the image horizontally if it's from the front camera to un-mirror it
        if (isFrontCamera) {
          context.save();
          context.scale(-1, 1);
          context.drawImage(video, -video.videoWidth, 0, video.videoWidth, video.videoHeight);
          context.restore();
        } else {
          context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        }

        const dataUrl = canvas.toDataURL('image/png');
        onImageCapture(dataUrl);
      }
    } else {
        toast({
            variant: 'destructive',
            title: 'Capture Failed',
            description: 'Could not capture image. Please ensure camera permissions are enabled.',
        })
    }
  };

  const handleSwitchCamera = () => {
      setIsFrontCamera(prev => !prev);
  }

  return (
    <div className="flex-1 flex flex-col bg-black text-white relative">
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/50 to-transparent flex items-center justify-between p-4 z-10">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft /></Button>
      </div>

      <div className="flex-1 flex items-center justify-center relative">
        {/* The video element is visually flipped via CSS for a natural mirror effect */}
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline style={{ transform: isFrontCamera ? 'scaleX(-1)' : 'scaleX(1)' }}/>
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
      
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-4 z-10">
        <div className="flex items-center justify-center w-full">
            <div className="w-24"></div>
            <button 
              onClick={handleCapture}
              className="w-20 h-20 rounded-full border-4 border-white bg-transparent ring-4 ring-black/50 active:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!hasCameraPermission}
              aria-label="Capture photo"
            />
            <div className="w-24 flex items-center justify-center">
                <Button variant="ghost" size="icon" onClick={handleSwitchCamera} disabled={!hasCameraPermission}><RefreshCcw /></Button>
            </div>
        </div>
      </div>
    </div>
  );
}

    