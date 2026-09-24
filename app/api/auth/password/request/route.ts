import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

const schema = z.object({ email: z.string().email() });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Email invalide' }, { status: 400 });

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.password) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expires: new Date(Date.now() + 30 * 60 * 1000) },
      }),
    ]);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const link = `${appUrl}/reset-password?token=${token}`;
    try {
      await sendEmail(
        email,
        'Réinitialisation de votre mot de passe Aiworkpay',
        `<p>Vous avez demandé un nouveau mot de passe.</p><p><a href="${link}">Réinitialiser mon mot de passe</a></p><p>Ce lien expire dans 30 minutes.</p>`
      );
    } catch (error) {
      console.error('Password reset email error:', error);
      if (process.env.NODE_ENV !== 'production') console.info(`Password reset link: ${link}`);
    }
  }
  return NextResponse.json({ message: 'Si ce compte existe, un email a été envoyé.' });
}
