import { Routes, Route, Navigate } from 'react-router-dom';
import { ProfessorAuthProvider } from './contexts/ProfessorAuthContext';
import ProfessorLayout from './ProfessorLayout';
import LoginPage         from './pages/login/LoginPage';
import DashboardPage     from './pages/dashboard/DashboardPage';
import TurmasPage        from './pages/turmas/TurmasPage';
import DiarioPage        from './pages/diario/DiarioPage';
import DiarioEntradaPage from './pages/diario/DiarioEntradaPage';
import NotasPage         from './pages/notas/NotasPage';
import PlanosPage        from './pages/planos/PlanosPage';
import ProvasPage        from './pages/provas/ProvasPage';
import AlunoPerfilPage   from './pages/aluno/AlunoPerfilPage';
import TrocarSenhaPage   from './pages/trocar-senha/TrocarSenhaPage';

export default function ProfessorRoutes() {
  return (
    <ProfessorAuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="trocar-senha" element={<TrocarSenhaPage />} />

        <Route element={<ProfessorLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="turmas"                                         element={<TurmasPage />} />
          <Route path="turmas/:classId/diario"                         element={<DiarioPage />} />
          <Route path="turmas/:classId/diario/:entryId"                element={<DiarioEntradaPage />} />
          <Route path="turmas/:classId/notas"                          element={<NotasPage />} />
          <Route path="turmas/:classId/alunos/:studentId"              element={<AlunoPerfilPage />} />
          <Route path="planos"                                         element={<PlanosPage />} />
          <Route path="provas"                                         element={<ProvasPage />} />
          <Route path="*"                                              element={<Navigate to="/professor" replace />} />
        </Route>
      </Routes>
    </ProfessorAuthProvider>
  );
}
