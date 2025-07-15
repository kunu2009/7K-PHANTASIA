'use client';
import { useState } from 'react';
import { Editor } from '@/components/editor';
import { FileUploader } from '@/components/file-uploader';
import { Camera } from '@/components/camera';
import { PhantasiaLogo } from '@/components/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Camera as CameraIcon } from 'lucide-react';

export default function Home() {
  const [image, setImage] = useState<string | null>(null);

  const handleImageUpload = (imageDataUrl: string) => {
    setImage(imageDataUrl);
  };

  const handleReset = () => {
    setImage(null);
  };

  if (image) {
    return <Editor image={image} onReset={handleReset} />;
  }
  
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <div className="mr-4 flex items-center">
            <PhantasiaLogo className="h-8 w-8 text-primary" />
            <span className="ml-2 text-2xl font-bold font-headline">Phantasia</span>
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        <Tabs defaultValue="camera" className="w-full flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 h-14 rounded-none">
              <TabsTrigger value="camera" className="h-full text-sm flex-col gap-1 data-[state=active]:border-b-2 border-primary rounded-none"><CameraIcon/> Capture</TabsTrigger>
              <TabsTrigger value="upload" className="h-full text-sm flex-col gap-1 data-[state=active]:border-b-2 border-primary rounded-none"><Upload/> Upload</TabsTrigger>
            </TabsList>
            <TabsContent value="camera" className="flex-1 flex flex-col">
                <Camera onImageCapture={handleImageUpload} />
            </TabsContent>
            <TabsContent value="upload" className="flex-1 flex flex-col">
                <FileUploader onImageUpload={handleImageUpload} />
            </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
