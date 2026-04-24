import { createClient } from "npm:@supabase/supabase-js@2.49.4"
import { z } from "npm:zod@3.23.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const InterviewResultSchema = z.enum(['approved', 'rejected', 'doubt', 'next_stage', 'became_partner']).nullable().optional()

const AnswerSchema = z.object({
  question_id: z.string().uuid(),
  answer: z.string().nullable().optional(),
})

const InterviewSchema = z.object({
  stage: z.union([z.literal(1), z.literal(2)]),
  interviewer_id: z.string().uuid().nullable().optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
  attended: z.boolean().nullable().optional(),
  result: z.union([
    InterviewResultSchema,
    z.enum(['Aprovado', 'Reprovado', 'Dúvida', 'Duvida', 'Próxima etapa', 'Proxima etapa', 'Próxima Etapa', 'Virou parceiro', 'Parceiro']).nullable().optional(),
  ]),
  score_tecnica: z.number().min(0).max(10).nullable().optional(),
  score_cultura: z.number().min(0).max(10).nullable().optional(),
  score_energia: z.number().min(0).max(10).nullable().optional(),
  observations: z.string().nullable().optional(),
  answers: z.array(AnswerSchema).default([]),
})

const CandidateSchema = z.object({
  full_name: z.string().min(1).max(255),
  phone: z.string().nullable().optional(),
  age: z.number().int().min(14).max(99).nullable().optional(),
  cpf: z.string().nullable().optional(),
  type: z.enum(['clt', 'partner']).default('clt'),
  kanban_status: z.enum(['new_resume', 'contacted', 'scheduled_e1', 'done_e1', 'scheduled_e2', 'done_e2', 'approved', 'rejected', 'doubt', 'became_partner']),
  notes: z.string().nullable().optional(),
  interviews: z.array(InterviewSchema).default([]),
})

const BodySchema = z.object({
  candidates: z.array(CandidateSchema).min(1).max(10),
  replace_existing_interviews: z.boolean().default(true),
})

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeDigits(value?: string | null) {
  return (value || '').replace(/\D/g, '')
}

function normalizePhone(value?: string | null) {
  const digits = normalizeDigits(value)
  if (!digits) return null
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return digits
}

function normalizeCpf(value?: string | null) {
  const digits = normalizeDigits(value)
  if (!digits) return null
  if (digits.length === 11) return digits
  return null
}

function normalizeResult(value?: string | null) {
  if (!value) return null
  const map: Record<string, 'approved' | 'rejected' | 'doubt' | 'next_stage' | 'became_partner'> = {
    Aprovado: 'approved',
    Reprovado: 'rejected',
    Dúvida: 'doubt',
    Duvida: 'doubt',
    'Próxima etapa': 'next_stage',
    'Proxima etapa': 'next_stage',
    'Próxima Etapa': 'next_stage',
    'Virou parceiro': 'became_partner',
    Parceiro: 'became_partner',
    approved: 'approved',
    rejected: 'rejected',
    doubt: 'doubt',
    next_stage: 'next_stage',
    became_partner: 'became_partner',
  }
  return map[value] ?? null
}

async function resolveCallerRole(authHeader: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const token = authHeader.replace('Bearer ', '')
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
  if (claimsError || !claimsData?.claims?.sub) return { error: 'Unauthorized', status: 401 as const }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: roleRow, error: roleError } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', claimsData.claims.sub)
    .single()

  if (roleError || !roleRow?.role) return { error: 'Could not determine role', status: 403 as const }
  if (!['master', 'admin', 'manager'].includes(roleRow.role)) return { error: 'Access denied', status: 403 as const }

  return { admin, callerId: claimsData.claims.sub, role: roleRow.role }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401)

    const auth = await resolveCallerRole(authHeader)
    if ('error' in auth) return jsonResponse({ error: auth.error }, auth.status)

    const bodyJson = await req.json()
    const parsed = BodySchema.safeParse(bodyJson)
    if (!parsed.success) {
      return jsonResponse({ error: parsed.error.flatten() }, 400)
    }

    const { admin } = auth
    const { candidates, replace_existing_interviews } = parsed.data

    const report: Array<Record<string, unknown>> = []

    for (const rawCandidate of candidates) {
      const phoneNormalized = normalizePhone(rawCandidate.phone)
      const cpfNormalized = normalizeCpf(rawCandidate.cpf)
      const phonePlaceholder = !phoneNormalized || phoneNormalized.length < 12 ? '00000000000' : phoneNormalized
      const missingPhone = phonePlaceholder === '00000000000'
      const notesPrefix = missingPhone ? '[TELEFONE PENDENTE - revisar] ' : ''
      const candidateNotes = `${notesPrefix}${rawCandidate.notes || ''}`.trim() || null

      let candidateId: string | null = null
      let createdCandidate = false
      const createdInterviewIds: string[] = []

      try {
        let existing: { id: string } | null = null

        if (cpfNormalized) {
          const { data } = await admin.from('hr_candidates').select('id').eq('cpf', cpfNormalized).limit(1).maybeSingle()
          existing = data
        }

        if (!existing && !missingPhone) {
          const { data } = await admin.from('hr_candidates').select('id').eq('phone', phonePlaceholder).limit(1).maybeSingle()
          existing = data
        }

        if (!existing) {
          const { data } = await admin
            .from('hr_candidates')
            .select('id')
            .eq('full_name', rawCandidate.full_name)
            .eq('type', rawCandidate.type)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()
          existing = data
        }

        if (existing?.id) {
          candidateId = existing.id
          const { error: updateError } = await admin
            .from('hr_candidates')
            .update({
              full_name: rawCandidate.full_name,
              phone: phonePlaceholder,
              age: rawCandidate.age ?? null,
              cpf: cpfNormalized,
              type: rawCandidate.type,
              kanban_status: rawCandidate.kanban_status,
              notes: candidateNotes,
              updated_at: new Date().toISOString(),
            })
            .eq('id', candidateId)

          if (updateError) throw updateError
        } else {
          const { data: inserted, error: insertError } = await admin
            .from('hr_candidates')
            .insert({
              full_name: rawCandidate.full_name,
              phone: phonePlaceholder,
              age: rawCandidate.age ?? null,
              cpf: cpfNormalized,
              type: rawCandidate.type,
              kanban_status: rawCandidate.kanban_status,
              notes: candidateNotes,
            })
            .select('id')
            .single()

          if (insertError) throw insertError
          candidateId = inserted.id
          createdCandidate = true
        }

        if (!candidateId) throw new Error('Candidate id missing after upsert')

        if (replace_existing_interviews) {
          const { data: existingInterviews } = await admin
            .from('hr_interviews')
            .select('id')
            .eq('candidate_id', candidateId)

          const interviewIds = (existingInterviews || []).map((row) => row.id)
          if (interviewIds.length > 0) {
            const { error: deleteAnswersError } = await admin
              .from('hr_interview_answers')
              .delete()
              .in('interview_id', interviewIds)
            if (deleteAnswersError) throw deleteAnswersError

            const { error: deleteInterviewsError } = await admin
              .from('hr_interviews')
              .delete()
              .eq('candidate_id', candidateId)
            if (deleteInterviewsError) throw deleteInterviewsError
          }
        }

        for (const rawInterview of rawCandidate.interviews) {
          const interviewPayload = {
            candidate_id: candidateId,
            stage: rawInterview.stage,
            interviewer_id: rawInterview.interviewer_id ?? null,
            scheduled_at: rawInterview.scheduled_at ?? null,
            attended: rawInterview.attended ?? null,
            result: normalizeResult(rawInterview.result ?? null),
            score_tecnica: rawInterview.stage === 1 ? rawInterview.score_tecnica ?? null : null,
            score_cultura: rawInterview.stage === 1 ? rawInterview.score_cultura ?? null : null,
            score_energia: rawInterview.stage === 1 ? rawInterview.score_energia ?? null : null,
            observations: rawInterview.observations ?? null,
          }

          const { data: insertedInterview, error: insertInterviewError } = await admin
            .from('hr_interviews')
            .insert(interviewPayload)
            .select('id')
            .single()

          if (insertInterviewError) throw insertInterviewError
          createdInterviewIds.push(insertedInterview.id)

          const answerRows = rawInterview.answers
            .filter((item) => (item.answer || '').trim().length > 0)
            .map((item) => ({
              interview_id: insertedInterview.id,
              question_id: item.question_id,
              answer: item.answer?.trim() || null,
            }))

          if (answerRows.length > 0) {
            const { error: answersError } = await admin
              .from('hr_interview_answers')
              .insert(answerRows)
            if (answersError) throw answersError
          }
        }

        report.push({
          full_name: rawCandidate.full_name,
          candidate_id: candidateId,
          status: 'ok',
          created: createdCandidate,
          interviews: rawCandidate.interviews.length,
        })
      } catch (error) {
        if (createdInterviewIds.length > 0) {
          await admin.from('hr_interview_answers').delete().in('interview_id', createdInterviewIds)
          await admin.from('hr_interviews').delete().in('id', createdInterviewIds)
        }
        if (createdCandidate && candidateId) {
          await admin.from('hr_candidates').delete().eq('id', candidateId)
        }

        report.push({
          full_name: rawCandidate.full_name,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const insertedCount = report.filter((item) => item.status === 'ok').length
    const errorCount = report.filter((item) => item.status === 'error').length

    return jsonResponse({
      success: errorCount === 0,
      insertedCount,
      errorCount,
      report,
    })
  } catch (error) {
    console.error('[hr-import-runner] fatal', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'unknown error' }, 500)
  }
})
