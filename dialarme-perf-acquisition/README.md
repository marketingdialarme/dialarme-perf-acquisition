# Dialarme — Dashboard performance acquisition

Compare trois cohortes de leads : Google Ads, Meta formulaire natif et Meta landing page.
Lit les leads dans Airtable et les dépenses publicitaires dans Windsor.ai.

## Variables d'environnement (Vercel)

- `AIRTABLE_TOKEN` : jeton Airtable en lecture sur la base Gestion de leads (Secret)
- `WINDSOR_API_KEY` : clé API Windsor.ai (Secret)
- `ACCESS_CODES` : codes d'accès séparés par des virgules (Secret)

## Écrans

- Vue d'ensemble : dépense, leads, positionnés, signés et coûts par cohorte
- Funnel : taux de passage à chaque étape
- Créatives : détail par publicité pour la landing page, via les UTM
- Opérations : délai de premier appel, leads non traités, répartition par conseiller
