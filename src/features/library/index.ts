// Public barrel for the Library feature.
//
// IMPORTANT: only Konva-FREE modules may be exported here — App.tsx imports this
// eagerly for the /library route. The heavy canvas editor is reached through
// OpenCanvas, which loads it via a dynamic import(), so Konva stays in its own
// lazy chunk and never ships in the main bundle.
export { LibraryPage } from './LibraryPage';
