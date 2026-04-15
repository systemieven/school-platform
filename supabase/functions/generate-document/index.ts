import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Replace {{variable}} placeholders in the HTML template
function renderTemplate(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

// Build variable map from student data
function buildVariables(
  student: Record<string, unknown>,
  schoolClass: Record<string, unknown> | null,
  school: Record<string, unknown> | null,
): Record<string, string> {
  const now = new Date();
  const fmt = (d: unknown) => d ? new Date(String(d)).toLocaleDateString('pt-BR') : '';

  return {
    // Student
    nome_completo:     String(student.full_name ?? ''),
    nome_aluno:        String(student.full_name ?? ''),
    matricula:         String(student.enrollment_code ?? ''),
    data_nascimento:   fmt(student.birth_date),
    // Class
    turma:             String((schoolClass as Record<string, unknown>)?.name ?? ''),
    serie:             String((schoolClass as Record<string, unknown>)?.grade ?? ''),
    turno:             String((schoolClass as Record<string, unknown>)?.shift ?? ''),
    ano_letivo:        String((schoolClass as Record<string, unknown>)?.school_year ?? now.getFullYear()),
    // School
    escola:            String((school as Record<string, unknown>)?.name ?? ''),
    cnpj:              String((school as Record<string, unknown>)?.cnpj ?? ''),
    endereco:          String((school as Record<string, unknown>)?.address ?? ''),
    cidade:            String((school as Record<string, unknown>)?.city ?? ''),
    // Date
    data_emissao:      now.toLocaleDateString('pt-BR'),
    dia:               String(now.getDate()),
    mes:               now.toLocaleDateString('pt-BR', { month: 'long' }),
    ano:               String(now.getFullYear()),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { request_id } = await req.json() as { request_id: string };
    if (!request_id) return json({ error: 'request_id obrigatório' }, 400);

    // 1. Fetch document request + template
    const { data: docReq, error: reqErr } = await supabase
      .from('document_requests')
      .select(`
        *,
        template:document_templates(*),
        student:students(
          id, full_name, enrollment_code, birth_date, class_id
        )
      `)
      .eq('id', request_id)
      .single();

    if (reqErr || !docReq) return json({ error: 'Solicitação não encontrada' }, 404);
    if (docReq.status !== 'approved') return json({ error: 'Solicitação não aprovada' }, 422);

    const template = docReq.template as Record<string, unknown>;
    const student  = docReq.student  as Record<string, unknown>;

    // 2. Fetch class info
    let schoolClass: Record<string, unknown> | null = null;
    if (student?.class_id) {
      const { data } = await supabase
        .from('school_classes')
        .select('name, grade, shift, school_year')
        .eq('id', student.class_id)
        .single();
      schoolClass = data;
    }

    // 3. Fetch school settings
    const { data: settingsRows } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['school_name', 'school_cnpj', 'school_address', 'school_city']);

    const school: Record<string, unknown> = {};
    for (const row of settingsRows ?? []) {
      const key = (row as Record<string, unknown>).key as string;
      const val = (row as Record<string, unknown>).value as string;
      if (key === 'school_name')    school.name    = val;
      if (key === 'school_cnpj')    school.cnpj    = val;
      if (key === 'school_address') school.address = val;
      if (key === 'school_city')    school.city    = val;
    }

    // 4. Mark as generating
    await supabase
      .from('document_requests')
      .update({ status: 'generating' })
      .eq('id', request_id);

    // 5. Render HTML
    const vars = buildVariables(student, schoolClass, school);
    const renderedHtml = renderTemplate(String(template.html_content ?? ''), vars);

    // 6. Upload rendered HTML to Storage (PDF generation is client-side via print/browser)
    const fileName  = `declaracoes/${request_id}.html`;
    const htmlBytes = new TextEncoder().encode(renderedHtml);

    const { error: uploadErr } = await supabase.storage
      .from('documentos')
      .upload(fileName, htmlBytes, {
        contentType: 'text/html; charset=utf-8',
        upsert: true,
      });

    if (uploadErr) {
      await supabase
        .from('document_requests')
        .update({ status: 'approved' })  // revert
        .eq('id', request_id);
      return json({ error: 'Erro ao salvar documento: ' + uploadErr.message }, 500);
    }

    // 7. Generate signed URL (valid 7 days)
    const { data: signedData } = await supabase.storage
      .from('documentos')
      .createSignedUrl(fileName, 60 * 60 * 24 * 7);

    const pdfUrl        = signedData?.signedUrl ?? null;
    const urlExpiresAt  = pdfUrl
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // 8. Update request as generated
    await supabase
      .from('document_requests')
      .update({
        status:            'generated',
        pdf_path:          fileName,
        pdf_url:           pdfUrl,
        pdf_url_expires_at: urlExpiresAt,
        generated_at:      new Date().toISOString(),
      })
      .eq('id', request_id);

    return json({ success: true, pdf_url: pdfUrl, html: renderedHtml });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
