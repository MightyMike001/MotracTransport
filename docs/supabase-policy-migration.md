# Supabase policy migratie

Deze repository bevat aangescherpte Row Level Security policies voor `app_users` en `app_user_tokens`. Volg onderstaande stappen om ze toe te passen op je Supabase-project.

## 1. Maak een backup

* Maak een export van de tabellen `app_users` en `app_user_tokens` via de Supabase UI of `pg_dump`.
* Noteer eventueel bestaande service keys zodat je ze later kunt testen.

## 2. Voer de nieuwe policies uit

1. Open het **SQL Editor**-scherm in de Supabase console.
2. Plak de volledige inhoud van [`supabase_users.sql`](../supabase_users.sql) in een nieuwe query.
3. Controleer dat de query op de juiste database wordt uitgevoerd en klik op **Run**.

Alternatief kun je het script via de Supabase CLI uitvoeren:

```bash
supabase db execute --file supabase_users.sql
```

De migratie verwijdert oude, anonieme policies en vervangt ze door varianten die alleen toegang geven aan:

* het service role token;
* aangemelde gebruikers voor hun eigen account en tokens;
* beheerders (`role = 'admin'`) voor het beheren van andere accounts.

## 3. Test de wijzigingen

* Meld je aan met een normaal account en controleer dat je alleen je eigen gegevens ziet.
* Meld je aan met een admin-account en verifieer dat het beheren van andere accounts nog werkt.
* Probeer dezelfde acties met een verlopen sessie om te bevestigen dat je nu duidelijke meldingen krijgt.

## 4. Deploy de bijgewerkte front-end

De front-end geeft voortaan een heldere melding bij 401/403-responses. Publiceer de nieuwe build zodat gebruikers deze foutafhandeling ontvangen.

## 5. Houd toezicht

Monitor de logboeken (bijvoorbeeld via Supabase logs) in de dagen na de migratie om ongewenste `permission denied`-fouten snel op te sporen.
