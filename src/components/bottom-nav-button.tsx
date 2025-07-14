'use client';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface BottomNavButtonProps {
    icon: LucideIcon;
    label: string;
    isActive?: boolean;
    onClick: () => void;
}

export function BottomNavButton({ icon: Icon, label, isActive, onClick }: BottomNavButtonProps) {
    return (
        <Button
            variant="ghost"
            className={cn(
                "flex flex-col items-center justify-center h-16 w-20 rounded-lg gap-1",
                isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground'
            )}
            onClick={onClick}
        >
            <Icon className="w-6 h-6" />
            <span className="text-xs font-medium">{label}</span>
        </Button>
    )
}
