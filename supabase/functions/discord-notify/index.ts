// ============================================================
// Relais serveur pour les notifications Discord.
//
// Pourquoi une Edge Function plutôt qu'un fetch() direct depuis le
// navigateur (comme dans la première version) : Discord ne renvoie pas
// d'en-têtes CORS permissifs sur son endpoint de webhook pour une
// requête JSON envoyée depuis un site tiers (frosefox.github.io) — le
// navigateur bloque donc l'appel avant même qu'il parte. Un appel
// serveur → serveur (ici) n'est pas soumis à CORS.
//
// Sécurité : seul un compte marqué is_admin peut déclencher l'envoi
// (vérifié via son JWT), et l'URL du webhook est relue depuis la table
// `team_settings` avec la clé de service (jamais transmise par le
// client) — sauf pour le bouton "Tester" du panneau de réglages, qui
// peut passer une URL non encore enregistrée (testUrl), seulement
// utilisable par un admin déjà authentifié.
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
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

  let body: { payload?: unknown; testUrl?: string; wait?: boolean }
  try {
    body = await req.json()
  } catch {
    return json({ error: "Corps de requête invalide." }, 400)
  }

  let webhookUrl = body.testUrl
  if (!webhookUrl) {
    const { data: settings } = await admin
      .from("team_settings")
      .select("discord_webhook_url")
      .eq("id", true)
      .single()
    webhookUrl = settings?.discord_webhook_url || undefined
  }

  if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
    return json({ error: "Aucun webhook Discord valide n'est configuré." }, 400)
  }

  // "MatchNotif" comme nom d'expéditeur par défaut, même si l'avatar du
  // webhook n'a pas encore été configuré côté Discord (l'avatar, lui,
  // doit être importé manuellement dans les réglages du webhook Discord :
  // une URL data:/base64 n'est pas acceptée par le champ avatar_url).
  const discordPayload = { username: "MatchNotif", ...(body.payload as object || {}) }

  // wait=true : Discord renvoie le message créé (id, channel_id) au lieu
  // d'un simple 204 — utilisé pour les votes (validation de compo,
  // présence à un match), où on doit ensuite ajouter des réactions ✅/❌
  // à CE message précis via l'edge function discord-bot.
  const url = body.wait ? `${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}wait=true` : webhookUrl

  try {
    const discordRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordPayload),
    })
    let message: { id?: string; channel_id?: string } | null = null
    if (body.wait && discordRes.ok) {
      try {
        message = await discordRes.json()
      } catch {
        // Réponse inattendue : on renvoie quand même ok/status, le
        // client saura simplement qu'il n'a pas pu récupérer l'id.
      }
    }
    return json({ ok: discordRes.ok, status: discordRes.status, message })
  } catch (err) {
    return json({ error: `Discord injoignable : ${String(err)}` }, 502)
  }
})
