"""Integration configuration for CASHNET.

Loads NCRP/SAHYOG/VASP configuration from environment variables.
NCRP and SAHYOG are never enabled without proper credentials.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class ConnectorConfig:
    enabled: bool
    api_url: str
    api_key: str
    timeout: int
    org_id: str | None = None
    client_id: str | None = None


def _load_connector(prefix: str) -> ConnectorConfig:
    enabled = os.environ.get(f"{prefix}_ENABLED", "").lower() == "true"
    api_url = os.environ.get(f"{prefix}_API_URL", "")
    api_key = os.environ.get(f"{prefix}_API_KEY", "")
    timeout = int(os.environ.get(f"{prefix}_TIMEOUT", "30"))

    # Only enable if ALL required fields are present
    actually_enabled = enabled and bool(api_url) and bool(api_key)

    return ConnectorConfig(
        enabled=actually_enabled,
        api_url=api_url,
        api_key=api_key,
        timeout=max(1, min(300, timeout)),
        org_id=os.environ.get(f"{prefix}_ORG_ID"),
        client_id=os.environ.get(f"{prefix}_CLIENT_ID"),
    )


class IntegrationConfig:
    def __init__(self):
        self.ncrp = _load_connector("NCRP")
        self.sahyog = _load_connector("SAHYOG")
        self.vasp = _load_connector("VASP")
