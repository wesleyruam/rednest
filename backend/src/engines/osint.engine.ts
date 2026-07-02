import { Injectable } from '@nestjs/common';
import { GoogleIntelligenceService } from '../integrations/google-intel.service';
import { OsintService } from '../integrations/osint.service';
import { UsernameIntelService } from '../integrations/username-intel.service';
import { WhatsMyNameService, WmnProgress } from '../integrations/whatsmyname.service';

/** OSINT Engine — e-mails, usernames, pessoas: Hunter, Gravatar, Leak-Lookup, COMB, WhatsMyName, Username + Google Intelligence. */
@Injectable()
export class OsintEngine {
  constructor(
    private readonly osint: OsintService,
    private readonly wmn: WhatsMyNameService,
    private readonly usernameIntel: UsernameIntelService,
    private readonly googleIntel: GoogleIntelligenceService,
  ) {}

  /** Username Intelligence enriquecido (GitHub/GitLab). */
  userIntel(handle: string) {
    return this.usernameIntel.enrich(handle);
  }

  /** Google Intelligence (GHunt interno) — perfil Google de um e-mail. */
  googleEmail(email: string) {
    return this.googleIntel.email(email);
  }

  gravatar(email: string) {
    return this.osint.gravatar(email);
  }
  hunterEmail(email: string) {
    return this.osint.hunterEmail(email);
  }
  hunterDomain(domain: string) {
    return this.osint.hunterDomain(domain);
  }
  leaklookup(query: string, type = 'email_address') {
    return this.osint.leaklookup(query, type);
  }
  comb(query: string) {
    return this.osint.comb(query);
  }
  whatsmyname(handle: string, opts: { onProgress?: (p: WmnProgress) => void } = {}) {
    return this.wmn.check(handle, opts);
  }
}
