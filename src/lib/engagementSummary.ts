// Deriva o dashboard do engajamento (KPIs, risco, insights, resumo, próximos
// passos) a partir do blob `enrichment`. Tudo é calculado de dados REAIS — o
// score de risco é uma fórmula explícita e auditável (ver `risk.factors`).

import type { Engagement } from '@/types'

export interface Insight {
  level: 'warn' | 'info' | 'ok'
  text: string
}
export interface NextStep {
  tool: string // id da ferramenta na sidebar (navegação)
  label: string
  cat: string
}
export interface IntegrationStatus {
  label: string
  ran: boolean
}
export interface RiskInfo {
  score: number
  band: 'BAIXO' | 'MÉDIO' | 'ALTO' | 'CRÍTICO'
  color: string
  factors: string[]
}
export interface EngSummary {
  ranAt?: string
  targets: any[]
  risk: RiskInfo
  kpis: { iocs: number; subdomains: number; hosts: number; emails: number; leaks: number; profiles: number }
  insights: Insight[]
  execText: string
  nextSteps: NextStep[]
  integrations: IntegrationStatus[]
}

function bandFor(score: number): { band: RiskInfo['band']; color: string } {
  if (score >= 75) return { band: 'CRÍTICO', color: '#e24b4a' }
  if (score >= 50) return { band: 'ALTO', color: '#ff9f5a' }
  if (score >= 20) return { band: 'MÉDIO', color: '#f4bc6a' }
  return { band: 'BAIXO', color: '#4dd4a4' }
}

const num = (v: any): number => (typeof v === 'number' && isFinite(v) ? v : 0)

export function summarize(engagement: Engagement): EngSummary {
  const enr = (engagement as any).enrichment as any
  const targets: any[] = enr?.targets ?? []

  // ── Agregações ──────────────────────────────────────────────────────────────
  let subdomains = 0
  const hosts = new Set<string>()
  let emails = 0
  let leakSources = 0
  let combRecords = 0
  let profiles = 0
  let worstVerdict: 'clean' | 'suspicious' | 'malicious' | null = null
  let vtMalicious = 0
  let otxPulses = 0
  let org: string | null = null
  let cloudflare = false

  const rank = { clean: 0, suspicious: 1, malicious: 2 }
  const bumpVerdict = (v?: string) => {
    if (v === 'clean' || v === 'suspicious' || v === 'malicious') {
      if (worstVerdict === null || rank[v] > rank[worstVerdict]) worstVerdict = v
    }
  }

  for (const t of targets) {
    if (t.kind === 'domain') {
      subdomains += (t.subdomains?.names?.length ?? 0)
      for (const ip of t.whois?.dns?.A ?? []) hosts.add(ip)
      for (const ip of t.whois?.dns?.AAAA ?? []) hosts.add(ip)
      const ns: string[] = t.whois?.dns?.NS ?? []
      if (ns.some((n) => /cloudflare/i.test(n))) cloudflare = true
      emails += num(t.hunter?.total)
      if (t.hunter?.organization) org = t.hunter.organization
      bumpVerdict(t.threatIntel?.verdict)
      vtMalicious = Math.max(vtMalicious, num(t.threatIntel?.virustotal?.malicious))
      otxPulses = Math.max(otxPulses, num(t.threatIntel?.otx?.pulses))
    } else if (t.kind === 'ip') {
      hosts.add(t.value)
      bumpVerdict(t.threatIntel?.verdict)
      vtMalicious = Math.max(vtMalicious, num(t.threatIntel?.virustotal?.malicious))
      if (/cloudflare/i.test(t.asn?.org ?? '')) cloudflare = true
    } else if (t.kind === 'email') {
      emails += 1
      leakSources += num(t.email?.leaklookup?.n)
      combRecords += num(t.email?.comb?.count)
    } else if (t.kind === 'username') {
      leakSources += num(t.leaklookup?.n)
      combRecords += num(t.comb?.count)
      profiles += t.whatsmyname?.found?.length ?? 0
    }
  }

  // ── Score de risco (fórmula explícita) ───────────────────────────────────────
  let score = 0
  const factors: string[] = []
  if (worstVerdict === 'malicious') { score += 60; factors.push('Veredito malicioso em threat intel') }
  else if (worstVerdict === 'suspicious') { score += 30; factors.push('Veredito suspeito em threat intel') }
  if (vtMalicious > 0) { score += Math.min(20, vtMalicious * 5); factors.push(`${vtMalicious} detecção(ões) no VirusTotal`) }
  if (otxPulses > 0) { score += 10; factors.push(`${otxPulses} pulse(s) no OTX`) }
  if (leakSources > 0) { score += Math.min(25, leakSources); factors.push(`${leakSources} fonte(s) de vazamento`) }
  if (combRecords > 0) { score += 15; factors.push('Credenciais expostas em dumps (COMB)') }
  if (profiles > 0) { score += Math.min(10, Math.floor(profiles / 20)); factors.push(`${profiles} perfis públicos do usuário`) }
  score = Math.max(0, Math.min(100, Math.round(score)))
  const { band, color } = bandFor(score)

  // ── Insights (regras sobre dados reais) ──────────────────────────────────────
  const insights: Insight[] = []
  if (worstVerdict === 'malicious') insights.push({ level: 'warn', text: 'Threat intel apontou veredito malicioso.' })
  else if (worstVerdict === 'suspicious') insights.push({ level: 'warn', text: 'Threat intel apontou veredito suspeito.' })
  else if (targets.some((t) => t.threatIntel)) insights.push({ level: 'ok', text: 'Nenhum IOC malicioso detectado até o momento.' })
  if (cloudflare) insights.push({ level: 'info', text: 'Infraestrutura usa Cloudflare.' })
  if (leakSources > 0) insights.push({ level: 'warn', text: `${leakSources} fonte(s) de vazamento relacionada(s) aos alvos.` })
  if (combRecords > 0) insights.push({ level: 'warn', text: `Credenciais expostas em dumps públicos (COMB: ${combRecords.toLocaleString('pt-BR')} registros).` })
  if (org) insights.push({ level: 'info', text: `Organização identificada via Hunter: ${org}.` })
  if (profiles > 0) insights.push({ level: 'info', text: `Usuário presente em ${profiles} sites (WhatsMyName).` })
  for (const t of targets) {
    for (const p of (t.userintel?.platforms ?? []).filter((x: any) => x.found)) {
      const label = p.platform === 'github' ? 'GitHub' : p.platform === 'gitlab' ? 'GitLab' : p.platform
      insights.push({ level: 'info', text: `${label}: ${p.name ?? p.username}${p.repos != null ? ` · ${p.repos} repos` : ''}${p.followers != null ? ` · ${p.followers} seguidores` : ''}.` })
    }
    const svcs = t.servicescan?.services ?? []
    if (svcs.length) {
      const protos = [...new Set(svcs.map((s: any) => String(s.protocol).toUpperCase()))].join(', ')
      insights.push({ level: 'info', text: `${t.value}: ${svcs.length} serviço(s) exposto(s) — ${protos}.` })
      if (svcs.some((s: any) => s.protocol === 'ssh')) insights.push({ level: 'warn', text: `${t.value}: SSH exposto (porta 22).` })
    }
    if (t.kind === 'email' && t.email?.hunter?.result === 'deliverable')
      insights.push({ level: 'info', text: `${t.value}: e-mail entregável (Hunter ${num(t.email.hunter.score)}/100).` })
    if (t.kind === 'email' && t.email?.gravatar?.found)
      insights.push({ level: 'info', text: `${t.value}: perfil Gravatar encontrado.` })
    if (t.googleintel?.found)
      insights.push({ level: 'info', text: `${t.value}: conta Google${t.googleintel.name ? ` (${t.googleintel.name})` : ''} identificada.` })
  }

  // ── Resumo executivo (texto gerado) ──────────────────────────────────────────
  const parts: string[] = []
  if (subdomains) parts.push(`${subdomains} subdomínio(s)`)
  if (hosts.size) parts.push(`${hosts.size} host(s)`)
  if (emails) parts.push(`${emails} e-mail(s)`)
  if (leakSources) parts.push(`${leakSources} fonte(s) de vazamento`)
  if (profiles) parts.push(`${profiles} perfis de usuário`)
  const ranInts = countRan(targets)
  const execText =
    targets.length === 0
      ? 'Nenhum enriquecimento executado ainda. Rode o Auto-enriquecimento para coletar dados sobre os alvos.'
      : `Analisamos ${targets.length} alvo(s) com ${ranInts} integração(ões). ` +
        (parts.length ? `Foram encontrados ${parts.join(', ')}. ` : '') +
        (worstVerdict === 'malicious' || worstVerdict === 'suspicious'
          ? 'Há indicadores de ameaça — ver Insights.'
          : 'Nenhum malware identificado até o momento.')

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const kpis = {
    iocs: engagement.iocCount ?? 0,
    subdomains,
    hosts: hosts.size,
    emails,
    leaks: leakSources,
    profiles,
  }

  // ── Integrações executadas (visão de descanso do Auto Enrichment) ────────────
  const integrations: IntegrationStatus[] = [
    { label: 'Threat Intelligence', ran: targets.some((t) => t.threatIntel) },
    { label: 'WHOIS / DNS', ran: targets.some((t) => t.whois) },
    { label: 'Subdomínios', ran: targets.some((t) => t.subdomains) },
    { label: 'ASN / Rede', ran: targets.some((t) => t.asn) },
    { label: 'Hunter', ran: targets.some((t) => t.hunter || t.email?.hunter) },
    { label: 'E-mail Intel', ran: targets.some((t) => t.email) },
    { label: 'Leak Lookup', ran: targets.some((t) => t.leaklookup || t.email?.leaklookup) },
    { label: 'COMB', ran: targets.some((t) => t.comb || t.email?.comb) },
    { label: 'WhatsMyName', ran: targets.some((t) => t.whatsmyname) },
    { label: 'Username Intelligence', ran: targets.some((t) => t.userintel) },
    { label: 'Google Intelligence', ran: targets.some((t) => t.googleintel?.configured) },
    { label: 'Service Scan', ran: targets.some((t) => t.servicescan) },
  ].filter((i) => i.ran || targets.length > 0)

  // ── Próximos passos (ferramentas relevantes ainda não executadas) ────────────
  const hasDomain = targets.some((t) => t.kind === 'domain')
  const hasUser = targets.some((t) => t.kind === 'username')
  const ranWayback = false // wayback não roda no auto-enrich
  const nextSteps: NextStep[] = []
  if (hasDomain && !ranWayback) nextSteps.push({ tool: 'wayback', label: 'Consultar Wayback Machine', cat: 'Histórico' })
  if (hosts.size || hasDomain) nextSteps.push({ tool: 'portas', label: 'Verificar portas (Check-Host)', cat: 'Infra' })
  if (hosts.size) nextSteps.push({ tool: 'asn', label: 'Mapear ASN & roteamento', cat: 'Rede' })
  if (hasDomain) nextSteps.push({ tool: 'subdominios', label: 'Reconhecimento de subdomínios', cat: 'DNS' })
  if (!hasUser) nextSteps.push({ tool: 'username', label: 'Buscar usernames (WhatsMyName)', cat: 'OSINT' })
  nextSteps.push({ tool: 'cve', label: 'Checar CVEs relacionadas', cat: 'Vulnerabilidades' })

  return {
    ranAt: enr?.ranAt,
    targets,
    risk: { score, band, color, factors },
    kpis,
    insights: insights.slice(0, 8),
    execText,
    nextSteps: nextSteps.slice(0, 6),
    integrations,
  }
}

function countRan(targets: any[]): number {
  let n = 0
  for (const t of targets) {
    n += [t.threatIntel, t.whois, t.subdomains, t.asn, t.hunter, t.email, t.leaklookup, t.comb, t.whatsmyname].filter(Boolean).length
  }
  return n
}

/** Dados resumidos de UM alvo para os cards "Visão Geral do Alvo Selecionado". */
export function targetOverview(t: any) {
  if (!t) return null
  const kind = t.kind as string
  return {
    value: t.value,
    kind,
    threatIntel: t.threatIntel,
    whois: t.whois,
    subdomains: t.subdomains?.names ?? [],
    hosts: [...(t.whois?.dns?.A ?? []), ...(t.whois?.dns?.AAAA ?? [])],
    asn: t.asn,
    hunter: t.hunter,
    email: t.email,
    leaklookup: t.leaklookup,
    comb: t.comb,
    whatsmyname: t.whatsmyname,
    userintel: t.userintel,
    servicescan: t.servicescan,
    googleintel: t.googleintel,
  }
}
