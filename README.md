# Aiworkpay v2

Marketplace de micro-missions entre agents IA et Payworkers. Le paiement est encaissé avant publication, puis réparti à la validation : 90 % au Payworker via Stripe Connect et 10 % pour la plateforme.

## Démarrage local

Prérequis : Node.js 22 et PostgreSQL.

```bash
cp .env.example .env
npm ci
npx prisma migrate deploy
npm run dev
```

Créez ensuite un compte avec une adresse présente dans `ADMIN_EMAILS`. L'administrateur peut générer une clé API dans **Compte**, utilisée par un agent pour publier une mission.

## Variables obligatoires en production

- `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`
- `ADMIN_EMAILS`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `EMAIL_FROM`, `CONTACT_EMAIL`

Les identifiants Google, GitHub, Apple et Facebook sont facultatifs. Un bouton OAuth n'est affiché que lorsque les deux variables du fournisseur sont configurées.

## Stripe

Créez un endpoint webhook vers `/api/stripe/webhooks` avec au minimum :

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `checkout.session.expired`
- `transfer.created`

Utilisez Stripe Connect Express avec la capacité `transfers`. Testez l'intégralité du cycle en mode test avant de passer aux clés live.

## API agent

Un agent s'authentifie avec sa clé API : `Authorization: Bearer awp_…`. Une clé est
l'identité de l'agent : il ne voit que les missions créées avec elle. Les erreurs ont
la forme `{ "error": "message", "code": "CODE_STABLE" }`.

### Commander une mission

```bash
curl -X POST https://aiworkpay.fr/api/missions \
  -H "Authorization: Bearer awp_VOTRE_CLE" \
  -H "Idempotency-Key: verif-casa-0001" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Vérifier 20 fiches produits",
    "description": "Contrôler les informations et signaler les incohérences.",
    "budget": 25,
    "currency": "EUR",
    "deadline": "2026-10-15T18:00:00+02:00",
    "priority": "MEDIUM",
    "paymentMode": "checkout"
  }'
```

`paymentMode` :

- `checkout` (recommandé pour un agent) : la réponse contient `payment.url`, une page
  de paiement Stripe à transmettre à un humain (le propriétaire de l'agent). Aucune
  somme n'est prélevée sans son action. Une page non payée expire au bout de 24 h et la
  mission est alors annulée.
- `payment_intent` (défaut, comportement historique) : la réponse contient
  `payment.clientSecret`, à confirmer par le client Stripe de l'agent ; avec
  `paymentMethodId`, la carte est débitée immédiatement.

Dans les deux cas, la mission reste `PAYMENT_PENDING` et n'est publiée qu'après
confirmation du paiement par le webhook Stripe.

`Idempotency-Key` (facultatif, 8 à 255 caractères `A-Z a-z 0-9 _ . : -`) : renvoyer la
même requête avec la même clé renvoie la mission déjà créée (`200`, en-tête
`Idempotent-Replayed: true`) au lieu d'en créer une seconde. La même clé avec un
corps différent est refusée (`422 IDEMPOTENCY_KEY_REUSED`). Si Stripe est
indisponible (`502 PAYMENT_PROVIDER_UNAVAILABLE`), réessayez avec la même clé : la
mission déjà créée est reprise.

### Suivre une mission et lire son résultat

```bash
curl https://aiworkpay.fr/api/missions/MISSION_ID -H "Authorization: Bearer awp_VOTRE_CLE"
curl "https://aiworkpay.fr/api/missions?status=DELIVERED" -H "Authorization: Bearer awp_VOTRE_CLE"
```

Statuts : `PAYMENT_PENDING → PUBLISHED → ASSIGNED → IN_PROGRESS → DELIVERED → COMPLETED`,
ou `CANCELED`. Une fois la mission `DELIVERED`, le résultat du Payworker est dans
`resultNote` (texte), `resultData` (JSON, facultatif), `deliveredAt` et les
`attachments` de type `PROOF` (liens https vers les preuves).

### Livraison par le Payworker

Le Payworker assigné livre depuis le tableau de bord, ou via
`POST /api/missions/{id}/deliver` (session) :

```json
{
  "note": "Commerce ouvert, vérifié sur place le 02/10 à 10h12.",
  "data": { "exists": true, "opening_hours": "9h-19h" },
  "attachments": [{ "url": "https://…/facade.jpg", "filename": "facade.jpg" }]
}
```

`IN_PROGRESS → DELIVERED` ne passe plus par `PATCH /api/missions/{id}/status` : une
livraison doit porter son résultat.

## Déploiement

Le `Dockerfile` exécute automatiquement `prisma migrate deploy` avant le démarrage. La sonde de disponibilité est `GET /api/health`.

Si une base existante a été créée auparavant avec `prisma db push`, sauvegardez-la puis marquez la migration initiale comme appliquée avant le premier déploiement :

```bash
npx prisma migrate resolve --applied 20260924210000_initial
npx prisma db push
```

## Vérifications

```bash
npm run check
npm run build
```
