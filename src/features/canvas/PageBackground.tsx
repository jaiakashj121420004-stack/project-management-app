import { useCallback } from 'react';
import { Shape } from 'react-konva';
import type Konva from 'konva';
import { PAGE_PATTERN_SPACING, type PageType } from '@/lib/canvasPages';
import type { Camera } from './constants';
import type { CanvasPalette } from './useCanvasPalette';

interface PageBackgroundProps {
  /** Viewport size in screen pixels (the Stage size). */
  width: number;
  height: number;
  camera: Camera;
  pageType: PageType;
  palette: CanvasPalette;
}

/** Don't draw the pattern when lines would be denser than this (px on screen). */
const MIN_SCREEN_SPACING = 7;
/** Safety cap so an extreme zoom-out never asks for thousands of lines. */
const MAX_LINES = 600;

/**
 * The page background (blank/ruled/grid/dotted), drawn in WORLD coordinates
 * inside the stage-transformed layer — so the pattern pans and zooms together
 * with the canvas content. We compute the visible world rectangle from the
 * camera and tile the pattern across it, using a line width of 1/scale so lines
 * stay a crisp ~1px regardless of zoom.
 */
export function PageBackground({ width, height, camera, pageType, palette }: PageBackgroundProps) {
  const sceneFunc = useCallback(
    (konvaCtx: Konva.Context, shape: Konva.Shape) => {
      // Konva's Context proxies the full 2D context API at runtime; cast to it
      // so the standard path/style calls below are cleanly typed.
      const ctx = konvaCtx as unknown as CanvasRenderingContext2D;
      if (pageType === 'blank') return;
      const spacing = PAGE_PATTERN_SPACING;
      const screenSpacing = spacing * camera.scale;
      if (screenSpacing < MIN_SCREEN_SPACING) return;

      // Visible world rectangle (inverse of the stage transform).
      const left = -camera.x / camera.scale;
      const top = -camera.y / camera.scale;
      const right = (width - camera.x) / camera.scale;
      const bottom = (height - camera.y) / camera.scale;
      if ((right - left) / spacing > MAX_LINES || (bottom - top) / spacing > MAX_LINES) return;

      const startX = Math.floor(left / spacing) * spacing;
      const startY = Math.floor(top / spacing) * spacing;
      const lineWidth = 1 / camera.scale;

      ctx.save();
      if (pageType === 'dotted') {
        ctx.fillStyle = palette.gridDot;
        const radius = 1.5 / camera.scale;
        for (let x = startX; x <= right; x += spacing) {
          for (let y = startY; y <= bottom; y += spacing) {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        ctx.strokeStyle = palette.gridLine;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        // Horizontal lines for both 'ruled' and 'grid'.
        for (let y = startY; y <= bottom; y += spacing) {
          ctx.moveTo(left, y);
          ctx.lineTo(right, y);
        }
        // Vertical lines only for 'grid'.
        if (pageType === 'grid') {
          for (let x = startX; x <= right; x += spacing) {
            ctx.moveTo(x, top);
            ctx.lineTo(x, bottom);
          }
        }
        ctx.stroke();
      }
      ctx.restore();
      // We draw entirely ourselves; tell Konva the shape needs no fill/stroke pass.
      void shape;
    },
    [width, height, camera, pageType, palette],
  );

  return <Shape listening={false} perfectDrawEnabled={false} sceneFunc={sceneFunc} />;
}
