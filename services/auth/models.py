"""Authentication models for CashNet.

Defines user, role, permission, and session models.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserRole(str, Enum):
    """User roles in the system."""
    ADMIN = "admin"
    SUPERVISOR = "supervisor"
    INVESTIGATOR = "investigator"
    ANALYST = "analyst"
    VIEWER = "viewer"


class Permission(str, Enum):
    """Granular permissions."""
    # Case permissions
    CASE_CREATE = "case:create"
    CASE_READ = "case:read"
    CASE_UPDATE = "case:update"
    CASE_DELETE = "case:delete"
    CASE_ASSIGN = "case:assign"
    
    # Finding permissions
    FINDING_CREATE = "finding:create"
    FINDING_READ = "finding:read"
    FINDING_UPDATE = "finding:update"
    FINDING_ADJUDICATE = "finding:adjudicate"
    
    # Evidence permissions
    EVIDENCE_CREATE = "evidence:create"
    EVIDENCE_READ = "evidence:read"
    EVIDENCE_VERIFY = "evidence:verify"
    
    # Action request permissions
    ACTION_CREATE = "action:create"
    ACTION_APPROVE = "action:approve"
    ACTION_SEND = "action:send"
    
    # Entity permissions
    ENTITY_CREATE = "entity:create"
    ENTITY_READ = "entity:read"
    ENTITY_UPDATE = "entity:update"
    
    # User management
    USER_CREATE = "user:create"
    USER_READ = "user:read"
    USER_UPDATE = "user:update"
    USER_DELETE = "user:delete"
    
    # System permissions
    SYSTEM_ADMIN = "system:admin"
    AUDIT_READ = "audit:read"


# Role-Permission mapping
ROLE_PERMISSIONS: dict[UserRole, list[Permission]] = {
    UserRole.ADMIN: list(Permission),  # All permissions
    UserRole.SUPERVISOR: [
        Permission.CASE_CREATE, Permission.CASE_READ, Permission.CASE_UPDATE,
        Permission.CASE_ASSIGN, Permission.FINDING_CREATE, Permission.FINDING_READ,
        Permission.FINDING_UPDATE, Permission.FINDING_ADJUDICATE,
        Permission.EVIDENCE_CREATE, Permission.EVIDENCE_READ, Permission.EVIDENCE_VERIFY,
        Permission.ACTION_CREATE, Permission.ACTION_APPROVE, Permission.ACTION_SEND,
        Permission.ENTITY_CREATE, Permission.ENTITY_READ, Permission.ENTITY_UPDATE,
        Permission.USER_READ, Permission.AUDIT_READ,
    ],
    UserRole.INVESTIGATOR: [
        Permission.CASE_CREATE, Permission.CASE_READ, Permission.CASE_UPDATE,
        Permission.FINDING_CREATE, Permission.FINDING_READ, Permission.FINDING_UPDATE,
        Permission.EVIDENCE_CREATE, Permission.EVIDENCE_READ,
        Permission.ACTION_CREATE, Permission.ENTITY_READ,
    ],
    UserRole.ANALYST: [
        Permission.CASE_READ, Permission.FINDING_READ, Permission.EVIDENCE_READ,
        Permission.ENTITY_READ,
    ],
    UserRole.VIEWER: [
        Permission.CASE_READ, Permission.FINDING_READ, Permission.EVIDENCE_READ,
    ],
}


class User(BaseModel):
    """User model."""
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.VIEWER
    is_active: bool = True
    is_mfa_enabled: bool = False
    mfa_secret: Optional[str] = None
    department: Optional[str] = None
    badge_number: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None


class UserCreate(BaseModel):
    """User creation request."""
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    role: UserRole = UserRole.VIEWER
    department: Optional[str] = None
    badge_number: Optional[str] = None


class UserUpdate(BaseModel):
    """User update request."""
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None


class Token(BaseModel):
    """JWT token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: User


class TokenPayload(BaseModel):
    """JWT token payload."""
    sub: str  # User ID
    email: str
    role: UserRole
    permissions: list[str]
    exp: datetime
    iat: datetime
    jti: str  # JWT ID for token revocation


class MFASetup(BaseModel):
    """MFA setup response."""
    secret: str
    qr_code_url: str
    backup_codes: list[str]


class MFAMVerify(BaseModel):
    """MFA verification request."""
    code: str = Field(min_length=6, max_length=6)
    backup_code: Optional[str] = None


class Session(BaseModel):
    """User session."""
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    user_id: uuid.UUID
    token_jti: str
    ip_address: str
    user_agent: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    is_active: bool = True


class LoginRequest(BaseModel):
    """Login request."""
    email: EmailStr
    password: str
    mfa_code: Optional[str] = None


class PasswordChange(BaseModel):
    """Password change request."""
    current_password: str
    new_password: str = Field(min_length=8)


class PasswordReset(BaseModel):
    """Password reset request."""
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Password reset confirmation."""
    token: str
    new_password: str = Field(min_length=8)
