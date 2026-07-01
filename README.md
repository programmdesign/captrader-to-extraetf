# CapTrader → ExtraETF Konverter

Tool zur Konvertierung von CapTrader-Transaktionen (Cash, Trades) in ExtraETF-Import-CSV-Dateien.

> 🔒 **Datenschutz:** Läuft vollständig lokal im Browser – keine Abhängigkeiten, kein Server, keine
> Netzwerkaufrufe, keine Uploads.
>
> ⚠️ **Kein offizielles Tool:** Konverter und Claude-Code-Skill (`.claude/skills/extraetf-import-ops/`)
> stehen in **keiner Verbindung** zu ExtraETF, CapTrader oder Interactive Brokers. Nutzung **ohne Gewähr
> und auf eigenes Risiko** – erzeugte Importe und Buchungen bitte selbst kontrollieren.

## Was es kann

- **Trades** → `Kauf` / `Verkauf` (inkl. Gebühren, Fremdwährung, Wechselkurs)
- **Anleihen** → Kurs in **% des Nominals**, Nominalwert als Anzahl
- **Dividenden** → **brutto** mit zugeordneter **Quellensteuer** (netto = Preis − Steuern)
- **Stornobuchungen** (`BUY (Ca.)`) → über die vorzeichenbehaftete Stückzahl korrekt gegengebucht
- **Fremdwährungen** (USD/HKD/GBP/NOK/SEK/…) → `Wechselkurs` = Einheiten je EUR (= 1 / IB `FXRateToBase`)
- **Optionaler Bestandsabgleich:** mit hochgeladenem CapTrader-*Bestand* ergänzt der Konverter automatisch
  `Einbuchung` / `Ausbuchung`, damit die Positionen exakt dem Auszug entsprechen (z. B. bei Corporate Actions).

## Schnellstart

1. `captrader-to-extraetf.html` im Browser öffnen (Doppelklick genügt – kein Server nötig).
2. Die CapTrader-CSVs hineinziehen (Trades + Cash, optional den *Bestand*).
3. Vorschau und Hinweise prüfen.
4. **„ExtraETF-Import-CSV herunterladen"** → `extraetf-import.csv`.
5. In ExtraETF unter **Datenimport → CSV importieren** einlesen.

## Flex Queries in CapTrader einrichten

Im CapTrader-/IB-Kundenportal unter **Berichte / Reporting → Flex Queries** zwei *Activity Flex Queries*
anlegen – eine für **Trades**, eine für **Cash**. Zeitraum frei wählbar (gesamte Kontolaufzeit oder pro
Jahr; das Tool verarbeitet beliebig viele Dateien auf einmal).

Für **beide** Queries identisch:

- Format **CSV**, Spaltenüberschriften **Ja**
- Datum **dd/MM/yyyy**, Zeit `HH:mm:ss`, Trennzeichen Leerzeichen
- Überschrift/Trailer, Titelzeile, Abschnittscode, Prüfpfad, Tages-Aufschlüsselung, Offsetting-/Cancel-Paare: **Nein**

Unterschiede:

- **Trades-Query:** Abschnitt `Trades`, Wechselkurse **Nein**
- **Cash-Query:** Abschnitt `Bartransaktionen`, Wechselkurse **Ja**

## Manuell nachzupflegen

ExtraETF importiert per CSV nur **Wertpapier-Transaktionen**. Reine Cash-Bewegungen listet der Konverter
unter **„Cash / Kontobuchungen"**; sie werden über **„Neue Aktivität → Cash"** erfasst (und je Konto
„Berücksichtigen" aktivieren, damit Cash zum Gesamtvermögen zählt):

- **Ein-/Auszahlungen, Broker-Zinsen, Gebühren, Quellensteuer auf Zinsen, Anleihe-Stückzinsen** → als Cash-Buchung.
- **Anleihe-Kupons:** ExtraETF hat **keinen `Kupon`-Typ** → am besten als **`Dividende` auf die jeweilige
  Anleihe** buchen (Betrag in „Dividendensumme (vor Steuern)"; die Position bleibt unverändert).
- **Verrechnungskonto:** Für ein exaktes Gesamtvermögen den Kontostand auf den CapTrader-Endbarsaldo
  abgleichen – dokumentierte Zahlungsströme als Cash-Buchungen, die verbleibende FX-/Rundungsdifferenz als
  eine Ausgleichsbuchung.

## Bekannte ExtraETF-Besonderheiten

Der Konverter erzeugt eine korrekte CSV; die folgenden Punkte liegen **an ExtraETF**:

- **Typ:** erkennt ExtraETF selbst anhand der ISIN; die CSV-Spalte ist nur ein Hinweis.
- **Fremdwährungs-Dividenden:** ExtraETF **ignoriert den `Wechselkurs` bei `Dividende`** und bucht
  `Preis` / `Steuern` als **EUR** (`318 HKD` → `318 €`); `Kauf` / `Verkauf` werden korrekt umgerechnet.
  Workaround: solche Dividenden in EUR buchen (`Währung=EUR`).
- **Split mit ISIN-Wechsel:** ExtraETF fügt einen **nicht löschbaren „Split"** ein und bewertet die neue
  Stückzahl mit dem **Vor-Split-Kurs** (Position überhöht). Manuelle `Kauf` / `Einbuchung` **werden nicht
  gespeichert** – die Position nur per **CSV-Import** (`Einbuchung`) anlegen.

## Lizenz

Siehe [`LICENSE`](LICENSE).
