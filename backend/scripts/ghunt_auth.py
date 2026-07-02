#!/usr/bin/env python3
"""
Login não-interativo do GHunt a partir do base64 do Companion.
Replica ghunt/modules/login.py (opção [2]) sem o menu/PTY:
  base64 -> JSON -> oauth_token -> android_master_auth -> gen_cookies_and_osids -> save_creds
Lê o base64 do stdin e imprime uma linha JSON: {"ok": bool, "email"?, "name"?, "error"?}.
"""
import asyncio
import base64
import json
import sys


async def main():
    b64 = sys.stdin.read().strip()
    try:
        from ghunt.objects.base import GHuntCreds
        from ghunt.helpers import auth
        from ghunt.helpers.utils import get_httpx_client
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": f"GHunt indisponível: {e}"}))
        return

    try:
        data = json.loads(base64.b64decode(b64))
        oauth_token = data["oauth_token"]
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": f"base64 inválido: {e}"}))
        return

    as_client = get_httpx_client()
    try:
        creds = GHuntCreds()
        master_token, services, owner_email, owner_name = await auth.android_master_auth(as_client, oauth_token)
        creds.android.master_token = master_token
        creds.cookies = {"a": "a"}  # placeholders (igual ao login.py)
        creds.osids = {"a": "a"}
        await auth.gen_cookies_and_osids(as_client, creds)
        creds.save_creds(silent=True)
        print(json.dumps({"ok": True, "email": owner_email, "name": owner_name}))
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(e)}))
    finally:
        try:
            await as_client.aclose()
        except Exception:  # noqa: BLE001
            pass


asyncio.run(main())
