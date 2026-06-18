import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { Home } from '@/pages/Home';
import { StyleGuide } from '@/pages/StyleGuide';
import { Placeholder } from '@/pages/Placeholder';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="calendar" element={<Placeholder title="Calendar" phase="Phase 6" />} />
        <Route path="notes" element={<Placeholder title="Notes" phase="Phase 7" />} />
        <Route path="style-guide" element={<StyleGuide />} />
        <Route path="*" element={<Placeholder title="Not found" phase="a future phase" />} />
      </Route>
    </Routes>
  );
}
