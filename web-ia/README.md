# Safe Worker — Industrial Monitor

Plateforme React + Vite + Supabase de **suivi des travailleurs en milieu industriel**.
Chaque travailleur porte un bracelet ESP qui envoie 5 mesures :

| Mesure | Colonne Supabase | Unité |
|---|---|---|
| Rythme cardiaque | `heart_rate` | bpm |
| Température de l'air | `air_temperature` | °C |
| Humidité de l'air | `air_humidity` | % |
| Détection d'obstacle (distance comparée au seuil) | `obstacle_distance` (+ `obstacle_detected` optionnel 1/0) | cm |
| Mouvement | `motion` | 1 = oui, 0 = non |

## Pages

- **Tableau de bord** : KPIs, état de chaque travailleur, courbes en temps réel, obstacles, zones cardiaques, mouvement, bracelets
- **Travailleurs** : liste, filtres, ajout / suppression
- **Alertes** : alertes en direct + historique, **seuils réglables** (FC max, température max, humidité max, seuil d'obstacle, durée d'immobilité)
- **Rapports** : synthèse par travailleur, graphiques, export Excel / PDF / impression
- **Capteurs** : association bracelet ↔ travailleur

## Installation (Windows / PowerShell)

```powershell
cd industrial-worker-monitor
npm install
npm run dev
```

## Base de données (Supabase → SQL Editor)

1. `supabase/schema.sql` — crée les tables (n'efface rien)
2. Crée ton compte **Superviseur** dans l'application
3. `supabase/seed-demo.sql` — données de démo (5 travailleurs, 1 h de mesures)
4. (optionnel) `supabase/cleanup-old-football.sql` — supprime les anciennes tables football

## Envoi des mesures depuis l'ESP32

Requête HTTP `POST` vers :

```
https://VOTRE_PROJECT_ID.supabase.co/rest/v1/sensor_readings
```

En-têtes :

```
apikey: VOTRE_CLE_ANON
Authorization: Bearer VOTRE_CLE_ANON
Content-Type: application/json
Prefer: return=minimal
```

Corps JSON :

```json
{
  "device_id": "ESP-W01",
  "heart_rate": 86,
  "air_temperature": 29.4,
  "air_humidity": 48,
  "obstacle_distance": 142,
  "motion": 1
}
```

Seul `device_id` est obligatoire : Supabase retrouve automatiquement le travailleur
(associé dans la page **Capteurs**) et le poste actif.
