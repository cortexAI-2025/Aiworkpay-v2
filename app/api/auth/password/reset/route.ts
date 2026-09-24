import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const schema = z.object({ token: z.string().length(64), password: z.string().min(8).max(128) });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Lien ou mot de passe invalide' }, { status: 400 });
  const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex');
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!reset || reset.expires <= new Date()) {
    return NextResponse.json({ error: 'Ce lien est invalide ou expiré' }, { status: 400 });
  }
  const password = await bcrypt.hash(parsed.data.password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { password } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: reset.userId } }),
    prisma.session.deleteMany({ where: { userId: reset.userId } }),
  ]);
  return NextResponse.json({ message: 'Mot de passe mis à jour' });
}
