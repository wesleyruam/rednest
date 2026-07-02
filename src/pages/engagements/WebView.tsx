import { AreaChart, Area, XAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useAppStore } from '@/store/app'
import { useUIStore } from '@/store/ui'
import type { Engagement } from '@/types'

function riskStyle(s: string) {
  if (s === 'Crítico') return { color: '#ffd2dc', bg: 'rgba(240,71,106,.16)', border: 'rgba(240,71,106,.5)' }
  if (s === 'Alto')    return { color: '#ffe0c2', bg: 'rgba(251,146,60,.14)', border: 'rgba(251,146,60,.45)' }
  if (s === 'Médio')   return { color: '#f6ecc7', bg: 'rgba(224,179,65,.13)', border: 'rgba(224,179,65,.4)' }
  return { color: '#cfeeff', bg: 'rgba(63,182,245,.13)', border: 'rgba(63,182,245,.4)' }
}

function portStatus(s: string) {
  if (s === 'Aberta')  return { color: '#4dd4a4', bg: 'rgba(29,158,117,.14)' }
  if (s === 'Fechada') return { color: '#ff8a8a', bg: 'rgba(226,75,74,.12)' }
  return { color: '#f4bc6a', bg: 'rgba(239,159,39,.12)' }
}

interface WebViewProps { engagement: Engagement }

export function WebView({ engagement }: WebViewProps) {
  const d = engagement.webData!
  const { setEngagementTab } = useAppStore()
  const { showToast } = useUIStore()
  const rs = riskStyle(d.stats.riskLevel)

  function openSite() {
    window.open(`https://${d.site.domain}`, '_blank', 'noopener')
  }
  function openWayback() {
    window.open(`https://web.archive.org/web/*/${d.site.domain}`, '_blank', 'noopener')
    showToast(`Abrindo histórico do Wayback Machine para ${d.site.domain}`, 'info')
  }

  return (
    <div className="hud" style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--hbg)' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 10 }}>
        {[
          { label: 'URLS COLETADAS', value: d.stats.urls.toLocaleString('pt-BR'), trend: '+68 hoje' },
          { label: 'PÁGINAS WEB',    value: d.stats.pages, trend: '+12 hoje' },
          { label: 'RECURSOS',       value: d.stats.resources.toLocaleString('pt-BR'), trend: '+34 hoje' },
          { label: 'SUBDOMÍNIOS',    value: d.stats.subdomains, trend: '+3' },
          { label: 'ENDPOINTS',      value: d.stats.endpoints, trend: '+5' },
          { label: 'PARÂMETROS',     value: d.stats.params, trend: '+2' },
          { label: 'TECNOLOGIAS',    value: d.stats.technologies, trend: '+1' },
          { label: 'RISK SCORE',     value: d.stats.riskScore, sub: d.stats.riskLevel, isRisk: true },
        ].map((s, i) => (
          <div key={s.label} className="block" style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--txt-3)', marginBottom: 5 }}>{s.label}</div>
            {(s as { isRisk?: boolean }).isRisk ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 700, color: rs.color, lineHeight: 1, fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</div>
                <div style={{ fontSize: 10, marginTop: 3, color: rs.color, background: rs.bg, border: `0.5px solid ${rs.border}`, display: 'inline-block', padding: '1px 6px', borderRadius: 4 }}>/100 {s.sub}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 20, fontWeight: 700, color: i < 2 ? 'var(--low)' : 'var(--htxt)', lineHeight: 1, fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--up)', marginTop: 2 }}>{(s as { trend?: string }).trend}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Row 1: Site overview + Techs + Content distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
        <div className="block hot">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead"><span className="t">Visão Geral do Site</span></div>
          <div className="bbody" style={{ flexDirection: 'row', gap: 14 }}>
            <div style={{ width: 160, height: 120, borderRadius: 8, background: '#0a0a12', border: '1px solid var(--line)', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ flex: 1, background: 'linear-gradient(135deg, #0e1428, #121c30)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt-3)', fontSize: 11 }}>
                SITE ALVO
              </div>
              <div style={{ display: 'flex', gap: 4, padding: 6 }}>
                <button className="hbtn" style={{ flex: 1, fontSize: 9.5 }} onClick={openSite}>🔗 Abrir</button>
                <button className="hbtn" style={{ flex: 1, fontSize: 9.5 }} onClick={openWayback}>🕐 Histórico</button>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {[
                ['Domínio',   d.site.domain],
                ['IP',        d.site.ip],
                ['Provedor',  d.site.provider],
                ['ASN',       d.site.asn],
                ['País',      `🇧🇷 ${d.site.country}`],
                ['Servidor',  d.site.server],
                ['CMS',       d.site.cms],
                ['Idioma',    d.site.language],
                ['Primeira vista', d.site.firstSeen],
                ['Última coleta',  d.site.lastCollected],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 11.5 }}>
                  <span style={{ width: 90, color: 'var(--txt-3)', flexShrink: 0 }}>{k}</span>
                  <span style={{ color: 'var(--htxt)', fontFamily: k === 'IP' || k === 'ASN' ? "'JetBrains Mono', monospace" : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="block">
          <div className="bhead"><span className="t">Tecnologias Identificadas</span></div>
          <div className="bbody" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ResponsiveContainer width={100} height={100}>
              <PieChart>
                <Pie data={d.technologies} cx="50%" cy="50%" innerRadius={28} outerRadius={45} paddingAngle={2} dataKey="percentage">
                  {d.technologies.map((t, i) => <Cell key={i} fill={t.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {d.technologies.map(t => (
                <div key={t.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                    <span style={{ color: 'var(--txt-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 70 }}>{t.name}</span>
                  </div>
                  <span style={{ color: 'var(--txt-3)', fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>{t.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
          <button className="hbtn" style={{ margin: '0 14px 10px', width: 'calc(100% - 28px)', fontSize: 11 }}
            onClick={() => setEngagementTab('Tecnologias')}>
            Ver todas tecnologias →
          </button>
        </div>

        <div className="block">
          <div className="bhead"><span className="t">Distribuição de Conteúdo</span></div>
          <div className="bbody" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ResponsiveContainer width={90} height={90}>
              <PieChart>
                <Pie data={d.contentDistribution} cx="50%" cy="50%" innerRadius={22} outerRadius={38} paddingAngle={2} dataKey="percentage">
                  {d.contentDistribution.map((t, i) => <Cell key={i} fill={t.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {d.contentDistribution.map(t => (
                <div key={t.type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                    <span style={{ color: 'var(--txt-2)' }}>{t.type}</span>
                  </div>
                  <span style={{ color: 'var(--txt-3)', fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>{t.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
          <button className="hbtn" style={{ margin: '0 14px 10px', width: 'calc(100% - 28px)', fontSize: 11 }}
            onClick={() => setEngagementTab('Conteúdo')}>
            Ver detalhes →
          </button>
        </div>
      </div>

      {/* Row 2: Subdomains + Ports + Headers + SSL */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.5fr 1.2fr', gap: 12 }}>
        <div className="block">
          <div className="bhead"><span className="t">Subdomínios Encontrados</span></div>
          <table className="data-table" style={{ fontSize: 11.5 }}>
            <thead><tr><th>Subdomínio</th><th>IP</th><th>Status</th><th>Descoberto em</th></tr></thead>
            <tbody>
              {d.subdomains.map(s => (
                <tr key={s.subdomain}>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--low)' }}>{s.subdomain}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--txt-2)' }}>{s.ip}</td>
                  <td><span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: s.status === 'Ativo' ? 'rgba(29,158,117,.14)' : 'rgba(226,75,74,.12)', color: s.status === 'Ativo' ? '#4dd4a4' : '#ff8a8a' }}>{s.status}</span></td>
                  <td style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>{s.discoveredAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="hbtn" style={{ margin: '6px 12px 8px', width: 'calc(100% - 24px)', fontSize: 11 }}
            onClick={() => setEngagementTab('Infraestrutura')}>
            Ver todos subdomínios →
          </button>
        </div>

        <div className="block">
          <div className="bhead"><span className="t">Portas &amp; Serviços</span></div>
          <table className="data-table" style={{ fontSize: 11.5 }}>
            <thead><tr><th>Porta</th><th>Serviço</th><th>Proto.</th><th>Status</th></tr></thead>
            <tbody>
              {d.ports.map(p => {
                const ps = portStatus(p.status)
                return (
                  <tr key={p.port}>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>{p.port}</td>
                    <td style={{ color: 'var(--txt-2)' }}>{p.service}</td>
                    <td style={{ color: 'var(--txt-3)' }}>{p.protocol}</td>
                    <td><span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: ps.bg, color: ps.color }}>{p.status}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <button className="hbtn" style={{ margin: '6px 12px 8px', width: 'calc(100% - 24px)', fontSize: 11 }}
            onClick={() => setEngagementTab('Infraestrutura')}>
            Ver todos serviços →
          </button>
        </div>

        <div className="block">
          <div className="bhead"><span className="t">Cabeçalhos (Headers)</span></div>
          <table className="data-table" style={{ fontSize: 11 }}>
            <tbody>
              {d.headers.map(h => (
                <tr key={h.key}>
                  <td style={{ color: 'var(--txt-3)', fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>{h.key}</td>
                  <td style={{ color: 'var(--txt-2)', fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="hbtn" style={{ margin: '6px 12px 8px', width: 'calc(100% - 24px)', fontSize: 11 }}
            onClick={() => setEngagementTab('Infraestrutura')}>
            Ver todos headers →
          </button>
        </div>

        <div className="block" style={{ padding: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>SSL / Certificado</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ color: d.ssl.valid ? '#34d27b' : '#f0476a', fontSize: 16 }}>{d.ssl.valid ? '🔒' : '🔓'}</span>
            <span style={{ color: d.ssl.valid ? '#34d27b' : '#f0476a', fontSize: 12, fontWeight: 600 }}>{d.ssl.valid ? 'Válido' : 'Inválido'}</span>
          </div>
          {[
            ['Emitido por', d.ssl.issuer],
            ['Emitido para', d.ssl.issuedTo],
            ['Válido de', d.ssl.validFrom],
            ['Válido até', d.ssl.validUntil],
            ['TLS', d.ssl.tls],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11 }}>
              <span style={{ color: 'var(--txt-3)' }}>{k}</span>
              <span style={{ color: 'var(--txt-2)', fontFamily: k === 'TLS' ? "'JetBrains Mono', monospace" : undefined }}>{v}</span>
            </div>
          ))}
          <button className="hbtn" style={{ width: '100%', marginTop: 8, fontSize: 11 }}
            onClick={() => setEngagementTab('Infraestrutura')}>
            Ver detalhes do certificado →
          </button>
        </div>
      </div>

      {/* Row 3: Traffic + Countries + Changes + Risks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.5fr 1.5fr', gap: 12 }}>
        <div className="block">
          <div className="bhead"><span className="t">Tráfego Estimado</span></div>
          <div style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--htxt)', fontFamily: "'Space Grotesk', sans-serif" }}>{d.trafficTotal}</div>
              <div style={{ fontSize: 12, color: 'var(--up)', marginBottom: 3 }}>+{d.trafficGrowth}%</div>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--txt-3)', marginBottom: 8 }}>Visitas estimadas</div>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={d.traffic}>
                <defs>
                  <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: 'var(--txt-3)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <Area type="monotone" dataKey="visits" stroke="var(--accent)" fill="url(#trafficGrad)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
            <button className="hbtn" style={{ width: '100%', marginTop: 8, fontSize: 11 }}
              onClick={() => setEngagementTab('Monitoramento')}>
              Ver análise completa →
            </button>
          </div>
        </div>

        <div className="block">
          <div className="bhead"><span className="t">Países de Origem</span></div>
          <div style={{ padding: '8px 0' }}>
            {d.countries.map(c => (
              <div key={c.country} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 16 }}>{c.flag}</span>
                <span style={{ flex: 1, fontSize: 11.5, color: 'var(--txt-2)' }}>{c.country}</span>
                <span style={{ fontSize: 11, color: 'var(--low)', fontFamily: "'JetBrains Mono', monospace" }}>{c.percentage}%</span>
              </div>
            ))}
            <button className="hbtn" style={{ margin: '6px 14px 4px', width: 'calc(100% - 28px)', fontSize: 11 }}
              onClick={() => setEngagementTab('Reconhecimento')}>
              Ver mapa completo →
            </button>
          </div>
        </div>

        <div className="block">
          <div className="bhead"><span className="t">Últimas Alterações Detectadas</span></div>
          <div>
            {d.recentChanges.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 12px', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10.5, color: 'var(--txt-3)', fontFamily: 'var(--font-mono)', flexShrink: 0, width: 36 }}>{c.time}</span>
                <span style={{ fontSize: 11, color: 'var(--txt-2)', flex: 1, lineHeight: 1.4 }}>{c.description}</span>
                <span style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 3, background: `${c.tagColor}18`, color: c.tagColor, border: `0.5px solid ${c.tagColor}44`, flexShrink: 0 }}>{c.tag}</span>
              </div>
            ))}
            <button className="hbtn" style={{ margin: '6px 12px 4px', width: 'calc(100% - 24px)', fontSize: 11 }}
              onClick={() => setEngagementTab('Monitoramento')}>
              Ver todas alterações →
            </button>
          </div>
        </div>

        <div className="block">
          <div className="bhead"><span className="t">Riscos Identificados</span></div>
          <div style={{ padding: '6px 0' }}>
            {d.risks.map((r, i) => {
              const rs2 = riskStyle(r.severity)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 13 }}>⚠</span>
                  <span style={{ flex: 1, fontSize: 11, color: 'var(--txt-2)', lineHeight: 1.4 }}>{r.description}</span>
                  <span style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 3, background: rs2.bg, color: rs2.color, border: `0.5px solid ${rs2.border}`, flexShrink: 0 }}>{r.severity}</span>
                </div>
              )
            })}
            <button className="hbtn" style={{ margin: '6px 12px 4px', width: 'calc(100% - 24px)', fontSize: 11 }}
              onClick={() => setEngagementTab('Vulnerabilidades')}>
              Ver todos riscos →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
