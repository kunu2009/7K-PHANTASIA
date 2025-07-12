'use client';

import { useState, useCallback, useRef, type ChangeEvent, type DragEvent } from 'react';
import { UploadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FileUploaderProps {
  onImageUpload: (imageDataUrl: string) => void;
}

export function FileUploader({ onImageUpload }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File | undefined | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid File Type',
        description: 'Please upload an image file (e.g., JPEG, PNG).',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onImageUpload(reader.result as string);
    };
    reader.onerror = () => {
      toast({
        variant: 'destructive',
        title: 'Error Reading File',
        description: 'Could not read the selected file.',
      });
    };
    reader.readAsDataURL(file);
  }, [onImageUpload, toast]);

  const onDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      handleFile(event.dataTransfer.files[0]);
      event.dataTransfer.clearData();
    }
  }, [handleFile]);
  
  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const onDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);
  
  const onFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
        handleFile(event.target.files[0]);
    }
  }, [handleFile]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`w-full max-w-2xl p-12 border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-300 ${
          isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-muted'
        }`}
      >
        <input ref={inputRef} type="file" className="hidden" accept="image/*,.jpeg,.png,.jpg,.gif,.webp" onChange={onFileChange} />
        <div className="flex flex-col items-center gap-4">
          <UploadCloud className={`w-16 h-16 transition-colors duration-300 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
          <h2 className="text-2xl font-bold font-headline">Drag & Drop Your Photo</h2>
          <p className="text-muted-foreground">or click to browse your files</p>
          <p className="text-xs text-muted-foreground mt-4">Supports: PNG, JPG, WEBP, GIF</p>
        </div>
      </div>
    </div>
  );
}
