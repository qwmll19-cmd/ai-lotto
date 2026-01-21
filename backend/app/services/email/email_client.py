"""이메일 발송 클라이언트"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Optional

from backend.app.config import settings

logger = logging.getLogger(__name__)


class EmailClient(ABC):
    """이메일 클라이언트 추상 클래스"""

    @abstractmethod
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> bool:
        """이메일 발송"""
        pass

    def send_password_reset_email(self, to_email: str, reset_url: str, expires_minutes: int = 30) -> bool:
        """비밀번호 재설정 이메일 발송"""
        subject = "[팡팡로또] 비밀번호 재설정 안내"

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ text-align: center; padding: 20px 0; border-bottom: 2px solid #4f46e5; }}
        .header h1 {{ color: #4f46e5; margin: 0; font-size: 24px; }}
        .content {{ padding: 30px 0; }}
        .button {{ display: inline-block; background: #4f46e5; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
        .button:hover {{ background: #4338ca; }}
        .warning {{ background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin: 20px 0; font-size: 14px; }}
        .footer {{ text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }}
        .url-text {{ word-break: break-all; font-size: 12px; color: #6b7280; margin-top: 10px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>팡팡로또</h1>
        </div>
        <div class="content">
            <h2>비밀번호 재설정 요청</h2>
            <p>안녕하세요,</p>
            <p>아래 버튼을 클릭하여 새로운 비밀번호를 설정해 주세요.</p>

            <div style="text-align: center;">
                <a href="{reset_url}" class="button">비밀번호 재설정하기</a>
            </div>

            <div class="warning">
                <strong>주의:</strong> 이 링크는 {expires_minutes}분 동안만 유효합니다.<br>
                본인이 요청하지 않은 경우, 이 이메일을 무시해 주세요.
            </div>

            <p class="url-text">
                버튼이 작동하지 않는 경우, 아래 링크를 복사하여 브라우저에 붙여넣기 해주세요:<br>
                {reset_url}
            </p>
        </div>
        <div class="footer">
            <p>본 메일은 발신 전용입니다.</p>
            <p>&copy; 팡팡로또. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""

        text_content = f"""
[팡팡로또] 비밀번호 재설정 안내

안녕하세요,

비밀번호 재설정이 요청되었습니다.
아래 링크를 클릭하여 새로운 비밀번호를 설정해 주세요.

{reset_url}

주의: 이 링크는 {expires_minutes}분 동안만 유효합니다.
본인이 요청하지 않은 경우, 이 이메일을 무시해 주세요.

---
팡팡로또
"""

        return self.send_email(to_email, subject, html_content, text_content)


class StubEmailClient(EmailClient):
    """개발용 Stub 이메일 클라이언트 (실제 발송 안 함)"""

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> bool:
        logger.info(f"[STUB EMAIL] To: {to_email}, Subject: {subject}")
        logger.debug(f"[STUB EMAIL] HTML Content length: {len(html_content)}")
        return True


class SendGridEmailClient(EmailClient):
    """SendGrid 이메일 클라이언트"""

    def __init__(self, api_key: str, from_email: str, from_name: str):
        self.api_key = api_key
        self.from_email = from_email
        self.from_name = from_name

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> bool:
        try:
            # SendGrid SDK 사용
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail

            message = Mail(
                from_email=(self.from_email, self.from_name),
                to_emails=to_email,
                subject=subject,
                plain_text_content=text_content,
                html_content=html_content,
            )

            sg = SendGridAPIClient(self.api_key)
            response = sg.send(message)

            if response.status_code in (200, 201, 202):
                logger.info(f"[SendGrid] Email sent successfully to {to_email}")
                return True
            else:
                logger.error(f"[SendGrid] Failed to send email: {response.status_code}")
                return False

        except ImportError:
            logger.error("[SendGrid] sendgrid package not installed. Run: pip install sendgrid")
            return False
        except Exception as e:
            logger.error(f"[SendGrid] Error sending email: {e}")
            return False


def get_email_client(provider: Optional[str] = None) -> EmailClient:
    """이메일 클라이언트 팩토리"""
    resolved = (provider or settings.EMAIL_PROVIDER or "stub").lower()

    if resolved == "sendgrid":
        if not settings.SENDGRID_API_KEY:
            logger.warning("[Email] SENDGRID_API_KEY not set, falling back to stub")
            return StubEmailClient()
        return SendGridEmailClient(
            api_key=settings.SENDGRID_API_KEY,
            from_email=settings.EMAIL_FROM_ADDRESS,
            from_name=settings.EMAIL_FROM_NAME,
        )

    # 기본값: stub
    return StubEmailClient()
