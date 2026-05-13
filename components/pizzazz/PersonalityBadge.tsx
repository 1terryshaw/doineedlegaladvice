import {
  Wrench, Leaf, Flower2, Smile, Fish, Zap, Home, Search, Star,
  Heart, Scissors, MessageSquare, Camera, Calculator, TrendingUp,
  Compass, Truck, Shield, Eye, Dumbbell, Activity, BookOpen,
  Monitor, Mountain, MapPin, Scale, Sparkles, Music, Hand,
  UtensilsCrossed, Paintbrush, Calendar,
  Stethoscope, PawPrint, Sprout, ClipboardCheck, Droplets,
  ScanEye, HardHat, GraduationCap,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Wrench, Leaf, Flower2, Smile, Fish, Zap, Home, Search, Star,
  Heart, Scissors, MessageSquare, Camera, Calculator, TrendingUp,
  Compass, Truck, Shield, Eye, Dumbbell, Activity, BookOpen,
  Monitor, Mountain, MapPin, Scale, Sparkles, Music, Hand,
  UtensilsCrossed, Paintbrush, Calendar,
  Stethoscope, PawPrint, Sprout, ClipboardCheck, Droplets,
  ScanEye, HardHat, GraduationCap,
};

interface PersonalityBadgeProps {
  word: string;
  iconName: string;
  color?: string;
}

export default function PersonalityBadge({ word, iconName, color = 'currentColor' }: PersonalityBadgeProps) {
  const Icon = ICON_MAP[iconName] || Search;

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-white/20 backdrop-blur-sm border border-white/30 text-white">
      <Icon size={14} color={color} />
      {word}
    </span>
  );
}
