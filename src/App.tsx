import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import EducacaoInfantil from './pages/EducacaoInfantil';
import EnsinoFundamental1 from './pages/EnsinoFundamental1';
import EnsinoFundamental2 from './pages/EnsinoFundamental2';
import EnsinoMedio from './pages/EnsinoMedio';
import Matricula from './pages/Matricula';
import Contato from './pages/Contato';
import AgendarVisita from './pages/AgendarVisita';
import PoliticaPrivacidade from './pages/PoliticaPrivacidade';
import TermosUso from './pages/TermosUso';
import EmConstrucao from './pages/EmConstrucao';
import NotFound from './pages/NotFound';
import { Loader2 } from 'lucide-react';

// Lazy-load admin panel and student portal as separate bundle chunks
const AdminRoutes  = lazy(() => import('./admin/routes'));
const PortalRoutes = lazy(() => import('./portal/routes'));

function AdminFallback() {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 text-[#003876] animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* ── Public site ── */}
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="educacao-infantil" element={<EducacaoInfantil />} />
        <Route path="ensino-fundamental-1" element={<EnsinoFundamental1 />} />
        <Route path="ensino-fundamental-2" element={<EnsinoFundamental2 />} />
        <Route path="ensino-medio" element={<EnsinoMedio />} />
        <Route path="matricula" element={<Matricula />} />
        <Route path="contato" element={<Contato />} />
        <Route path="agendar-visita" element={<AgendarVisita />} />
        <Route path="politica-privacidade" element={<PoliticaPrivacidade />} />
        <Route path="termos-de-uso" element={<TermosUso />} />
        <Route path="sobre" element={<EmConstrucao />} />
        <Route path="estrutura" element={<EmConstrucao />} />
        <Route path="area-professor" element={<EmConstrucao />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* ── Admin panel (lazy-loaded) ── */}
      <Route
        path="admin/*"
        element={
          <Suspense fallback={<AdminFallback />}>
            <AdminRoutes />
          </Suspense>
        }
      />

      {/* ── Student portal (lazy-loaded) ── */}
      <Route
        path="portal/*"
        element={
          <Suspense fallback={<AdminFallback />}>
            <PortalRoutes />
          </Suspense>
        }
      />
    </Routes>
  );
}
