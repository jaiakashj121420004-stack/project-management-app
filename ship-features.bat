@echo off
REM ============================================================
REM  Ship the To-Do + Canvas features to the live Aurora app.
REM  Commits ONLY the feature work (the Lodestar design rebrand
REM  is intentionally left out), then pushes to main so
REM  Cloudflare Pages auto-deploys.
REM
REM  Just double-click this file, or run it from a terminal.
REM ============================================================

cd /d "%~dp0"
echo.
echo === Working in: %CD%
echo.

REM 1) Clear the stale git lock from the crashed Jun 26 session.
if exist ".git\index.lock" (
  echo Removing stale .git\index.lock ...
  del /f /q ".git\index.lock"
)

REM 2) Commit the To-Do feature (recurring daily lists + reorder up/down).
echo.
echo === Committing To-Do feature ...
git add src/features/todos/TodoListCard.tsx src/features/todos/TodosPage.tsx src/features/todos/TodoItemRow.tsx src/features/todos/api.ts src/features/todos/useTodos.ts src/features/todos/recurringTemplates.ts
git commit -m "feat(todos): daily recurring lists + reorder items up/down"

REM 3) Commit the Canvas text-writing fix.
echo.
echo === Committing Canvas feature ...
git add src/features/canvas/CanvasEditor.tsx src/features/canvas/CanvasStage.tsx src/features/canvas/constants.ts src/features/canvas/elementRenderers.tsx src/features/canvas/elements.ts src/features/canvas/RichTextBox.tsx src/features/canvas/TextLayer.tsx src/features/canvas/TextFormatToolbar.tsx src/features/canvas/richText.ts
git commit -m "feat(canvas): rich text writing on canvas (fix: unable to type)"

REM 4) Push to main -> triggers Cloudflare Pages deploy.
echo.
echo === Pushing to origin/main (this triggers the Cloudflare deploy) ...
git push origin main

echo.
echo === DONE. Check the Cloudflare Pages dashboard for the build,
echo     then reload the app (look for the "New version - Reload" prompt).
echo.
pause
