import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { Engagement } from '@/types'

// ─── Shared Helpers ───────────────────────────────────────────────────────────

function RiskBadge({ score, level }: { score: number; level: string }) {
  const color = level === 'Crítico' ? 'var(--crit)' : level === 'Alto' ? 'var(--high)' : level === 'Médio' ? 'var(--med)' : 'var(--low)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: 54, height: 54 }}>
        <svg width={54} height={54} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={27} cy={27} r={22} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={4} />
          <circle cx={27} cy={27} r={22} fill="none" stroke={color} strokeWidth={4}
            strokeDasharray={`${2 * Math.PI * 22 * score / 100} ${2 * Math.PI * 22}`}
            strokeLinecap="round" style={{ transition: 'stroke-dasharray .6s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color, fontFamily: "'Space Grotesk', sans-serif" }}>
          {score}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Risco</div>
        <div style={{ fontSize: 14, fontWeight: 700, color }}>{level}</div>
      </div>
    </div>
  )
}

function SevTag({ sev }: { sev: string }) {
  const cls = sev === 'Crítico' ? 'crit' : sev === 'Alto' ? 'high' : sev === 'Médio' ? 'med' : 'low'
  return <span className={`sev ${cls}`}>{sev}</span>
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="block" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 10, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color ?? 'var(--htxt)', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--txt-2)', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

const scrollArea: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16,
}

// ─── Domain View ──────────────────────────────────────────────────────────────

export function DomainView({ engagement }: { engagement: Engagement }) {
  const d = engagement.domainData!
  const expiresDate = new Date(d.expiresAt.split('/').reverse().join('-'))
  const today = new Date('2026-06-24')
  const daysLeft = Math.round((expiresDate.getTime() - today.getTime()) / 86400000)

  return (
    <div className="hud" style={scrollArea}>
      {/* Row 1: stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="Pontuação de Risco" value={d.riskScore} color={d.riskLevel === 'Crítico' ? 'var(--crit)' : d.riskLevel === 'Alto' ? 'var(--high)' : 'var(--med)'} />
        <StatCard label="Subdomínios" value={d.subdomains.length} sub="descobertos" />
        <StatCard label="Registros DNS" value={d.dnsRecords.length} sub="tipos mapeados" />
        <StatCard label="Expira em" value={`${daysLeft}d`} sub={`em ${d.expiresAt}`} color={daysLeft < 60 ? 'var(--high)' : 'var(--htxt)'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
        {/* WHOIS */}
        <div className="block">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">WHOIS</div>
          <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              ['Domínio',     d.domain],
              ['Registrador', d.registrar],
              ['Organização', d.registrantOrg],
              ['País',        d.registrantCountry],
              ['Criado em',   d.createdAt],
              ['Atualizado',  d.updatedAt],
              ['Expira em',   d.expiresAt],
            ].map(([k, v]) => (
              <div key={k} className="rowi">
                <span style={{ color: 'var(--txt-3)', minWidth: 90 }}>{k}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--htxt)' }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {d.status.map(s => <span key={s} style={{ fontSize: 9.5, padding: '2px 6px', borderRadius: 4, background: 'rgba(90,209,255,.08)', color: '#5ad1ff', fontFamily: "'JetBrains Mono', monospace" }}>{s}</span>)}
            </div>
          </div>
        </div>

        {/* DNS Records */}
        <div className="block">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">Registros DNS</div>
          <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {d.dnsRecords.map((r, i) => (
              <div key={i} className="rowi" style={{ alignItems: 'flex-start' }}>
                <span style={{ minWidth: 44, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, padding: '1px 6px', borderRadius: 3, background: 'rgba(127,119,221,.12)', color: '#a09ae8', flexShrink: 0 }}>{r.type}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--txt-2)', minWidth: 60 }}>{r.name}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.value}</span>
                <span style={{ fontSize: 9.5, color: 'var(--txt-3)', flexShrink: 0 }}>TTL {r.ttl}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Subdomains */}
        <div className="block">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">Subdomínios</div>
          <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {d.subdomains.map((s, i) => (
              <div key={i} className="rowi">
                <span style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ fontSize: 10, color: s.httpStatus === 200 ? 'var(--up)' : s.httpStatus === 0 ? 'var(--txt-3)' : 'var(--med)', fontFamily: "'JetBrains Mono', monospace", marginRight: 8 }}>{s.httpStatus || '—'}</span>
                <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,.04)', color: 'var(--txt-3)' }}>{s.source}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SSL + History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="block">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="bhead">SSL / TLS</div>
            <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                ['Status',    d.ssl.valid ? '✓ Válido' : '✗ Inválido'],
                ['Emissor',   d.ssl.issuer],
                ['Expira em', d.ssl.validUntil],
                ['Protocolo', d.ssl.tls],
              ].map(([k, v]) => (
                <div key={k} className="rowi">
                  <span style={{ color: 'var(--txt-3)', minWidth: 80 }}>{k}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: k === 'Status' ? (d.ssl.valid ? 'var(--up)' : 'var(--crit)') : 'var(--htxt)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="block" style={{ flex: 1 }}>
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="bhead">Histórico Recente</div>
            <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {d.history.slice(0, 4).map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(255,255,255,.04)', color: 'var(--txt-3)', flexShrink: 0, marginTop: 1 }}>{h.type}</span>
                  <span style={{ fontSize: 11, color: 'var(--txt-2)', flex: 1 }}>{h.description}</span>
                  <span style={{ fontSize: 9.5, color: 'var(--txt-3)', flexShrink: 0 }}>{h.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tags + Risk */}
      <div className="block">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bbody" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {d.categories.map(c => <span key={c} className="tag">{c}</span>)}
            {d.tags.map(t => <span key={t} className="tag">{t}</span>)}
          </div>
          <RiskBadge score={d.riskScore} level={d.riskLevel} />
        </div>
      </div>
    </div>
  )
}

// ─── Infrastructure View ──────────────────────────────────────────────────────

export function InfraView({ engagement }: { engagement: Engagement }) {
  const d = engagement.infraData!
  const openPorts = d.openPorts.length
  const critPorts = d.openPorts.filter(p => p.cve).length

  return (
    <div className="hud" style={scrollArea}>
      {/* Row 1: stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="Score de Abuso" value={d.abuseScore} color={d.abuseScore > 60 ? 'var(--crit)' : d.abuseScore > 30 ? 'var(--high)' : 'var(--up)'} sub={`${d.abuseReports} relatórios`} />
        <StatCard label="Portas Abertas" value={openPorts} sub={`${critPorts} com CVE`} />
        <StatCard label="Hostnames" value={d.hostnames.length} sub="no mesmo IP" />
        <StatCard label="Certificados" value={d.certificates.length} sub="detectados" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
        {/* IP Info */}
        <div className="block">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">Informações do IP</div>
          <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              ['IP',        d.ip],
              ['Hostname',  d.hostname],
              ['ASN',       d.asn],
              ['Organização', d.org],
              ['País',      d.country],
              ['Cidade',    d.city],
              ['ISP',       d.isp],
              ['1ª vez visto', d.firstSeen],
              ['Última vez',   d.lastSeen],
            ].map(([k, v]) => (
              <div key={k} className="rowi">
                <span style={{ color: 'var(--txt-3)', minWidth: 100 }}>{k}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ports */}
        <div className="block">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">Portas Abertas</div>
          <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {d.openPorts.map((p, i) => (
              <div key={i} className="rowi" style={{ alignItems: 'flex-start' }}>
                <span style={{ minWidth: 44, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: 'var(--up)' }}>{p.port}</span>
                <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'rgba(90,209,255,.08)', color: '#5ad1ff', marginRight: 6 }}>{p.protocol}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)', flex: 1 }}>{p.service}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--txt-3)', flex: 1 }}>{p.version}</span>
                {p.cve && <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'rgba(226,75,74,.15)', color: '#e24b4a' }}>{p.cve}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        {/* Certificates */}
        <div className="block">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">Certificados SSL</div>
          <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {d.certificates.map((c, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, fontWeight: 700, color: 'var(--htxt)' }}>{c.cn}</span>
                  {c.selfSigned && <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'rgba(239,159,39,.15)', color: '#f4bc6a' }}>auto-assinado</span>}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>Emissor: {c.issuer}</div>
                <div style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>Válido: {c.validFrom} → {c.validUntil}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {c.domains.map(dom => <span key={dom} style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,.04)', color: 'var(--txt-2)', fontFamily: "'JetBrains Mono', monospace" }}>{dom}</span>)}
                </div>
                {i < d.certificates.length - 1 && <div style={{ height: 1, background: 'var(--line)', marginTop: 4 }} />}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Hostnames */}
          <div className="block" style={{ flex: 1 }}>
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="bhead">Hostnames no IP</div>
            <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {d.hostnames.map((h, i) => (
                <div key={i} className="rowi">
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)' }}>{h}</span>
                </div>
              ))}
            </div>
          </div>

          {/* BGP + Related IPs */}
          <div className="block">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="bhead">BGP / IPs Relacionados</div>
            <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {d.bgpPrefixes.map(p => <span key={p} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: '#5ad1ff' }}>{p}</span>)}
              <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {d.relatedIPs.map(ip => <span key={ip} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,.04)', color: 'var(--txt-2)', fontFamily: "'JetBrains Mono', monospace" }}>{ip}</span>)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="block">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bbody" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {d.tags.map(t => <span key={t} className="tag">{t}</span>)}
          </div>
          <RiskBadge score={d.riskScore} level={d.riskLevel} />
        </div>
      </div>
    </div>
  )
}

// ─── Person View ──────────────────────────────────────────────────────────────

export function PersonView({ engagement }: { engagement: Engagement }) {
  const d = engagement.personData!
  const totalLeaks = d.breaches.length
  const critLeaks = d.breaches.filter(b => b.severity === 'Crítico').length

  return (
    <div className="hud" style={scrollArea}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="Pontuação de Risco" value={d.riskScore} color={d.riskLevel === 'Crítico' ? 'var(--crit)' : d.riskLevel === 'Alto' ? 'var(--high)' : 'var(--med)'} />
        <StatCard label="Vazamentos" value={totalLeaks} sub={`${critLeaks} críticos`} color={critLeaks > 0 ? 'var(--crit)' : 'var(--htxt)'} />
        <StatCard label="E-mails" value={d.emails.length} sub="identificados" />
        <StatCard label="Perfis Sociais" value={d.socialLinks.length} sub="mapeados" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
        {/* Identity */}
        <div className="block">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">Identidade</div>
          <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              ['Nome',         `${d.firstName} ${d.lastName}`],
              ['CPF',          d.cpfMasked],
              ['Nascimento',   d.birthDate],
              ['Sexo',         d.gender === 'M' ? 'Masculino' : 'Feminino'],
            ].map(([k, v]) => (
              <div key={k} className="rowi">
                <span style={{ color: 'var(--txt-3)', minWidth: 90 }}>{k}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--htxt)' }}>{v}</span>
              </div>
            ))}
            <div style={{ height: 1, background: 'var(--line)', margin: '6px 0' }} />
            <div style={{ fontSize: 10.5, color: 'var(--txt-3)', marginBottom: 4 }}>Telefones</div>
            {d.phones.map(p => <div key={p} className="rowi"><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--htxt)' }}>{p}</span></div>)}
            <div style={{ height: 1, background: 'var(--line)', margin: '6px 0' }} />
            <div style={{ fontSize: 10.5, color: 'var(--txt-3)', marginBottom: 4 }}>Endereços</div>
            {d.addresses.filter(a => a.current).map((a, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--htxt)' }}>{a.street}</div>
                <div style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>{a.city} — {a.state} · {a.type}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Emails + Socials */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="block">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="bhead">E-mails Identificados</div>
            <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {d.emails.map((e, i) => (
                <div key={i} className="rowi">
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.email}</span>
                  {e.leakCount > 0 && <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'rgba(226,75,74,.15)', color: '#e24b4a', flexShrink: 0 }}>{e.leakCount} leaks</span>}
                  <span style={{ fontSize: 9.5, color: 'var(--txt-3)', flexShrink: 0, marginLeft: 6 }}>{e.source}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="block" style={{ flex: 1 }}>
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="bhead">Redes Sociais</div>
            <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {d.socialLinks.map((s, i) => (
                <div key={i} className="rowi">
                  <span style={{ minWidth: 80, fontSize: 11, color: 'var(--txt-3)' }}>{s.platform}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)', flex: 1 }}>{s.handle}</span>
                  <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>{s.followers.toLocaleString('pt-BR')} seguidores</span>
                  <span style={{ marginLeft: 8, width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: s.active ? 'var(--up)' : 'var(--txt-3)' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        {/* Breaches */}
        <div className="block hot">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">Exposição em Vazamentos</div>
          <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {d.breaches.map((b, i) => (
              <div key={i} className="rowi" style={{ alignItems: 'flex-start' }}>
                <span style={{ flex: 1, fontSize: 11.5, color: 'var(--htxt)', fontWeight: 600 }}>{b.name}</span>
                <span style={{ fontSize: 10, color: 'var(--txt-3)', marginRight: 8 }}>{b.date}</span>
                <SevTag sev={b.severity} />
              </div>
            ))}
          </div>
        </div>

        {/* Relatives + Companies */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="block">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="bhead">Parentes / Vínculos</div>
            <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {d.relatives.map((r, i) => (
                <div key={i} className="rowi">
                  <span style={{ fontSize: 11.5, color: 'var(--htxt)', flex: 1 }}>{r.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--txt-3)', marginRight: 8 }}>{r.relationship}</span>
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,.04)', color: 'var(--txt-3)' }}>{r.confidence}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="block">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="bhead">Vínculos Empresariais</div>
            <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {d.companies.map((c, i) => <div key={i} style={{ fontSize: 11.5, color: 'var(--htxt)' }}>{c}</div>)}
            </div>
          </div>
        </div>
      </div>

      <div className="block">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bbody" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {d.tags.map(t => <span key={t} className="tag">{t}</span>)}
          </div>
          <RiskBadge score={d.riskScore} level={d.riskLevel} />
        </div>
      </div>
    </div>
  )
}

// ─── Organization View ────────────────────────────────────────────────────────

export function OrgView({ engagement }: { engagement: Engagement }) {
  const d = engagement.orgData!

  return (
    <div className="hud" style={scrollArea}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="Pontuação de Risco" value={d.riskScore} color={d.riskLevel === 'Crítico' ? 'var(--crit)' : d.riskLevel === 'Alto' ? 'var(--high)' : 'var(--med)'} />
        <StatCard label="Sócios / Diretores" value={d.officers.length} sub="identificados" />
        <StatCard label="Domínios" value={d.domains.length} sub="mapeados" />
        <StatCard label="Vazamentos" value={d.breaches.length} sub="registros expostos" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
        {/* Company info */}
        <div className="block">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">Dados da Empresa</div>
          <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              ['Nome',       d.name],
              ['CNPJ',       d.cnpj],
              ['Tipo',       d.type],
              ['Status',     d.status],
              ['Fundada em', d.founded],
              ['Capital',    d.capital],
              ['Cidade',     `${d.city} — ${d.state}`],
              ['Atividade',  d.activity],
            ].map(([k, v]) => (
              <div key={k} className="rowi">
                <span style={{ color: 'var(--txt-3)', minWidth: 90 }}>{k}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: k === 'Status' ? 'var(--up)' : 'var(--htxt)' }}>{v}</span>
              </div>
            ))}
            <div style={{ height: 1, background: 'var(--line)', margin: '6px 0' }} />
            <div style={{ fontSize: 10.5, color: 'var(--txt-3)', marginBottom: 4 }}>Telefones / E-mails</div>
            {d.phones.map(p => <div key={p} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)' }}>{p}</div>)}
            {d.emails.map(e => <div key={e} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--txt-2)' }}>{e}</div>)}
          </div>
        </div>

        {/* Officers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="block">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="bhead">Quadro Societário</div>
            <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {d.officers.map((o, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(127,119,221,.15)', border: '1px solid rgba(127,119,221,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#a09ae8', flexShrink: 0 }}>
                      {o.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--htxt)' }}>{o.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>{o.role} · desde {o.since}</div>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--txt-3)' }}>{o.cpfMasked}</span>
                  </div>
                  {i < d.officers.length - 1 && <div style={{ height: 1, background: 'var(--line)', marginTop: 8 }} />}
                </div>
              ))}
            </div>
          </div>

          <div className="block">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="bhead">Presença Digital</div>
            <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {d.socialLinks.map((s, i) => (
                <div key={i} className="rowi">
                  <span style={{ minWidth: 80, fontSize: 11, color: 'var(--txt-3)' }}>{s.platform}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)', flex: 1 }}>@{s.handle}</span>
                  <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>{s.followers.toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        {/* Domains */}
        <div className="block">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">Domínios</div>
          <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {d.domains.map((dom, i) => (
              <div key={i} className="rowi">
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)', flex: 1 }}>{dom.domain}</span>
                <span style={{ fontSize: 10, color: dom.status === 'Ativo' ? 'var(--up)' : 'var(--txt-3)', marginRight: 8 }}>{dom.status}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--txt-3)' }}>{dom.ip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Breaches */}
        <div className="block hot">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">Exposição em Vazamentos</div>
          <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.breaches.map((b, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--htxt)' }}>{b.name}</span>
                  <SevTag sev={b.severity} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {b.dataTypes.map(dt => <span key={dt} style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,.04)', color: 'var(--txt-3)' }}>{dt}</span>)}
                </div>
                {i < d.breaches.length - 1 && <div style={{ height: 1, background: 'var(--line)', marginTop: 8 }} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="block">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bbody" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {d.tags.map(t => <span key={t} className="tag">{t}</span>)}
          </div>
          <RiskBadge score={d.riskScore} level={d.riskLevel} />
        </div>
      </div>
    </div>
  )
}

// ─── Social Profile View ──────────────────────────────────────────────────────

export function SocialView({ engagement }: { engagement: Engagement }) {
  const d = engagement.socialData!
  const fmtNum = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)

  return (
    <div className="hud" style={scrollArea}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="Seguidores" value={fmtNum(d.followers)} sub={`${d.platform}`} />
        <StatCard label="Publicações" value={d.totalPosts.toLocaleString('pt-BR')} sub="total de posts" />
        <StatCard label="Engajamento" value={`${d.engagementRate}%`} sub="taxa média" color={d.engagementRate > 5 ? 'var(--up)' : 'var(--med)'} />
        <StatCard label="Risco" value={d.riskScore} color={d.riskLevel === 'Crítico' ? 'var(--crit)' : 'var(--high)'} sub={d.riskLevel} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
        {/* Profile card */}
        <div className="block hot">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bbody">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(226,75,74,.3), rgba(239,159,39,.2))', border: '2px solid rgba(226,75,74,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#e24b4a', flexShrink: 0 }}>
                {d.displayName.split(' ').slice(0, 2).map(n => n[0]).join('')}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--htxt)' }}>{d.displayName}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--txt-3)' }}>@{d.handle}</div>
                <div style={{ fontSize: 10, color: '#5ad1ff', marginTop: 2 }}>{d.platform}</div>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--txt-2)', lineHeight: 1.6, marginBottom: 12, fontStyle: 'italic' }}>
              "{d.bio}"
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                ['Criado em', d.joinedAt],
                ['Seguindo',  d.following.toString()],
                ['Perfil',    d.profileUrl],
              ].map(([k, v]) => (
                <div key={k} className="rowi">
                  <span style={{ color: 'var(--txt-3)', minWidth: 70 }}>{k}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--htxt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {d.flags.map(f => <span key={f} style={{ fontSize: 9.5, padding: '2px 7px', borderRadius: 20, background: 'rgba(226,75,74,.15)', color: '#e24b4a', border: '1px solid rgba(226,75,74,.25)' }}>{f}</span>)}
            </div>
          </div>
        </div>

        {/* Posts */}
        <div className="block">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">Publicações Recentes</div>
          <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {d.recentPosts.map((p, i) => (
              <div key={p.id}>
                <div style={{ fontSize: 11.5, color: 'var(--htxt)', lineHeight: 1.5, marginBottom: 6 }}>{p.text}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,.04)', color: 'var(--txt-3)' }}>{p.type}</span>
                  <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>👍 {p.likes.toLocaleString('pt-BR')}</span>
                  <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>🔁 {p.shares.toLocaleString('pt-BR')}</span>
                  <span style={{ fontSize: 10, color: 'var(--txt-3)', flex: 1 }}>💬 {p.comments.toLocaleString('pt-BR')}</span>
                  <span style={{ fontSize: 9.5, color: 'var(--txt-3)' }}>{p.date}</span>
                  {p.flagged && <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'rgba(226,75,74,.15)', color: '#e24b4a' }}>⚑ flagged</span>}
                </div>
                {i < d.recentPosts.length - 1 && <div style={{ height: 1, background: 'var(--line)', marginTop: 10 }} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
        {/* Post types chart */}
        <div className="block">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">Distribuição por Tipo</div>
          <div className="bbody" style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.postsByType} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={60} label={({ type, count }) => `${type} (${count})`} labelLine={false} fontSize={10}>
                  {d.postsByType.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Linked accounts */}
        <div className="block">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">Contas Vinculadas</div>
          <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {d.linkedAccounts.map((a, i) => (
              <div key={i} className="rowi">
                <span style={{ minWidth: 80, fontSize: 11, color: 'var(--txt-3)' }}>{a.platform}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)', flex: 1 }}>{a.handle}</span>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: a.confidence === 'Alta' ? 'rgba(29,158,117,.15)' : 'rgba(255,255,255,.04)', color: a.confidence === 'Alta' ? 'var(--up)' : 'var(--txt-3)' }}>{a.confidence}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="block">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bbody" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {d.tags.map(t => <span key={t} className="tag">{t}</span>)}
          </div>
          <RiskBadge score={d.riskScore} level={d.riskLevel} />
        </div>
      </div>
    </div>
  )
}

// ─── Leak View ────────────────────────────────────────────────────────────────

export function LeakView({ engagement }: { engagement: Engagement }) {
  const d = engagement.leakData!
  const fmtNum = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)

  return (
    <div className="hud" style={scrollArea}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="Total de Registros" value={fmtNum(d.totalRecords)} color="var(--crit)" sub={d.severity} />
        <StatCard label="E-mails Únicos" value={fmtNum(d.totalEmails)} />
        <StatCard label="Senhas Expostas" value={fmtNum(d.totalPasswords)} color="var(--high)" />
        <StatCard label="Campos de Dados" value={d.dataFields.length} sub={`${d.verified ? 'Verificado' : 'Não verificado'}`} color={d.verified ? 'var(--up)' : 'var(--txt-3)'} />
      </div>

      {/* Breach meta */}
      <div className="block hot">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bhead">{d.name}</div>
        <div className="bbody">
          <p style={{ fontSize: 12, color: 'var(--txt-2)', lineHeight: 1.65, margin: '0 0 12px' }}>{d.description}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
            {[
              ['Data da Brecha',  d.breachDate],
              ['Descoberto em',   d.discoveredAt],
              ['Fonte',           d.source],
            ].map(([k, v]) => (
              <div key={k} className="rowi" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <span style={{ fontSize: 9.5, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{k}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--htxt)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Data fields */}
        <div className="block">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">Campos Expostos</div>
          <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {d.dataFields.map((f, i) => (
              <div key={i} className="rowi">
                <span style={{ flex: 1, fontSize: 11.5, color: 'var(--htxt)' }}>{f.label}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--txt-2)', marginRight: 4 }}>{fmtNum(f.count)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Domain distribution */}
        <div className="block">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">Distribuição por Domínio</div>
          <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.domainDist.map((dom, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--htxt)' }}>{dom.domain}</span>
                  <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{dom.pct}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: 'rgba(127,119,221,.6)', width: `${dom.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12 }}>
        {/* Password strength */}
        <div className="block">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">Força das Senhas</div>
          <div className="bbody" style={{ height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.passwordStrengthDist} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--txt-3)' }} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--txt-3)' }} />
                <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 11 }} formatter={(v: number) => [fmtNum(v), 'Senhas']} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {d.passwordStrengthDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attribution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="block" style={{ flex: 1 }}>
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="bhead">Atribuição</div>
            <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                ['Origem',       d.attributionOrigin],
                ['Ator',         d.attributionActor],
                ['Método',       d.attributionMethod],
                ['Confiança',    d.attributionConfidence],
              ].map(([k, v]) => (
                <div key={k} className="rowi" style={{ alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--txt-3)', minWidth: 70, flexShrink: 0 }}>{k}</span>
                  <span style={{ fontSize: 11, color: 'var(--htxt)', lineHeight: 1.4 }}>{v}</span>
                </div>
              ))}
              <div style={{ height: 1, background: 'var(--line)', margin: '6px 0' }} />
              <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 4 }}>Brechas relacionadas</div>
              {d.relatedLeaks.map(rl => <div key={rl} style={{ fontSize: 10.5, color: 'var(--txt-2)' }}>· {rl}</div>)}
            </div>
          </div>
        </div>
      </div>

      {/* Sample credentials */}
      <div className="block">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bhead">Amostra de Credenciais (mascarado)</div>
        <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {d.sampleCredentials.map((c, i) => (
            <div key={i} className="rowi">
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)', minWidth: 180 }}>{c.email}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--high)', minWidth: 100 }}>{c.passwordMasked}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--txt-3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.hash ?? 'plaintext'}</span>
              <span style={{ fontSize: 9.5, color: 'var(--txt-3)' }}>{c.source}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="block">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bbody" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {d.tags.map(t => <span key={t} className="tag">{t}</span>)}
          </div>
          <RiskBadge score={90} level={d.riskLevel} />
        </div>
      </div>
    </div>
  )
}
