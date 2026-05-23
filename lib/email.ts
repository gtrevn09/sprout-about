const RESET_EMAIL_URL = 'https://sprout-about-api.vercel.app/api/send-reset-email';

export async function sendPasswordResetEmail(
  toEmail: string,
  username: string,
  resetCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(RESET_EMAIL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_email: toEmail,
        user_name: username,
        reset_code: resetCode,
      }),
    });
    if (res.ok) return { success: true };
    const json = await res.json().catch(() => ({}));
    return { success: false, error: json.error ?? 'Failed to send email. Please try again.' };
  } catch {
    return { success: false, error: 'Network error. Check your connection and try again.' };
  }
}
