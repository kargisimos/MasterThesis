import smtplib
import ssl
import asyncio
from email.message import EmailMessage
from config import settings

def send_email_sync(subject: str, content: str, to_emails: list[str], is_html: bool = False):
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print("SMTP credentials not configured. Skipping email.")
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = ", ".join(to_emails)

    if is_html:
        msg.set_content("This is an HTML email. Please use an email client that supports HTML.")
        msg.add_alternative(content, subtype='html')
    else:
        msg.set_content(content)

    context = ssl.create_default_context()

    try:
        print(f"DEBUG: Attempting to send email to {to_emails} via {settings.SMTP_HOST}:{settings.SMTP_PORT}")
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        print(f"SUCCESS: Email sent successfully to {to_emails}")
    except Exception as e:
        print(f"ERROR: Failed to send email to {to_emails}: {e}")
        import traceback
        traceback.print_exc()

async def send_email(subject: str, content: str, to_emails: list[str], is_html: bool = False):
    await asyncio.to_thread(send_email_sync, subject, content, to_emails, is_html)
