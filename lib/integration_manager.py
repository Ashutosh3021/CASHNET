"""Integration manager for CASHNET.

Manages NCRP, SAHYOG, and VASP connectors.
NCRP and SAHYOG are NEVER connected without authorized credentials.
"""

from __future__ import annotations

import logging
from typing import Any

from lib.integration_config import IntegrationConfig

logger = logging.getLogger(__name__)


class IntegrationManager:
    def __init__(self):
        self.config = IntegrationConfig()
        self.connectors: dict[str, Any] = {}

        if self.config.ncrp.enabled:
            self.connectors["ncrp"] = self.config.ncrp
        if self.config.sahyog.enabled:
            self.connectors["sahyog"] = self.config.sahyog
        if self.config.vasp.enabled:
            self.connectors["vasp"] = self.config.vasp

    def health_check(self) -> dict[str, Any]:
        results = []

        # NCRP status
        results.append(
            {
                "name": "ncrp",
                "enabled": self.config.ncrp.enabled,
                "connected": False,
                "status": (
                    "NOT_CONNECTED" if self.config.ncrp.enabled else "NOT_CONFIGURED"
                ),
                "requires_authorization": True,
                "message": "NCRP requires authorized API access. Not connected.",
            }
        )

        # SAHYOG status
        results.append(
            {
                "name": "sahyog",
                "enabled": self.config.sahyog.enabled,
                "connected": False,
                "status": (
                    "NOT_CONNECTED" if self.config.sahyog.enabled else "NOT_CONFIGURED"
                ),
                "requires_authorization": True,
                "message": "SAHYOG requires authorized API access. Not connected.",
            }
        )

        # VASP status
        vasp_connected = self.config.vasp.enabled and bool(self.config.vasp.api_url)
        results.append(
            {
                "name": "vasp",
                "enabled": self.config.vasp.enabled,
                "connected": vasp_connected,
                "status": "CONFIGURED" if vasp_connected else "NOT_CONFIGURED",
                "requires_authorization": False,
                "message": "VASP provider" if vasp_connected else "VASP not configured",
            }
        )

        return {"integrations": results}

    def submit_case_sync(
        self, system_name: str, case_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Synchronous case submission (for testing)."""
        if system_name in ("ncrp", "sahyog"):
            return {
                "status": "error",
                "systemName": system_name,
                "error": f"{system_name.upper()} integration is not available. Authorized API access is required but not configured.",
            }

        if system_name not in self.connectors:
            return {
                "status": "error",
                "systemName": system_name,
                "error": f"Integration {system_name} not available. No external ID has been generated.",
            }

        # No real external submission is possible without authorized API access
        return {
            "status": "error",
            "systemName": system_name,
            "error": f"{system_name.upper()} integration is not available. Authorized API access is required but not configured. No external ID has been generated.",
        }

    def get_enabled_connectors(self) -> list[str]:
        return list(self.connectors.keys())
