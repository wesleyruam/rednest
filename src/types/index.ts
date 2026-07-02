// ─── Operations ──────────────────────────────────────────────────────────────

export type OperationStatus = 'active' | 'paused' | 'completed' | 'archived'
export type OperationPriority = 'critical' | 'high' | 'medium' | 'low'

export interface Operation {
  id: string
  name: string
  description: string
  status: OperationStatus
  priority: OperationPriority
  tags: string[]
  createdAt: string
  updatedAt: string
  engagementCount: number
  iocCount: number
  evidenceCount: number
  progress: number
  alertCount: number
  reportCount: number
}

// ─── Engagements ─────────────────────────────────────────────────────────────

export type EngagementType =
  | 'osint'
  | 'domain'
  | 'website'
  | 'infrastructure'
  | 'organization'
  | 'person'
  | 'social_profile'
  | 'leak'

export type EngagementStatus = 'active' | 'paused' | 'completed'

export interface Engagement {
  id: string
  operationId: string
  name: string
  target: string
  type: EngagementType
  status: EngagementStatus
  tags: string[]
  createdAt: string
  updatedAt: string
  iocCount: number
  evidenceCount: number
  osintData?:  OsintEngagementData
  webData?:    WebEngagementData
  domainData?: DomainEngagementData
  infraData?:  InfraEngagementData
  personData?: PersonEngagementData
  orgData?:    OrgEngagementData
  socialData?: SocialEngagementData
  leakData?:   LeakEngagementData
}

// ─── OSINT Engagement Data ────────────────────────────────────────────────────

export interface OsintStats {
  queries: number
  indicators: number
  domains: number
  emails: number
  profiles: number
  leaks: number
  artifacts: number
  notes: number
  evidences: number
}

export interface OsintRelationNode {
  id: string
  type: 'domain' | 'email' | 'ip' | 'profile' | 'target'
  label: string
  platform?: string
}

export interface OsintRelationEdge {
  source: string
  target: string
  type: 'direct' | 'indirect'
  label?: string
}

export interface OsintIndicator {
  id: string
  value: string
  type: string
  confidence: 'Alta' | 'Média' | 'Baixa'
}

export interface OsintActivityItem {
  id: string
  time: string
  icon: string
  text: string
  tag: string
  tagColor: string
}

export interface OsintLeak {
  id: string
  name: string
  date: string
  source: string
  hits: number
}

export interface OsintDomain {
  id: string
  domain: string
  registeredAt: string
  status: 'Ativo' | 'Inativo'
}

export interface OsintProfile {
  id: string
  handle: string
  network: string
  relevance: 'Alta' | 'Média' | 'Baixa'
}

export interface OsintEngagementData {
  stats: OsintStats
  nodes: OsintRelationNode[]
  edges: OsintRelationEdge[]
  indicators: OsintIndicator[]
  recentActivities: OsintActivityItem[]
  leaks: OsintLeak[]
  domains: OsintDomain[]
  profiles: OsintProfile[]
  wordcloud: Array<{ word: string; weight: number }>
  tags: string[]
  progress: number
  nextActions: string[]
}

// ─── Web Engagement Data ──────────────────────────────────────────────────────

export interface WebStats {
  urls: number
  pages: number
  resources: number
  subdomains: number
  endpoints: number
  params: number
  technologies: number
  riskScore: number
  riskLevel: 'Baixo' | 'Médio' | 'Alto' | 'Crítico'
}

export interface WebSiteInfo {
  domain: string
  ip: string
  provider: string
  asn: string
  country: string
  server: string
  cms: string
  language: string
  firstSeen: string
  lastCollected: string
  screenshotUrl?: string
}

export interface WebTechnology {
  name: string
  percentage: number
  color: string
}

export interface WebSubdomain {
  subdomain: string
  ip: string
  status: 'Ativo' | 'Inativo'
  discoveredAt: string
}

export interface WebPort {
  port: number
  service: string
  protocol: string
  status: 'Aberta' | 'Fechada' | 'Filtrada'
}

export interface WebHeader {
  key: string
  value: string
}

export interface WebSsl {
  valid: boolean
  issuer: string
  issuedTo: string
  validFrom: string
  validUntil: string
  tls: string
}

export interface WebTrafficPoint {
  month: string
  visits: number
}

export interface WebCountry {
  flag: string
  country: string
  percentage: number
}

export interface WebChange {
  time: string
  description: string
  tag: string
  tagColor: string
}

export interface WebRisk {
  description: string
  severity: 'Baixo' | 'Médio' | 'Alto' | 'Crítico'
}

export interface WebContentDistribution {
  type: string
  percentage: number
  color: string
}

export interface WebEngagementData {
  stats: WebStats
  site: WebSiteInfo
  technologies: WebTechnology[]
  contentDistribution: WebContentDistribution[]
  subdomains: WebSubdomain[]
  ports: WebPort[]
  headers: WebHeader[]
  ssl: WebSsl
  traffic: WebTrafficPoint[]
  trafficTotal: string
  trafficGrowth: number
  countries: WebCountry[]
  recentChanges: WebChange[]
  risks: WebRisk[]
  tags: string[]
}

// ─── IOCs ─────────────────────────────────────────────────────────────────────

export type IOCType =
  | 'domain' | 'ip' | 'email' | 'url'
  | 'hash_md5' | 'hash_sha1' | 'hash_sha256'
  | 'username' | 'phone' | 'cve' | 'wallet' | 'asn'

export type IOCThreatLevel = 'critical' | 'high' | 'medium' | 'low' | 'informational'

export interface IOC {
  id: string
  value: string
  type: IOCType
  threatLevel: IOCThreatLevel
  tags: string[]
  operationId: string
  engagementId?: string
  firstSeen: string
  lastSeen: string
  description: string
  source: string
  relatedCount: number
}

// ─── Events ───────────────────────────────────────────────────────────────────

export type EventType =
  | 'ioc_added' | 'evidence_collected' | 'domain_found'
  | 'profile_found' | 'leak_found' | 'alert_triggered'
  | 'operation_created' | 'engagement_created'
  | 'note_added' | 'monitoring_alert'
  | 'engine_started' | 'engine_finished' | 'engine_failed'
  | 'asset_found' | 'correlation'

export interface TimelineEvent {
  id: string
  type: EventType
  title: string
  description: string
  operationId: string
  engagementId?: string
  timestamp: string
  severity?: IOCThreatLevel
  engine?: string | null
  category?: string | null
  icon?: string | null
  details?: any
}

// ─── Monitoring ───────────────────────────────────────────────────────────────

export type MonitoringStatus = 'active' | 'paused' | 'error'
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface Alert {
  id: string
  monitorId: string
  title: string
  description: string
  severity: AlertSeverity
  timestamp: string
  acknowledged: boolean
  operationId: string
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface PlatformStats {
  operations: number
  activeOperations: number
  engagements: number
  targetsMonitored: number
  activeAlerts: number
  reports: number
}

// ─── Domain Engagement Data ───────────────────────────────────────────────────

export interface DomainDnsRecord {
  type: string
  name: string
  value: string
  ttl: number
  priority?: number
}

export interface DomainSubdomain {
  name: string
  ip: string
  httpStatus: number
  type: string
  source: string
}

export interface DomainHistoryEntry {
  date: string
  type: 'DNS' | 'Content' | 'Owner' | 'SSL'
  description: string
}

export interface DomainEngagementData {
  domain: string
  registrar: string
  registrantOrg: string
  registrantCountry: string
  createdAt: string
  updatedAt: string
  expiresAt: string
  status: string[]
  nameServers: string[]
  dnsRecords: DomainDnsRecord[]
  subdomains: DomainSubdomain[]
  ssl: { valid: boolean; issuer: string; validUntil: string; tls: string }
  history: DomainHistoryEntry[]
  reputation: number
  categories: string[]
  tags: string[]
  riskScore: number
  riskLevel: 'Baixo' | 'Médio' | 'Alto' | 'Crítico'
}

// ─── Infrastructure Engagement Data ──────────────────────────────────────────

export interface InfraPort {
  port: number
  protocol: string
  service: string
  version: string
  banner: string
  cve?: string
}

export interface InfraCert {
  cn: string
  issuer: string
  validFrom: string
  validUntil: string
  domains: string[]
  selfSigned: boolean
}

export interface InfraTrafficPoint {
  date: string
  rx: number
  tx: number
}

export interface InfraEngagementData {
  ip: string
  hostname: string
  asn: string
  org: string
  country: string
  city: string
  isp: string
  abuseScore: number
  abuseReports: number
  firstSeen: string
  lastSeen: string
  hostnames: string[]
  openPorts: InfraPort[]
  certificates: InfraCert[]
  bgpPrefixes: string[]
  tags: string[]
  riskScore: number
  riskLevel: 'Baixo' | 'Médio' | 'Alto' | 'Crítico'
  relatedIPs: string[]
  traffic: InfraTrafficPoint[]
}

// ─── Person Engagement Data ───────────────────────────────────────────────────

export interface PersonEmail {
  email: string
  source: string
  leakCount: number
  lastSeen: string
}

export interface PersonAddress {
  street: string
  city: string
  state: string
  type: string
  current: boolean
}

export interface PersonSocialLink {
  platform: string
  handle: string
  followers: number
  active: boolean
}

export interface PersonBreachEntry {
  name: string
  date: string
  dataTypes: string[]
  severity: 'Crítico' | 'Alto' | 'Médio' | 'Baixo'
}

export interface PersonRelative {
  name: string
  relationship: string
  confidence: 'Alta' | 'Média' | 'Baixa'
}

export interface PersonEngagementData {
  firstName: string
  lastName: string
  cpfMasked: string
  birthDate: string
  gender: 'M' | 'F'
  phones: string[]
  emails: PersonEmail[]
  addresses: PersonAddress[]
  socialLinks: PersonSocialLink[]
  breaches: PersonBreachEntry[]
  relatives: PersonRelative[]
  companies: string[]
  riskScore: number
  riskLevel: 'Baixo' | 'Médio' | 'Alto' | 'Crítico'
  tags: string[]
}

// ─── Organization Engagement Data ─────────────────────────────────────────────

export interface OrgOfficer {
  name: string
  role: string
  cpfMasked: string
  since: string
}

export interface OrgDomainEntry {
  domain: string
  status: string
  registeredAt: string
  ip: string
}

export interface OrgSocialLink {
  platform: string
  handle: string
  followers: number
  verified: boolean
}

export interface OrgEngagementData {
  name: string
  cnpj: string
  type: string
  status: string
  founded: string
  capital: string
  city: string
  state: string
  activity: string
  officers: OrgOfficer[]
  phones: string[]
  emails: string[]
  domains: OrgDomainEntry[]
  socialLinks: OrgSocialLink[]
  breaches: PersonBreachEntry[]
  riskScore: number
  riskLevel: 'Baixo' | 'Médio' | 'Alto' | 'Crítico'
  tags: string[]
}

// ─── Social Profile Engagement Data ──────────────────────────────────────────

export interface SocialPost {
  id: string
  text: string
  date: string
  likes: number
  shares: number
  comments: number
  type: 'text' | 'image' | 'video' | 'link'
  flagged: boolean
}

export interface SocialLinkedAccount {
  platform: string
  handle: string
  confidence: 'Alta' | 'Média' | 'Baixa'
}

export interface SocialEngagementData {
  platform: string
  handle: string
  displayName: string
  bio: string
  verified: boolean
  followers: number
  following: number
  totalPosts: number
  joinedAt: string
  profileUrl: string
  engagementRate: number
  recentPosts: SocialPost[]
  linkedAccounts: SocialLinkedAccount[]
  postsByType: Array<{ type: string; count: number; color: string }>
  activityByHour: Array<{ hour: number; count: number }>
  riskScore: number
  riskLevel: 'Baixo' | 'Médio' | 'Alto' | 'Crítico'
  flags: string[]
  tags: string[]
}

// ─── Leak Engagement Data ─────────────────────────────────────────────────────

export interface LeakCredential {
  email: string
  passwordMasked: string
  hash: string | null
  source: string
}

export interface LeakDataField {
  label: string
  count: number
  icon: string
}

export interface LeakEngagementData {
  name: string
  breachDate: string
  discoveredAt: string
  source: string
  description: string
  totalRecords: number
  totalEmails: number
  totalPasswords: number
  dataFields: LeakDataField[]
  severity: 'Crítico' | 'Alto' | 'Médio' | 'Baixo'
  verified: boolean
  sampleCredentials: LeakCredential[]
  passwordStrengthDist: Array<{ label: string; count: number; color: string }>
  domainDist: Array<{ domain: string; count: number; pct: number }>
  attributionOrigin: string
  attributionActor: string
  attributionMethod: string
  attributionConfidence: string
  relatedLeaks: string[]
  riskLevel: 'Baixo' | 'Médio' | 'Alto' | 'Crítico'
  tags: string[]
}
