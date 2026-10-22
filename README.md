# SAFE WORKER

Ceinture dorsale intelligente pour la sécurité des travailleurs (ESPRIT, 5 SLEAM 1, équipe Tech Titans).

- `firmware/` : code ESP32 (Pulse Sensor, BME280, MPU6050, HC-SR04, buzzer) qui envoie une mesure toutes les 2 s à Supabase.
- `web/` : site React + Vite (authentification, tableau de bord par capteur, historique, export PDF, analyse IA du risque).

Avant de lancer : copier `web/.env.example` vers `web/.env` et renseigner les clés Supabase ; renseigner le Wi-Fi dans le firmware.

Équipe : Ahmed Nasri, Hamza Arfaoui, Yosr Blaiech. Encadrante : Mme Ameni Mersani.
