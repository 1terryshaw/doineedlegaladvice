'use client';

import { useState, useCallback } from 'react';
import { Share2, Link2, Mail, Send, Globe, MessageCircle, ExternalLink, MessageSquare } from 'lucide-react';

interface ShareButtonsProps {
  url?: string;
  title: string;
  description?: string;
  variant?: 'compact' | 'full';
}

export default function ShareButtons({ url, title, description, variant = 'full' }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDesc = encodeURIComponent(description || title);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  const handleNativeShare = useCallback(async () => {
    try {
      await navigator.share({ title, text: description || title, url: shareUrl });
    } catch {
      // User cancelled or share failed
    }
  }, [title, description, shareUrl]);

  const compact = variant === 'compact';
  const btnBase = compact
    ? 'inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-gray-700 transition-colors duration-150'
    : 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 hover:text-gray-800 transition-colors duration-150';
  const iconSize = compact ? 16 : 18;

  const buttons = [
    { label: 'Copy link', icon: <Link2 size={iconSize} />, onClick: handleCopy, showLabel: copied ? 'Copied!' : 'Copy link' },
    { label: 'Email', icon: <Mail size={iconSize} />, href: `mailto:?subject=${encodedTitle}&body=${encodedDesc}%0A%0A${encodedUrl}` },
    { label: 'X', icon: <Send size={iconSize} />, href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}` },
    { label: 'Facebook', icon: <Globe size={iconSize} />, href: `https://www.facebook.com/sharer.php?u=${encodedUrl}` },
    { label: 'WhatsApp', icon: <MessageCircle size={iconSize} />, href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}` },
    { label: 'LinkedIn', icon: <ExternalLink size={iconSize} />, href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
    { label: 'Reddit', icon: <MessageSquare size={iconSize} />, href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}` },
  ];

  // Mobile native share
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleNativeShare}
          className={btnBase}
          aria-label="Share"
        >
          <Share2 size={iconSize} />
          {!compact && <span>Share</span>}
        </button>
        <button
          onClick={handleCopy}
          className={btnBase}
          aria-label="Copy link"
        >
          <Link2 size={iconSize} />
          {!compact && <span>{copied ? 'Copied!' : 'Copy link'}</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {buttons.map((btn) => {
        if (btn.onClick) {
          return (
            <button
              key={btn.label}
              onClick={btn.onClick}
              className={btnBase}
              aria-label={btn.label}
            >
              {btn.icon}
              {!compact && <span>{btn.showLabel || btn.label}</span>}
            </button>
          );
        }
        return (
          <a
            key={btn.label}
            href={btn.href}
            target="_blank"
            rel="noopener noreferrer"
            className={btnBase}
            aria-label={btn.label}
          >
            {btn.icon}
            {!compact && <span>{btn.label}</span>}
          </a>
        );
      })}
    </div>
  );
}
