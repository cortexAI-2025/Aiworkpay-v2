import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';

const schema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  subject: z.string().min(1).max(120),
  message: z.string().min(10).max(5000),
});
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]!));

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
  const target = process.env.CONTACT_EMAIL;
  if (!target) return NextResponse.json({ error: 'Support non configuré' }, { status: 503 });
  const data = parsed.data;
  await sendEmail(
    target,
    `[Aiworkpay] ${data.subject}`,
    `<p><strong>${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}</strong> (${escapeHtml(data.email)})</p><p>${escapeHtml(data.message).replace(/\n/g, '<br>')}</p>`
  );
  return NextResponse.json({ sent: true });
}
