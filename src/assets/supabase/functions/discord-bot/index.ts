// ============================================================
// Actions Discord nécessitant un BOT (le webhook ne suffit pas) :
// ajouter des réactions ✅/❌ à un message, puis compter qui a voté.
//
// Pourquoi un bot en plus du webhook (discord-notify) : un webhook ne
// peut qu'envoyer des messages, il ne peut ni réagir à un message ni
// lire qui a réagi. On garde donc le webhook pour l'envoi (joli embed,
// déjà en place), et on n'utilise le bot QUE pour ces deux actions
// précises, avec le token Bot (Authorization: Bot ...), jamais exposé
// au client.
//
// Sécurité : même garde-fou que discord-notify — seul un compte
// is_admin peut appeler cette fonction (vérifié via son JWT).
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// Encodage attendu par l'API Discord pour un emoji unicode dans une URL.
const YES_EMOJI = encodeURIComponent('✅')
const NO_EMOJI = encodeURIComponent('❌')

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

// PUT d'une réaction, avec UNE retentative si Discord répond 429 (rate
// limit) — on attend alors exactement le `retry_after` qu'il indique
// (en secondes, + une petite marge) avant de réessayer une fois.
async function putReaction(channelId: string, messageId: string, emoji: string, headers: Record<string, string>) {
  const url = `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${emoji}/@me`
  const res = await fetch(url, { method: "PUT", headers })
  if (res.status !== 429) return res

  let retryAfterMs = 600
  try {
    const body = await res.clone().json()
    if (typeof body?.retry_after === "number") retryAfterMs = Math.ceil(body.retry_after * 1000) + 50
  } catch {
    // Corps illisible : on garde le délai par défaut ci-dessus.
  }
  await new Promise((resolve) => setTimeout(resolve, retryAfterMs))
  return fetch(url, { method: "PUT", headers })
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Méthode non supportée." }, 405)

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return json({ error: "Non authentifié." }, 401)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const admin = createClient(supabaseUrl!, serviceRoleKey!)

  const token = authHeader.replace(/^Bearer\s+/i, "")
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return json({ error: "Session invalide." }, 401)

  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", userData.user.id)
    .single()
  if (!profile?.is_admin) return json({ error: "Réservé aux administrateurs." }, 403)

  let body: { action?: string; channelId?: string; messageId?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: "Corps de requête invalide." }, 400)
  }

  const { action, channelId, messageId } = body
  if (!channelId || !messageId) return json({ error: "channelId et messageId sont requis." }, 400)

  const botToken = Deno.env.get("DISCORD_BOT_TOKEN")
  if (!botToken) {
    return json(
      { error: "Le bot Discord n'est pas configuré (secret DISCORD_BOT_TOKEN manquant sur le projet Supabase)." },
      400
    )
  }
  const discordHeaders = { Authorization: `Bot ${botToken}` }

  if (action === "addReactions") {
    // Discord limite très strictement l'ajout de réactions consécutives
    // sur un même message (bien plus que ses limites générales) : deux
    // PUT envoyés dos à dos, sans délai, font quasi systématiquement
    // échouer le second avec un 429 — symptôme observé : ✅ passe, ❌
    // échoue juste derrière. On espace donc les deux appels, et on
    // retente une fois en respectant le `retry_after` renvoyé par
    // Discord si la limite est quand même atteinte.
    const emojis = [YES_EMOJI, NO_EMOJI]
    for (let i = 0; i < emojis.length; i++) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 350))
      const res = await putReaction(channelId, messageId, emojis[i], discordHeaders)
      if (!res.ok) {
        const detail = await res.text().catch(() => "")
        return json({ error: `Discord a refusé l'ajout de réaction (${res.status}). ${detail}`.trim() }, 502)
      }
    }
    return json({ ok: true })
  }

  if (action === "getReactionCounts") {
    // Identité du bot, pour l'exclure du décompte (il a lui-même posé
    // les deux réactions de départ).
    let botId: string | null = null
    try {
      const meRes = await fetch("https://discord.com/api/v10/users/@me", { headers: discordHeaders })
      if (meRes.ok) botId = (await meRes.json())?.id ?? null
    } catch {
      // Si on n'arrive pas à identifier le bot, on ne retranche rien
      // (léger sur-comptage possible d'une unité, sans conséquence).
    }

    const counts: { yes: number; no: number } = { yes: 0, no: 0 }
    for (const [key, emoji] of [["yes", YES_EMOJI], ["no", NO_EMOJI]] as const) {
      const res = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${emoji}?limit=100`,
        { headers: discordHeaders }
      )
      if (!res.ok) continue
      const users = (await res.json()) as Array<{ id: string }>
      const total = botId ? users.filter((u) => u.id !== botId).length : users.length
      counts[key] = Math.max(0, total)
    }
    return json({ ok: true, counts })
  }

  return json({ error: "Action inconnue." }, 400)
})
