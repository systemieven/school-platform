import { Routes, Route, Navigate } from 'react-router-dom';
import { GuardianAuthProvider } from './contexts/GuardianAuthContext';
import GuardianLayout from './GuardianLayout';
import LoginPage          from './pages/login/LoginPage';
import DashboardPage      from './pages/dashboard/DashboardPage';
import NotasPage          from './pages/notas/NotasPage';
import FrequenciaPage     from './pages/frequencia/FrequenciaPage';
import FinanceiroPage     from './pages/financeiro/FinanceiroPage';
import ComunicadosPage    from './pages/comunicados/ComunicadosPage';
import EventosPage        from './pages/eventos/EventosPage';
import GradeHorariaPage   from './pages/grade/GradeHorariaPage';
import OcorrenciasPage    from './pages/ocorrencias/OcorrenciasPage';
import AutorizacoesPage   from './pages/autorizacoes/AutorizacoesPage';
import PerfilPage         from './pages/perfil/PerfilPage';
import DeclaracoesPage    from './pages/declaracoes/DeclaracoesPage';
import RematriculaPage    from './pages/rematricula/RematriculaPage';
import FaltasPage         from './pages/faltas/FaltasPage';
import AutorizacoesSaidaPage from './pages/autorizacoes-saida/AutorizacoesSaidaPage';
import SaudePage from './pages/saude/SaudePage';
import PedidosPage from './pages/pedidos/PedidosPage';
import PedidoDetalhePage from './pages/pedidos/PedidoDetalhePage';
import AchadosPerdidosPage from './pages/achados-perdidos/AchadosPerdidosPage';
import TrocarSenhaPage from './pages/trocar-senha/TrocarSenhaPage';

export default function ResponsavelRoutes() {
  return (
    <GuardianAuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="trocar-senha" element={<TrocarSenhaPage />} />

        <Route element={<GuardianLayout />}>
          <Route index          element={<DashboardPage />} />
          <Route path="notas"        element={<NotasPage />} />
          <Route path="frequencia"   element={<FrequenciaPage />} />
          <Route path="financeiro"   element={<FinanceiroPage />} />
          <Route path="comunicados"  element={<ComunicadosPage />} />
          <Route path="eventos"      element={<EventosPage />} />
          <Route path="grade"        element={<GradeHorariaPage />} />
          <Route path="ocorrencias"  element={<OcorrenciasPage />} />
          <Route path="autorizacoes" element={<AutorizacoesPage />} />
          <Route path="perfil"       element={<PerfilPage />} />
          <Route path="declaracoes"  element={<DeclaracoesPage />} />
          <Route path="rematricula"         element={<RematriculaPage />} />
          <Route path="faltas"              element={<FaltasPage />} />
          <Route path="autorizacoes-saida"  element={<AutorizacoesSaidaPage />} />
          <Route path="saude"               element={<SaudePage />} />
          <Route path="pedidos"             element={<PedidosPage />} />
          <Route path="pedidos/:orderNumber" element={<PedidoDetalhePage />} />
          <Route path="achados-perdidos"    element={<AchadosPerdidosPage />} />
          <Route path="*"                   element={<Navigate to="/responsavel" replace />} />
        </Route>
      </Routes>
    </GuardianAuthProvider>
  );
}
