// Public barrel for the canvas feature.
//
// IMPORTANT: only Konva-FREE modules may be exported here. The barrel is imported
// eagerly by App.tsx (CanvasHome route), so anything it re-exports ships in the
// main bundle. The heavy editor (CanvasPanel → CanvasStage → react-konva) is
// imported via a dynamic `import()` in ProjectPage so Konva stays in its own
// lazy chunk and never loads for users who don't open a canvas.
export { CanvasHome } from './CanvasHome';
