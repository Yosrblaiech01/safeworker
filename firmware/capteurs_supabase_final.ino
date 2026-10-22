#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// ===================== CONFIGURATION À REMPLIR =====================
const char* WIFI_SSID     = "VOTRE_WIFI";
const char* WIFI_PASS     = "VOTRE_MOT_DE_PASSE";

// Supabase : Project Settings > API (ou bouton "Connect")
const char* SUPABASE_URL  = "https://zbgugxqjguxgpekvkkos.supabase.co";
const char* SUPABASE_KEY  = "sb_publishable_SLpWYqBea0YekNKwW2-ZwQ_jppMUGAX";   // clé publique, JAMAIS la service_role

// Identifiant du bracelet. Le travailleur et le poste sont retrouvés
// automatiquement par Supabase grâce à l'association faite dans la page "Capteurs".
const char* DEVICE_ID = "ESP-REEL-01";

const unsigned long INTERVALLE_ENVOI = 2000;   // envoi vers Supabase toutes les 2 s

// ===================== Ultrason + LED =====================
const int trigPin = 5;
const int echoPin = 18;
const int ledPin = 2;

const float SEUIL_CM = 5.0;    // la LED s'allume sous 5 cm
const float HYSTERESIS = 1.0;  // évite le clignotement autour du seuil

bool alerte = false;

// ===================== Buzzer =====================
const int buzzerPin = 4;       // patte + (longue) sur GPIO 4, patte - (courte) sur GND

// true  = buzzer PASSIF : signal carré à BUZZER_FREQ Hz (comme le "Test 2" du code de test)
// false = buzzer ACTIF  : courant continu (comme le "Test 1" du code de test)
const bool BUZZER_PASSIF = true;
const int BUZZER_FREQ = 2000;  // fréquence du son (Hz), buzzer passif seulement

volatile bool g_buzzerVeutSonner = false;

// Même méthode que dans ton code de test qui fonctionne (bloquante : utilisée seulement au démarrage)
void sonBloquant(int frequence, int dureeMs) {
  unsigned long demiPeriode = 1000000UL / frequence / 2;   // en microsecondes
  unsigned long fin = millis() + dureeMs;
  while (millis() < fin) {
    digitalWrite(buzzerPin, HIGH);
    delayMicroseconds(demiPeriode);
    digitalWrite(buzzerPin, LOW);
    delayMicroseconds(demiPeriode);
  }
}

// Tâche dédiée au buzzer : le son ne bloque pas la lecture des capteurs
void tacheBuzzer(void* param) {
  const unsigned long demiPeriode = 1000000UL / BUZZER_FREQ / 2;
  for (;;) {
    if (g_buzzerVeutSonner) {
      if (BUZZER_PASSIF) {
        digitalWrite(buzzerPin, HIGH);
        delayMicroseconds(demiPeriode);
        digitalWrite(buzzerPin, LOW);
        delayMicroseconds(demiPeriode);
      } else {
        digitalWrite(buzzerPin, HIGH);
        vTaskDelay(pdMS_TO_TICKS(5));
      }
    } else {
      digitalWrite(buzzerPin, LOW);
      vTaskDelay(pdMS_TO_TICKS(5));
    }
  }
}

void initialiserBuzzer() {
  pinMode(buzzerPin, OUTPUT);
  digitalWrite(buzzerPin, LOW);

  // Deux bips de test au démarrage : notez lequel vous entendez
  Serial.println("Buzzer : test A (courant continu, 300 ms)");
  digitalWrite(buzzerPin, HIGH);
  delay(300);
  digitalWrite(buzzerPin, LOW);
  delay(300);
  Serial.println("Buzzer : test B (signal 2000 Hz, 300 ms)");
  sonBloquant(BUZZER_FREQ, 300);
  digitalWrite(buzzerPin, LOW);

  xTaskCreatePinnedToCore(tacheBuzzer, "buzzer", 2048, NULL, 1, NULL, 0);
}

// Allume ou éteint le buzzer (appelé par gererAlarme)
void buzzer(bool marche) {
  g_buzzerVeutSonner = marche;
}

// ===================== I2C =====================
const int SDA_PIN = 21;
const int SCL_PIN = 22;

// ===================== BME280 =====================
Adafruit_BME280 bme;
bool bmeOk = false;

const float SEUIL_TEMP = 30.0;   // °C : alerte si température > 30
const float HYST_TEMP = 1.0;     // °C
const float SEUIL_HUM = 70.0;    // % : alerte si humidité > 70
const float HYST_HUM = 3.0;      // %

bool alerteTemp = false;
bool alerteHum = false;

// ===================== MPU6050 : mouvement =====================
uint8_t MPU_ADDR = 0x68;          // 0x68 (AD0 à GND ou libre) ou 0x69 (AD0 à 3.3V), détecté automatiquement
bool mpuOk = false;
unsigned long dernierEssaiMPU = 0;
const unsigned long INTERVALLE_ESSAI_MPU = 5000;  // nouvel essai toutes les 5 s si absent

// Score d'intensité de mouvement (0–100)
//   0–SEUIL_IMMOBILE (5)            : immobile
//   SEUIL_IMMOBILE–SEUIL_ANORMAL    : mouvement normal (travail, marche)
//   > SEUIL_ANORMAL (70)            : mouvement anormal (chute, choc, geste brusque)
const float POIDS_ACC = 50.0;        // 1 g d'écart = 50 points
const float POIDS_GYRO = 0.2;        // 100 °/s de rotation = 20 points
const float BRUIT_ACC_G = 0.03;      // en dessous : bruit du capteur (ignoré)
const float BRUIT_GYRO_DPS = 3.0;    // en dessous : bruit du capteur (ignoré)
const float SCORE_MAX = 100.0;       // échelle du score (0 à 100) : ne pas changer, le site et Supabase attendent 0–100

// >>> SEUILS DE MOUVEMENT À RÉGLER ICI <<<
const float SEUIL_IMMOBILE = 5.0;    // score <= 5  : immobile
const float SEUIL_ANORMAL = 70.0;    // score > 70  : mouvement anormal (buzzer) — mettre la MÊME valeur que dans la page Alertes du site

float gyroOffX = 0, gyroOffY = 0, gyroOffZ = 0;
float scoreActuel = 0;               // dernier score calculé
unsigned long finMouvementAnormal = 0;   // l'anomalie reste affichée 3 s après un choc

// ===================== Pulse Sensor (analogique) =====================
const int pulsePin = 34;         // GPIO34 (ADC1, compatible avec le WiFi)

int signalPulse = 0;
int P = 2048;                    // pic du signal
int T = 2048;                    // creux du signal
int seuilPulse = 2048;           // seuil de détection (adaptatif)
int amplitude = 400;
bool pulse = false;
bool premierBattement = true;
bool deuxiemeBattement = false;
unsigned long dernierBattement = 0;
int IBI = 600;                   // intervalle entre battements (ms)
int rate[10];                    // derniers intervalles
volatile int bpm = 0;            // BPM moyen (lu aussi par la tâche d'envoi)

// Seuils du rythme cardiaque
const int SEUIL_BPM_HAUT = 100;  // alerte si BPM > 100
const int SEUIL_BPM_BAS = 50;    // alerte si BPM < 50
const int HYST_BPM = 5;

bool alerteBpmHaut = false;
bool alerteBpmBas = false;

// ===================== Valeurs partagées avec la tâche d'envoi =====================
volatile float g_temp = NAN;
volatile float g_hum = NAN;
volatile float g_dist = -1;          // -1 = pas de mesure valide
volatile bool  g_obstacle = false;
volatile float g_motionPeak = -1;   // pic du score depuis le dernier envoi (-1 = capteur absent)

// ===================== Temporisation (ms) =====================
unsigned long dernierUltrason = 0;
unsigned long dernierBME = 0;
unsigned long dernierAffichageBPM = 0;
unsigned long dernierEchantillon = 0;
unsigned long dernierAffichageDistance = 0;
unsigned long dernierMPU = 0;
unsigned long dernierAlarme = 0;

const unsigned long INTERVALLE_ULTRASON = 60;
const unsigned long INTERVALLE_BME = 500;
const unsigned long INTERVALLE_AFFICHAGE_BPM = 500;
const unsigned long INTERVALLE_AFFICHAGE_DISTANCE = 500;
const unsigned long INTERVALLE_ECHANTILLON = 5;   // lecture du capteur cardiaque toutes les 5 ms
const unsigned long INTERVALLE_MPU = 50;          // lecture du mouvement toutes les 50 ms
const unsigned long INTERVALLE_ALARME = 100;      // mise à jour du buzzer toutes les 100 ms

// ===================== Ultrason =====================
float mesurerDistance() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  // Timeout 15 ms (~2,5 m)
  long duree = pulseIn(echoPin, HIGH, 15000);
  if (duree == 0) return -1;     // pas d'écho
  return duree * 0.0343 / 2;
}

// ===================== BME280 =====================
void lireBME() {
  if (!bmeOk) {
    Serial.println("BME280 non détecté");
    return;
  }
  float temp = bme.readTemperature();   // °C
  float hum = bme.readHumidity();       // %

  if (isnan(temp) || isnan(hum)) {
    g_temp = NAN;
    g_hum = NAN;
    Serial.println("Erreur de lecture du BME280");
    return;
  }

  g_temp = temp;
  g_hum = hum;

  if (!alerteTemp && temp > SEUIL_TEMP) {
    alerteTemp = true;
  } else if (alerteTemp && temp < SEUIL_TEMP - HYST_TEMP) {
    alerteTemp = false;
  }

  if (!alerteHum && hum > SEUIL_HUM) {
    alerteHum = true;
  } else if (alerteHum && hum < SEUIL_HUM - HYST_HUM) {
    alerteHum = false;
  }

  Serial.printf("BME280 -> Temp : %.1f °C | Humidité : %.1f %%\n", temp, hum);

  if (alerteTemp) Serial.printf("  /!\\ ALERTE : température élevée (> %.1f °C)\n", SEUIL_TEMP);
  if (alerteHum)  Serial.printf("  /!\\ ALERTE : humidité élevée (> %.1f %%)\n", SEUIL_HUM);
}

// ===================== MPU6050 =====================
void mpuEcrire(uint8_t reg, uint8_t valeur) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(valeur);
  Wire.endTransmission();
}

bool mpuLireBrut(int16_t& ax, int16_t& ay, int16_t& az, int16_t& gx, int16_t& gy, int16_t& gz) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);                       // ACCEL_XOUT_H
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(MPU_ADDR, (uint8_t)14) != 14) return false;

  ax = (Wire.read() << 8) | Wire.read();
  ay = (Wire.read() << 8) | Wire.read();
  az = (Wire.read() << 8) | Wire.read();
  Wire.read(); Wire.read();               // température interne (ignorée)
  gx = (Wire.read() << 8) | Wire.read();
  gy = (Wire.read() << 8) | Wire.read();
  gz = (Wire.read() << 8) | Wire.read();
  return true;
}

// Liste tous les appareils présents sur le bus I2C (aide au diagnostic)
void scannerI2C() {
  Serial.println("Scan I2C...");
  int trouves = 0;
  for (uint8_t adr = 1; adr < 127; adr++) {
    Wire.beginTransmission(adr);
    if (Wire.endTransmission() == 0) {
      const char* nom = "";
      if (adr == 0x68 || adr == 0x69) nom = " (MPU6050)";
      else if (adr == 0x76 || adr == 0x77) nom = " (BME280)";
      Serial.printf("  -> appareil trouvé à l'adresse 0x%02X%s\n", adr, nom);
      trouves++;
    }
  }
  if (trouves == 0) Serial.println("  -> AUCUN appareil I2C : vérifiez SDA (GPIO 21), SCL (GPIO 22), VCC et GND");
}

bool mpuPresent(uint8_t adr) {
  Wire.beginTransmission(adr);
  if (Wire.endTransmission() != 0) return false;

  // Registre WHO_AM_I (0x75)
  Wire.beginTransmission(adr);
  Wire.write(0x75);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(adr, (uint8_t)1) != 1) return false;
  uint8_t id = Wire.read();
  Serial.printf("MPU6050 : trouvé à 0x%02X (WHO_AM_I = 0x%02X)\n", adr, id);
  return true;
}

bool initialiserMPU() {
  if (mpuPresent(0x68)) MPU_ADDR = 0x68;
  else if (mpuPresent(0x69)) MPU_ADDR = 0x69;
  else return false;

  mpuEcrire(0x6B, 0x00);   // réveil
  delay(50);
  mpuEcrire(0x1C, 0x00);   // accéléromètre ±2 g
  mpuEcrire(0x1B, 0x00);   // gyroscope ±250 °/s
  delay(100);

  // Calibration du gyroscope : NE PAS BOUGER le capteur pendant 1 s
  Serial.println("Calibration MPU6050 : ne bougez pas le capteur...");
  long sx = 0, sy = 0, sz = 0;
  int n = 0;
  for (int i = 0; i < 100; i++) {
    int16_t ax, ay, az, gx, gy, gz;
    if (mpuLireBrut(ax, ay, az, gx, gy, gz)) {
      sx += gx; sy += gy; sz += gz; n++;
    }
    delay(10);
  }
  if (n == 0) {
    Serial.println("MPU6050 : lecture impossible pendant la calibration");
    return false;
  }
  gyroOffX = (float)sx / n;
  gyroOffY = (float)sy / n;
  gyroOffZ = (float)sz / n;
  Serial.printf("Calibration MPU6050 terminée (%d lectures)\n", n);
  return true;
}

void lireMouvement() {
  if (!mpuOk) return;

  int16_t ax, ay, az, gx, gy, gz;
  if (!mpuLireBrut(ax, ay, az, gx, gy, gz)) return;

  // Accélération totale (en g) : vaut ~1 g au repos à cause de la gravité
  float axg = ax / 16384.0, ayg = ay / 16384.0, azg = az / 16384.0;
  float accG = sqrt(axg * axg + ayg * ayg + azg * azg);
  float ecartAcc = fabs(accG - 1.0);

  // Vitesse de rotation (en °/s), corrigée par la calibration
  float gxd = (gx - gyroOffX) / 131.0;
  float gyd = (gy - gyroOffY) / 131.0;
  float gzd = (gz - gyroOffZ) / 131.0;
  float gyro = sqrt(gxd * gxd + gyd * gyd + gzd * gzd);

  // On retire le bruit du capteur
  if (ecartAcc < BRUIT_ACC_G) ecartAcc = 0;
  if (gyro < BRUIT_GYRO_DPS) gyro = 0;

  float score = ecartAcc * POIDS_ACC + gyro * POIDS_GYRO;
  if (score > SCORE_MAX) score = SCORE_MAX;
  scoreActuel = score;

  // Un mouvement anormal reste signalé 3 s (sinon un choc bref passerait inaperçu)
  if (score > SEUIL_ANORMAL) finMouvementAnormal = millis() + 3000;

  // On garde le pic jusqu'au prochain envoi (un choc bref n'est pas raté)
  if (score > g_motionPeak) g_motionPeak = score;
}

// ===================== Rythme cardiaque =====================
void verifierSeuilsBpm() {
  if (!alerteBpmHaut && bpm > SEUIL_BPM_HAUT) {
    alerteBpmHaut = true;
  } else if (alerteBpmHaut && bpm < SEUIL_BPM_HAUT - HYST_BPM) {
    alerteBpmHaut = false;
  }

  if (!alerteBpmBas && bpm < SEUIL_BPM_BAS) {
    alerteBpmBas = true;
  } else if (alerteBpmBas && bpm > SEUIL_BPM_BAS + HYST_BPM) {
    alerteBpmBas = false;
  }
}

// Détection des battements (à appeler toutes les ~5 ms)
void lireRythmeCardiaque() {
  unsigned long maintenant = millis();
  signalPulse = analogRead(pulsePin);                  // 0..4095
  unsigned long N = maintenant - dernierBattement;     // temps depuis le dernier battement

  // Trouver le creux
  if (signalPulse < seuilPulse && N > (unsigned long)(IBI / 5) * 3) {
    if (signalPulse < T) T = signalPulse;
  }
  // Trouver le pic
  if (signalPulse > seuilPulse && signalPulse > P) {
    P = signalPulse;
  }

  // Un battement est détecté quand le signal monte au-dessus du seuil
  if (N > 250) {
    if (signalPulse > seuilPulse && !pulse && N > (unsigned long)(IBI / 5) * 3) {
      pulse = true;
      IBI = maintenant - dernierBattement;
      dernierBattement = maintenant;

      if (deuxiemeBattement) {
        deuxiemeBattement = false;
        for (int i = 0; i < 10; i++) rate[i] = IBI;
      }
      if (premierBattement) {
        premierBattement = false;
        deuxiemeBattement = true;
        return;
      }

      // Moyenne glissante sur 10 battements
      long total = 0;
      for (int i = 0; i < 9; i++) {
        rate[i] = rate[i + 1];
        total += rate[i];
      }
      rate[9] = IBI;
      total += rate[9];
      total /= 10;

      int nouveauBpm = 60000 / total;
      if (nouveauBpm > 40 && nouveauBpm < 200) {
        bpm = nouveauBpm;
        verifierSeuilsBpm();
      }
    }
  }

  // Fin du battement : on recalcule le seuil
  if (signalPulse < seuilPulse && pulse) {
    pulse = false;
    amplitude = P - T;
    seuilPulse = amplitude / 2 + T;
    P = seuilPulse;
    T = seuilPulse;
  }

  // Pas de battement depuis 2,5 s : on réinitialise (pas de doigt)
  if (N > 2500) {
    seuilPulse = 2048;
    P = 2048;
    T = 2048;
    dernierBattement = maintenant;
    premierBattement = true;
    deuxiemeBattement = false;
    bpm = 0;
    alerteBpmHaut = false;
    alerteBpmBas = false;
  }
}

void afficherRythmeCardiaque() {
  if (bpm == 0) {
    Serial.println("Coeur -> Placez votre doigt sur le capteur");
  } else {
    Serial.printf("Coeur -> BPM : %d\n", (int)bpm);
    if (alerteBpmHaut) Serial.printf("  /!\\ ALERTE : rythme cardiaque élevé (> %d BPM)\n", SEUIL_BPM_HAUT);
    if (alerteBpmBas)  Serial.printf("  /!\\ ALERTE : rythme cardiaque bas (< %d BPM)\n", SEUIL_BPM_BAS);
  }

  if (mpuOk) {
    const char* etat = scoreActuel > SEUIL_ANORMAL ? "ANORMAL" : (scoreActuel <= SEUIL_IMMOBILE ? "immobile" : "normal");
    Serial.printf("MPU6050 -> Intensité : %.0f / %.0f (%s) | seuil anormal : %.0f\n", scoreActuel, SCORE_MAX, etat, SEUIL_ANORMAL);
  } else {
    Serial.println("MPU6050 -> NON DÉTECTÉ (nouvel essai toutes les 5 s)");
  }
}

// ===================== Alarme : buzzer =====================
void gererAlarme() {
  bool anomalie = alerteBpmHaut || alerteBpmBas || alerteTemp || alerteHum || alerte ||
                  millis() < finMouvementAnormal;

  if (anomalie) {
    // Buzzer : bip 200 ms, pause 200 ms, tant que l'anomalie dure
    buzzer((millis() / 200) % 2 == 0);
  } else {
    buzzer(false);
  }
}

// ===================== Envoi vers Supabase =====================
String valeurOuNull(float v, int decimales) {
  return isnan(v) ? String("null") : String(v, decimales);
}

String construireJson() {
  float temp = g_temp;
  float hum = g_hum;
  float dist = g_dist;
  int bpmLu = bpm;
  // Pic du score depuis le dernier envoi, puis remise à zéro
  float mvt = g_motionPeak;
  if (mpuOk) g_motionPeak = 0;

  String json = "{";
  json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  json += "\"heart_rate\":" + (bpmLu > 0 ? String(bpmLu) : String("null")) + ",";
  json += "\"air_temperature\":" + valeurOuNull(temp, 1) + ",";
  json += "\"air_humidity\":" + valeurOuNull(hum, 1) + ",";
  json += "\"obstacle_distance\":" + (dist > 0 ? String(dist, 1) : String("null")) + ",";
  json += "\"obstacle_detected\":" + String(g_obstacle ? 1 : 0) + ",";   // 1 = obstacle, 0 = rien
  json += "\"motion\":" + (mvt >= 0 ? String(mvt, 0) : String("null"));  // intensité de mouvement 0–100
  // worker_id et shift_id : remplis automatiquement par Supabase à partir de device_id
  // timestamp : rempli automatiquement par Supabase (now())
  json += "}";
  return json;
}

// Tâche exécutée sur l'autre cœur : l'envoi réseau ne bloque pas la lecture des capteurs
void tacheEnvoi(void* param) {
  WiFiClientSecure client;
  client.setInsecure();   // pas de vérification du certificat (simple pour un prototype)
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/sensor_readings";

  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi : connexion en cours...");
      vTaskDelay(pdMS_TO_TICKS(2000));
      continue;
    }

    http.setReuse(true);
    http.setTimeout(5000);
    if (http.begin(client, url)) {
      http.addHeader("Content-Type", "application/json");
      http.addHeader("apikey", SUPABASE_KEY);
      http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
      http.addHeader("Prefer", "return=minimal");

      String json = construireJson();
      int code = http.POST(json);
      if (code == 201) {
        Serial.printf("Supabase : envoi OK -> %s\n", json.c_str());
      } else {
        Serial.printf("Supabase : erreur %d | %s\n", code,
                      code > 0 ? http.getString().c_str() : http.errorToString(code).c_str());
      }
      http.end();
    } else {
      Serial.println("Supabase : connexion impossible");
    }

    vTaskDelay(pdMS_TO_TICKS(INTERVALLE_ENVOI));
  }
}

// ===================== Setup =====================
void setup() {
  Serial.begin(115200);
  delay(1500);   // laisse le temps d'ouvrir le moniteur série
  Serial.println("\n===== SAFE WORKER : démarrage =====");

  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(ledPin, OUTPUT);
  pinMode(pulsePin, INPUT);
  initialiserBuzzer();   // 2 bips de test, puis démarre la tâche du buzzer

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);   // 100 kHz : plus fiable avec plusieurs capteurs sur le bus
  scannerI2C();

  // BME280 : adresse 0x76 ou 0x77
  bmeOk = bme.begin(0x76, &Wire);
  if (!bmeOk) bmeOk = bme.begin(0x77, &Wire);
  if (!bmeOk) {
    Serial.println("Erreur : BME280 introuvable (vérifiez SDA/SCL et l'adresse)");
  }

  // MPU6050
  mpuOk = initialiserMPU();
  if (mpuOk) {
    g_motionPeak = 0;
  } else {
    Serial.println("Erreur : MPU6050 introuvable (vérifiez VCC, GND, SDA/SCL)");
  }

  dernierBattement = millis();

  // WiFi (non bloquant) + tâche d'envoi sur le cœur 0
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  xTaskCreatePinnedToCore(tacheEnvoi, "envoiSupabase", 10240, NULL, 1, NULL, 0);
}

// ===================== Loop =====================
void loop() {
  unsigned long maintenant = millis();

  // Rythme cardiaque : échantillonnage toutes les 5 ms
  if (maintenant - dernierEchantillon >= INTERVALLE_ECHANTILLON) {
    dernierEchantillon = maintenant;
    lireRythmeCardiaque();
  }

  // MPU6050 absent : nouvel essai toutes les 5 s
  if (!mpuOk && maintenant - dernierEssaiMPU >= INTERVALLE_ESSAI_MPU) {
    dernierEssaiMPU = maintenant;
    mpuOk = initialiserMPU();
    if (mpuOk) g_motionPeak = 0;
  }

  // Mouvement (MPU6050)
  if (maintenant - dernierMPU >= INTERVALLE_MPU) {
    dernierMPU = maintenant;
    lireMouvement();
  }

  // Ultrason + LED
  if (maintenant - dernierUltrason >= INTERVALLE_ULTRASON) {
    dernierUltrason = maintenant;

    float d = mesurerDistance();

    if (d > 0) {
      bool ancienneAlerte = alerte;
      if (!alerte && d < SEUIL_CM) {
        alerte = true;
      } else if (alerte && d > SEUIL_CM + HYSTERESIS) {
        alerte = false;
      }
      digitalWrite(ledPin, alerte ? HIGH : LOW);

      g_dist = d;
      g_obstacle = alerte;

      // Affichage : toutes les 500 ms, ou tout de suite si la LED change d'état
      if (alerte != ancienneAlerte ||
          maintenant - dernierAffichageDistance >= INTERVALLE_AFFICHAGE_DISTANCE) {
        dernierAffichageDistance = maintenant;
        Serial.printf("Distance : %.1f cm | LED : %s\n", d, alerte ? "ALLUMÉE" : "éteinte");
      }
    } else {
      g_dist = -1;
      if (maintenant - dernierAffichageDistance >= INTERVALLE_AFFICHAGE_DISTANCE) {
        dernierAffichageDistance = maintenant;
        Serial.println("Hors portée");
      }
    }
  }

  // BME280
  if (maintenant - dernierBME >= INTERVALLE_BME) {
    dernierBME = maintenant;
    lireBME();
  }

  // Affichage du rythme cardiaque + mouvement
  if (maintenant - dernierAffichageBPM >= INTERVALLE_AFFICHAGE_BPM) {
    dernierAffichageBPM = maintenant;
    afficherRythmeCardiaque();
  }

  // Buzzer
  if (maintenant - dernierAlarme >= INTERVALLE_ALARME) {
    dernierAlarme = maintenant;
    gererAlarme();
  }
}
