'use client';
import { useState } from 'react';
import { Editor } from '@/components/editor';
import { FileUploader } from '@/components/file-uploader';
import { PhantasiaLogo } from '@/components/icons';

export default function Home() {
  const [image, setImage] = useState<string | null>(null);

  const handleImageUpload = (imageDataUrl: string) => {
    setImage(imageDataUrl);
  };

  const handleReset = () => {
    setImage(null);
  };

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
        <div className="container mx-auto flex flex-1 flex-col py-8 px-4 w-full h-full">
          {image ? (
            <Editor image={image} onReset={handleReset} />
          ) : (
            <FileUploader onImageUpload={handleImageUpload} />
          )}
        </div>
      </main>
    </div>
  );
}

    