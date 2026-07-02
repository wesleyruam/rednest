// Shims p/ os *-proxy-agent (ESM-only, sem main/types): a resolução clássica do
// tsconfig não enxerga o `exports`. No runtime, Node 26 faz require() do ESM.
declare module 'http-proxy-agent' {
  import { Agent } from 'node:http';
  export class HttpProxyAgent extends Agent {
    constructor(uri: string, opts?: Record<string, unknown>);
  }
}
declare module 'https-proxy-agent' {
  import { Agent } from 'node:http';
  export class HttpsProxyAgent extends Agent {
    constructor(uri: string, opts?: Record<string, unknown>);
  }
}
declare module 'socks-proxy-agent' {
  import { Agent } from 'node:http';
  export class SocksProxyAgent extends Agent {
    constructor(uri: string, opts?: Record<string, unknown>);
  }
}
