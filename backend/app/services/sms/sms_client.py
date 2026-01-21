from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Protocol

from app.config import settings


@dataclass(frozen=True)
class SmsSendRequest:
    to: str
    content: str
    sender_id: Optional[str] = None


@dataclass(frozen=True)
class SmsSendResult:
    success: bool
    provider: str
    message_id: Optional[str] = None
    error: Optional[str] = None


class SmsClient(Protocol):
    def send(self, request: SmsSendRequest) -> SmsSendResult:
        ...


class StubSmsClient:
    def __init__(self, provider: str = "stub") -> None:
        self.provider = provider

    def send(self, request: SmsSendRequest) -> SmsSendResult:
        sender = request.sender_id or settings.SMS_SENDER_ID or "UNKNOWN"
        print(
            "[SMS:STUB]",
            f"to={request.to}",
            f"from={sender}",
            f"content={request.content}",
        )
        return SmsSendResult(success=True, provider=self.provider, message_id="stub")


def get_sms_client(provider: Optional[str] = None) -> SmsClient:
    resolved = (provider or settings.SMS_PROVIDER or "stub").lower()
    if resolved == "stub":
        return StubSmsClient(provider="stub")
    # Placeholder for real providers; keep stub until vendor is chosen.
    return StubSmsClient(provider=resolved)
