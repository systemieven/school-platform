import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface RequestBody {
  class_id: string;
  school_year: number;
  period_number?: number; // 1-4; omit to calculate final result
}

interface GradeFormulaConfig {
  weights?: Record<string, number>; // activity type → weight (for 'weighted')
  period_weights?: number[];        // weights per period (for 'by_period')
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth: verify JWT & check role ──────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["super_admin", "admin", "coordinator"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse body ────────────────────────────────────────────────────
    const body: RequestBody = await req.json();
    const { class_id, school_year, period_number } = body;

    if (!class_id || !school_year) {
      return new Response(JSON.stringify({ error: "class_id and school_year are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch class info → segment_id ─────────────────────────────────
    const { data: classInfo, error: classError } = await supabase
      .from("school_classes")
      .select("id, segment_id, name")
      .eq("id", class_id)
      .single();

    if (classError || !classInfo) {
      return new Response(JSON.stringify({ error: "Class not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch grade formula for segment+year ──────────────────────────
    const { data: formula } = await supabase
      .from("grade_formulas")
      .select("*")
      .eq("segment_id", classInfo.segment_id)
      .eq("school_year", school_year)
      .single();

    // Default formula if none configured
    const formulaType = formula?.formula_type || "simple";
    const config: GradeFormulaConfig = (formula?.config as GradeFormulaConfig) || {};
    const passingGrade = formula?.passing_grade ?? 7.0;
    const recoveryGrade = formula?.recovery_grade ?? 5.0;
    const minAttendancePct = formula?.min_attendance_pct ?? 75.0;

    // ── Fetch class disciplines ───────────────────────────────────────
    const { data: classDisciplines } = await supabase
      .from("class_disciplines")
      .select("discipline_id")
      .eq("class_id", class_id);

    const disciplineIds = (classDisciplines || []).map((cd) => cd.discipline_id);
    if (disciplineIds.length === 0) {
      return new Response(JSON.stringify({ error: "No disciplines assigned to this class" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch students in class ───────────────────────────────────────
    const { data: students } = await supabase
      .from("students")
      .select("id")
      .eq("class_id", class_id)
      .eq("status", "active");

    if (!students || students.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No active students" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch all grades for this class ───────────────────────────────
    const { data: allGrades } = await supabase
      .from("grades")
      .select("student_id, discipline_id, period, score, max_score, activity_id")
      .eq("class_id", class_id)
      .in("discipline_id", disciplineIds);

    // ── Fetch activities for type info (needed for weighted) ──────────
    let activitiesMap: Record<string, string> = {}; // activity_id → type
    if (formulaType === "weighted" && allGrades?.some((g) => g.activity_id)) {
      const activityIds = [...new Set(allGrades!.filter((g) => g.activity_id).map((g) => g.activity_id!))];
      if (activityIds.length > 0) {
        const { data: activities } = await supabase
          .from("activities")
          .select("id, type")
          .in("id", activityIds);
        activitiesMap = Object.fromEntries((activities || []).map((a) => [a.id, a.type]));
      }
    }

    // ── Fetch attendance for % calculation ────────────────────────────
    const { data: allAttendance } = await supabase
      .from("student_attendance")
      .select("student_id, discipline_id, status, date")
      .eq("class_id", class_id)
      .in("discipline_id", disciplineIds);

    // ── Calculate per student × discipline ────────────────────────────
    const periodLabels = ["1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre"];
    const results: Array<{
      student_id: string;
      discipline_id: string;
      period1_avg: number | null;
      period2_avg: number | null;
      period3_avg: number | null;
      period4_avg: number | null;
      final_avg: number | null;
      attendance_pct: number | null;
      result: string;
    }> = [];

    for (const student of students) {
      for (const disciplineId of disciplineIds) {
        const studentGrades = (allGrades || []).filter(
          (g) => g.student_id === student.id && g.discipline_id === disciplineId
        );

        // Calculate period averages
        const periodAvgs: (number | null)[] = periodLabels.map((label, idx) => {
          const periodGrades = studentGrades.filter(
            (g) => g.period === label || g.period === String(idx + 1)
          );
          if (periodGrades.length === 0) return null;
          return calculateAverage(periodGrades, formulaType, config, activitiesMap);
        });

        // Calculate final average
        let finalAvg: number | null = null;
        const validAvgs = periodAvgs.filter((a): a is number => a !== null);
        if (validAvgs.length > 0) {
          if (formulaType === "by_period" && config.period_weights) {
            let weightedSum = 0;
            let weightTotal = 0;
            periodAvgs.forEach((avg, idx) => {
              if (avg !== null) {
                const w = config.period_weights![idx] ?? 1;
                weightedSum += avg * w;
                weightTotal += w;
              }
            });
            finalAvg = weightTotal > 0 ? round1(weightedSum / weightTotal) : null;
          } else {
            finalAvg = round1(validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length);
          }
        }

        // Calculate attendance %
        const studentAtt = (allAttendance || []).filter(
          (a) => a.student_id === student.id && a.discipline_id === disciplineId
        );
        let attendancePct: number | null = null;
        if (studentAtt.length > 0) {
          const present = studentAtt.filter((a) => a.status === "present" || a.status === "late").length;
          attendancePct = round2((present / studentAtt.length) * 100);
        }

        // Determine result
        let resultStatus = "in_progress";
        if (period_number) {
          // Single period calculation — just update period avg, keep result as in_progress
          resultStatus = "in_progress";
        } else if (finalAvg !== null) {
          if (attendancePct !== null && attendancePct < minAttendancePct) {
            resultStatus = "failed_attendance";
          } else if (finalAvg >= passingGrade) {
            resultStatus = "approved";
          } else if (finalAvg >= recoveryGrade) {
            resultStatus = "recovery";
          } else {
            resultStatus = "failed_grade";
          }
        }

        results.push({
          student_id: student.id,
          discipline_id: disciplineId,
          period1_avg: periodAvgs[0],
          period2_avg: periodAvgs[1],
          period3_avg: periodAvgs[2],
          period4_avg: periodAvgs[3],
          final_avg: finalAvg,
          attendance_pct: attendancePct,
          result: resultStatus,
        });
      }
    }

    // ── Upsert results ────────────────────────────────────────────────
    const upsertData = results.map((r) => ({
      ...r,
      class_id,
      school_year,
    }));

    const { error: upsertError } = await supabase
      .from("student_results")
      .upsert(upsertData, {
        onConflict: "student_id,discipline_id,class_id,school_year",
      });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(JSON.stringify({ error: "Failed to save results", details: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        students: students.length,
        disciplines: disciplineIds.length,
        formula_type: formulaType,
        passing_grade: passingGrade,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("calculate-grades error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Helper functions ────────────────────────────────────────────────────

function calculateAverage(
  grades: Array<{ score: number; max_score: number; activity_id: string | null }>,
  formulaType: string,
  config: GradeFormulaConfig,
  activitiesMap: Record<string, string>
): number {
  if (grades.length === 0) return 0;

  if (formulaType === "weighted" && config.weights) {
    let weightedSum = 0;
    let weightTotal = 0;

    for (const g of grades) {
      const normalized = (g.score / g.max_score) * 10;
      const actType = g.activity_id ? activitiesMap[g.activity_id] || "other" : "other";
      const w = config.weights[actType] ?? 1;
      weightedSum += normalized * w;
      weightTotal += w;
    }

    return weightTotal > 0 ? round1(weightedSum / weightTotal) : 0;
  }

  // Simple average (default)
  const sum = grades.reduce((acc, g) => acc + (g.score / g.max_score) * 10, 0);
  return round1(sum / grades.length);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
