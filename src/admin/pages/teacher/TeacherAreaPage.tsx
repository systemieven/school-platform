import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import type { SchoolClass, SchoolSegment } from '../../types/admin.types';
import { SHIFT_LABELS } from '../../types/admin.types';
import {
  BookOpen, LayoutDashboard, Users, FileText, ClipboardList, Star, CalendarCheck, ChevronDown,
} from 'lucide-react';

import OverviewTab    from './tabs/OverviewTab';
import StudentsTab    from './tabs/StudentsTab';
import MaterialsTab   from './tabs/MaterialsTab';
import ActivitiesTab  from './tabs/ActivitiesTab';
import GradesTab      from './tabs/GradesTab';
import AttendanceTab  from './tabs/AttendanceTab';

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'students' | 'materials' | 'activities' | 'grades' | 'attendance';

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'overview',    label: 'Visão Geral',  icon: LayoutDashboard },
  { key: 'students',   label: 'Alunos',        icon: Users          },
  { key: 'materials',  label: 'Materiais',     icon: FileText       },
  { key: 'activities', label: 'Atividades',    icon: ClipboardList  },
  { key: 'grades',     label: 'Notas',         icon: Star           },
  { key: 'attendance', label: 'Frequência',    icon: CalendarCheck  },
];

interface ClassWithSegment extends SchoolClass {
  segment?: SchoolSegment | null;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TeacherAreaPage() {
  const { profile, hasRole } = useAdminAuth();
  const [classes, setClasses] = useState<ClassWithSegment[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    async function loadClasses() {
      let query = supabase
        .from('school_classes')
        .select('*, segment:school_segments(*)');

      // Teachers only see their own classes
      if (!hasRole('super_admin', 'admin', 'coordinator')) {
        query = query.contains('teacher_ids', [profile!.id]);
      }

      const { data } = await query.eq('is_active', true).order('name');
      const list = (data ?? []) as ClassWithSegment[];
      setClasses(list);
      if (list.length) setSelectedId(list[0].id);
      setLoading(false);
    }

    loadClasses();
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedClass = classes.find((c) => c.id === selectedId) ?? null;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="w-6 h-6 border-2 border-brand-primary dark:border-brand-secondary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-brand-primary dark:text-brand-secondary" />
            Área do Professor
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {hasRole('super_admin', 'admin', 'coordinator')
              ? 'Visualizando todas as turmas ativas.'
              : 'Suas turmas atribuídas.'}
          </p>
        </div>

        {/* Class selector */}
        {classes.length > 0 && (
          <div className="relative">
            <select
              value={selectedId}
              onChange={(e) => { setSelectedId(e.target.value); setTab('overview'); }}
              className="appearance-none pl-4 pr-10 py-2.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm outline-none focus:border-brand-primary dark:focus:border-brand-secondary min-w-[220px]"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.year} {c.shift ? `· ${SHIFT_LABELS[c.shift]}` : ''} {c.segment ? `· ${(c.segment as SchoolSegment).name}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        )}
      </div>

      {/* No classes state */}
      {!classes.length && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center shadow-sm">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhuma turma encontrada.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {hasRole('super_admin', 'admin', 'coordinator')
              ? 'Crie turmas em Segmentos e Turmas para começar.'
              : 'Peça a um coordenador para atribuir uma turma ao seu perfil.'}
          </p>
        </div>
      )}

      {/* Class content */}
      {selectedClass && (
        <div className="space-y-5">
          {/* Class info badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-brand-primary/5 dark:bg-brand-secondary/5 border border-brand-primary/10 dark:border-brand-secondary/10 rounded-xl px-4 py-2">
              <BookOpen className="w-4 h-4 text-brand-primary dark:text-brand-secondary" />
              <span className="text-sm font-semibold text-brand-primary dark:text-brand-secondary">{selectedClass.name}</span>
              {selectedClass.shift && (
                <span className="text-xs text-gray-500 dark:text-gray-400">· {SHIFT_LABELS[selectedClass.shift]}</span>
              )}
              {selectedClass.max_students && (
                <span className="text-xs text-gray-400">· max {selectedClass.max_students} alunos</span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-100 dark:border-gray-700">
            <nav className="flex gap-1 overflow-x-auto">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    tab === key
                      ? 'border-brand-primary dark:border-brand-secondary text-brand-primary dark:text-brand-secondary'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab content */}
          <div>
            {tab === 'overview'    && <OverviewTab    cls={selectedClass} />}
            {tab === 'students'   && <StudentsTab    cls={selectedClass} />}
            {tab === 'materials'  && <MaterialsTab   cls={selectedClass} />}
            {tab === 'activities' && <ActivitiesTab  cls={selectedClass} />}
            {tab === 'grades'     && <GradesTab      cls={selectedClass} />}
            {tab === 'attendance' && <AttendanceTab  cls={selectedClass} />}
          </div>
        </div>
      )}
    </div>
  );
}
