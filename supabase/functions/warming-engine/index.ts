import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SystemSettings {
  id: string
  is_warming_active: boolean
  start_hour: number
  end_hour: number
  messages_day_novo: number
  messages_day_1_3: number
  messages_day_4_7: number
  messages_day_aquecido: number
  messages_day_8_plus: number
  warming_mode: string
  timezone: string
  // Anti-blocking settings
  batch_size: number
  batch_pause_seconds: number
  random_delay_variation: number
  typing_simulation: boolean
  typing_speed_chars_sec: number
  read_delay_seconds: number
  online_offline_simulation: boolean
  weekend_reduction_percent: number
  night_mode_reduction: number
  consecutive_message_limit: number
  cooldown_after_error: number
  human_pattern_mode: boolean
  global_message_cursor: number
  // Provider settings
  whatsapp_provider: string
  provider_api_url: string | null
  provider_api_key: string | null
}

// Helper function to get current hour in a specific timezone
function getCurrentHourInTimezone(timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    })
    const hourStr = formatter.format(new Date())
    return parseInt(hourStr, 10)
  } catch {
    // Fallback to São Paulo timezone calculation
    const now = new Date()
    const utcHour = now.getUTCHours()
    const spHour = utcHour - 3
    return spHour < 0 ? spHour + 24 : spHour
  }
}

// Helper function to add jitter to delays (prevents synchronized requests)
function addJitter(baseMs: number, jitterPercent: number = 20): number {
  const jitter = baseMs * (jitterPercent / 100)
  return baseMs + (Math.random() * 2 - 1) * jitter
}

// Helper function for exponential backoff with jitter
function getExponentialBackoff(attempt: number, baseDelayMs: number = 1000, maxDelayMs: number = 30000): number {
  const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs)
  return addJitter(delay, 25)
}

// Generate a random delay between min and max with human-like variation
function getHumanizedDelay(minSeconds: number, maxSeconds: number, variationPercent: number): number {
  // Base random delay
  const baseDelay = minSeconds + Math.random() * (maxSeconds - minSeconds)
  
  // Add variation for more natural timing
  if (variationPercent > 0) {
    const variation = baseDelay * (variationPercent / 100)
    const randomVariation = (Math.random() * 2 - 1) * variation
    return Math.max(minSeconds, baseDelay + randomVariation)
  }
  
  return baseDelay
}

interface Chip {
  id: string
  user_id: string
  instance_name: string
  phone_number: string | null
  status: string
  activated_at: string | null
  messages_sent_today: number
  last_message_at: string | null
  warming_phase: string
  instance_token: string | null
}

interface ExternalNumber {
  id: string
  phone_number: string
  name: string | null
  is_active: boolean
}

interface WarmingMessage {
  id: string
  content: string
  is_active: boolean
  message_order: number
}

// Track consecutive messages per recipient (resets per invocation)
const recipientMessageCount = new Map<string, number>()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    // Fallback env vars (used if DB settings are empty)
    const envEvolutionApiUrl = Deno.env.get('EVOLUTION_API_URL') || ''
    const envEvolutionApiKey = Deno.env.get('EVOLUTION_API_KEY') || ''

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Get system settings
    const { data: settings, error: settingsError } = await adminClient
      .from('system_settings')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (settingsError || !settings) {
      console.log('No system settings found')
      return new Response(
        JSON.stringify({ ok: true, message: 'No settings configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const typedSettings = settings as SystemSettings

    // Check if warming is active
    if (!typedSettings.is_warming_active) {
      console.log('Warming is disabled')
      return new Response(
        JSON.stringify({ ok: true, message: 'Warming is disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check operating hours using configured timezone
    const now = new Date()
    const timezone = typedSettings.timezone || 'America/Sao_Paulo'
    const currentHour = getCurrentHourInTimezone(timezone)

    if (currentHour < typedSettings.start_hour || currentHour >= typedSettings.end_hour) {
      console.log(`Outside operating hours: ${currentHour} (allowed: ${typedSettings.start_hour}-${typedSettings.end_hour}) [${timezone}]`)
      return new Response(
        JSON.stringify({ ok: true, message: 'Outside operating hours' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check for weekend reduction
    const dayOfWeek = now.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    let volumeMultiplier = 1.0

    if (isWeekend && typedSettings.weekend_reduction_percent > 0) {
      volumeMultiplier *= (100 - typedSettings.weekend_reduction_percent) / 100
      console.log(`Weekend reduction applied: ${typedSettings.weekend_reduction_percent}%`)
    }

    // Check for night mode reduction (outside 9am-6pm)
    if ((currentHour < 9 || currentHour >= 18) && typedSettings.night_mode_reduction > 0) {
      volumeMultiplier *= (100 - typedSettings.night_mode_reduction) / 100
      console.log(`Night mode reduction applied: ${typedSettings.night_mode_reduction}%`)
    }

    // Get connected chips
    const { data: chips, error: chipsError } = await adminClient
      .from('chips')
      .select('*')
      .eq('status', 'connected')
      .eq('chip_type', 'warming')

    if (chipsError || !chips || chips.length < 2) {
      console.log('Not enough connected chips for warming')
      return new Response(
        JSON.stringify({ ok: true, message: 'Not enough connected chips' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const typedChips = chips as Chip[]

    // Auto phase progression
    const autoProgression = (settings as any).auto_phase_progression
    if (autoProgression) {
      const daysNovo = (settings as any).days_phase_novo ?? 3
      const daysIniciante = (settings as any).days_phase_iniciante ?? 5
      const daysCrescimento = (settings as any).days_phase_crescimento ?? 7
      const daysAquecido = (settings as any).days_phase_aquecido ?? 10

      for (const chip of typedChips) {
        if (!chip.activated_at) continue
        const daysSinceActivation = Math.floor((now.getTime() - new Date(chip.activated_at).getTime()) / (1000 * 60 * 60 * 24))
        
        let expectedPhase = 'novo'
        if (daysSinceActivation >= daysNovo + daysIniciante + daysCrescimento + daysAquecido) {
          expectedPhase = 'maduro'
        } else if (daysSinceActivation >= daysNovo + daysIniciante + daysCrescimento) {
          expectedPhase = 'aquecido'
        } else if (daysSinceActivation >= daysNovo + daysIniciante) {
          expectedPhase = 'crescimento'
        } else if (daysSinceActivation >= daysNovo) {
          expectedPhase = 'iniciante'
        }

        if (expectedPhase !== (chip.warming_phase || 'novo')) {
          console.log(`Auto-promoting chip ${chip.instance_name}: ${chip.warming_phase} -> ${expectedPhase} (${daysSinceActivation} days)`)
          await adminClient.from('chips').update({ warming_phase: expectedPhase }).eq('id', chip.id)
          chip.warming_phase = expectedPhase
        }
      }
    }

    // Get active warming messages
    const { data: messages, error: messagesError } = await adminClient
      .from('warming_messages')
      .select('*')
      .eq('is_active', true)

    if (messagesError || !messages || messages.length === 0) {
      console.log('No warming messages configured')
      return new Response(
        JSON.stringify({ ok: true, message: 'No warming messages configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const typedMessages = (messages as WarmingMessage[]).sort((a, b) => (a.message_order || 0) - (b.message_order || 0))

    // Calculate daily limit based on manual warming_phase
    const getDailyLimit = (chip: Chip): number => {
      switch (chip.warming_phase || 'novo') {
        case 'novo': return typedSettings.messages_day_novo ?? 5
        case 'iniciante': return typedSettings.messages_day_1_3
        case 'crescimento': return typedSettings.messages_day_4_7
        case 'aquecido': return typedSettings.messages_day_aquecido ?? 80
        case 'maduro': return typedSettings.messages_day_8_plus
        default: return typedSettings.messages_day_novo ?? 5
      }
    }

    // Smart interval: distribute messages throughout the day
    const getSmartInterval = (chip: Chip): number => {
      const dailyLimit = Math.floor(getDailyLimit(chip) * volumeMultiplier)
      const messagesRemaining = dailyLimit - chip.messages_sent_today
      if (messagesRemaining <= 0) return Infinity

      const hoursRemaining = typedSettings.end_hour - currentHour
      if (hoursRemaining <= 0) return Infinity

      const idealInterval = (hoursRemaining * 3600) / messagesRemaining
      const minInterval = idealInterval * 0.5
      const maxInterval = idealInterval * 1.5

      return getHumanizedDelay(minInterval, maxInterval, typedSettings.random_delay_variation)
    }

    // Check if chip can send message (uses smart interval based on phase)
    const canSendMessage = (chip: Chip): { eligible: boolean; reason?: string; waitSeconds?: number } => {
      const dailyLimit = Math.floor(getDailyLimit(chip) * volumeMultiplier)
      
      // Check daily limit
      if (chip.messages_sent_today >= dailyLimit) {
        return { eligible: false, reason: 'daily_limit_reached' }
      }

      // Check smart interval since last message
      if (chip.last_message_at) {
        const lastSent = new Date(chip.last_message_at)
        const secondsSinceLastMessage = (now.getTime() - lastSent.getTime()) / 1000
        
        // Use smart interval based on remaining messages and hours
        const requiredInterval = getSmartInterval(chip)
        
        if (requiredInterval === Infinity) {
          return { eligible: false, reason: 'daily_limit_reached' }
        }
        
        if (secondsSinceLastMessage < requiredInterval) {
          const waitTime = Math.ceil(requiredInterval - secondsSinceLastMessage)
          return { 
            eligible: false, 
            reason: 'interval_not_met', 
            waitSeconds: waitTime 
          }
        }
      }

      return { eligible: true }
    }

    // Find eligible chips with detailed logging
    const eligibilityResults = typedChips
      .filter(chip => chip.phone_number)
      .map(chip => ({
        chip,
        ...canSendMessage(chip)
      }))

    const eligibleChips = eligibilityResults
      .filter(result => result.eligible)
      .map(result => result.chip)

    // Log detailed eligibility info
    const ineligibleCount = eligibilityResults.filter(r => !r.eligible).length
    const intervalNotMet = eligibilityResults.filter(r => r.reason === 'interval_not_met')
    const dailyLimitReached = eligibilityResults.filter(r => r.reason === 'daily_limit_reached')
    
    console.log(`Chips: ${typedChips.length} total, ${eligibleChips.length} eligible, ${ineligibleCount} ineligible`)
    if (intervalNotMet.length > 0) {
      console.log(`  - ${intervalNotMet.length} chips waiting for interval (shortest wait: ${Math.min(...intervalNotMet.map(r => r.waitSeconds || 0))}s)`)
    }
    if (dailyLimitReached.length > 0) {
      console.log(`  - ${dailyLimitReached.length} chips reached daily limit`)
    }

    // Require only 1 eligible chip for external mode, 2 for internal modes
    const minChipsRequired = typedSettings.warming_mode === 'external' ? 1 : 2
    
    if (eligibleChips.length < minChipsRequired) {
      const nextEligible = intervalNotMet.length > 0 
        ? Math.min(...intervalNotMet.map(r => r.waitSeconds || 0))
        : null
      
      console.log(`Not enough eligible chips (need ${minChipsRequired}, have ${eligibleChips.length})${nextEligible ? `. Next eligible in ${nextEligible}s` : ''}`)
      
      return new Response(
        JSON.stringify({ 
          ok: true, 
          message: 'No eligible chips to send',
          details: {
            totalChips: typedChips.length,
            eligibleChips: eligibleChips.length,
            waitingForInterval: intervalNotMet.length,
            dailyLimitReached: dailyLimitReached.length,
            nextEligibleInSeconds: nextEligible
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Select pairs based on warming mode
    let pairs: Array<{ sender: Chip; receiver: Chip | null; externalPhone?: string }> = []

    if (typedSettings.warming_mode === 'external') {
      // Get external numbers
      const { data: externalNumbers, error: externalError } = await adminClient
        .from('external_numbers')
        .select('*')
        .eq('is_active', true)

      if (externalError || !externalNumbers || externalNumbers.length === 0) {
        console.log('No active external numbers configured')
        return new Response(
          JSON.stringify({ ok: true, message: 'No external numbers configured' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const typedExternals = externalNumbers as ExternalNumber[]

      // External mode: unidirectional
      eligibleChips.forEach(chip => {
        const randomExternal = typedExternals[Math.floor(Math.random() * typedExternals.length)]
        pairs.push({ 
          sender: chip, 
          receiver: null, 
          externalPhone: randomExternal.phone_number 
        })
      })
    } else if (typedSettings.warming_mode === 'same_user') {
      // Pair chips from the same user - BIDIRECTIONAL
      const userChips = new Map<string, Chip[]>()
      eligibleChips.forEach(chip => {
        const existing = userChips.get(chip.user_id) || []
        existing.push(chip)
        userChips.set(chip.user_id, existing)
      })

      userChips.forEach(userChipList => {
        if (userChipList.length >= 2) {
          const shuffled = userChipList.sort(() => Math.random() - 0.5)
          // Bidirectional: A->B then B->A (dialog style)
          pairs.push({ sender: shuffled[0], receiver: shuffled[1] })
          pairs.push({ sender: shuffled[1], receiver: shuffled[0] })
        }
      })
    } else {
      // between_users mode - BIDIRECTIONAL
      const shuffled = eligibleChips.sort(() => Math.random() - 0.5)
      for (let i = 0; i < shuffled.length - 1; i += 2) {
        // Bidirectional: A->B then B->A (dialog style)
        pairs.push({ sender: shuffled[i], receiver: shuffled[i + 1] })
        pairs.push({ sender: shuffled[i + 1], receiver: shuffled[i] })
      }
    }

    if (pairs.length === 0) {
      console.log('No valid pairs found')
      return new Response(
        JSON.stringify({ ok: true, message: 'No valid pairs' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Limit to batch size
    const effectiveBatchSize = Math.min(pairs.length, typedSettings.batch_size)
    const selectedPairs = pairs.slice(0, effectiveBatchSize)

    // Initialize global message cursor
    let globalCursor = (typedSettings as any).global_message_cursor || 0

    // Determine provider and API config
    const provider = typedSettings.whatsapp_provider || 'uazapi'
    const apiUrl = (typedSettings.provider_api_url || '').replace(/\/$/, '')
    const apiKey = typedSettings.provider_api_key || ''

    const baseUrl = apiUrl
    let messagesSent = 0
    let messagesFailed = 0
    let consecutiveErrors = 0
    const MAX_CONSECUTIVE_ERRORS = 3

    for (let i = 0; i < selectedPairs.length; i++) {
      const pair = selectedPairs[i]

      // Stop if too many consecutive errors (likely API issue)
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.log(`Stopping: ${consecutiveErrors} consecutive errors`)
        break
      }

      // Determine recipient phone number
      const recipientPhone = pair.externalPhone || pair.receiver?.phone_number
      if (!recipientPhone) {
        console.log('No recipient phone, skipping')
        continue
      }

      // Check consecutive message limit
      const recipientKey = recipientPhone
      const currentCount = recipientMessageCount.get(recipientKey) || 0
      
      if (currentCount >= typedSettings.consecutive_message_limit) {
        console.log(`Consecutive limit reached for ${recipientKey}, skipping`)
        continue
      }

      // Select message sequentially using global cursor
      const messageIndex = globalCursor % typedMessages.length
      const randomMessage = typedMessages[messageIndex]
      globalCursor++

      // Add delay between messages (anti-rate-limiting)
      if (i > 0) {
        const interMessageDelay = addJitter(200, 50) // 150-250ms between API calls
        await new Promise(resolve => setTimeout(resolve, interMessageDelay))
      }

      // Retry logic with exponential backoff
      let attempt = 0
      const MAX_RETRIES = 2
      let success = false

      while (attempt <= MAX_RETRIES && !success) {
        try {
          // Calculate typing delay if enabled (only on first attempt)
          if (attempt === 0) {
            let typingDelay = 0
            if (typedSettings.typing_simulation && typedSettings.human_pattern_mode) {
              typingDelay = Math.ceil(randomMessage.content.length / typedSettings.typing_speed_chars_sec) * 1000
            }

            // Add read delay if enabled
            if (typedSettings.read_delay_seconds > 0 && typedSettings.human_pattern_mode) {
              const readDelay = addJitter(typedSettings.read_delay_seconds * 1000, 30)
              await new Promise(resolve => setTimeout(resolve, readDelay))
            }

            // Simulate typing by waiting
            if (typingDelay > 0) {
              const adjustedTypingDelay = addJitter(Math.min(typingDelay, 5000), 20)
              await new Promise(resolve => setTimeout(resolve, adjustedTypingDelay))
            }
          }

          // Send message via provider API
          let response: Response

          if (provider === 'uazapi') {
            const chipToken = (pair.sender as Chip).instance_token
            if (!chipToken) {
              console.log(`No instance_token for chip ${pair.sender.instance_name}, skipping`)
              break
            }
            // UazAPI: POST /send/text with { number, text }
            response = await fetch(`${baseUrl}/send/text`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'token': chipToken,
              },
              body: JSON.stringify({
                number: recipientPhone,
                text: randomMessage.content,
              }),
            })
          } else {
            // Default: also use UazAPI format
            const chipToken = (pair.sender as Chip).instance_token
            if (!chipToken) {
              console.log(`No instance_token for chip ${pair.sender.instance_name}, skipping`)
              break
            }
            response = await fetch(`${baseUrl}/send/text`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'token': chipToken,
              },
              body: JSON.stringify({
                number: recipientPhone,
                text: randomMessage.content,
              }),
            })
          }

          // Handle rate limiting (429)
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After')
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : getExponentialBackoff(attempt)
            console.log(`Rate limited, waiting ${Math.round(waitTime/1000)}s before retry`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            attempt++
            continue
          }

          if (response.ok) {
            // Update sender chip
            await adminClient
              .from('chips')
              .update({
                messages_sent_today: pair.sender.messages_sent_today + 1,
                last_message_at: new Date().toISOString(),
              })
              .eq('id', pair.sender.id)

            // Record in message history
            const { error: insertError } = await adminClient
              .from('message_history')
              .insert({
                chip_id: pair.sender.id,
                message_content: randomMessage.content,
                direction: 'outgoing',
                status: 'sent',
                recipient_phone: recipientPhone,
              })

            if (insertError) {
              console.error('Failed to record message in history:', insertError.message)
            }

            // Update consecutive count
            recipientMessageCount.set(recipientKey, currentCount + 1)

            messagesSent++
            consecutiveErrors = 0 // Reset on success
            success = true
            console.log(`Message ${messagesSent} sent from ${pair.sender.instance_name} to ${recipientPhone}`)

            // Add batch pause if we've sent batch_size messages
            if (messagesSent > 0 && messagesSent % typedSettings.batch_size === 0) {
              const batchPause = addJitter(typedSettings.batch_pause_seconds * 1000, 20)
              console.log(`Batch pause: ${Math.round(batchPause/1000)}s`)
              await new Promise(resolve => setTimeout(resolve, batchPause))
            }
          } else {
            const errorData = await response.json().catch(() => ({}))
            console.error(`Send failed (attempt ${attempt + 1}):`, errorData)

            if (attempt >= MAX_RETRIES) {
              // Record failed message only after all retries
              const { error: failInsertError } = await adminClient
                .from('message_history')
                .insert({
                  chip_id: pair.sender.id,
                  message_content: randomMessage.content,
                  direction: 'outgoing',
                  status: 'failed',
                  recipient_phone: recipientPhone,
                })

              if (failInsertError) {
                console.error('Failed to record failed message in history:', failInsertError.message)
              }
              
              messagesFailed++
              consecutiveErrors++
            } else {
              // Wait before retry with exponential backoff
              const backoffDelay = getExponentialBackoff(attempt)
              console.log(`Retrying in ${Math.round(backoffDelay/1000)}s...`)
              await new Promise(resolve => setTimeout(resolve, backoffDelay))
            }
            attempt++
          }
        } catch (error) {
          console.error(`Error sending message (attempt ${attempt + 1}):`, error)
          
          if (attempt >= MAX_RETRIES) {
            messagesFailed++
            consecutiveErrors++
            
            // Apply cooldown after final error
            if (typedSettings.cooldown_after_error > 0) {
              const cooldown = addJitter(typedSettings.cooldown_after_error * 1000, 30)
              console.log(`Error cooldown: ${Math.round(cooldown/1000)}s`)
              await new Promise(resolve => setTimeout(resolve, cooldown))
            }
          } else {
            const backoffDelay = getExponentialBackoff(attempt)
            await new Promise(resolve => setTimeout(resolve, backoffDelay))
          }
          attempt++
        }
      }
    }

    // Save global cursor after processing all pairs
    await adminClient
      .from('system_settings')
      .update({ global_message_cursor: globalCursor } as any)
      .eq('id', (typedSettings as any).id)

    return new Response(
      JSON.stringify({ 
        ok: true, 
        messagesSent, 
        messagesFailed,
        pairsProcessed: selectedPairs.length,
        volumeMultiplier: Math.round(volumeMultiplier * 100) / 100,
        stoppedEarly: consecutiveErrors >= MAX_CONSECUTIVE_ERRORS
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Warming engine error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
