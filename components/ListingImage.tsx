"use client";

import { useEffect, useRef, useState } from "react";
import { listingPhotoUrl } from "@/lib/listing-photo-url";

interface Props {
  src: string;
  alt: string;
  className: string;
  wrapperClassName?: string;
}

/** Hero and logo images collapse their wrapper on failure, including before hydration. */
export default function ListingImage({ src, alt, className, wrapperClassName }: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const url = listingPhotoUrl(src);

  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth === 0) setFailed(url);
  }, [url]);

  if (!url || failed === url) return null;

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={imageRef} src={url} alt={alt} className={className} onError={() => setFailed(url)} />
  );
  return wrapperClassName ? <div className={wrapperClassName}>{image}</div> : image;
}
