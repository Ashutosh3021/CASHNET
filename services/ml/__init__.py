"""CashNet ML & Intelligence Services.

Provides typology detection, model governance, validation pipelines,
training pipelines, and advanced fraud detection capabilities.
"""
from .enhanced_bridge import (
    BridgePattern,
    BridgeProtocol,
    EnhancedBridgeDetector,
    SwapPattern,
    SwapProtocol,
)
from .intelligence_sharing import (
    AccessLogEntry,
    Agency,
    ClassificationLevel,
    CrossAgencySharingService,
    IntelligencePackage,
    IntelligenceRecord,
    RedactionAction,
    RedactionRule,
    ShareStatus,
    SharingPolicy,
    SharingScope,
)
from .mixer_detection import (
    MixerDetector,
    MixerRiskLevel,
    MixerSignal,
    MixerType,
)
from .model_registry import (
    DeploymentStage,
    ModelArtifact,
    ModelRegistry,
    ModelStatus,
    ModelType,
    ModelVersion,
)
from .model_validation import (
    ModelValidationPipeline,
    ValidationMetric,
    ValidationReport,
    ValidationStatus,
)
from .notifications import (
    AlertRule,
    AlertType,
    DeliveryProvider,
    DeliveryStatus,
    MessageChannel,
    RealtimeNotification,
    RealtimeNotificationService,
    Recipient,
    format_notification_for_slack,
)
from .training import (
    DatasetSplit,
    DataType,
    TrainingConfig,
    TrainingPipeline,
    TrainingRun,
    TrainingStatus,
)
from .typology import (
    MatchSeverity,
    TypologyCategory,
    TypologyEngine,
    TypologyMatch,
    TypologyRule,
)

__all__ = [
    # Typology
    "TypologyEngine",
    "TypologyRule",
    "TypologyMatch",
    "TypologyCategory",
    "MatchSeverity",
    
    # Model Registry
    "ModelRegistry",
    "ModelVersion",
    "ModelArtifact",
    "ModelStatus",
    "DeploymentStage",
    "ModelType",
    
    # Model Validation
    "ModelValidationPipeline",
    "ValidationReport",
    "ValidationMetric",
    "ValidationStatus",
    
    # Training
    "TrainingPipeline",
    "TrainingConfig",
    "TrainingRun",
    "TrainingStatus",
    "DatasetSplit",
    "DataType",
    
    # Mixer Detection
    "MixerDetector",
    "MixerSignal",
    "MixerType",
    "MixerRiskLevel",
    
    # Enhanced Bridge/Swap
    "EnhancedBridgeDetector",
    "BridgePattern",
    "SwapPattern",
    "BridgeProtocol",
    "SwapProtocol",
    
    # Real-time Notifications
    "RealtimeNotificationService",
    "Recipient",
    "AlertRule",
    "DeliveryProvider",
    "RealtimeNotification",
    "AlertType",
    "MessageChannel",
    "DeliveryStatus",
    
    # Cross-Agency Intelligence Sharing
    "CrossAgencySharingService",
    "SharingPolicy",
    "RedactionRule",
    "IntelligencePackage",
    "Agency",
    "AccessLogEntry",
    "IntelligenceRecord",
    "SharingScope",
    "ClassificationLevel",
    "ShareStatus",
]
