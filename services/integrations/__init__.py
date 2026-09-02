"""CashNet Integration Services

Provides connectors for external partners (SAHYOG, NCRP, VASPs, banks),
approval workflows, partner tracking, and escalation management.
"""
from .base import IntegrationAdapter, IntegrationStatus, IntegrationType
from .sahyog import SAHYOGConnector
from .ncrp import NCRPConnector
from .vasp import VASPConnector
from .approval import ApprovalWorkflow, ApprovalRequest, ApprovalStatus
from .tracking import PartnerTracker, TrackingRecord, TrackingStatus
from .escalation import EscalationManager, SLADefinition, SLAStatus

__all__ = [
    # Base
    "IntegrationAdapter",
    "IntegrationStatus",
    "IntegrationType",
    
    # Connectors
    "SAHYOGConnector",
    "NCRPConnector",
    "VASPConnector",
    
    # Approval
    "ApprovalWorkflow",
    "ApprovalRequest",
    "ApprovalStatus",
    
    # Tracking
    "PartnerTracker",
    "TrackingRecord",
    "TrackingStatus",
    
    # Escalation
    "EscalationManager",
    "SLADefinition",
    "SLAStatus",
]
