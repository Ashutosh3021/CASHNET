"""CashNet Blockchain Services

Provides chain adapters, transaction normalization, graph database integration,
bridge event detection, attribution, evidence, and timeline for cross-chain transactions.
"""
from .attribution import (
    AddressCluster,
    AdjudicationEngine,
    AdjudicationRecord,
    AttributionStatus,
    ConfidenceFactor,
    ConfidenceScorer,
    EntityRiskCategory,
    KnownAddress,
    VASPAttributionService,
    VASPCandidate,
    VersionedRegistry,
)
from .base import ChainAdapter, ChainType, NormalizedTransaction
from .bitcoin import BitcoinAdapter
from .bnb import BNBAdapter
from .bridge import BridgeDetector, BridgeEvent, BridgeType
from .ethereum import EthereumAdapter
from .evidence import (
    EvidenceItem,
    EvidencePackage,
    EvidenceService,
    ItemType,
    PackageType,
    ReportFormat,
    VerificationStatus,
)
from .graph import GraphService
from .monitoring import ChainMonitor, MetricsCollector
from .normalizer import TransactionNormalizer
from .pathfinder import PathConstraints, PathFinder, TransactionGraph
from .polygon import PolygonAdapter
from .solana import SolanaAdapter
from .timeline import (
    TimelineEvent,
    TimelineEventType,
    TimelineFilter,
    TimelineService,
    TimelineSummary,
    format_timeline_event,
)
from .tron import TronAdapter

__all__ = [
    # Base
    "ChainAdapter",
    "ChainType",
    "NormalizedTransaction",
    
    # Chain Adapters
    "EthereumAdapter",
    "BitcoinAdapter",
    "TronAdapter",
    "BNBAdapter",
    "SolanaAdapter",
    "PolygonAdapter",
    
    # Services
    "TransactionNormalizer",
    "GraphService",
    "PathFinder",
    "PathConstraints",
    "TransactionGraph",
    
    # Monitoring
    "ChainMonitor",
    "MetricsCollector",
    
    # Bridge Detection
    "BridgeDetector",
    "BridgeEvent",
    "BridgeType",
    
    # Attribution
    "VASPAttributionService",
    "VersionedRegistry",
    "ConfidenceScorer",
    "AdjudicationEngine",
    "KnownAddress",
    "AddressCluster",
    "VASPCandidate",
    "AdjudicationRecord",
    "EntityRiskCategory",
    "AttributionStatus",
    "ConfidenceFactor",
    
    # Evidence
    "EvidenceService",
    "EvidencePackage",
    "EvidenceItem",
    "PackageType",
    "ItemType",
    "VerificationStatus",
    "ReportFormat",
    
    # Timeline
    "TimelineService",
    "TimelineEvent",
    "TimelineFilter",
    "TimelineSummary",
    "TimelineEventType",
    "format_timeline_event",
]


def get_adapter(chain: ChainType, config: dict) -> ChainAdapter:
    """Factory function to get the appropriate chain adapter."""
    adapters = {
        ChainType.ETHEREUM: EthereumAdapter,
        ChainType.BITCOIN: BitcoinAdapter,
        ChainType.TRON: TronAdapter,
        ChainType.BNB: BNBAdapter,
        ChainType.SOLANA: SolanaAdapter,
        ChainType.POLYGON: PolygonAdapter,
    }
    
    adapter_class = adapters.get(chain)
    if not adapter_class:
        raise ValueError(f"No adapter available for chain: {chain}")
    
    return adapter_class(config)
