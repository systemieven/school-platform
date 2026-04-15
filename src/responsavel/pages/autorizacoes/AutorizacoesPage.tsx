import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useGuardian } from '../../contexts/GuardianAuthContext';
import {
  type ActivityAuthorization,
  type AuthorizationResponse,
} from '../../../admin/types/admin.types';
import { Loader2, CheckSquare, ThumbsUp, ThumbsDown, Clock } from 'lucide-react';

interface AuthWithResponse extends ActivityAuthorization {
  myResponse: AuthorizationResponse | null;
}

export default function AutorizacoesPage() {
  const { currentStudentId, guardian, students } = useGuardian();
  const [items, setItems]     = useState<AuthWithResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);

  const currentStudent = students.find((s) => s.student_id === currentStudentId);

  useEffect(() => {
    if (!currentStudentId || !currentStudent?.student?.class_id) { setLoading(false); return; }

    const classId = currentStudent.student.class_id;

    async function load() {
      const { data: auths } = await supabase
        .from('activity_authorizations')
        .select('*')
        .eq('status', 'active')
        .contains('class_ids', [classId]);

      if (!auths) { setLoading(false); return; }

      const authIds = auths.map((a: ActivityAuthorization) => a.id);

      const { data: responses } = await supabase
        .from('authorization_responses')
        .select('*')
        .eq('student_id', currentStudentId)
        .in('authorization_id', authIds);

      const responseMap = new Map<string, AuthorizationResponse>(
        ((responses ?? []) as AuthorizationResponse[]).map((r) => [r.authorization_id, r])
      );

      const result: AuthWithResponse[] = (auths as ActivityAuthorization[]).map((a) => ({
        ...a,
        myResponse: responseMap.get(a.id) ?? null,
      }));

      // Sort: pending first, then by deadline
      result.sort((a, b) => {
        const aPending = !a.myResponse;
        const bPending = !b.myResponse;
        if (aPending !== bPending) return aPending ? -1 : 1;
        return a.deadline.localeCompare(b.deadline);
      });

      setItems(result);
      setLoading(false);
    }

    load();
  }, [currentStudentId, currentStudent?.student?.class_id]);

  async function handleRespond(authId: string, resp: 'authorized' | 'not_authorized') {
    if (!currentStudentId) return;
    setSaving(authId);

    const { data, error } = await supabase
      .from('authorization_responses')
      .upsert({
        authorization_id: authId,
        student_id: currentStudentId,
        guardian_id: guardian?.id ?? null,
        response: resp,
        notes: null,
        responded_at: new Date().toISOString(),
      }, { onConflict: 'authorization_id,student_id' })
      .select()
      .single();

    if (!error && data) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === authId
            ? { ...i, myResponse: data as AuthorizationResponse }
            : i
        )
      );
    }
    setSaving(null);
  }

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const isPastDeadline = (deadline: string) => new Date(deadline + 'T23:59:59') < new Date();

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <CheckSquare className="w-5 h-5" /> Autorizações
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Autorizações que precisam da sua resposta.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Nenhuma autorização pendente.</p>
          <p className="text-xs mt-1">Autorizações solicitadas pela escola aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const past = isPastDeadline(item.deadline);
            const myResp = item.myResponse?.response;

            return (
              <div key={item.id} className={`bg-white dark:bg-gray-800 rounded-2xl border p-5 ${
                !myResp && !past ? 'border-brand-primary/20 dark:border-brand-secondary/20' : 'border-gray-100 dark:border-gray-700'
              }`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.title}</h3>
                  {past && !myResp && (
                    <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                      <Clock className="w-3 h-3" /> Prazo encerrado
                    </span>
                  )}
                  {myResp === 'authorized' && (
                    <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
                      <ThumbsUp className="w-3 h-3" /> Autorizado
                    </span>
                  )}
                  {myResp === 'not_authorized' && (
                    <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                      <ThumbsDown className="w-3 h-3" /> Não autorizado
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{item.description}</p>

                <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
                  {item.activity_date && (
                    <span>Data da atividade: <span className="font-medium text-gray-700 dark:text-gray-200">{fmtDate(item.activity_date)}</span></span>
                  )}
                  <span>Prazo: <span className={`font-medium ${past ? 'text-red-500' : 'text-gray-700 dark:text-gray-200'}`}>{fmtDate(item.deadline)}</span></span>
                </div>

                {!past && !myResp && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRespond(item.id, 'not_authorized')}
                      disabled={saving === item.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-60"
                    >
                      {saving === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsDown className="w-4 h-4" />}
                      Não autorizo
                    </button>
                    <button
                      onClick={() => handleRespond(item.id, 'authorized')}
                      disabled={saving === item.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-60"
                    >
                      {saving === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                      Autorizo
                    </button>
                  </div>
                )}

                {myResp && !past && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRespond(item.id, myResp === 'authorized' ? 'not_authorized' : 'authorized')}
                      disabled={saving === item.id}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline transition-colors disabled:opacity-60"
                    >
                      {saving === item.id ? 'Alterando...' : 'Alterar resposta'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
