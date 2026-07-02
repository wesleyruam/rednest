import { useState } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Search, AlertTriangle } from 'lucide-react'
import type { Engagement } from '@/types'
import { EvidencePanel, ReportPanel } from '@/components/data/DataPanels'

// ─── Shared Helpers ───────────────────────────────────────────────────────────

const scrollPane: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14,
}

function SevTag({ sev }: { sev: string }) {
  const cls = sev === 'Crítico' ? 'crit' : sev === 'Alto' ? 'high' : sev === 'Médio' ? 'med' : 'low'
  return <span className={`sev ${cls}`}>{sev}</span>
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="hud">
      <div className="block">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bhead">{title}</div>
        <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function TabRow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="rowi" style={style}>{children}</div>
}

function THead({ cols }: { cols: string[] }) {
  return (
    <div style={{ display: 'flex', padding: '0 0 6px', borderBottom: '1px solid var(--line)', marginBottom: 2 }}>
      {cols.map((c, i) => (
        <span key={c} style={{ flex: i === 0 ? 2 : 1, fontSize: 9.5, fontWeight: 700, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{c}</span>
      ))}
    </div>
  )
}

// ─── Domain Tabs ──────────────────────────────────────────────────────────────

function DomainDnsTab({ eng }: { eng: Engagement }) {
  const d = eng.domainData!
  const [filter, setFilter] = useState('Todos')
  const types = ['Todos', ...Array.from(new Set(d.dnsRecords.map(r => r.type)))]
  const shown = filter === 'Todos' ? d.dnsRecords : d.dnsRecords.filter(r => r.type === filter)

  return (
    <div className="hud" style={scrollPane}>
      <div className="block">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bhead" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Registros DNS</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {types.map(t => (
              <button key={t} className="hbtn" style={{ background: filter === t ? 'rgba(127,119,221,.2)' : undefined, color: filter === t ? '#a09ae8' : undefined }} onClick={() => setFilter(t)}>{t}</button>
            ))}
          </div>
        </div>
        <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <THead cols={['Tipo', 'Nome', 'Valor', 'TTL']} />
          {shown.map((r, i) => (
            <TabRow key={i}>
              <span style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, padding: '1px 6px', borderRadius: 3, background: 'rgba(127,119,221,.1)', color: '#a09ae8', display: 'inline-block', width: 'fit-content' }}>{r.type}</span>
              <span style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--txt-2)' }}>{r.name}</span>
              <span style={{ flex: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.value}</span>
              <span style={{ flex: 1, fontSize: 10.5, color: 'var(--txt-3)' }}>{r.ttl}s</span>
            </TabRow>
          ))}
        </div>
      </div>

      <div className="block">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bhead">Name Servers</div>
        <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {d.nameServers.map((ns, i) => (
            <TabRow key={i}><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--htxt)' }}>{ns}</span></TabRow>
          ))}
        </div>
      </div>
    </div>
  )
}

function DomainWhoisTab({ eng }: { eng: Engagement }) {
  const d = eng.domainData!
  return (
    <div className="hud" style={scrollPane}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Panel title="Dados de Registro">
          {[
            ['Domínio',       d.domain],
            ['Registrador',   d.registrar],
            ['Criado em',     d.createdAt],
            ['Atualizado',    d.updatedAt],
            ['Expira em',     d.expiresAt],
          ].map(([k, v]) => (
            <TabRow key={k}>
              <span style={{ color: 'var(--txt-3)', minWidth: 100 }}>{k}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{v}</span>
            </TabRow>
          ))}
        </Panel>
        <Panel title="Registrante">
          {[
            ['Organização', d.registrantOrg],
            ['País',        d.registrantCountry],
          ].map(([k, v]) => (
            <TabRow key={k}>
              <span style={{ color: 'var(--txt-3)', minWidth: 100 }}>{k}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{v}</span>
            </TabRow>
          ))}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 4 }}>Status</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {d.status.map(s => <span key={s} style={{ fontSize: 9.5, padding: '2px 6px', borderRadius: 4, background: 'rgba(90,209,255,.08)', color: '#5ad1ff', fontFamily: "'JetBrains Mono', monospace" }}>{s}</span>)}
            </div>
          </div>
        </Panel>
      </div>
      <Panel title="Histórico do Domínio">
        {d.history.map((h, i) => (
          <TabRow key={i} style={{ alignItems: 'flex-start' }}>
            <span style={{ minWidth: 80, fontSize: 10, color: 'var(--txt-3)' }}>{h.date}</span>
            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,.04)', color: 'var(--txt-3)', marginRight: 8 }}>{h.type}</span>
            <span style={{ fontSize: 11.5, color: 'var(--htxt)' }}>{h.description}</span>
          </TabRow>
        ))}
      </Panel>
      <Panel title="SSL / TLS">
        {[
          ['Status',    d.ssl.valid ? '✓ Válido' : '✗ Inválido'],
          ['Emissor',   d.ssl.issuer],
          ['Expira em', d.ssl.validUntil],
          ['Protocolo', d.ssl.tls],
        ].map(([k, v]) => (
          <TabRow key={k}>
            <span style={{ color: 'var(--txt-3)', minWidth: 90 }}>{k}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: k === 'Status' ? (d.ssl.valid ? 'var(--up)' : 'var(--crit)') : 'var(--htxt)' }}>{v}</span>
          </TabRow>
        ))}
      </Panel>
    </div>
  )
}

function DomainInfraTab({ eng }: { eng: Engagement }) {
  const d = eng.domainData!
  return (
    <div className="hud" style={scrollPane}>
      <Panel title="Subdomínios">
        <THead cols={['Nome', 'IP', 'HTTP', 'Tipo', 'Fonte']} />
        {d.subdomains.map((s, i) => (
          <TabRow key={i}>
            <span style={{ flex: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)' }}>{s.name}</span>
            <span style={{ flex: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--txt-2)' }}>{s.ip}</span>
            <span style={{ flex: 1, fontSize: 11, color: s.httpStatus === 200 ? 'var(--up)' : s.httpStatus === 0 ? 'var(--txt-3)' : 'var(--med)', fontFamily: "'JetBrains Mono', monospace" }}>{s.httpStatus || '—'}</span>
            <span style={{ flex: 1, fontSize: 10.5, color: 'var(--txt-3)' }}>{s.type}</span>
            <span style={{ flex: 1, fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,.04)', color: 'var(--txt-3)', display: 'inline-block' }}>{s.source}</span>
          </TabRow>
        ))}
      </Panel>
    </div>
  )
}

function DomainHistoricoTab({ eng }: { eng: Engagement }) {
  const d = eng.domainData!
  const colors: Record<string, string> = { DNS: '#5ad1ff', Content: '#e879f9', SSL: '#EF9F27', Owner: '#1D9E75' }
  return (
    <div className="hud" style={scrollPane}>
      <Panel title="Linha do Tempo">
        {d.history.map((h, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0', borderBottom: i < d.history.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[h.type] ?? '#8a9cff', marginTop: 4, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 3, background: `${colors[h.type] ?? '#8a9cff'}18`, color: colors[h.type] ?? '#8a9cff' }}>{h.type}</span>
                <span style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>{h.date}</span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--htxt)' }}>{h.description}</span>
            </div>
          </div>
        ))}
      </Panel>
    </div>
  )
}

// ─── Infrastructure Tabs ──────────────────────────────────────────────────────

function InfraHostsTab({ eng }: { eng: Engagement }) {
  const d = eng.infraData!
  return (
    <div className="hud" style={scrollPane}>
      <Panel title="Hostnames Identificados no IP">
        <THead cols={['Hostname', 'Tipo', '']} />
        {d.hostnames.map((h, i) => (
          <TabRow key={i}>
            <span style={{ flex: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)' }}>{h}</span>
            <span style={{ flex: 1, fontSize: 10, color: 'var(--txt-3)' }}>{i === 0 ? 'PTR (principal)' : 'Virtual host'}</span>
            <span style={{ flex: 1, fontSize: 10, color: 'var(--up)' }}>Ativo</span>
          </TabRow>
        ))}
      </Panel>
      <Panel title="BGP / Prefixos de Rota">
        {d.bgpPrefixes.map((p, i) => (
          <TabRow key={i}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#5ad1ff' }}>{p}</span>
            <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>{d.org}</span>
            <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>AS{d.asn.replace('AS', '')}</span>
          </TabRow>
        ))}
      </Panel>
      <Panel title="IPs Relacionados / Vizinhos">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {d.relatedIPs.map(ip => (
            <span key={ip} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, padding: '4px 10px', borderRadius: 5, background: 'rgba(255,255,255,.04)', color: 'var(--txt-2)', border: '0.5px solid var(--line)' }}>{ip}</span>
          ))}
        </div>
      </Panel>
    </div>
  )
}

function InfraPortasTab({ eng }: { eng: Engagement }) {
  const d = eng.infraData!
  return (
    <div className="hud" style={scrollPane}>
      <Panel title="Scan de Portas">
        <THead cols={['Porta', 'Proto', 'Serviço', 'Versão', 'Banner / CVE']} />
        {d.openPorts.map((p, i) => (
          <TabRow key={i}>
            <span style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: 'var(--up)' }}>{p.port}</span>
            <span style={{ flex: 1, fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'rgba(90,209,255,.08)', color: '#5ad1ff', display: 'inline-block', height: 'fit-content' }}>{p.protocol}</span>
            <span style={{ flex: 1, fontSize: 11.5, color: 'var(--htxt)' }}>{p.service}</span>
            <span style={{ flex: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--txt-2)' }}>{p.version}</span>
            <span style={{ flex: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: p.cve ? '#e24b4a' : 'var(--txt-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.cve ?? p.banner ?? '—'}
            </span>
          </TabRow>
        ))}
      </Panel>
      {d.openPorts.some(p => p.cve) && (
        <div className="hud">
          <div className="block hot">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="bhead" style={{ color: 'var(--crit)' }}>
              <AlertTriangle size={12} style={{ display: 'inline', marginRight: 6 }} />
              CVEs Detectadas
            </div>
            <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {d.openPorts.filter(p => p.cve).map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 9.5, padding: '2px 6px', borderRadius: 3, background: 'rgba(226,75,74,.2)', color: '#e24b4a', fontFamily: "'JetBrains Mono', monospace" }}>{p.cve}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--htxt)' }}>Porta {p.port} ({p.service})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfraCertificadosTab({ eng }: { eng: Engagement }) {
  const d = eng.infraData!
  return (
    <div className="hud" style={scrollPane}>
      {d.certificates.map((c, i) => (
        <div key={i} className="block">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {c.cn}
            {c.selfSigned && <span style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 3, background: 'rgba(239,159,39,.15)', color: '#f4bc6a' }}>auto-assinado</span>}
          </div>
          <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              ['Common Name', c.cn],
              ['Emissor',     c.issuer],
              ['Válido de',   c.validFrom],
              ['Válido até',  c.validUntil],
            ].map(([k, v]) => (
              <TabRow key={k}>
                <span style={{ color: 'var(--txt-3)', minWidth: 100 }}>{k}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--htxt)' }}>{v}</span>
              </TabRow>
            ))}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 4 }}>SAN (Subject Alternative Names)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {c.domains.map(dom => <span key={dom} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'rgba(255,255,255,.04)', color: 'var(--txt-2)', fontFamily: "'JetBrains Mono', monospace" }}>{dom}</span>)}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function InfraTrafegoTab({ eng }: { eng: Engagement }) {
  const d = eng.infraData!
  return (
    <div className="hud" style={scrollPane}>
      <div className="block">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bhead">Tráfego Estimado (GB)</div>
        <div className="bbody" style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={d.traffic} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgba(127,119,221,.6)" stopOpacity={1} />
                  <stop offset="95%" stopColor="rgba(127,119,221,.0)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgba(90,209,255,.5)" stopOpacity={1} />
                  <stop offset="95%" stopColor="rgba(90,209,255,.0)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--txt-3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--txt-3)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 11 }} formatter={(v: number) => [`${v} GB`]} />
              <Area type="monotone" dataKey="rx" stroke="rgba(127,119,221,.8)" fill="url(#rxGrad)" name="Download (RX)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="tx" stroke="rgba(90,209,255,.8)" fill="url(#txGrad)" name="Upload (TX)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <Panel title="Informações ASN">
        {[
          ['ASN',        d.asn],
          ['Organização', d.org],
          ['ISP',        d.isp],
          ['País',       d.country],
          ['Cidade',     d.city],
        ].map(([k, v]) => (
          <TabRow key={k}>
            <span style={{ color: 'var(--txt-3)', minWidth: 100 }}>{k}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--htxt)' }}>{v}</span>
          </TabRow>
        ))}
      </Panel>
    </div>
  )
}

// ─── Organization Tabs ────────────────────────────────────────────────────────

function OrgPessoasTab({ eng }: { eng: Engagement }) {
  const d = eng.orgData!
  return (
    <div className="hud" style={scrollPane}>
      {d.officers.map((o, i) => (
        <div key={i} className="block">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bbody">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(127,119,221,.15)', border: '1px solid rgba(127,119,221,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#a09ae8', flexShrink: 0 }}>
                {o.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--htxt)' }}>{o.name}</div>
                <div style={{ fontSize: 11, color: '#a09ae8' }}>{o.role}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <TabRow>
                <span style={{ color: 'var(--txt-3)', minWidth: 80 }}>CPF</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{o.cpfMasked}</span>
              </TabRow>
              <TabRow>
                <span style={{ color: 'var(--txt-3)', minWidth: 80 }}>Desde</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{o.since}</span>
              </TabRow>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function OrgDominiosTab({ eng }: { eng: Engagement }) {
  const d = eng.orgData!
  return (
    <div className="hud" style={scrollPane}>
      <Panel title="Ativos Web da Organização">
        <THead cols={['Domínio', 'IP', 'Status', 'Registro']} />
        {d.domains.map((dom, i) => (
          <TabRow key={i}>
            <span style={{ flex: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)' }}>{dom.domain}</span>
            <span style={{ flex: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--txt-2)' }}>{dom.ip}</span>
            <span style={{ flex: 1, fontSize: 11, color: dom.status === 'Ativo' ? 'var(--up)' : 'var(--txt-3)' }}>{dom.status}</span>
            <span style={{ flex: 1, fontSize: 11, color: 'var(--txt-3)' }}>{dom.registeredAt}</span>
          </TabRow>
        ))}
      </Panel>
    </div>
  )
}

function OrgPerfisTab({ eng }: { eng: Engagement }) {
  const d = eng.orgData!
  return (
    <div className="hud" style={scrollPane}>
      <Panel title="Presença em Redes Sociais">
        <THead cols={['Plataforma', 'Handle', 'Seguidores', 'Verificado']} />
        {d.socialLinks.map((s, i) => (
          <TabRow key={i}>
            <span style={{ flex: 1, fontSize: 11, color: 'var(--txt-2)' }}>{s.platform}</span>
            <span style={{ flex: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)' }}>@{s.handle}</span>
            <span style={{ flex: 1, fontSize: 11, color: 'var(--txt-3)' }}>{s.followers.toLocaleString('pt-BR')}</span>
            <span style={{ flex: 1, fontSize: 11, color: s.verified ? 'var(--up)' : 'var(--txt-3)' }}>{s.verified ? '✓ Sim' : '— Não'}</span>
          </TabRow>
        ))}
      </Panel>
    </div>
  )
}

function OrgVazamentosTab({ eng }: { eng: Engagement }) {
  const d = eng.orgData!
  return (
    <div className="hud" style={scrollPane}>
      {d.breaches.map((b, i) => (
        <div key={i} className="block hot">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {b.name}
            <SevTag sev={b.severity} />
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--txt-3)' }}>{b.date}</span>
          </div>
          <div className="bbody">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {b.dataTypes.map(dt => <span key={dt} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,.04)', color: 'var(--txt-2)', border: '0.5px solid var(--line)' }}>{dt}</span>)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Person Tabs ──────────────────────────────────────────────────────────────

function PersonIdentidadeTab({ eng }: { eng: Engagement }) {
  const d = eng.personData!
  return (
    <div className="hud" style={scrollPane}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Panel title="Dados Pessoais">
          {[
            ['Nome',       `${d.firstName} ${d.lastName}`],
            ['CPF',        d.cpfMasked],
            ['Nascimento', d.birthDate],
            ['Sexo',       d.gender === 'M' ? 'Masculino' : 'Feminino'],
          ].map(([k, v]) => (
            <TabRow key={k}>
              <span style={{ color: 'var(--txt-3)', minWidth: 90 }}>{k}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{v}</span>
            </TabRow>
          ))}
        </Panel>
        <Panel title="Telefones">
          {d.phones.map(p => <TabRow key={p}><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{p}</span></TabRow>)}
        </Panel>
      </div>
      <Panel title="Endereços">
        {d.addresses.map((a, i) => (
          <TabRow key={i} style={{ alignItems: 'flex-start' }}>
            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,.04)', color: 'var(--txt-3)', marginRight: 8, flexShrink: 0, marginTop: 2 }}>{a.type}</span>
            <span style={{ flex: 1, fontSize: 11.5, color: 'var(--htxt)' }}>{a.street}, {a.city} — {a.state}</span>
            {a.current && <span style={{ fontSize: 9.5, color: 'var(--up)', flexShrink: 0 }}>atual</span>}
          </TabRow>
        ))}
      </Panel>
      <Panel title="Vínculos Empresariais">
        {d.companies.map((c, i) => <TabRow key={i}><span style={{ fontSize: 12, color: 'var(--htxt)' }}>{c}</span></TabRow>)}
      </Panel>
    </div>
  )
}

function PersonRedesSociaisTab({ eng }: { eng: Engagement }) {
  const d = eng.personData!
  return (
    <div className="hud" style={scrollPane}>
      <Panel title="Perfis Identificados">
        <THead cols={['Plataforma', 'Handle', 'Seguidores', 'Status']} />
        {d.socialLinks.map((s, i) => (
          <TabRow key={i}>
            <span style={{ flex: 1, fontSize: 11, color: 'var(--txt-2)' }}>{s.platform}</span>
            <span style={{ flex: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)' }}>{s.handle}</span>
            <span style={{ flex: 1, fontSize: 11, color: 'var(--txt-3)' }}>{s.followers.toLocaleString('pt-BR')}</span>
            <span style={{ flex: 1, fontSize: 11, color: s.active ? 'var(--up)' : 'var(--txt-3)' }}>{s.active ? 'Ativo' : 'Inativo'}</span>
          </TabRow>
        ))}
      </Panel>
    </div>
  )
}

function PersonEmailsTab({ eng }: { eng: Engagement }) {
  const d = eng.personData!
  return (
    <div className="hud" style={scrollPane}>
      <Panel title="E-mails Identificados">
        <THead cols={['E-mail', 'Fonte', 'Leaks', 'Última vez']} />
        {d.emails.map((e, i) => (
          <TabRow key={i}>
            <span style={{ flex: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)' }}>{e.email}</span>
            <span style={{ flex: 1, fontSize: 11, color: 'var(--txt-3)' }}>{e.source}</span>
            <span style={{ flex: 1, fontSize: 11, color: e.leakCount > 0 ? 'var(--crit)' : 'var(--txt-3)', fontWeight: e.leakCount > 0 ? 700 : 400 }}>{e.leakCount}</span>
            <span style={{ flex: 1, fontSize: 11, color: 'var(--txt-3)' }}>{e.lastSeen}</span>
          </TabRow>
        ))}
      </Panel>
    </div>
  )
}

function PersonVazamentosTab({ eng }: { eng: Engagement }) {
  const d = eng.personData!
  return (
    <div className="hud" style={scrollPane}>
      {d.breaches.map((b, i) => (
        <div key={i} className="block hot">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {b.name}
            <SevTag sev={b.severity} />
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--txt-3)' }}>{b.date}</span>
          </div>
          <div className="bbody">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {b.dataTypes.map(dt => <span key={dt} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,.04)', color: 'var(--txt-2)', border: '0.5px solid var(--line)' }}>{dt}</span>)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Social Profile Tabs ──────────────────────────────────────────────────────

function SocialPerfilTab({ eng }: { eng: Engagement }) {
  const d = eng.socialData!
  const fmtNum = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)
  return (
    <div className="hud" style={scrollPane}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Panel title="Dados do Perfil">
          {[
            ['Plataforma',  d.platform],
            ['Handle',      `@${d.handle}`],
            ['Nome exibido', d.displayName],
            ['Verificado',  d.verified ? 'Sim' : 'Não'],
            ['Criado em',   d.joinedAt],
            ['Seguidores',  fmtNum(d.followers)],
            ['Seguindo',    fmtNum(d.following)],
            ['Publicações', d.totalPosts.toLocaleString('pt-BR')],
            ['Engajamento', `${d.engagementRate}%`],
          ].map(([k, v]) => (
            <TabRow key={k}>
              <span style={{ color: 'var(--txt-3)', minWidth: 100 }}>{k}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--htxt)' }}>{v}</span>
            </TabRow>
          ))}
        </Panel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title="Bio">
            <p style={{ fontSize: 12, color: 'var(--txt-2)', lineHeight: 1.65, fontStyle: 'italic', margin: 0 }}>"{d.bio}"</p>
          </Panel>
          <Panel title="Flags de Risco">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {d.flags.map(f => <span key={f} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: 'rgba(226,75,74,.12)', color: '#e24b4a', border: '1px solid rgba(226,75,74,.25)' }}>{f}</span>)}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function SocialConteudoTab({ eng }: { eng: Engagement }) {
  const d = eng.socialData!
  const [filter, setFilter] = useState<'all' | 'flagged'>('all')
  const posts = filter === 'flagged' ? d.recentPosts.filter(p => p.flagged) : d.recentPosts
  return (
    <div className="hud" style={scrollPane}>
      <div className="block">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bhead" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Publicações</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button className="hbtn" style={{ background: filter === 'all' ? 'rgba(127,119,221,.2)' : undefined, color: filter === 'all' ? '#a09ae8' : undefined }} onClick={() => setFilter('all')}>Todas</button>
            <button className="hbtn" style={{ background: filter === 'flagged' ? 'rgba(226,75,74,.2)' : undefined, color: filter === 'flagged' ? '#e24b4a' : undefined }} onClick={() => setFilter('flagged')}>Flagged</button>
          </div>
        </div>
        <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {posts.map((p, i) => (
            <div key={p.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,.04)', color: 'var(--txt-3)' }}>{p.type}</span>
                {p.flagged && <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'rgba(226,75,74,.15)', color: '#e24b4a' }}>⚑ flagged</span>}
                <span style={{ fontSize: 10, color: 'var(--txt-3)', marginLeft: 'auto' }}>{p.date}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--htxt)', lineHeight: 1.6, marginBottom: 8 }}>{p.text}</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>👍 {p.likes.toLocaleString('pt-BR')}</span>
                <span style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>🔁 {p.shares.toLocaleString('pt-BR')}</span>
                <span style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>💬 {p.comments.toLocaleString('pt-BR')}</span>
              </div>
              {i < posts.length - 1 && <div style={{ height: 1, background: 'var(--line)', marginTop: 12 }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SocialConexoesTab({ eng }: { eng: Engagement }) {
  const d = eng.socialData!
  return (
    <div className="hud" style={scrollPane}>
      <Panel title="Contas Vinculadas">
        <THead cols={['Plataforma', 'Handle', 'Confiança']} />
        {d.linkedAccounts.map((a, i) => (
          <TabRow key={i}>
            <span style={{ flex: 1, fontSize: 11, color: 'var(--txt-2)' }}>{a.platform}</span>
            <span style={{ flex: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)' }}>{a.handle}</span>
            <span style={{ flex: 1, fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: a.confidence === 'Alta' ? 'rgba(29,158,117,.15)' : 'rgba(255,255,255,.04)', color: a.confidence === 'Alta' ? 'var(--up)' : 'var(--txt-3)', display: 'inline-block' }}>{a.confidence}</span>
          </TabRow>
        ))}
      </Panel>
    </div>
  )
}

function SocialAtividadesTab({ eng }: { eng: Engagement }) {
  const d = eng.socialData!
  return (
    <div className="hud" style={scrollPane}>
      <div className="block">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bhead">Atividade por Hora do Dia</div>
        <div className="bbody" style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.activityByHour} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--txt-3)' }} tickFormatter={h => `${h}h`} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--txt-3)' }} />
              <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 11 }} formatter={(v: number) => [v, 'posts']} labelFormatter={h => `${h}:00`} />
              <Bar dataKey="count" fill="rgba(127,119,221,.6)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <Panel title="Distribuição por Tipo de Conteúdo">
        {d.postsByType.map((pt, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11.5, color: 'var(--htxt)' }}>{pt.type}</span>
              <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{pt.count} posts</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)' }}>
              <div style={{ height: '100%', borderRadius: 2, background: pt.color, width: `${Math.round(pt.count / d.totalPosts * 100)}%` }} />
            </div>
          </div>
        ))}
      </Panel>
    </div>
  )
}

// ─── Leak Tabs ────────────────────────────────────────────────────────────────

function LeakRegistrosTab({ eng }: { eng: Engagement }) {
  const d = eng.leakData!
  const [query, setQuery] = useState('')
  const shown = d.sampleCredentials.filter(c => c.email.toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="hud" style={scrollPane}>
      <div className="block">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bhead">Amostra de Registros (mascarado)</div>
        <div style={{ padding: '0 14px 10px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt-3)' }} />
            <input
              type="text" placeholder="Filtrar por e-mail..." value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ width: '100%', padding: '6px 10px 6px 30px', background: 'rgba(255,255,255,.04)', border: '0.5px solid var(--line)', borderRadius: 6, color: 'var(--htxt)', fontSize: 11.5, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>
        <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <THead cols={['E-mail', 'Senha', 'Hash', 'Fonte']} />
          {shown.map((c, i) => (
            <TabRow key={i}>
              <span style={{ flex: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--htxt)' }}>{c.email}</span>
              <span style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--high)' }}>{c.passwordMasked}</span>
              <span style={{ flex: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--txt-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.hash ?? 'plaintext'}</span>
              <span style={{ flex: 1, fontSize: 10.5, color: 'var(--txt-3)' }}>{c.source}</span>
            </TabRow>
          ))}
        </div>
      </div>
    </div>
  )
}

function LeakAnaliseTab({ eng }: { eng: Engagement }) {
  const d = eng.leakData!
  const fmtNum = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)
  return (
    <div className="hud" style={scrollPane}>
      <div className="block">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bhead">Força das Senhas</div>
        <div className="bbody" style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.passwordStrengthDist} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--txt-3)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--txt-3)' }} />
              <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 11 }} formatter={(v: number) => [fmtNum(v), 'Senhas']} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {d.passwordStrengthDist.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <Panel title="Distribuição por Domínio de E-mail">
        {d.domainDist.map((dom, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--htxt)' }}>{dom.domain}</span>
              <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{fmtNum(dom.count)} ({dom.pct}%)</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.06)' }}>
              <div style={{ height: '100%', borderRadius: 3, background: 'rgba(127,119,221,.5)', width: `${dom.pct}%` }} />
            </div>
          </div>
        ))}
      </Panel>
      <Panel title="Campos de Dados Expostos">
        {d.dataFields.map((f, i) => (
          <TabRow key={i}>
            <span style={{ flex: 2, fontSize: 12, color: 'var(--htxt)' }}>{f.label}</span>
            <span style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--txt-2)' }}>{fmtNum(f.count)} registros</span>
          </TabRow>
        ))}
      </Panel>
    </div>
  )
}

function LeakAtribuicaoTab({ eng }: { eng: Engagement }) {
  const d = eng.leakData!
  return (
    <div className="hud" style={scrollPane}>
      <Panel title="Atribuição da Brecha">
        {[
          ['Origem',       d.attributionOrigin],
          ['Ator suspeito', d.attributionActor],
          ['Método',       d.attributionMethod],
          ['Confiança',    d.attributionConfidence],
        ].map(([k, v]) => (
          <TabRow key={k} style={{ alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--txt-3)', minWidth: 110, flexShrink: 0 }}>{k}</span>
            <span style={{ fontSize: 11.5, color: 'var(--htxt)', lineHeight: 1.5 }}>{v}</span>
          </TabRow>
        ))}
      </Panel>
      <Panel title="Brechas Relacionadas">
        {d.relatedLeaks.map((rl, i) => (
          <TabRow key={i}>
            <span style={{ fontSize: 12, color: 'var(--txt-2)' }}>· {rl}</span>
          </TabRow>
        ))}
      </Panel>
    </div>
  )
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function TypeTabContent({ tab, engagement }: { tab: string; engagement: Engagement }) {
  const t = engagement.type

  if (tab === 'Evidências') return <EvidencePanel engagement={engagement} />
  if (tab === 'Relatório')  return <ReportPanel operationId={engagement.operationId} />

  // Domain
  if (t === 'domain') {
    if (tab === 'DNS')           return <DomainDnsTab eng={engagement} />
    if (tab === 'Whois')         return <DomainWhoisTab eng={engagement} />
    if (tab === 'Infraestrutura') return <DomainInfraTab eng={engagement} />
    if (tab === 'Histórico')     return <DomainHistoricoTab eng={engagement} />
  }

  // Infrastructure
  if (t === 'infrastructure') {
    if (tab === 'Hosts')        return <InfraHostsTab eng={engagement} />
    if (tab === 'Portas')       return <InfraPortasTab eng={engagement} />
    if (tab === 'Certificados') return <InfraCertificadosTab eng={engagement} />
    if (tab === 'Tráfego')      return <InfraTrafegoTab eng={engagement} />
  }

  // Organization
  if (t === 'organization') {
    if (tab === 'Pessoas')    return <OrgPessoasTab eng={engagement} />
    if (tab === 'Domínios')   return <OrgDominiosTab eng={engagement} />
    if (tab === 'Perfis')     return <OrgPerfisTab eng={engagement} />
    if (tab === 'Vazamentos') return <OrgVazamentosTab eng={engagement} />
  }

  // Person
  if (t === 'person') {
    if (tab === 'Identidade')     return <PersonIdentidadeTab eng={engagement} />
    if (tab === 'Redes Sociais')  return <PersonRedesSociaisTab eng={engagement} />
    if (tab === 'E-mails')        return <PersonEmailsTab eng={engagement} />
    if (tab === 'Vazamentos')     return <PersonVazamentosTab eng={engagement} />
  }

  // Social Profile
  if (t === 'social_profile') {
    if (tab === 'Perfil')     return <SocialPerfilTab eng={engagement} />
    if (tab === 'Conteúdo')   return <SocialConteudoTab eng={engagement} />
    if (tab === 'Conexões')   return <SocialConexoesTab eng={engagement} />
    if (tab === 'Atividades') return <SocialAtividadesTab eng={engagement} />
  }

  // Leak
  if (t === 'leak') {
    if (tab === 'Registros')  return <LeakRegistrosTab eng={engagement} />
    if (tab === 'Análise')    return <LeakAnaliseTab eng={engagement} />
    if (tab === 'Atribuição') return <LeakAtribuicaoTab eng={engagement} />
  }

  return (
    <div className="hud" style={{ ...scrollPane, alignItems: 'center', justifyContent: 'center', color: 'var(--txt-3)' }}>
      Conteúdo da aba "{tab}" em desenvolvimento.
    </div>
  )
}
