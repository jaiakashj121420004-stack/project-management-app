@echo off
REM ============================================================
REM  Ship the CANVAS FIXES to the live Aurora app.
REM
REM  Commits ONLY the canvas files (the Lodestar design rebrand
REM  and everything else stay untouched), then pushes to main so
REM  Cloudflare Pages auto-deploys.
REM
REM  Fixes included:
REM    - Text styling (.canvas-rich) now ships with the feature
REM      (was missing on the live app -> broken/invisible text).
REM    - Freehand + eraser now always commit (no more vanishing
REM      strokes when you lift a touchpad/pen).
REM    - New Text tool: pick it, click anywhere, start typing.
REM    - Ruled pages: text lines snap onto the rule lines.
REM
REM  Just double-click this file, or run it from a terminal.
REM ============================================================

cd /d "%~dp0"
echo.
echo === Working in: %CD%
echo.

REM 1) Clear any stale git lock from a crashed session.
if exist ".git\index.lock" (
  echo Removing stale .git\index.lock ...
  del /f /q ".git\index.lock"
)

REM 2) Tidy a stray scratch file if present (safe to ignore if missing).
if exist "__write_test__" del /f /q "__write_test__"

REM 3) Stage ONLY the canvas files.
echo.
echo === Staging canvas files ...
git add ^
  src/features/canvas/canvasText.css ^
  src/features/canvas/CanvasEditor.tsx ^
  src/features/canvas/CanvasStage.tsx ^
  src/features/canvas/CanvasToolbar.tsx ^
  src/features/canvas/TextLayer.tsx ^
  src/features/canvas/RichTextBox.tsx ^
  src/features/canvas/elements.ts ^
  src/features/canvas/constants.ts

REM 4) Commit.
echo.
echo === Committing ...
git commit -m "fix(canvas): ship rich-text CSS, reliable draw/erase, click-to-place text, ruled alignment"

REM 5) Push to main -> triggers Cloudflare Pages deploy.
echo.
echo === Pushing to origin/main (this triggers the Cloudflare deploy) ...
git push origin main

echo.
echo === DONE. Watch the Cloudflare Pages dashboard for the build (~1-2 min),
echo     then reload the app (look for the "New version - Reload" prompt, or
echo     fully close and reopen the installed app).
echo.
pause
