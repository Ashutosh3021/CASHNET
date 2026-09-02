"""Base chain adapter interface for all blockchain integrations.

Defines the common interface that all chain adapters must implement.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ChainType(str, Enum):
    """Supported blockchain types."""
    ETHEREUM = "ethereum"
    BITCOIN = "bitcoin"
    TRON = "tron"
    BNB = "bnb"
    SOLANA = "solana"
    POLYGON = "polygon"


class TransactionType(str, Enum):
    """Normalized transaction types."""
    TRANSFER = "transfer"
    SWAP = "swap"
    BRIDGE = "bridge"
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    CONTRACT_INTERACTION = "contract_interaction"
    UNKNOWN = "unknown"


class AddressType(str, Enum):
    """Address classification types."""
    EOA = "eoa"  # Externally Owned Account
    CONTRACT = "contract"
    EXCHANGE = "exchange"
    MIXER = "mixer"
    UNKNOWN = "unknown"


class NormalizedTransaction(BaseModel):
    """Normalized transaction format across all chains."""
    # Unique identifiers
    tx_hash: str
    chain: ChainType
    block_number: int
    block_timestamp: datetime
    
    # Addresses
    from_address: str
    from_address_type: AddressType = AddressType.UNKNOWN
    to_address: str
    to_address_type: AddressType = AddressType.UNKNOWN
    
    # Value
    value: float
    currency: str
    value_usd: Optional[float] = None
    
    # Gas/Fees
    gas_price: Optional[float] = None
    gas_used: Optional[int] = None
    fee: Optional[float] = None
    
    # Transaction metadata
    transaction_type: TransactionType = TransactionType.TRANSFER
    is_success: bool = True
    error_message: Optional[str] = None
    
    # Token transfers (if applicable)
    token_address: Optional[str] = None
    token_symbol: Optional[str] = None
    token_decimals: Optional[int] = None
    
    # Additional metadata
    method_id: Optional[str] = None  # Contract method called
    input_data: Optional[str] = None
    
    # Risk indicators
    is_suspicious: bool = False
    risk_score: Optional[float] = None
    
    class Config:
        use_enum_values = True


class ChainHealth(BaseModel):
    """Chain health status."""
    chain: ChainType
    is_healthy: bool
    block_height: int
    block_timestamp: datetime
    sync_status: str  # "synced", "syncing", "stale"
    lag_seconds: int  # Seconds behind latest block
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    error_message: Optional[str] = None


class ChainAdapter(ABC):
    """Abstract base class for chain adapters."""
    
    def __init__(self, config: dict[str, Any]):
        self.config = config
        self._chain_type: ChainType
    
    @property
    def chain_type(self) -> ChainType:
        """Get the chain type."""
        return self._chain_type
    
    @abstractmethod
    async def connect(self) -> bool:
        """Connect to the blockchain node/API."""
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """Disconnect from the blockchain."""
        pass
    
    @abstractmethod
    async def get_chain_health(self) -> ChainHealth:
        """Get current chain health status."""
        pass
    
    @abstractmethod
    async def get_transaction(self, tx_hash: str) -> Optional[NormalizedTransaction]:
        """Get a single transaction by hash."""
        pass
    
    @abstractmethod
    async def get_transactions_by_address(
        self,
        address: str,
        start_block: int = 0,
        end_block: int = -1,
        limit: int = 100,
    ) -> list[NormalizedTransaction]:
        """Get transactions for a specific address."""
        pass
    
    @abstractmethod
    async def get_transactions_by_block(
        self,
        block_number: int,
    ) -> list[NormalizedTransaction]:
        """Get all transactions in a block."""
        pass
    
    @abstractmethod
    async def get_address_info(self, address: str) -> dict[str, Any]:
        """Get information about an address (balance, type, etc.)."""
        pass
    
    @abstractmethod
    async def get_token_transfers(
        self,
        token_address: str,
        from_address: Optional[str] = None,
        to_address: Optional[str] = None,
        start_block: int = 0,
        limit: int = 100,
    ) -> list[NormalizedTransaction]:
        """Get token transfers for a specific token."""
        pass
    
    @abstractmethod
    async def trace_transaction(self, tx_hash: str) -> list[dict[str, Any]]:
        """Trace internal transactions (for debugging/analysis)."""
        pass
    
    @abstractmethod
    async def get_block_number(self) -> int:
        """Get the latest block number."""
        pass
    
    @abstractmethod
    async def get_block_by_number(self, block_number: int) -> dict[str, Any]:
        """Get block details by number."""
        pass
    
    async def normalize_address(self, address: str) -> str:
        """Normalize address format (e.g., checksum for Ethereum)."""
        return address.lower()
    
    async def is_contract(self, address: str) -> bool:
        """Check if an address is a contract."""
        info = await self.get_address_info(address)
        return info.get("is_contract", False)
    
    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(chain={self._chain_type})>"
