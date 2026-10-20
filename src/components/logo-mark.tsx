"use client";

import { useEffect, useRef, useState } from "react";
import { logoImageClass } from "@/lib/events/appearance";
import {
  logoFrameSize,
  logoImageBox,
  type LogoPlacement,
} from "@/lib/events/logo-placement";
import { cn } from "@/lib/utils";

export function LogoMark({
  src,
  size,
  corner,
  placement,
  className,
  interactive = false,
  dragLabel,
  onPlacementChange,
}: {
  src: string;
  size: string;
  corner: string;
  placement: LogoPlacement;
  className?: string;
  interactive?: boolean;
  dragLabel?: string;
  onPlacementChange?: (placement: LogoPlacement) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    placement: LogoPlacement;
  } | null>(null);
  const [maxWidth, setMaxWidth] = useState(0);
  const [wide, setWide] = useState(false);
  const [image, setImage] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const node = hostRef.current?.parentElement;

    if (!node) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      setMaxWidth(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    const apply = () => setWide(media.matches);
    const frame = requestAnimationFrame(apply);
    media.addEventListener("change", apply);

    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", apply);
    };
  }, []);

  useEffect(() => {
    const picture = new Image();
    let cancelled = false;
    picture.onload = () => {
      if (!cancelled && picture.naturalWidth > 0 && picture.naturalHeight > 0) {
        setImage({ width: picture.naturalWidth, height: picture.naturalHeight });
      }
    };
    picture.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  const frame = logoFrameSize({
    size,
    corner,
    wide,
    maxWidth,
    image,
  });
  const drawn = frame && image ? logoImageBox(frame, image, placement) : null;

  useEffect(() => {
    if (!interactive || !drawn) {
      return;
    }

    const fitted = drawn.placement;
    const changed =
      fitted.scale !== placement.scale ||
      Math.abs(fitted.x - placement.x) > 0.0001 ||
      Math.abs(fitted.y - placement.y) > 0.0001;

    if (changed) {
      onPlacementChange?.(fitted);
    }
  }, [drawn, interactive, onPlacementChange, placement]);

  function move(next: LogoPlacement) {
    if (!frame || !image) {
      return;
    }

    onPlacementChange?.(logoImageBox(frame, image, next).placement);
  }

  return (
    <div ref={hostRef} className={cn("flex w-full justify-center", className)}>
      {frame && drawn ? (
        <div
          role={interactive ? "application" : undefined}
          aria-label={interactive ? dragLabel : undefined}
          tabIndex={interactive ? 0 : undefined}
          className={cn(
            "relative overflow-hidden",
            frame.rounded && "rounded-full",
            interactive && "cursor-grab touch-none outline-dashed outline-1 outline-border active:cursor-grabbing",
          )}
          style={{ width: frame.width, height: frame.height }}
          onPointerDown={(event) => {
            if (!interactive || event.button !== 0) {
              return;
            }

            dragRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              placement,
            };

            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // A real pointer can be captured. Synthetic events have no active pointer.
            }
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;

            if (!drag || drag.pointerId !== event.pointerId) {
              return;
            }

            move({
              scale: drag.placement.scale,
              x: drag.placement.x + (event.clientX - drag.startX) / frame.width,
              y: drag.placement.y + (event.clientY - drag.startY) / frame.height,
            });
          }}
          onPointerUp={(event) => {
            if (dragRef.current?.pointerId === event.pointerId) {
              dragRef.current = null;
            }
          }}
          onKeyDown={(event) => {
            if (!interactive) {
              return;
            }

            const stepX = 8 / frame.width;
            const stepY = 8 / frame.height;
            const deltas: Record<string, { x: number; y: number }> = {
              ArrowLeft: { x: -stepX, y: 0 },
              ArrowRight: { x: stepX, y: 0 },
              ArrowUp: { x: 0, y: -stepY },
              ArrowDown: { x: 0, y: stepY },
            };
            const delta = deltas[event.key];

            if (!delta) {
              return;
            }

            event.preventDefault();
            move({
              scale: placement.scale,
              x: placement.x + delta.x,
              y: placement.y + delta.y,
            });
          }}
        >
          {/* The original file is positioned, not cropped or re-encoded. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{
              width: drawn.width,
              height: drawn.height,
              left: drawn.left,
              top: drawn.top,
            }}
          />
        </div>
      ) : (
        <div className={logoImageClass(size, corner, "screen")} />
      )}
    </div>
  );
}
